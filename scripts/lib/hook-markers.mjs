// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `hook-markers.jsonl` 的汇总读取器(第三笔:轮转 + 并发安全)。
 *
 * 写入侧见 `scripts/lib/hook-marker.sh`:低层 sh 证据走 mkdir 锁串行追加,
 * 超过阈值时按代轮转(`.jsonl.1` → `.jsonl.2` …),**任何一代都不删除**;
 * 抢不到锁时落到 `hook-markers.d/` 的每进程分片。
 *
 * 本读取器的顺序(旧 → 新):
 *   ① `hook-markers.jsonl.N`(N 越大越旧)→ … → `hook-markers.jsonl.1`;
 *   ② 活跃文件 `hook-markers.jsonl`;
 *   ③ 分片 `hook-markers.d/*.jsonl`,按文件名(定宽时间戳前缀)升序。
 * 分片只在锁超时/追加失败时出现,必然晚于当时已落盘的行,故排在活跃文件之后。
 *
 * 坏行**不静默丢弃**:解析失败的原始行连同文件/行号进 `malformed`,由调用方显式处置。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const HOOK_MARKERS_REL = join('.ihui-agent', 'state', 'hook-logs')

export function hookMarkerDir(root) {
  return resolve(root, HOOK_MARKERS_REL)
}

/** 轮转代 + 活跃文件 + 分片,旧 → 新。 */
export function listHookMarkerFiles(root) {
  const dir = hookMarkerDir(root)
  if (!existsSync(dir)) return { ok: false, state: 'missing', files: [], why: `${dir} 不存在` }
  const files = []
  try {
    const gens = []
    for (const name of readdirSync(dir)) {
      const m = /^hook-markers\.jsonl\.(\d+)$/.exec(name)
      if (m) gens.push({ n: Number(m[1]), path: join(dir, name) })
    }
    gens.sort((a, b) => b.n - a.n) // 大 = 旧
    for (const g of gens) files.push({ path: g.path, source: 'rotated', gen: g.n })
    const active = join(dir, 'hook-markers.jsonl')
    if (existsSync(active)) files.push({ path: active, source: 'active', gen: 0 })
    const shardDir = join(dir, 'hook-markers.d')
    if (existsSync(shardDir)) {
      const shards = readdirSync(shardDir)
        .filter((f) => f.endsWith('.jsonl'))
        .sort()
        .map((f) => ({ path: join(shardDir, f), source: 'shard', gen: null }))
      files.push(...shards)
    }
  } catch (e) {
    return { ok: false, state: 'unreadable', files: [], why: String(e?.message ?? e).slice(0, 160) }
  }
  return { ok: true, state: files.length ? 'read' : 'empty', files, why: '' }
}

/**
 * 解析全部标记行。坏行不被吞:每一条都出现在 `malformed` 里(带 file/lineNo/raw),
 * 且 `ok=false` 并不代表"没有记录"——records 仍然照常返回。
 */
export function readHookMarkers(root) {
  const listed = listHookMarkerFiles(root)
  if (!listed.ok) {
    return { ok: false, state: listed.state, why: listed.why, records: [], malformed: [], files: [] }
  }
  const records = []
  const malformed = []
  for (const f of listed.files) {
    let text
    try {
      text = readFileSync(f.path, 'utf8')
    } catch (e) {
      malformed.push({ file: f.path, lineNo: 0, raw: '', why: String(e?.message ?? e).slice(0, 160) })
      continue
    }
    const lines = text.split(/\r?\n/)
    lines.forEach((raw, i) => {
      if (raw.trim() === '') return
      try {
        records.push({ ...JSON.parse(raw), _file: f.path, _source: f.source })
      } catch (e) {
        malformed.push({
          file: f.path,
          lineNo: i + 1,
          raw: raw.slice(0, 240),
          why: String(e?.message ?? e).slice(0, 120),
        })
      }
    })
  }
  return {
    ok: malformed.length === 0,
    state: listed.state,
    why: malformed.length ? `${malformed.length} 条坏行(未丢弃,见 malformed)` : '',
    records,
    malformed,
    files: listed.files,
  }
}
