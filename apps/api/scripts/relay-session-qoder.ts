// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Qoder 会话搬家腿(号池对标 workbuddy-switch 第⑦刀延伸,2026-10-28 立)。
// 取证依据 docs/RELAY_IDE_SESSION_EVIDENCE.md:
//   会话库 = ~/.qoder-cn/projects/<workspace>/<sessionId>.jsonl(转写)
//            + 同名目录 <workspace>/<sessionId>/(转写与目录同父,不像 WorkBuddy 分两根);
//   首行键 type,sessionId,directories;账号机器标识不随账号变
//   ⇒ 分桶沿用方案 A(按切换时刻,存量显式未归属),与 WorkBuddy 同口径。
//
//   pnpm relay:qoder-sessions inventory
//   pnpm relay:qoder-sessions backup [--apply] [--dest <dir>]
//   pnpm relay:qoder-sessions links list
//   pnpm relay:qoder-sessions links rebuild --since <ISO> --account <id> [--label <名>] [--apply]
//   pnpm relay:qoder-sessions links assign  --conversation <id> --account <id> [--apply]
//   pnpm relay:qoder-sessions move    --conversation <id> [--apply]
//   pnpm relay:qoder-sessions restore --conversation <id> [--apply]
//   pnpm relay:qoder-sessions copy    --conversation <id> [--to <账号>] [--apply]
//   pnpm relay:qoder-sessions undo    --op <n> [--apply]
//   pnpm relay:qoder-sessions ops
//
// 台账 = ~/.wb-switch/relay/qoder_session_links.json(数据结构与判据全量复用
// relay-session-links.ts 的 loadLedger/applyLedger/emptyLedger/scanConversationIds/
// planRebuild/planAssign,本文件零第二份台账判据,§0.6)。
// 桶 = ~/.wb-switch/buckets-qoder/<accountId>/<workspace>/<conv>.jsonl(镜像原相对结构;
// Qoder 的转写与会话目录同父,桶内也同父,不设 WorkBuddy 的 workspace/sessions 段)。
//
// 红线(与 WorkBuddy 腿一致,违一即停):
// - 备份先行:move/restore/copy 要求当日 Qoder 快照 manifest 在位(源根匹配);
//   没有则拒绝并指明先跑 backup --apply,本器不自动代跑;
// - 预览先行:一切写动作默认 dry-run,真动必须 --apply;
// - 存续闸:Qoder 客户端在跑时 --apply 默认拒(exit 2),给 --force-running-reason "<≥10字定向理由>"
//   才放行(仅本次调用生效);镜像名现读 = "Qoder CN.exe",env IHUI_RELAY_QODER_IMAGE 可覆盖;
// - 逐条可撤:每轮写操作追加 qoder_move_ops.jsonl(动前动后路径+sha256,零内容),
//   undo --op <n> 单条回退;copy 不是移动,不支持 undo(撤销等于删文件,红线禁止);
// - 零内容回显:输出永不打印 token 或消息正文,只出现路径/计数/字节/sha 前缀;
// - 校验后收工:逐文件先写临时名 → sha256 校验 → 原子改名 → 全量对账,对不上即停;
// - 源只读:inventory/backup 对 ~/.qoder-cn 只 stat/read,绝不写/删/改名源侧路径;
//   写面(backup/move/restore/copy 的 --apply)只写 ~/.wb-switch 侧,测试全走 fixture
//   注入临时目录,绝不在真实 Qoder 库上跑 --apply。

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  appendOps,
  applyTransfers,
  detectClientProcesses,
  formatPlan,
  readOpsAll,
  resolveAccountId,
  type MoveOp,
  type MovePlan,
  type MovePlanFile,
} from './relay-session-move.js'
import {
  applyLedger,
  emptyLedger,
  formatLedgerList,
  loadLedger,
  planAssign,
  planRebuild,
  scanConversationIds,
} from './relay-session-links.js'
import {
  acquireSessionLock,
  SESSION_LINKS_LOCK_NAME,
  SESSION_STORE_LOCK_NAME,
} from './relay-session-lock.js'

/** Qoder 搬家腿全部路径面(默认本机真实面;测试注入临时目录,绝不碰真实 Qoder 库) */
export interface QoderPaths {
  /** ~/.qoder-cn/projects(转写与会话目录同在此根下) */
  projectsRoot: string
  /** 账号桶根 ~/.wb-switch/buckets-qoder */
  bucketsRoot: string
  /** Qoder 会话库快照根 ~/.wb-switch/backups/qoder-sessions */
  backupsQoderDir: string
  /** 操作日志 ~/.wb-switch/relay/qoder_move_ops.jsonl */
  opsLogFile: string
  /** Qoder 专属台账 ~/.wb-switch/relay/qoder_session_links.json */
  ledgerFile: string
}

export function defaultQoderPaths(home = homedir()): QoderPaths {
  return {
    projectsRoot: join(home, '.qoder-cn', 'projects'),
    bucketsRoot: join(home, '.wb-switch', 'buckets-qoder'),
    backupsQoderDir: join(home, '.wb-switch', 'backups', 'qoder-sessions'),
    opsLogFile: join(home, '.wb-switch', 'relay', 'qoder_move_ops.jsonl'),
    ledgerFile: join(home, '.wb-switch', 'relay', 'qoder_session_links.json'),
  }
}

function sha256Of(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function sha256OfPath(p: string): string {
  return sha256Of(readFileSync(p))
}

/** 收集一个目录树全部文件与子目录(绝对路径;深的子目录排在前面,便于先 rmdir) */
function walkAbs(root: string): { files: string[]; dirs: string[] } {
  const files: string[] = []
  const dirs: string[] = []
  const walk = (dir: string): void => {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }
    for (const name of names) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        dirs.push(p)
        walk(p)
      } else if (st.isFile()) files.push(p)
    }
  }
  walk(root)
  dirs.sort((a, b) => b.length - a.length)
  return { files, dirs }
}

/**
 * 盘点一个会话在 Qoder 库中的全部落点(纯只读)。
 * Qoder 结构与 WorkBuddy 不同:转写与会话目录同父(<ws>/<conv>.jsonl + <ws>/<conv>/),
 * 故这里自己找,不复用 WorkBuddy findConversationFiles 的 sessions/projects 双根假设。
 * 关联键 = 文件名主干:<conv>.jsonl 与同名目录成对;sidecar(若有)按 <conv>. 前缀随搬。
 */
export interface QoderConversationFiles {
  conversationId: string
  /** <ws>/<conv>.jsonl 及 <ws>/<conv>.* sidecar 绝对路径 */
  transcripts: string[]
  /** <ws>/<conv>/ 会话目录绝对路径 */
  sessionDirs: string[]
  /** 会话目录内全部文件(绝对路径,递归) */
  sessionDirFiles: string[]
  /** 会话目录内全部子目录(绝对路径,深的在前,rmdir 用) */
  sessionSubDirs: string[]
}

/**
 * Qoder 会话 id = UUID 形态(与 WorkBuddy conversationId 同形)。
 * 顶层目录靠这个区分"会话目录"与"工作区结构件(memory/ transcript/ …)"——
 * 只有 uuid 形态的无配对目录才算孤儿会话,结构目录绝不入台账当会话搬。
 */
export function isQoderSessionId(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)
}

export function findQoderConversationFiles(
  conversationId: string,
  projectsRoot: string,
): QoderConversationFiles {
  const transcripts: string[] = []
  const sessionDirs: string[] = []
  const sessionDirFiles: string[] = []
  const sessionSubDirs: string[] = []
  if (!existsSync(projectsRoot)) {
    return { conversationId, transcripts, sessionDirs, sessionDirFiles, sessionSubDirs }
  }
  for (const ws of readdirSync(projectsRoot)) {
    const wsDir = join(projectsRoot, ws)
    let st
    try {
      st = statSync(wsDir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    let names: string[]
    try {
      names = readdirSync(wsDir)
    } catch {
      continue
    }
    for (const n of names) {
      const abs = join(wsDir, n)
      // <conv>. 前缀带点边界,不误吞其他 uuid;只扫工作区顶层(会话目录内部随目录整体搬)
      if (n.startsWith(`${conversationId}.`)) {
        try {
          if (statSync(abs).isFile()) transcripts.push(abs)
        } catch {
          /* 竞态消失跳过 */
        }
      } else if (n === conversationId) {
        try {
          if (statSync(abs).isDirectory()) {
            sessionDirs.push(abs)
            const w = walkAbs(abs)
            sessionDirFiles.push(...w.files)
            sessionSubDirs.push(...w.dirs)
          }
        } catch {
          /* 竞态消失跳过 */
        }
      }
    }
  }
  transcripts.sort()
  sessionDirFiles.sort()
  return { conversationId, transcripts, sessionDirs, sessionDirFiles, sessionSubDirs }
}

/** Qoder 快照 manifest 单文件条目(零内容,只元数据) */
export interface QoderBackupFileEntry {
  /** 相对 projectsRoot 的路径(POSIX 斜杠归一) */
  rel: string
  bytes: number
  mtimeMs: number
  sha256: string
}

export interface QoderBackupManifest {
  createdAt: string
  source: { tool: 'qoder-cn'; projectsRoot: string }
  files: QoderBackupFileEntry[]
}

export interface QoderBackupPlan {
  destDir: string
  projectsRoot: string
  files: QoderBackupFileEntry[]
  totalBytes: number
  sourcePresent: boolean
}

/** 收集 projectsRoot 下全部文件(绝对路径);根不存在返回空 */
function collectQoderFiles(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return []
  return walkAbs(projectsRoot).files
}

/**
 * 计算 Qoder 备份计划(纯只读)。目的地默认 `<backupsQoderDir>/<UTC时间戳>/`
 * (backupsQoderDir 由路径面注入,本机默认 ~/.wb-switch/backups/qoder-sessions;
 * destOverride 供测试与 --dest 注入 —— 根必须跟着 paths 面走,绝不回落真实 homedir)。
 */
export function computeQoderBackupPlan(
  projectsRoot: string,
  backupsQoderDir: string,
  now: Date,
  destOverride?: string,
): QoderBackupPlan {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const destDir = destOverride ?? join(backupsQoderDir, stamp)
  const files: QoderBackupFileEntry[] = []
  for (const abs of collectQoderFiles(projectsRoot)) {
    try {
      const st = statSync(abs)
      const buf = readFileSync(abs)
      files.push({
        rel: relative(projectsRoot, abs).split(sep).join('/'),
        bytes: st.size,
        mtimeMs: st.mtimeMs,
        sha256: sha256Of(buf),
      })
    } catch {
      /* 竞态消失跳过 */
    }
  }
  files.sort((a, b) => a.rel.localeCompare(b.rel))
  return {
    destDir,
    projectsRoot,
    files,
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    sourcePresent: existsSync(projectsRoot),
  }
}

/**
 * 执行 Qoder 备份(写面,仅 --apply 路径可达;只写 destDir,绝不触碰源侧)。
 * 逐文件:读源 → 写 `<目标>.copying-<ts>` 临时名 → sha256 校验 → 原子改名 → 记账。
 * 任一文件对不上即整批中止(已成功的保留,失败清单随错误抛出),不留半写状态;
 * 收尾再对账一遍 manifest 全量,然后写 manifest.json(含逐文件 sha256)。
 */
export function applyQoderBackup(plan: QoderBackupPlan): QoderBackupManifest {
  const ts = Date.now()
  mkdirSync(plan.destDir, { recursive: true })
  const failures: string[] = []
  let placedCount = 0
  for (const f of plan.files) {
    const srcAbs = join(plan.projectsRoot, ...f.rel.split('/'))
    const dstAbs = join(plan.destDir, ...f.rel.split('/'))
    const tmpAbs = `${dstAbs}.copying-${ts}`
    try {
      const buf = readFileSync(srcAbs)
      if (sha256Of(buf) !== f.sha256) {
        failures.push(`${f.rel}: 源内容与计划不一致(sha256 漂移)`)
        continue
      }
      mkdirSync(dirname(dstAbs), { recursive: true })
      writeFileSync(tmpAbs, buf)
      if (sha256Of(readFileSync(tmpAbs)) !== f.sha256) {
        failures.push(`${f.rel}: 临时文件校验不过`)
        continue
      }
      renameSync(tmpAbs, dstAbs)
      placedCount += 1
    } catch (err) {
      failures.push(`${f.rel}: ${(err as Error).message}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Qoder 备份未完成: ${failures.length} 个失败(已成功 ${placedCount} 个保留在目的地,可重跑补齐):\n` +
        failures.slice(0, 10).join('\n'),
    )
  }
  // 收工对账:manifest 每一项都必须在目的地且 sha 逐字节吻合
  for (const f of plan.files) {
    const dstAbs = join(plan.destDir, ...f.rel.split('/'))
    if (!existsSync(dstAbs) || sha256OfPath(dstAbs) !== f.sha256) {
      throw new Error(`Qoder 备份对账失败: ${f.rel} 在目的地缺失或 sha 不一致;保留现场`)
    }
  }
  const manifest: QoderBackupManifest = {
    createdAt: new Date().toISOString(),
    source: { tool: 'qoder-cn', projectsRoot: plan.projectsRoot },
    files: plan.files,
  }
  writeFileSync(join(plan.destDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

/** 备份先行闸:当日(UTC 同日)且 source.projectsRoot 匹配的 Qoder manifest;没有返回 null */
export function findTodayQoderSnapshot(
  backupsQoderDir: string,
  projectsRoot: string,
  now: Date,
): { dir: string; manifest: QoderBackupManifest } | null {
  if (!existsSync(backupsQoderDir)) return null
  const day = now.toISOString().slice(0, 10)
  let best: { dir: string; manifest: QoderBackupManifest } | null = null
  for (const name of readdirSync(backupsQoderDir)) {
    const dir = join(backupsQoderDir, name)
    const mf = join(dir, 'manifest.json')
    if (!existsSync(mf)) continue
    let m: Record<string, unknown>
    try {
      m = JSON.parse(readFileSync(mf, 'utf8')) as Record<string, unknown>
    } catch {
      continue
    }
    const createdAt = m['createdAt']
    if (typeof createdAt !== 'string' || createdAt.slice(0, 10) !== day) continue
    const src = (m['source'] ?? {}) as Record<string, unknown>
    if (src['tool'] !== 'qoder-cn' || src['projectsRoot'] !== projectsRoot) continue
    const manifest = m as unknown as QoderBackupManifest
    if (!best || createdAt > best.manifest.createdAt) best = { dir, manifest }
  }
  return best
}

/** 桶内镜像落点:buckets-qoder/<accountId>/<原相对结构>(转写与目录同父,Qoder 无 sessions 段) */
function qoderBucketDest(srcAbs: string, accountId: string, paths: QoderPaths): string {
  return join(paths.bucketsRoot, accountId, relative(paths.projectsRoot, srcAbs))
}

/** 备份 manifest rel 同系:相对 projectsRoot、POSIX 斜杠 */
function qoderBackupRel(absPath: string, projectsRoot: string): string {
  return relative(projectsRoot, absPath).split(sep).join('/')
}

function conversationSources(cf: QoderConversationFiles): string[] {
  return [...cf.transcripts, ...cf.sessionDirFiles].sort()
}

/**
 * move 计划(纯只读)。拒绝场景都明说不猜:
 * 快照缺失 / 会话不存在 / 台账缺失或无记录 / 未归属(null) / 账号不在 accounts / 桶内同名冲突。
 * 另与当日 manifest 比对,给出"快照未覆盖/已漂移"告警(只告警不拒)。
 */
export function planQoderMove(
  conversationId: string,
  paths: QoderPaths,
  now: Date,
): MovePlan & { snapshotDir: string } {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  const snap = findTodayQoderSnapshot(paths.backupsQoderDir, paths.projectsRoot, now)
  if (!snap) {
    throw new Error(
      `当日 Qoder 会话库快照缺失(${paths.backupsQoderDir})。先跑 pnpm relay:qoder-sessions backup --apply;本器不自动代跑。`,
    )
  }
  const cf = findQoderConversationFiles(conversationId, paths.projectsRoot)
  if (cf.transcripts.length === 0 && cf.sessionDirFiles.length === 0) {
    throw new Error(`会话不存在: ${conversationId}(projects 顶层无 <conv>.jsonl 也无同名目录)`)
  }
  const ledger = loadLedger(paths.ledgerFile)
  if (!ledger)
    throw new Error(`台账不存在: ${paths.ledgerFile}。先跑 pnpm relay:qoder-sessions links rebuild`)
  const link = ledger.links[conversationId]
  if (!link) {
    throw new Error(
      `台账中无此会话记录: ${conversationId}。先跑 pnpm relay:qoder-sessions links rebuild`,
    )
  }
  if (link.accountId === null) {
    throw new Error(
      `会话未归属(accountId=null,linkedBy=${link.linkedBy}):拒绝搬移。` +
        '存量未归属会话先人工 links assign 明确归属,再搬。',
    )
  }
  if (!ledger.accounts.some((a) => a.accountId === link.accountId)) {
    throw new Error(`台账链接指向的账号不在 accounts 里: ${link.accountId}(台账不一致,拒绝)`)
  }
  const accountId = link.accountId
  const warnings: string[] = []
  const manifestMap = new Map<string, string>()
  for (const f of snap.manifest.files) manifestMap.set(f.rel, f.sha256)
  const files: MovePlanFile[] = []
  for (const src of conversationSources(cf)) {
    const to = qoderBucketDest(src, accountId, paths)
    if (existsSync(to)) {
      throw new Error(`桶内同名落点已存在,拒绝覆盖: ${to}(若为重复搬移请走 restore/undo)`)
    }
    let bytes = 0
    let sha = ''
    try {
      bytes = statSync(src).size
      sha = sha256OfPath(src)
    } catch (err) {
      throw new Error(`源文件不可读: ${src}: ${(err as Error).message}`)
    }
    const backupRel = qoderBackupRel(src, paths.projectsRoot)
    if (!manifestMap.has(backupRel)) {
      warnings.push(`当日快照未覆盖 ${backupRel}(快照后新产生,回退口径以 ops 日志为准)`)
    } else if (manifestMap.get(backupRel) !== sha) {
      warnings.push(`快照后内容已漂移: ${backupRel}(搬移的是当前内容,undo 按 ops 日志回退)`)
    }
    files.push({ from: src, to, bytes, sha256: sha, backupRel })
  }
  return {
    mode: 'move',
    conversationId,
    accountId,
    snapshotDir: snap.dir,
    files,
    stopDirs: [paths.projectsRoot, paths.bucketsRoot],
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    warnings,
  }
}

/** 桶内该账号持有的会话 id 集(buckets-qoder/<acct>/<ws>/ 顶层 <conv>.jsonl 主干 ∪ 有同名转写的目录名) */
export function listQoderBucketConversations(bucketsRoot: string, accountId: string): Set<string> {
  const set = new Set<string>()
  const acctRoot = join(bucketsRoot, accountId)
  if (!existsSync(acctRoot)) return set
  for (const ws of readdirSync(acctRoot)) {
    const wsDir = join(acctRoot, ws)
    let st
    try {
      st = statSync(wsDir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    let names: string[]
    try {
      names = readdirSync(wsDir)
    } catch {
      continue
    }
    for (const n of names) {
      if (n.endsWith('.jsonl')) {
        const conv = n.slice(0, -'.jsonl'.length)
        if (conv.length > 0) set.add(conv)
      } else if (!n.includes('.') && existsSync(join(wsDir, `${n}.jsonl`))) {
        set.add(n)
      }
    }
  }
  return set
}

/**
 * restore 计划:桶内镜像 → 活库原位。归属先取台账;台账无记录/未归属则在桶里找唯一持有者
 * (多桶同持 ⇒ 拒绝)。目标已在位且 sha 一致 ⇒ 跳过拷贝只移除桶内副本;sha 不同 ⇒ 拒绝(宁可拒做)。
 */
export function planQoderRestore(conversationId: string, paths: QoderPaths, now: Date): MovePlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  const snap = findTodayQoderSnapshot(paths.backupsQoderDir, paths.projectsRoot, now)
  if (!snap) {
    throw new Error(
      `当日 Qoder 会话库快照缺失,先跑 pnpm relay:qoder-sessions backup --apply(${paths.backupsQoderDir})`,
    )
  }
  const ledger = loadLedger(paths.ledgerFile)
  let accountId: string | null = ledger?.links[conversationId]?.accountId ?? null
  if (accountId && !existsSync(join(paths.bucketsRoot, accountId))) accountId = null
  if (!accountId) {
    // 桶结构本身携带归属:台账可能未建/未归属,逐账号扫描找唯一持有者
    if (!existsSync(paths.bucketsRoot))
      throw new Error(`桶根不存在: ${paths.bucketsRoot};桶内无此会话`)
    for (const acct of readdirSync(paths.bucketsRoot)) {
      if (listQoderBucketConversations(paths.bucketsRoot, acct).has(conversationId)) {
        if (accountId && accountId !== acct) {
          throw new Error(`多个桶都含此会话(${accountId} / ${acct}),归属不明,拒绝`)
        }
        accountId = acct
      }
    }
  }
  if (!accountId) throw new Error(`桶内找不到会话: ${conversationId},无法回移`)
  const warnings: string[] = []
  const files: MovePlanFile[] = []
  const acctRoot = join(paths.bucketsRoot, accountId)
  for (const ws of readdirSync(acctRoot)) {
    const wsDir = join(acctRoot, ws)
    let st
    try {
      st = statSync(wsDir)
    } catch {
      continue
    }
    if (!st.isDirectory()) continue
    // 转写与 sidecar
    for (const n of readdirSync(wsDir)) {
      if (!n.startsWith(`${conversationId}.`)) continue
      const from = join(wsDir, n)
      try {
        if (!statSync(from).isFile()) continue
      } catch {
        continue
      }
      addRestoreEntry(from, join(paths.projectsRoot, ws, n), files, paths, warnings)
    }
    // 会话目录整体回移
    const convDir = join(wsDir, conversationId)
    if (existsSync(convDir) && statSync(convDir).isDirectory()) {
      for (const f of walkAbs(convDir).files) {
        addRestoreEntry(
          f,
          join(paths.projectsRoot, ws, conversationId, relative(convDir, f)),
          files,
          paths,
          warnings,
        )
      }
    }
  }
  if (files.length === 0) throw new Error(`桶内无此会话: ${conversationId}(桶=${acctRoot})`)
  files.sort((a, b) => a.from.localeCompare(b.from))
  return {
    mode: 'restore',
    conversationId,
    accountId,
    snapshotDir: snap.dir,
    files,
    stopDirs: [paths.projectsRoot, paths.bucketsRoot],
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    warnings,
  }
}

function addRestoreEntry(
  from: string,
  to: string,
  files: MovePlanFile[],
  paths: QoderPaths,
  warnings: string[],
): void {
  const st = statSync(from)
  const sha = sha256OfPath(from)
  if (existsSync(to)) {
    if (sha256OfPath(to) !== sha) {
      throw new Error(`原位已存在且内容不同,宁可拒做: ${to}(先人工确认)`)
    }
    warnings.push(`原位已在且 sha 一致,将只移除桶内副本: ${to}`)
  }
  files.push({
    from,
    to,
    bytes: st.size,
    sha256: sha,
    backupRel: qoderBackupRel(to, paths.projectsRoot),
  })
}

/**
 * copy 计划(纯只读):把会话复制到目标账号桶,源侧保留(同 WorkBuddy copy 语义)。
 * 目标账号 = --to 显式指定(经 resolveAccountId 唯一前缀解析),缺省取台账归属;
 * 两者都取不到 ⇒ 拒绝(不猜)。桶内同名不在计划阶段判冲突:
 * apply 时 sha 相同即跳过、不同则拒做(applyTransfers 内建)。copy 不支持 undo。
 */
export function planQoderCopy(
  conversationId: string,
  paths: QoderPaths,
  now: Date,
  toAccountId?: string,
): MovePlan {
  if (!conversationId) throw new Error('缺少 --conversation <id>')
  const snap = findTodayQoderSnapshot(paths.backupsQoderDir, paths.projectsRoot, now)
  if (!snap) {
    throw new Error(
      `当日 Qoder 会话库快照缺失(${paths.backupsQoderDir})。先跑 pnpm relay:qoder-sessions backup --apply;本器不自动代跑。`,
    )
  }
  const ledger = loadLedger(paths.ledgerFile)
  if (!ledger)
    throw new Error(`台账不存在: ${paths.ledgerFile}。先跑 pnpm relay:qoder-sessions links rebuild`)
  const cf = findQoderConversationFiles(conversationId, paths.projectsRoot)
  if (cf.transcripts.length === 0 && cf.sessionDirFiles.length === 0) {
    throw new Error(`会话不存在: ${conversationId}(projects 顶层无 <conv>.jsonl 也无同名目录)`)
  }
  const link = ledger.links[conversationId]
  const accountId = toAccountId ? resolveAccountId(ledger, toAccountId) : (link?.accountId ?? null)
  if (!accountId) {
    throw new Error(
      '目标账号不可判:台账未归属(accountId=null)且未给 --to <账号>。复制去向必须明确(本器不猜)。',
    )
  }
  if (!ledger.accounts.some((a) => a.accountId === accountId)) {
    throw new Error(`目标账号不在台账 accounts 里: ${accountId}(先 links rebuild 登记)`)
  }
  const warnings: string[] = []
  if (!link) warnings.push('台账无此会话记录:按 --to 显式目标复制(不改台账)')
  else if (link.accountId !== accountId) {
    warnings.push(
      `台账归属是 ${link.accountId ?? '未归属'},本次按 --to 复制到 ${accountId}(不改台账)`,
    )
  }
  const files: MovePlanFile[] = []
  for (const src of conversationSources(cf)) {
    let bytes = 0
    let sha = ''
    try {
      bytes = statSync(src).size
      sha = sha256OfPath(src)
    } catch (err) {
      throw new Error(`源文件不可读: ${src}: ${(err as Error).message}`)
    }
    files.push({
      from: src,
      to: qoderBucketDest(src, accountId, paths),
      bytes,
      sha256: sha,
      backupRel: qoderBackupRel(src, paths.projectsRoot),
    })
  }
  files.sort((a, b) => a.from.localeCompare(b.from))
  return {
    mode: 'copy',
    conversationId,
    accountId,
    snapshotDir: snap.dir,
    files,
    stopDirs: [paths.projectsRoot, paths.bucketsRoot],
    totalBytes: files.reduce((s, f) => s + f.bytes, 0),
    warnings,
  }
}

/**
 * undo 计划:按 ops 日志第 n 条(1 起,含归档位序,readOpsAll 同号族)原路回退。
 * copy 条目拒绝回退(撤销等于删除,红线:绝不删除)。
 */
export function planQoderUndo(
  opsLogFile: string,
  opNum: number,
  paths: QoderPaths,
): { op: MoveOp; plan: MovePlan } {
  const { ops, archivedCount } = readOpsAll(opsLogFile)
  const op = ops[opNum - 1]
  if (!op)
    throw new Error(
      `ops 日志无第 ${opNum} 条(现存 ${ops.length} 条${archivedCount > 0 ? `,含归档 ${archivedCount} 条` : ''})`,
    )
  if (op.type === 'copy') {
    throw new Error(
      `第 ${opNum} 条是 copy(复制到桶):撤销等于删除副本,本器不删文件(红线:绝不删除)。` +
        '如需清理,请人工确认后删除目标侧副本。',
    )
  }
  const reverse: MovePlanFile[] = op.entries.map((e) => ({
    from: e.to,
    to: e.from,
    bytes: e.bytes,
    sha256: e.sha256,
    backupRel: '',
  }))
  const plan: MovePlan = {
    mode: op.type === 'move' ? 'restore' : 'move',
    conversationId: op.conversationId ?? '(未知)',
    accountId: op.accountId ?? '(未知)',
    snapshotDir: '(undo 按 ops 日志回退,不另查快照)',
    files: reverse,
    stopDirs: [paths.projectsRoot, paths.bucketsRoot],
    totalBytes: reverse.reduce((s, f) => s + f.bytes, 0),
    warnings: [],
  }
  return { op, plan }
}

/** 只读盘点结果(三面 = 活库磁盘面 / 账号桶面 / 台账面;全部是计数,零内容) */
export interface QoderInventory {
  projectsRoot: string
  bucketsRoot: string
  ledgerFile: string
  workspaces: number
  transcripts: number
  sessionDirs: number
  /** uuid 形态但无同名主转写:会话目录在、转写未生成或已删 ⇒ 仍是会话,必须入台账全集 */
  orphanSessionDirs: number
  /** 非 uuid 形态顶层目录(memory/ transcript/ 等工作区结构件)⇒ 不是会话,绝不入台账 */
  nonSessionDirs: number
  diskConversations: number
  bucketAccounts: number
  bucketConversations: number
  ledgerPresent: boolean
  ledgerRecords: number
  ledgerUnassigned: number
  diskWithoutLedger: number
  ledgerWithoutFace: number
  inDiskAndBucket: number
  consistent: boolean
}

/**
 * 只读盘点(零内容回显:只出现计数与路径,永不打印 token/消息正文)。
 * 三面一致判据:盘上会话全部在台账有记录 ∧ 台账记录都能在盘上或桶里找到 ∧
 * 同一会话不同时存在于活库与桶。台账缺失 ⇒ 不一致(如实报,不冒绿)。
 */
export function computeQoderInventory(paths: QoderPaths): QoderInventory {
  let workspaces = 0
  let transcripts = 0
  let sessionDirs = 0
  let orphanSessionDirs = 0
  let nonSessionDirs = 0
  const diskSet = new Set<string>()
  if (existsSync(paths.projectsRoot)) {
    for (const ws of readdirSync(paths.projectsRoot)) {
      const wsDir = join(paths.projectsRoot, ws)
      let st
      try {
        st = statSync(wsDir)
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      workspaces += 1
      let names: string[]
      try {
        names = readdirSync(wsDir)
      } catch {
        continue
      }
      const nameSet = new Set(names)
      for (const n of names) {
        const abs = join(wsDir, n)
        try {
          if (statSync(abs).isFile() && n.endsWith('.jsonl')) {
            transcripts += 1
            const conv = n.slice(0, -'.jsonl'.length)
            if (conv.length > 0) diskSet.add(conv)
          } else if (statSync(abs).isDirectory()) {
            if (nameSet.has(`${n}.jsonl`)) {
              sessionDirs += 1
              diskSet.add(n)
            } else if (isQoderSessionId(n)) {
              // 有会话目录、无同名主转写:转写未生成或已删 ⇒ 仍算会话,入 diskSet(台账要认识它)
              orphanSessionDirs += 1
              diskSet.add(n)
            } else {
              // 非 uuid 形态顶层目录(memory/ transcript/ 等)是工作区结构件,绝不入台账当会话搬
              nonSessionDirs += 1
            }
          }
        } catch {
          /* 竞态消失跳过 */
        }
      }
    }
  }
  const bucketSet = new Set<string>()
  let bucketAccounts = 0
  if (existsSync(paths.bucketsRoot)) {
    for (const acct of readdirSync(paths.bucketsRoot)) {
      try {
        if (!statSync(join(paths.bucketsRoot, acct)).isDirectory()) continue
      } catch {
        continue
      }
      bucketAccounts += 1
      for (const c of listQoderBucketConversations(paths.bucketsRoot, acct)) bucketSet.add(c)
    }
  }
  const ledger = loadLedger(paths.ledgerFile)
  const ledgerSet = new Set(Object.keys(ledger?.links ?? {}))
  let diskWithoutLedger = 0
  for (const c of diskSet) if (!ledgerSet.has(c)) diskWithoutLedger += 1
  let ledgerWithoutFace = 0
  for (const c of ledgerSet) if (!diskSet.has(c) && !bucketSet.has(c)) ledgerWithoutFace += 1
  let inDiskAndBucket = 0
  for (const c of diskSet) if (bucketSet.has(c)) inDiskAndBucket += 1
  const links = Object.values(ledger?.links ?? {})
  const consistent =
    ledger !== null && diskWithoutLedger === 0 && ledgerWithoutFace === 0 && inDiskAndBucket === 0
  return {
    projectsRoot: paths.projectsRoot,
    bucketsRoot: paths.bucketsRoot,
    ledgerFile: paths.ledgerFile,
    workspaces,
    transcripts,
    sessionDirs,
    orphanSessionDirs,
    nonSessionDirs,
    diskConversations: diskSet.size,
    bucketAccounts,
    bucketConversations: bucketSet.size,
    ledgerPresent: ledger !== null,
    ledgerRecords: links.length,
    ledgerUnassigned: links.filter((l) => l.accountId === null).length,
    diskWithoutLedger,
    ledgerWithoutFace,
    inDiskAndBucket,
    consistent,
  }
}

export function formatQoderInventory(inv: QoderInventory): string {
  const lines: string[] = []
  lines.push('== Qoder 会话库只读盘点(零内容:只有路径/计数/字节) ==')
  lines.push(`活库: ${inv.projectsRoot}`)
  lines.push(
    `  工作区=${inv.workspaces}  主转写=${inv.transcripts}  会话目录=${inv.sessionDirs}` +
      `  孤儿会话目录(有目录无主转写,入台账)=${inv.orphanSessionDirs}` +
      `  结构目录(非会话,不入台账)=${inv.nonSessionDirs}`,
  )
  lines.push(`  盘上会话 id=${inv.diskConversations}(含孤儿会话目录,不含结构目录)`)
  lines.push(`桶: ${inv.bucketsRoot}  账号=${inv.bucketAccounts}  会话=${inv.bucketConversations}`)
  lines.push(
    `台账: ${inv.ledgerFile}` +
      (inv.ledgerPresent
        ? `  记录=${inv.ledgerRecords}(未归属=${inv.ledgerUnassigned})`
        : '  (不存在,先 links rebuild)'),
  )
  lines.push(
    `三面一致=${inv.consistent ? '是' : '否'}` +
      `  盘上有台账无=${inv.diskWithoutLedger}  台账有无落点=${inv.ledgerWithoutFace}  盘桶同持=${inv.inDiskAndBucket}`,
  )
  return lines.join('\n')
}

function formatBackupPlan(plan: QoderBackupPlan, dryRun: boolean): string {
  const lines: string[] = []
  lines.push(
    dryRun ? 'Qoder 会话库备份·预览(dry-run;加 --apply 才真拷贝)' : 'Qoder 会话库备份·执行',
  )
  lines.push(`目的地: ${plan.destDir}`)
  lines.push(`源: projects=${plan.projectsRoot}(存在=${plan.sourcePresent}) —— 源只读,只 stat/read`)
  lines.push(`将备份 ${plan.files.length} 个文件,共 ${plan.totalBytes} 字节`)
  const shown = plan.files.slice(0, 15)
  for (const f of shown) lines.push(`  ${f.rel} (${f.bytes}B, sha:${f.sha256.slice(0, 12)})`)
  if (plan.files.length > shown.length)
    lines.push(`  …其余 ${plan.files.length - shown.length} 个文件见 manifest.json`)
  return lines.join('\n')
}

/** Qoder 无独立 sessions 根;给 scanConversationIds 一个恒不存在的 sessionsRoot,只走 projects 腿 */
function qoderConversationScan(paths: QoderPaths): {
  conversations: string[]
  times: Record<string, string | null>
} {
  const base = scanConversationIds(
    join(paths.projectsRoot, '.qoder-no-sessions-face'),
    paths.projectsRoot,
  )
  const times = { ...base.times }
  const set = new Set(base.conversations)
  // 补"孤儿会话目录":有 uuid 形态目录、无同名主转写(转写未生成/已删)——
  // 与盘点同口径,否则这类会话在台账里隐形、永远搬不到(结构目录不在其列)
  if (existsSync(paths.projectsRoot)) {
    for (const ws of readdirSync(paths.projectsRoot)) {
      const wsDir = join(paths.projectsRoot, ws)
      let wsStat
      try {
        wsStat = statSync(wsDir)
      } catch {
        continue
      }
      if (!wsStat.isDirectory()) continue
      let names: string[]
      try {
        names = readdirSync(wsDir)
      } catch {
        continue
      }
      const nameSet = new Set(names)
      for (const n of names) {
        if (!isQoderSessionId(n) || nameSet.has(`${n}.jsonl`)) continue
        let st
        try {
          st = statSync(join(wsDir, n))
        } catch {
          continue
        }
        if (!st.isDirectory()) continue
        set.add(n)
        const ms = st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs
        const iso = new Date(ms).toISOString()
        const cur = times[n]
        if (cur === undefined || cur === null) times[n] = iso
        else if (iso < cur) times[n] = iso
      }
    }
  }
  return { conversations: [...set].sort(), times }
}

/**
 * Qoder 存续闸默认镜像名(2026-10-28 现读 `tasklist /FO CSV`:主程序 = `Qoder CN.exe`,名含空格)。
 * 镜像名必须实测得来,不能猜——写错就是"探测不到=放行",这道闸静默失效(§0.3)。
 * env `IHUI_RELAY_QODER_IMAGE`(逗号分隔)可覆盖(换机/改名)。
 */
export const QODER_CLIENT_IMAGES = ['Qoder CN.exe']

export function detectQoderProcesses(): string[] {
  const envNames = (process.env['IHUI_RELAY_QODER_IMAGE'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return detectClientProcesses(envNames.length > 0 ? envNames : QODER_CLIENT_IMAGES)
}

function getFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const USAGE =
  '用法: pnpm relay:qoder-sessions <子命令>\n' +
  '  inventory                                              只读盘点(工作区/转写/会话目录/三面一致)\n' +
  '  backup [--apply] [--dest <dir>]                        Qoder 快照 → ~/.wb-switch/backups/qoder-sessions/<ts>/(manifest 含逐文件 sha256;源只读)\n' +
  '  links list                                             查看 Qoder 台账(~/.wb-switch/relay/qoder_session_links.json)\n' +
  '  links rebuild --since <ISO> --account <id> [--label <名>] [--apply]   方案 A:创建时刻>since 归账号,否则显式 null\n' +
  '  links assign  --conversation <id> --account <id> [--apply]            人工标注归属(manual)\n' +
  '  move    --conversation <id> [--apply]                  单会话隔离 → ~/.wb-switch/buckets-qoder/<acct>/(镜像原结构)\n' +
  '  restore --conversation <id> [--apply]                  桶 → 活库\n' +
  '  copy    --conversation <id> [--to <账号>] [--apply]    复制到桶,源保留(copy 不支持 undo)\n' +
  '  undo    --op <n> [--apply]                             按 ops 记账单条回退\n' +
  '  ops                                                    操作日志清单\n' +
  '默认 dry-run;所有写动作要求当日 Qoder 快照在位(先跑 backup --apply,本器不自动代跑);\n' +
  '逐条记账 ~/.wb-switch/relay/qoder_move_ops.jsonl;零内容回显(无 token/消息正文);\n' +
  'Qoder 客户端在跑时 --apply 会被拒,须先退出或加 --force-running-reason "<≥10字定向理由>"。'

export function main(
  argv: string[] = process.argv.slice(2),
  pathsOverride?: QoderPaths,
  runningProcsOverride?: string[],
): number {
  const paths = pathsOverride ?? defaultQoderPaths()
  const apply = argv.includes('--apply')
  const cmd = argv[0]
  const storeLockPath = join(dirname(paths.opsLogFile), SESSION_STORE_LOCK_NAME)
  const linksLockPath = join(dirname(paths.ledgerFile), SESSION_LINKS_LOCK_NAME)
  // 客户端存续闸(2026-10-28,与 WorkBuddy 搬移腿同语义同尺):Qoder 在跑时会话文件可能被占用/正在写
  const guardClient = (): number | null => {
    const procs = runningProcsOverride ?? detectQoderProcesses()
    if (procs.length === 0) return null
    const reason = getFlag(argv, '--force-running-reason')?.trim()
    if (reason !== undefined && reason.length >= 10) {
      console.error(
        `⚠ Qoder 客户端仍在运行(${procs.length} 个进程),已按定向理由放行: ${reason}(仅本次调用生效)`,
      )
      return null
    }
    console.error(
      `检测到 Qoder 客户端正在运行(${procs.length} 个进程):会话文件可能被占用或正在写入,搬移会半写。` +
        '请先退出 Qoder 再 --apply,或给 --force-running-reason "<≥10字定向理由>" 明确"已确认目标会话未在写"后放行' +
        '(本器不替你杀进程;dry-run 不受影响)。',
    )
    return 2
  }
  let lock: { release: () => void } | null = null
  try {
    const readOnlyView =
      cmd === undefined ||
      cmd === 'help' ||
      cmd === 'inventory' ||
      cmd === 'ops' ||
      (cmd === 'links' && (argv[1] === undefined || argv[1] === 'list'))
    if (apply && !readOnlyView) {
      const blocked = guardClient()
      if (blocked !== null) return blocked
    }
    if (cmd === undefined || cmd === 'help') {
      console.log(USAGE)
      return 0
    }
    if (cmd === 'inventory') {
      console.log(formatQoderInventory(computeQoderInventory(paths)))
      return 0
    }
    if (cmd === 'ops') {
      const { ops, archivedCount, archiveFiles } = readOpsAll(paths.opsLogFile)
      console.log(
        `Qoder 操作日志: ${paths.opsLogFile}(当前 ${ops.length - archivedCount} 条 + 归档 ${archivedCount} 条 = ${ops.length} 条)` +
          (archiveFiles.length > 0 ? `;归档件 ${archiveFiles.length} 份` : ''),
      )
      ops.forEach((op, i) => {
        console.log(
          `  #${i + 1}${i < archivedCount ? '[归档]' : ''} ${op.ts} ${op.type} conv=${op.conversationId ?? '?'} acct=${op.accountId ?? '?'} ` +
            `files=${op.entries.length} bytes=${op.entries.reduce((s, e) => s + e.bytes, 0)}` +
            `${op.refOp !== undefined ? ` refOp=#${op.refOp}` : ''}`,
        )
      })
      return 0
    }
    if (cmd === 'backup') {
      const plan = computeQoderBackupPlan(
        paths.projectsRoot,
        paths.backupsQoderDir,
        new Date(),
        getFlag(argv, '--dest'),
      )
      if (!apply) {
        console.log(formatBackupPlan(plan, true))
        console.log('\n(dry-run;未写入任何路径。确认后加 --apply 执行)')
        return 0
      }
      lock = acquireSessionLock(storeLockPath, 'qoder-backup')
      const manifest = applyQoderBackup(plan)
      console.log(
        `Qoder 备份完成: ${manifest.files.length} 个文件,共 ${plan.totalBytes} 字节 → ${plan.destDir}\nmanifest.json 已写入(含逐文件 sha256,搬家腿将按它校验"备份先行")`,
      )
      return 0
    }
    if (cmd === 'links') {
      const sub = argv[1]
      if (sub === undefined || sub === 'list') {
        console.log(
          formatLedgerList(loadLedger(paths.ledgerFile), {
            ledgerFile: paths.ledgerFile,
            sessionsRoot: paths.projectsRoot,
            projectsRoot: paths.projectsRoot,
          }),
        )
        console.log(
          '\n写操作用法: links rebuild --since <ISO> --account <id> [--apply] / links assign --conversation <id> --account <id> [--apply]',
        )
        return 0
      }
      const ledger = loadLedger(paths.ledgerFile) ?? emptyLedger()
      const scan = qoderConversationScan(paths)
      let plan: ReturnType<typeof planRebuild>
      if (sub === 'rebuild') {
        const since = getFlag(argv, '--since')
        const account = getFlag(argv, '--account')
        if (!since || !account) {
          console.error('links rebuild 需要 --since <ISO> --account <id>([--label <名>])')
          return 2
        }
        plan = planRebuild(
          ledger,
          { since, accountId: account, label: getFlag(argv, '--label') },
          scan.conversations,
          scan.times,
        )
      } else if (sub === 'assign') {
        const conv = getFlag(argv, '--conversation')
        const account = getFlag(argv, '--account')
        if (!conv || !account) {
          console.error('links assign 需要 --conversation <id> --account <id>')
          return 2
        }
        plan = planAssign(ledger, conv, account)
      } else {
        console.error(`未知 links 子命令: ${String(sub)}(可用: list / rebuild / assign)`)
        return 2
      }
      const head = [
        `qoder ${plan.action} · ${apply ? '执行' : '预览(dry-run;加 --apply 才写台账)'}`,
        `将动 ${plan.changes.length} 条台账记录`,
        ...plan.changes.slice(0, 20),
        ...(plan.changes.length > 20 ? [`  …其余 ${plan.changes.length - 20} 条`] : []),
        ...plan.warnings.map((w) => `  警告: ${w}`),
      ]
      if (!apply) {
        console.log(head.join('\n'))
        console.log('\n(dry-run;未写入任何路径。rebuild 只动台账,不动 Qoder 库)')
        return 0
      }
      lock = acquireSessionLock(linksLockPath, `qoder-links ${sub}`)
      const backup = applyLedger(paths.ledgerFile, plan.next)
      console.log(
        head.join('\n') +
          `\n\n台账已写入: ${paths.ledgerFile}` +
          (backup ? `\n旧台账备份于: ${backup}` : '\n(此前无旧台账,无 .bak)'),
      )
      return 0
    }
    let plan: MovePlan
    let opType: MoveOp['type']
    let refOp: number | undefined
    if (cmd === 'move' || cmd === 'copy') {
      const conv = getFlag(argv, '--conversation')
      if (!conv) {
        console.error(
          `${cmd} 需要 --conversation <id>${cmd === 'copy' ? '([--to <账号id|唯一前缀>])' : ''}`,
        )
        return 2
      }
      plan =
        cmd === 'copy'
          ? planQoderCopy(conv, paths, new Date(), getFlag(argv, '--to'))
          : planQoderMove(conv, paths, new Date())
      opType = cmd === 'copy' ? 'copy' : 'move'
    } else if (cmd === 'restore') {
      const conv = getFlag(argv, '--conversation')
      if (!conv) {
        console.error('restore 需要 --conversation <id>')
        return 2
      }
      plan = planQoderRestore(conv, paths, new Date())
      opType = 'restore'
    } else if (cmd === 'undo') {
      const n = Number(getFlag(argv, '--op'))
      if (!Number.isInteger(n) || n < 1) {
        console.error('undo 需要 --op <n>(ops 日志 1 起行号)')
        return 2
      }
      const r = planQoderUndo(paths.opsLogFile, n, paths)
      refOp = n
      plan = r.plan
      opType = 'undo'
      plan.warnings.push(`回退对象: #${n} ${r.op.type} ${r.op.ts}`)
    } else {
      console.error(
        `未知子命令: ${String(cmd)}(可用: inventory / backup / links / move / restore / copy / undo / ops / help)`,
      )
      return 2
    }
    const text = formatPlan(plan, !apply)
    if (!apply) {
      console.log(text)
      console.log('\n(dry-run;未写入任何路径。确认后加 --apply)')
      return 0
    }
    lock = acquireSessionLock(storeLockPath, `qoder-${cmd}`)
    const keepSource = plan.mode === 'copy'
    const r = applyTransfers(plan, { keepSource })
    appendOps(paths.opsLogFile, {
      ts: new Date().toISOString(),
      type: opType,
      conversationId: plan.conversationId === '(未知)' ? null : plan.conversationId,
      accountId: plan.accountId === '(未知)' ? null : plan.accountId,
      ...(refOp !== undefined ? { refOp } : {}),
      entries: r.moved,
    })
    console.log(
      text +
        `\n\n完成: 落地 ${r.moved.length} 个,跳过(已在位)${r.skipped.length} 个;` +
        (keepSource
          ? `源侧保留;记账 ${paths.opsLogFile}(copy 不删文件,故不支持 undo)`
          : `记账 ${paths.opsLogFile}(单条回退: undo --op <n>)`),
    )
    return 0
  } catch (err) {
    console.error(`Qoder 会话搬家失败(未动库或已按红线留现场): ${(err as Error).message}`)
    return 1
  } finally {
    lock?.release()
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
