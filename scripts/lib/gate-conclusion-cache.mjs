// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门结论缓存（通用、单一实现）。
 *
 * 用途：把"**输入面逐字没变**"的门结论原样回放，省掉重复的整面扫描解析。
 * 这台机器上 40 道 blocking 门里绝大多数是"逐文件正则/几何分析"型（CPU 密集但纯函数），
 * 多 agent 并行开发时同一批文件会被反复全量重扫 —— 键对得上时那份结论一个字都不会变。
 *
 * 安全边界（本库只做这三件事，判据一概不碰）：
 * 1. **键必须覆盖判据自身**：键里除了被判内容，还要含判据脚本与它 import 的判定库的 blob sha。
 *    判据一改 ⇒ 键必变 ⇒ 绝不可能回放一条"按旧规矩得出的绿"。这一条是本库与"假绿"之间唯一的墙。
 * 2. **只回放完整结论，不回放摘要**：存的是门原本要打印的整段输出与退出码，回放时原样重印，
 *    包括违规明细与未判定清单 —— 少印一行就等于把那一行藏起来。
 * 3. **取不到/存不进/读坏了 ⇒ 一律实跑**（失效方向恒为"多跑一次"，不是"多放一次"）。§0.3/§0.10。
 *
 * 不进提交链、不判红、不写台账：本库不是判据，只是取材层的搬运工。
 * 落盘位置 `.ihui-agent/state/gate-conclusions/<name>.json`（仓外留痕目录，已被 .gitignore 覆盖）。
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 缓存 schema：结构一改就抬版本，旧件自然失效（不做迁移，宁可多跑）。 */
export const CONCLUSION_SCHEMA = 1

export const CACHE_SUBDIR = join('.ihui-agent', 'state', 'gate-conclusions')

/** 结论默认存活期：超过它的条目按"过期"处理（门的行为可能随环境漂移）。 */
export const CONCLUSION_TTL_MS = 30 * 60 * 1000

/**
 * 摘要一个"输入面"。
 * @param {Array<string|number|null|undefined>} parts 任意有序片段（路径、blob sha、判据指纹…）
 * @returns {string} 40 位十六进制（与 git blob sha 同长，便于日志里目视比对）
 */
export function digestOf(parts) {
  const h = createHash('sha256')
  // 分隔符必须逐片段追加（写在循环外会让 ['a','b'] 与 ['ab'] 撞成同一个键 ——
  // 拼接歧义在键上等于"两个不同的输入面共用一份结论"，正是假绿那一型）
  for (const p of parts) {
    h.update(String(p ?? ''))
    h.update('\u0000')
  }
  return h.digest('hex').slice(0, 40)
}

/** 缓存文件绝对路径。 */
export function conclusionPath(root, name) {
  return join(root, CACHE_SUBDIR, `${name}.json`)
}

/**
 * 读一条结论。任何异常/畸形/版本不符/超期 ⇒ 返回 null（调用方据此实跑）。
 * @returns {{key:string, exitCode:number, lines:string[], finishedAt:number, note?:string}|null}
 */
export function readConclusion(root, name, { nowMs = Date.now(), ttlMs = CONCLUSION_TTL_MS } = {}) {
  try {
    const p = conclusionPath(root, name)
    if (!existsSync(p)) return null
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    if (!raw || raw.schema !== CONCLUSION_SCHEMA) return null
    if (typeof raw.key !== 'string' || raw.key.length !== 40) return null
    if (!Array.isArray(raw.lines) || typeof raw.exitCode !== 'number') return null
    if (!Number.isFinite(Number(raw.finishedAt))) return null
    if (nowMs - Number(raw.finishedAt) > ttlMs) return null
    return {
      key: raw.key,
      exitCode: raw.exitCode,
      lines: raw.lines.map((l) => String(l)),
      finishedAt: Number(raw.finishedAt),
      note: typeof raw.note === 'string' ? raw.note : undefined,
    }
  } catch {
    return null
  }
}

/**
 * 写一条结论（原子写：临时件 + rename，避免读到半截 JSON）。
 * 写失败一律吞掉并返回 false —— 缓存不是判据，它坏了不许影响门的退出码。
 */
export function writeConclusion(root, name, { key, exitCode, lines, note, nowMs = Date.now() }) {
  try {
    const dir = join(root, CACHE_SUBDIR)
    mkdirSync(dir, { recursive: true })
    const p = conclusionPath(root, name)
    const tmp = `${p}.${process.pid}.tmp`
    const body = JSON.stringify({
      schema: CONCLUSION_SCHEMA,
      key,
      exitCode,
      lines: lines.map((l) => String(l)),
      finishedAt: nowMs,
      note,
    })
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, p)
    return true
  } catch {
    return false
  }
}

/**
 * 把 console.log 的每一行同时收进缓冲（原样仍打到 stdout，不改变实时性）。
 * @returns {{lines:string[], restore:()=>void}}
 */
export function captureStdout() {
  const lines = []
  const orig = console.log.bind(console)
  console.log = (...args) => {
    const s = args
      .map((a) => (typeof a === 'string' ? a : String(a)))
      .join(' ')
    lines.push(s)
    orig(s)
  }
  return {
    lines,
    restore: () => {
      console.log = orig
    },
  }
}

/** 人类可读的时长（回放行用）。 */
export function fmtAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} 分钟`
  return `${Math.round(m / 60)} 小时`
}

/**
 * 回放行文案：必须同时说清"复用的是哪一刻的结论"与"怎么作废"，
 * 否则读日志的人无从判断这份结论还作不作数（§0.3 未判定不得冒绿的同一条理由）。
 */
export function replayNote(entry, key, nowMs = Date.now()) {
  return (
    `♻️  复用 ${fmtAge(nowMs - entry.finishedAt)}前的结论(输入面未变,键 ${key.slice(0, 10)});` +
    `要强制重算:删 ${CACHE_SUBDIR} 下对应条目或设 IHUI_GATE_CONCLUSION_CACHE=0`
  )
}

/** 总开关（应急/取证用；默认开）。 */
export function cacheEnabled(env = process.env) {
  return String(env.IHUI_GATE_CONCLUSION_CACHE ?? '1') !== '0'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
