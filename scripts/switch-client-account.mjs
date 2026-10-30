// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一切号入口(2026-10-31 立) —— 一条命令覆盖所有平台的「号池 → 本机客户端」。
 *
 *   node scripts/switch-client-account.mjs --list [--provider <平台>] [--json]
 *   node scripts/switch-client-account.mjs --current [--provider <平台>] [--json]
 *   node scripts/switch-client-account.mjs --to <uid|名称> --provider <平台> [--dry-run] [--force] [--no-launch] [--product <名>] [--json]
 *
 * 本文件只做编排与参数归一(§0.6 单一判据源):池查询、写回、落点、备份全在被转调的脚本里,
 * 本文件零复算、不碰任何凭据管道。
 *   · Trae 系  → scripts/switch-trae-client-account.mjs(--list/--current)
 *                scripts/switch-trae-client-with-chat.mjs(--to,携对话随行)
 *   · 其它平台 → apps/api/scripts/relay-login-local-verified.ts(tsx --env-file=.env)
 * 退出码透传 0 成功 / 1 业务失败 / 2 未判定;派发失败(ENOENT 等)⇒ 2 并点名。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const LOGIN_VERIFIED_TS = path.join(API_DIR, 'scripts', 'relay-login-local-verified.ts')

/** Trae SOLO 产品面字面量(与 switch-trae-client-with-chat.mjs 的 --product 取值同字面) */
const TRAE_SOLO_PRODUCT = 'TRAE SOLO CN'

/** 平台别名归一表(唯一真相源):key = 小写 + 空白/下划线折成 '-' 后的形态 */
const PLATFORM_ALIASES = Object.freeze({
  trae: { provider: 'trae' },
  'trae-cn': { provider: 'trae' },
  'trae-solo': { provider: 'trae', product: TRAE_SOLO_PRODUCT },
  'trae-solo-cn': { provider: 'trae', product: TRAE_SOLO_PRODUCT },
  solo: { provider: 'trae', product: TRAE_SOLO_PRODUCT },
  qoder: { provider: 'qoder' },
  minimax: { provider: 'minimax' },
  codex: { provider: 'codex' },
  zcode: { provider: 'zcode' },
  opencode: { provider: 'opencode' },
  workbuddy: { provider: 'workbuddy' },
  codearts: { provider: 'codearts' },
  loomy: { provider: 'loomy' },
  doubao: { provider: 'doubao' },
})

/** 用法与退出码 2 的错误里展示的支持集(顺序 = 文档顺序) */
const SUPPORTED_PLATFORMS = Object.freeze([
  'trae',
  'trae-cn',
  'trae-solo',
  'solo',
  'TRAE SOLO CN',
  'qoder',
  'minimax',
  'codex',
  'zcode',
  'opencode',
  'workbuddy',
  'codearts',
  'loomy',
  'doubao',
])

/** 目标脚本清单(纯映射;spawn 层只按 key 取路径,不复制判据) */
const TARGETS = Object.freeze({
  'trae-account': { scriptRel: 'scripts/switch-trae-client-account.mjs' },
  'trae-chat': { scriptRel: 'scripts/switch-trae-client-with-chat.mjs' },
})

const USAGE =
  '用法: node scripts/switch-client-account.mjs --list|--current [--provider <平台>] [--json]\n' +
  '      node scripts/switch-client-account.mjs --to <uid|名称> --provider <平台> [--dry-run] [--force] [--no-launch] [--product <名>] [--json]\n' +
  '  --list       列出号池里该平台的账号(Trae 系转 switch-trae-client-account.mjs;--list/--current 缺省 --provider trae)\n' +
  '  --current    本机登录号在该平台池里的状态\n' +
  '  --to         把池里的号写回本机客户端(Trae 系支持名称匹配;其它平台须精确 uid)\n' +
  `  --provider   平台名:${SUPPORTED_PLATFORMS.join(' | ')}\n` +
  '  --dry-run    只打印计划,不写任何本机文件\n' +
  '  --force      Trae 在跑时按 pid 代关后再写(仅 Trae 系)\n' +
  '  --no-launch  写完后不拉起客户端(仅 Trae 系)\n' +
  '  --product    客户端产品面:<Trae CN|TRAE SOLO CN|Trae>(仅 Trae 系;trae-solo 自动补)\n' +
  '  --json       机读汇总走 stdout\n' +
  '  其它平台的 --list/--current:relay-login-local-verified.ts 不支持,如实 exit 2 并给出巡检入口\n'

/** 平台名归一(纯函数):不查任何环境,未知一律 ok:false,由调用方报用法错 */
export function normalizeProvider(raw) {
  const input = typeof raw === 'string' ? raw.trim() : ''
  if (input === '') return { ok: false, reason: 'empty', input }
  const key = input.toLowerCase().replace(/[\s_]+/g, '-')
  const hit = PLATFORM_ALIASES[key]
  if (!hit) return { ok: false, reason: 'unknown', input, key }
  return { ok: true, key, provider: hit.provider, product: hit.product }
}

/** 产品面字面比较(大小写/连续空白不敏感) */
export function sameProductName(a, b) {
  const norm = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
  return norm(a) === norm(b)
}

function fail(error, code = 2) {
  return { ok: false, code, error }
}

function readValue(argv, index, flag) {
  const next = argv[index + 1]
  if (next === undefined || next.startsWith('--')) return { error: `${flag} 需要后面的值` }
  return { value: next }
}

/** 参数解析(纯函数):只管形状与互斥,不判断平台是否支持 */
export function parseArgs(argv) {
  const opts = {
    action: null,
    to: null,
    providerRaw: null,
    productRaw: null,
    dryRun: false,
    force: false,
    noLaunch: false,
    json: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--list' || a === '--current') {
      const action = a.slice(2)
      if (opts.action !== null && opts.action !== action) return fail('--list 与 --current 互斥')
      opts.action = action
    } else if (a === '--to') {
      const r = readValue(argv, i, '--to')
      if (r.error) return fail(r.error)
      if (opts.to !== null) return fail('--to 只能给一次')
      opts.to = r.value
      i += 1
    } else if (a === '--provider') {
      const r = readValue(argv, i, '--provider')
      if (r.error) return fail(r.error)
      opts.providerRaw = r.value
      i += 1
    } else if (a === '--product') {
      const r = readValue(argv, i, '--product')
      if (r.error) return fail(r.error)
      opts.productRaw = r.value
      i += 1
    } else if (a === '--dry-run') {
      opts.dryRun = true
    } else if (a === '--force') {
      opts.force = true
    } else if (a === '--no-launch') {
      opts.noLaunch = true
    } else if (a === '--json') {
      opts.json = true
    } else {
      return fail(`不认识的参数:${a}`)
    }
  }
  if (opts.action !== null && opts.to !== null) return fail('--list/--current 与 --to 互斥')
  if (opts.action === null && opts.to === null) return fail('必须给 --list / --current / --to 之一')
  if (opts.to !== null && opts.providerRaw === null) {
    return fail('--to 必须配 --provider(要写哪个平台的客户端不猜)')
  }
  return { ok: true, opts }
}

function unknownProvider(n) {
  if (n.reason === 'empty') return fail('--provider 不能为空(不猜)')
  return fail(`不认识的平台:${n.input}(不猜)\n支持:${SUPPORTED_PLATFORMS.join(' / ')}`)
}

/** --list / --current 分流:Trae 系转 account 入口;其它平台如实未判定 */
function buildReadPlan(opts) {
  const n = normalizeProvider(opts.providerRaw ?? 'trae')
  if (!n.ok) return unknownProvider(n)
  if (n.provider !== 'trae') {
    return fail(
      `${n.provider} 的 --${opts.action} 暂无单一入口:relay-login-local-verified.ts 只做写回,` +
        '不支持 --list/--current(不编参数)。现有巡检入口:\n' +
        `     node scripts/relay-account-pool.mjs --from ${n.provider} --json      # 取本机登录态入池/刷新并做健康检查\n` +
        `     pnpm relay:inspect -- --file <accounts.json> --provider ${n.provider}  # 账号体检(零 DB)\n` +
        '     node scripts/check-relay-capacity-zero.mjs --json                    # 全池可调度容量只读哨兵\n' +
        '   Trae 系全池名单:node scripts/switch-client-account.mjs --list --provider trae',
    )
  }
  const args = [opts.action === 'list' ? '--list' : '--current']
  if (opts.json) args.push('--json')
  return { ok: true, action: opts.action, target: 'trae-account', args }
}

/** --to 分流:Trae 系补产品面转 with-chat;其它平台映射成 --uid 转 login-local-verified */
function buildSwitchPlan(opts) {
  const n = normalizeProvider(opts.providerRaw)
  if (!n.ok) return unknownProvider(n)
  if (n.provider === 'trae') {
    if (opts.productRaw && n.product && !sameProductName(opts.productRaw, n.product)) {
      return fail(
        `--provider ${opts.providerRaw} 已固定产品面 ${n.product},与 --product ${opts.productRaw} 冲突(不猜)`,
      )
    }
    // 显式产品面与 provider 自带产品面字面等价时用规范字面;其它值原样透传(取值集合由 ts 侧校验)
    const product = opts.productRaw
      ? n.product && sameProductName(opts.productRaw, n.product)
        ? n.product
        : opts.productRaw
      : n.product
    const args = ['--to', opts.to]
    if (product) args.push('--product', product)
    if (opts.dryRun) args.push('--dry-run')
    if (opts.force) args.push('--force')
    if (opts.noLaunch) args.push('--no-launch')
    if (opts.json) args.push('--json')
    return { ok: true, action: 'switch', target: 'trae-chat', args }
  }
  const unsupported = []
  if (opts.force) unsupported.push('--force')
  if (opts.noLaunch) unsupported.push('--no-launch')
  if (opts.productRaw) unsupported.push('--product')
  if (unsupported.length > 0) {
    return fail(
      `${n.provider} 走 relay-login-local-verified.ts,它不支持 ${unsupported.join(' / ')}(不编参数、不静默吞)`,
    )
  }
  const args = ['--provider', n.provider, '--uid', opts.to]
  if (opts.dryRun) args.push('--dry-run')
  if (opts.json) args.push('--json')
  return { ok: true, action: 'switch', target: 'login-verified', args }
}

/** 参数 → 派发计划(纯函数):测试直接断言 target 与 argv,不启动子进程 */
export function buildPlan(parsed) {
  if (!parsed.ok) return parsed
  return parsed.opts.action !== null ? buildReadPlan(parsed.opts) : buildSwitchPlan(parsed.opts)
}

/** 一条龙纯函数:argv → 派发计划 */
export function planCli(argv) {
  return buildPlan(parseArgs(argv))
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function spawnAndWait(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      // 凭据只在子进程内存里流动;stdout/stderr 直出,本层不接管任何管道
      stdio: 'inherit',
    })
    child.on('error', (e) => {
      const code = e && typeof e === 'object' && 'code' in e ? ` [${e.code}]` : ''
      process.stderr.write(`❌ 派发失败(未判定): ${e.message}${code}\n`)
      resolve(2)
    })
    child.on('exit', (code, signal) => resolve(signal ? 2 : (code ?? 2)))
  })
}

async function dispatch(plan) {
  if (plan.target === 'login-verified') {
    const tsx = resolveTsx()
    if (!tsx) {
      process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install\n')
      return 2
    }
    // 形态照 apps/api/package.json 的 relay:login-local-verified(env 由 --env-file=.env 注入,不自动找)
    return await spawnAndWait(
      process.execPath,
      [tsx, '--env-file=.env', LOGIN_VERIFIED_TS, ...plan.args],
      API_DIR,
    )
  }
  const spec = TARGETS[plan.target]
  return await spawnAndWait(process.execPath, [path.join(ROOT, spec.scriptRel), ...plan.args], ROOT)
}

async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return argv.length === 0 ? 2 : 0
  }
  const plan = planCli(argv)
  if (!plan.ok) {
    process.stderr.write(`❌ ${plan.error}\n`)
    return plan.code ?? 2
  }
  return await dispatch(plan)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  normalizeProvider,
  buildPlan,
  planCli,
  sameProductName,
  SUPPORTED_PLATFORMS,
  TRAE_SOLO_PRODUCT,
  TARGETS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
