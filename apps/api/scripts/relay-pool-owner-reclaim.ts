// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 号池运营池存量收归个人池器物(2026-11-06 立,存量清偿票)
/**
 * relay-pool-owner-reclaim —— 把「机主本人导入却落在运营池」的存量号收归个人池(幂等可重跑)。
 *
 * 立因(机主 2026-10-31 永久指令):「我自己填入号池的账号只能跟着我的账号走,别的用户不得
 * 看见、不得使用」。而 `apps/api/src/services/relay-account-forwarder.ts` 的选行语义实测是
 * 带身份 ⇒ `owner IS NULL OR owner = self`,无身份 ⇒ 只 `owner IS NULL` —— 即**运营池那一批
 * 正在服务一切请求者**,对机主那批号这条指令未成立。
 * 增量侧已由 `scripts/relay-account-pool.mjs` 的默认归属(d6d3d747eb)堵上;本器物只治存量。
 *
 * 选择面 = 三条**互相独立**的谓词,全部在判的那一刻从 `ai_relay_account_pool` 现量:
 *  P1 声明族:`provider_code` 落在声明族内(默认只 `qoder`)**且**该 provider 在个人池已有行
 *     —— 「同一 provider 被劈成两半」才是「导入时带没带 --owner 的偶然差异」的形态;
 *     某 provider 只有运营池一行时前提不成立,器物不猜它是共享号还是漏标号。
 *  P2 来源旗标:`extra_metadata` 顶层**含** `keepAliveForever` 键(键在 = 这条导入腿造的号;
 *     值可为 false —— 键位是出身证据,值是使用配置)。
 *  P3 名称形态:`name` 是手机号形态(`^1[3-9]` + 9 位数字)= 本人导入的上游号;
 *     `provider:region` 这类槽位形态(实测 `minimax:cn`)不是。
 * 三轴全过 ⇒ 候选;任一不过 ⇒ 逐条点名 excluded 并写明哪一轴没过(证据面必须自证为什么不动它)。
 * **不许硬编码 uuid 名单**:本仓记过多次「清单必然腐烂」,名单写死则下次导入的新号漏在外面。
 *
 * 写前三闸(任一不过 ⇒ 该枚不动,其余照走):
 *  ① 归属可解且真在 `users` 里(`--owner` 显式给,否则取本机 `~/.wb-switch/pool-owner`;
 *     取不到 ⇒ 整轮未判定 exit 2,绝不「落运营池」冒充旧行为);
 *  ② 逐列 uuid 引用扫:现读 information_schema 全部 uuid 列(逐表一条 UNION ALL,全候选同批扫),
 *     命中非 0 ⇒ 该枚拒改并点名 `表.列=枚数`;
 *  ③ 个人池同键冲突:目标 owner 下已有同 (provider_code, uid) 行 ⇒ 拒改(那要走的是消重,
 *     不是收归;硬改会撞 `ai_relay_account_pool_user_provider_uid_uniq`)。
 *
 * 写前备份:整行逐字写 `<DevEnv>/backups/relay-pool/owner-reclaim-<ISO>.json`
 *  (落点三层:env 覆盖 > §15b 批准落点 > 由仓根所在盘推导;盘符不写死,根由 import.meta.url 推)。
 *  备份写入**必须排在 UPDATE 之前**;写不进 / 回读枚数不符 ⇒ 一条都不写。
 *
 * 写后自证:UPDATE 一律 `.returning({id})` 回库确认落集(§附加强制:不许把请求侧 length 当
 *  affected,missed 必点名),并 AFTER 复量:池总行数、运营池剩余、目标 owner 行数、
 *  --list 面的按 provider 枚数、以及**重跑候选枚数**(必须 0 才算幂等收敛)。
 *
 * 红线(器物结构上只做一件事):只动 `owner_user_id` 一列。
 *  不改 `uid`(它是签到/台账的引用键)、不改任何凭据列、不删行、不动 `is_enabled` /
 *  `temp_unschedulable` / `health_status`;连 `updated_at` 都不写 —— 逐列 diff 的自证只允许
 *  剩这一列,多写一列就是把「别的列没动」这句结论洗成两列动过。
 *
 * 三态结论(§0.3 取不到输入不记绿也不冒红):
 *  `RECLAIM-RESULT state=clean|planned|reclaimed|refused|undetermined …`
 *  planned = dry-run 且本轮确有可动枚(不拿 clean 冒充「没活干」)。
 * 退出码:0 clean|planned|reclaimed(且重跑候选=0)/ 1 refused 或未收敛 / 2 undetermined。
 * 用法(先进入 apps/api):
 *   pnpm exec tsx scripts/relay-pool-owner-reclaim.ts [--dry-run] [--json]
 *   pnpm exec tsx scripts/relay-pool-owner-reclaim.ts --apply [--owner <users.id>]
 *   扩族/换形态由人显式声明(默认面只收 qoder 那一族):--provider qoder,xxx --name-shape any
 * 镜像测试:apps/api/tests/relay-pool-owner-reclaim.test.ts(注入替身,零真库、零落盘)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isUuidString } from '../src/utils/uuid.js'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const API_DIR = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(API_DIR, '..', '..')
/** 手机号形态(本人导入号的名字形态);槽位形态(provider:region)不匹配 */
export const PHONE_NAME_RE = /^1[3-9]\d{9}$/
/** 导入腿写在 extra_metadata 顶层的出身旗标(键位在 = 这条腿造的号) */
export const KEEPALIVE_MARKER_KEY = 'keepAliveForever'

/** 本器物唯一允许改写的列名(逐列 diff 自证的基准;加列必须同批改镜像断言) */
export const ONLY_MUTABLE_COLUMN = 'ownerUserId'

/** 写动作顺序令牌(镜像测试用它锁「备份先于写」) */
export const SEQ = Object.freeze({
  scan: 'scan-references',
  backup: 'backup',
  write: 'reassign-owner',
} as const)

/**
 * excluded / refused / 整轮中止的原因词汇表(措辞单源;调用方不得另写一份)。
 * `why` 只能是这几个键 ⇒ 输出面不可能给出第二套说法。
 */
export const RECLAIM_REASONS = Object.freeze({
  providerNotDeclared: 'provider 不在声明族(默认只 qoder;要扩族请显式 --provider)',
  noSameProviderPersonalRow: '该 provider 在个人池没有同族行 ⇒「被劈成两半」这一前提不成立,不猜',
  markerMissing: `extra_metadata 顶层无 ${KEEPALIVE_MARKER_KEY} 键 ⇒ 不是这条导入腿造的号`,
  nameNotPhone: '名称非手机号形态 ⇒ 像机器会话槽镜像,不像本人导入的上游号',
  personalKeyConflict: '目标 owner 的个人池已有同 provider+uid 行 ⇒ 该走消重,硬改会撞部分唯一索引',
  referencedElsewhere: '该枚 id 在全库 uuid 列有引用 ⇒ 拒改(点名 表.列=枚数)',
  ownerUnresolved: '个人池归属取不到 ⇒ 整轮未判定(不猜归属,也不回落「运营池」旧行为)',
  ownerMissing: '归属 users.id 在 users 表查不到 ⇒ 整轮未判定',
  poolFaceEmpty: '号池面枚举到 0 行 ⇒ 未判定(§0.3:不用 0 冒充「没有」)',
  backupFailed: '备份写不出 / 回读枚数不符 ⇒ 一条都不写',
  writeMissed: 'UPDATE 回库确认集合小于请求集合 ⇒ 未判定(点名 missed)',
  faceDrift: 'AFTER 复量池总行数与 BEFORE 不符 ⇒ 未判定(本器物不删行)',
  notConverged: 'AFTER 复量仍有候选枚 ⇒ 未收敛(幂等自证不过)',
  ioFailed: '被审面读不出来 ⇒ 未判定',
} as const)

export type ReclaimReason = keyof typeof RECLAIM_REASONS

/** 号池行的判定投影(只带判据所需字段;凭据列一概不进本形状) */
export interface PoolRowFace {
  id: string
  providerCode: string
  uid: string
  name: string
  ownerUserId: string | null
  createdAt: string
  /** extra_metadata 顶层是否含出身旗标(值不判,只判键在) */
  markerPresent: boolean
}

/** 可声明的谓词(不是名单):族、旗标、名称形态、同族个人池前提 */
export interface ReclaimPredicate {
  providers: readonly string[]
  requireSameProviderPersonalRow: boolean
  requireMarker: boolean
  nameShape: 'phone' | 'any'
}

export const RECLAIM_DEFAULT_PREDICATE: ReclaimPredicate = {
  providers: ['qoder'],
  requireSameProviderPersonalRow: true,
  requireMarker: true,
  nameShape: 'phone',
}

export type ReclaimState = 'clean' | 'planned' | 'reclaimed' | 'refused' | 'undetermined'

/** 逐条点名行(输出面用;只带脱敏投影,永不带凭据) */
export interface NamedRow {
  row: PoolRowFace
  why: ReclaimReason
  detail: string
}

export interface RefHit {
  table: string
  column: string
  n: number
}

/** BEFORE / AFTER 复量(全部从被审面现量) */
export interface FaceMeasure {
  poolRows: number
  opsRows: number
  personalRows: number
  ownerRows: number
  /** provider → 运营池枚数(--list 面的归属维) */
  opsByProvider: Record<string, number>
}

export interface BackupEnvelope {
  action: 'owner-reclaim'
  asOf: string
  targetOwner: string
  rowCount: number
  columnsTouched: readonly string[]
  rows: Array<Record<string, unknown>>
}

export interface ReclaimDeps {
  /** 号池全量投影(个人池 + 运营池都要:同族前提要从个人池侧量) */
  selectPoolRows: () => Promise<PoolRowFace[]>
  ownerAccountExists: (owner: string) => Promise<boolean>
  /** 一次扫完全部候选(逐表一条 UNION ALL);返回 rowId → 命中列清单 */
  scanReferences: (ids: readonly string[]) => Promise<Record<string, RefHit[]>>
  /** 整行逐字(备份用;不进 stdout) */
  selectFullRows: (ids: readonly string[]) => Promise<Array<Record<string, unknown>>>
  /** 备份出口:抛错 = 备份失败 ⇒ 一条都不写(测试零落盘,CLI 落批准目录) */
  writeBackup: (snapshot: BackupEnvelope) => void
  /** 只写 ownerUserId 一列;返回**回库确认**的 id 集合(.returning) */
  reassignOwner: (ids: readonly string[], owner: string) => Promise<string[]>
  now: () => Date
}

export interface ReclaimOptions {
  apply: boolean
  ownerUserId: string | null
  ownerSource: string
  predicate: ReclaimPredicate
}

export interface ReclaimOutcome {
  state: ReclaimState
  rc: number
  line: string
  stage: string
  ownerUserId: string | null
  ownerSource: string
  candidates: PoolRowFace[]
  excluded: NamedRow[]
  refused: NamedRow[]
  refHits: Record<string, RefHit[]>
  wroteIds: string[]
  missedIds: string[]
  before: FaceMeasure | null
  after: FaceMeasure | null
  rerunCandidates: number | null
  why: ReclaimReason | null
}

/** 手机号打码(前 3 + 掩 4 + 后 4);其余形态只截前 12,永不整值外显 */
export function maskAccountName(name: string): string {
  const s = String(name ?? '')
  if (PHONE_NAME_RE.test(s)) return `${s.slice(0, 3)}****${s.slice(7)}`
  return s.length > 12 ? `${s.slice(0, 12)}…` : s
}

/** 归属回显:个人池只显前 8(与 scripts/lib/pool-owner.mjs 的 maskPoolOwner 同口径) */
export function maskOwner(owner: string | null): string {
  return owner ? `${owner.slice(0, 8)}***` : '运营池(NULL)'
}
/** (provider, uid) 键 —— 与库侧两条部分唯一索引同口径(归属桶另算) */
export function poolKeyOf(r: { providerCode: string; uid: string }): string {
  return `${r.providerCode}\u0000${r.uid}`
}

/** 该枚是否落在运营池(owner_user_id IS NULL) */
export function isOpsRow(r: { ownerUserId: string | null }): boolean {
  return r.ownerUserId === null
}

/** 候选/点名面统一排序:provider 升序 → 创建时刻升序 → id 升序(输出必须可复现) */
function byProviderThenCreated(a: PoolRowFace, b: PoolRowFace): number {
  return (
    a.providerCode.localeCompare(b.providerCode) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * 谓词判定(纯函数、零 IO):只审运营池行,三轴各自独立;`why` 取最先撞的那一轴,
 * `detail` 把**所有**未过的轴逐条列出(只报第一轴 = 把「为什么不动它」说一半)。
 * 个人池行不进候选面,只作「同族前提」的量出侧 —— 判据在判的那一刻从被审面算,不抄名单。
 */
export function classifyPool(
  rows: readonly PoolRowFace[],
  predicate: ReclaimPredicate,
): { candidates: PoolRowFace[]; excluded: NamedRow[] } {
  const personalProviders = new Set(rows.filter((r) => !isOpsRow(r)).map((r) => r.providerCode))
  const candidates: PoolRowFace[] = []
  const excluded: NamedRow[] = []
  for (const r of [...rows].sort(byProviderThenCreated)) {
    if (!isOpsRow(r)) continue
    // 三轴**各自独立**判,不过的全列出来:只报最先撞的那一轴,等于把「为什么不动它」说一半
    const fails: NamedRow[] = []
    if (!predicate.providers.includes(r.providerCode))
      fails.push({ row: r, why: 'providerNotDeclared', detail: `provider=${r.providerCode}` })
    if (predicate.requireMarker && !r.markerPresent)
      fails.push({ row: r, why: 'markerMissing', detail: `uid=${r.uid.slice(0, 10)}…` })
    if (predicate.nameShape === 'phone' && !PHONE_NAME_RE.test(r.name))
      fails.push({ row: r, why: 'nameNotPhone', detail: `name=${maskAccountName(r.name)}` })
    if (predicate.requireSameProviderPersonalRow && !personalProviders.has(r.providerCode))
      fails.push({
        row: r,
        why: 'noSameProviderPersonalRow',
        detail: `provider=${r.providerCode} 个人池 0 行`,
      })
    const head = fails[0]
    if (head) {
      excluded.push({
        row: r,
        why: head.why,
        detail: fails.map((f) => `${f.why}:${f.detail}`).join(' | '),
      })
      continue
    }
    candidates.push(r)
  }
  return { candidates, excluded }
}

/** 引用扫闸(纯函数):命中非 0 ⇒ 该枚拒改并在 detail 点名 `表.列=枚数` */
export function splitRefHits(
  candidates: readonly PoolRowFace[],
  refHits: Record<string, RefHit[]>,
): { ok: PoolRowFace[]; refused: NamedRow[] } {
  const ok: PoolRowFace[] = []
  const refused: NamedRow[] = []
  for (const r of candidates) {
    const hits = refHits[r.id] ?? []
    if (hits.length === 0) {
      ok.push(r)
      continue
    }
    refused.push({
      row: r,
      why: 'referencedElsewhere',
      detail: hits.map((h) => `${h.table}.${h.column}=${h.n}`).join(','),
    })
  }
  return { ok, refused }
}

/** 个人池同键冲突闸(纯函数):owner 桶已有同 (provider,uid) ⇒ 拒改(硬改撞部分唯一索引) */
export function splitKeyConflicts(
  candidates: readonly PoolRowFace[],
  rows: readonly PoolRowFace[],
  owner: string,
): { ok: PoolRowFace[]; refused: NamedRow[] } {
  const ownerKeys = new Set(rows.filter((r) => r.ownerUserId === owner).map((r) => poolKeyOf(r)))
  const ok: PoolRowFace[] = []
  const refused: NamedRow[] = []
  for (const r of candidates) {
    if (ownerKeys.has(poolKeyOf(r))) {
      refused.push({
        row: r,
        why: 'personalKeyConflict',
        detail: `${r.providerCode}/${r.uid.slice(0, 10)}… 在 ${maskOwner(owner)} 已存在`,
      })
      continue
    }
    ok.push(r)
  }
  return { ok, refused }
}

/** 复量(纯函数):行数 / 归属分布 / 目标 owner 行数 / provider×运营池枚数(--list 面) */
export function measureFace(rows: readonly PoolRowFace[], owner: string | null): FaceMeasure {
  const opsByProvider: Record<string, number> = {}
  let opsRows = 0
  let personalRows = 0
  let ownerRows = 0
  for (const r of rows) {
    if (isOpsRow(r)) {
      opsRows++
      opsByProvider[r.providerCode] = (opsByProvider[r.providerCode] ?? 0) + 1
    } else {
      personalRows++
      if (owner && r.ownerUserId === owner) ownerRows++
    }
  }
  return { poolRows: rows.length, opsRows, personalRows, ownerRows, opsByProvider }
}

export interface ConcludeNumbers {
  poolRows: number
  opsBefore: number
  opsAfter: number
  candidates: number
  excluded: number
  refused: number
  wrote: number
  missed: number
  rerun: number
  apply: 0 | 1
}

/**
 * 结论行(唯一形态;一格一读数、整条单行,禁止折行 —— 见 AGENTS §读数不得断行)。
 * `planned` 只出现在 dry-run 且有可动枚时:不拿 clean 冒充「没活干」。
 */
export function conclude(
  state: ReclaimState,
  n: ConcludeNumbers,
  extra: Record<string, string | number> = {},
): string {
  return [
    `RECLAIM-RESULT state=${state}`,
    `poolRows=${n.poolRows}`,
    `opsBefore=${n.opsBefore}`,
    `opsAfter=${n.opsAfter}`,
    `candidates=${n.candidates}`,
    `excluded=${n.excluded}`,
    `refused=${n.refused}`,
    `wrote=${n.wrote}`,
    `missed=${n.missed}`,
    `rerun=${n.rerun}`,
    `apply=${n.apply}`,
    ...Object.entries(extra).map(([k, v]) => `${k}=${v}`),
  ].join(' ')
}

/** 由 outcome 组结论行(措辞与计数单源:任何输出面都从这里出) */
export function lineOf(o: ReclaimOutcome, apply: boolean): string {
  return conclude(
    o.state,
    {
      poolRows: o.before?.poolRows ?? 0,
      opsBefore: o.before?.opsRows ?? 0,
      opsAfter: o.after?.opsRows ?? o.before?.opsRows ?? 0,
      candidates: o.candidates.length,
      excluded: o.excluded.length,
      refused: o.refused.length,
      wrote: o.wroteIds.length,
      missed: o.missedIds.length,
      rerun: o.rerunCandidates ?? 0,
      apply: apply ? 1 : 0,
    },
    { stage: o.stage, ...(o.why ? { why: o.why } : {}) },
  )
}
/**
 * 主流程腿(纯编排:一切 IO 经 deps 注入 ⇒ 镜像测试零真库、零落盘)。
 *
 * 顺序固定(镜像测试按这条链锁):归属闸 → 取面 → BEFORE 复量 → owner 存在闸 →
 * 谓词分类 → 引用扫 → 同键冲突闸 → (dry-run 到此收口) → 整行备份 → UPDATE(.returning 回库
 * 确认落集) → AFTER 复量 → 重跑自证。备份永远排在写之前,备份不出 ⇒ 一条都不写。
 */
export async function runReclaim(deps: ReclaimDeps, opts: ReclaimOptions): Promise<ReclaimOutcome> {
  const finish = (
    state: ReclaimState,
    rc: number,
    stage: string,
    why: ReclaimReason | null,
    patch: Partial<ReclaimOutcome> = {},
  ): ReclaimOutcome => {
    const o: ReclaimOutcome = {
      state,
      rc,
      stage,
      why,
      ownerUserId: opts.ownerUserId,
      ownerSource: opts.ownerSource,
      candidates: [],
      excluded: [],
      refused: [],
      refHits: {},
      wroteIds: [],
      missedIds: [],
      before: null,
      after: null,
      rerunCandidates: null,
      line: '',
      ...patch,
    }
    return { ...o, line: lineOf(o, opts.apply) }
  }

  // ① 归属闸:取不到就是取不到 —— 不猜归属,也绝不把旧行为("落运营池")当兜底冒充绿
  const owner = opts.ownerUserId
  if (!owner || !isUuidString(owner)) return finish('undetermined', 2, 'owner', 'ownerUnresolved')

  let rows: PoolRowFace[]
  try {
    rows = await deps.selectPoolRows()
  } catch {
    return finish('undetermined', 2, 'select-pool-rows', 'ioFailed')
  }
  if (rows.length === 0) return finish('undetermined', 2, 'pool-face', 'poolFaceEmpty')

  const before = measureFace(rows, owner)
  let ownerOk = false
  try {
    ownerOk = await deps.ownerAccountExists(owner)
  } catch {
    ownerOk = false
  }
  if (!ownerOk) return finish('undetermined', 2, 'owner-in-users', 'ownerMissing', { before })

  const { candidates, excluded } = classifyPool(rows, opts.predicate)
  if (candidates.length === 0) {
    return finish('clean', 0, 'classify', null, { before, after: before, excluded })
  }

  let refHits: Record<string, RefHit[]>
  try {
    refHits = await deps.scanReferences(candidates.map((r) => r.id))
  } catch {
    return finish('undetermined', 2, 'scan-references', 'ioFailed', {
      candidates,
      excluded,
      before,
    })
  }
  const byRefs = splitRefHits(candidates, refHits)
  const byKey = splitKeyConflicts(byRefs.ok, rows, owner)
  const refused: NamedRow[] = [...byRefs.refused, ...byKey.refused]
  const writable = byKey.ok
  const seen = { candidates, excluded, refused, refHits, before }

  if (writable.length === 0) {
    return finish('refused', 1, 'gates', null, { ...seen, after: before })
  }
  if (!opts.apply) {
    return finish('planned', 0, 'dry-run', null, { ...seen, after: before })
  }

  // 整行逐字备份(枚数对不上 / 写不出 ⇒ 一条都不写)
  const ids = writable.map((r) => r.id)
  let full: Array<Record<string, unknown>>
  try {
    full = await deps.selectFullRows(ids)
  } catch {
    return finish('undetermined', 2, 'backup-read', 'ioFailed', seen)
  }
  if (full.length !== ids.length) {
    return finish('undetermined', 2, 'backup-readback', 'backupFailed', {
      ...seen,
      after: before,
      missedIds: ids.filter((id) => !full.some((row) => String(row.id) === id)),
    })
  }
  try {
    deps.writeBackup({
      action: 'owner-reclaim',
      asOf: deps.now().toISOString(),
      targetOwner: owner,
      rowCount: full.length,
      columnsTouched: [ONLY_MUTABLE_COLUMN],
      rows: full,
    })
  } catch {
    return finish('undetermined', 2, 'backup', 'backupFailed', { ...seen, after: before })
  }

  let updatedIds: string[]
  try {
    updatedIds = await deps.reassignOwner(ids, owner)
  } catch {
    return finish('undetermined', 2, 'write', 'ioFailed', { ...seen, after: before })
  }
  // 回库确认集合才是 affected(§附加强制:请求侧 length 不算)
  const wroteIds = updatedIds.filter((id) => ids.includes(id))
  const missedIds = ids.filter((id) => !updatedIds.includes(id))

  let afterRows: PoolRowFace[]
  try {
    afterRows = await deps.selectPoolRows()
  } catch {
    return finish('undetermined', 2, 'measure-after', 'ioFailed', {
      ...seen,
      wroteIds,
      missedIds,
      after: before,
    })
  }
  const after = measureFace(afterRows, owner)
  const measured = { ...seen, wroteIds, missedIds, before, after }
  if (after.poolRows !== before.poolRows) {
    return finish('undetermined', 2, 'measure-after', 'faceDrift', measured)
  }
  if (missedIds.length > 0)
    return finish('undetermined', 2, 'write-confirm', 'writeMissed', measured)
  // 幂等自证:AFTER 面重跑同一把谓词,候选必须归零,否则没收敛
  const rerunCandidates = classifyPool(afterRows, opts.predicate).candidates.length
  if (rerunCandidates !== 0) {
    return finish('reclaimed', 1, 'converge', 'notConverged', { ...measured, rerunCandidates })
  }
  // 有枚被闸挡下(其余照改)⇒ 本轮只算部分完成,rc=1 如实报
  return finish('reclaimed', refused.length > 0 ? 1 : 0, 'applied', null, {
    ...measured,
    rerunCandidates,
  })
}
export const __test__ = {
  PHONE_NAME_RE,
  KEEPALIVE_MARKER_KEY,
  ONLY_MUTABLE_COLUMN,
  SEQ,
  RECLAIM_REASONS,
  RECLAIM_DEFAULT_PREDICATE,
  maskAccountName,
  maskOwner,
  poolKeyOf,
  isOpsRow,
  classifyPool,
  splitRefHits,
  splitKeyConflicts,
  measureFace,
  conclude,
  lineOf,
  runReclaim,
}

const USAGE =
  '用法(先进入 apps/api):pnpm exec tsx scripts/relay-pool-owner-reclaim.ts [档位]\n' +
  '  --dry-run(默认)  只演不写:逐条点名候选 / excluded / refused,零写库零落盘\n' +
  '  --apply           落盘:先整行逐字备份,备份不出则一条都不写;只动 owner_user_id 一列\n' +
  '  --json            机器面(先打整份 JSON,再打 RECLAIM-RESULT 结论行)\n' +
  '  --owner <users.id> 显式目标归属;缺省取本机 ~/.wb-switch/pool-owner(唯一读取实现)\n' +
  '  --provider a,b     覆盖声明族(默认只 qoder)\n' +
  '  --name-shape any   放开名称形态轴(默认只收手机号形态)\n' +
  '  --no-require-marker 放开出身旗标轴(默认必须 extra_metadata 含 keepAliveForever 键)\n' +
  '  --require-same-provider-row off 关掉「同 provider 个人池已有行」前提(慎:等于放弃劈半判据)\n' +
  '退出码:0 clean|planned|reclaimed / 1 refused 或未收敛 / 2 undetermined\n' +
  '红线:不改 uid、不改凭据列、不删行、不动 is_enabled / temp_unschedulable;只动 owner_user_id。\n'

/**
 * 备份落点三层(与 `scripts/lib/gitdir.mjs` 的 `backupMirrorRoot()` 同一裁决口径):
 *  env 覆盖 > §15b 批准落点(该盘已有 backups 才认)> 由仓根所在盘推导(盘符不写死)。
 * 仓根由 import.meta.url 推出,不用 process.cwd()(共享工作区 cwd 不可靠,§15)。
 */
export function relayPoolBackupDir(
  env: NodeJS.ProcessEnv = process.env,
  repoRoot = REPO_ROOT,
): string {
  const override = String(env['IHUI_DEVENV_BACKUP_ROOT'] ?? '').trim()
  if (override) return join(override, 'backups', 'relay-pool')
  const approved = 'D:/DevEnv'
  if (existsSync(join(approved, 'backups'))) return join(approved, 'backups', 'relay-pool')
  const drive = /^([A-Za-z]:)/.exec(repoRoot.replace(/\\/g, '/'))?.[1] ?? repoRoot.slice(0, 2)
  return join(`${drive}/`, 'DevEnv', 'backups', 'relay-pool')
}

/** 标识符形状闸:information_schema 取值也要过闸才进 SQL(防"清单里长出怪名字") */
export const IDENT_RE = /^[a-z_][a-z0-9_]*$/i

interface RefScanRow {
  col: string
  rid: string
  n: number
}

export async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return 0
  }
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  const flagValue = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    if (i < 0) return null
    const v = argv[i + 1]
    if (!v || v.startsWith('-')) return ''
    return v
  }
  const ownerFlag = flagValue('--owner')
  if (ownerFlag === '') {
    process.stderr.write('❌ 未判定:--owner 需要 users.id(不猜归属)\n')
    return 2
  }
  const providerFlag = flagValue('--provider')
  if (providerFlag === '') {
    process.stderr.write('❌ 未判定:--provider 需要逗号分隔的 provider 清单\n')
    return 2
  }
  const nameShapeFlag = flagValue('--name-shape')
  if (nameShapeFlag !== null && nameShapeFlag !== 'phone' && nameShapeFlag !== 'any') {
    process.stderr.write(`❌ 未判定:--name-shape 只认 phone|any(收到 "${nameShapeFlag}")\n`)
    return 2
  }
  const sameProviderFlag = flagValue('--require-same-provider-row')
  if (sameProviderFlag !== null && !['on', 'off'].includes(sameProviderFlag)) {
    process.stderr.write('❌ 未判定:--require-same-provider-row 只认 on|off\n')
    return 2
  }
  const predicate: ReclaimPredicate = {
    providers: (providerFlag ?? RECLAIM_DEFAULT_PREDICATE.providers.join(','))
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    requireMarker: !argv.includes('--no-require-marker'),
    requireSameProviderPersonalRow: sameProviderFlag !== 'off',
    nameShape: nameShapeFlag === 'any' ? 'any' : 'phone',
  }
  if (predicate.providers.length === 0) {
    process.stderr.write('❌ 未判定:--provider 解析到 0 个族名(枚举到 0 判死,§0.3)\n')
    return 2
  }

  const { config } = await import('dotenv')
  config({ path: join(API_DIR, '.env') })

  // 归属默认值:唯一读取实现在工具层 scripts/lib/pool-owner.mjs(§0.6)。
  // apps/api → repo-tooling 的静态 import 会被架构契约 D1 判红 ⇒ 沿用既有动态 import 模式;
  // 装载失败 ⇒ 未判定(绝不在本文件另抄一份读法,也绝不静默落运营池)。
  const ownerLib = await import(
    pathToFileURL(join(REPO_ROOT, 'scripts', 'lib', 'pool-owner.mjs')).href
  ).catch(() => null)
  if (!ownerLib || typeof ownerLib.resolveDefaultPoolOwner !== 'function') {
    process.stderr.write('❌ 未判定:个人池归属读取模块(scripts/lib/pool-owner.mjs)装载失败\n')
    return 2
  }
  let ownerUserId: string | null = ownerFlag ?? null
  let ownerSource = ownerFlag ? 'explicit-flag' : 'none'
  let ownerReason = ''
  if (!ownerUserId) {
    const d = ownerLib.resolveDefaultPoolOwner() as {
      owner: string | null
      source: string
      reason: string
      file: string
    }
    ownerUserId = d.owner
    ownerSource = d.source
    ownerReason = d.reason
    if (!ownerUserId) {
      process.stdout.write(
        `⚠️ 未取到个人池归属(${String(ownerLib.POOL_OWNER_REASON_TEXT?.[d.reason] ?? d.reason)}:${d.file})\n`,
      )
    }
  }

  const { eq, inArray, sql } = await import('drizzle-orm')
  const { aiRelayAccountPool, users } = await import('@ihui/database')
  const { db, dbClient, dbRead } = await import('../src/db/index.js')

  const selectPoolRows = async (): Promise<PoolRowFace[]> => {
    const got = await dbRead
      .select({
        id: aiRelayAccountPool.id,
        providerCode: aiRelayAccountPool.providerCode,
        uid: aiRelayAccountPool.uid,
        name: aiRelayAccountPool.name,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        createdAt: aiRelayAccountPool.createdAt,
        extraMetadata: aiRelayAccountPool.extraMetadata,
      })
      .from(aiRelayAccountPool)
    return got.map((r) => {
      const meta = r.extraMetadata as Record<string, unknown> | null
      return {
        id: String(r.id),
        providerCode: r.providerCode,
        uid: r.uid,
        name: r.name,
        ownerUserId: r.ownerUserId ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
        markerPresent: !!meta && typeof meta === 'object' && KEEPALIVE_MARKER_KEY in meta,
      }
    })
  }

  // uuid 列清单现读(排除被改表自身主键列);怪名字只报名不进 SQL
  const colRows = (await dbRead.execute(sql`
    select table_name, column_name from information_schema.columns
      where table_schema = 'public' and data_type = 'uuid'
        and not (table_name = 'ai_relay_account_pool' and column_name = 'id')
      order by table_name, column_name
  `)) as unknown as Array<{ table_name: string; column_name: string }>
  let skippedIdentifiers = 0
  const byTable = new Map<string, string[]>()
  for (const c of colRows) {
    if (!IDENT_RE.test(c.table_name) || !IDENT_RE.test(c.column_name)) {
      skippedIdentifiers++
      continue
    }
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, [])
    byTable.get(c.table_name)?.push(c.column_name)
  }
  const uuidColumnCount = colRows.length

  const scanReferences = async (ids: readonly string[]): Promise<Record<string, RefHit[]>> => {
    const hits: Record<string, RefHit[]> = {}
    if (ids.length === 0) return hits
    for (const [tbl, list] of byTable) {
      const text = list
        .map(
          (c) =>
            `select '${c}'::text as col, "${c}"::text as rid, count(*)::int as n from "${tbl}" where "${c}" = any($1::uuid[]) group by "${c}"`,
        )
        .join(' union all ')
      const rows = (await dbClient.unsafe(text, [ids as string[]])) as unknown as RefScanRow[]
      for (const row of rows) {
        if (row.n <= 0) continue
        const bucket = (hits[row.rid] ??= [])
        bucket.push({ table: tbl, column: row.col, n: row.n })
      }
    }
    return hits
  }

  let backupFile = ''
  const writeBackup = (snapshot: BackupEnvelope): void => {
    const dir = relayPoolBackupDir()
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `owner-reclaim-${snapshot.asOf.replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8')
    const back = JSON.parse(readFileSync(file, 'utf8')) as { rowCount?: number; rows?: unknown[] }
    if (back.rowCount !== snapshot.rowCount || (back.rows?.length ?? 0) !== snapshot.rowCount)
      throw new Error(
        `备份回读不符 rowCount=${String(back.rowCount)} rows=${String(back.rows?.length)}`,
      )
    backupFile = file
  }

  const deps: ReclaimDeps = {
    selectPoolRows,
    ownerAccountExists: async (owner) => {
      if (!isUuidString(owner)) return false
      const hit = await dbRead.select({ id: users.id }).from(users).where(eq(users.id, owner))
      return hit.length > 0
    },
    scanReferences,
    selectFullRows: async (ids) =>
      (await dbRead
        .select()
        .from(aiRelayAccountPool)
        .where(inArray(aiRelayAccountPool.id, ids))) as unknown as Array<Record<string, unknown>>,
    writeBackup,
    // 红线:只写 ownerUserId 一列 —— 连 updated_at 都不带(逐列 diff 必须只剩这一列)
    reassignOwner: async (ids, owner) => {
      const updated = await db
        .update(aiRelayAccountPool)
        .set({ ownerUserId: owner })
        .where(inArray(aiRelayAccountPool.id, ids))
        .returning({ id: aiRelayAccountPool.id })
      return updated.map((u) => String(u.id))
    },
    now: () => new Date(),
  }

  const outcome = await runReclaim(deps, { apply, ownerUserId, ownerSource, predicate })

  if (!json) {
    process.stdout.write(
      `目标归属=${maskOwner(outcome.ownerUserId)}(来源=${outcome.ownerSource}${ownerReason === 'ok' ? '' : `,原因:${ownerReason}`})\n`,
    )
    process.stdout.write(
      `谓词:族=[${predicate.providers.join(', ')}] 旗标=${predicate.requireMarker ? '必需' : '放开'} 名称=${predicate.nameShape} 同族前提=${predicate.requireSameProviderPersonalRow ? '必需' : '放开'}\n`,
    )
    process.stdout.write(
      `uuid 列扫面=${uuidColumnCount}(跳过怪名 ${skippedIdentifiers},表 ${byTable.size})\n`,
    )
    for (const r of outcome.candidates)
      process.stdout.write(
        `  候选 ${r.providerCode} uid=${r.uid.slice(0, 10)}… name=${maskAccountName(r.name)} owner=${maskOwner(r.ownerUserId)} created=${r.createdAt} id=${r.id.slice(0, 8)}…\n`,
      )
    for (const e of outcome.excluded)
      process.stdout.write(
        `  不动 ${e.row.providerCode} uid=${e.row.uid.slice(0, 10)}… name=${maskAccountName(e.row.name)} ⇒ ${RECLAIM_REASONS[e.why]}(${e.detail})\n`,
      )
    for (const f of outcome.refused)
      process.stdout.write(
        `  拒改 ${f.row.providerCode} uid=${f.row.uid.slice(0, 10)}… ⇒ ${RECLAIM_REASONS[f.why]}(${f.detail})\n`,
      )
    for (const id of outcome.missedIds) process.stdout.write(`  MISSED id=${id.slice(0, 8)}…\n`)
    if (backupFile) process.stdout.write(`备份:${backupFile}\n`)
  } else {
    process.stdout.write(
      `${JSON.stringify({ ...outcome, backupFile, uuidColumnCount, skippedIdentifiers, predicate }, null, 2)}\n`,
    )
  }
  process.stdout.write(`${outcome.line}\n`)
  return outcome.rc
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // db 模块一载入就起池与探测定时器 ⇒ 报完结论必须显式退进程(与 relay-pool-uid-keysource-audit.ts 同法);
  // 只设 process.exitCode 会让本器物打印 RECLAIM-RESULT 后挂住不退出。
  main(process.argv.slice(2)).then(
    (rc) => process.exit(rc),
    (err) => {
      process.stderr.write(
        `❌ 未判定(器物自身异常): ${err instanceof Error ? err.message : String(err)}\n`,
      )
      process.exit(2)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
