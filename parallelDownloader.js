const fs = require('fs')
const path = require('path')
const axios = require('axios')
const dotenv = require('dotenv')

dotenv.config()

const API_KEY = process.env.FPT_API_KEY
const VOICE = 'thuminh'
const OUTPUT_DIR = path.join(__dirname, 'downloads')
const MAX_CONCURRENCY = 5
const MAX_WAIT_TIME = 10000 // 10s

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR)

const texts = require('./texts.json')
const failed = []

async function waitForAudioReady(asyncUrl, maxWait = MAX_WAIT_TIME) {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
        try {
            const res = await axios.head(asyncUrl)
            if (res.status === 200) return true
        } catch { }
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    throw new Error('File not ready: ' + asyncUrl)
}

async function generateAndDownload(name) {
    let text = name

    // Thêm dấu '.' nếu text < 3 ký tự
    while (text.length < 3) {
        text += '.'
    }

    try {
        const ttsRes = await axios.post('https://api.fpt.ai/hmi/tts/v5', text, {
            headers: {
                'api-key': API_KEY,
                'speed': '1.0',
                'voice': VOICE,
                'Content-Type': 'text/plain',
            },
        })

        const asyncUrl = ttsRes.data.async
        await waitForAudioReady(asyncUrl)

        const filename = `${name}.mp3`
        const outputPath = path.join(OUTPUT_DIR, filename)

        const audioStream = await axios.get(asyncUrl, { responseType: 'stream' })
        const writer = fs.createWriteStream(outputPath)

        audioStream.data.pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Saved: ${filename}`)
                resolve()
            })
            writer.on('error', reject)
        })
    } catch (err) {
        console.error(`❌ Failed for "${name}": ${err.message}`)
        failed.push(name)
    }
}

async function run(concurrency = MAX_CONCURRENCY) {
    const queue = [...texts]
    const running = []

    while (queue.length > 0 || running.length > 0) {
        while (queue.length > 0 && running.length < concurrency) {
            const name = queue.shift()
            const p = generateAndDownload(name)
                .finally(() => {
                    const index = running.indexOf(p)
                    if (index !== -1) running.splice(index, 1)
                })
            running.push(p)
        }

        await Promise.race(running)
    }

    if (failed.length > 0) {
        const failedPath = path.join(__dirname, 'failed.json')
        fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2), 'utf-8')
        console.log(`⚠️  Saved failed list to ${failedPath}`)
    }
}

run()
