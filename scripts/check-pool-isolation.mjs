// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池隔离性体检尺入口(2026-11-01 立;判机器状态 ⇒ 刻意不进提交链,§12e)。
 *
 *   node scripts/check-pool-isolation.mjs [--json] [--help]
 *
 * 分工(§0.6 判据单源):六维(D1 设备簇 / D2 共用 rt / D3 同 uid 双行 / D4 rt 终点证据 /
 * D5 出口亲和 / D6 死副本)的裁决逻辑全在 apps/api/scripts/relay-pool-isolation-audit.ts,
 * 本文件只做「用 tsx 把那枚 .ts 跑起来」这一件转发,不抄任何判据。
 *
 * 为什么需要这条薄壳:守护(git-guardian)与手动排障都按 `node scripts/<x>.mjs` 的范式调,
 * 而真逻辑是 .ts(要 tsx 转译)。根 .mjs 才是守卫生态认得的入口。
 *   - 只读:不写库、不打上游、不回显任何凭据(只取 uid/deviceId 前缀与计数)。
 *   - 出口:stdout 末行是 `POOL-ISOLATION state=<ok|breach|undetermined> total=<n> ...`
 *     (--json 时先打一整份 JSON 再打结论行),守护与人工都按这行判三态。
 *   - 发信:本尺自己**不发信**——它只是把结论交给守护(git-guardian 的 sweepPoolIsolation),
 *     由守护的唯一告警通道决定要不要喊人(与永久保活腿不同:那条腿的器物自己发信)。
 */
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { resolveTsxCli } from './lib/tsx-cli.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const AUDIT_TS = path.join(API_DIR, 'scripts', 'relay-pool-isolation-audit.ts')
// 审计模块不像永久保活模块那样自己 config() 加载 env,而 db/index 也不加载 ⇒ 薄壳作为唯一入口
// 显式带 --env-file(仅当文件在,避免无 .env 的守护上下文直接报死)。与上一轮探针 tsx --env-file=.env 同路。
const ENV_FILE = path.join(API_DIR, '.env')
const ENV_FLAG = existsSync(ENV_FILE) ? ['--env-file=.env'] : []

const USAGE =
  '用法: node scripts/check-pool-isolation.mjs [--json] [--help]\n' +
  '号池隔离性体检尺:D1 设备簇 / D2 共用 rt / D3 同 uid 双行 / D4 rt 终点证据 / D5 出口亲和 / D6 死副本。\n' +
  '只读,不写库不打上游,不回显任何凭据。判机器状态 ⇒ 刻意不进提交链。\n'

/** 跑 ts 侧体检脚本;所有参数原样透传给 .ts 的 main(未知参数由它按「未判定」处理) */
function runAuditTs(argv) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx)
    return { code: 2, out: '', err: '未找到 tsx(apps/api/node_modules/tsx)', spawned: false }
  const r = spawnSync(process.execPath, [tsx, ...ENV_FLAG, AUDIT_TS, ...argv], {
    cwd: API_DIR,
    windowsHide: true,
    // §12g:派生进程必须显式 stdio(不给 = 本机稳定 EBUSY);inherit 让 .ts 的 stdout 直接落到
    // 调用方(守护 / 人工)捕获的管道里,结论行与 --json 不经本文件中转,零复算。
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 300_000,
  })
  return {
    code: r.signal ? 2 : r.status ?? 2,
    out: '',
    err: r.error ? r.error.message : '',
    spawned: true,
  }
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return 0
  }
  // 守护接 --json;人工默认人类可读(结论行仍打 stdout 末行,机器可读不受影响)。
  const args = argv.includes('--json') ? argv : [...argv, '--json']
  const r = runAuditTs(args)
  if (!r.spawned) {
    process.stderr.write(`❌ ${r.err} ⇒ 未判定(exit 2)\n`)
    return 2
  }
  if (r.err) {
    process.stderr.write(`❌ 派生 tsx 失败:${r.err}\n`)
    return 2
  }
  return r.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = { main, runAuditTs, USAGE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
