#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 水印覆盖面的「对外分发安装脚本」豁免判据 —— 唯一实现(§0.6:同类判据只许有一份)。
 *
 * 立因(2026-11-18 实测,不是假想):本机杀软(火绒)把 `install.ps1` 判为
 * `HEUR:TrojanDownloader/PS.NetLoader.av` 并隔离,而 `heal-worktree-tracked` 把杀软隔离读成
 * 「外部误删」,每 5 分钟 `git restore` 回盘一次,随即再被隔离 —— 形成「杀软秒删 ↔ 自愈回盘」
 * 的死循环,用户每次全盘扫描都看得见这枚"病毒"。
 *
 * 触发点逐段取证(同目录三份探针,写入即观察):P0 原文(含零宽载荷)落盘即被锁;
 * P1 = 只去零宽、保留 `Invoke-Expression` ⇒ 存活;P2 = 再去 `Invoke-Expression` ⇒ 存活。
 * 结论:触发点是三层水印的**不可见载荷**(大量 U+200B/U+200C/U+200D/U+FEFF),不是下载逻辑。
 * 对面向终端用户分发的安装脚本,这个代价是用户装不上 CLI —— 溯源价值远低于可用性。
 *
 * 免的是「这一族 .ps1 的载荷」这一项,**不免前提**(验过才免,任一不成立就回到覆盖面照旧判):
 *   1) 路径必须**逐字**等于台账登记的 path(这一档不做前缀糊配,免得一次登记放过一个目录);
 *   2) 被审面正文必须仍命中 anchorRegex —— 证明这枚文件真还是那份安装脚本,防"同路径被换成
 *      别的内容而豁免照旧生效";
 *   3) 每条带 expires,到期即整条失效并对人报名(§0.7 豁免族必须登记存活期);
 *   4) 台账形状不合法 ⇒ 抛 DistScriptLedgerUnavailable,由调用方折成「未判定」,
 *      **既不冒绿也不冒红** —— 算不出前提时继续判,就是把没量到写成量到了(§0.3)。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const LEDGER_REL = 'scripts/data/watermark-dist-scripts.json'

export class DistScriptLedgerUnavailable extends Error {}

/**
 * 读台账并校形状。文件不在 ⇒ 空数组(该档不存在 = 没有豁免,覆盖面照旧全量判,
 * 这是安全的默认,不是"跳过判定")。
 */
export function loadDistScriptEntries(repoRoot) {
  const abs = path.join(repoRoot, LEDGER_REL)
  if (!existsSync(abs)) return []
  let raw
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new DistScriptLedgerUnavailable(`${LEDGER_REL} 解析失败:${e.message}`)
  }
  const entries = raw?.entries
  if (!Array.isArray(entries)) {
    throw new DistScriptLedgerUnavailable(`${LEDGER_REL} 缺 entries 数组(形状不合法 ⇒ 不猜)`)
  }
  const problems = []
  const ok = []
  for (const [i, e] of entries.entries()) {
    const where = `${LEDGER_REL}#entries[${i}]${e?.id ? `(${e.id})` : ''}`
    if (typeof e?.id !== 'string' || !e.id) problems.push(`${where}:id 必须是非空字符串`)
    if (typeof e?.path !== 'string' || !e.path || e.path.endsWith('/'))
      problems.push(
        `${where}:path 必须是精确文件路径(不以 / 收尾) —— 这一档逐字判等,不做前缀糊配`,
      )
    if (typeof e?.anchorRegex !== 'string' || !e.anchorRegex)
      problems.push(
        `${where}:anchorRegex 必须是非空字符串 —— 「验过才免」的那一验没有尺就等于整条豁免无人看守`,
      )
    else {
      try {
        new RegExp(e.anchorRegex, 'm')
      } catch (err) {
        problems.push(`${where}:anchorRegex 编译不过:${err.message}`)
        continue
      }
    }
    if (typeof e?.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires))
      problems.push(`${where}:expires 必须写成 YYYY-MM-DD(§0.7:豁免会到期)`)
    if (!Array.isArray(e?.evidence) || e.evidence.length === 0)
      problems.push(`${where}:evidence 至少一条(能在被审面核验的内容锚点:文件 + 须含文本)`)
    if (typeof e?.reason !== 'string' || e.reason.trim().length < 12)
      problems.push(`${where}:reason 必须写清"为什么免"与"免到什么程度"`)
    ok.push(e)
  }
  if (problems.length > 0) {
    throw new DistScriptLedgerUnavailable(
      `${LEDGER_REL} 形状不合法 ${problems.length} 处:\n  - ${problems.join('\n  - ')}`,
    )
  }
  return ok
}

/**
 * 判定单份文件是否落在「对外分发安装脚本」豁免内。
 *
 * @param {{rel:string, text:string|null, entries:Array, today?:string}} p
 *   text = **被审面上**的正文(HEAD blob / 索引 blob —— 与调用方判载荷用的是同一面同一轮);
 *   取不到正文 ⇒ 一律不豁免(算不出前提就不免,方向永远倒向严的一侧)。
 * @returns {{exempt:boolean, why:string|null, entryId:string|null, state:'exempt'|'premise-missing'|'expired'|'not-registered'|'no-content'}}
 */
export function judgeDistScript({ rel, text, entries, today }) {
  const norm = String(rel ?? '')
    .split(path.sep)
    .join('/')
  const hit = (entries ?? []).find((e) => norm === e.path)
  if (!hit) return { exempt: false, why: null, entryId: null, state: 'not-registered' }
  const day =
    typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
      ? today
      : new Date().toISOString().slice(0, 10)
  if (day > hit.expires)
    return {
      exempt: false,
      why: `豁免已到期未清:${hit.id} 登记 expires=${hit.expires},现读 ${day}(§0.7)`,
      entryId: hit.id,
      state: 'expired',
    }
  if (typeof text !== 'string')
    return {
      exempt: false,
      why: `登记为分发脚本(${hit.id})但被审面取不到正文 ⇒ 前提无法核验,不豁免`,
      entryId: hit.id,
      state: 'no-content',
    }
  const re = new RegExp(hit.anchorRegex, 'm')
  if (!re.test(text))
    return {
      exempt: false,
      why: `登记为分发脚本(${hit.id}),但该面正文不再命中锚点 ${JSON.stringify(hit.anchorRegex)} ⇒ 前提已失效,回到覆盖面按缺载荷判`,
      entryId: hit.id,
      state: 'premise-missing',
    }
  return { exempt: true, why: null, entryId: hit.id, state: 'exempt' }
}

export const __test__ = {
  LEDGER_REL,
  loadDistScriptEntries,
  judgeDistScript,
  DistScriptLedgerUnavailable,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
