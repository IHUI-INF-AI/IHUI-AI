// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 本机会话盘点速查(2026-10-27 立,⑦会话搬家第一刀·只读)。
 *
 *   pnpm relay:sessions                 # 盘点本机 WorkBuddy 登录态 + 会话库 + wb-switch 面
 *   pnpm relay:sessions -- --json       # 机器可读
 *
 * 取证依据(2026-10-27 一手,见 docs/RELAY_SESSION_MIGRATION_EVIDENCE.md):
 * 本地会话面共三处 —— ①桌面登录态 %LOCALAPPDATA%/CodeBuddyExtension/Data/Public/auth/
 * workbuddy-desktop.info;②WorkBuddy 助手会话库 ~/.workbuddy/workspace/sessions/<uuid>/
 * 与 ~/.workbuddy/projects/<workspace>/ 转写;③wb-switch 面 ~/.wb-switch(accounts.json /
 * backups)与 %LOCALAPPDATA%/workbuddy-switch(会话链接台账 *_session_links.json)。
 *
 * 铁律:零写入 / 零上游请求 / 永不回显 token 与任何消息内容(只给计数、uid、域、形态、
 * 时间与判定话术)。会话搬家(搬移/写回/删除)不在本器射程 —— 隐私删除链设计先行(⑦定案)。
 * 退出码:0 盘到至少一处面 / 2 三处面全不可读(未判定)。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 盘点器的根路径集合(默认本机真实面;测试注入 fixture 目录) */
export interface SessionInspectPaths {
  /** 桌面登录态文件(workbuddy-desktop.info) */
  authFile: string
  /** WorkBuddy 助手 workspace/sessions 根 */
  sessionsRoot: string
  /** WorkBuddy 助手 projects 根(每工作区一目录) */
  projectsRoot: string
  /** wb-switch 状态根(~/.wb-switch) */
  wbSwitchDir: string
  /** wb-switch 安装根(%LOCALAPPDATA%/workbuddy-switch) */
  wbSwitchAppDir: string
}

export function defaultInspectPaths(): SessionInspectPaths {
  const home = homedir()
  // LOCALAPPDATA 可能被沙盒/便携环境重定向:双候选探测,登录态真实所在的候选优先
  const localCandidates = [
    process.env['LOCALAPPDATA'] ?? '',
    join(home, 'AppData', 'Local'),
  ].filter((p) => p.length > 0)
  const authRelative = join(
    'CodeBuddyExtension',
    'Data',
    'Public',
    'auth',
    'workbuddy-desktop.info',
  )
  let localAppData = localCandidates[0] ?? join(home, 'AppData', 'Local')
  for (const candidate of localCandidates) {
    if (existsSync(join(candidate, authRelative))) {
      localAppData = candidate
      break
    }
  }
  return {
    authFile: join(localAppData, authRelative),
    sessionsRoot: join(home, '.workbuddy', 'workspace', 'sessions'),
    projectsRoot: join(home, '.workbuddy', 'projects'),
    wbSwitchDir: join(home, '.wb-switch'),
    wbSwitchAppDir: join(localAppData, 'workbuddy-switch'),
  }
}

/** 登录态文件的脱敏投影(永不携带 token 原文) */
export interface AuthFileInfo {
  present: boolean
  uid: string | null
  domain: string | null
  /** jwt=可读有效期 / envelope=$wbEncrypted 同机可解 / opaque=不透明串 */
  tokenShape: 'jwt' | 'envelope' | 'opaque' | 'missing'
  expiresAt: string | null
  remainingDays: number | null
  /** 昵称字段是否为同机加密信封(不尝试解密) */
  nicknameEncrypted: boolean
  accountCount: number | null
}

export function inspectAuthFileInfo(raw: string | null, now: number): AuthFileInfo {
  if (raw === null) {
    return {
      present: false,
      uid: null,
      domain: null,
      tokenShape: 'missing',
      expiresAt: null,
      remainingDays: null,
      nicknameEncrypted: false,
      accountCount: null,
    }
  }
  let j: Record<string, unknown>
  try {
    j = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {
      present: false,
      uid: null,
      domain: null,
      tokenShape: 'missing',
      expiresAt: null,
      remainingDays: null,
      nicknameEncrypted: false,
      accountCount: null,
    }
  }
  const auth = (j['auth'] ?? {}) as Record<string, unknown>
  const account = (j['account'] ?? {}) as Record<string, unknown>
  const accounts = Array.isArray(j['accounts']) ? (j['accounts'] as unknown[]) : null
  const token = auth['accessToken']
  const isEnvelopeToken =
    (typeof token === 'object' && token !== null) ||
    (typeof token === 'string' && token.startsWith('$wbEncrypted'))
  const shape: AuthFileInfo['tokenShape'] = isEnvelopeToken
    ? 'envelope'
    : typeof token !== 'string' || token.length === 0
      ? 'missing'
      : token.split('.').length === 3
        ? 'jwt'
        : 'opaque'
  const expiresAt = typeof auth['expiresAt'] === 'string' ? auth['expiresAt'] : null
  const expMs = expiresAt !== null ? Date.parse(expiresAt) : Number.NaN
  const isEnvelope = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && '$wbEncrypted' in (v as Record<string, unknown>)
  return {
    present: true,
    uid: typeof account['uid'] === 'string' ? (account['uid'] as string) : null,
    domain: typeof auth['domain'] === 'string' ? (auth['domain'] as string) : null,
    tokenShape: shape,
    expiresAt,
    remainingDays:
      Number.isFinite(expMs) && expMs > 0 ? Math.ceil((expMs - now) / 86_400_000) : null,
    nicknameEncrypted: isEnvelope(account['nickname']),
    accountCount: accounts ? accounts.length : null,
  }
}

/** 会话库计数投影 */
export interface SessionStoreInfo {
  present: boolean
  /** workspace/sessions 下的会话目录数 */
  sessionDirs: number
  /** projects 下的工作区目录数 */
  projectWorkspaces: number
  /** projects 下 .jsonl 转写文件总数 */
  transcripts: number
  latestMtimeMs: number | null
}

export function inspectSessionStore(sessionsRoot: string, projectsRoot: string): SessionStoreInfo {
  let sessionDirs = 0
  let latest: number | null = null
  if (existsSync(sessionsRoot)) {
    for (const name of readdirSync(sessionsRoot)) {
      const p = join(sessionsRoot, name)
      try {
        if (statSync(p).isDirectory()) sessionDirs += 1
      } catch {
        /* 竞态消失的目录不计数 */
      }
    }
    try {
      latest = statSync(sessionsRoot).mtimeMs
    } catch {
      /* 不可读不冒判 */
    }
  }
  let projectWorkspaces = 0
  let transcripts = 0
  if (existsSync(projectsRoot)) {
    for (const name of readdirSync(projectsRoot)) {
      const p = join(projectsRoot, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      projectWorkspaces += 1
      try {
        for (const f of readdirSync(p)) {
          if (f.endsWith('.jsonl')) transcripts += 1
        }
      } catch {
        /* 不可读的工作区跳过 */
      }
      if (st.mtimeMs > (latest ?? 0)) latest = st.mtimeMs
    }
  }
  return {
    present: existsSync(sessionsRoot) || existsSync(projectsRoot),
    sessionDirs,
    projectWorkspaces,
    transcripts,
    latestMtimeMs: latest,
  }
}

/** wb-switch 面计数投影 */
export interface WbSwitchInfo {
  installed: boolean
  accounts: number | null
  backups: number | null
  /** 会话链接台账(*_session_links.json)是否已建立 —— ⑦跨账号搬家的前置 */
  sessionLinksLedger: string | null
}

const LINK_LEDGER_NAMES = [
  'codebuddy_ide_session_links.json',
  'vscode_session_links.json',
  'session_links.json',
]

export function inspectWbSwitch(dir: string, appDir: string): WbSwitchInfo {
  const accountsPath = join(dir, 'accounts.json')
  let accounts: number | null = null
  if (existsSync(accountsPath)) {
    try {
      const j = JSON.parse(readFileSync(accountsPath, 'utf8')) as unknown
      accounts = Array.isArray(j) ? j.length : null
    } catch {
      accounts = null
    }
  }
  const backupsPath = join(dir, 'backups')
  let backups: number | null = null
  if (existsSync(backupsPath)) {
    try {
      backups = readdirSync(backupsPath).length
    } catch {
      backups = null
    }
  }
  let ledger: string | null = null
  for (const root of [dir, appDir]) {
    for (const name of LINK_LEDGER_NAMES) {
      if (existsSync(join(root, name))) ledger = join(root, name)
    }
  }
  return {
    installed: existsSync(appDir) || accounts !== null,
    accounts,
    backups,
    sessionLinksLedger: ledger,
  }
}

export interface SessionInventory {
  auth: AuthFileInfo
  store: SessionStoreInfo
  wbSwitch: WbSwitchInfo
  /** 一句判定:现在能不能安全做跨账号会话搬家 */
  isolationVerdict: string
}

export function collectInventory(paths: SessionInspectPaths, now: number): SessionInventory {
  const auth = inspectAuthFileInfo(
    existsSync(paths.authFile) ? readFileSync(paths.authFile, 'utf8') : null,
    now,
  )
  const store = inspectSessionStore(paths.sessionsRoot, paths.projectsRoot)
  const wbSwitch = inspectWbSwitch(paths.wbSwitchDir, paths.wbSwitchAppDir)
  let isolationVerdict: string
  if (!auth.present && !store.present) {
    isolationVerdict = '本机三处会话面均不可读 ⇒ 未判定(不猜)'
  } else if (wbSwitch.sessionLinksLedger !== null) {
    isolationVerdict = '已存在会话链接台账,跨账号搬移请走 wb-switch 既有台账,勿另起第二份'
  } else if (store.sessionDirs + store.transcripts > 0) {
    isolationVerdict =
      '会话库无按账号分桶标记 ⇒ 跨账号搬移前必须先建隔离台账并设计隐私删除链(⑦下一刀),现在动手会串号'
  } else {
    isolationVerdict = '会话库为空,无串号风险;搬家链路设计就绪后可直接启用'
  }
  return { auth, store, wbSwitch, isolationVerdict }
}

function fmtCount(n: number | null): string {
  return n === null ? '不可读' : String(n)
}

export function formatReport(inv: SessionInventory, now: number): string {
  const a = inv.auth
  const lines: string[] = []
  lines.push('== WorkBuddy 本机会话盘点(只读;零写入/零上游/不回显凭据与消息内容) ==')
  if (a.present) {
    const tokenDesc =
      a.tokenShape === 'jwt'
        ? `JWT 剩 ${a.remainingDays ?? '?'} 天`
        : a.tokenShape === 'envelope'
          ? '同机加密信封($wbEncrypted,本器不解)'
          : a.tokenShape === 'opaque'
            ? '不透明串'
            : '缺 accessToken'
    lines.push(
      `登录态: 在 | uid=${a.uid ?? '?'} | 域=${a.domain ?? '?'} | token=${tokenDesc}` +
        ` | 昵称=${a.nicknameEncrypted ? '同机加密信封' : '明文'}` +
        ` | accounts 数组=${fmtCount(a.accountCount)}`,
    )
  } else {
    lines.push('登录态: 未找到(桌面端未登录或路径不符)')
  }
  lines.push(
    `会话库: ${inv.store.present ? '在' : '缺'} | 会话目录 ${inv.store.sessionDirs}` +
      ` | 工作区 ${inv.store.projectWorkspaces} | 转写 ${inv.store.transcripts} 份` +
      (inv.store.latestMtimeMs !== null
        ? ` | 最新活动 ${new Date(inv.store.latestMtimeMs).toISOString().slice(0, 16)}Z`
        : ''),
  )
  const w = inv.wbSwitch
  lines.push(
    `wb-switch: ${w.installed ? '已安装' : '未安装'} | accounts=${fmtCount(w.accounts)}` +
      ` | 备份=${fmtCount(w.backups)}` +
      ` | 会话链接台账=${w.sessionLinksLedger ? '已建立' : '未发现'}`,
  )
  lines.push(`判定: ${inv.isolationVerdict}`)
  void now
  return lines.join('\n')
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const json = argv.includes('--json')
  const inv = collectInventory(defaultInspectPaths(), Date.now())
  if (json) {
    process.stdout.write(`${JSON.stringify(inv, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatReport(inv, Date.now())}\n`)
  }
  const anything = inv.auth.present || inv.store.present || inv.wbSwitch.installed ? 0 : 2
  return anything
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
