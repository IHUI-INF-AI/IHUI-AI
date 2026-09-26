#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本票的运行时判据是 CLI 工具,结论必须打到 stdout 才有人看得见 */

/**
 * O13 第二格(2026-09-26):租户 RLS 的**运行时**对账。
 *
 * 干什么:initdb 一个一次性真实 PostgreSQL 集群 → 按 _journal.json 重放迁移到 idx=293 →
 * 建两个"非超级用户、无 BYPASSRLS"的角色 → 对 8 张纳管表逐表跑出
 * 「策略到底拦不拦得住」,补 `tenant-rls-policy-check.mjs`(文本层)结构上判不了的那一维:
 *   * 策略图自引用会不会 `infinite recursion detected in policy`;
 *   * `current_setting('app.user_id')` **未设**时是 fail-open 还是 fail-closed;
 *   * FORCE ROW LEVEL SECURITY 是否真拦住了**表属主**(ENABLE/FORCE 成对的全部理由);
 *   * 跨租户 UPDATE / DELETE 是否真 0 行(只看 SELECT 不够 —— WITH CHECK 与 USING 是两半)。
 *
 * 为什么必须真跑:文本层证得了"策略写成的形状",证不了"PostgreSQL 求值后的行集"。本仓反复
 * 登记过同一型缺陷 ——「判据必须在真跑它的那一刻才成立,否则等于没有」(守门 64/105/115)。
 *
 * 隔离纪律(AGENTS §5 测试隔离铁律;每条都有对应的机器判据,不靠自觉):
 *   * 生产 PostgreSQL 在 **8810**、Redis 在 **8811**。`assertPortChoice()` 把 8810/8811 判死,
 *     并把 **5432** 也判死(本机实测 5432 上跑着 PG18 的 postgres.exe,与既有实例抢端口 = 撞别人数据);
 *     启动前再用一次真实 TCP 探测确认选定端口**无人监听**。
 *   * 所有 psql 连接只能经 `psqlArgs()` 这**一个**出口,它内部再次断言端口不在禁列 ——
 *     "忘了改端口就连到 8810"这件事在结构上不可能发生,而不是"我记得没连"。
 *   * data dir 只允许仓库内 `.ihui-agent/tmp/**` 或 `<盘>:\DevEnv\Temp\**`(§15/§15b),
 *     `assertDataDirAllowed()` 拒 C:\temp、盘根、家目录,也拒任何"第五个落点"。
 *   * 不碰 Windows 服务、不改环境变量:集群经 `pg_ctl start` 拉起(实测直接 spawn postgres.exe
 *     会被 PostgreSQL 以"管理员令牌"拒绝启动;而 spawn 接到管道时又会挂死 —— 两条都写在下面)。
 *   * 收尾写在 finally:`pg_ctl stop -m fast` + 删除临时目录 + TCP 复测端口已释放 + existsSync
 *     复测目录已删 —— 失败也要收。
 *
 * 主体设计(为什么是**两个**角色而不是一个):生产实测是「连接角色 = 表属主 ∧ rolbypassrls=t」
 *   (迁移头注第一手读数),而 FORCE 只在"属主 ∧ 非超级用户 ∧ 无 BYPASSRLS"时才有效果 ——
 *   属主若是超级用户,FORCE 结构上不可测。于是:
 *     ihui_rls_owner = 非超级用户 + NOBYPASSRLS,并被 ALTER TABLE ... OWNER TO 成 8 张表的属主
 *                      ⇒ 复刻生产形态,是唯一能证 FORCE 的那一类主体;
 *     ihui_rls_member = 同上属性但不持有任何表(表权限由 harness 显式 GRANT)
 *                      ⇒ 表 ACL 不构成筛选理由,观察到的行集差异只可能来自 RLS 本身。
 *   两者的 rolsuper / rolbypassrls 一律从 pg_roles **回读实测值**打进报告,不写"应该是 false"。
 *
 * 判据形态:SQL 只负责**量**(行集 / 受影响行数 / 错误文本),JS 负责**判**;
 *   输出逐条 `<表> × <判据> × PASS|FAIL|P0|SKIP|INFO + 实测数字`。
 *   拿不到可判定读数 ⇒ SKIP 并写原因,**绝不记为通过**;一条判据都没跑成 ⇒ 整体"无法判定"。
 *   两条**变异对照**:① 摘掉 FORCE 后属主必须越权(证明 FORCE 那条绿不是恒真);
 *   ② 未设 GUC 却看见租户行 ⇒ 判 P0(fail-open 不许被记成通过)。
 *
 * 用法:`node tenant-rls-live-check.mjs [--check|--self-test|--json|--keep|--fresh|--port <n>|--data-dir <p>|--target-idx <n>]`
 *   缺省为真跑全流程;`--check` / `--self-test` 零副作用;`--keep` 保留集群排障(默认必删)。
 *   退出码:0 全 PASS / 1 有 FAIL 或 P0 / 2 无法判定(环境不具备、迁移链没到位、脚本异常)。
 *
 * 接线现状(如实登记,不是已完成):本脚本**未接入** guardian-runner / pre-commit,
 * 也不该接 —— 它判的是"本机有没有 PostgreSQL 二进制"这一维**机器状态**,CI 机器上没有 PG,
 * 接成 blocking 就是恒红门,唯一结局是逼人 `--no-verify` 连带废掉全部守门(§12e 同型)。
 * 问责入口是上面两条手动命令 + 同包 `tests/tenant-rls-live.test.ts`(CI 上必须喊"未判定")。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { TENANT_RLS_TABLES } from './tenant-rls-policy-check.mjs'
import { selfTest } from './tenant-rls-live-selftest.mjs'
import {
  OWNER_ROLE,
  MEMBER_ROLE,
  TABLE_ANCHORS,
  seedSql,
  expectedIds,
  allTenantIds,
  seedRowCount,
  splitIds,
  buildJudgementPlan,
  judgeOne,
  firstLine,
  lastNonEmptyLine,
  parseProbeOutput,
  NO1,
  NO2,
  U1,
} from './tenant-rls-live-fixture.mjs'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(PKG_DIR, '..', '..')
const DRIZZLE_DIR = join(PKG_DIR, 'drizzle')
const JOURNAL_PATH = join(DRIZZLE_DIR, 'meta', '_journal.json')
const RLS_MIGRATION_TAG = '20260927100000_tenant_rls_policies_batch1'

/** 生产端口(§5 铁律)。本脚本任何一次连接都不得落到这两个端口上。 */
export const PRODUCTION_PORTS = Object.freeze([8810, 8811])
/** 本机实测已有实例的端口;与既有实例共用端口 = 撞别人的数据。 */
export const ALREADY_USED_PORTS = Object.freeze([5432])
export const FORBIDDEN_PORTS = Object.freeze([...PRODUCTION_PORTS, ...ALREADY_USED_PORTS])
/** 任务书指定的候选端口;都空闲时按顺序取第一个。 */
export const PREFERRED_PORTS = Object.freeze([54320, 8899])

const DB_NAME = 'ihui_rls_live'
const SUPER_ROLE = 'postgres'
const DEFAULT_TIMEOUT_MS = 180_000

/* =================================================================== *
 * 1) 环境解析 + 三条隔离判据
 * =================================================================== */

/**
 * 找 PostgreSQL 二进制目录。优先 `IHUI_RLS_LIVE_PG_BIN`(换机 / CI),
 * 其次 Windows 上 `C:\Program Files\PostgreSQL\<大版本>\bin`,取能找到的**最高版本**
 * (pgvector 只在部分版本目录里,而迁移链需要它 —— 实测 PG18 有、PG17 无)。
 * @returns {{dir:string, version:string|null}|null} 找不到 ⇒ null(调用方判"未判定",不记绿)
 */
export function resolvePgBin(platform = process.platform, env = process.env) {
  const override = env.IHUI_RLS_LIVE_PG_BIN
  if (override) {
    return existsSync(join(override, binaryName('initdb', platform))) ? { dir: override, version: null } : null
  }
  if (platform === 'win32') {
    const found = []
    for (const root of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']) {
      if (!existsSync(root)) continue
      for (const entry of readdirSync(root)) {
        if (!/^\d+$/.test(entry)) continue
        const bin = join(root, entry, 'bin')
        if (existsSync(join(bin, binaryName('initdb', platform)))) found.push({ dir: bin, version: entry })
      }
    }
    found.sort((a, b) => Number(b.version) - Number(a.version))
    return found[0] ?? null
  }
  const probe = spawnSync('initdb', ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 15_000 })
  if (probe.status !== 0) return null
  return { dir: '', version: /(\d+\.\d+)/.exec(probe.stdout || '')?.[1] ?? null }
}

function binaryName(exe, platform = process.platform) {
  return platform === 'win32' ? `${exe}.exe` : exe
}

/**
 * 端口判据:**先否后取**。选定端口若落在生产端口 / 既有实例端口上直接判死 ——
 * 连"试一试"都不给(试一次就是一次真实连接)。
 * @throws {Error}
 */
export function assertPortChoice(port) {
  const n = Number(port)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error(`端口 ${port} 不合法(必须 1024..65535)`)
  if (PRODUCTION_PORTS.includes(n)) throw new Error(`端口 ${n} 是生产 PostgreSQL/Redis 端口(§5 测试隔离铁律),绝不允许使用`)
  if (ALREADY_USED_PORTS.includes(n)) throw new Error(`端口 ${n} 是本机既有 PostgreSQL 实例端口(实测),不得共用 —— 换候选端口`)
  return n
}

/** 一次 TCP 连接尝试:能连上 = 有东西在听(占用);连不上 = 空闲。 */
export function probePortBusy(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((settled) => {
    const socket = net.connect({ host, port })
    let done = false
    const finish = (busy, detail) => {
      if (done) return
      done = true
      socket.destroy()
      settled({ busy, detail })
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true, 'established'))
    socket.once('timeout', () => finish(false, 'connect-timeout'))
    socket.once('error', (error) => finish(false, error?.code ?? String(error)))
  })
}

/**
 * data dir 落点判据(§15 工作区卫生 + §15b 项目外落点唯一制)。
 * 允许:仓库内 `<repo>/.ihui-agent/tmp/**`;或 `<盘>:\DevEnv\Temp\**`(§26 的 TEMP 唯一根)。
 * 禁止:C:\temp、盘根、家目录,以及任何"看上去差不多"的第五个落点。
 * @throws {Error}
 */
export function assertDataDirAllowed(candidate, repoRoot = REPO_ROOT) {
  const p = resolve(candidate)
  const norm = (s) => String(s).replace(/[\\/]+$/g, '').toLowerCase()
  const lower = norm(p)
  const home = norm(process.env.USERPROFILE || process.env.HOME || '')
  if (/^[a-z]:[\\/]$/.test(`${lower}\\`)) throw new Error(`data dir ${p} 落在盘根 —— §15 禁止`)
  if (/^[a-z]:[\\/](temp|tmp)([\\/]|$)/.test(`${lower}\\`)) throw new Error(`data dir ${p} 落在 <盘根>\\temp|tmp —— §15 明令禁止`)
  if (home && (lower === home || lower.startsWith(`${home}\\`) || lower.startsWith(`${home}/`))) {
    throw new Error(`data dir ${p} 落在用户家目录 —— §15/§26 禁止`)
  }
  const projectTmp = norm(join(repoRoot, '.ihui-agent', 'tmp'))
  const inProject = lower.startsWith(`${projectTmp}\\`) || lower.startsWith(`${projectTmp}/`)
  const devEnvTemp = norm(`${driveOf(p)}:\\DevEnv\\Temp`)
  const inDevEnvTemp = lower === devEnvTemp || lower.startsWith(`${devEnvTemp}\\`) || lower.startsWith(`${devEnvTemp}/`)
  if (!inProject && !inDevEnvTemp) {
    throw new Error(`data dir ${p} 不在允许的两个落点之内(仓库内 .ihui-agent/tmp/** 或 <盘>:\\DevEnv\\Temp\\**)—— §15b 不新增第五个落点`)
  }
  return p
}

function driveOf(p) {
  const m = /^([a-zA-Z]):/.exec(resolve(p))
  if (!m) throw new Error(`路径 ${p} 推不出盘符,拒绝(不猜临时物落点)`)
  return m[1].toUpperCase()
}

/**
 * 角色 DDL。`NOSUPERUSER NOBYPASSRLS` 是本票存在理由的字面表达 ——
 * 超级用户 / BYPASSRLS 角色**根本不求值策略**(迁移头注已写),
 * 用它们跑出来的"绿"什么都证明不了。两条角色都要 LOGIN,否则 psql 连不上 ⇒ 整轮闪成 SKIP。
 */
export function buildRoleDdl() {
  const mk = (role) =>
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN ` +
    `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION; END IF; END $$;`
  return [mk(OWNER_ROLE), mk(MEMBER_ROLE)]
}

/** 回读 pg_roles 的**实测**属性(不是"我们写了 NOBYPASSRLS 所以它一定是 false")。 */
export function roleAttrSql(role) {
  return `SELECT 'rolsuper=' || rolsuper || '|rolbypassrls=' || rolbypassrls || '|rolcanlogin=' || rolcanlogin FROM pg_roles WHERE rolname = '${role}';`
}

/**
 * **唯一**的 psql 参数出口:任何一次连接都在这里再过一遍端口判据。
 * 这不是防御性重复 —— 上面 assertPortChoice 只在"选端口"时跑一次,而判据矩阵有上百次连接;
 * 把断言放进参数构造,才让"某处忘了用选定端口"变成不可能而不是"应该没忘"。
 */
export function psqlArgs({ port, user, database, inline, file, stopOnError = true }) {
  const n = Number(port)
  if (FORBIDDEN_PORTS.includes(n)) throw new Error(`内部护栏:拒绝对端口 ${n} 发起连接(生产 / 既有实例端口)`)
  if (String(user) === SUPER_ROLE && n === 5432) throw new Error('内部护栏:不得以 postgres 身份连既有实例')
  const args = ['-h', '127.0.0.1', '-p', String(n), '-U', user, '-d', database, '-X', '-q', '-tA']
  if (stopOnError) args.push('-v', 'ON_ERROR_STOP=1')
  if (file) args.push('-f', file)
  if (inline) args.push('-c', inline)
  return args
}


/* =================================================================== *
 * 4) 执行
 * =================================================================== */

function shRun(exe, args, opt = {}) {
  const r = spawnSync(exe, args, {
    windowsHide: true, // §5b:缺这个参数 = 用户桌面反复弹窗
    timeout: opt.timeout ?? DEFAULT_TIMEOUT_MS,
    env: { ...process.env, PGCONNECT_TIMEOUT: '5' },
    // opt.quiet ⇒ 完全不创建管道:pg_ctl start 的后端子进程会**继承**管道句柄,
    // 于是 spawnSync 等到超时才返回(第一次探针就卡在这上面,现象是"启动挂死")。
    ...(opt.quiet ? { stdio: 'ignore' } : { encoding: 'utf8', maxBuffer: opt.maxBuffer ?? 64 * 1024 * 1024 }),
  })
  if (r.error) return { status: 1, stdout: '', stderr: String(r.error.message ?? r.error), spawnFailed: true }
  return { status: r.status ?? 1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() }
}

function makePsql(binDir, port) {
  const exe = binDir ? join(binDir, binaryName('psql')) : 'psql'
  return function psql(user, database, inline, { timeout = 60_000 } = {}) {
    const args = psqlArgs({ port, user, database, inline })
    const r = shRun(exe, args, { timeout })
    // value 只认探针标记(ROWS|… / AFFECTED=n);rawValue 给没有标记的管理/诊断语句用。
    // 两个出口必须分开:取"第一行非空输出"会把 set_config() 打的 true 当成探针读数
    // (第一轮真跑的全部 rows= 判据因此数字全错,而表面像"判过了");只认标记又会让
    // select 1 读成 null ⇒ 数据库明明 ready 却报"未就绪"(第二轮栽在这一格)。
    const parsed = parseProbeOutput(r.stdout)
    return {
      status: r.status,
      value: parsed.value,
      kind: parsed.kind,
      rawValue: lastNonEmptyLine(r.stdout),
      stdout: r.stdout,
      stderr: (r.stderr || r.stdout || '').trim(),
      transportFailure: !!r.spawnFailed,
      detail: r.stderr,
    }
  }
}

function runSqlFile(exe, port, user, database, file, timeout) {
  const args = psqlArgs({ port, user, database, file })
  return shRun(exe, args, { timeout: timeout ?? DEFAULT_TIMEOUT_MS })
}

/**
 * 启动临时集群。**必须走 pg_ctl,不能直接 spawn postgres.exe** —— 实测直接 spawn 时
 * PostgreSQL 拒绝以管理员令牌运行并写日志:
 *   "Execution of PostgreSQL by a user with administrative permissions is not permitted."
 * pg_ctl 自己会以受限令牌拉起后端子进程,并且拉起后即返回(不随本进程退出)。
 * stdio 一律 'ignore' 且**不给管道句柄**:实测 `pg_ctl -w start` 把 stdout 接到管道时,
 * 后端子进程继承该句柄 → 管道永不 EOF → 调用方挂死(第一次探针就卡在这里)。
 */
function startViaPgCtl({ pgCtlExe, dataDir, port, logFile }) {
  const opts = [
    '-p', String(port),
    '-c', 'listen_addresses=127.0.0.1', // 只绑回环:trust 认证的临时集群绝不外放
    '-c', 'fsync=off',
    '-c', 'full_page_writes=off',
    '-c', 'synchronous_commit=off',
    '-c', 'max_connections=40',
  ].join(' ')
  const r = shRun(pgCtlExe, ['-D', dataDir, '-l', logFile, '-o', opts, 'start'], { timeout: 120_000, quiet: true })
  let pid = null
  try {
    pid = Number(readFileSync(join(dataDir, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0]) || null
  } catch {
    /* 没起来时读不到,交给后面的就绪等待去判 */
  }
  return { ok: r.status === 0, rc: r.status, detail: firstLine(r.stdout || r.stderr), pid }
}

function replayMigrations(psqlExe, port, targetIdx) {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'))
  const entries = journal.entries.filter((e) => e.idx <= targetIdx)
  const failures = []
  for (const entry of entries) {
    const file = join(DRIZZLE_DIR, `${entry.tag}.sql`)
    if (!existsSync(file)) {
      failures.push({ idx: entry.idx, tag: entry.tag, error: '迁移文件不存在' })
      continue
    }
    const r = runSqlFile(psqlExe, port, SUPER_ROLE, DB_NAME, file, 300_000)
    if (r.status !== 0) failures.push({ idx: entry.idx, tag: entry.tag, error: firstLine(r.stderr) || firstLine(r.stdout) || `psql rc=${r.status}` })
  }
  return { applied: entries.length - failures.length, total: entries.length, failures }
}

function tableFacts(psql, tables) {
  const inlist = tables.map((t) => `'${t}'`).join(',')
  const r = psql(SUPER_ROLE, DB_NAME, `SELECT string_agg(relname || ':rls=' || relrowsecurity || ':force=' || relforcerowsecurity || ':owner=' || owner, ' ') FROM (SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN (${inlist})) s;`)
  return r.rawValue || '(读不到)'
}

async function runLive(report, opts, pg) {
  const psqlExe = pg.dir ? join(pg.dir, binaryName('psql')) : 'psql'
  const initdbExe = pg.dir ? join(pg.dir, binaryName('initdb')) : 'initdb'
  const pgCtlExe = pg.dir ? join(pg.dir, binaryName('pg_ctl')) : 'pg_ctl'
  const port = opts.port

  if (opts.fresh || !existsSync(join(opts.dataDir, 'PG_VERSION'))) {
    rmSync(opts.dataDir, { recursive: true, force: true })
    const r = shRun(initdbExe, ['-D', opts.dataDir, '-A', 'trust', '-U', SUPER_ROLE, '--encoding=UTF8', '--locale=C'], { timeout: 300_000 })
    if (r.status !== 0) throw new Undetermined(`initdb 失败:${(r.stderr || r.stdout).slice(0, 300)}`)
    report.environment.initdb = '本次新建(--fresh 或不存在)'
  } else {
    report.environment.initdb = '复用已存在的临时 data dir(仅当 --fresh 未给)'
  }

  const started = startViaPgCtl({ pgCtlExe, dataDir: opts.dataDir, port, logFile: opts.logFile })
  report.environment['pg_ctl start'] = `rc=${started.rc} ${started.detail}`
  report.environment.postmasterPid = started.pid ?? null
  if (!started.ok) throw new Undetermined(`pg_ctl start 失败 rc=${started.rc}: ${started.detail}`)

  const psql = makePsql(pg.dir, port)
  const deadline = Date.now() + 60_000
  let ready = false
  while (Date.now() < deadline) {
    const r = psql(SUPER_ROLE, 'postgres', 'select 1', { timeout: 8_000 })
    if (r.status === 0 && r.rawValue === '1') {
      ready = true
      break
    }
    await new Promise((res) => setTimeout(res, 500))
  }
  if (!ready) {
    // 判据失效必须"响且可诊断":只写"没起来"等于让下一个接手的人重新猜一遍。
    let logTail = '(读不到 server.log)'
    try {
      logTail = readFileSync(opts.logFile, 'utf8').split(/\r?\n/).slice(-12).join(' | ')
    } catch {
      /* 日志没写出来本身就是信息 */
    }
    throw new Undetermined(`postgres 在端口 ${port} 60s 内未就绪。server.log 末段:${logTail}`)
  }

  report.meta.pgVersion = psql(SUPER_ROLE, 'postgres', 'show server_version').rawValue

  psql(SUPER_ROLE, 'postgres', `DROP DATABASE IF EXISTS ${DB_NAME}`)
  const createdb = psql(SUPER_ROLE, 'postgres', `CREATE DATABASE ${DB_NAME}`)
  if (createdb.status !== 0) throw new Undetermined(`建一次性库失败:${(createdb.stderr || '').slice(0, 200)}`)

  const replay = replayMigrations(psqlExe, port, opts.targetIdx)
  report.replay = { targetIdx: opts.targetIdx, applied: replay.applied, total: replay.total, failureCount: replay.failures.length, failures: replay.failures.slice(0, 25) }

  const tables = TENANT_RLS_TABLES.map((t) => t.table)
  report.environment['RLS 属性实测(迁移重放后)'] = tableFacts(psql, tables)
  if (replay.failures.some((f) => f.idx === opts.targetIdx)) {
    throw new Undetermined(`本票要验的迁移 idx=${opts.targetIdx} 自己失败了:${firstLine(replay.failures.find((f) => f.idx === opts.targetIdx).error)}`)
  }

  const setupSql = [
    ...buildRoleDdl(),
    ...tables.map((t) => `ALTER TABLE public.${t} OWNER TO ${OWNER_ROLE};`),
    // harness 授权:迁移刻意不补 GRANT(见其"已知失效方向"第 6 条)。这里补上,才能让
    // "非属主主体"那一路把行集差异**归因到 RLS** 而不是 permission denied。
    `GRANT USAGE ON SCHEMA public TO ${MEMBER_ROLE};`,
    `GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO ${MEMBER_ROLE};`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${MEMBER_ROLE};`,
    // 判定函数是 SECURITY INVOKER ⇒ 调用者自己要有底表 SELECT
    `GRANT SELECT ON public.team_members, public.team_knowledge_space_members TO ${OWNER_ROLE}, ${MEMBER_ROLE};`,
  ].join('\n')
  const setupFile = writeTempSql(resolve(opts.clusterDir), 'setup', setupSql)
  const setup = runSqlFile(psqlExe, port, SUPER_ROLE, DB_NAME, setupFile)
  if (setup.status !== 0) throw new Undetermined(`角色/属主/授权初始化失败:${(setup.stderr || setup.stdout).slice(0, 300)}`)

  for (const role of [OWNER_ROLE, MEMBER_ROLE]) report.meta.roles[role] = psql(SUPER_ROLE, DB_NAME, roleAttrSql(role)).rawValue || '(读不到)'
  report.environment['RLS 属性实测(改属主后)'] = tableFacts(psql, tables)

  const seedFile = writeTempSql(resolve(opts.clusterDir), 'seed', seedSql())
  const seed = runSqlFile(psqlExe, port, SUPER_ROLE, DB_NAME, seedFile)
  report.seed = { ok: seed.status === 0, fact: seed.stdout || null, error: seed.status === 0 ? null : (seed.stderr || seed.stdout).slice(0, 400) }
  if (seed.status !== 0) throw new Undetermined(`夹具播种失败(判据将对着空库打分):${(seed.stderr || seed.stdout).slice(0, 300)}`)

  for (const spec of buildJudgementPlan()) {
    let restored = null
    if (spec.mutate === 'no-force') {
      const off = psql(SUPER_ROLE, DB_NAME, `ALTER TABLE public.${spec.table} NO FORCE ROW LEVEL SECURITY;`)
      if (off.status !== 0) {
        report.judgements.push({ table: spec.table, id: spec.id, role: spec.role, verdict: 'SKIP', detail: `变异操作本身失败:${(off.stderr || '').slice(0, 140)}` })
        continue
      }
    }
    let obs
    try {
      obs = psql(spec.role, DB_NAME, spec.probe.sql, { timeout: opts.probeTimeout })
    } catch (error) {
      obs = { transportFailure: true, detail: String(error?.message ?? error) }
    }
    const judged = judgeOne(spec, obs)
    report.judgements.push({ table: spec.table, id: spec.id, role: spec.role, verdict: judged.verdict, detail: judged.detail, note: spec.note, informational: !!spec.informational })
    if (spec.mutate === 'no-force') {
      const back = psql(SUPER_ROLE, DB_NAME, `ALTER TABLE public.${spec.table} FORCE ROW LEVEL SECURITY;`)
      restored = back.status === 0 ? 'FORCE 已装回' : `FORCE 装回失败:${(back.stderr || '').slice(0, 120)}`
    }
    if (restored) report.judgements[report.judgements.length - 1].restored = restored
  }
  report.environment['变异后 FORCE 终态实测'] = tableFacts(psql, tables)

  // 收尾前先取一次"库里到底有没有夹具行"的独立读数(与 seed 那条自证互不替代)
  report.environment['判据跑完后各表总行数'] = psql(SUPER_ROLE, DB_NAME, `SELECT string_agg(lbl, ' ') FROM (SELECT 'spaces=' || count(*)::text AS lbl FROM public.team_knowledge_spaces UNION ALL SELECT 'items=' || count(*)::text AS lbl FROM public.team_knowledge_items UNION ALL SELECT 'notes=' || count(*)::text AS lbl FROM public.notes UNION ALL SELECT 'docs=' || count(*)::text AS lbl FROM public.zhs_knowledge_doc UNION ALL SELECT 'memories=' || count(*)::text AS lbl FROM public.user_memories UNION ALL SELECT 'favorites=' || count(*)::text AS lbl FROM public.image_gen_favorites) s;`).rawValue

  summarize(report)
  const undeterminedCount = report.judgements.filter((j) => j.verdict === 'SKIP').length
  if (report.judgements.length > 0 && report.judgements.every((j) => j.verdict === 'SKIP')) {
    throw new Undetermined(`${report.judgements.length} 条判据全部 SKIP ⇒ 一条都没判动,不能记为通过`)
  }
  report.verdict = report.summary.fail + report.summary.p0 > 0 ? 'fail' : 'pass'
  report.environment.skipCount = undeterminedCount
  return report.verdict === 'pass' ? 0 : 1
}

class Undetermined extends Error {}

function writeTempSql(dir, name, sql) {
  const file = join(dir, `${name}-${process.pid}.sql`)
  writeFileSync(file, sql, 'utf8')
  return file
}

function summarize(report) {
  for (const j of report.judgements) {
    if (j.verdict === 'PASS') report.summary.pass += 1
    else if (j.verdict === 'FAIL') report.summary.fail += 1
    else if (j.verdict === 'P0') report.summary.p0 += 1
    else if (j.verdict === 'INFO') report.summary.info += 1
    else report.summary.skip += 1
  }
}

function print(report) {
  const out = []
  out.push('=== O13 第二格:租户 RLS 运行时对账 ===')
  out.push(`PG 版本: ${report.meta.pgVersion ?? '(未取到)'}  |  端口: ${report.meta.port ?? '(未选定)'}  |  data dir: ${report.meta.dataDir ?? '(未选定)'}`)
  for (const [k, v] of Object.entries(report.meta.roles || {})) out.push(`  角色属性实测 ${k}: ${v}`)
  out.push('')
  out.push('--- 环境 / 实测 ---')
  for (const [k, v] of Object.entries(report.environment || {})) out.push(`  ${k}: ${v}`)
  if (report.replay) {
    out.push(`--- 迁移重放:到 idx=${report.replay.targetIdx},成功 ${report.replay.applied}/${report.replay.total},失败 ${report.replay.failureCount} ---`)
    for (const f of report.replay.failures || []) out.push(`    ✗ idx=${f.idx} ${f.tag}:${f.error}`)
  }
  if (report.seed) out.push(`--- 夹具自证:${report.seed.ok ? report.seed.fact : `失败 ${report.seed.error}`} ---`)
  if (report.judgements.length) {
    out.push('')
    out.push('--- 逐表 × 逐判据 ---')
    let last = ''
    for (const j of report.judgements) {
      if (j.table !== last) {
        out.push(`  ▸ ${j.table}`)
        last = j.table
      }
      const flag = { PASS: '✓', FAIL: '✗', P0: '!!', SKIP: '-', INFO: 'i' }[j.verdict] || '?'
      out.push(`      ${flag} [${j.role}] ${j.id} => ${j.verdict} —— ${j.detail || ''}${j.note ? ` (${j.note})` : ''}`)
    }
    const s = report.summary
    out.push('')
    out.push(`--- 汇总:PASS ${s.pass} / FAIL ${s.fail} / P0 ${s.p0} / SKIP ${s.skip} / INFO ${s.info},共 ${report.judgements.length} 条 ---`)
  }
  if (report.cleanup?.length) {
    out.push('')
    out.push('--- 收尾实测 ---')
    for (const c of report.cleanup) out.push(`  ${c}`)
  }
  out.push('')
  out.push(`>>> 结论:${report.verdict}`)
  if (report.exitCode !== undefined) out.push(`>>> 退出码:${report.exitCode}`)
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : out.join('\n'))
}

/** 零副作用:只回答"这台机器能不能跑本票的运行时判据",不 initdb、不起进程、不连库。 */
async function checkMode(report) {
  const pg = resolvePgBin()
  report.environment['PostgreSQL 二进制'] = pg ? `${pg.dir || 'PATH'}(版本 ${pg.version ?? '未知'})` : '未找到 ⇒ 本票的运行时判据在此环境**未判定**,不得记为通过'
  for (const p of [...PREFERRED_PORTS, ...FORBIDDEN_PORTS]) {
    const busy = await probePortBusy(p)
    const tag = PRODUCTION_PORTS.includes(p) ? '生产端口(禁止)' : ALREADY_USED_PORTS.includes(p) ? '既有实例端口(禁止)' : '候选端口'
    report.environment[`端口 ${p} ${tag}`] = busy.busy ? `有监听(${busy.detail})` : `空闲(${busy.detail})`
  }
  const intended = join(REPO_ROOT, '.ihui-agent', 'tmp', 'o13-cluster', 'data')
  try {
    assertDataDirAllowed(intended)
    report.environment['data dir 落点'] = `${intended} ⇒ 通过落点判据(本次不创建)`
  } catch (error) {
    report.environment['data dir 落点'] = `拒绝:${error.message}`
  }
  report.environment['纳管表清单'] = `${TENANT_RLS_TABLES.length} 张:${TENANT_RLS_TABLES.map((t) => t.table).join(', ')}`
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8'))
  const target = journal.entries.find((e) => e.tag === RLS_MIGRATION_TAG)
  report.environment['目标迁移'] = target ? `${target.tag}(idx=${target.idx},journal 共 ${journal.entries.length} 条)` : '未登记 ⇒ 无法判'
  report.verdict = pg ? 'available' : 'undetermined'
  report.exitCode = pg ? 0 : 2
  print(report)
  return report.exitCode
}

async function main(argv) {
  const opts = parseArgs(argv)
  const report = {
    meta: { startedAt: new Date().toISOString(), port: opts.port ?? null, pgVersion: null, dataDir: null, roles: {} },
    environment: {}, replay: null, seed: null, judgements: [], cleanup: [], verdict: 'undetermined',
    summary: { pass: 0, fail: 0, p0: 0, skip: 0, info: 0 },
  }
  if (opts.selfTest) return selfTest({ repoRoot: REPO_ROOT, driveOf, liveScriptPath: fileURLToPath(import.meta.url) })
  if (opts.check) return checkMode(report)
  if (opts.help) {
    console.log('用法: node tenant-rls-live-check.mjs [--check|--self-test|--json|--keep|--fresh|--port <n>|--data-dir <p>|--target-idx <n>];判据与退出码见文件头注释')
    return 0
  }

  const pg = resolvePgBin()
  if (!pg) {
    report.environment.pgBin = '未找到 PostgreSQL 二进制(试过 IHUI_RLS_LIVE_PG_BIN 与 C:\\Program Files\\PostgreSQL\\<ver>\\bin,以及 PATH 上的 initdb)'
    report.exitCode = 2
    print(report)
    return 2
  }

  // 端口:先过判据,再实测空闲
  if (opts.port) assertPortChoice(opts.port)
  else {
    for (const candidate of PREFERRED_PORTS) {
      assertPortChoice(candidate)
      const busy = await probePortBusy(candidate)
      report.environment[`端口 ${candidate}`] = busy.busy ? `被占用(${busy.detail}),跳过` : `空闲(${busy.detail})⇒ 选用`
      if (!busy.busy) {
        opts.port = candidate
        break
      }
    }
  }
  if (!opts.port) {
    report.environment.port = '候选端口全被占用,而生产端口 / 既有实例端口判死 ⇒ 开不出临时集群,不记绿'
    report.exitCode = 2
    print(report)
    return 2
  }
  report.meta.port = opts.port
  for (const p of PRODUCTION_PORTS) {
    const busy = await probePortBusy(p)
    report.environment[`生产端口 ${p}`] = busy.busy ? `有监听(${busy.detail})⇒ 本轮全程未连接它` : `无监听(${busy.detail})`
  }

  const dataDir = assertDataDirAllowed(opts.dataDir ?? join(REPO_ROOT, '.ihui-agent', 'tmp', 'o13-cluster', 'data'))
  const clusterDir = dirname(dataDir)
  opts.dataDir = dataDir
  opts.clusterDir = clusterDir
  opts.logFile = join(clusterDir, 'server.log')
  report.meta.dataDir = dataDir
  mkdirSync(clusterDir, { recursive: true })

  let code = 2
  try {
    code = await runLive(report, opts, pg)
  } catch (error) {
    if (error instanceof Undetermined) {
      report.verdict = 'undetermined'
      report.environment['终止原因'] = error.message
    } else {
      report.verdict = 'undetermined'
      report.environment['脚本异常'] = `${error?.message ?? error}`
      report.environment['异常栈首行'] = firstLine(error?.stack || '')
    }
    code = 2
  } finally {
    // ---- 收尾:失败也要收 ----
    if (!opts.keep) {
      const pgCtlExe = pg.dir ? join(pg.dir, binaryName('pg_ctl')) : 'pg_ctl'
      const stop = shRun(pgCtlExe, ['-D', dataDir, '-m', 'fast', 'stop'], { timeout: 90_000 })
      report.cleanup.push(`pg_ctl stop -m fast ⇒ rc=${stop.status} ${firstLine(stop.stdout || stop.stderr)}`)
      if (stop.status !== 0) {
        const force = shRun(pgCtlExe, ['-D', dataDir, '-m', 'immediate', 'stop'], { timeout: 90_000 })
        report.cleanup.push(`回退 -m immediate ⇒ rc=${force.status} ${firstLine(force.stdout || force.stderr)}`)
      }
      rmSync(clusterDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 400 })
      report.cleanup.push(`删除临时目录 ${clusterDir} ⇒ existsSync=${existsSync(clusterDir)}`)
      const busy = await probePortBusy(opts.port, '127.0.0.1', 800)
      report.cleanup.push(`端口 ${opts.port} 收尾实测 ⇒ ${busy.busy ? `仍在监听(${busy.detail})= 没收干净` : `已释放(${busy.detail})`}`)
    } else {
      report.cleanup.push(`--keep:集群未停,port=${opts.port},dataDir=${dataDir}(手工收尾:pg_ctl -D "${dataDir}" -m fast stop && 删该目录)`)
    }
  }
  report.exitCode = code
  print(report)
  return code
}


function parseArgs(argv) {
  const opts = { targetIdx: 293, probeTimeout: 60_000 }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--self-test') opts.selfTest = true
    else if (a === '--check') opts.check = true
    else if (a === '--keep') opts.keep = true
    else if (a === '--fresh') opts.fresh = true
    else if (a === '--json') {
      /* print() 直接读 process.argv 决定输出形态,这里不重复记录 */
    } else if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--data-dir') opts.dataDir = argv[++i]
    else if (a === '--target-idx') opts.targetIdx = Number(argv[++i])
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`[tenant-rls-live-check] 执行失败:${error?.message ?? error}\n${error?.stack ?? ''}`)
      process.exit(2)
    })
}

/** §22c 双形态出口:镜像测试 import 判据本身,不触发 CLI 副作用。 */
export const __test__ = {
  // 隔离判据(本文件)
  PRODUCTION_PORTS, ALREADY_USED_PORTS, PREFERRED_PORTS, FORBIDDEN_PORTS, SUPER_ROLE,
  resolvePgBin, assertPortChoice, probePortBusy, assertDataDirAllowed, buildRoleDdl, roleAttrSql, psqlArgs,
  // 夹具与判据层(./tenant-rls-live-fixture.mjs —— 只有一份实现,禁止在测试里再抄)
  OWNER_ROLE, MEMBER_ROLE, TABLE_ANCHORS, seedSql, expectedIds, allTenantIds, seedRowCount,
  buildJudgementPlan, judgeOne, parseProbeOutput, lastNonEmptyLine, splitIds,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
