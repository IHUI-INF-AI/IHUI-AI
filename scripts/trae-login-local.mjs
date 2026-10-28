// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 本机登录态写入(2026-10-27 立)—— 号池「登录本机」的执行端。
 *
 * 立因:号池能保活账号,但换机/退号后本机 Trae 客户端仍是空登录态。客户端登录态
 * 存在 storage.json 的 `iCubeAuthInfo://icube.cloudide` 键(byteCrypto 信封),而号池
 * 只存票、存不出 account 资料(JWT 里没有)⇒ 导入时把整份 userInfo 去掉凭证存成
 * 「会话模板」(加密进 secretsEnc),本脚本用池内最新凭证打补丁后重封信封写回。
 *
 * 链路:apps/api 路由 POST /admin/relay/accounts/:id/login-local → stdin JSON →
 * 本脚本(定位本机 storage.json → 备份 → 重封信封 → 原子写)。
 *
 *   node scripts/trae-login-local.mjs --stdin [--json]
 *
 * 安全:
 * - 凭证只在调用方进程与本次写盘之间流动,任何输出都不含 token/refreshToken 明文;
 * - 写前必留同目录备份(storage.json.ihui-login-<时间戳>.bak),失败可人工回滚;
 * - 模板 userId 与目标 uid 不一致时拒绝写入(防止拿错号的模板把登录态写成别人)。
 *
 * 退出码:0 写入成功 / 1 写入失败 / 2 参数·输入·环境未判定(本机没有 Trae 等)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  TRAE_PRODUCTS,
  closeProduct,
  launchProduct,
  listProductPids,
  productOfDir,
  resolveProductExe,
} from './lib/trae-client-process.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXTRACT_LIB = path.join(HERE, 'lib', 'trae-auth-extract.mjs')
/** 服务身份下重新拉起客户端要换桌面用户身份(CreateProcessAsUser) */
const RUN_AS_USER_SCRIPT = path.join(HERE, '..', 'apps', 'api', 'scripts', 'run-as-user.ps1')

/** 会话信封的固定键名(IDE 会话;usertag / icube-dc 是附属档,不承载登录态) */
const SESSION_KEY = 'iCubeAuthInfo://icube.cloudide'
const DEVICE_KEY_PREFIX = 'iCubeAuthInfo://icube-dc:'
/** 写回时必须由池内权威值覆盖的字段(模板里已剔除,这里再剔一次防手改模板带旧值) */
const CREDENTIAL_KEYS = ['token', 'refreshToken', 'expiredAt', 'refreshExpiredAt']

export class WriteError extends Error {
  constructor(message, code = 'write-failed') {
    super(message)
    this.name = 'WriteError'
    this.code = code
  }
}

export function parseArgs(argv) {
  const options = { stdin: false, json: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--stdin') options.stdin = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else options.error = `未知参数: ${a}`
  }
  if (!options.stdin && !options.error && !options.help) {
    options.error = '必须 --stdin(凭证经标准输入,不落盘)'
  }
  return options
}

function asText(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function asIso(v) {
  const s = asText(v)
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : s
}

/** 读取 payload 并做形状校验(字段宽松,缺凭证直接未判定) */
export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WriteError('stdin 必须是 JSON 对象(未判定)', 'payload-shape')
  }
  const uid = asText(raw.uid)
  const token = asText(raw.token)
  if (!uid || !token) throw new WriteError('缺 uid 或 token(未判定)', 'payload-shape')
  const template = raw.sessionTemplate
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    throw new WriteError(
      '该号没有会话模板(导入时未采集本机登录态)⇒ 无法写入本机,请先在本机登录该号后重新一键入池',
      'no-template',
    )
  }
  const tplUid = template.userId === undefined || template.userId === null ? '' : String(template.userId)
  if (tplUid && tplUid !== uid) {
    throw new WriteError(
      `会话模板的 userId(${tplUid})与目标 uid(${uid})不一致 ⇒ 拒绝写入(模板与账号错配)`,
      'template-uid-mismatch',
    )
  }
  return {
    uid,
    token,
    refreshToken: asText(raw.refreshToken),
    expiresAt: asIso(raw.expiresAt),
    refreshExpiresAt: asIso(raw.refreshExpiresAt),
    template,
    deviceId: asText(raw.deviceId),
    deviceKeyPem: asText(raw.deviceKeyPem),
    devicePubPem: asText(raw.devicePubPem),
    targetStorage: asText(raw.targetStorage),
    /**
     * 写前关停客户端并在写后重新拉起(2026-10-28)。
     * 客户端在跑时直接写 storage.json 必被它的退出落盘覆写 ⇒ 服务端固定传 true;
     * 不带该标记(手工 CLI)时遇到在跑的客户端明确拒绝,绝不悄悄写。
     */
    restartClient: raw.restartClient === true,
  }
}

/** 探测在跑的产品(pid 面);tasklist 失败 ⇒ unknown(不猜) */
export function detectRunningProducts(env = process.env) {
  const running = new Set()
  const pidsByProduct = {}
  for (const product of TRAE_PRODUCTS) {
    const pids = listProductPids(product, env)
    if (pids === null) return { unknown: true, running, pidsByProduct }
    if (pids.length > 0) {
      running.add(product)
      pidsByProduct[product] = pids
    }
  }
  return { unknown: false, running, pidsByProduct }
}

/**
 * 定位本机 storage.json。
 *
 * 次序(2026-10-28 修):显式指定 > **正在运行的客户端** > 有过登录态(信封)且最新 >
 * 其余里最新的。旧实现按产品名固定次序(Trae CN > TRAE SOLO CN > Trae)取第一个带信封的,
 * 多装时会把登录态写进没在用的那份 —— 用户重开客户端自然"没变化"。
 * 候选路径仍由 trae-auth-extract 的 traeUserDataDirs 提供(跨 profile 兜底,判据单源)。
 */
export function locateStorage(extract, targetStorage, opts = {}) {
  if (targetStorage) {
    const file = path.resolve(targetStorage)
    if (!fs.existsSync(file)) {
      throw new WriteError(`指定的 storage.json 不存在:${file}`, 'no-storage')
    }
    let mtime = -1
    try {
      mtime = fs.statSync(file).mtimeMs
    } catch {
      /* 取不到 mtime 不影响显式指定 */
    }
    return {
      file,
      explicit: true,
      product: productOfDir(path.basename(path.dirname(path.dirname(path.dirname(file))))),
      mtime,
    }
  }

  const running = opts.runningProducts ?? new Set()
  const tried = []
  const candidates = []
  for (const dir of extract.traeUserDataDirs()) {
    const file = path.join(dir, 'User', 'globalStorage', 'storage.json')
    tried.push(file)
    let mtime = -1
    try {
      mtime = fs.statSync(file).mtimeMs
    } catch {
      continue
    }
    let store
    try {
      store = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    candidates.push({
      file,
      dir,
      product: productOfDir(path.basename(dir)),
      hasSession: typeof store[SESSION_KEY] === 'string',
      mtime,
    })
  }
  if (candidates.length === 0) {
    throw new WriteError(
      `本机没找到 Trae 的 storage.json(试过 ${tried.length} 个落点:${tried.join(' | ')})`,
      'no-storage',
    )
  }
  const ranked = [...candidates].sort((a, b) => {
    const runA = a.product && running.has(a.product) ? 1 : 0
    const runB = b.product && running.has(b.product) ? 1 : 0
    if (runA !== runB) return runB - runA
    if (a.hasSession !== b.hasSession) return a.hasSession ? -1 : 1
    return b.mtime - a.mtime
  })
  const hit = ranked[0]
  return { file: hit.file, explicit: false, product: hit.product, mtime: hit.mtime }
}

/** 用池内凭证给模板打补丁(模板只提供 account 资料,凭证一律以参数为准) */
export function buildUserInfo(payload) {
  const userInfo = JSON.parse(JSON.stringify(payload.template))
  for (const key of CREDENTIAL_KEYS) delete userInfo[key]
  userInfo.token = payload.token
  userInfo.userId = payload.uid
  if (payload.refreshToken) userInfo.refreshToken = payload.refreshToken
  if (payload.expiresAt) userInfo.expiredAt = payload.expiresAt
  if (payload.refreshExpiresAt) userInfo.refreshExpiredAt = payload.refreshExpiresAt
  return userInfo
}

/** 同步等待(不 fork 子进程 —— 旧实现每轮 fork 一个 node,长轮询能起上千个) */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 原子写:临时文件写完再 rename(VSCode 自身也是这种写法,避免半截 JSON 被读)。
 * Windows 上目标文件常被扫描器/索引器/文件监视器短暂持有 ⇒ rename 偶发 EPERM/EBUSY,
 * 这里退避重试;超过预算才失败(失败时临时文件清掉,主文件保持原样)。
 */
function atomicWrite(file, text) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.storage.json.ihui-tmp-${process.pid}-${Date.now()}`)
  fs.writeFileSync(tmp, text, 'utf8')
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(tmp, file)
      return
    } catch (e) {
      const transient = ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(e?.code)
      if (transient && attempt < 12) {
        sleepSync(120)
        continue
      }
      try {
        fs.unlinkSync(tmp)
      } catch {
        /* 残留临时文件不影响主文件 */
      }
      throw e
    }
  }
}

export function applyLogin(extract, payload, opts = {}) {
  const env = opts.env ?? process.env
  /**
   * 探测**总是**做(只读 tasklist,不动任何进程):客户端在跑时盲写必被它的退出落盘覆写,
   * 所以"目标在跑却没带 restartClient"必须明确拒绝,而不是悄悄写一遍骗用户已生效。
   * 关闭/重新拉起才受 restartClient 约束 —— 手工 CLI/单测默认不碰进程,可经 opts 注入。
   */
  const manageProcess = payload.restartClient === true
  const probe = opts.probe ?? detectRunningProducts(env)
  if (probe.unknown && manageProcess) {
    // 服务端调用必须知道客户端在不在跑;探测不了就不写(见 lib/trae-client-process.mjs 头注)
    throw new WriteError(
      '无法探测本机 Trae 客户端进程(tasklist 不可用)⇒ 不写入,避免写入被运行中的客户端覆盖',
      'process-probe-failed',
    )
  }

  const target = locateStorage(extract, payload.targetStorage, { runningProducts: probe.running })
  const product = target.product

  // 写前关停:客户端退出时会用内存态刷回 storage.json,先写必被覆盖(2026-10-28 实测根因)
  let clientWasRunning = false
  let clientClosed = false
  let clientForced = false
  let exePath = ''
  if (product && probe.running.has(product)) {
    if (!manageProcess) {
      throw new WriteError(
        `本机 ${product} 正在运行:请先退出客户端再写入(运行中的客户端退出时会用内存态覆盖登录态;号池页的「登录本机」会自动关停并重开)`,
        'target-locked',
      )
    }
    clientWasRunning = true
    exePath = opts.exePath ?? (opts.resolveExe ?? resolveProductExe)(product, env)
    const doClose = opts.closeProduct ?? closeProduct
    const closed = doClose(product, {
      env,
      pids: probe.pidsByProduct?.[product],
      waitMs: Number(opts.closeWaitMs ?? 15_000),
    })
    if (!closed.closed) {
      throw new WriteError(
        `${product} 正在运行且无法关闭(已尝试优雅关闭与强制结束,进程仍未退出)⇒ 未写入,请手动退出客户端后重试`,
        'target-locked',
      )
    }
    clientClosed = true
    clientForced = closed.forced === true
  }

  let outcome
  try {
    const raw = fs.readFileSync(target.file, 'utf8')
    let store
    try {
      store = JSON.parse(raw)
    } catch {
      throw new WriteError(`storage.json 不是合法 JSON:${target.file}`, 'storage-shape')
    }
    if (!store || typeof store !== 'object' || Array.isArray(store)) {
      throw new WriteError(`storage.json 顶层不是对象:${target.file}`, 'storage-shape')
    }

    // 现役 uid 只用于回报与回滚提示;解不开(首次使用/密钥轮换)不阻塞写入
    let replacedUid = null
    if (typeof store[SESSION_KEY] === 'string') {
      try {
        const prev = JSON.parse(extract.decryptEnvelope(store[SESSION_KEY]))
        replacedUid = prev?.userId === undefined || prev?.userId === null ? null : String(prev.userId)
      } catch {
        replacedUid = null
      }
    }

    const userInfo = buildUserInfo(payload)
    const envelope = extract.encryptEnvelope(JSON.stringify(userInfo))

    // 设备信封:只在池内该号确有设备材料、且本机尚无该 deviceId 时补写(绝不覆盖本机现役)
    const deviceKeyId = /^\d{6,}$/.test(payload.deviceId) ? payload.deviceId : ''
    const deviceKey = deviceKeyId ? `${DEVICE_KEY_PREFIX}${deviceKeyId}` : ''
    let deviceEnvelopePresent = false
    let deviceEnvelopeWritten = false
    if (deviceKey && typeof store[deviceKey] === 'string') {
      deviceEnvelopePresent = true
    } else if (deviceKey && payload.deviceKeyPem && payload.devicePubPem) {
      store[deviceKey] = extract.encryptEnvelope(
        JSON.stringify({ privateKeyPEM: payload.deviceKeyPem, publicKeyPEM: payload.devicePubPem }),
      )
      deviceEnvelopeWritten = true
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = `${target.file}.ihui-login-${stamp}.bak`
    fs.copyFileSync(target.file, backupFile)

    store[SESSION_KEY] = envelope
    atomicWrite(target.file, JSON.stringify(store))

    // 写后自检:从落盘文件解回,uid 必须就是目标(防止写入被并发覆写/信封写坏)
    let readBackUid = ''
    try {
      const after = JSON.parse(fs.readFileSync(target.file, 'utf8'))
      readBackUid = String(JSON.parse(extract.decryptEnvelope(after[SESSION_KEY]))?.userId ?? '')
    } catch {
      readBackUid = ''
    }
    if (readBackUid !== payload.uid) {
      throw new WriteError(
        `写后自检失败:落盘信封解出的 userId(${readBackUid || '空'})≠ 目标 ${payload.uid}`,
        'verify-failed',
      )
    }

    outcome = {
      ok: true,
      storageFile: target.file,
      storageExplicit: target.explicit,
      backupFile,
      replacedUid,
      uid: payload.uid,
      deviceEnvelopePresent,
      deviceEnvelopeWritten,
      deviceId: deviceKeyId || null,
      clientProduct: product || '',
      clientWasRunning,
      clientClosed,
      clientForced,
      clientRestarted: false,
      clientLaunchError: '',
      restartHint: '',
    }
  } finally {
    // 写失败也要把客户端拉回来(用户可能正用它)——只在"是我们关的"情况下
    if (clientClosed) {
      const doLaunch = opts.launchProduct ?? launchProduct
      const launched = doLaunch(exePath, {
        env,
        helperPath: opts.helperPath ?? RUN_AS_USER_SCRIPT,
        product,
        verifyWaitMs: opts.verifyLaunchWaitMs,
      })
      if (outcome) {
        outcome.clientRestarted = launched.launched
        outcome.clientLaunchError = launched.error
        outcome.restartHint = launched.launched
          ? `已${clientForced ? '强制' : ''}关闭并重新打开 ${product} 客户端,登录态即时生效`
          : `已关闭 ${product},但未能自动重新打开(${launched.error || '未判定'});请手动打开客户端`
      }
    }
  }
  if (!outcome.restartHint) {
    outcome.restartHint = probe.unknown
      ? '未能探测客户端进程状态:若客户端正在运行,请手动退出后重新打开才会生效'
      : '客户端当时未运行,直接打开 Trae 即为新登录态'
  }
  return outcome
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function printSummary(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  process.stdout.write(
    `✅ 已把 uid=${result.uid} 的登录态写进本机 Trae\n` +
      `   落点: ${result.storageFile}\n` +
      `   备份: ${result.backupFile}\n` +
      `   替换前登录: ${result.replacedUid ?? '(原信封解不开或无登录态)'}\n` +
      (result.clientWasRunning ? `   写前已关停客户端(${result.clientProduct})\n` : '') +
      (result.deviceEnvelopeWritten ? `   已补写设备信封(deviceId=${result.deviceId})\n` : '') +
      `   ${result.restartHint}\n`,
  )
}

export async function main(argv) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(
      '用法: node scripts/trae-login-local.mjs --stdin [--json]\n' +
        'stdin JSON: { uid, token, refreshToken?, expiresAt?, refreshExpiresAt?, sessionTemplate,\n' +
        '              deviceId?, deviceKeyPem?, devicePubPem?, targetStorage? }\n',
    )
    return 0
  }
  if (options.error) {
    process.stderr.write(`❌ ${options.error}\n`)
    return 2
  }

  let payloadText
  try {
    payloadText = await readStdin()
  } catch (e) {
    process.stderr.write(`❌ 读标准输入失败(未判定): ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
  if (!payloadText.trim()) {
    process.stderr.write('❌ 标准输入为空(未判定)\n')
    return 2
  }

  const extract = await import(pathToFileURL(EXTRACT_LIB).href)
  let payload
  try {
    payload = normalizePayload(JSON.parse(payloadText))
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'payload-shape'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }

  try {
    const result = applyLogin(extract, payload)
    printSummary(result, options.json)
    return 0
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'write-failed'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 1
  }
}

// 只有被当脚本直接跑才执行(测试 import 时不触发,免得吃掉测试进程的 stdin)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}

export const __test__ = {
  parseArgs,
  normalizePayload,
  buildUserInfo,
  locateStorage,
  applyLogin,
  detectRunningProducts,
  WriteError,
  SESSION_KEY,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
