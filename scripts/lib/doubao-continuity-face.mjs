// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包一键切号的「本机登录态对账面」(2026-11-06 立,补 relay-login-local-verified 的 before 采集腿)。
 *
 * 立因:relay-login-local-verified.ts 的 CONTINUITY_FACE 只映射 switch-continuity-check 的
 * 「对话正库」八平台;doubao 不在册 ⇒ runVerifiedSwitch 的 before=null ⇒ CLI 回显
 * `before: (无对账面)`,写回腿无法自证切号前后本机现状发生了什么变化。
 * 豆包的对话确在云端(switch-continuity-check 头注 C 族取证:IndexedDB 只是下行回包缓存,
 * 不算正库,不造第二把尺)⇒ 本面采的**不是会话清单,而是登录态 cookie 族**:
 *   - 落点/键名/域/解密判据 100% 复用 scripts/lib/doubao-auth-extract.mjs(§0.6 单一真相源,
 *     本模块零新判据:哪里算豆包登录态、哪些键是会话族、值怎么解,全部只问它);
 *   - 2026-11-06 本机现读(全程只读):%LOCALAPPDATA%\Doubao\User Data\Default\Network\Cookies
 *     为标准 SQLite 3 文件(库头 "SQLite format 3"),全库 123 行,字节 passport 会话族命中 12 票
 *     (.doubao.com 11 键 + .bytedance.com/msToken),全部 encrypted_value v10 形、value 列为空;
 *     DPAPI+AES 解密后 12 票值齐,0 跳过 ⇒ 值指纹(sessionid/uid_tt 等)跨读稳定,
 *     足以形成可比对钉(uid_tt 为字节 UID,登录期内不变,不存在"每次启动都换"的结构性障碍)。
 *
 * 形态(与 snapshotApp 的 ok 形同构,compareSnapshots 可直接吃):
 *   - sessionIds = 族键集合 `${host}/${name}` 的 fp ⇒ **跨账号稳定**(族齐 = continuity-ok,
 *     某票没写回去 = lost 点名,这才是切号写回真正要答的问题);
 *   - sessions.digest = sha1(host/name=值指纹|值长度 排序集) 前 16 位 ⇒ **随账号身份变**
 *     (before/after 两枚钉不同 = 自证"本机确实换了一张脸");
 *   - accountDigests = 去重后的值指纹集(只 sha256 前 12,零明文)。
 *
 * 纪律:只读(readCookieSessionRows 对 Cookies 库 readOnly 打开;绝不写本机任何客户端文件);
 * 输出/返回值零 cookie 值明文、零 token、零 DPAPI 材料;读不到/0 命中/解密失败 ⇒ state
 * 'undetermined' 并点名原因(§0.3,绝不冒 ok)。判机器状态 ⇒ 不进提交链(§12e)。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 会话族判据单一源:豆包提取器(落点、键名、域、解密、指纹全在它那边) */
const extract = await import(pathToFileURL(path.join(HERE, 'doubao-auth-extract.mjs')).href)

export const DOUBAO_FACE_APP_KEY = 'doubao'
const LABEL = '豆包(登录态 cookie 族面)'

/** 短指纹(与 switch-continuity-check 的 fp 同形:sha1 前 12;纯格式化,不承载判据) */
const fp12 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12)

/** 值指纹清单(经提取器 summarizeEntry,只出 sha256 前 12/长度,零明文) */
function faceRowsOf(entries) {
  return entries
    .map((e) => {
      const m = extract.summarizeEntry(e)
      return `${m.host}/${m.key}=${m.valueFingerprint}|${m.valueLength}`
    })
    .sort()
}

/** 有效会话族 entries ⇒ 与 snapshotApp ok 形同构的快照对象(纯函数,供测试直调) */
export function buildDoubaoFace(valid, meta = {}) {
  const ids = [...new Set(valid.map((e) => `${e.host}/${e.key}`))].sort()
  const seed = faceRowsOf(valid).join('\n')
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)
  return {
    app: DOUBAO_FACE_APP_KEY,
    label: LABEL,
    state: 'ok',
    faceKind: 'login-cookies',
    dbFile: meta.dbFile ?? null,
    walMerged: null,
    takenAt: new Date().toISOString(),
    sessions: { count: ids.length, digest },
    messageRows: null,
    sessionsWithMessages: null,
    accountDigests: [
      ...new Set(valid.map((e) => extract.summarizeEntry(e).valueFingerprint)),
    ].sort(),
    sessionIds: ids.map(fp12),
    skipped: meta.skipped ?? 0,
  }
}

/**
 * 采一枚豆包登录态快照(默认档 = 只读)。候选目录判据 = 提取器 candidateUserDataDirs;
 * 任一候选 0 命中/读失败都不冒 ok,统一落 undetermined 并逐条点名。
 * @param {{userDataDir?: string, profile?: string, env?: NodeJS.ProcessEnv}} [opts] 仅测试注入用
 */
export function snapshotDoubaoFace(opts = {}) {
  const env = opts.env ?? process.env
  const dirs = opts.userDataDir ? [opts.userDataDir] : extract.candidateUserDataDirs(env)
  const existing = dirs.filter((d) => fs.existsSync(d))
  if (existing.length === 0) {
    return {
      app: DOUBAO_FACE_APP_KEY,
      state: 'undetermined',
      why: '本机找不到豆包数据目录(%LOCALAPPDATA%\\Doubao\\User Data 各候选均无 ⇒ 未装/未登录/路径变了)',
    }
  }
  const errs = []
  for (const dir of existing) {
    try {
      const { entries, skips, dbPath } = extract.readCookieSessionRows(
        dir,
        opts.profile ?? 'Default',
      )
      const { valid, skipped } = extract.pickImportableEntries(entries)
      if (valid.length === 0) {
        return {
          app: DOUBAO_FACE_APP_KEY,
          state: 'undetermined',
          why:
            `Cookies 库在盘(${dbPath})但会话族 0 命中(未登录或键名/域清单过期 ⇒ 未判定)` +
            (skips.length ? `;取证注记: ${skips.join('; ')}` : ''),
        }
      }
      return buildDoubaoFace(valid, { dbFile: dbPath, skipped })
    } catch (e) {
      errs.push(`${dir}: [${e?.code ?? 'read-failed'}] ${e?.message ?? String(e)}`)
    }
  }
  return {
    app: DOUBAO_FACE_APP_KEY,
    state: 'undetermined',
    why: `豆包 Cookies 库逐候选读取未判定(客户端在跑时库被独占 ⇒ 先关豆包再拍):${errs.join(' | ')}`,
  }
}

/**
 * 本机只读自检(人敲用):`node scripts/lib/doubao-continuity-face.mjs --self-test`。
 * 打同法两次快照并出示「同法两读钉必同」的自证;除脱敏形外零输出。
 */
function selfTest() {
  const a = snapshotDoubaoFace()
  const b = snapshotDoubaoFace()
  const lines = [
    `state=${a.state}`,
    `会话=${a.sessions?.count ?? '-'}`,
    `钉=${a.sessions?.digest ?? '-'}`,
    `why=${a.why ?? '-'}`,
    `同法两读钉一致=${a.state === 'ok' && b.state === 'ok' ? a.sessions.digest === b.sessions.digest : 'n/a(未判定)'}`,
  ]
  process.stdout.write(`${lines.join('\n')}\n`)
  return a.state === 'ok' ? 0 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = selfTest()
}

export const __test__ = {
  DOUBAO_FACE_APP_KEY,
  buildDoubaoFace,
  snapshotDoubaoFace,
  faceRowsOf,
  fp12,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
