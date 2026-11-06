// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「一行一个 token」行文本 → 标准账号结构 的唯一折叠器(2026-11-06 立)。
 *
 * 立因:批量导入此前只有一条入口 `--file <标准 JSON>`
 * (`node scripts/relay-account-pool.mjs --file accounts.json [--provider p]`)。
 * 手上是"一行一个 token"这种纯文本的人没有出口(仓内 grep 无行文本→JSON 转换器;
 * `apps/api/scripts/relay-account-import.ts` 只吃 JSON,`--stdin`/`--file` 二选一)。
 *
 * 纪律(逐条对着 AGENTS.md):
 *  - **零校验复算(§0.6)**:本模块只做**文本折叠** ⇒ 不判 uid、不判过期、不判"能不能入池"。
 *    折叠产物原样交给既有下游通路 `--stdin` → `apps/api/scripts/relay-account-import.ts`
 *    (`validateAccountExport` 校验 + `resolveImportAccountUidProbe` 键源 + `importAccounts` 落库),
 *    所以 `--dry-run` 报出的 uid / expired / duplicateUids 与 JSON 通路**逐字同源**;
 *    本层另写一份预检 = 第二把必然漂移的尺子,禁止。
 *  - **uid 由 token 自身材料推出**,推导发生在那一侧(键源 = 服务层
 *    `resolveImportAccountUidProbe`,现读使用点:`apps/api/scripts/relay-account-import.ts:313`)。
 *    一行一号自然一枚 uid;同批 token 重复 ⇒ 下游 `duplicateUids > 0`,本层只补"第几行"的
 *    行号映射让人能追溯,**绝不折半、绝不静默去重**(折半 = 把"覆盖了哪一行"这件事抹掉)。
 *  - **凭据纪律**:token 明文永不进任何输出。需要点名时用 12 位 sha256 指纹前缀。
 *    同形关系:`scripts/lib/*-auth-extract.mjs` 里各自私有了一份 `fingerprintOf`
 *    (同一算式 createHash('sha256').update(token,'utf8').digest('hex').slice(0,12)),
 *    那些是各提取器的就地局部件、未 export 主面;本层不再往那十个文件里插副本,
 *    只在此落工具层这一份并注明同形 —— 与 `scripts/lib/pool-owner.mjs` 的 `UUID_LIKE_RE`
 *    同一处置口径(措辞/算式变更须两处同改)。
 *  - **名称脱敏单源**:回显"人给的名字"一律经 `packages/shared` 的 `maskPhone`(唯一实现,
 *    §0.6 不抄第二份);工具层拿的是它的构建产物 `packages/shared/dist/utils/format-mobile.js`
 *    (静态 import TS 源在 .mjs 里不成立,根 node_modules 也没有 @ihui/shared 可解析)。
 *    取不到单源 ⇒ **不打印名称**(失效方向 = 少显示,绝不是多泄露,§0.10);
 *    自动名本身就是指纹形态,不含凭据,原样回显以保住可追溯性。
 *  - **自动名可追溯**:缺 name 时名 = `token-<12位指纹>`(带 `--name-prefix` 时前缀在前),
 *    禁止"账号1/账号2"这种事后对不上号的不可追溯名。
 *  - **失效方向**:文件读不到 / 全空 / 全是注释行 ⇒ 由调用方 exit 2 显式「未判定」并点名原因,
 *    绝不报"导入 0 枚"当成功(§0.3)。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导,不信 cwd(§15:共享工作区 cwd 不可靠)。 */
const REPO_ROOT = path.resolve(HERE, '..', '..')

/** 名称脱敏单源的构建产物落点(点名用;真正取用走 loadMaskPhone)。 */
export const SHARED_FORMAT_MOBILE_DIST = path.join(
  REPO_ROOT,
  'packages',
  'shared',
  'dist',
  'utils',
  'format-mobile.js',
)

/** 指纹长度:与 scripts/lib/*-auth-extract.mjs 的本地 fingerprintOf 同形。 */
export const FINGERPRINT_LENGTH = 12

/** 拿不到脱敏单源时的替代文本(宁可不显示,也不外显未脱敏名称)。 */
export const NAME_NOT_MASKED_TEXT = '(名称未经单源脱敏,不外显)'

/** 折叠失败原因 ⇒ 人读措辞(唯一一份,调用方不得另抄一段,§0.6)。 */
export const TOKENS_TEXT_REASON_TEXT = Object.freeze({
  empty: '文件没有任何内容行(全空)',
  'all-comments': '文件只有 # 注释行,没有一行 token',
})

/**
 * token ⇒ 12 位 sha256 指纹前缀(永不回显原文,也不是明文截断)。
 * @param {string} token
 * @returns {string}
 */
export function tokenFingerprint(token) {
  return crypto
    .createHash('sha256')
    .update(String(token ?? ''), 'utf8')
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH)
}

/**
 * 自动名(可追溯):`token-<指纹>`;给了前缀则 `<前缀>-token-<指纹>`。
 * @param {string} fingerprint tokenFingerprint 的结果
 * @param {string} [namePrefix] 调用方 --name-prefix 原值
 * @returns {string}
 */
export function autoAccountName(fingerprint, namePrefix = '') {
  const prefix = String(namePrefix ?? '').trim()
  return prefix ? `${prefix}-token-${fingerprint}` : `token-${fingerprint}`
}

/**
 * 行文本折叠:一行一枚 token。
 * 规则:忽略空行与 `#` 起始的注释行;行内首个空白(TAB 或空格)之前算「名称」,
 * 其余算 token(两段形态);整行无空白 ⇒ 整行是 token,名称走自动名。
 * @param {string} text 行文本原文(BOM 会被吃掉)
 * @param {{namePrefix?: string}} [opts]
 * @returns {{
 *   reason: 'ok'|'empty'|'all-comments',
 *   entries: Array<{index:number,line:number,name:string,nameSource:'given'|'auto',
 *                  token:string,fingerprint:string}>,
 *   duplicates: Array<{fingerprint:string,lines:number[]}>,
 *   notes: Array<{line:number,code:string,message:string}>,
 *   stats: {lines:number,blank:number,comments:number,tokens:number},
 * }}
 */
export function parseTokensLineText(text, { namePrefix = '' } = {}) {
  const body = String(text ?? '').replace(/^\uFEFF/, '')
  const lines = body.split(/\r?\n/)
  const entries = []
  const notes = []
  const byToken = new Map()
  let blank = 0
  let comments = 0

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    const lineNo = i + 1
    if (line === '') {
      blank++
      return
    }
    if (line.startsWith('#')) {
      comments++
      return
    }
    const sep = line.search(/[ \t]/)
    let name
    let token
    let nameSource
    if (sep === -1) {
      token = line
      nameSource = 'auto'
      name = autoAccountName(tokenFingerprint(token), namePrefix)
    } else {
      name = line.slice(0, sep).trim()
      token = line.slice(sep).trim()
      nameSource = 'given'
      if (/[ \t]/.test(token)) {
        // token 里不该有空白:多半是"名称含空格"被切错。本层不猜,如实点名,判定权留给下游预检。
        notes.push({
          line: lineNo,
          code: 'two-part-form-ambiguous',
          message: `切出的 token 仍含空白(名称="${name}"),若原始 token 无空白则名称段可能被切多`,
        })
      }
      if (name === '') {
        nameSource = 'auto'
        name = autoAccountName(tokenFingerprint(token), namePrefix)
      }
    }
    const fingerprint = tokenFingerprint(token)
    entries.push({ index: entries.length, line: lineNo, name, nameSource, token, fingerprint })
    const seen = byToken.get(token)
    if (seen) seen.push(lineNo)
    else byToken.set(token, [lineNo])
  })

  const duplicates = [...byToken.entries()]
    .filter(([, lineNos]) => lineNos.length > 1)
    .map(([token, lineNos]) => ({ fingerprint: tokenFingerprint(token), lines: lineNos }))

  let reason = 'ok'
  if (entries.length === 0) reason = comments > 0 ? 'all-comments' : 'empty'
  return {
    reason,
    entries,
    duplicates,
    notes,
    stats: { lines: lines.length, blank, comments, tokens: entries.length },
  }
}

/**
 * 折叠产物 = 标准账号 JSON(与手写的 `{"accounts":[...]}` 同一形状)。
 * 行文本没有「启用位」与 refreshToken 的表达能力 ⇒ enabled 一律 true,refreshToken 不写。
 * @param {Array<{name:string,token:string}>} entries
 * @returns {{accounts:Array<{name:string,token:string,enabled:boolean}>}}
 */
export function buildAccountsPayload(entries) {
  return {
    accounts: entries.map((e) => ({ name: e.name, token: e.token, enabled: true })),
  }
}

/**
 * 名称的回显形态:自动名本身就是指纹 ⇒ 原样;人给的名 ⇒ 走 maskPhone 单源。
 * @param {{name:string,nameSource:'given'|'auto'}} entry
 * @param {((s:string)=>string)|null} maskPhoneFn 取不到单源时传 null ⇒ 不外显
 * @returns {string}
 */
export function nameEchoText(entry, maskPhoneFn) {
  if (entry.nameSource === 'auto') return entry.name
  if (typeof maskPhoneFn !== 'function') return NAME_NOT_MASKED_TEXT
  const masked = maskPhoneFn(entry.name)
  return masked === '' ? NAME_NOT_MASKED_TEXT : masked
}

/** 序号←行号 映射行(交 stderr;`--json` 的 stdout 机器面因此保持干净)。 */
export function renderEntryMapLines(entries, maskPhoneFn) {
  return entries
    .map(
      (e) =>
        `  #${e.index + 1} ← 第${e.line}行 名称=${nameEchoText(e, maskPhoneFn)} 指纹=${e.fingerprint}`,
    )
    .join('\n')
}

/** 批内同 token 重复的行号点名(文本级事实;落库口径的 duplicateUids 由下游预检给)。 */
export function renderDuplicateNotice(duplicates) {
  if (duplicates.length === 0) return ''
  const groups = duplicates.map((d) => `指纹=${d.fingerprint} 行 ${d.lines.join(',')}`).join(' | ')
  return (
    `⚠️ 批内同一 token 重复 ${duplicates.length} 组(按行文本逐字判,本层不折半、不去重):${groups}\n` +
    '   落库口径的 uid 与 duplicateUids 由下游预检给(键源=服务层 resolveImportAccountUidProbe),' +
    '同 uid 重复导入 = 覆盖凭证并重置健康状态。\n'
  )
}

/** 行级卫生提示的回显(不拦截、不改判,只点名行号)。 */
export function renderNoteLines(notes) {
  return notes.map((n) => `  第${n.line}行 ${n.code}: ${n.message}`).join('\n')
}

/**
 * 名称脱敏单源的装载:`packages/shared` 的 `maskPhone`。
 * 取不到(未构建 / 路径不存在 / 没导出)⇒ 返回 null,由 nameEchoText 走"不外显"。
 * 这不是判据失败,是显示面降级,故不 exit 2(§0.10:失效方向是少显示)。
 * @param {{distPath?:string, fsImpl?:typeof fs}} [opts]
 * @returns {Promise<((s:string)=>string)|null>}
 */
export async function loadMaskPhone({ distPath = SHARED_FORMAT_MOBILE_DIST, fsImpl = fs } = {}) {
  try {
    if (!fsImpl.existsSync(distPath)) return null
    const mod = await import(pathToFileURL(distPath).href)
    return typeof mod.maskPhone === 'function' ? mod.maskPhone : null
  } catch {
    return null
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.stderr.write(
    '本模块是折叠器(库),请用 node scripts/relay-account-pool.mjs --tokens-file <txt> --provider <code>\n',
  )
  process.exit(2)
}

export const __test__ = {
  SHARED_FORMAT_MOBILE_DIST,
  FINGERPRINT_LENGTH,
  NAME_NOT_MASKED_TEXT,
  TOKENS_TEXT_REASON_TEXT,
  tokenFingerprint,
  autoAccountName,
  parseTokensLineText,
  buildAccountsPayload,
  nameEchoText,
  renderEntryMapLines,
  renderDuplicateNotice,
  renderNoteLines,
  loadMaskPhone,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
