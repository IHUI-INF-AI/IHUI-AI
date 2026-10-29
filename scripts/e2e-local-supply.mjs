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
 *   E2E_DATABASE_URL=postgres://user:pw@localhost:5432/ihui_e2e \
 *     node scripts/e2e-local-supply.mjs --provision-admin
 *   node scripts/e2e-local-supply.mjs --probe-login --api-url http://localhost:8802
 *
 * E2E_ADMIN_PASSWORD 有两档语义(不要混):
 *  - 只让模块加载过关:任意非空值即可 —— 全 route-mock 的 spec(如本票那枚)根本不发真登录;
 *  - 真跑 admin 登录腿:值必须与**在跑的那台 API 连的那枚库**里的行匹配 ——
 *    只有 --provision-admin 产出的口令算数,且要用 --probe-login 量出来才算,不靠话说。
 *
 * 退出码:0 = 供给面齐备(或子进程 0)/ 1 = 子进程失败 / 2 = 未判定或供给面缺口(§0.3)
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
    repoDefault: '(fixtures.ts 内的仓内字面量,本脚本不复述)',
    note: '普通用户腿;requireEnv 只管 admin 那一键',
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

export function parseArgs(argv) {
  const KNOWN = new Set([
    '--check',
    '--run',
    '--provision-admin',
    '--probe-login',
    '--help',
    '-h',
    '--base-url',
    '--api-url',
  ])
  const opts = { mode: null, baseUrl: null, apiUrl: null, pwArgs: [], unknown: [] }
  const rest = [...argv]
  if (rest.includes('--check')) opts.mode = 'check'
  if (rest.includes('--run')) opts.mode = 'run'
  if (rest.includes('--provision-admin')) opts.mode = 'provision'
  if (rest.includes('--probe-login')) opts.mode = 'probe'
  if (rest.includes('--help') || rest.includes('-h')) opts.mode = 'help'
  const bu = rest.find((a) => a.startsWith('--base-url='))
  if (bu) opts.baseUrl = bu.slice('--base-url='.length)
  const au = rest.find((a) => a.startsWith('--api-url='))
  if (au) opts.apiUrl = au.slice('--api-url='.length)
  const split = rest.indexOf('--')
  const head = split >= 0 ? rest.slice(0, split) : rest
  opts.pwArgs = split >= 0 ? rest.slice(split + 1) : []
  // `--` 之前的未知旗标一律点名(静默吞掉会让人以为自己在带条件跑,实际跑的是裸档)。
  // 比旗标名时先剥 `=值`,否则 `--base-url=…` 会被自己的闸误报成未知旗标。
  opts.unknown = head.filter(
    (a) => a.startsWith('--') && !KNOWN.has(a.split('=')[0]) && a !== '--',
  )
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
  console.log(
    `本机 e2e 最小供给面(文件:${SUPPLY_FILE} ${file.exists ? '在盘' : '不存在'})`,
  )
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
    console.log(`    ② 生成一份只对本机隔离库有效的口令并 seed:--provision-admin(需 E2E_DATABASE_URL)。`)
  }
  if (baseUrl) {
    console.log(`\n  web 供给面:${baseUrl}`)
  }
  return missing
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
  console.log(
    cli.ok ? `  playwright CLI:${cli.cli}` : `  playwright CLI:未判定(${cli.why})`,
  )
  if (!cli.ok) return 2
  return missing.length > 0 ? 2 : 0
}

async function modeRun(env, opts) {
  if (opts.unknown.length > 0) {
    console.error(`✗ 未识别的旗标(在 -- 之前):${opts.unknown.join(' ')} ⇒ 不猜意图,静默吞旗标比报错更坏。`)
    return 2
  }
  if (!opts.baseUrl) {
    console.error('✗ --run 必须显式给 --base-url(不默认 8801:那台常年是别席 dev 进程,失败不可归因)。')
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
  console.log(
    `管理员腿探测 account=${account} 口令=${maskSecret(password)} ⇒ ${JSON.stringify(r)}`,
  )
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
    env: { ...env, DATABASE_URL: dsn, E2E_ADMIN_PASSWORD: password },
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
    console.error('✗ 未给模式(--check | --run | --provision-admin | --probe-login),不猜你要哪个。')
    return 2
  }
  if (opts.mode === 'help') {
    console.log(
      [
        'node scripts/e2e-local-supply.mjs --check [--base-url http://localhost:<本席端口>]',
        'node scripts/e2e-local-supply.mjs --run --base-url http://localhost:<本席端口> -- <spec 路径> [playwright 参数…]',
        'E2E_DATABASE_URL=postgres://…/ihui_e2e node scripts/e2e-local-supply.mjs --provision-admin',
        'node scripts/e2e-local-supply.mjs --probe-login --api-url http://localhost:<带 /api 反代的 origin>',
        '',
        '(--api-url 只用于拼 <origin>/api/auth/login 探一次登录,与 fixtures.ts 同一条腿;发第二次就不是探测了)',
      ].join('\n'),
    )
    return 0
  }
  if (opts.mode === 'check') return modeCheck(process.env, opts)
  if (opts.mode === 'run') return modeRun(process.env, opts)
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
  spawnPackageManager,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
