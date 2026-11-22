// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 逐行删除理由的**判据与取材**实现(P86 / 守门 84 的 R1s 档用它,单一真相源 §0.6)。
//
// 为什么单独成文件而不是住在门体里:
//  ① 门 84 的镜像形状锁(M-3)禁止门体自己 `readFileSync` —— 那一锁的立意是"被审正文一律走
//     face-reader,不许按磁盘读"(共享工作树常年滞后 HEAD,按盘读即换结论)。删除理由的两个面
//     (提交信息 / 理由台账)**不是被审正文**,它们要读的恰恰是"人为声明的理由",所以放在 lib、
//     并把"被审内容只走 face-reader"这条纪律原样留在门体(门体本文件里一个 readFileSync 都没有)。
//  ② 理由短语只能有一份:住 `lib/deletion-intent.mjs`(守门 168 / 逐字回潮对账同源)。本文件
//     import 它,门体 import 本文件 —— 任何一层再抄一份 `intentional-delete:` 字面量,改短语那
//     一刻就会出现"门绿而语义已分叉"(§22c)。
//  ③ 计行口径同样不在这里重写:行多重集差走 `stale-content-analysis.mjs` 的 `lineDeltaMaps`,
//     骨架行下限走它的 `RESURRECT_MIN_LINE_LEN`(那 12 是实测拐点,不是拍脑袋)。
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { INTENTIONAL_DELETE_MARKER, hasIntentionalMarker } from './deletion-intent.mjs'
import { RESURRECT_MIN_LINE_LEN } from './stale-content-analysis.mjs'

/** 删除理由台账(第二条例出口;第一条 = 提交信息里的 `intentional-delete:` 段)。 */
export const INTENTIONAL_DELETIONS_FILE = 'scripts/data/intentional-deletions.jsonl'
/** 台账理由最小字数(不读成句就不算理由;不与 deletion-intent 的 REASON_MIN 共用:语义不同)。 */
export const LEDGER_REASON_MIN = 10
/** 理由里认指纹的最小十六进制位数(8 位 = 32 bit,足以在本文件的行集合里唯一定位)。 */
export const FINGERPRINT_MIN_HEX = 8

/** 行 → sha256(理由里可引的稳定身份;台账/提交信息只贴摘要,不贴正文)。 */
export function lineFingerprint(line) {
  return createHash('sha256').update(String(line), 'utf8').digest('hex')
}

/** 删行指纹串(报告里给出可直接贴进提交信息/台账的形态,不让人自己去算 sha256)。 */
export function deletionReasonHint(line) {
  return `${lineFingerprint(line).slice(0, 12)}  ${String(line).trim().slice(0, 80)}`
}

/**
 * 台账文本 → 条目。三态与 `lib/deletion-intent.mjs` 同一条纪律:
 *  - `absent`    —— 面取不到该文件(本次改动之前仓里还没有它)⇒ 按零条目判并按"缺席"报出;
 *  - `broken`    —— 文本存在但行解不开/形状不对 ⇒ 交调用方落 exit 2,绝不静默当空表;
 *  - `entries`   —— 已过形状的条目;`defective` 是被拒的条目(逐条点名,**不得当理由用**)。
 * 说明行以 `//` 开头(与 `scripts/data/exposed-credentials.jsonl` 同形),逐行跳过。
 */
export function parseDeletionLedger(text) {
  const out = { absent: false, broken: null, entries: [], defective: [] }
  if (text === null || text === undefined) return { ...out, absent: true }
  const lines = String(text).split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim() || raw.trimStart().startsWith('//')) continue
    let j
    try {
      j = JSON.parse(raw)
    } catch (e) {
      return { ...out, broken: `台账第 ${i + 1} 行 JSON 解不开:${e.message}` }
    }
    if (!j || typeof j !== 'object' || Array.isArray(j))
      return { ...out, broken: `台账第 ${i + 1} 行不是对象(形状漂了,不静默当空表用)` }
    const entry = {
      line: i + 1,
      sha256: typeof j.sha256 === 'string' ? j.sha256.trim().toLowerCase() : null,
      path: typeof j.path === 'string' && j.path.trim() ? j.path.replace(/\\/g, '/') : null,
      reason: typeof j.reason === 'string' ? j.reason.trim() : null,
      until: typeof j.until === 'string' ? j.until.trim() : null,
    }
    const why =
      !entry.sha256 || !/^[0-9a-f]{8,64}$/.test(entry.sha256)
        ? 'sha256 缺失或不是 8~64 位十六进制'
        : !entry.reason || entry.reason.length < LEDGER_REASON_MIN
          ? `reason 缺失或未成句(<${LEDGER_REASON_MIN} 字)`
          : entry.until && !/^\d{4}-\d{2}-\d{2}$/.test(entry.until)
            ? `until 不是 ISO 日期:${entry.until}`
            : null
    // 形状坏的条目**不当理由**(放宽必须是有据的),但必须被看见 —— 与"登记一次永久免检"是两件事。
    if (why) out.defective.push({ ...entry, why })
    else out.entries.push(entry)
  }
  return out
}

/**
 * 提交信息 → `intentional-delete:` 之后的理由段(取第一处出现之后的全文)。
 * `available=false` 表示**信息面根本没取到**(pre-commit 阶段 git 尚未写出提交信息,结构事实);
 * 调用方必须把它报成"信息面取不到",不得读成"给了理由"。
 */
export function messageReasonSection(message) {
  if (typeof message !== 'string' || !message.trim()) return { available: false, section: null }
  if (!hasIntentionalMarker(message)) return { available: true, section: null }
  const at = message.indexOf(INTENTIONAL_DELETE_MARKER)
  return { available: true, section: message.slice(at + INTENTIONAL_DELETE_MARKER.length) }
}

/**
 * 这一行"丢掉"有理由吗?返回 `'message-fp' | 'message-text' | 'ledger' | null`(null = 无理由)。
 * 只认三类**可复核**证据:指纹前缀、原文逐字、台账指纹前缀 —— 不做模糊/相似度匹配
 * (一次"差不多"的匹配就把这行变成永久免检)。台账条目过期不算理由(与门 168 同一条到期语义),
 * 过期命中记进 `ctx.expired`,让"登记了但过期"在报告里也看得见。
 */
export function deletionLineReason(line, ctx) {
  const fp = lineFingerprint(line)
  const section = ctx?.section ?? null
  const trimmed = String(line).trim()
  if (section) {
    const lower = section.toLowerCase()
    if (lower.includes(fp.slice(0, 12)) || lower.includes(fp.slice(0, FINGERPRINT_MIN_HEX)))
      return 'message-fp'
    if (trimmed.length >= RESURRECT_MIN_LINE_LEN && section.includes(trimmed)) return 'message-text'
  }
  for (const e of ctx?.ledger?.entries ?? []) {
    if (e.path && e.path !== ctx.path) continue
    if (!fp.startsWith(e.sha256)) continue
    if (e.until && e.until < ctx.today) {
      ctx.expired?.push({ path: ctx.path, prefix: e.sha256.slice(0, 12), until: e.until })
      continue
    }
    return 'ledger'
  }
  return null
}

/** 读一个文本文件;不存在/读失败返回 null(调用方按"面缺席"处理,不猜内容)。 */
export function readTextFileIfExists(absPath) {
  try {
    if (!existsSync(absPath)) return null
    return readFileSync(absPath, 'utf8')
  } catch {
    return null
  }
}

/**
 * 理由台账在被审仓根下的读取。台账是**人写的理由面**,不是被审正文 —— 所以按仓根路径读,
 * 不套"索引面/HEAD 面"那套纪律;被审正文一律仍走 face-reader(门体那一锁不动)。
 */
export function readDeletionLedger(repoRoot) {
  return parseDeletionLedger(readTextFileIfExists(join(repoRoot, INTENTIONAL_DELETIONS_FILE)))
}

export const __test__ = {
  INTENTIONAL_DELETIONS_FILE,
  LEDGER_REASON_MIN,
  FINGERPRINT_MIN_HEX,
  lineFingerprint,
  deletionReasonHint,
  parseDeletionLedger,
  messageReasonSection,
  deletionLineReason,
  readDeletionLedger,
  readTextFileIfExists,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
