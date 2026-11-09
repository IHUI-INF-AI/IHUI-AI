#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * generated-output-check.mjs —— 生成物 `--check` 的唯一比对实现。
 *
 * 为什么需要它:
 *   四个 ui-routes 生成器历来只有一个「写」出口,想验证产物是否新鲜只能真写一遍,
 *   于是「检查」和「改文件」无法分开(mtime 变了、钉的时刻变了、工作树脏了)。
 *   本模块把「按当前输入应该长什么样」与「盘上现在长什么样」在**不落盘**的前提下比对,
 *   并给出可逐条解释的增删行清单。
 *
 * 幂等判据:
 *   - generatedAt 是唯一非确定性行(见 generated-input-pin.mjs 头注),比对前折成占位符;
 *   - sourceCommit 随 HEAD 变化,属于「何时生成」而非「按什么输入生成」,比对前同样折成占位符;
 *   - 水印行(含 payload 的横幅与注入的尾行)不是路由内容,整行折成 `// [watermark]`;
 *   - 其余字节逐字比对 —— 生成器代码本身改了也必须被这条判据抓住。
 *   因此同一载荷重复运行得到「新鲜」,与时钟、HEAD、水印注入次数无关。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { maskGeneratedAt, normalizeInputBytes, parsePin } from './generated-input-pin.mjs'
import { injectText } from '../watermark.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const SOURCE_COMMIT_RE = /^([ \t]*\/\/?[ \t]*sourceCommit:[ \t]*)(.*)$/

/**
 * 把「生成器吐出的裸内容」补成「落盘形态」:水印注入是写盘链路的一环(inject 幂等),
 * 比对时必须在内存里做同一变换,否则永远差横幅/尾行。web 产物自带横幅 → inject 为 skip-done。
 */
function applyWatermark(expected, outFile) {
  const rel = relative(repoRoot, outFile).replaceAll('\\', '/')
  return injectText(expected, { rel }).text
}

/**
 * 把非确定性行折成占位符(不做任何其它改写)。
 * @param {string} text
 * @returns {string}
 */
export function maskVolatile(text) {
  return maskGeneratedAt(normalizeInputBytes(text))
    .split('\n')
    .map((line) => {
      const m = SOURCE_COMMIT_RE.exec(line)
      if (m) return `${m[1]}<masked>`
      return line
    })
    .join('\n')
}

/** 行多重集统计(用于「增了哪些行、删了哪些行」的逐条解释) */
function lineCounts(text) {
  const counts = new Map()
  for (const line of maskVolatile(text).split('\n')) counts.set(line, (counts.get(line) || 0) + 1)
  return counts
}

/**
 * 行级增删清单(顺序不敏感,按多重集差额)。
 * @returns {{added:string[], removed:string[]}}
 */
export function diffLines(expected, actual) {
  const exp = lineCounts(expected)
  const act = lineCounts(actual)
  const added = []
  const removed = []
  for (const [line, n] of act) {
    const base = exp.get(line) || 0
    for (let i = base; i < n; i += 1) added.push(line)
  }
  for (const [line, n] of exp) {
    const base = act.get(line) || 0
    for (let i = base; i < n; i += 1) removed.push(line)
  }
  return { added, removed }
}

/**
 * 比对「按当前输入应生成的内容」与盘上产物。
 *
 * @param {{outFile:string, expected:string, label?:string}} opts
 * @returns {{
 *   ok:boolean,
 *   state:'missing'|'fresh'|'stale',
 *   label:string,
 *   outFile:string,
 *   pinFresh:boolean,
 *   expectedDigest:?string,
 *   actualDigest:?string,
 *   added:string[],
 *   removed:string[],
 * }}
 */
export function inspectGenerated({ outFile, expected, label = outFile }) {
  const actual = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null
  if (actual === null) {
    return {
      ok: false,
      state: 'missing',
      label,
      outFile,
      pinFresh: false,
      expectedDigest: parsePin(expected).digest,
      actualDigest: null,
      added: [],
      removed: [],
    }
  }

  const sameBytes = maskVolatile(applyWatermark(expected, outFile)) === maskVolatile(actual)
  const expectedPin = parsePin(expected)
  const actualPin = parsePin(actual)
  const pinFresh = Boolean(expectedPin.digest) && expectedPin.digest === actualPin.digest
  const { added, removed } = sameBytes ? { added: [], removed: [] } : diffLines(applyWatermark(expected, outFile), actual)

  return {
    ok: sameBytes,
    state: sameBytes ? 'fresh' : 'stale',
    label,
    outFile,
    pinFresh,
    expectedDigest: expectedPin.digest,
    actualDigest: actualPin.digest,
    added,
    removed,
  }
}

/**
 * 人类可读的一行结论 + 增删行摘要。
 * @param {ReturnType<typeof inspectGenerated>} verdict
 * @param {{maxLines?:number}} [opts]
 */
export function formatInspection(verdict, { maxLines = 8 } = {}) {
  const tag = verdict.ok ? '✅ 新鲜' : verdict.state === 'missing' ? '❌ 产物缺失' : '❌ 陈旧'
  const pinNote = verdict.pinFresh
    ? ''
    : ` —— 钉 ${verdict.actualDigest ?? '(无)'} ≠ 现算 ${verdict.expectedDigest ?? '(无)'}`
  const head = `${tag} ${verdict.label}${verdict.ok ? '' : pinNote}`
  if (verdict.ok) return head
  const lines = [head]
  if (verdict.added.length > 0) {
    lines.push(`   盘上多出 ${verdict.added.length} 行(现算内容里没有):`)
    for (const line of verdict.added.slice(0, maxLines)) lines.push(`     + ${line}`)
    if (verdict.added.length > maxLines) lines.push(`     … 其余 ${verdict.added.length - maxLines} 行`)
  }
  if (verdict.removed.length > 0) {
    lines.push(`   盘上缺少 ${verdict.removed.length} 行(现算内容要求有):`)
    for (const line of verdict.removed.slice(0, maxLines)) lines.push(`     - ${line}`)
    if (verdict.removed.length > maxLines) lines.push(`     … 其余 ${verdict.removed.length - maxLines} 行`)
  }
  return lines.join('\n')
}

export const __test__ = { maskVolatile, maskGeneratedAt, diffLines, inspectGenerated, formatInspection }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
