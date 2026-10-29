// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 一键切号入口(2026-10-28 立)—— 把号池里任意 Trae 账号写回本机 Trae 客户端登录。
 *
 *   node scripts/switch-trae-client-account.mjs --list                 # 池里有哪些 Trae 号
 *   node scripts/switch-trae-client-account.mjs --current              # 本机登录号在池里的状态
 *   node scripts/switch-trae-client-account.mjs --to <uid|名称> [--dry-run] [--force] [--json]
 *
 * 本文件只做编排:spawn tsx 跑 apps/api/scripts/relay-trae-client-switch.ts,
 * 参数原样透传,退出码透传(0 成功 / 1 业务失败 / 2 未判定)。
 * 判据与信封重建不在这里(§0.6 单一判据源):lib = scripts/lib/trae-client-switch.mjs。
 *
 * 纪律:切号写回前 Trae 客户端必须已退出(否则 --force 强杀);凭据只在 tsx 子进程
 * 内存里流动,本文件 stdio 全 inherit、不碰任何凭据管道。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SWITCH_TS = path.join(API_DIR, 'scripts', 'relay-trae-client-switch.ts')

const USAGE =
  '用法: node scripts/switch-trae-client-account.mjs --list|--current|--to <uid|名称> [--dry-run] [--force] [--json]\n' +
  '  --list     列出号池全部 Trae 账号(健康态/到期/设备/归属,不含凭据)\n' +
  '  --current  本机 Trae 登录号在池里的状态\n' +
  '  --to       把指定号写回本机客户端(uid 精确 > 名称精确 > 名称包含;歧义会列候选)\n' +
  '  --dry-run  只打印计划不写文件;--force 代杀 Trae 客户端后写;--json 机读汇总走 stdout\n'

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE)
    return argv.length === 0 ? 2 : 0
  }
  const tsx = resolveTsx()
  if (!tsx) {
    process.stderr.write('❌ 未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install\n')
    return 2
  }
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, [tsx, SWITCH_TS, ...argv], {
      cwd: API_DIR,
      windowsHide: true,
      // 无凭据管道(DB 在 ts 侧读),inherit 直出即可
      stdio: 'inherit',
    })
    child.on('error', (e) => {
      process.stderr.write(`❌ 派发失败(未判定): ${e.message}\n`)
      resolve(2)
    })
    child.on('exit', (code, signal) => resolve(signal ? 2 : (code ?? 2)))
  })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
