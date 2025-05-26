const fs = require('fs')
const path = require('path')
const axios = require('axios')
const dotenv = require('dotenv')
const { removeVietnameseTones } = require('./utils')

dotenv.config()

const API_KEY = process.env.FPT_API_KEY
const VOICE = 'thuminh'
const OUTPUT_DIR = path.join(__dirname, 'downloads')

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR)

const texts = require('./texts.json')

async function waitForAudioReady(asyncUrl, maxWait = 10000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    try {
      const res = await axios.head(asyncUrl)
      if (res.status === 200) return true
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('File not ready: ' + asyncUrl)
}

async function generateAndDownload(text) {
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

    const filename = removeVietnameseTones(text) + '.mp3'
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
    console.error(`❌ Failed for "${text}":`, err.message)
  }
}

async function run() {
  for (const text of texts) {
    await generateAndDownload(text)
  }
}

run()
