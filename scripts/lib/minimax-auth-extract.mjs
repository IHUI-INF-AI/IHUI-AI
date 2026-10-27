// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax Code CLI(mcode)本机会话提取器(2026-10-27 装车,补中转号池 minimax 缺口)。
 *
 * 取证链(2026-10-27 本机实证,§0.9 判据现读,不猜;探查只打印键名与值类型,零值回显):
 *   - 数据根 = ~/.minimax/(本机活跃:auth/ 2026-10-27 当日写、channel-bindings.yaml、
 *     agents/、v2/、config.yaml 等);config.yaml 的 provider.minimax.options.apiKey/
 *     baseURL 键名在,值不读不碰(零回显)。
 *   - 会话文件 = auth/prod/<region>/mcode-public/auth.json,本机实证形状:
 *       { schemaVersion:number,
 *         records: { "com.minimax.mcode.oauth.prod.cn <后缀>": {
 *           schemaVersion:number, accessToken:string, refreshToken:string,
 *           tokenType:string, clientId:string, scopes:string[], audience:string,
 *           expiresAtMs:number, generation:number, loginEpoch:string } } }
 *     同目录 auth-state.json = { schemaVersion,status,storeKind,clientId,scopes,
 *     audience,buildEnv,region,generation,expiresAtMs }。
 *   - 记录键自带区域:`com.minimax.mcode.oauth.prod.cn` ⇒ region:'cn';国际版预期
 *     `…prod.global`,且目录落在 auth/prod/global/ 下(本机未登录国际版,该形未实证 ⇒
 *     按 mcode login --region global 的文档语义探测,不冒绿)。
 *   - 国际版双根探测:~/.minimax 为主(本机实证活跃);~/.minimax-global 为国际版候选根
 *     (本机 glob 试探不存在,纯候选);~/.minimax-agent-cn 本机存在但只有 projects/ 子树、
 *     无 auth 形状,不纳入根清单(探查实证 2026-10-27,如实记录)。
 *
 * 分工:纯 fs/glob 级 JSON 读取,无解密步骤(mcode 会话明文落盘,与 CodeArts 的
 * DPAPI+AESGCM 链不同);令牌零回显:meta 摘要只有指纹(sha256 前 12 位)/长度/布尔完备性。
 *
 * §0.6 单一真相源:本模块零映射 —— auth.json 的 records 值**逐字直通**(spread 保真),
 * 仅附 region/recordKey/溯源字段;归一与凭证拆分全交服务端 mapMinimaxImport(主会话集成)。
 *
 * 退出语义(§0.3):取不到 = throw(带 code),由编排器落 exit 2「未判定」并点名原因。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** 会话文件在数据根下的相对目录形:auth/prod/<region>/mcode-public/auth.json */
const AUTH_REL = path.join('auth', 'prod')

/** 记录键形(本机实证 cn;global 为文档语义预期,未实证):com.minimax.mcode.oauth.prod.<region> <后缀> */
const RECORD_KEY_RE = /^com\.minimax\.mcode\.oauth\.prod\.(cn|global)\b/

/** 国际版候选根(本机 glob 试探不存在;保留探测以便他机复用) */
const GLOBAL_ROOT_NAME = '.minimax-global'

function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex').slice(0, 12)
}

function cstr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

/** 候选数据根:~/.minimax(主,本机实证)+ ~/.minimax-global(国际版候选);opts.roots 仅供测试注入(同样做存在性过滤,缺失根 ⇒ 上层 DIR_MISSING) */
export function candidateRoots(opts = {}) {
  const raw = Array.isArray(opts.roots) && opts.roots.length > 0 ? opts.roots : (() => {
    const home = os.homedir()
    return [path.join(home, '.minimax'), path.join(home, GLOBAL_ROOT_NAME)]
  })()
  return [...new Set(raw)].filter((d) => fs.existsSync(d))
}

/**
 * 扫一个数据根下全部区域的会话文件(auth/prod/<区域>/mcode-public/auth.json)。
 * 返回 [{ regionDir, authPath }];目录形不符/无文件 ⇒ [](由上层归为 NO_SESSION)。
 */
export function discoverAuthFiles(root) {
  const prodDir = path.join(root, AUTH_REL)
  let regionDirs
  try {
    regionDirs = fs
      .readdirSync(prodDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
  const files = []
  for (const regionDir of regionDirs) {
    const authPath = path.join(prodDir, regionDir, 'mcode-public', 'auth.json')
    try {
      if (fs.statSync(authPath).isFile()) files.push({ regionDir, authPath })
    } catch {
      /* 该区域无会话文件,跳过 */
    }
  }
  return files
}

/** 从记录键取 region(cn/global);不符键形 ⇒ null(未判定,不猜) */
export function regionFromRecordKey(recordKey) {
  const m = RECORD_KEY_RE.exec(String(recordKey ?? ''))
  return m ? m[1] : null
}

/** 可导入判据:accessToken + refreshToken 双全才算(refresh 是续期命脉,缺一不可) */
export function pickImportableRecords(records) {
  const valid = []
  let skipped = 0
  for (const rec of Array.isArray(records) ? records : []) {
    if (cstr(rec?.accessToken) === '' || cstr(rec?.refreshToken) === '') {
      skipped++
      continue
    }
    valid.push(rec)
  }
  return { valid, skipped }
}

/** 单会话 stderr 摘要(零凭据明文;token 只报指纹/长度/布尔) */
export function summarizeRecord(rec, region, recordKey) {
  const expires = typeof rec.expiresAtMs === 'number' && Number.isFinite(rec.expiresAtMs)
    ? new Date(rec.expiresAtMs).toISOString()
    : '-'
  return {
    recordKey: String(recordKey ?? '(未知键)'),
    region,
    expiresAt: expires,
    hasRefresh: cstr(rec.refreshToken) !== '',
    tokenType: cstr(rec.tokenType) || '(未知)',
    audience: cstr(rec.audience) || '(未知)',
    tokenFingerprint: rec.accessToken ? fingerprintOf(rec.accessToken) : '-',
    tokenLength: cstr(rec.accessToken).length,
  }
}

/**
 * 提取本机 MiniMax Code(mcode)会话 → 编排器 payload。任何一步取不到都 throw 带 code,绝不静默返回空。
 * @param {{roots?: string[]}} [opts] 仅供测试注入
 */
export async function extractMinimaxAccounts(opts = {}) {
  const roots = candidateRoots(opts)
  if (roots.length === 0) {
    throw Object.assign(
      new Error(
        '未找到 MiniMax Code 数据目录(~/.minimax 与 ~/.minimax-global 均无);' +
          '请先在本机执行 mcode login(中国大陆)或 mcode login --region global(国际)登录',
      ),
      { code: 'MINIMAX_DIR_MISSING' },
    )
  }
  const accounts = []
  const rootNotes = []
  for (const root of roots) {
    const files = discoverAuthFiles(root)
    rootNotes.push({ root, authFiles: files.map((f) => f.authPath) })
    for (const { regionDir, authPath } of files) {
      let parsed
      try {
        parsed = JSON.parse(fs.readFileSync(authPath, 'utf8'))
      } catch (e) {
        throw Object.assign(
          new Error(`会话文件读取失败(${authPath}): ${e instanceof Error ? e.message : String(e)}`),
          { code: 'MINIMAX_AUTH_UNREADABLE' },
        )
      }
      const records = parsed && typeof parsed === 'object' ? parsed.records : null
      if (!records || typeof records !== 'object' || Array.isArray(records)) continue
      for (const [recordKey, rec] of Object.entries(records)) {
        if (!rec || typeof rec !== 'object') continue
        // region 三级判定:记录键形(实证) > 目录名 > null 未判定
        const region = regionFromRecordKey(recordKey) ?? (regionDir === 'cn' || regionDir === 'global' ? regionDir : null)
        // §0.6 raw 直通:记录逐字保留,仅附 region/recordKey/溯源字段
        accounts.push({ ...rec, region, recordKey, sourceRoot: root, sourcePath: authPath })
      }
    }
  }
  const { valid, skipped } = pickImportableRecords(accounts)
  if (valid.length === 0) {
    throw Object.assign(
      new Error(
        `探到 ${accounts.length} 条 mcode 会话记录但 0 条双全(accessToken/refreshToken) ⇒ 未判定;` +
          `探测根: ${rootNotes.map((n) => `${n.root}(${n.authFiles.length} 文件)`).join('; ') || '(无)'}`,
      ),
      { code: 'MINIMAX_NO_SESSION' },
    )
  }
  return {
    providerCode: 'minimax',
    accounts: valid,
    meta: { roots: rootNotes, count: valid.length, skipped, sessions: valid.map((a) => summarizeRecord(a, a.region, a.recordKey)) },
  }
}

export const __test__ = {
  candidateRoots,
  discoverAuthFiles,
  regionFromRecordKey,
  pickImportableRecords,
  summarizeRecord,
  RECORD_KEY_RE,
}
