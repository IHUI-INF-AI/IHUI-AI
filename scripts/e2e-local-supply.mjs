#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */

/**
 * scripts/e2e-local-supply.mjs —— 本机 Playwright e2e「最小供给面」的唯一出口(2026-10-23 立)
 *
 * 立因(全部为当次实测,不是抄票面):
 *  - `apps/web/e2e/fixtures.ts` 的 `requireEnv('E2E_ADMIN_PASSWORD')` 写在**模块顶层**,
 *    所以凡 `import { test } from './fixtures'` 的 spec 在本地连 `--list` 都跑不动:
 *    表现是 `Error: No tests found.` + `Total: 0 tests in 0 files`,报错里没有一个字提到口令。
 *  - 这四个 e2e 键在仓内**只有 CI 侧供给面**(`.github/workflows/e2e.yml:140-141` 用
 *    `openssl rand` 现生成再 seed),本机没有任何对应出口 ⇒ 缺口属于"仓内该有而没有的本地供给面"。
 *  - 本脚本只补那一格:解析/回显供给面、组装安全默认值、把 playwright 起起来。
 *    它**不**新建第二份 seed SQL(动作 delegate 给仓内既有正牌出口
 *    `pnpm --filter @ihui/api run seed:test-users`,§0.6 单一真相源),
 *    也**不**碰任何产品运行码与既有判据。
 *
 * 三条硬纪律:
 *  1) 零凭据外泄:口令只从 process.env 或 gitignored 的 `apps/web/e2e/.env.e2e.local` 读;
 *     stdout 一律 `<set len=N>`,永不回显值、永不回显 DSN 口令段(sanitizeDsn)。
 *  2) 零共享库副作用:本出口派生的一切运行都强制 `E2E_SKIP_SEED=1` + `E2E_AUTO_CLEANUP=0`。
 *     不设这两条的后果是 globalSetup 往本机 dev 库写种子、globalTeardown **删** test 用户行
 *     (§12 多会话共享同一枚库,删别人的行是事故)。真要 seed 只有 `--provision-admin` 一条路,
 *     它必须显式给 `E2E_DATABASE_URL` 指向隔离库、且只 upsert 不删任何行。
 *  3) 不复用他席服务:`--base-url` 必填(无默认值)。8801/8802 常年是别席的 dev 进程,
 *     拿别人的服务跑 e2e ⇒ 失败无法归因本席。本席 web 的起法走 dev-with-warmup 已有的
 *     `IHUI_DEV_PORT` / `IHUI_BUILD_DIST` 参数化出口,本脚本不代起、只在 `--check` 里点名。
 *
 * 用法:
 *   node scripts/e2e-local-supply.mjs --check [--base-url http://localhost:<本席端口>]
 *   node scripts/e2e-local-supply.mjs --run --base-url http://localhost:<本席端口> -- \
 *     e2e/chat-pane-same-conv-noninterfere.spec.ts --project=chromium --no-deps
 *   node scripts/e2e-local-supply.mjs --stack --base-url=http://localhost:8877 -- \
 *     e2e/perf-long-session.spec.ts --project=chromium --no-deps   # 一条命令起隔离栈并跑
 *   CI=1 node scripts/e2e-local-supply.mjs --stack --prod --base-url=http://localhost:8877 -- \
 *     e2e/perf-long-session.spec.ts --project=chromium --no-deps    # CI 同形:next build + next start
 *   E2E_DATABASE_URL=postgres://user:pw@localhost:5432/ihui_e2e \
 *     node scripts/e2e-local-supply.mjs --provision-admin
 *   node scripts/e2e-local-supply.mjs --probe-login --api-url http://localhost:8809
 *
 * 带值旗标两种写法都收(`--k=v` 与 `--k v`)。**隔离档的 host 必须写 localhost**:
 * 端口≠8801 或 dist≠.next 时 dev 启动器把 `NEXT_PUBLIC_API_BASE_URL` 烘成
 * `http://localhost:<端口>`,用 127.0.0.1 打开页面即跨源 ⇒ 每个 /api/* 都被 CORS 拦成
 * net::ERR_FAILED(2026-10-31 实测,侧栏「加载失败」即此型)。`--stack` 直接拒收非
 * localhost,并在起隔离 API 时把 `TURNSTILE_SECRET_KEY` 置空(与 CI 同形;键在则脚本登录
 * 不带 turnstileToken 一律 403)。
 *
 * E2E_ADMIN_PASSWORD 有两档语义(不要混):
 *  - 只让模块加载过关:任意非空值即可 —— 全 route-mock 的 spec(如本票那枚)根本不发真登录;
 *  - 真跑 admin 登录腿:值必须与**在跑的那台 API 连的那枚库**里的行匹配 ——
 *    只有 --provision-admin 产出的口令算数,且要用 --probe-login 量出来才算,不靠话说。
 *
 * 退出码:0 = 供给面齐备(或子进程 0)/ 1 = 子进程失败 / 2 = 未判定或供给面缺口(§0.3)
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomBytes } from 'node:crypto'

import { parseEnvText } from './check-env-drift.mjs'
import { guardDbDsn, sanitizeDsn } from './lib/db-probe-client.mjs'
import { planPackageManagerSpawn } from './lib/npm-execpath.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB_DIR = path.join(ROOT, 'apps', 'web')
/** 本机供给面文件:被 `apps/web/.gitignore` 的 `.env*.local` 规则忽略(git check-ignore 实测) */
const SUPPLY_FILE = path.join(WEB_DIR, 'e2e', '.env.e2e.local')

/**
 * 供给面清单(唯一一份;--check 的表由它渲染,不再手抄第二遍)。
 * tier 的语义:
 *  - module-load : 不给就**结构上跑不起来**(所有 fixtures 使用者一起死)
 *  - leg-*       : 只影响对应那条腿(不给则该腿红,其余照跑)
 *  - local-safe  : 本出口强制注入,防止多会话互相拆台
 *  - transport   : 打到哪台服务
 */
const SUPPLY_FACE = [
  {
    key: 'E2E_ADMIN_PASSWORD',
    tier: 'module-load',
    repoDefault: null,
    note: 'fixtures.ts 顶层 requireEnv ⇒ 缺失即整文件加载失败;全仓不提供默认值(设计如此)',
  },
  {
    key: 'E2E_ADMIN_ACCOUNT',
    tier: 'leg-admin',
    repoDefault: 'e2e_admin',
    note: '必须与库内 username/email 逐字等值(findUserByAccount 走 username∨phone∨email);默认值在本地库对不上即 admin 腿 401',
  },
  {
    key: 'E2E_USER_ACCOUNT',
    tier: 'leg-user',
    repoDefault: 'test@aizhs.top',
    note: '由 seed:test-users 建的行;全 route-mock 的 spec 不需要它',
  },
  {
    key: 'E2E_USER_PASSWORD',
    tier: 'leg-user',
    repoDefault: '(无,env-only)',
    note: '普通用户腿;2026-10-30 起 fixtures/seed 也走 env-only(此前仓内公开字面量已清除)',
  },
  {
    key: 'PLAYWRIGHT_BASE_URL',
    tier: 'transport',
    repoDefault: 'http://localhost:8801',
    note: 'playwright.config.ts 的 use.baseURL 与 webServer.url 同读此键;本出口要求显式 --base-url',
  },
  {
    key: 'E2E_SKIP_SEED',
    tier: 'local-safe',
    repoDefault: '(未设 ⇒ globalSetup 跑两次 seed 写本机 dev 库)',
    note: '本出口强制 =1;多会话并发 seed 会把登录接口瞬时顶成 500',
  },
  {
    key: 'E2E_AUTO_CLEANUP',
    tier: 'local-safe',
    repoDefault: '(未设 ⇒ globalTeardown 删 test 用户行)',
    note: '本出口强制 =0;删行在共享库上是跨会话事故,不是清理',
  },
  {
    key: 'PLAYWRIGHT_REUSE_SERVER',
    tier: 'transport',
    repoDefault: '(本地默认 true)',
    note: '端口已监听即复用本席所起服务;要逼 playwright 自己起 ⇒ 设 =0(会撞 webServer 的 pnpm dev)',
  },
  {
    key: 'E2E_DATABASE_URL',
    tier: 'seed-leg',
    repoDefault: '(无 ⇒ seed 落 apps/api/.env 的库)',
    note: '仅 --provision-admin 需要;必须是隔离库(本机回环 + 非 8810,判据 import db-probe-client)',
  },
]

/** 口令只报"有无 + 长度",永不报前缀(前缀也算凭据面) */
export function maskSecret(value) {
  if (value === undefined || value === null || value === '') return '<absent>'
  return `<set len=${String(value).length}>`
}

/**
 * 键值展示面单源:PASSWORD 型整枚遮罩;DSN 型只脱口令段(保 host/db 可辨识);其余直显。
 * 2026-10-28 补:此前只判 /PASSWORD/,而 E2E_DATABASE_URL 的口令是嵌在 URL 里的
 * ⇒ `--check` 曾把整串含口令打到 stdout,与本文件头注「永不回显 DSN 口令段」正面冲突。
 */
export function shownValueOf(key, value) {
  if (value === undefined || value === null || value === '') return '<absent>'
  if (/PASSWORD/.test(key)) return maskSecret(value)
  if (/(_URL|_DSN|_URI)$/.test(key)) return sanitizeDsn(value)
  return String(value)
}

/** 单键取值序:process.env > 本机供给面文件 > 仓内默认值 ⇒ 附出处 */
export function resolveValue(key, env, fileValues) {
  const fromEnv = env[key]
  if (fromEnv !== undefined && fromEnv !== '') return { value: fromEnv, source: 'process.env' }
  const fromFile = fileValues.get(key)
  if (fromFile !== undefined && fromFile !== '') return { value: fromFile, source: SUPPLY_FILE }
  const spec = SUPPLY_FACE.find((s) => s.key === key)
  if (spec && typeof spec.repoDefault === 'string' && !spec.repoDefault.startsWith('(')) {
    return { value: spec.repoDefault, source: '仓内默认值' }
  }
  return { value: undefined, source: '<absent>' }
}

/** 读供给面文件;不存在 ⇒ 空表 + exists=false(不是错误,是"这台机还没供给") */
export function readSupplyFile(file = SUPPLY_FILE) {
  if (!existsSync(file)) return { exists: false, values: new Map() }
  return { exists: true, values: parseEnvText(readFileSync(file, 'utf8')).values }
}

/**
 * 把"落一行 KEY=VALUE 到供给面文件"收成唯一出口:同名键就地替换,不追加第二份
 * (dotenv last-wins 会把前一份静默吃掉,留下看不见的双写)。
 */
export function writeSupplyLine(text, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, 'm')
  if (re.test(text)) return text.replace(re, line)
  const base = text.endsWith('\n') || text === '' ? text : `${text}\n`
  return `${base}${line}\n`
}

/** playwright CLI 入口:按包名解析,不硬编码 .pnpm 版本号目录(版本号一升就悬空) */
export function resolvePlaywrightCli(webDir = WEB_DIR) {
  const require = createRequire(path.join(webDir, 'package.json'))
  let entry
  try {
    entry = require.resolve('@playwright/test/package.json')
  } catch (e) {
    return { ok: false, why: `apps/web 解析不到 @playwright/test(${e.code || e.message})` }
  }
  const cli = path.join(path.dirname(entry), 'cli.js')
  return existsSync(cli) ? { ok: true, cli } : { ok: false, why: `${cli} 不存在` }
}

/** 探一台 web 是否应答;网络不可达 ≠ 配错,单列 unjudged 态不冒充任何一种结论 */
export async function probeHttp(url, timeoutMs = 6000) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) })
    return { state: 'answered', status: res.status }
  } catch (e) {
    return { state: 'unreachable', why: String(e?.message || e).split('\n')[0] }
  }
}

/**
 * 取一个带值旗标的两种写法:`--k=v` 与 `--k v`。
 *
 * 2026-10-31 修复(本机实测):本文件头注与 `--help` 一直写的是 `--base-url <端口>` /
 * `--api-url <origin>` 的空格形态,而 parseArgs 只认 `=` 形态 ⇒ 照文档敲的命令**必然**
 * 打印「必须显式给 --base-url」并 exit 2。文档里跑不通的出路比不写更坏(§0.8),
 * 故两种写法同源解析:先 `=` 形态,再取旗标后紧跟的那一格(不以 `--` 开头才算值)。
 */
export function flagValue(argv, name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = argv.indexOf(name)
  if (i < 0) return null
  const next = argv[i + 1]
  return next && !next.startsWith('--') ? next : null
}

export function parseArgs(argv) {
  const KNOWN = new Set([
    '--check',
    '--run',
    '--provision-admin',
    '--probe-login',
    '--stack',
    '--help',
    '-h',
    '--base-url',
    '--api-url',
    '--api-port',
    '--db',
    '--keep',
    '--prod',
    '--no-build',
  ])
  const opts = {
    mode: null,
    baseUrl: null,
    apiUrl: null,
    apiPort: null,
    db: null,
    keep: false,
    prod: false,
    noBuild: false,
    pwArgs: [],
    unknown: [],
  }
  const rest = [...argv]
  if (rest.includes('--check')) opts.mode = 'check'
  if (rest.includes('--run')) opts.mode = 'run'
  if (rest.includes('--provision-admin')) opts.mode = 'provision'
  if (rest.includes('--probe-login')) opts.mode = 'probe'
  if (rest.includes('--stack')) opts.mode = 'stack'
  if (rest.includes('--help') || rest.includes('-h')) opts.mode = 'help'
  opts.baseUrl = flagValue(rest, '--base-url')
  opts.apiUrl = flagValue(rest, '--api-url')
  const ap = flagValue(rest, '--api-port')
  opts.apiPort = ap ? Number(ap) : null
  opts.db = flagValue(rest, '--db')
  opts.keep = rest.includes('--keep')
  opts.prod = rest.includes('--prod')
  opts.noBuild = rest.includes('--no-build')
  const split = rest.indexOf('--')
  const head = split >= 0 ? rest.slice(0, split) : rest
  opts.pwArgs = split >= 0 ? rest.slice(split + 1) : []
  // `--` 之前的未知旗标一律点名(静默吞掉会让人以为自己在带条件跑,实际跑的是裸档)。
  // 比旗标名时先剥 `=值`,否则 `--base-url=…` 会被自己的闸误报成未知旗标;
  // 空格形态的**值**(紧跟在已知带值旗标后、不以 `--` 开头)也不是旗标,一并排除。
  const valuePositions = new Set()
  for (const name of ['--base-url', '--api-url', '--api-port', '--db']) {
    const i = head.indexOf(name)
    if (i >= 0 && head[i + 1] && !head[i + 1].startsWith('--')) valuePositions.add(i + 1)
  }
  opts.unknown = head.filter((a, i) => {
    return a.startsWith('--') && !KNOWN.has(a.split('=')[0]) && a !== '--' && !valuePositions.has(i)
  })
  return opts
}

/** 组装注入给子进程的环境:供给面 + 强制的本机安全默认值 */
export function buildChildEnv(env, fileValues, baseUrl) {
  const out = { ...env }
  for (const spec of SUPPLY_FACE) {
    if (spec.tier === 'seed-leg') continue
    const r = resolveValue(spec.key, env, fileValues)
    if (r.value !== undefined) out[spec.key] = r.value
  }
  if (baseUrl) out.PLAYWRIGHT_BASE_URL = baseUrl
  out.E2E_SKIP_SEED = '1'
  out.E2E_AUTO_CLEANUP = '0'
  return out
}

function printSupplyFace(env, file, fileValues, baseUrl) {
  console.log(`本机 e2e 最小供给面(文件:${SUPPLY_FILE} ${file.exists ? '在盘' : '不存在'})`)
  console.log('  tier         key                        取值出处                 现值')
  for (const spec of SUPPLY_FACE) {
    const r = resolveValue(spec.key, env, fileValues)
    const shown = shownValueOf(spec.key, r.value)
    console.log(
      `  ${spec.tier.padEnd(11)} ${spec.key.padEnd(25)} ${String(r.source).padEnd(23)} ${shown}`,
    )
    console.log(`               └ ${spec.note}`)
  }
  const missing = SUPPLY_FACE.filter(
    (s) => s.tier === 'module-load' && resolveValue(s.key, env, fileValues).value === undefined,
  )
  for (const m of missing) {
    console.log(
      `\n  ✗ ${m.key} 无供给 ⇒ 凡 import './fixtures' 的 spec 模块加载即抛(不是产品红,是缺键)。`,
    )
    console.log(`    出路二选一:① 命令行显式给 ${m.key}=<测试专用口令> 再跑本脚本;`)
    console.log(
      `    ② 生成一份只对本机隔离库有效的口令并 seed:--provision-admin(需 E2E_DATABASE_URL)。`,
    )
  }
  if (baseUrl) {
    console.log(`\n  web 供给面:${baseUrl}`)
  }
  return missing
}

/**
 * 隔离栈模式(`--stack`):把"本席 API(独立库)+ 本席 web(独立端口/构建目录)+ 跑 spec"
 * 收成一条命令。2026-10-31 立,依据是当次实跑踩到的三处**手册层面**的坑(每一处都让
 * 上一位人肉照做的席位白跑一轮):
 *
 *  ① **host 必须一致**:隔离档(端口≠8801 或 dist≠.next)下,`dev-with-warmup.mjs` 会把
 *     `NEXT_PUBLIC_API_BASE_URL` 烘成 `http://localhost:<port>`。若 Playwright 用
 *     `http://127.0.0.1:<port>` 打开页面,页面的每一次 `/api/*` 都是**跨源**请求
 *     (localhost 与 127.0.0.1 是两个 registrable host),被 CORS 拦成 net::ERR_FAILED
 *     ⇒ 侧栏「加载失败」、登录态看似在但全站 500 级空转。故本模式只接受 localhost。
 *  ② **人机验证**:`apps/api/.env` 若配了 `TURNSTILE_SECRET_KEY`,登录钩子对"不带
 *     turnstileToken 的脚本请求"一律 403(人机验证失败)。CI 没有这个键,脚本登录才走得通;
 *     本模式给隔离 API 进程显式置空该键(= 与 CI 同形),不碰任何生产/共享进程。
 *  ③ **库要从哪来**:隔离 API 的 DSN = `apps/api/.env` 的 DATABASE_URL **换库名**
 *     (`--db`,默认 ihui_e2e),口令段不在命令行出现、也不回显(sanitizeDsn)。
 *     目标库必须是本机回环且非 8810(判据 import db-probe-client,不另写一份)。
 *
 * 退出码沿用本文件:0 = 子进程绿 / 1 = 子进程失败 / 2 = 未判定或供给面缺口。
 */
function spawnLogged(cmd, args, opts, logFile) {
  mkdirSync(path.dirname(logFile), { recursive: true })
  const fd = openSync(logFile, 'a')
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', fd, fd], windowsHide: true })
  child.on('error', () => closeSync(fd))
  return child
}

/** 同步跑一条一次性子进程(如 next build),stdout/stderr 与 spawnLogged 落同一份日志 */
function runLoggedSync(cmd, args, opts, logFile) {
  mkdirSync(path.dirname(logFile), { recursive: true })
  const fd = openSync(logFile, 'a')
  try {
    return spawnSync(cmd, args, { ...opts, stdio: ['ignore', fd, fd], windowsHide: true })
  } finally {
    closeSync(fd)
  }
}

/** 进程树收口:Windows 用 taskkill /T(否则 next dev 的孙子进程会留在端口上) */
function stopTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  } else {
    try {
      process.kill(child.pid, 'SIGTERM')
    } catch {
      /* 已退出 */
    }
  }
}

/** 轮询直到 cond() 为真或超时;返回 true/false(不吞异常,异常按"未就绪"处理) */
async function waitUntil(cond, timeoutMs, intervalMs = 1500) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await cond()) return true
    } catch {
      /* 未就绪,继续等 */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

function readApiEnvDsn() {
  try {
    const text = readFileSync(path.join(ROOT, 'apps', 'api', '.env'), 'utf8')
    const m = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m.exec(text)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/** 只换库名,口令/host/参数原样保留(不把 DSN 拆开再拼,拼错就是另一个库) */
export function swapDbName(dsn, db) {
  const u = new URL(dsn)
  u.pathname = `/${db}`
  return u.toString()
}

/** 取 DSN 里的库名(与 swapDbName 同一套 URL 解析;解析不出返回空串,不猜) */
export function dbNameFromDsn(dsn) {
  try {
    return new URL(dsn).pathname.replace(/^\//, '')
  } catch {
    return ''
  }
}

async function modeStack(env, opts) {
  if (!opts.baseUrl) {
    console.error(
      '✗ --stack 必须显式给 --base-url=http://localhost:<本席端口>(web 端口由此取)。',
    )
    return 2
  }
  let u
  try {
    u = new URL(opts.baseUrl)
  } catch {
    console.error(`✗ --base-url 不是合法 URL:${opts.baseUrl}`)
    return 2
  }
  // 坑①:隔离档的 NEXT_PUBLIC_API_BASE_URL 烘的是 localhost,页面也必须用 localhost 打开。
  if (u.hostname !== 'localhost') {
    console.error(
      `✗ --stack 只接受 http://localhost:<端口>(收到 ${u.hostname})。\n` +
        '  原因:隔离档 dev 启动器把浏览器 API 基址烘成 http://localhost:<端口>;用 127.0.0.1 打开\n' +
        '  页面时两者的每一次 /api/* 都是跨源请求,CORS 会把它拦成 net::ERR_FAILED。',
    )
    return 2
  }
  const webPort = Number(u.port || 80)
  const apiPort = Number(opts.apiPort ?? 8809)
  const db = opts.db ?? 'ihui_e2e'
  // --prod:CI 同形(playwright.config 的 CI 腿 = `pnpm build && pnpm start`)。
  // 构建产物落独立 dist,绝不碰他席在跑的 apps/web/.next。
  const prod = Boolean(opts.prod)
  if (opts.noBuild && !prod) {
    console.error('✗ --no-build 只对 --prod 有意义(dev 档本就不构建)⇒ 不猜意图。')
    return 2
  }
  const dist = `.next-e2e-${webPort}${prod ? '-prod' : ''}`

  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    console.error(`✗ --api-port 非法:${opts.apiPort}`)
    return 2
  }
  const baseDsn = readApiEnvDsn()
  if (!baseDsn) {
    console.error('✗ 取不到 apps/api/.env 的 DATABASE_URL ⇒ 无法派生隔离库 DSN(未判定)。')
    return 2
  }
  const dsn = swapDbName(baseDsn, db)
  const guard = guardDbDsn(dsn)
  if (!guard.ok) {
    console.error(`✗ 隔离库 DSN 被拒:${guard.why}(判据 import db-probe-client)`)
    return 2
  }
  // 端口已被占用 ⇒ 拒绝:那可能是别席的服务,拿它跑 e2e 失败不可归因。
  for (const [label, url] of [
    ['web', opts.baseUrl],
    ['api', `http://127.0.0.1:${apiPort}`],
  ]) {
    const p = await probeHttp(url)
    if (p.state === 'answered') {
      console.error(
        `✗ ${label} 端口已被占用(${url} 应答 HTTP ${p.status})⇒ 不抢别席的服务;换个端口再跑。`,
      )
      return 2
    }
  }

  console.log(
    `\n隔离栈:api=http://127.0.0.1:${apiPort}(库 ${db})web=${opts.baseUrl}(dist ${dist}${prod ? ',next build+start 生产口径' : ',next dev'})`,
  )
  console.log(`  db   ${sanitizeDsn(dsn)}(口令不回显)`)
  const apiLog = path.join(ROOT, '.ihui-agent', 'tmp', 'e2e-stack', `api-${apiPort}.log`)
  const webLog = path.join(ROOT, '.ihui-agent', 'tmp', 'e2e-stack', `web-${webPort}.log`)
  const api = spawnLogged(
    process.execPath,
    ['--import', 'tsx', 'src/index.ts'],
    {
      cwd: path.join(ROOT, 'apps', 'api'),
      env: {
        ...env,
        DATABASE_URL: dsn,
        // 不隔离 Redis 时必须隔离队列命名空间:否则隔离栈的 worker 会抢主库的
        // relay-account-pool-queue,在隔离库上执行主库的作业(2026-10-24 事故)。
        RELAY_QUEUE_SUFFIX: db,
        PORT: String(apiPort),
        // 坑②:脚本登录不带 turnstileToken,键在即 403(CI 无该键,故此处与 CI 同形)
        TURNSTILE_SECRET_KEY: '',
      },
    },
    apiLog,
  )
  const webEnv = {
    ...env,
    IHUI_BUILD_DIST: dist,
    IHUI_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
    // 坑①的对侧:显式钉住 localhost,不依赖启动器的默认推导
    NEXT_PUBLIC_API_BASE_URL: `http://localhost:${webPort}`,
    NEXT_TELEMETRY_DISABLED: '1',
  }
  let web
  if (prod) {
    const nextBin = path.join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next')
    if (!existsSync(nextBin)) {
      console.error(`✗ 取不到 next 入口(${nextBin})⇒ --prod 未判定,不回落 dev 档冒充生产口径。`)
      stopTree(api)
      return 2
    }
    console.log(`  --prod:next build → ${dist}(CI 同形;不碰共享 .next)…`)
    const buildId = path.join(WEB_DIR, dist, 'BUILD_ID')
    if (opts.noBuild) {
      if (!existsSync(buildId)) {
        console.error(
          `✗ --no-build 但 ${dist}/BUILD_ID 不存在 ⇒ 没有可复用的生产构建,未判定(不回落 dev 档)。`,
        )
        stopTree(api)
        return 2
      }
      console.log(`  --no-build:复用已有构建 ${dist}/BUILD_ID=${readFileSync(buildId, 'utf8').trim()}`)
    } else {
      const built = runLoggedSync(
        process.execPath,
        ['--max-old-space-size=8192', nextBin, 'build'],
        { cwd: WEB_DIR, env: webEnv },
        webLog,
      )
      if (built.error || built.status !== 0) {
        console.error(
          `✗ next build 失败(${built.error?.message ?? `exit ${built.status}`})⇒ --prod 未判定。日志:${webLog}`,
        )
        stopTree(api)
        return 2
      }
    }
    web = spawnLogged(
      process.execPath,
      [nextBin, 'start', '-p', String(webPort)],
      { cwd: WEB_DIR, env: webEnv },
      webLog,
    )
  } else {
    web = spawnLogged(
      process.execPath,
      [path.join(ROOT, 'scripts', 'dev-with-warmup.mjs'), '--no-backend'],
      {
        cwd: ROOT,
        env: { ...webEnv, IHUI_DEV_PORT: String(webPort) },
      },
      webLog,
    )
  }
  try {
    const apiOk = await waitUntil(async () => {
      const p = await probeHttp(`http://127.0.0.1:${apiPort}/api/health`)
      return p.state === 'answered' && p.status < 500
    }, 180_000)
    if (!apiOk) {
      console.error(`✗ 隔离 API 180s 内未就绪 ⇒ 未判定。日志:${apiLog}`)
      return 2
    }
    const webOk = await waitUntil(async () => {
      const p = await probeHttp(opts.baseUrl)
      return p.state === 'answered'
    }, 300_000)
    if (!webOk) {
      console.error(`✗ 隔离 web 300s 内未就绪 ⇒ 未判定。日志:${webLog}`)
      return 2
    }
    console.log('  两侧已就绪;开始跑 spec\n')
    if (prod && env.CI) {
      // CI 下 playwright.config 的 reuseExistingServer 默认 false ⇒ webServer 段会去跑
      // `pnpm build && pnpm start`(默认 .next + 8801),既覆盖共享构建目录又打错端口。
      // 本栈已按 CI 同形起好 build+start,这里让它复用本席服务。
      env.PLAYWRIGHT_REUSE_SERVER = '1'
    }
    return await modeRun(env, opts)
  } finally {
    if (opts.keep) {
      // unref:否则 keep 档的父进程会一直挂在子进程句柄上,命令看起来"卡住不返回"
      // (2026-10-31 实测:spec 已跑完并打印结论,shell 仍等不到退出码)。
      try {
        api.unref()
        web.unref()
      } catch {
        /* 已退出 */
      }
      console.log(`  --keep:两侧保持运行(api pid=${api.pid} web pid=${web.pid})`)
    } else {
      stopTree(web)
      stopTree(api)
      console.log('  隔离栈已收口')
    }
  }
}

async function modeCheck(env, opts) {
  const file = readSupplyFile()
  const missing = printSupplyFace(env, file, file.values, opts.baseUrl)
  if (opts.baseUrl) {
    const p = await probeHttp(opts.baseUrl)
    console.log(
      p.state === 'answered'
        ? `  web 探活:HTTP ${p.status} ⇒ 该端口的服务在应答(不保证是本席所起;别席服务 ⇒ 失败不可归因)`
        : `  web 探活:不可达(${p.why}) ⇒ 先起本席 web,例:` +
            ` IHUI_DEV_PORT=<本席端口> IHUI_BUILD_DIST=.next-e2e-<本席短名> node scripts/dev-with-warmup.mjs --no-backend`,
    )
  } else {
    console.log('\n  ℹ --base-url 未给 ⇒ web 可达性**未判定**(不猜端口归属)。')
  }
  const cli = resolvePlaywrightCli()
  console.log(cli.ok ? `  playwright CLI:${cli.cli}` : `  playwright CLI:未判定(${cli.why})`)
  if (!cli.ok) return 2
  return missing.length > 0 ? 2 : 0
}

async function modeRun(env, opts) {
  if (opts.unknown.length > 0) {
    console.error(
      `✗ 未识别的旗标(在 -- 之前):${opts.unknown.join(' ')} ⇒ 不猜意图,静默吞旗标比报错更坏。`,
    )
    return 2
  }
  if (!opts.baseUrl) {
    console.error(
      '✗ --run 必须显式给 --base-url(不默认 8801:那台常年是别席 dev 进程,失败不可归因)。',
    )
    return 2
  }
  const cli = resolvePlaywrightCli()
  if (!cli.ok) {
    console.error(`✗ playwright CLI 取不到:${cli.why} ⇒ 未判定,不回落另一个面。`)
    return 2
  }
  const file = readSupplyFile()
  const missing = printSupplyFace(env, file, file.values, opts.baseUrl)
  if (missing.length > 0) return 2
  // 端口没人应答 ⇒ 绝不能继续:playwright.config 的 webServer 会自己 `pnpm dev`,
  // 而 reuseExistingServer 本地默认开,落点就是别席那台 8801/本席没起的半成品。
  const probe = await probeHttp(opts.baseUrl)
  if (probe.state !== 'answered') {
    console.error(
      `✗ ${opts.baseUrl} 不可达(${probe.why}) ⇒ 拒绝开跑,不把手交给 webServer 段的 pnpm dev。\n` +
        `  先起本席自己的 web(独立端口 + 独立构建目录,不与他席共写 .next):\n` +
        `  IHUI_DEV_PORT=<本席端口> IHUI_BUILD_DIST=.next-e2e-<本席短名> node scripts/dev-with-warmup.mjs --no-backend`,
    )
    return 2
  }
  console.log(`  web 探活:HTTP ${probe.status} ⇒ 就在本席声明的端口上跑`)
  const childEnv = buildChildEnv(env, file.values, opts.baseUrl)
  const pwArgs = opts.pwArgs.length > 0 ? opts.pwArgs : ['e2e']
  const cmd = [cli.cli, 'test', ...pwArgs]
  console.log(`\n▶ ${process.execPath} ${cmd.join(' ')}`)
  const r = spawnSync(process.execPath, cmd, {
    cwd: WEB_DIR,
    env: childEnv,
    // §12g:派生子进程一律显式 stdio(不给 stdio 在本机稳定 EBUSY)
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  if (r.error) {
    console.error(`✗ playwright 进程自身起不来:${r.error.message}`)
    return 2
  }
  return r.status === 0 ? 0 : 1
}

/**
 * 包管理器派生的唯一形态:`shell:true` 时把参数拼进命令串再交 shell(node 对
 * "shell + args 数组"发 DEP0190,且拼接语义与 shell 解析本就同源);
 * 否则走 `process.execPath + 入口脚本` 的无 shell 形态(scripts/lib/npm-execpath.mjs 判据)。
 */
function spawnPackageManager(plan, args, opts) {
  return plan.shell
    ? spawnSync([plan.cmd, ...args].join(' '), { ...opts, shell: true })
    : spawnSync(plan.cmd, [...plan.prefix, ...args], { ...opts, shell: false })
}

/**
 * 登录腿探测:对**在跑的 API** 发一次 POST /api/auth/login,只报状态码与业务码,不回显任何凭据。
 * 一次即止 —— 连错会进账号锁定窗口(5 次/锁定),把探测变成事故就不是探测了。
 */
async function probeLogin(apiBase, account, password) {
  try {
    const res = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password }),
      signal: AbortSignal.timeout(15_000),
    })
    const blob = await res.json().catch(() => null)
    return {
      state: res.ok && blob?.code === 0 ? 'ok' : 'denied',
      http: res.status,
      code: blob?.code ?? null,
      message: typeof blob?.message === 'string' ? blob.message.slice(0, 60) : null,
    }
  } catch (e) {
    return { state: 'unreachable', why: String(e?.message || e).split('\n')[0] }
  }
}

async function modeProbeLogin(env, opts) {
  if (!opts.apiUrl) {
    console.error('✗ --probe-login 必须显式给 --api-url(不猜哪台 API 在跑、更不猜它连的是哪枚库)。')
    return 2
  }
  const file = readSupplyFile()
  const account = resolveValue('E2E_ADMIN_ACCOUNT', env, file.values).value
  const password = resolveValue('E2E_ADMIN_PASSWORD', env, file.values).value
  if (!account || !password) {
    console.error(`✗ 供给面缺 E2E_ADMIN_ACCOUNT / E2E_ADMIN_PASSWORD ⇒ 无从探测(未判定,不记绿)。`)
    return 2
  }
  const r = await probeLogin(opts.apiUrl, account, password)
  console.log(`管理员腿探测 account=${account} 口令=${maskSecret(password)} ⇒ ${JSON.stringify(r)}`)
  console.log(
    r.state === 'ok'
      ? '  ✓ admin 登录腿在**这台 API 当前连的那枚库**上成立。'
      : r.state === 'denied'
        ? '  ✗ 被拒。先核对 API 连的库与 seed 落的库是否同一枚(本机 API 常连 dev 库,而本出口的 seed 只准落隔离库)。'
        : '  ✗ API 不可达:该腿**未判定**,既不算绿也不算产品红。',
  )
  return r.state === 'ok' ? 0 : r.state === 'denied' ? 1 : 2
}

async function modeProvision(env) {
  const dsn = env.E2E_DATABASE_URL
  if (!dsn) {
    console.error(
      '✗ --provision-admin 必须显式给 E2E_DATABASE_URL 指向**隔离库**。\n' +
        '  不回落 apps/api/.env 那枚本机 dev 库:它同时是在跑席位的库,seed 写进去是跨会话副作用。',
    )
    return 2
  }
  const guard = guardDbDsn(dsn)
  if (!guard.ok) {
    console.error(`✗ DSN 被拒:${guard.why}(判据 import scripts/lib/db-probe-client.mjs,不另写一份)`)
    return 2
  }
  // loginSchema 的口令约束:>=8 且 <=72 位
  const password = randomBytes(18).toString('hex')
  const account = 'e2e_admin'
  let text = existsSync(SUPPLY_FILE)
    ? readFileSync(SUPPLY_FILE, 'utf8')
    : '# 本机 e2e 供给面(gitignored,严禁提交)\n'
  text = writeSupplyLine(text, 'E2E_ADMIN_ACCOUNT', account)
  text = writeSupplyLine(text, 'E2E_ADMIN_PASSWORD', password)
  writeFileSync(SUPPLY_FILE, text, 'utf8')

  const plan = planPackageManagerSpawn(env.npm_execpath)
  const args = ['--filter', '@ihui/api', 'run', 'seed:test-users']
  console.log(`▶ seed 目标库:${sanitizeDsn(dsn)}(口令不回显)`)
  const r = spawnPackageManager(plan, args, {
    cwd: ROOT,
    env: {
      ...env,
      DATABASE_URL: dsn,
      // 不隔离 Redis 时必须隔离队列命名空间:否则隔离栈的 worker 会抢主库的
      // relay-account-pool-queue,在隔离库上执行主库的作业(2026-10-24 事故)。
      RELAY_QUEUE_SUFFIX: dbNameFromDsn(dsn),
      E2E_ADMIN_PASSWORD: password,
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  })
  if (r.error) {
    console.error(`✗ seed 进程自身起不来:${r.error.message}`)
    return 2
  }
  if (r.status !== 0) return 1
  console.log(`✓ e2e 管理员已 seed(username=${account}),口令已写入 ${SUPPLY_FILE}`)
  console.log(
    '  ℹ 口令只对**这一枚库**有效;要让 admin 腿在 e2e 里真跑,webServer 反代的 API 必须连同一枚库。',
  )
  return 0
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (!opts.mode) {
    console.error(
      '✗ 未给模式(--check | --run | --stack | --provision-admin | --probe-login),不猜你要哪个。',
    )
    return 2
  }
  if (opts.mode === 'help') {
    console.log(
      [
        'node scripts/e2e-local-supply.mjs --check [--base-url http://localhost:<本席端口>]',
        'node scripts/e2e-local-supply.mjs --run --base-url http://localhost:<本席端口> -- <spec 路径> [playwright 参数…]',
        'node scripts/e2e-local-supply.mjs --stack --base-url=http://localhost:<本席端口> [--api-port=8809] [--db=ihui_e2e] [--keep] [--prod [--no-build]] -- <spec 路径> [playwright 参数…]',
        'E2E_DATABASE_URL=postgres://…/ihui_e2e node scripts/e2e-local-supply.mjs --provision-admin',
        'node scripts/e2e-local-supply.mjs --probe-login --api-url http://localhost:<带 /api 反代的 origin>',
        '',
        '(--api-url 只用于拼 <origin>/api/auth/login 探一次登录,与 fixtures.ts 同一条腿;发第二次就不是探测了)',
        '(--stack 自带起/停隔离 API+web:独立库(--db)、独立端口、独立 dist;跑完自动收口,--keep 可保留)',
        '(--prod:web 走 next build + next start,构建落 .next-e2e-<端口>-prod,与 CI 的 build+start 同形且不碰共享 .next)',
      ].join('\n'),
    )
    return 0
  }
  if (opts.mode === 'check') return modeCheck(process.env, opts)
  if (opts.mode === 'run') return modeRun(process.env, opts)
  if (opts.mode === 'stack') return modeStack(process.env, opts)
  if (opts.mode === 'probe') return modeProbeLogin(process.env, opts)
  return modeProvision(process.env)
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().then(
    (code) => {
      // 用 exitCode 而不是 process.exit():fetch/undici 在 Windows 上退出时还挂着
      // 正在关闭的 handle,process.exit 会撞 libuv 断言
      // (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) … async.c:94` + rc=127),
      // 表现为"结论是对的、退出码是假的"。2026-10-23 本机实测。
      process.exitCode = code
    },
    (e) => {
      console.error(
        `❌ 脚本自身异常(exit 2,不冒充判据结论):${String(e?.message || e)}\n${e?.stack ?? ''}`,
      )
      process.exitCode = 2
    },
  )
}

export const __test__ = {
  SUPPLY_FACE,
  SUPPLY_FILE,
  maskSecret,
  shownValueOf,
  resolveValue,
  readSupplyFile,
  writeSupplyLine,
  resolvePlaywrightCli,
  probeHttp,
  probeLogin,
  buildChildEnv,
  parseArgs,
  flagValue,
  swapDbName,
  spawnPackageManager,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
