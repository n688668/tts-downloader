import fs from 'fs'
import path from 'path'
import axios from 'axios'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_KEY = process.env.FPT_API_KEY
const VOICE = 'thuminh'
const OUTPUT_DIR = path.join(__dirname, 'downloads/vietnamesev2/')
const MAX_CONCURRENCY = 5
const BATCH_SIZE = 60
const DELAY_BETWEEN_BATCHES = 2 * 60 * 1000
const RETRY_FAILED_DELAY = 60 * 1000
const MAX_WAIT_TIME = 10000
const DEST_DIR = path.join('D:/nuxt-test/fork/edu-app/public/sounds/vietnamese/words')

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

function loadTexts() {
    const filePath = path.join(__dirname, 'vi2_texts.json')
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveTexts(texts) {
    const filePath = path.join(__dirname, 'vi2_texts.json')
    fs.writeFileSync(filePath, JSON.stringify(texts, null, 2), 'utf-8')
}

function loadFailed() {
    const filePath = path.join(__dirname, 'vi2_failed.json')
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveFailed(failed) {
    const filePath = path.join(__dirname, 'vi2_failed.json')
    if (failed.length > 0) {
        fs.writeFileSync(filePath, JSON.stringify(failed, null, 2), 'utf-8')
        console.log(`⚠️  Saved failed list to ${filePath}`)
    } else if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`✅ All failed items resolved, deleted ${filePath}`)
    }
}

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForAudioReady(asyncUrl, maxWait = MAX_WAIT_TIME) {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
        try {
            const res = await axios.head(asyncUrl)
            if (res.status === 200) return true
        } catch {}
        await wait(1000)
    }
    throw new Error('File not ready: ' + asyncUrl)
}

async function generateAndDownload({ text, slug }) {
    let paddedText = text
    while (paddedText.length < 3) {
        paddedText += '.'
    }

    try {
        const ttsRes = await axios.post('https://api.fpt.ai/hmi/tts/v5', paddedText, {
            headers: {
                'api-key': API_KEY,
                'speed': '1.0',
                'voice': VOICE,
                'Content-Type': 'text/plain',
            },
        })

        const asyncUrl = ttsRes.data.async
        await waitForAudioReady(asyncUrl)

        const filename = `${slug}.mp3`
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
        console.error(`❌ Failed for "${text}": ${err.message}`)
        throw err
    }
}

async function processBatch(batch) {
    const failed = []
    const running = []

    while (batch.length > 0 || running.length > 0) {
        while (batch.length > 0 && running.length < MAX_CONCURRENCY) {
            const item = batch.shift()
            const p = generateAndDownload(item)
                .catch(() => failed.push(item))
                .finally(() => {
                    const index = running.indexOf(p)
                    if (index !== -1) running.splice(index, 1)
                })
            running.push(p)
        }

        await Promise.race(running)
    }

    return failed
}

async function retryFailedDownloads() {
    const failedItems = loadFailed()
    if (failedItems.length === 0) return

    console.log(`🔁 Retrying ${failedItems.length} failed items after ${RETRY_FAILED_DELAY / 1000}s...`)
    await wait(RETRY_FAILED_DELAY)

    const stillFailed = []
    for (const item of failedItems) {
        try {
            await generateAndDownload(item)
        } catch {
            stillFailed.push(item)
        }
    }

    saveFailed(stillFailed)
}

function moveAllFiles() {
    if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true })

    const files = fs.readdirSync(OUTPUT_DIR)
    for (const file of files) {
        const fromPath = path.join(OUTPUT_DIR, file)
        const toPath = path.join(DEST_DIR, file)

        try {
            fs.renameSync(fromPath, toPath)
            console.log(`📦 Moved: ${file}`)
        } catch (err) {
            console.error(`⚠️  Failed to move ${file}: ${err.message}`)
        }
    }
}

async function run() {
    while (true) {
        let texts = loadTexts()
        if (texts.length === 0) break

        const batch = texts.slice(0, BATCH_SIZE)
        console.log(`🚀 Processing batch of ${batch.length} items...`)

        const failed = await processBatch([...batch])

        texts = texts.slice(BATCH_SIZE)
        saveTexts(texts)
        saveFailed(failed)

        await retryFailedDownloads()

        if (texts.length > 0) {
            console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`)
            await wait(DELAY_BETWEEN_BATCHES)
        }
    }

    console.log('✅ All texts processed.')
    moveAllFiles()
}

export default function () {
    run()
}
