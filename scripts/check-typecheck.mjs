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
 *   3. 若「本次改动范围」非空且所有报错文件均不在该范围内
 *      → 打印"ℹ️ 全部报错文件均不在本次改动范围(并行会话工作区噪音),降级为警告"并以 0 退出;
 *   4. 否则(改动范围为空 / 存在范围内文件报错 / 退出码非 0 但解析不到任何错误文件)维持原失败行为,
 *      以原退出码退出 —— 遵循 §22b "tsc 未能真正运行按失败处理,禁止静默通过"。
 *
 * 「本次改动范围」的取值(2026-09-03 修复,见 getScopeFiles):
 *   优先 PUSH_SCOPE_FILES —— 由 .husky/pre-push 依据 git 传入的 remote_sha..local_sha 计算导出。
 *   原实现只用暂存区推断范围,而 `git push <sha>:<ref>` 这类 refspec 推送不产生暂存区,
 *   若此刻他人也没 staged 文件,降级直接失效 → 他人并行会话的半编辑态报错会硬拦本次 push。
 *   暂存区保留为兜底判据。
 *
 * 用法:
 *   node scripts/check-typecheck.mjs             # 完整运行(数分钟,实时透传输出)
 *   node scripts/check-typecheck.mjs --dry-run   # 干跑:只打印暂存区快照与降级判定计划,不跑 typecheck
 *   node scripts/check-typecheck.mjs --self-test # 自测:内置样例验证解析/匹配/降级分支,不跑 typecheck
 *
 * 接入:node scripts/guardian-runner.mjs --push-gate(--push-gate 显式启用本检查,
 *       .husky/pre-push 本体不在本改动允许范围内,改由编排/手动走本包装)。
 */
import { spawn, spawnSync } from 'node:child_process' // spawnSync:2026-09-20 超时杀进程树/定向快通道用
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import {
  attributeModuleBreakage,
  parseErrorRecords,
  pathInList,
} from './lib/ts-uncommitted-culprit.mjs'
// 硬超时上限(2026-09-20 根治推送挂起;定义前置是因为定向快通道也要用同一上限):
// 事故实证:某次 push 挂起 62 分钟零产出 —— 本脚本原先对 typecheck 子进程既无 timeout
// 也无 timer kill,只要 typecheck-full 内部卡住(pnpm -r 依赖解析失败 / worktree 各包
// 缺 node_modules 导致 tsc 静默长耗时 / typecheck.lock 持锁者僵而不退),push 就永远等待。
// 可调大:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...(大仓全量 tsc 慢于默认值时)。
const TYPECHECK_TIMEOUT_MIN = Number(process.env.IHUI_TYPECHECK_TIMEOUT_MIN || 20)
const TYPECHECK_TIMEOUT_MS = TYPECHECK_TIMEOUT_MIN * 60 * 1000
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// 只读 git 调用一律带超时(守门 80):本脚本挂在 pre-push 链上,一次挂死等于把"推送没动静"
// 复现给用户(§5b 实测 check-port-registry 一处无界 git ls-files 挂住 80 分钟)。
const GIT_READ_TIMEOUT_MS = Number(process.env.IHUI_GIT_READ_TIMEOUT_MS || 30000)

const DRY_RUN = process.argv.includes('--dry-run')
const SELF_TEST = process.argv.includes('--self-test')

/** 取暂存文件列表(仓库根相对路径,统一为 /);git 不可用返回 null(降级路径不可用,维持原失败行为) */
function getStagedFiles() {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--cached', '--name-only'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: GIT_READ_TIMEOUT_MS,
    })
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

/**
 * 取降级判据的「改动范围文件列表」,返回 { files, source }。
 *
 * 优先级:
 *   1. push-scope —— 环境变量 PUSH_SCOPE_FILES(由 .husky/pre-push 依据 git 传入的
 *      remote_sha..local_sha 计算导出)。覆盖 `git push <sha>:<ref>` 这类 refspec 推送
 *      (不产生暂存区,原逻辑会因暂存区为空而直接放弃降级)。
 *   2. staged —— 暂存区快照(原行为,兜底)。
 *
 * files 为 null 表示范围不可用(git 故障)→ 维持原失败行为,禁止静默通过。
 */
function getScopeFiles() {
  const fromPush = (process.env.PUSH_SCOPE_FILES || '')
    .split(/\r?\n/)
    .map((l) => l.trim().replaceAll('\\', '/'))
    .filter(Boolean)
  if (fromPush.length > 0) return { files: fromPush, source: 'push-scope' }

  const staged = getStagedFiles()
  // 第三兜底(2026-09-18):push-scope 为空 + 暂存区为空/不可用时,用 origin/main..HEAD
  // 差集推断本次推送范围。场景:后台 refspec 推送不产生暂存区,且 pre-push 侧
  // PUSH_SCOPE_FILES 因异常算出空集(实测日志 4 例"无可判定改动范围,无降级"),
  // 此时他人工作区噪音会硬拦推送。安全性:head-diff 只含已提交文件;合并收敛场景
  // 可能比真实推送范围宽(含他人已提交文件),方向是"更易降级"而非"漏拦"——
  // 本会话自身提交必在 HEAD 祖先链里,落在其上的报错仍会维持阻塞。
  if (staged === null || staged.length === 0) {
    const headDiff = getHeadDiffFiles()
    if (headDiff && headDiff.length > 0) return { files: headDiff, source: 'head-diff' }
  }
  if (staged === null) return { files: null, source: 'unavailable' }
  return { files: staged, source: 'staged' }
}

/** origin/main..HEAD 已提交差集(仓库根相对路径,统一 /);git 失败返回 null */
function getHeadDiffFiles() {
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', 'origin/main', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: GIT_READ_TIMEOUT_MS,
    })
    return out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

/**
 * HEAD ↔ 工作区 有差异的跟踪文件(= 未提交改动,含他人半编辑)。
 * 归因判据的第二半:"肇事文件是别人没提交的改动" —— 推的是提交不是工作区,所以这类
 * 报错与本次推送内容无关。git 失败返回 null(⇒ 归因通道不可用 ⇒ 维持原失败行为,
 * 与 §22b"tsc 未真正运行按失败处理"同一取向:判据取不到时绝不放行)。
 */
let _dirtyCache
function getWorktreeDirtyFiles() {
  if (_dirtyCache !== undefined) return _dirtyCache
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--name-only', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: GIT_READ_TIMEOUT_MS,
    })
    _dirtyCache = out
      .split(/\r?\n/)
      .map((l) => l.trim().replaceAll('\\', '/'))
      .filter(Boolean)
  } catch {
    _dirtyCache = null
  }
  return _dirtyCache
}

/** 从 tsc/mypy 错误输出中提取报错文件路径(tsc 为 package 相对路径,mypy 可能为绝对路径),去重 */
function extractErrorFiles(output) {
  // 统一斜杠便于匹配(Windows tsc 可能输出反斜杠绝对路径)
  const norm = output.split('\\').join('/')
  const files = new Set()
  // tsc: path(line,col): error TSxxxx: ...(pnpm -r 前缀如 "apps/web: " 含空格仍会被 \s 正确切开;
  //      字符类允许冒号,使 Windows 绝对路径 G:/xxx/... 可被完整捕获)
  // 2026-09-03 修正:字符类不再排除括号。Next.js 路由组 `app/(main)/xxx.tsx` 是合法路径,
  // 原 [^\s(),] 会把它截断成 "/publish/accounts/ScanLoginDialog.tsx",使该文件即便落在本次
  // 改动范围内也匹配不上 → 本该阻塞的错误被误判为他人噪音而放行(不安全方向,必须修)。
  // 「扩展名 + (\d+,\d+):」双锚定已足以界定路径边界,无需靠排除括号。
  const tscRe = /([^\s]+?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\(\d+,\d+\):\s*error\s+TS\d+/g
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
 * 报错文件是否命中范围清单:双向后缀匹配。
 *   - 正向:tsc 输出 package 相对路径(如 src/components/Foo.tsx)比范围条目
 *     (如 apps/web/src/components/Foo.tsx)短 → staged.endsWith('/' + errFile);
 *   - 反向:mypy/tsc 在 Windows 下输出绝对路径(G:/IHUI-AI/apps/...)比范围条目长
 *     → errFile.endsWith('/' + staged)。
 * 误判方向安全:误判"在范围内"只会放弃降级、维持失败,不会放过真实错误。
 * 实现抽到 scripts/lib/ts-uncommitted-culprit.mjs —— 提交门(#16)要用同一个后缀尺子
 * 做反向归因,两处各抄一份必然漂移(本仓"两张基线表"同型事故)。
 */
const isPathInStaged = pathInList

/** 降级判定核心:范围清单非空 && 解析到报错文件 && 全部报错文件均不在该范围内 → 降级为警告 */
function shouldDegrade(errorFiles, stagedList) {
  if (!Array.isArray(stagedList) || stagedList.length === 0) return false
  if (!errorFiles || errorFiles.length === 0) return false
  return errorFiles.every((f) => !isPathInStaged(f, stagedList))
}

/**
 * 完整降级判定(2026-09-24 扩第二档),返回 { degrade, mode, errorFiles, inScope, evidence }。
 *
 * mode:
 *   - 'no-scope'      范围不可用 ⇒ 不降级(维持失败,宁误拦不放过)
 *   - 'no-error-file' 退出码非 0 却解析不到报错文件 ⇒ tsc 未真正运行,按失败处理(§22b)
 *   - 'all-out-of-scope' 全部报错文件不在范围内 ⇒ 降级(原行为)
 *   - 'uncommitted-culprit' 范围内的报错**每一条**都指向"脏且不在范围内"的被引用模块
 *     ⇒ 降级,并打印肇事文件(新增;立因见该 lib 头注)
 *   - 'in-scope'      至少一条归因不掉 ⇒ 维持失败,并给出未归因清单
 */
function degradeDecision(output, scopeFiles, dirtyOverride) {
  const errorFiles = extractErrorFiles(output)
  const scopeList = Array.isArray(scopeFiles) ? scopeFiles : []
  if (scopeList.length === 0)
    return { degrade: false, mode: 'no-scope', errorFiles, inScope: [], evidence: [] }
  if (errorFiles.length === 0)
    return { degrade: false, mode: 'no-error-file', errorFiles, inScope: [], evidence: [] }
  const inScope = errorFiles.filter((f) => isPathInStaged(f, scopeList))
  if (inScope.length === 0)
    return { degrade: true, mode: 'all-out-of-scope', errorFiles, inScope, evidence: [] }

  const dirty = dirtyOverride === undefined ? getWorktreeDirtyFiles() : dirtyOverride
  if (dirty === null)
    return {
      degrade: false,
      mode: 'in-scope',
      errorFiles,
      inScope,
      evidence: [],
      note: '脏文件清单取不到(git 故障),归因通道不可用',
    }
  const att = attributeModuleBreakage({
    records: parseErrorRecords(output),
    scopeFiles: scopeList,
    dirtyFiles: dirty,
  })
  const stillRed = att.unexcused.filter((f) => isPathInStaged(f, scopeList))
  const evidence = [...att.excused.entries()]
  if (stillRed.length === 0 && evidence.length > 0)
    return { degrade: true, mode: 'uncommitted-culprit', errorFiles, inScope, evidence }
  return { degrade: false, mode: 'in-scope', errorFiles, inScope: stillRed, evidence }
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

  // 样例 8-11(2026-09-03 push-scope):`git push <sha>:<ref>` 类 refspec 推送不产生暂存区,
  // 此时降级判据必须来自 PUSH_SCOPE_FILES,否则他人并行会话噪音会硬拦本次 push。
  const prevEnv = process.env.PUSH_SCOPE_FILES
  process.env.PUSH_SCOPE_FILES =
    'apps/mobile-rn/src/components/BottomActionBar.tsx\napps/mobile-rn/src/screens/ChatScreen.tsx'
  const scopePush = getScopeFiles()
  assert(
    scopePush.source === 'push-scope' && scopePush.files.length === 2,
    '样例8 PUSH_SCOPE_FILES 非空 → 判据来源应为 push-scope,且优先于暂存区',
  )
  assert(
    shouldDegrade(efNoise, scopePush.files),
    '样例9 暂存区为空但 push-scope 有值 → 他人噪音应降级(refspec push 场景)',
  )
  const efInScope = extractErrorFiles(
    'apps/mobile-rn: src/components/BottomActionBar.tsx(12,5): error TS2322: Type X is not assignable.',
  )
  assert(
    !shouldDegrade(efInScope, scopePush.files),
    '样例10 报错文件落在 push-scope 内 → 不应降级(维持阻塞,宁可误拦)',
  )
  process.env.PUSH_SCOPE_FILES = ''
  assert(getScopeFiles().source !== 'push-scope', '样例11 PUSH_SCOPE_FILES 为空 → 应回退暂存区/不可用判据')
  // 样例12(2026-09-03):Next.js 路由组 (main) 路径 —— 原正则排除括号会截断路径,
  // 使范围内文件匹配不上而误放行(不安全方向),现应完整捕获。
  const efParen = extractErrorFiles(
    'apps/web: app/(main)/publish/accounts/ScanLoginDialog.tsx(275,50): error TS2345: Argument of type X.',
  )
  console.log(`[self-test] 样例12(Next.js 路由组含括号) 解析到: ${efParen[0]}`)
  assert(
    efParen[0] === 'app/(main)/publish/accounts/ScanLoginDialog.tsx',
    '样例12 含括号路径应被完整捕获(括号不再截断路径)',
  )
  assert(
    isPathInStaged(efParen[0], ['apps/web/app/(main)/publish/accounts/ScanLoginDialog.tsx']),
    '样例12 含括号报错路径应能命中暂存区/推送范围条目(否则会误放行)',
  )

  process.env.PUSH_SCOPE_FILES = prevEnv

  // ── 样例 13-18(2026-09-24「未提交肇事模块」归因)────────────────────────
  // 立因现场(逐字来自 .workbuddy/hook-logs/pre-push-gate.log):报错文件在推送范围内且
  // 本身完好,被删掉 export interface 的是**别人未提交**的 Upload.tsx。
  const culpritLine =
    'packages/ui-react typecheck: src/index.ts(75,28): error TS2614: Module \'"./components/Upload"\' has no exported member \'UploadLabels\'. Did you mean to use \'import UploadLabels from "./components/Upload"\' instead?'
  const scopeIdx = ['packages/ui-react/src/index.ts']
  const dirtyIdx = ['packages/ui-react/src/components/Upload.tsx']

  const d13 = degradeDecision(culpritLine, scopeIdx, dirtyIdx)
  assert(
    d13.degrade && d13.mode === 'uncommitted-culprit',
    '样例13 范围内报错 + 肇事模块未提交且不在范围内 → 应归因降级(真实事故形态)',
  )
  assert(
    d13.evidence.length === 1 && d13.evidence[0][1][0] === dirtyIdx[0],
    `样例13 证据必须点名肇事文件,实得 ${JSON.stringify(d13.evidence)}`,
  )

  const d14 = degradeDecision(culpritLine, scopeIdx, [])
  assert(
    !d14.degrade && d14.mode === 'in-scope',
    '样例14 反向对照:工作区无人未提交 ⇒ 这条错误就是本次推送自带的,绝不降级',
  )

  const d15 = degradeDecision(culpritLine, [...scopeIdx, ...dirtyIdx], dirtyIdx)
  assert(
    !d15.degrade,
    '样例15 反向对照:肇事文件也在本次范围内(是我们自己删的)⇒ 不可归因给别人,维持失败',
  )

  const d16 = degradeDecision(
    'packages/ui-react typecheck: src/index.ts(75,28): error TS2322: Type \'string\' is not assignable to type \'number\'.',
    scopeIdx,
    dirtyIdx,
  )
  assert(
    !d16.degrade,
    '样例16 反向对照:非模块解析类错误(TS2322)不得借"脏文件"洗白',
  )

  // 样例17:目录型模块(../editor → features/editor/index.tsx)。基准解析必须按报错文件所在
  // 目录逐级走(`src/features/chat/index.ts` 的 `../editor` = `src/features/editor`),
  // 少一级/多一级都会匹配不到 ⇒ 归因失效表现为"没有肇事者",是安全方向但会漏降。
  const d17 = degradeDecision(
    'apps/web: src/features/chat/index.ts(3,10): error TS2307: Cannot find module \'../editor\' or its corresponding type declarations.',
    ['apps/web/src/features/chat/index.ts'],
    ['apps/web/src/features/editor/index.tsx'],
  )
  assert(d17.degrade, '样例17 ../ 跳转 + 目录 index 形态的模块消失,应能归因到未提交的 index.tsx')
  assert(
    !degradeDecision(
      'apps/web: src/features/chat/index.ts(3,10): error TS2307: Cannot find module \'../editor\'.',
      ['apps/web/src/features/chat/index.ts'],
      ['apps/web/src/editor/index.tsx'],
    ).degrade,
    '样例17b 反向对照:脏文件在错误的目录层级(少一级)⇒ 不得算肇事者',
  )

  // 样例18:同一个报错文件里两条错误,只有一条能归因 ⇒ 整体不得降级(逐条全中才算)
  const d18 = degradeDecision(
    [
      culpritLine,
      'packages/ui-react typecheck: src/index.ts(90,1): error TS2322: Type \'void\' is not assignable to type \'number\'.',
    ].join('\n'),
    scopeIdx,
    dirtyIdx,
  )
  assert(!d18.degrade, '样例18 同文件混合报错(一条可归因一条不可)⇒ 维持失败')

  if (failedCount > 0) {
    console.error(`[self-test] ❌ ${failedCount} 个断言失败`)
    process.exit(1)
  }
  console.log('[self-test] ✅ 全部断言通过(解析/匹配/降级判定逻辑正常)')
  process.exit(0)
}

// ─── 主流程 ───
const scope = getScopeFiles()
const scopeFiles = scope.files
const scopeEnabled = scopeFiles !== null && scopeFiles.length > 0
const scopeLabel =
  scope.source === 'push-scope'
    ? 'push-scope(本次推送改动范围)'
    : scope.source === 'staged'
      ? 'staged-scope(暂存区)'
      : scope.source === 'head-diff'
        ? 'head-diff(origin/main..HEAD 推断兜底)'
        : '不可用(git 故障)'

if (DRY_RUN) {
  console.log('[check-typecheck] --dry-run 干跑:不实际运行 typecheck')
  console.log(`[check-typecheck] 降级判据来源: ${scopeLabel}`)
  console.log(
    `[check-typecheck] 判据文件数: ${scopeFiles === null ? '(git 不可用 → 降级路径不可用,将维持原失败行为)' : scopeFiles.length}`,
  )
  if (scopeEnabled) {
    for (const f of scopeFiles.slice(0, 50)) console.log(`  - ${f}`)
    if (scopeFiles.length > 50) console.log(`  ... 共 ${scopeFiles.length} 个`)
  }
  console.log(
    `[check-typecheck] scope 降级: ${scopeEnabled ? '启用(全部报错文件均不在本次改动范围时 → 降级为警告 exit 0)' : '不启用(改动范围为空或 git 不可用)——报错将维持原失败行为'}`,
  )
  const _dryFast = scopeEnabled ? resolveFastScopeApp(scopeFiles) : null
  console.log(`[check-typecheck] 将运行命令: ${_dryFast ? `pnpm --filter ${_dryFast.name} run typecheck(定向快速通道:改动全部位于 apps/${_dryFast.app})` : 'node scripts/typecheck-full.mjs (等价 pnpm typecheck:full)'}`)
  process.exit(0)
}

// ─── 结论打印(定向通道与全量通道共用,措辞必须一致,否则同一件事两种说法) ───
function printDegrade(dec, scopeLabel, runLabel) {
  console.log('')
  if (dec.mode === 'all-out-of-scope') {
    console.log(
      `ℹ️ ${runLabel}的 ${dec.errorFiles.length} 个报错文件均不在本次改动范围(${scopeLabel},属并行会话工作区噪音),降级为警告`,
    )
    for (const f of dec.errorFiles.slice(0, 20)) console.log(`   - ${f}`)
  } else {
    console.log(
      `ℹ️ ${runLabel}的 ${dec.inScope.length} 个报错文件在本次改动范围内(${scopeLabel}),但逐条归因后**全部**指向"他人未提交且不在范围内"的被引用模块 ⇒ 属未提交改动误伤,降级为警告`,
    )
    for (const [f, culprits] of dec.evidence.slice(0, 20))
      console.log(`   - ${f}  ←  肇事(工作区有改动、非本次范围):${culprits.join(', ')}`)
    console.log(
      'ℹ️ 依据:pre-push 推的是**提交**,而本门跑的是**工作区** tsc;该工作区编译不过不等于推送内容有问题。',
    )
  }
  console.log('ℹ️ 判定:本次 push 放行(exit 0);报错由其所属会话负责修复')
}

function printNoDegrade(dec, _scopeLabel) {
  if (dec.mode === 'no-scope') return
  if (dec.mode === 'no-error-file') {
    console.log(
      'ℹ️ 退出码非 0 但未解析到任何报错文件路径(tsc 未能真正运行/环境故障),按失败处理(§22b)',
    )
    return
  }
  if (dec.inScope.length > 0) {
    console.log(
      `ℹ️ ${dec.inScope.length}/${dec.errorFiles.length} 个报错文件在本次改动范围内且无法归因给未提交改动,维持失败(样例前 20 个):`,
    )
    for (const f of dec.inScope.slice(0, 20)) console.log(`   - ${f}`)
  }
  for (const [f, culprits] of dec.evidence.slice(0, 10))
    console.log(`   ℹ️ 另有 ${f} 可归因到未提交改动(${culprits.join(', ')}),但本轮仍有不可归因报错,不降级`)
}

// ─── 定向快速通道(2026-09-20 根治推送慢) ───────────────────────────────
// 痛点:全量门 = pnpm -r 全 workspace + 每次清 .tsbuildinfo,实测 25+ 分钟;而绝大多数
// push 的改动只落在单一 app 内(如 apps/web),全量跑完才发现「报错都在别人文件里 → 降级放行」,
// 白等 25 分钟。现增加前置裁剪:改动**全部**落在同一个 apps/<app> 目录内时才走快通道,
// 对该 app 本身仍是 100% 全量 tsc(不降强度),只是不连带全仓。
// 保守边界(任一不满足即回退全量,宁慢勿漏):
//   1. 必须有 scope 判据且非空;2. 不能含根层 scripts/**(守门自身改动必须全量回归);
//   3. 不能含 packages/**(被依赖层改动会影响下游所有 app,必须全仓);
//   4. 所有文件前缀必须是同一个 apps/<app>/;5. 该 app 的 package.json 必须有 typecheck 脚本。
function resolveFastScopeApp(files) {
  if (!Array.isArray(files) || files.length === 0) return null
  let app = null
  for (const raw of files) {
    const f = String(raw).replace(/\\/g, '/')
    if (f.startsWith('scripts/') || f.startsWith('.husky/')) return null
    if (f.startsWith('packages/')) return null
    const m = f.match(/^apps\/([^/]+)\//)
    if (!m) return null
    if (app === null) app = m[1]
    else if (app !== m[1]) return null
  }
  if (!app) return null
  const pkgPath = resolve(ROOT, 'apps', app, 'package.json')
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  } catch {
    return null
  }
  if (!pkg?.scripts?.typecheck) return null
  return { app, name: pkg.name || app }
}

const _fast = scopeEnabled ? resolveFastScopeApp(scopeFiles) : null
if (_fast) {
  console.log(
    `[check-typecheck] 🚀 定向快速通道:改动全部位于 apps/${_fast.app} → 仅对该 app 全量 tsc(其余包不参与)`,
  )
  console.log(`[check-typecheck] 命令: pnpm --filter ${_fast.name} run typecheck`)
  // stdio 必须 pipe:inherit 拿不到输出,就无法沿用下述 scope 降级判定。
  // 降级必要性(不做 = 行为退化):原先全量路径会「报错文件不在本次改动范围内 → 降级放行」,
  // 若快通道改成直接失败,则他人未提交的类型噪音会阻塞只改单文件的会话推送。
  const r = spawnSync('pnpm', ['--filter', String(_fast.name), 'run', 'typecheck'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    windowsHide: true,
    env: { ...process.env, IHUI_TYPECHECK_FULL_CHILD: '1' }, // 防该 app 脚本再套全量门
    timeout: TYPECHECK_TIMEOUT_MS,
  })
  const _fout = String(r.stdout || '')
  const _ferr = String(r.stderr || '')
  if (_fout) process.stdout.write(_fout)
  if (_ferr) process.stderr.write(_ferr)
  if (r.error && r.error.code === 'ETIMEDOUT') {
    console.error(
      `[check-typecheck] ⏰ apps/${_fast.app} 定向 typecheck 超过 ${TYPECHECK_TIMEOUT_MIN} 分钟,终止(非类型结论)`,
    )
    process.exit(1)
  }
  if (r.status === 0) {
    console.log(`[check-typecheck] ✅ apps/${_fast.app} 定向 typecheck 通过(exit 0)`)
    process.exit(0)
  }
  // 与全量路径同源的 scope 降级判定(extractErrorFiles/degradeDecision 见下方全量分支)
  const fastDec = degradeDecision(`${_fout}\n${_ferr}`, scopeFiles)
  if (fastDec.degrade) {
    printDegrade(fastDec, scopeLabel, `apps/${_fast.app} 定向 typecheck`)
    process.exit(0)
  }
  printNoDegrade(fastDec, scopeLabel)
  console.error(
    `[check-typecheck] ❌ apps/${_fast.app} 定向 typecheck 失败(exit ${r.status})——报错命中本次改动范围或不满足降级条件,按失败处理`,
  )
  process.exit(r.status ?? 1)
}

console.log(
  `[check-typecheck] 运行全量 typecheck(node scripts/typecheck-full.mjs,实时透传输出)${scopeEnabled ? ` [${scopeLabel} 降级启用,${scopeFiles.length} 文件]` : ' [无可判定改动范围,无降级]'}...`,
)

let out = ''
let err = ''
const child = spawn(process.execPath, [resolve(__dirname, 'typecheck-full.mjs')], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

// ─── 硬超时上限(2026-09-20 根治,必须保留) ─────────────────────────────
// 事故实证:某次 push 挂起 62 分钟无任何产出 —— check-typecheck 的 spawn 无 timeout、
// 无 timer kill,只要 typecheck-full 内部卡住(pnpm -r 依赖解析失败 / worktree 各包
// 缺 node_modules 导致 tsc 静默长耗时 / typecheck.lock 持锁者僵而不退),push 就永远
// 等待,用户侧表现为"推送一小时没动静"。现加硬上限:超时杀进程树并按临时失败退出。
// 可调大:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...(大仓全量 tsc 慢于默认值时)。
// 常量 TYPECHECK_TIMEOUT_MIN/MS 见文件 import 区(定向快通道共用同一上限)
let timedOut = false
const timeoutTimer = setTimeout(() => {
  timedOut = true
  console.error('')
  console.error(
    `[check-typecheck] ⏰ 全量 typecheck 超过 ${TYPECHECK_TIMEOUT_MIN} 分钟未完成,已终止(非类型检查结论)`,
  )
  console.error('[check-typecheck] 常见挂死根因(按概率排序):')
  console.error('   1. worktree 各包缺 node_modules —— tsc 解析不到 workspace 依赖而静默长耗时')
  console.error('      修法(见 skills/ihui-worktree-parallel-dev §2):给 apps/*、packages/* 各包')
  console.error('      逐个建 node_modules junction 指向主仓同名目录')
  console.error('   2. .workbuddy/typecheck.lock 被僵死进程持有 —— rm -rf .workbuddy/typecheck.lock')
  console.error('   3. pnpm -r 进程树递归 —— 复核 scripts/typecheck-full.mjs 的再入守卫 env 是否生效')
  console.error(
    '[check-typecheck] ⏭️ 按「环境挂起」处理(exit 1):不等第二次带 hook 重试,push guard 将直接降级重推',
  )
  console.error('   如需放宽上限:IHUI_TYPECHECK_TIMEOUT_MIN=40 git push ...')
  try {
    // 连带子进程树:pnpm -r 会拉出 tsc/cmd.exe 子孙,单 kill 主进程会留下孤儿继续吃 CPU
    if (child.pid) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    }
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      /* 忽略 */
    }
  }
}, TYPECHECK_TIMEOUT_MS)
timeoutTimer.unref?.()
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
  clearTimeout(timeoutTimer)
  if (timedOut) {
    // 超时分支优先于任何退出码判定:超时杀出的 code 无类型语义,不得当真实结论用。
    // 退出码刻意不用 75(临时失败)——git-push-guard 见 75 会「带 hook 重试」再跑一遍
    // 全量 typecheck,等于把一次挂死变成两次挂死(20min→40min)。走普通失败(1):
    // guard 直接降级到 --no-verify 重推,用户侧一次超时即出结论。
    process.exit(1)
  }
  if (code === 0) {
    console.log('[check-typecheck] ✅ 全量 typecheck 验证通过')
    process.exit(0)
  }

  // 2026-09-18 中断分类:进程被外部杀死(CTRL_C 注入/宿主清树/管道中断)≠ 类型检查结论。
  // 实测日志 39 次 exit 3221225786(0xC000013A)被误打印成"❌ 全量 typecheck 失败,推送已阻止",
  // 随后 guard 按"其他 agent 代码失败"规则 --no-verify 绕过真实门禁重推。现以 75(临时失败)
  // 退出,guardian-runner/hook/guard 全链路据此带 hook 重试,拿到真实类型检查结论。
  const INTERRUPT_EXIT_CODES = new Set([130, 137, 141, 143, 3221225786])
  if (INTERRUPT_EXIT_CODES.has(code)) {
    console.error(`[check-typecheck] ⚠️ typecheck 进程被中断(exit ${code},CTRL_C/管道中断),非类型检查结论`)
    console.error('[check-typecheck] ⏭️ 按临时失败处理(exit 75)—— push 侧将带 hook 重试以获取真实结论')
    process.exit(75)
  }

  // 2026-08-31:staged-scope 降级判定;2026-09-24 补「未提交肇事模块」归因(改动原因见文件头注释)
  const dec = degradeDecision(`${out}\n${err}`, scopeFiles)
  if (dec.degrade) {
    printDegrade(dec, scopeLabel, '全量 typecheck')
    process.exit(0)
  }
  printNoDegrade(dec, scopeLabel)
  console.error(`❌ 全量 typecheck 失败,推送已阻止(exit ${code ?? 1})`)
  process.exit(code ?? 1)
})

child.on('error', (e) => {
  console.error(`[check-typecheck] ❌ 无法启动 typecheck 进程: ${e.message}(按失败处理,禁止静默通过)`)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
