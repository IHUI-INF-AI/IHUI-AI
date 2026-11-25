// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 从单一真相源渲染提示音资产(2026-11-26 立)。
 *
 * 为什么需要它:web 用 AudioContext 实时合成,不需要文件;RN(expo-audio)与
 * 小程序(InnerAudioContext)只能播本地音频文件。若两端手搓/各找素材,三端听感必然漂。
 * 本脚本 import `packages/shared/src/notifications/ringtone.ts` 的同一张音符表,
 * 用与 web 播放器一致的合成算法(主音 + 2/3 次谐波、6ms 起音、指数衰减)渲染 16bit PCM WAV,
 * 一次产出三端副本。
 *
 * 用法:node scripts/gen-ringtone-assets.mjs [--check]
 *   --check 只比对尺寸/存在性,不写盘(CI/守门用)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const specPath = join(rootDir, 'packages/shared/src/notifications/ringtone.ts')

const TARGET_DIRS = [
  join(rootDir, 'apps/web/public/sounds'),
  join(rootDir, 'apps/miniapp-taro/src/static/sounds'),
  join(rootDir, 'apps/mobile-rn/assets/sounds'),
]

const SAMPLE_RATE = 44_100
const ATTACK = 0.006
const FLOOR = 0.0001
const PARTIALS = [
  [1, 1],
  [2, 0.32],
  [3, 0.16],
]

/** 与 web playRingtone 的包络同形:起音线性爬升,其后指数衰减到静音底噪 */
function envelopeAt(t, start, dur, peak) {
  const local = t - start
  if (local < 0 || local > dur) return 0
  if (local < ATTACK) return (peak * local) / ATTACK
  const decaySpan = dur - ATTACK
  if (decaySpan <= 0) return 0
  const k = Math.log(FLOOR / peak)
  return peak * Math.exp((k * (local - ATTACK)) / decaySpan)
}

function renderWav(spec) {
  const total = Math.max(...spec.notes.map((n) => n.start + n.dur)) + 0.02
  const frames = Math.ceil(total * SAMPLE_RATE)
  const samples = new Float64Array(frames)

  for (const note of spec.notes) {
    const peakBase = note.gain ?? 0.5
    for (const [multiple, weight] of PARTIALS) {
      const peak = peakBase * weight
      const freq = note.freq * multiple
      for (let i = 0; i < frames; i += 1) {
        const t = i / SAMPLE_RATE
        const env = envelopeAt(t, note.start, note.dur, peak)
        if (env === 0) continue
        samples[i] += Math.sin(2 * Math.PI * freq * t) * env
      }
    }
  }

  // 峰值归一到 0.9,避免叠加泛音后削波;全部静音(空序列)不写 NaN
  let maxAbs = 0
  for (const v of samples) maxAbs = Math.max(maxAbs, Math.abs(v))
  const scale = maxAbs > 0 ? 0.9 / maxAbs : 0

  const dataSize = frames * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < frames; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i] * scale))
    buffer.writeInt16LE(Math.round(value * 32_767), 44 + i * 2)
  }
  return buffer
}

async function loadSpecs() {
  const mod = await import(pathToFileURL(specPath).href)
  if (!Array.isArray(mod.RINGTONES) || mod.RINGTONES.length === 0) {
    throw new Error(`铃声表为空:${specPath}`)
  }
  return mod.RINGTONES
}

const checkOnly = process.argv.includes('--check')
const specs = await loadSpecs()
let written = 0
const problems = []

for (const spec of specs) {
  const buffer = renderWav(spec)
  const fileName = `ringtone-${spec.id}.wav`
  for (const dir of TARGET_DIRS) {
    if (checkOnly) {
      const target = join(dir, fileName)
      if (!existsSync(target)) problems.push(`缺失:${target}`)
      else if (readFileSync(target).length !== buffer.length) problems.push(`尺寸不一致:${target}`)
      continue
    }
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, fileName), buffer)
    written += 1
  }
}

if (checkOnly) {
  if (problems.length > 0) {
    console.error(`[ringtone] 资产与源码不一致(${problems.length}):\n${problems.join('\n')}`)
    process.exit(1)
  }
  console.log(`[ringtone] ${specs.length} 个铃声 × ${TARGET_DIRS.length} 端副本齐备`)
} else {
  console.log(`[ringtone] 渲染 ${specs.length} 个铃声,写入 ${written} 个文件`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
