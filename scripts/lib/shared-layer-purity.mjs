// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * shared-layer-purity.mjs —— S3「共享层平台纯度」判据单源(2026-11-06)。
 *
 * 为什么单独成库:门体 check-shared-layer-duplication.mjs 有一条既有形状锁
 * (scripts/tests/check-shared-layer-duplication.test.mjs:198)禁止门内出现 readFileSync ——
 * 取材必须走 face-reader/face-scan 的同一被审面,不得退回磁盘。台账读写属于**判据数据**,
 * 放库里由门体 import,既守住形状锁,也让 S3 的纯判定可被单测直接调用(§22c 零复算)。
 *
 * 口径:共享层(features/components)不得出现平台专属写法 —— 裸 rpx 字面量、内联 var(--)、
 * hoverClass、className 直接落盘。平台专属资产(仅一端消费)可保留,但必须在台账登记
 * consumption 证据(file:line)+ owner + expires + why;既不许硬改成"看起来纯",也不许
 * 以"共享层就该纯"为由删掉唯一消费端的唯一实现。
 *
 * 扫描面写死(2026-11-06,裁定:以本分析器口径为准):
 *   目录 = `packages/app/src/features/` + `packages/app/src/components/`(PURITY_ROOTS,不再扩缩);
 *   文件 = 上述两目录下 `.ts/.tsx`(排除 `*.test.*`),现读 358 个;命中 14 个(存量棘轮)。
 *   四信号 = [`rpx`: /[-0-9.]rpx/g]、[`cssVar`: /var\\(--/g]、[`hoverClass`: /\\bhoverClass\\b/g]、
 *            [`className`: /\\bclassName=/g];逐信号按文件计数,只降不升。
 * 与体检报告口径的差异**源于覆盖面,不是判据松紧**:体检只扫 features/ 得 1 个违规文件
 * (ChatMessageItem.tsx,且只被小程序消费);本实现扫 features+components 得 14 个存量文件,
 * 多出的 13 个是 components/ 下的历史存量,均已逐文件登记棘轮,不因此放松任何判据。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PURITY_ROOTS = ['packages/app/src/features/', 'packages/app/src/components/']
export const PURITY_LEDGER_REL = 'scripts/data/shared-layer-platform-purity.jsonl'
export const PURITY_SIGNALS = [
  ['rpx', /[-0-9.]rpx/g],
  ['cssVar', /var\(--/g],
  ['hoverClass', /\bhoverClass\b/g],
  ['className', /\bclassName=/g],
]

/** 逐文件四信号计数(空文本 ⇒ 全 0;不在这里判红) */
export function platformPurityCounts(text) {
  const out = {}
  for (const [name, re] of PURITY_SIGNALS) out[name] = text ? (text.match(re) || []).length : 0
  return out
}

/** 首个命中行(evidence 必须是可点开的 file:line,不是"整个文件") */
export function firstSignalLine(text) {
  const lines = (text || '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const [, re] of PURITY_SIGNALS) {
      re.lastIndex = 0
      if (re.test(lines[i])) return i + 1
    }
  }
  return 1
}

export function readPurityLedger(root) {
  const abs = join(root, PURITY_LEDGER_REL)
  let raw
  try {
    raw = readFileSync(abs, 'utf8')
  } catch (e) {
    return { ok: false, ledger: null, why: `台账读不出:${String(e?.message ?? e).slice(0, 120)}` }
  }
  const ledger = {}
  for (const [i, line] of raw.split('\n').entries()) {
    const t = line.trim()
    if (!t) continue
    try {
      const row = JSON.parse(t)
      if (!row.file) throw new Error('缺 file')
      ledger[row.file] = row
    } catch (e) {
      return { ok: false, ledger: null, why: `${PURITY_LEDGER_REL}:${i + 1} 解析失败(${e?.message ?? e})` }
    }
  }
  return { ok: true, ledger }
}

export function writePurityLedger(root, rows) {
  const abs = join(root, PURITY_LEDGER_REL)
  writeFileSync(abs, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  return existsSync(abs)
}

/**
 * @returns {{state:'ok'|'violated', violations:object[], rot:object[]}}
 * 台账到期/缺条/任一信号比台账多 ⇒ violated;台账里已清零的条目不判红(记为可回收)。
 */
export function judgePlatformPurity({ countsByFile, ledger, today = new Date().toISOString().slice(0, 10) }) {
  const violations = []
  const rot = []
  const hitFiles = Object.entries(countsByFile).filter(([, c]) => Object.values(c).some((n) => n > 0))
  for (const [file, counts] of hitFiles) {
    const row = ledger[file]
    if (!row) {
      violations.push({ file, type: 'unregistered', counts })
      continue
    }
    if (typeof row.expires !== 'string' || row.expires < today) {
      violations.push({ file, type: 'expired', expires: row.expires ?? null })
      continue
    }
    for (const [name] of PURITY_SIGNALS) {
      const base = Number(row.counts?.[name] ?? 0)
      const now = Number(counts[name] ?? 0)
      if (now > base) violations.push({ file, type: 'increase', signal: name, base, now })
    }
  }
  for (const [file, row] of Object.entries(ledger)) {
    if (!hitFiles.some(([f]) => f === file)) rot.push({ file, kind: row.kind ?? 'unknown' })
  }
  return { state: violations.length > 0 ? 'violated' : 'ok', violations, rot }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
