import fs from 'fs'
import path from 'path'
import axios from 'axios'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('Chạy English...')

const OUTPUT_DIR = path.join(__dirname, 'downloads/english/')
const MAX_CONCURRENCY = 5
const BATCH_SIZE = 60
const DELAY_BETWEEN_BATCHES = 1 * 60 * 1000
const RETRY_FAILED_DELAY = 60 * 1000
const DEST_DIR = path.join('D:/nuxt-test/fork/edu-app/public/sounds/english/words') // Tùy chỉnh

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR)

function loadTexts() {
    const filePath = path.join(__dirname, 'en_texts.json')
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveTexts(texts) {
    const filePath = path.join(__dirname, 'en_texts.json')
    fs.writeFileSync(filePath, JSON.stringify(texts, null, 2), 'utf-8')
}

function loadFailed() {
    const filePath = path.join(__dirname, 'en_failed.json')
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function saveFailed(failed) {
    const filePath = path.join(__dirname, 'en_failed.json')
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

async function generateAndDownload(name) {
    const text = name
    const voiceId = 'TxGEqnHWrfWFTfGW9XjX'
    const API_KEY = process.env.ELEVENLABS_API_KEY

    const payload = {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
            stability: 0.3,
            similarity_boost: 0.7
        }
    }

    try {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            payload,
            {
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                responseType: 'stream'
            }
        )

        const filename = `${name}.mp3`
        const outputPath = path.join(OUTPUT_DIR, filename)
        const writer = fs.createWriteStream(outputPath)

        response.data.pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Saved: ${filename}`)
                resolve()
            })
            writer.on('error', reject)
        })
    } catch (err) {
        console.error(`❌ Failed for "${name}": ${err.message}`)
        throw err
    }
}

async function processBatch(batch) {
    const failed = []
    const running = []

    while (batch.length > 0 || running.length > 0) {
        while (batch.length > 0 && running.length < MAX_CONCURRENCY) {
            const name = batch.shift()
            const p = generateAndDownload(name)
                .catch(() => failed.push(name))
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
    for (const name of failedItems) {
        try {
            await generateAndDownload(name)
        } catch {
            stillFailed.push(name)
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

export default function main() {
    run()
}
