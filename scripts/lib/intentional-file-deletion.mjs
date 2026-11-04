// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * intentional-file-deletion.mjs —— **整文件有意删除**的通知书通道(单一真相源)。
 *
 * ## 存在理由(2026-11-04 实测事故)
 *
 * `scripts/heal-worktree-tracked.mjs` 的 `findOrphanedDeletions()` 把「工作树缺 ∧ 索引 blob
 * == HEAD blob ∧ HEAD 有该路径」三条同时成立的文件判为"被外部删除",然后
 * `git restore --source=HEAD --worktree` 无条件复活它。那三条判据在下面两种成因上**同形**:
 *
 *   ① 会话有意 `rm` 掉一个 tracked 文件(尚未 `git rm`,索引仍记着它);
 *   ② 宿主清理层批量误删。
 *
 * 2026-11-04 的实测后果:一次 24 件的「零运行时 import 孤儿副本」清理,删除动作每轮被
 * 复活;只能靠对象空间提交(`commit-tree` 直推)绕过工作树才落地。同类事故 2026-09-24
 * 已发生过一次(`heal-worktree-tracked.mjs:430` 注释:"差点咬掉并发会话正在收口的 4 个
 * 分类栏文件"),当时的解法是给**漂移**层加 mtime 窗口 —— 而"文件已被删"这一型结构上
 * 够不到窗口判据(stat 抛 ENOENT,没有 mtime 可读)。
 *
 * ## 本通道的语义:证据,不是登记表
 *
 * 通知书带 `reason`(≥10 字,逼人写清为什么删)与 `until`(ISO 日期,到期自动失效)。
 * 它不是"登记一次永久免检":到期即失效,失效后 healer 恢复照旧 —— 忘删的通知书不会
 * 永久保护一只真被宿主干掉的目录。
 *
 * ## 三态纪律(与 `lib/deletion-intent.mjs` / `lib/intentional-deletions.mjs` 同源)
 *
 *   - `absent`   —— 面取不到该文件 ⇒ 按零条目判,并按"缺席"报出(不静默当空表);
 *   - `broken`   —— 文本存在但行解不开/形状不对 ⇒ 交调用方落 exit 2,**绝不放行恢复**;
 *   - `entries`  —— 已过形状的条目;`defective` 是被拒的条目(逐条点名,不当通知书用)。
 *
 * 失效方向恒为"多要一次定向说明",不是"多放一次恢复"(AGENTS §0.10)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 通知书台账(入版本库:换机/换克隆后同一路径的删除仍有证据)。 */
export const INTENTIONAL_FILE_DELETION_FILE = 'scripts/data/intentional-file-deletions.jsonl'
/** 理由最小字数(不读成句就不算理由;与 deletion-intent 的 REASON_MIN 同量级但独立常数)。 */
export const NOTICE_REASON_MIN = 10

/** 路径归一:反斜杠转正斜杠、去前导 `./`、折叠重复斜杠。 */
export function normalizeNoticePath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .trim()
}

/**
 * 台账文本 → 条目。三态见文件头注。
 * 条目形状:`{ line, path, reason, until }`;`defective` 里每条带 `why`。
 */
export function parseFileDeletionNotices(text) {
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
      return { ...out, broken: `通知书第 ${i + 1} 行 JSON 解不开:${e.message}` }
    }
    if (!j || typeof j !== 'object' || Array.isArray(j))
      return { ...out, broken: `通知书第 ${i + 1} 行不是对象(形状漂了,不静默当空表用)` }
    const entry = {
      line: i + 1,
      path: normalizeNoticePath(j.path),
      reason: typeof j.reason === 'string' ? j.reason.trim() : null,
      until: typeof j.until === 'string' ? j.until.trim() : null,
    }
    const why = !entry.path
      ? 'path 缺失'
      : !entry.reason || entry.reason.length < NOTICE_REASON_MIN
        ? `reason 缺失或未成句(<${NOTICE_REASON_MIN} 字)`
        : entry.until && !/^\d{4}-\d{2}-\d{2}$/.test(entry.until)
          ? `until 不是 ISO 日期:${entry.until}`
          : null
    if (why) out.defective.push({ ...entry, why })
    else out.entries.push(entry)
  }
  return out
}

/** 读仓根下的通知书台账;文件不存在返回 `absent`(不猜内容)。 */
export function readFileDeletionNotices(repoRoot) {
  try {
    const abs = join(repoRoot, INTENTIONAL_FILE_DELETION_FILE)
    if (!existsSync(abs)) return parseFileDeletionNotices(null)
    return parseFileDeletionNotices(readFileSync(abs, 'utf8'))
  } catch {
    return parseFileDeletionNotices(null)
  }
}

/** 今天的 ISO 日期(`YYYY-MM-DD`),时区取本地 —— 与台账 `until` 同口径。 */
export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 建索引:归一化路径 → 最近一条有效通知书;**已过期的单独成集**。
 * 同一路径多条时取 `until` 最晚的那条(续期语义),无 `until` 视为长期有效。
 * 已过期的不进 `active`,但进 `expired` 供调用方点名 —— 过期不是"没登记过",是"登记失效了"。
 */
export function buildNoticeIndex(notices, today = todayIso()) {
  const active = new Map()
  const expired = new Map()
  for (const e of notices?.entries ?? []) {
    const p = normalizeNoticePath(e.path)
    if (!p) continue
    if (e.until && e.until < today) {
      expired.set(p, e)
      continue
    }
    const prev = active.get(p)
    if (!prev) active.set(p, e)
    else if (!prev.until) continue
    else if (!e.until || e.until > prev.until) active.set(p, e)
  }
  return { active, expired }
}

/**
 * 便捷判据:`path` 是否持有一张有效通知书。
 * 取不到/坏档 ⇒ `{ declared: false, verdict: 'undetermined', why }` ——
 * **调用方不得把 `undetermined` 读成"没声明"**(§0.3),healer 应据此**只报数不恢复**。
 */
export function isDeletionDeclared(notices, path, today = todayIso()) {
  if (notices?.broken) return { declared: false, verdict: 'undetermined', why: notices.broken }
  if (notices?.absent)
    return { declared: false, verdict: 'absent-ledger', why: '通知书台账不存在' }
  const p = normalizeNoticePath(path)
  const { active, expired } = buildNoticeIndex(notices, today)
  if (active.has(p)) return { declared: true, verdict: 'declared', entry: active.get(p) }
  if (expired.has(p))
    return { declared: false, verdict: 'expired', entry: expired.get(p), why: '通知书已过期' }
  return { declared: false, verdict: 'not-declared' }
}

export const __test__ = {
  INTENTIONAL_FILE_DELETION_FILE,
  NOTICE_REASON_MIN,
  normalizeNoticePath,
  parseFileDeletionNotices,
  readFileDeletionNotices,
  todayIso,
  buildNoticeIndex,
  isDeletionDeclared,
}
