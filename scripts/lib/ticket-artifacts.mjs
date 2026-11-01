// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ticket-artifacts — 「会话后落账腿」的判据(2026-11-01 立)。
 *
 * 立因:派发票原先要求会话自己走 safe-commit 五步法并绑票键提交,而会话侧
 * apps/cli/src/tools/permissions.ts 对 `dangerLevel === 'dangerous'` 一律不放宽(租约放宽
 * 结构上放不了),git_commit / run_command 都是 dangerous 档 ⇒ 自治会话能改文件、能跑验证,
 * 但结构上永远提交不了,干完活落不了账。
 *
 * 正解不是给会话放权,而是调度器在会话结束后代它落账。但「代提交」必须只认会话自己写的清单:
 * 不看清单直接 `git add -A`,就会把这个工作区里别人(或上一轮)的改动一起打包 —— 那正是
 * safe-commit 五步法要防的污染事故。所以清单是唯一输入,且四档 fail-closed:
 * 缺失 / 坏 / 全部无改动 / 有改动可提交;判不出来一律不提交(§0.3:没判绝不写成判过)。
 *
 * 本文件只放纯判据(无 IO、无进程);读盘、起 safe-commit、记台账都留在 scripts/auto-evolve.mjs。
 * 判据只许有一份:调度器与自检都 import 这里,不得在别处再拼第二份(§0.6)。
 */

/** 清单目录(相对仓根)。会话写、调度器读,两侧同一个常量。 */
export const MANIFEST_DIR = '.ihui-agent/state/ticket-artifacts'

/** 票键 → 清单相对路径。票键是 16 位十六进制指纹,不含分隔符,拼进路径不会越界。 */
export function manifestPathOf(ticketKey) {
  return `${MANIFEST_DIR}/${String(ticketKey ?? '')}.json`
}

/**
 * 清单解析 + 形状校验。
 *
 * 返回值刻意不用布尔:`missing` 与 `invalid` 是两档不同的事故(前者=会话没写清单,后者=写了但
 * 不可信),并桶会让台账读不出该找谁。`text === null/undefined` 约定为「文件不存在」。
 */
export function parseArtifactManifest(text, ticketKey) {
  if (text === null || text === undefined || String(text).trim() === '') {
    return { state: 'missing', files: [], why: `会话未写产物清单(${manifestPathOf(ticketKey)})⇒ 本轮不提交` }
  }
  let doc
  try {
    doc = JSON.parse(String(text))
  } catch (e) {
    return { state: 'invalid', files: [], why: `清单不是合法 JSON:${e?.message ?? e}` }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { state: 'invalid', files: [], why: '清单顶层必须是对象' }
  }
  const got = String(doc.ticketKey ?? '')
  const want = String(ticketKey ?? '')
  if (got !== want) {
    // 票键不符 = 这份清单可能是上一轮/另一张票留下的:按它提交就是把别人的活记到这张票头上。
    return { state: 'invalid', files: [], why: `清单票键不匹配(清单 ${JSON.stringify(got)} ≠ 本轮 ${JSON.stringify(want)})` }
  }
  if (!Array.isArray(doc.files)) {
    return { state: 'invalid', files: [], why: 'files 必须是数组' }
  }
  if (doc.files.length === 0) {
    // 空清单与「没写清单」在处置上等价(都不提交),但语义不同:写了空清单是会话在声明"我没改文件",
    // 这条要单独记 invalid,否则台账分不清"忘了写"和"写了但没改"。
    return { state: 'invalid', files: [], why: 'files 是空数组(没改文件就不该写清单)' }
  }
  const files = []
  for (const f of doc.files) {
    if (typeof f !== 'string' || f.trim() === '') {
      return { state: 'invalid', files: [], why: `files 出现非字符串/空白项:${JSON.stringify(f)}` }
    }
    const one = f.trim()
    if (!files.includes(one)) files.push(one)
  }
  return { state: 'ok', files, note: typeof doc.note === 'string' ? doc.note : '', why: '' }
}

/** 敏感目录段(仅对 `.ihui-agent/` 之外的路径生效:那是调度器自己的状态面,允许被清单点到)。 */
const SENSITIVE_SEGMENTS = new Set(['.git', '.github', '.husky', 'node_modules'])
/** 敏感文件名形态:凭据与密钥一律不由自动会话代提交。 */
const SENSITIVE_BASENAMES = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /^id_(rsa|ed25519|ecdsa)$/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
]

/**
 * 路径安全校验(纯词法,不碰盘)。返回 `ok` = 整批放行;只要有一条不过,`ok=false` ⇒ 整批不提交。
 *
 * 为什么整批而不是逐条剔除:清单是会话自述的"我改了这些"。里面出现一条逃逸路径或活文档,
 * 说明这份自述不可信;此时按"剔除坏的那条、提交剩下的"就等于替它猜意图(§0.10 失效方向必须
 * 朝向少提交)。
 */
export function sanitizeArtifactPaths(paths) {
  const accepted = []
  const rejected = []
  for (const raw of Array.isArray(paths) ? paths : []) {
    const p = String(raw ?? '').trim().replace(/\\/g, '/')
    if (!p) {
      rejected.push({ path: String(raw ?? ''), why: '空路径' })
      continue
    }
    // 绝对路径/盘符/UNC 一律拒:清单的口径是"相对仓根",绝对路径等于把提交面交给会话自己声明。
    if (/^[A-Za-z]:/.test(p) || p.startsWith('/') || p.startsWith('~')) {
      rejected.push({ path: p, why: '绝对路径/盘符(清单只收相对仓根的路径)' })
      continue
    }
    const segs = p.split('/').filter((s) => s !== '' && s !== '.')
    if (segs.length === 0) {
      rejected.push({ path: p, why: '路径归一后为空' })
      continue
    }
    if (segs.includes('..')) {
      rejected.push({ path: p, why: '路径含 ..(可能逃出仓根)' })
      continue
    }
    const base = segs[segs.length - 1]
    if (base.toLowerCase() === 'project_plan.md') {
      // 活文档由人/live-doc-edit 改:自动提交它会把并发的翻勾/注记冲掉,且它自己就是并发写面。
      rejected.push({ path: p, why: 'PROJECT_PLAN.md 是活文档(并发冲突风险太高),一律不由会话后落账提交' })
      continue
    }
    if (segs[0] !== '.ihui-agent') {
      const hitSeg = segs.find((s) => SENSITIVE_SEGMENTS.has(s.toLowerCase()))
      if (hitSeg) {
        rejected.push({ path: p, why: `命中敏感目录 ${hitSeg}/` })
        continue
      }
      if (SENSITIVE_BASENAMES.some((re) => re.test(base))) {
        rejected.push({ path: p, why: `命中敏感文件形态 ${base}` })
        continue
      }
    }
    accepted.push(segs.join('/'))
  }
  return { ok: rejected.length === 0, accepted, rejected }
}

/**
 * 「清单里哪些文件真有改动」的判定。`statusFn(path)` 注入,返回该路径的
 * `git status --porcelain -- <path>` 文本(空串 = 无改动);测试与自检因此不必真跑 git。
 *
 * 取不到 status(抛错/未判定)一律记 stale:证明不了"有改动"就不提交,不把取不到读成有改动。
 */
export function selectDirtyPaths(paths, statusFn) {
  const dirty = []
  const stale = []
  for (const p of Array.isArray(paths) ? paths : []) {
    let out
    try {
      out = statusFn(p)
    } catch (e) {
      stale.push({ path: p, why: `git status 取不到:${e?.message ?? e}` })
      continue
    }
    if (typeof out === 'string' && out.trim() !== '') dirty.push(p)
    else if (typeof out === 'string') stale.push({ path: p, why: 'git status --porcelain 为空(该文件在本工作区没有改动)' })
    else stale.push({ path: p, why: 'git status 未判定(返回值不是字符串)' })
  }
  return { dirty, stale }
}

export const __test__ = { parseArtifactManifest, sanitizeArtifactPaths, selectDirtyPaths, manifestPathOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
