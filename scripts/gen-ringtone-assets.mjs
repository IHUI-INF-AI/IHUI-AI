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
 * 编码分化(2026-11-26):小程序端主包受微信 2 MiB 硬限,8 枚 16 kHz WAV 合计 124,518 B,
 * 是主包减到 90% 水位线以上最好的一块空间 ⇒ 小程序端改编码 48kbps 单声道 MP3
 * (合计 28,216 B,省 96,302 B,听感对短提示音无损可辨)。web/RN 仍用 WAV:RN 的
 * `withNotificationSounds.cjs` 把 wav 灌进 Android res/raw,改动会波及原生通知渠道,
 * 与本票「主包体积」目标无关,刻意不动。三端音符表仍是同一张,只差容器。
 *
 * MP3 编码器为 ffmpeg(PATH 或 FFMPEG_BIN 指定),经 stdin/stdout pipe 直传、不落临时文件;
 * 同一 WAV 连编两次 md5 一致(libmp3lame 确定性),故 --check 的尺寸比对依然有效。
 * ffmpeg 只在「重新生成资产」时需要:产物 MP3 已入库,构建/CI 直接用,不引入构建期依赖。
 *
 * 用法:node scripts/gen-ringtone-assets.mjs [--check]
 *   --check 只比对尺寸/存在性,不写盘(CI/守门用);mp3 端重算预期尺寸需 ffmpeg,
 *   取不到 ffmpeg 时 exit 2「未判定」并点名 FFMPEG_BIN —— 不冒红也不静默记绿。
 */

import { execFileSync } from 'node:child_process'
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

/** 小程序端主包受 2 MiB 硬限,单独编码 MP3;其余端保留 WAV(RN 原生 raw 依赖 wav 文件名)。 */
const MP3_OUTPUT_DIR = join(rootDir, 'apps/miniapp-taro/src/static/sounds')
const MP3_EXT = 'mp3'
/** 48kbps 单声道:16 kHz 合成提示音 Nyquist 8 kHz,码率足够且尺寸最小。 */
const MP3_ENCODE_ARGS = [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'wav',
  '-i',
  'pipe:0',
  '-codec:a',
  'libmp3lame',
  '-b:a',
  '48k',
  '-ac',
  '1',
  '-f',
  'mp3',
  'pipe:1',
]

/** WAV → MP3,纯 pipe 不落临时文件;编码确定性由 libmp3lame 保证(实测同输入 md5 一致)。 */
function encodeMp3(wavBuffer) {
  const ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg'
  try {
    return execFileSync(ffmpeg, MP3_ENCODE_ARGS, { input: wavBuffer, maxBuffer: 4 * 1024 * 1024 })
  } catch (e) {
    // ffmpeg 取不到 ⇒ 无法重算 mp3 预期尺寸:显式「未判定」(exit 2),不冒红也不静默记绿。
    if (e?.code === 'ENOENT' || e?.status !== 0) {
      console.error(
        `[ringtone] 未判定:无法执行 ffmpeg(${ffmpeg}) 重算 MP3 预期尺寸;请设 FFMPEG_BIN 指向 ffmpeg 可执行文件。`,
      )
      process.exit(2)
    }
    throw e
  }
}

// 16 kHz 而非 44.1 kHz:音符最高 1500 Hz、三次谐波 4500 Hz < Nyquist 8 kHz,
// 合成波形不会被裁掉;而 8 枚 WAV 从 334 KB 降到约 120 KB —— 小程序主包 2 MB
// 硬上限下这 210 KB 是能不能上架的分水岭(2026-11-26 实测 44.1 kHz 时 2186 KB 被微信拒收)。
const SAMPLE_RATE = 16_000
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
  const wavBuffer = renderWav(spec)
  for (const dir of TARGET_DIRS) {
    const isMp3 = dir === MP3_OUTPUT_DIR
    const buffer = isMp3 ? encodeMp3(wavBuffer) : wavBuffer
    const fileName = `ringtone-${spec.id}.${isMp3 ? MP3_EXT : 'wav'}`
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
