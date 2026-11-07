// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结果快照：把一次评测运行压成可提交、可比较的确定性文件。
 *
 * 只允许放确定性内容：无时间戳、无耗时、无绝对路径、无随机 ID。
 * 任何"这次跑出来的不一样"都必须来自被测代码行为变化，而不是机器/时钟差异。
 */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { stableStringify } from './replay.js'
import type { CaseResult, Comparison, EvalSnapshot } from './types.js'
import { BASELINE_PATH, COMPARISON_PATH, CURRENT_SNAPSHOT_PATH, FIXTURES_DIR } from './workspace.js'

/** 夹具（场景 JSON + 录制 JSON + 初始工作区文件）内容哈希：夹具一改，旧基线立即失效 */
export function computeFixtureHash(): string {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(abs)
      } else if (entry.isFile()) {
        files.push(abs)
      }
    }
  }
  walk(FIXTURES_DIR)
  const hash = createHash('sha256')
  for (const abs of files.sort()) {
    const rel = path.relative(FIXTURES_DIR, abs).split(path.sep).join('/')
    hash.update(`${rel}\u0000`)
    hash.update(fs.readFileSync(abs))
    hash.update('\u0000')
  }
  return hash.digest('hex')
}

export function buildSnapshot(cases: CaseResult[], commit: string): EvalSnapshot {
  const ids = new Set<string>()
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`用例 id 重复: ${item.id}`)
    ids.add(item.id)
  }
  const sorted = [...cases].sort((a, b) => a.id.localeCompare(b.id))
  return {
    schemaVersion: 1,
    fixtureHash: computeFixtureHash(),
    commit,
    cases: sorted,
  }
}

export function serializeSnapshot(snapshot: EvalSnapshot): string {
  return `${JSON.stringify(JSON.parse(stableStringify(snapshot)), null, 2)}\n`
}

export function writeCurrentSnapshot(snapshot: EvalSnapshot): void {
  fs.mkdirSync(path.dirname(CURRENT_SNAPSHOT_PATH), { recursive: true })
  fs.writeFileSync(CURRENT_SNAPSHOT_PATH, serializeSnapshot(snapshot), 'utf8')
}

export function writeBaseline(snapshot: EvalSnapshot): void {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
  fs.writeFileSync(BASELINE_PATH, serializeSnapshot(snapshot), 'utf8')
}

/** 比较结论落盘：run.mjs 读它把「口径变化」映射成退出码 2，不靠解析日志 */
export function writeComparison(comparison: Comparison, fixtureHashChanged: boolean): void {
  fs.mkdirSync(path.dirname(COMPARISON_PATH), { recursive: true })
  const payload = { fixtureHashChanged, status: comparison.status, cases: comparison.cases }
  fs.writeFileSync(COMPARISON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

export function readBaseline(): EvalSnapshot | null {
  if (!fs.existsSync(BASELINE_PATH)) return null
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as EvalSnapshot
}

export function readCurrentSnapshot(): EvalSnapshot | null {
  if (!fs.existsSync(CURRENT_SNAPSHOT_PATH)) return null
  return JSON.parse(fs.readFileSync(CURRENT_SNAPSHOT_PATH, 'utf8')) as EvalSnapshot
}

/** 用例证据指纹（参与"变了/没变"判定，但不参与"更好/更坏"判定） */
export function hashEvidence(value: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
