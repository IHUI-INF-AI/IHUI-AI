// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 从本机正在运行的 WorkBuddy 桌面版提取当前登录账号,转成账号池标准导入 JSON。
 *
 * 落点(2026-10-23 实测):
 * - 登录会话:%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop[-ai].info
 * - 令牌字段是 $wbEncrypted 信封,密钥只存在于 WorkBuddy 主进程(原生 workbuddyStorage)。
 *   因此必须:给运行中的主进程开 Node Inspector → 取 loggerGet() → 归一化密钥 → 字段解密。
 *
 * 边界:
 * - 只读本机文件 + 只对主进程做一次 Runtime.evaluate(取 bootstrap),取完立刻 _debugEnd();
 * - 返回值与错误信息绝不包含令牌明文,只给 uid / 昵称 / 到期 / 指纹;
 * - 国际版若令牌未带 domain 声明,realm 会落 CN(错域),这里显式拒绝而不是静默导入。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const INSPECTOR_PORT = 9229
const INSPECTOR_BASE = `http://127.0.0.1:${INSPECTOR_PORT}`
const AUTH_DIR = path.join(os.homedir(), 'AppData', 'Local', 'CodeBuddyExtension', 'Data', 'Public', 'auth')
const AUTH_FILE_BY_EDITION = {
  workbuddy: 'workbuddy-desktop.info',
  'workbuddy-ai': 'workbuddy-desktop-ai.info',
}

export class ExtractError extends Error {
  constructor(message, code = 'extract-failed') {
    super(message)
    this.code = code
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withTimeout(promise, ms, label) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ExtractError(`${label} 超时(${ms}ms)`, 'timeout')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 从 CIM 行解析主进程(纯函数,便于测试主进程无 --user-data-dir 的真实形状) */
export function resolveMainProcessesFromRows(rows) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(
    (row) => Number.isInteger(Number(row?.ProcessId)) && Number(row.ProcessId) > 0,
  )
  const byPid = new Map(list.map((row) => [Number(row.ProcessId), row]))

  const result = new Map()
  for (const row of list) {
    const commandLine = typeof row?.CommandLine === 'string' ? row.CommandLine : ''
    const m = commandLine.match(/--user-data-dir=(?:"([^"]+)"|(\S+))/)
    if (!m) continue
    const userDataDir = m[1] ?? m[2]
    let pid = Number(row.ProcessId)
    const seen = new Set()
    while (!seen.has(pid)) {
      seen.add(pid)
      const current = byPid.get(pid)
      const line = typeof current?.CommandLine === 'string' ? current.CommandLine : ''
      if (!line.includes('--type=')) break
      const parent = Number(current?.ParentProcessId)
      if (!byPid.has(parent)) break
      pid = parent
    }
    const rootLine = byPid.get(pid)?.CommandLine ?? ''
    if (rootLine.includes('--type=')) continue
    result.set(`${pid}|${userDataDir}`, { pid, userDataDir })
  }
  return [...result.values()]
}

/**
 * 读取运行中的 WorkBuddy 主进程。
 *
 * 实测(5.8.3):主进程(browser)命令行只有一个 exe 路径,**没有** --user-data-dir;
 * 该参数只出现在 gpu/renderer/utility 等子进程上。因此按"带 --user-data-dir 的子进程 →
 * 沿 ParentProcessId 上溯到 WorkBuddy 根进程"来定位主进程,并按 user-data-dir 去重。
 */
export function listWorkbuddyMainProcesses(execFileImpl = execFileSync) {
  if (process.platform !== 'win32') return []
  const script =
    "$ErrorActionPreference='Stop';" +
    "Get-CimInstance Win32_Process -Filter \"Name='WorkBuddy.exe'\" | " +
    'Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress'
  let out = ''
  try {
    out = execFileImpl('pwsh', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    })
  } catch {
    return []
  }
  if (!out.trim()) return []
  let rows
  try {
    rows = JSON.parse(out)
  } catch {
    return []
  }
  return resolveMainProcessesFromRows(rows)
}

/** user-data-dir → 版本:'workbuddy'(国内) / 'workbuddy-ai'(国际)。判不出返回 null */
export function resolveEdition(userDataDir) {
  const p = String(userDataDir || '').replace(/\\/g, '/').toLowerCase()
  if (p.includes('/.workbuddy-ai')) return 'workbuddy-ai'
  if (p.includes('/.workbuddy/')) return 'workbuddy'
  return null
}

function normalizeAtRestKey(atRestSecretKey) {
  const key = crypto.createHash('sha256').update(String(atRestSecretKey), 'utf8').digest()
  const keyId = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
  return { key, keyId }
}

/** 写回端复用:at-rest bootstrap → 字段加密密钥(与提取侧逐字节同形) */
export function deriveAtRestKey(atRestSecretKey) {
  return normalizeAtRestKey(atRestSecretKey)
}

/** 版本 → 登录会话文件绝对路径(写回端定位落点用) */
export function workbuddyAuthFilePath(edition) {
  const file = AUTH_FILE_BY_EDITION[edition]
  if (!file) throw new ExtractError(`未知版本: ${edition}`, 'edition-undetermined')
  return path.join(AUTH_DIR, file)
}

/**
 * 采集原始树里所有 $wbEncrypted 信封的 JSON 路径(如 `$.auth.accessToken`、
 * `$.accounts.0.nickname`)。写回端据此决定「哪些字段要重封、哪些信封原样搬」——
 * 客户端只认信封形态,模板里它们是解密后的明文,必须按这份清单逐路重封回去。
 */
export function collectSealedPaths(node, prefix = '$', out = []) {
  if (!node || typeof node !== 'object') return out
  if (node.$wbEncrypted === 1) {
    out.push(prefix)
    return out
  }
  for (const [k, v] of Object.entries(node)) collectSealedPaths(v, `${prefix}.${k}`, out)
  return out
}

/** 按 `$.a.b.0` 形态路径取/设值(写回端重封用;中途缺对象则 set 时补建) */
export function getPathByJsonPath(tree, jsonPath) {
  const segs = String(jsonPath).split('.').filter(Boolean)
  if (segs[0] !== '$') return undefined
  let cur = tree
  for (const s of segs.slice(1)) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[s]
  }
  return cur
}

export function setPathByJsonPath(tree, jsonPath, value) {
  const segs = String(jsonPath).split('.').filter(Boolean)
  if (segs[0] !== '$' || segs.length < 2) return false
  let cur = tree
  for (const s of segs.slice(1, -1)) {
    if (cur === null || typeof cur !== 'object') return false
    if (!(s in cur) || cur[s] === null || typeof cur[s] !== 'object') cur[s] = {}
    cur = cur[s]
  }
  if (cur === null || typeof cur !== 'object') return false
  cur[segs[segs.length - 1]] = value
  return true
}

/**
 * 会话模板:解密树剔除凭证族(auth.accessToken/refreshToken 是票本体,
 * expiresAt/refreshExpiresAt/lastRefreshTime 是随票滚动的时刻)——
 * 号池 secretsEnc 只存资料,凭证以池内权威值为准(写回端重新落)。
 */
export function buildWorkbuddyTemplate(decryptedSession) {
  const tpl = JSON.parse(JSON.stringify(decryptedSession ?? {}))
  const auth = tpl && typeof tpl.auth === 'object' && tpl.auth !== null ? tpl.auth : null
  if (auth) {
    for (const k of ['accessToken', 'refreshToken', 'expiresAt', 'refreshExpiresAt', 'lastRefreshTime']) {
      delete auth[k]
    }
  }
  return tpl
}

function lp(s) {
  const b = Buffer.from(s, 'utf8')
  const n = Buffer.alloc(4)
  n.writeUInt32BE(b.length)
  return Buffer.concat([n, b])
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

/** sym-v1 / field 帧的 AAD(与 WorkBuddy app-lifetime-job 的实现逐字节同形) */
export function buildFieldAad(keyId) {
  return Buffer.concat([
    Buffer.from('WB-AAD\0', 'ascii'),
    Buffer.from([1]),
    lp('WBEV1'),
    lp('sym-v1'),
    u32(1),
    lp(keyId),
    Buffer.from([2]),
    Buffer.from([0]),
    Buffer.from([0]),
  ])
}

/**
 * 字段重封(写回端正式 API;旧测试别名 sealFieldForTest 保留)。
 * 与 WorkBuddy 客户端 sym-v1 field 帧逐字节同形(AAD 见 buildFieldAad)。
 */
export function sealField(plaintext, key, keyId, nonce = crypto.randomBytes(12)) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 })
  cipher.setAAD(buildFieldAad(keyId))
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  return {
    $wbEncrypted: 1,
    envelope: Buffer.from(
      JSON.stringify({
        suite: 1,
        keyId,
        nonce: nonce.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
      }),
      'utf8',
    ).toString('base64'),
  }
}

/** 旧别名(测试与历史引用) */
export const sealFieldForTest = sealField

function openField(wrapper, key, keyId) {
  const envelope = JSON.parse(Buffer.from(wrapper.envelope, 'base64').toString('utf8'))
  if (envelope.suite !== 1) throw new ExtractError(`不支持的加密套件 ${envelope.suite}`, 'unsupported-suite')
  if (envelope.keyId !== keyId) throw new ExtractError('字段 keyId 与本机主密钥不匹配', 'key-mismatch')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'), {
    authTagLength: 16,
  })
  decipher.setAAD(buildFieldAad(keyId))
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString(
    'utf8',
  )
}

export function decryptSessionTree(node, key, keyId) {
  if (!node || typeof node !== 'object') return node
  if (node.$wbEncrypted === 1) return openField(node, key, keyId)
  const out = Array.isArray(node) ? [] : {}
  for (const [k, v] of Object.entries(node)) out[k] = decryptSessionTree(v, key, keyId)
  return out
}

async function waitForInspector(pid, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${INSPECTOR_BASE}/json/list`)
      if (res.ok) {
        const list = await res.json()
        const target = list.find((t) => t.webSocketDebuggerUrl)
        if (target) return target
      }
    } catch (e) {
      lastErr = e
    }
    await sleep(120)
  }
  throw new ExtractError(
    `无法连接 WorkBuddy 调试端口 ${INSPECTOR_PORT}${lastErr ? `: ${lastErr.message}` : ''}`,
    'inspector-unreachable',
  )
}

async function evaluateOnTarget(target, expression) {
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await withTimeout(
    new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new ExtractError('调试 WebSocket 连接失败', 'inspector-ws')), {
        once: true,
      })
    }),
    5000,
    '连接调试通道',
  )
  try {
    const reply = await withTimeout(
      new Promise((resolve) => {
        ws.addEventListener(
          'message',
          (event) => {
            const msg = JSON.parse(event.data)
            if (msg.id === 1) resolve(msg)
          },
          { once: false },
        )
        ws.send(
          JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
          }),
        )
      }),
      8000,
      '调试求值',
    )
    if (reply.error) throw new ExtractError(`调试求值失败: ${reply.error.message}`, 'inspector-eval')
    const result = reply.result
    if (result?.exceptionDetails) {
      throw new ExtractError(
        `调试求值异常: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
        'inspector-exception',
      )
    }
    return result?.result?.value
  } finally {
    try {
      ws.close()
    } catch {
      /* 连接可能已关闭 */
    }
  }
}

/** 给运行中的主进程开 Inspector,取 at-rest bootstrap;无论成败都关闭调试通道 */
export async function readAtRestBootstrap(pid) {
  let opened = false
  try {
    process._debugProcess(pid)
    opened = true
  } catch (e) {
    throw new ExtractError(
      `无法给 WorkBuddy 主进程(pid=${pid})开启调试通道: ${e instanceof Error ? e.message : String(e)}`,
      'inspector-attach',
    )
  }
  try {
    const target = await waitForInspector(pid)
    const actualPid = await evaluateOnTarget(target, 'process.pid')
    if (String(actualPid) !== String(pid)) {
      throw new ExtractError(
        `${INSPECTOR_PORT} 已被其他进程占用(实际 pid=${actualPid},期望 ${pid})`,
        'inspector-port-conflict',
      )
    }
    const expr =
      "(()=>{const r=typeof require==='function'?require:process.mainModule.require;" +
      "const e=r('electron');return JSON.stringify(e.workbuddyStorage.loggerGet())})()"
    const raw = await evaluateOnTarget(target, expr)
    if (typeof raw !== 'string') throw new ExtractError('主进程未返回凭据保护 bootstrap', 'bad-bootstrap')
    const bootstrap = JSON.parse(JSON.parse(raw))
    if (!bootstrap || typeof bootstrap.atRestSecretKey !== 'string' || !bootstrap.atRestSecretKey) {
      throw new ExtractError('bootstrap 缺少 atRestSecretKey', 'bad-bootstrap')
    }
    return bootstrap
  } finally {
    if (opened) {
      try {
        const target = await waitForInspector(pid, 2000)
        await evaluateOnTarget(target, 'process._debugEnd()')
      } catch {
        /* 端口可能已被主进程自行关闭 */
      }
    }
  }
}

function decodeJwtClaims(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** 国际版必须能从令牌声明里读出 workbuddy.ai 域,否则 realm 会落 CN */
export function assertRealmMatchesEdition(edition, claims) {
  if (edition !== 'workbuddy-ai') return
  const data = claims && typeof claims === 'object' ? claims.data : undefined
  const domain =
    (typeof claims?.domain === 'string' && claims.domain) ||
    (data && typeof data === 'object' && typeof data.domain === 'string' && data.domain) ||
    ''
  if (!/workbuddy\.ai$/i.test(domain.trim())) {
    throw new ExtractError(
      '国际版登录令牌未携带 workbuddy.ai 域声明,导入后会被按国内域转发;请先不要把该号入池',
      'realm-undetermined',
    )
  }
}

export function fingerprintOf(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12)
}

/**
 * 提取当前运行中的 WorkBuddy 账号。
 * @returns {{providerCode:'workbuddy', accounts:Array<object>, meta:object}}
 */
export async function extractWorkbuddyAccount({ now = () => Date.now() } = {}) {
  const mains = listWorkbuddyMainProcesses()
  if (mains.length === 0) {
    throw new ExtractError('未发现运行中的 WorkBuddy 主进程;请先启动并登录 WorkBuddy', 'not-running')
  }
  if (mains.length > 1) {
    throw new ExtractError(
      `发现 ${mains.length} 个 WorkBuddy 主进程,不确定取哪一个;请只保留一个再重试`,
      'ambiguous-process',
    )
  }
  const { pid, userDataDir } = mains[0]
  const edition = resolveEdition(userDataDir)
  if (!edition) {
    throw new ExtractError(`无法从 --user-data-dir 判定版本: ${userDataDir}`, 'edition-undetermined')
  }
  const authFile = path.join(AUTH_DIR, AUTH_FILE_BY_EDITION[edition])
  if (!fs.existsSync(authFile)) {
    throw new ExtractError(`未找到登录会话文件: ${authFile}`, 'auth-file-missing')
  }

  const bootstrap = await readAtRestBootstrap(pid)
  const { key, keyId } = normalizeAtRestKey(bootstrap.atRestSecretKey)
  let session
  let sealedPaths
  try {
    const raw = JSON.parse(fs.readFileSync(authFile, 'utf8'))
    sealedPaths = collectSealedPaths(raw)
    session = decryptSessionTree(raw, key, keyId)
  } finally {
    key.fill(0)
  }

  const auth = session?.auth ?? {}
  const account = session?.account ?? {}
  const token = typeof auth.accessToken === 'string' ? auth.accessToken : ''
  const refreshToken = typeof auth.refreshToken === 'string' ? auth.refreshToken : ''
  if (!token) throw new ExtractError('会话文件里没有 accessToken', 'token-missing')
  if (!refreshToken) throw new ExtractError('会话文件里没有 refreshToken(到期后无法续期)', 'refresh-missing')

  const claims = decodeJwtClaims(token)
  if (!claims?.sub || String(claims.sub) !== String(account.uid ?? '')) {
    throw new ExtractError('令牌 sub 与会话 uid 不一致,拒绝导入', 'uid-mismatch')
  }
  assertRealmMatchesEdition(edition, claims)

  const expiresAt = typeof claims.exp === 'number' ? new Date(claims.exp * 1000) : null
  if (expiresAt && expiresAt.getTime() <= now()) {
    throw new ExtractError('当前 access token 已过期,请先在 WorkBuddy 里刷新/重新登录', 'token-expired')
  }

  const nickname = typeof account.nickname === 'string' ? account.nickname : ''
  return {
    providerCode: 'workbuddy',
    accounts: [
      {
        name: nickname || `workbuddy-${String(account.uid).slice(0, 8)}`,
        token,
        refreshToken,
        uid: String(account.uid),
        enabled: true,
        // 「登录本机」写回配方(2026-10-28):模板=解密树剔凭证;sealedPaths=原始树
        // 实采的信封路径(客户端只认信封形态,写回端按此重封);edition/authFile=落点定位。
        sessionTemplate: buildWorkbuddyTemplate(session),
        sealedPaths,
        edition,
        authFile,
      },
    ],
    meta: {
      edition,
      pid,
      uid: String(account.uid),
      name: nickname,
      authFile,
      sealedCount: sealedPaths.length,
      tokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
      tokenFingerprint: fingerprintOf(token),
      accessTokenLength: token.length,
      refreshTokenLength: refreshToken.length,
    },
  }
}

export const __test__ = {
  buildFieldAad,
  sealFieldForTest,
  sealField,
  openField,
  decryptSessionTree,
  normalizeAtRestKey,
  deriveAtRestKey,
  workbuddyAuthFilePath,
  collectSealedPaths,
  getPathByJsonPath,
  setPathByJsonPath,
  buildWorkbuddyTemplate,
  resolveEdition,
  assertRealmMatchesEdition,
  decodeJwtClaims,
  fingerprintOf,
  resolveMainProcessesFromRows,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
