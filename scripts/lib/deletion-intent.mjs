// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 删除存续性判据的**同源常量与台账出口**(守门 check-merge-deletion-resurrection 的判据输入)。
//
// 为什么单独成文件,而不是住在门体里:AGENTS 票面明令「短语清单必须与判据同源(住在 scripts/lib/
// 里一份常量,测试引它)」。镜像测试若自己再抄一份 `intentional-delete:` 字面量,那么**改动短语
// 那一笔**会让门与测试同时变绿而语义已经分叉 —— 这正是本仓 §22c「镜像测试只复读实现就是复读机」
// 与守门 131/134「两处实现必漂移」记过最多次的那一型。
//
// 本文件**不派生 git、不读盘**:它只做纯判定(输入全部显式给出),所以每一条分支都能被构造面
// 证明,不必赌真仓此刻的历史形态(守门 103 T12 那一课:证明取材面这类行为只能用纯函数+构造面)。

/**
 * 「被裁决过的删除」在**删除提交的信息里**必须留下的显式短语。
 * 只有它成立,一枚合并把那行删除复活时才**只报数不判红**;它是一次可复核的证据,不是一张登记表
 * (证据住在提交对象里,每次现读,所以结构上不可能"登记一次永久免检")。
 */
export const INTENTIONAL_DELETE_MARKER = 'intentional-delete:'

/** 豁免台账(第二条例出口)在被审面上的路径。字段含义见该文件自己的 `$schemaNote`。 */
export const ALLOWLIST_FILE = 'scripts/data/deletion-survival-allowlist.json'

/** 台账每条必需的字段 —— 缺任一即"条目字段不齐",不得当空表用(守门 157 同形)。 */
export const ALLOWLIST_FIELDS = ['path', 'reason', 'reviewBy']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const REASON_MIN = 20

/**
 * 台账文本 → 条目。三态绝不并桶:
 *  - `absent`   —— 该面取不到这个文件(可能尚未落地)⇒ **按"零条目"判**并大声报出,只有坏 JSON 才算"无法判定";
 *  - `broken`   —— 文本存在但解不开/形状不对 ⇒ 交调用方判"无法判定"(exit 2),绝不静默当空表;
 *  - `entries`  —— 逐条已过形状的条目。
 * 形状检查刻意**不在这一步判红**:缺字段/过期要走 `entryDefect`,好让"红"的口径只有一处定义。
 */
export function parseAllowlist(text) {
  if (text === null || text === undefined) return { absent: true, broken: null, entries: [] }
  let j
  try {
    j = JSON.parse(text)
  } catch (e) {
    return { absent: false, broken: `台账 JSON 解不开:${e.message}`, entries: [] }
  }
  if (!j || typeof j !== 'object' || !Array.isArray(j.entries))
    return { absent: false, broken: '台账缺 entries 数组(形状漂了,不静默当空表用)', entries: [] }
  const entries = []
  for (const e of j.entries) {
    if (!e || typeof e !== 'object') continue
    entries.push({
      path: typeof e.path === 'string' ? e.path : null,
      reason: typeof e.reason === 'string' ? e.reason : null,
      reviewBy: typeof e.reviewBy === 'string' ? e.reviewBy : null,
    })
  }
  return { absent: false, broken: null, entries }
}

/**
 * 单条台账条目的**缺陷文本**(纯函数,构造面可证)。返回 null 表示条目可用。
 * 三种缺陷各自点名,不得合成一句"台账有问题" —— 处置动作不同:
 *  ① 缺字段/形状不对(要补条目),② 复核日过期(要续期或删除),③ path 为空串(等于没登记)。
 */
export function entryDefect(entry, today) {
  if (!entry) return '条目缺失'
  const missing = ALLOWLIST_FIELDS.filter((f) => entry[f] === null || entry[f] === undefined || entry[f] === '')
  if (missing.length) return `字段不齐(缺 ${missing.join('/')})`
  if (entry.reason.trim().length < REASON_MIN) return `理由未成句(${entry.reason.trim().length}<${REASON_MIN} 字)`
  if (!ISO_DATE.test(entry.reviewBy)) return `reviewBy 不是 ISO 日期:${entry.reviewBy}`
  if (entry.reviewBy < today) return `复核日已过期:${entry.reviewBy} < ${today}`
  return null
}

/**
 * 台账**腐烂**判据:条目所在的路径已不在当次复活面上。
 *
 * ⚠️ 定级为什么在提交链档**不判红**(`--strict` 才判红):豁免条目天然对应着"会被推走的合并"——
 * 一枚复活被裁之后进入 origin/main,它就永久退出提交链的窗口,于是这一维一旦恒判红,等于给
 * **之后每一次**与本改动无关的提交发一道红(AGENTS §12e/§12f:恒红门的唯一结局是逼人
 * `--no-verify`,连带废掉链上全部守门)。腐烂必须被**看见**,所以默认档照常报名字与条数,
 * 问责走 `--strict`;这不构成"登记一次永久免检",因为同一条目的**过期**在两个档都判红。
 */
export function rotEntries(entries, candidatePaths) {
  const seen = new Set(candidatePaths)
  return entries.filter((e) => e.path && !seen.has(e.path))
}

/** 删除提交信息里是否带显式裁决短语(逐字包含,不做模糊匹配 —— 放宽即失效)。 */
export function hasIntentionalMarker(message) {
  return typeof message === 'string' && message.includes(INTENTIONAL_DELETE_MARKER)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
