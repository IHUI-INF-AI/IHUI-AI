// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L14/RP-21 协议字面量的**单一真相源棘轮**(2026-11-26)。
 *
 * 判据:ACP 方法名字面量(`session/new` / `session/prompt` / `session/cancel` /
 * `session/update` / `initialize` / `authenticate` / `session/load`)只许出现在
 * `@ihui/types` 的单一真相源(`packages/types/src/agent-protocol.ts`);agent-sdk
 * 只做转发,其它端要么 import 常量,要么就是第二真相源。
 *
 * 2026-11-26 存量债(按 2026-11-23 机主口径登记,不假装它已清):
 *  - `apps/cli/src/acp/server.ts` 仍硬编码三处 —— 该 app 尚未依赖 `@ihui/agent-sdk`,
 *    接依赖要动 lockfile,单独一轮做;在那之前它进基线,新出现的第二份一律红灯。
 *  - 各包的 tests/ 与 __tests__/ 与 fixtures 允许写死字面量(测试的职责就是把协议钉成字面量)。
 *
 * 取材纪律(门 118):只用 `git grep -l` 列文件名,不取 blob 正文;
 * 入口纪律(门 194):末尾 direct-run 守卫。
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { hideComments, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const METHOD_LITERALS = ['session/new', 'session/prompt', 'session/cancel', 'session/update', 'session/load']

/** 三端面:web / RN / 小程序 + CLI(ACP 客户端)。api 是服务端,不在本闸射程。 */
const SCAN_PATHS = ['apps/web', 'apps/mobile-rn', 'apps/miniapp-taro', 'apps/cli', 'packages']

/**
 * 已知债:2026-11-26 已清零 —— CLI 接上了 `@ihui/agent-sdk` 依赖并改用 ACP_METHODS。
 * 表保留是为了下次真需要登记时不再改结构;空表即"零容忍"。
 */
const BASELINE = new Map()

const ALLOW_PREFIXES = [
  'packages/types/src/agent-protocol.ts',
  'packages/agent-sdk/src/',
  'packages/agent-sdk/tests/',
]
const ALLOW_PATTERNS = [/\/tests\//, /\/__tests__\//, /\/fixtures\//]

function allowed(path) {
  if (ALLOW_PREFIXES.some((prefix) => path.startsWith(prefix))) return 'sdk'
  if (ALLOW_PATTERNS.some((re) => re.test(path))) return 'test'
  if (BASELINE.has(path)) return 'baseline'
  return null
}

function grepFiles() {
  const args = ['grep', '-l', '-F', ...METHOD_LITERALS.flatMap((lit) => ['-e', lit]), '--', ...SCAN_PATHS]
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    // git grep 无命中时退出码 1 —— 这是"全部干净",不是失败
    if (error?.status === 1) return []
    throw error
  }
}

function isSourceFile(path) {
  return /\.(ts|tsx|js|mjs|cjs)$/.test(path) && !/\.d\.ts$/.test(path)
}

/**
 * `git grep -l` 会把"注释里提到协议名"的文件也列进来(如 `* 转成 session/update 载荷`)。
 * 注释不是第二真相源,只按**代码**判:读 worktree 面,`hideComments` 之后再查字面量。
 * 读不到就按"有命中"处理(fail-safe:宁可多报一次,不可漏报)。
 */
function hasLiteralInCode(file) {
  let source
  try {
    source = readWorktreeFile(ROOT, file)
  } catch {
    return true
  }
  const code = hideComments(source)
  return METHOD_LITERALS.some((lit) => code.includes(lit))
}

export function main() {
  const files = grepFiles().filter(isSourceFile).filter(hasLiteralInCode)
  let sdk = 0
  let test = 0
  const baselineHit = []
  const offenders = []
  for (const file of files) {
    const kind = allowed(file)
    if (kind === 'sdk') sdk += 1
    else if (kind === 'test') test += 1
    else if (kind === 'baseline') baselineHit.push(file)
    else offenders.push(file)
  }

  const state = offenders.length ? 'red' : 'ok'
  console.log(
    `[L14 协议单一真相源] state=${state} 命中=${files.length} sdk=${sdk} 测试=${test} 存量债=${baselineHit.length} 越界=${offenders.length}`,
  )
  for (const file of baselineHit) {
    console.log(`  · 存量债 ${file} —— ${BASELINE.get(file)}`)
  }
  for (const file of offenders) {
    console.log(`  ❌ ${file} 自带协议字面量(应改用 @ihui/types 的 ACP_METHODS)`)
  }
  if (!offenders.length) {
    console.log('  ✅ 除 sdk 与测试外,无第二份方法名字面量')
  }
  process.exit(offenders.length ? 1 : 0)
}

// §22d 入口守卫:只在直接运行时执行。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
