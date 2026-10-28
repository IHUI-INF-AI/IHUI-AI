// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 桌面版「一键切号」写回执行端(2026-10-28 立)。
 *
 * 立因:号池保活账号后,要把池内凭证写回本机 WorkBuddy 的登录会话文件
 * (%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\workbuddy-desktop[-ai.info])。
 * 该文件是明文 JSON 骨架 + 字段级 $wbEncrypted 信封(AES-256-GCM,AAD=buildFieldAad(keyId)),
 * 密钥只在运行中的主进程里 ⇒ 次序必须是:定位主进程 → 开 inspector 取 at-rest key →
 * 内存组树重封 → 关客户端 → 备份 → 原子写 → 写后自检 → 拉起客户端。
 * 客户端没在跑且载荷 restartClient:true(服务层恒传)⇒ 冷启动:脚本自己拉起 →
 * 轮询"主进程出现 + bootstrap 可读"(预算 25s)→ 带着 bootstrap 续跑原流程;拉不起/超时
 * 仍按 not-running 退出码 2 拒绝写回。
 *
 * 链路:apps/api 路由 → stdin JSON → 本脚本。
 *
 *   node scripts/workbuddy-login-local.mjs --stdin [--json] [--dry-run]
 *
 * stdin 载荷契约(服务端按此传,键名不得擅改):
 * { uid, edition:'workbuddy'|'workbuddy-ai', sessionTemplate, sealedPaths,
 *   credentials:{accessToken,refreshToken}, expiry:{expiresAt,refreshExpiresAt}, restartClient }
 *
 * 安全:
 * - 凭证只在调用方进程与本次写盘之间流动,任何输出都不含 token/refreshToken/密钥明文;
 * - 写前必留同目录备份(<file>.ihui-login-<epoch>.bak),写后自检失败自动还原;
 * - 模板 account.uid 与目标 uid 不一致时拒绝写入(防止拿错号的模板写成别人)。
 *
 * 退出码:0 成功 / 1 写入失败(含写后自检失败) / 2 未判定(参数·环境·进程裁决·写前拒绝)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  AUTH_DIR,
  AUTH_FILE_BY_EDITION,
  WB_CREDENTIAL_PATHS,
  decryptSessionTree,
  listWorkbuddyMainProcesses,
  normalizeAtRestKey,
  readAtRestBootstrap,
  resolveEdition,
  sealFieldForTest,
} from './lib/workbuddy-auth-extract.mjs'
import { closeProduct, launchProduct, resolveProductExe } from './lib/trae-client-process.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** 服务身份下重新拉起客户端要换桌面用户身份(CreateProcessAsUser) */
const RUN_AS_USER_SCRIPT = path.join(HERE, '..', 'apps', 'api', 'scripts', 'run-as-user.ps1')
/** WorkBuddy 主进程镜像名 = `${PRODUCT}.exe`(实测安装于 G:\workbuddy\WorkBuddy.exe) */
const PRODUCT = 'WorkBuddy'
const CLOSE_WAIT_MS = 20_000
const RESTART_HINT = 'WorkBuddy 已自动重启;若未自动打开请手动启动 WorkBuddy'
/** 冷启动(2026-10-28 立):主进程没在跑时脚本自己拉起,轮询就绪的总预算(服务层超时 150s,别超) */
const COLD_LAUNCH_BUDGET_MS = 25_000
const COLD_LAUNCH_POLL_MS = 1_000
const COLD_LAUNCH_VERIFY_WAIT_MS = 3_000

export class WriteError extends Error {
  constructor(message, code = 'write-failed') {
    super(message)
    this.name = 'WriteError'
    this.code = code
  }
}

export function parseArgs(argv) {
  const options = { stdin: false, json: false, dryRun: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--stdin') options.stdin = true
    else if (a === '--json') options.json = true
    else if (a === '--dry-run') options.dryRun = true
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

/** 读取 payload 并做形状/uid 校验(步骤 1-2) */
export function normalizePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WriteError('stdin 必须是 JSON 对象(未判定)', 'payload-shape')
  }
  const uid = asText(raw.uid)
  const edition = asText(raw.edition)
  if (!uid) throw new WriteError('缺 uid(未判定)', 'payload-shape')
  if (edition !== 'workbuddy' && edition !== 'workbuddy-ai') {
    throw new WriteError(`edition 必须是 workbuddy 或 workbuddy-ai(收到 "${edition}")`, 'payload-shape')
  }
  const template = raw.sessionTemplate
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    throw new WriteError(
      '该号没有会话模板(导入时未采集本机登录态)⇒ 无法写回本机,请先在本机登录该号后重新一键入池',
      'no-template',
    )
  }
  const sealedPaths = raw.sealedPaths
  if (
    !Array.isArray(sealedPaths) ||
    sealedPaths.length === 0 ||
    sealedPaths.some((p) => typeof p !== 'string' || !p)
  ) {
    throw new WriteError('sealedPaths 必须是非空字符串数组(本机字段密封面,未判定)', 'no-sealed-paths')
  }
  const credentials =
    raw.credentials && typeof raw.credentials === 'object' && !Array.isArray(raw.credentials)
      ? raw.credentials
      : {}
  const accessToken = asText(credentials.accessToken)
  if (!accessToken) throw new WriteError('credentials.accessToken 缺失(未判定)', 'payload-shape')
  const expiry = raw.expiry && typeof raw.expiry === 'object' && !Array.isArray(raw.expiry) ? raw.expiry : {}
  const tplUid =
    template.account?.uid === undefined || template.account?.uid === null ? '' : String(template.account.uid)
  if (tplUid !== uid) {
    throw new WriteError(
      `会话模板的 account.uid(${tplUid || '空'})与目标 uid(${uid})不一致 ⇒ 拒绝写入(模板与账号错配)`,
      'template-uid-mismatch',
    )
  }
  return {
    uid,
    edition,
    template,
    /** 凭证两路径强制并入密封面:绝不把 token 明文落盘,哪怕调用方漏传 */
    sealedPaths: [...new Set([...sealedPaths, ...WB_CREDENTIAL_PATHS])],
    credentials: { accessToken, refreshToken: asText(credentials.refreshToken) },
    expiresAt: asIso(expiry.expiresAt),
    refreshExpiresAt: asIso(expiry.refreshExpiresAt),
    restartClient: raw.restartClient === true,
  }
}

/** `accounts[0].nickname` → ['accounts',0,'nickname'];形状不合法 ⇒ null */
function parseSealedPath(p) {
  const segs = []
  for (const part of String(p).split('.')) {
    const m = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part)
    if (!m) return null
    segs.push(m[1])
    for (const idx of m[2].match(/\[\d+\]/g) ?? []) segs.push(Number(idx.slice(1, -1)))
  }
  return segs.length ? segs : null
}

function getPathValue(node, segs) {
  let cur = node
  for (const s of segs) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[s]
  }
  return cur
}

function setPathValue(root, segs, value) {
  let cur = root
  for (let i = 0; i < segs.length - 1; i += 1) cur = cur[segs[i]]
  cur[segs[segs.length - 1]] = value
}

/**
 * 内存组树 + 重封(步骤 6-7,纯函数可离线测):
 * 深拷贝模板 → 打凭证/expiry 补丁(数值时刻 = epoch 毫秒,expiresIn/refreshExpiresIn = 秒剩余,
 * lastRefreshTime = now)→ 对每个密封路径取值重封为信封。
 * 凭证两路径的值来自 credentials,不算模板缺值;其余路径不可达或值非 string ⇒ template-shape。
 */
export function buildSealedTree(payload, { key, keyId, nowMs = Date.now() }) {
  const tree = JSON.parse(JSON.stringify(payload.template))
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    throw new WriteError('会话模板顶层不是对象 ⇒ 无法写回', 'template-shape')
  }
  const auth = tree.auth
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw new WriteError('会话模板缺少 auth 节点 ⇒ 无法写回', 'template-shape')
  }
  auth.accessToken = payload.credentials.accessToken
  auth.refreshToken = payload.credentials.refreshToken
  if (payload.expiresAt) {
    const ms = Date.parse(payload.expiresAt)
    auth.expiresAt = ms
    auth.expiresIn = Math.floor((ms - nowMs) / 1000)
  }
  if (payload.refreshExpiresAt) {
    const ms = Date.parse(payload.refreshExpiresAt)
    auth.refreshExpiresAt = ms
    auth.refreshExpiresIn = Math.floor((ms - nowMs) / 1000)
  }
  auth.lastRefreshTime = nowMs
  for (const p of payload.sealedPaths) {
    const segs = parseSealedPath(p)
    const value = segs ? getPathValue(tree, segs) : undefined
    if (typeof value !== 'string') {
      throw new WriteError(
        `密封路径 ${p} 在模板里不可达或值不是字符串 ⇒ 无法重封(模板与本机密封面形状不符)`,
        'template-shape',
      )
    }
    setPathValue(tree, segs, sealFieldForTest(value, key, keyId))
  }
  return tree
}

function powershellCandidates(env) {
  const list = []
  const override = String(env.IHUI_PWSH_PATH ?? '').trim()
  if (override) list.push(override)
  const pf = String(env.ProgramFiles ?? '').trim() || 'C:\\Program Files'
  for (const rel of [['PowerShell', '7', 'pwsh.exe'], ['PowerShell', '6', 'pwsh.exe']]) {
    list.push(path.join(pf, ...rel))
  }
  list.push(path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'))
  return list.filter((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })
}

/** 关闭客户端**之前**用 CIM 按主 pid 取 ExecutablePath(供写后原样拉起);拿不到 ⇒ ''(如实回报) */
export function queryMainExePath(pid, env = process.env) {
  const num = Number(pid)
  if (!Number.isInteger(num) || num <= 0) return ''
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' +
    `(Get-CimInstance Win32_Process -Filter "ProcessId=${num}").ExecutablePath`
  for (const ps of powershellCandidates(env)) {
    try {
      const out = execFileSync(
        ps,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', windowsHide: true, timeout: 12_000, env },
      )
      const line = String(out).trim().split(/\r?\n/)[0] ?? ''
      if (line) return line
    } catch {
      /* 换下一个候选 shell */
    }
  }
  return ''
}

/**
 * WorkBuddy exe 注册表兜底(2026-10-28 冷启动实弹修正):resolveProductExe 只扫标准安装根,
 * 而 WorkBuddy 可装任意盘(实测 G:\workbuddy,卸载项 InstallLocation 还是空)。卸载项
 * DisplayIcon 是权威来源(实测 "G:\workbuddy\WorkBuddy.exe,0")。只认以 workbuddy.exe
 * 结尾且真实存在的路径(workbuddy-switch 等同名条目被拒)。找不到 ⇒ ''(调用方如实回报)。
 */
export function resolveWorkbuddyExeFromRegistry(env = process.env) {
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8;' +
    "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'," +
    "'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' |" +
    " Where-Object DisplayName -like '*WorkBuddy*' | Select-Object -ExpandProperty DisplayIcon"
  for (const ps of powershellCandidates(env)) {
    try {
      const out = execFileSync(
        ps,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', windowsHide: true, timeout: 12_000, env },
      )
      for (const line of String(out).split(/\r?\n/)) {
        const cleaned = line.trim().replace(/,\d+\s*$/, '').replace(/^"+|"+$/g, '').trim()
        if (!/workbuddy\.exe$/i.test(cleaned)) continue
        try {
          if (fs.existsSync(cleaned)) return cleaned
        } catch {
          /* 无权限探测的路径一律不认 */
        }
      }
    } catch {
      /* 换下一个候选 shell */
    }
  }
  return ''
}

/** 同步等待:Atomics.wait 不 fork 子进程(同 trae-login-local) */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** 原子写:同目录 tmp + rename;Windows 上 rename 偶发 EPERM/EBUSY ⇒ 退避重试 */
function atomicWrite(file, text) {
  const dir = path.dirname(file)
  const tmp = path.join(dir, `.${path.basename(file)}.ihui-tmp-${process.pid}-${Date.now()}`)
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

/** 写前"未判定"族:参数/环境/进程裁决/写前拒绝 ⇒ 退出码 2(什么都没写过) */
export const UNDETERMINED_CODES = Object.freeze([
  'payload-shape',
  'no-template',
  'no-sealed-paths',
  'template-uid-mismatch',
  'not-running',
  'ambiguous-process',
  'edition-mismatch',
  'target-locked',
  'template-shape',
])

export function exitCodeFor(e) {
  const code = e && typeof e.code === 'string' ? e.code : ''
  if (code && UNDETERMINED_CODES.includes(code)) return 2
  if (e && e.name === 'ExtractError') return 2 // inspector/取密钥失败:未写入,环境未判定
  return 1
}

/** 异步等待(冷启动轮询用;取 bootstrap 本身是异步,不能走 sleepSync) */
function sleepAsync(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 冷启动探路(2026-10-28 立):客户端没在跑但服务层授权了重启 ⇒ 脚本自己拉起,
 * 轮询到"主进程出现且 inspector 能读到 at-rest bootstrap"为止(总预算 budgetMs)。
 * 成功时把 bootstrap 一并带回(外层复用,免得二次开 inspector);失败只给原因文本,绝不带密钥。
 */
async function coldLaunchAndProbe(deps) {
  const {
    listMains,
    readBootstrap,
    launchImpl,
    resolveExe,
    resolveExeRegistry,
    env,
    helperPath,
    budgetMs,
    pollMs,
    verifyWaitMs,
  } = deps
  /** 标准安装根找不到 ⇒ 注册表卸载项 DisplayIcon 兜底(自定义盘符安装,实测 G:\workbuddy) */
  const exePath = resolveExe(PRODUCT, env) || resolveExeRegistry(env)
  if (!exePath) return { ok: false, reason: '找不到 WorkBuddy 可执行文件' }
  const launched = launchImpl(exePath, { env, helperPath, product: PRODUCT, verifyWaitMs })
  if (!launched.launched) return { ok: false, reason: launched.error || '启动命令未生效' }
  const deadline = Date.now() + budgetMs
  for (;;) {
    const list = listMains()
    if (Array.isArray(list) && list.length > 0) {
      try {
        const bootstrap = await readBootstrap(list[0].pid)
        if (bootstrap && typeof bootstrap.atRestSecretKey === 'string' && bootstrap.atRestSecretKey) {
          return { ok: true, mains: list, bootstrap }
        }
      } catch {
        /* 进程刚起,inspector 还没挂上 ⇒ 继续等 */
      }
    }
    const left = deadline - Date.now()
    if (left <= 0) return { ok: false, reason: `拉起后 ${Math.round(budgetMs / 1000)} 秒内未就绪` }
    await sleepAsync(Math.min(pollMs, left))
  }
}

/**
 * 主编排(步骤 3-11)。进程面/inspector/落盘根一律可经 opts 注入 —— 单测全离线。
 * @param {object} payload normalizePayload 的产物
 */
export async function applyLoginWb(payload, opts = {}) {
  const env = opts.env ?? process.env
  const nowMs = Number(opts.nowMs) || Date.now()
  const listMains = opts.listMains ?? listWorkbuddyMainProcesses
  const resolveEd = opts.resolveEdition ?? resolveEdition
  const readBootstrap = opts.readBootstrap ?? readAtRestBootstrap
  const queryExe = opts.queryMainExePath ?? queryMainExePath
  const closeImpl = opts.closeProduct ?? closeProduct
  const launchImpl = opts.launchProduct ?? launchProduct
  const resolveExe = opts.resolveProductExe ?? resolveProductExe
  const resolveExeRegistry = opts.resolveWorkbuddyExeRegistry ?? resolveWorkbuddyExeFromRegistry
  const decryptImpl = opts.decryptSessionTree ?? decryptSessionTree
  const authDir = opts.authDir ?? AUTH_DIR
  const dryRun = opts.dryRun === true

  // 3. 进程裁决 + 版本裁决(主进程必须唯一,且与 payload.edition 一致)
  //    没在跑但载荷授权了重启(服务层恒 restartClient:true)⇒ 冷启动:脚本自己拉起 →
  //    轮询"主进程出现 + bootstrap 可读"就绪 → 带着 bootstrap 续跑原流程(反正马上要关)
  const entryMains = listMains()
  const clientWasRunning = Array.isArray(entryMains) && entryMains.length > 0
  let mains = entryMains
  let coldLaunched = false
  let coldBootstrap = null
  if (!clientWasRunning && payload.restartClient === true) {
    const cold = await coldLaunchAndProbe({
      listMains,
      readBootstrap,
      launchImpl,
      resolveExe,
      resolveExeRegistry,
      env,
      helperPath: opts.helperPath ?? RUN_AS_USER_SCRIPT,
      budgetMs: Number(opts.coldLaunchBudgetMs) || COLD_LAUNCH_BUDGET_MS,
      pollMs: Number(opts.coldLaunchPollMs) || COLD_LAUNCH_POLL_MS,
      verifyWaitMs: Number(opts.coldLaunchVerifyWaitMs) || COLD_LAUNCH_VERIFY_WAIT_MS,
    })
    if (!cold.ok) {
      throw new WriteError(
        `自动拉起 WorkBuddy 失败(${cold.reason})⇒ 请手动打开 WorkBuddy 后重试`,
        'not-running',
      )
    }
    mains = cold.mains
    coldBootstrap = cold.bootstrap
    coldLaunched = true
  }
  if (!Array.isArray(mains) || mains.length === 0) {
    throw new WriteError(
      '未发现运行中的 WorkBuddy 主进程 ⇒ 取不到本机主密钥;请先启动 WorkBuddy 并登录后再切号',
      'not-running',
    )
  }
  if (mains.length > 1) {
    throw new WriteError(
      `发现 ${mains.length} 个 WorkBuddy 主进程,不确定取哪一个;请只保留一个再重试`,
      'ambiguous-process',
    )
  }
  const { pid, userDataDir } = mains[0]
  const detected = resolveEd(userDataDir)
  if (detected !== payload.edition) {
    throw new WriteError(
      `运行中客户端的版本(${detected ?? '判不出'})与载荷 edition(${payload.edition})不一致 ⇒ 拒绝写入`,
      'edition-mismatch',
    )
  }

  // 4. 目标文件与被替换号(文件不存在可以写新文件;另一 edition 的文件存在 ⇒ 提示换 edition)
  const targetFile = path.join(authDir, AUTH_FILE_BY_EDITION[payload.edition])
  const otherEdition = payload.edition === 'workbuddy' ? 'workbuddy-ai' : 'workbuddy'
  const otherFile = path.join(authDir, AUTH_FILE_BY_EDITION[otherEdition])
  const fileExists = fs.existsSync(targetFile)
  if (!fileExists && fs.existsSync(otherFile)) {
    throw new WriteError(
      `${targetFile} 不存在,但另一 edition(${otherEdition})的登录文件存在 ⇒ 本机在用的可能是另一版,请用对应 edition 重试`,
      'edition-mismatch',
    )
  }
  let replacedUid = null
  if (fileExists) {
    try {
      const cur = JSON.parse(fs.readFileSync(targetFile, 'utf8'))
      const v = cur?.account?.uid
      replacedUid = v === undefined || v === null ? null : String(v)
    } catch {
      replacedUid = null // 现役文件已损坏:覆盖写回照常,备份照留
    }
  }

  // 5. 关闭客户端之前:抓 exe 路径(供重启)+ 开 inspector 取本机主密钥
  //    (冷启动探路已经读到 bootstrap ⇒ 直接复用,不再二次开 inspector)
  const exePath = queryExe(pid, env)
  const bootstrap = coldBootstrap ?? (await readBootstrap(pid))
  const { key, keyId } = normalizeAtRestKey(bootstrap.atRestSecretKey)

  try {
    // 6-7. 内存组树 + 逐路径重封,并先做一次内存自检(不合规不碰进程/磁盘)
    const sealedTree = buildSealedTree(payload, { key, keyId, nowMs })
    const preview = decryptImpl(sealedTree, key, keyId)
    if (
      preview?.auth?.accessToken !== payload.credentials.accessToken ||
      String(preview?.account?.uid ?? '') !== payload.uid
    ) {
      throw new WriteError('内存重封自检失败:封好的树解不回目标凭证/uid ⇒ 未写入', 'template-shape')
    }

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        uid: payload.uid,
        edition: payload.edition,
        targetFile,
        backupFile: '',
        replacedUid,
        clientWasRunning,
        coldLaunched,
        sealedPaths: payload.sealedPaths,
        restartHint: 'dry-run:仅内存组树并重封校验,未关客户端、未写盘',
      }
    }

    // 8. 客户端此刻必然在跑(步骤 5 依赖它)⇒ 未授权重启就拒绝写;授权了先关
    if (payload.restartClient !== true) {
      throw new WriteError(
        'WorkBuddy 正在运行:直接写登录态必被它退出时的落盘覆写。号池「一键切号」会自动关停并重开;手工 CLI 请在载荷里传 restartClient:true,或先退出 WorkBuddy',
        'target-locked',
      )
    }
    let clientClosed = false
    let clientForced = false
    let outcome = null
    try {
      const closed = closeImpl(PRODUCT, { env, waitMs: Number(opts.closeWaitMs ?? CLOSE_WAIT_MS) })
      if (!closed.closed) {
        throw new WriteError(
          'WorkBuddy 正在运行且无法关闭(已尝试优雅关闭与强制结束,进程仍未退出)⇒ 未写入,请手动退出客户端后重试',
          'target-locked',
        )
      }
      clientClosed = true
      clientForced = closed.forced === true

      // 9. 备份(存在才备)→ 原子写
      const backupFile = fileExists ? `${targetFile}.ihui-login-${Date.now()}.bak` : ''
      if (backupFile) fs.copyFileSync(targetFile, backupFile)
      try {
        atomicWrite(targetFile, JSON.stringify(sealedTree))
        // 10. 写后自检:重读落盘文件,用同一把 key 解回,凭证与 uid 必须都对得上
        const after = JSON.parse(fs.readFileSync(targetFile, 'utf8'))
        const opened = decryptImpl(after, key, keyId)
        if (
          opened?.auth?.accessToken !== payload.credentials.accessToken ||
          String(opened?.account?.uid ?? '') !== payload.uid
        ) {
          throw new WriteError(
            `写后自检失败:落盘登录态解不回目标凭证/uid ⇒ 已还原备份(备份:${backupFile || '无(新文件,已删除)'})`,
            'write-verify',
          )
        }
      } catch (e) {
        if (backupFile) {
          try {
            fs.copyFileSync(backupFile, targetFile)
          } catch {
            /* 还原失败:备份仍在原位,可人工回滚 */
          }
        } else {
          try {
            fs.rmSync(targetFile, { force: true })
          } catch {
            /* 删不掉也如实带着 write-verify 抛出去 */
          }
        }
        throw e
      }

      outcome = {
        ok: true,
        uid: payload.uid,
        edition: payload.edition,
        targetFile,
        backupFile,
        replacedUid,
        clientWasRunning,
        coldLaunched,
        clientClosed,
        clientForced,
        clientRestarted: false,
        clientLaunchError: '',
        restartHint: RESTART_HINT,
      }
    } finally {
      // 11. 是我们关的就要拉回来(写失败也不能把用户客户端丢下);拉起失败只记不翻成功
      if (clientClosed) {
        const launched = launchImpl(exePath, {
          env,
          helperPath: opts.helperPath ?? RUN_AS_USER_SCRIPT,
          product: PRODUCT,
          verifyWaitMs: opts.verifyLaunchWaitMs,
        })
        if (outcome) {
          outcome.clientRestarted = launched.launched
          outcome.clientLaunchError = launched.error
        }
      }
    }
    return outcome
  } finally {
    // 密钥用完即焚(自检已复用同一把 key,这里统一归零)
    key.fill(0)
  }
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
  if (result.dryRun) {
    process.stdout.write(
      `🧪 dry-run:内存组树+重封校验通过(未关客户端、未写盘)\n` +
        `   目标: ${result.targetFile}\n` +
        `   替换前登录: ${result.replacedUid ?? '(无现役登录态)'}\n` +
        `   密封路径 ${result.sealedPaths.length} 条\n`,
    )
    return
  }
  process.stdout.write(
    `✅ 已把 uid=${result.uid} 的登录态写进本机 WorkBuddy(${result.edition})\n` +
      `   落点: ${result.targetFile}\n` +
      `   备份: ${result.backupFile || '(原本没有登录文件,未备份)'}\n` +
      `   替换前登录: ${result.replacedUid ?? '(现役文件无 uid 或不可读)'}\n` +
      `   ${result.restartHint}\n`,
  )
}

export async function main(argv) {
  const options = parseArgs(argv)
  if (options.help) {
    process.stdout.write(
      '用法: node scripts/workbuddy-login-local.mjs --stdin [--json] [--dry-run]\n' +
        'stdin JSON: { uid, edition, sessionTemplate, sealedPaths, credentials:{accessToken,refreshToken},\n' +
        '            expiry:{expiresAt,refreshExpiresAt}, restartClient }\n',
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

  let payload
  try {
    payload = normalizePayload(JSON.parse(payloadText))
  } catch (e) {
    const code = e instanceof WriteError ? e.code : 'payload-shape'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }

  try {
    const result = await applyLoginWb(payload, { dryRun: options.dryRun })
    printSummary(result, options.json)
    return 0
  } catch (e) {
    const code = e && typeof e.code === 'string' ? e.code : 'write-failed'
    process.stderr.write(`❌ [${code}] ${e instanceof Error ? e.message : String(e)}\n`)
    return exitCodeFor(e)
  }
}

// 只有被当脚本直接跑才执行(测试 import 时不触发,免得吃掉测试进程的 stdin)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}

export const __test__ = {
  parseArgs,
  normalizePayload,
  buildSealedTree,
  applyLoginWb,
  queryMainExePath,
  exitCodeFor,
  UNDETERMINED_CODES,
  WriteError,
  RESTART_HINT,
  PRODUCT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
