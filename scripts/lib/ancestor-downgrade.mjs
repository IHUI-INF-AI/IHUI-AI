// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/ancestor-downgrade.mjs —— 「旧 blob 回写」判据的单一实现(2026-11-03 立)。
 *
 * 为什么要有这一层:同一个病理今天有两处要用 ——
 *   ① 提交链守门 292(`check-staged-downgrade.mjs`):暂存 blob 逐字等于该路径某个祖先 blob,
 *      而 HEAD 已有更新版本 ⇒ 幻影回写,拦提交;
 *   ② 写盘器 `gen-ui-mirror.mjs`:派生结果若逐字等于祖先 blob ⇒ 拒绝写盘(写手根治)。
 * 两处各写一遍必漂移(§0.6/§22c),所以判定、取材、留痕解析全在这一层,调用方只喂面。
 *
 * 判据(整 blob 逐字比较,不掺行级推断):
 *   staged/candidate blob oid ∈ {HEAD 的历史提交里同路径的 blob} 且 ≠ HEAD 现读 blob
 *   ⇒ 内容比 HEAD 旧,是把旧检出档搬回来了。相等即命中,不做相似度。
 *
 * 与门 84(`check-stale-revert.mjs`)的分工:84 判"整 blob 等于**任意历史**、且行级混合体";
 * 本层只判"**更旧**且 HEAD 更新"这一格 —— 30c 只认 merge-base 之前的基线祖先,84 的 R1
 * 对近期祖先回写也只在行级报数,两者都漏"回退到父提交/近几枚提交旧档"这一型(实测:
 * 4 个组件被 guardian 的 ui-mirror 写盘腿按 RN 旧类名回写,30c/84-R1 均未拦成整 blob)。
 *
 * 取材纪律(门 118):本层**不读工作区**,只按调用方给的 root 跑只读 git;所有子进程经
 * `face-reader` 的 `gitRaw` / `catBatchOids`(stdio、timeout、batch 三件统一在层内)。
 */
import { createHash } from 'node:crypto'
import { catBatchOids, gitRaw } from './face-reader.mjs'

/** 祖先窗口:每路径回看多少枚"改过该路径"的提交。现读最深命中 = 19 枚前,80 留余量。 */
export const ANCESTOR_WINDOW_DEFAULT = 80

/** 合法回滚的唯一声明标记(提交正文,行首,大小写不敏感)。 */
export const REVERT_MARKER = 'intentional-revert'

/** 声明必须带依据:去空白后至少这么多字符,空口"有意回退"不算。 */
export const REVERT_MIN_RATIONALE = 8

/**
 * 文本 → git blob oid(与 `git hash-object <file>` 同一把尺:sha1("blob <len>\0"+bytes))。
 * 用于写盘前预判"这一份文本写下去会不会变成某枚祖先 blob",不落对象库、零副作用。
 */
export function gitBlobOidOfText(text) {
  const buf = Buffer.from(String(text ?? ''), 'utf8')
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
}

/**
 * 提交正文里的合法回滚声明。返回 { ok, rationale }:
 *   ok  ⇔ 存在行首 `intentional-revert:` 且依据去空白后 ≥ REVERT_MIN_RATIONALE。
 * 只认行首(注释前缀 `#` 之后不算 —— 那是模板说明,不是本次提交的声明)。
 */
export function intentionalRevertOf(message, { min = REVERT_MIN_RATIONALE } = {}) {
  const text = String(message ?? '')
  for (const raw of text.split(/\r?\n/)) {
    const m = new RegExp(`^\\s*${REVERT_MARKER}\\s*[:：]\\s*(.*)$`, 'i').exec(raw)
    if (!m) continue
    const rationale = m[1].trim()
    if (rationale.length >= min) return { ok: true, rationale }
  }
  return { ok: false, rationale: '' }
}

/** HEAD 上该路径的 blob oid;路径不存在/取不到 ⇒ { judged:false, why }(不冒充"没有")。 */
export function headBlobOf(rel, { root } = {}) {
  try {
    const out = String(gitRaw(['rev-parse', '--verify', `HEAD:${rel}`], root)).trim()
    if (!/^[0-9a-f]{40}$/i.test(out)) return { judged: false, oid: null, why: `HEAD:${rel} 取不到 oid` }
    return { judged: true, oid: out.toLowerCase(), why: null }
  } catch (e) {
    return { judged: false, oid: null, why: `HEAD:${rel} 取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/**
 * 该 blobOid 是不是 rel 在 HEAD 某个**祖先提交**里的原样?
 * 返回三态(§0.3,调用方不得把 judged:false 折成"没命中"):
 *   { judged:true, match:null, scanned:N }            —— 判过,不是祖先回写
 *   { judged:true, match:{commit,blobOid}, scanned:N } —— 命中(commit = 最近的命中祖先)
 *   { judged:false, why }                              —— 该跑没跑成
 */
export function ancestorBlobOf(rel, blobOid, { root, windowSize = ANCESTOR_WINDOW_DEFAULT } = {}) {
  const oid = String(blobOid ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(oid)) return { judged: false, why: `blob oid 非法:${blobOid}` }
  try {
    const head = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
    const list = String(
      gitRaw(['rev-list', `--max-count=${Number(windowSize) || ANCESTOR_WINDOW_DEFAULT}`, 'HEAD', '--', rel], root),
    )
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      // HEAD 自身不是祖先:HEAD 触及该路径时 rev-list 会把它排在首位,那一条要摘掉。
      .filter((c) => c !== head)
    if (list.length === 0) return { judged: true, match: null, scanned: 0 }
    const specs = list.map((c) => `${c}:${rel}`)
    const map = catBatchOids(root, specs)
    for (const c of list) {
      const got = map.get(`${c}:${rel}`)
      if (got && got.toLowerCase() === oid) {
        return { judged: true, match: { commit: c, blobOid: got.toLowerCase() }, scanned: list.length }
      }
    }
    return { judged: true, match: null, scanned: list.length }
  } catch (e) {
    return { judged: false, why: `祖先面取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/** 一处命中 → 一行可读点位(门与写盘器共用文案,不各写一份)。 */
export function describeMatch(rel, match) {
  const sha = String(match?.commit ?? '').slice(0, 10)
  return `${rel}(=祖先 ${sha})`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
