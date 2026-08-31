#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * push 门全量 typecheck 包装(staged-scope 降级)。
 *
 * 2026-08-31 新增原因:.husky/pre-push 直跑 `pnpm typecheck:full`(→ scripts/typecheck-full.mjs
 * → pnpm -r run typecheck 串行各包 tsc --noEmit),多会话并行开发时工作区充满其他会话的
 * 未完成/损坏文件,上千个 TS1005 等错误全部来自非暂存文件,却把本次 push 阻塞
 * (输出"❌ 全量 typecheck 失败,推送已阻止")。typecheck 由 package.json script 经
 * .husky/pre-push 直接触发,难以内嵌降级逻辑,故用本包装做 staged-scope 降级判定。
 *
 * 行为:
 *   1. 运行同一命令(node scripts/typecheck-full.mjs,等价 pnpm typecheck:full),实时透传输出并捕获;
 *   2. 解析报错文件路径(tsc `path(line,col): error TSxxxx` / mypy `path:line: error:` 两种格式);
 *   3. 若暂存区非空(git diff --cached --name-only)且所有报错文件均不在暂存区
 *      → 打印"ℹ️ 全部报错文件均不在暂存区(并行会话工作区噪音),降级为警告"并以 0 退出;
 *   4. 否则(暂存区为空 / 存在暂存文件报错 / 退出码非 0 但解析不到任何错误文件)维持原失败行为,
 *      以原退出码退出 —— 遵循 §22b "tsc 未能真正运行按失败处理,禁止静默通过"。
 *
 * 用法:
 *   node scripts/check-typecheck.mjs             # 完整运行(数分钟,实时透传输出)
 *   node scripts/check-typecheck.mjs --dry-run   # 干跑:只打印暂存区快照与降级判定计划,不跑 typecheck
 *   node scripts/check-typecheck.mjs --self-test # 自测:内置样例验证解析/匹配/降级分支,不跑 typecheck
 *
 * 接入:node scripts/guardian-runner.mjs --push-gate(--push-gate 显式启用本检查,
 *       .husky/pre-push 本体不在本改动允许范围内,改由编排/手动走本包装)。
 */
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const DRY_RUN = process.argv.includes('--dry-run')
const SELF_TEST = process.argv.includes('--self-test')

/** 取暂存文件列表(仓库根相对路径,统一为 /);git 不可用返回 null(降级路径不可用,维持原失败行为) */
function getStagedFiles() {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--cached', '--name-only'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

/** 从 tsc/mypy 错误输出中提取报错文件路径(tsc 为 package 相对路径,mypy 可能为绝对路径),去重 */
function extractErrorFiles(output) {
  // 统一斜杠便于匹配(Windows tsc 可能输出反斜杠绝对路径)
  const norm = output.split('\\').join('/')
  const files = new Set()
  // tsc: path(line,col): error TSxxxx: ...(pnpm -r 前缀如 "apps/web: " 含空格仍会被 \s 正确切开;
  //      字符类允许冒号,使 Windows 绝对路径 G:/xxx/... 可被完整捕获)
  const tscRe = /([^\s(),]+?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\(\d+,\d+\):\s*error\s+TS\d+/g
  // mypy: path:line: error: ...(字符类允许冒号,同理支持绝对路径捕获)
  const pyRe = /([^\s()]+?\.py):\d+:\s*error:/g
  for (const re of [tscRe, pyRe]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(norm)) !== null) {
      files.add(m[1])
    }
  }
  return [...files]
}

/**
 * 报错文件是否命中暂存区:双向后缀匹配。
 *   - 正向:tsc 输出 package 相对路径(如 src/components/Foo.tsx)比暂存的 repo 相对路径
 *     (如 apps/web/src/components/Foo.tsx)短 → staged.endsWith('/' + errFile);
 *   - 反向:mypy/tsc 在 Windows 下输出绝对路径(G:/IHUI-AI/apps/...)比暂存条目长
 *     → errFile.endsWith('/' + staged)。
 * 误判方向安全:误判"在暂存区"只会放弃降级、维持失败,不会放过真实错误。
 */
function isPathInStaged(errFile, stagedList) {
  return stagedList.some(
    (s) => s === errFile || s.endsWith('/' + errFile) || errFile.endsWith('/' + s),
  )
}

/** 降级判定核心:暂存区非空 && 解析到报错文件 && 全部报错文件均不在暂存区 → 降级为警告 */
function shouldDegrade(errorFiles, stagedList) {
  if (!Array.isArray(stagedList) || stagedList.length === 0) return false
  if (!errorFiles || errorFiles.length === 0) return false
  return errorFiles.every((f) => !isPathInStaged(f, stagedList))
}

// ─── --self-test:内置样例验证解析/匹配/降级分支(不跑 typecheck);断言失败以 exit 1 硬失败 ───
if (SELF_TEST) {
  let failedCount = 0
  function assert(cond, msg) {
    if (cond) console.log(`[self-test]   ✅ ${msg}`)
    else {
      failedCount++
      console.error(`[self-test]   ❌ ${msg}`)
    }
  }

  const stagedWeb = ['apps/web/app/sitemap.ts', 'apps/web/src/components/sidebar/SidebarActions.tsx']
  const sampleNoise = [
    'apps/web: src/components/OtherBroken.tsx(12,5): error TS1005: \';\' expected.',
    'packages/ui/src/Unfinished.tsx(3,1): error TS1005: \',\' expected.',
    'apps/api: src/routes/x.ts(1,1): error TS1128: Declaration or statement expected.',
  ].join('\n')
  const sampleStagedErr = 'apps/web: src/components/sidebar/SidebarActions.tsx(8,3): error TS2322: Type \'string\' is not assignable to type \'number\'.'
  const sampleAbs = 'G:/IHUI-AI/apps/api/src/routes/other.ts(1,1): error TS1005: \';\' expected.'
  const sampleMypy = 'apps/ai-service/app/routers/broken.py:12: error: Name "x" is not defined  [name-defined]'

  const efNoise = extractErrorFiles(sampleNoise)
  console.log(`[self-test] 样例1(全噪音,pnpm 包前缀) 解析到 ${efNoise.length} 个报错文件: ${efNoise.join(', ')}`)
  assert(efNoise.length === 3, '样例1 解析数量应为 3')
  assert(efNoise[0] === 'src/components/OtherBroken.tsx', '样例1 包前缀 "apps/web: " 不应混入捕获')

  const efStaged = extractErrorFiles(sampleStagedErr)
  assert(isPathInStaged(efStaged[0], stagedWeb), '样例2 staged 文件报错(package 相对路径)应命中暂存区(正向后缀匹配)')
  assert(!shouldDegrade(efStaged, stagedWeb), '样例2 存在暂存文件报错 → 不应降级')

  const efAbs = extractErrorFiles(sampleAbs)
  console.log(`[self-test] 样例3(Windows 绝对路径) 解析到: ${efAbs[0]}`)
  assert(efAbs[0] === 'G:/IHUI-AI/apps/api/src/routes/other.ts', '样例3 绝对路径应被完整捕获(冒号不被截断)')
  assert(isPathInStaged(efAbs[0], ['apps/api/src/routes/other.ts']), '样例3 绝对路径应可反向匹配 repo 相对暂存路径')

  const efMypy = extractErrorFiles(sampleMypy)
  console.log(`[self-test] 样例4(mypy 格式) 解析到: ${efMypy[0]}`)
  assert(efMypy.length === 1 && efMypy[0] === 'apps/ai-service/app/routers/broken.py', '样例4 mypy 格式应可解析')

  assert(shouldDegrade(efNoise, stagedWeb), '样例5 全部报错不在暂存区 → 应降级')
  assert(!shouldDegrade(efNoise, []), '样例6 暂存区为空 → 不应降级')
  assert(!shouldDegrade([], stagedWeb), '样例7 未解析到报错文件(tsc 未能运行) → 不应降级(维持失败)')

  if (failedCount > 0) {
    console.error(`[self-test] ❌ ${failedCount} 个断言失败`)
    process.exit(1)
  }
  console.log('[self-test] ✅ 全部断言通过(解析/匹配/降级判定逻辑正常)')
  process.exit(0)
}

// ─── 主流程 ───
const stagedFiles = getStagedFiles()
const stagedScope = stagedFiles !== null && stagedFiles.length > 0

if (DRY_RUN) {
  console.log('[check-typecheck] --dry-run 干跑:不实际运行 typecheck')
  console.log(
    `[check-typecheck] 暂存区文件数: ${stagedFiles === null ? '(git 不可用 → 降级路径不可用,将维持原失败行为)' : stagedFiles.length}`,
  )
  if (stagedScope) {
    for (const f of stagedFiles.slice(0, 50)) console.log(`  - ${f}`)
    if (stagedFiles.length > 50) console.log(`  ... 共 ${stagedFiles.length} 个`)
  }
  console.log(
    `[check-typecheck] staged-scope 降级: ${stagedScope ? '启用(全部报错文件均不在暂存区时 → 降级为警告 exit 0)' : '不启用(暂存区为空或 git 不可用)——报错将维持原失败行为'}`,
  )
  console.log('[check-typecheck] 将运行命令: node scripts/typecheck-full.mjs (等价 pnpm typecheck:full)')
  process.exit(0)
}

console.log(
  `[check-typecheck] 运行全量 typecheck(node scripts/typecheck-full.mjs,实时透传输出)${stagedScope ? ` [staged-scope 降级启用,暂存 ${stagedFiles.length} 文件]` : ' [暂存区为空,无降级]'}...`,
)

let out = ''
let err = ''
const child = spawn(process.execPath, [resolve(__dirname, 'typecheck-full.mjs')], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', (d) => {
  const s = d.toString()
  out += s
  process.stdout.write(s)
})
child.stderr.on('data', (d) => {
  const s = d.toString()
  err += s
  process.stderr.write(s)
})

child.on('close', (code) => {
  if (code === 0) {
    console.log('[check-typecheck] ✅ 全量 typecheck 验证通过')
    process.exit(0)
  }

  // 2026-08-31:staged-scope 降级判定(改动原因见文件头注释)
  const errorFiles = extractErrorFiles(`${out}\n${err}`)
  if (stagedScope && shouldDegrade(errorFiles, stagedFiles)) {
    console.log('')
    console.log('ℹ️ 全部报错文件均不在暂存区(并行会话工作区噪音),降级为警告')
    console.log(`ℹ️ 解析到报错文件共 ${errorFiles.length} 个(样例前 20 个):`)
    for (const f of errorFiles.slice(0, 20)) console.log(`   - ${f}`)
    console.log('ℹ️ 判定:本次 push 放行(exit 0);报错文件的类型修复由其所属会话负责')
    process.exit(0)
  }

  if (stagedScope && errorFiles.length > 0) {
    const inStaged = errorFiles.filter((f) => isPathInStaged(f, stagedFiles))
    if (inStaged.length > 0) {
      console.log(`ℹ️ ${inStaged.length}/${errorFiles.length} 个报错文件在暂存区,维持失败(样例前 20 个):`)
      for (const f of inStaged.slice(0, 20)) console.log(`   - ${f}`)
    }
  }
  if (stagedScope && errorFiles.length === 0) {
    console.log('ℹ️ 退出码非 0 但未解析到任何报错文件路径(tsc 未能真正运行/环境故障),按失败处理(§22b)')
  }
  console.error(`❌ 全量 typecheck 失败,推送已阻止(exit ${code ?? 1})`)
  process.exit(code ?? 1)
})

child.on('error', (e) => {
  console.error(`[check-typecheck] ❌ 无法启动 typecheck 进程: ${e.message}(按失败处理,禁止静默通过)`)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
