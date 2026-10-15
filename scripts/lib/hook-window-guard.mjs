// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钩子运行期外来件护栏(O43 建议②,2026-10-15 机主拍板落地)。
 *
 * 病灶(台账 O43,实测见 commit-payload-attribution.mjs 头注):`git commit` 是在 pre-commit
 * 钩子跑完【之后】才写树,而钩子链在本机 ≈15 分钟;期间任何会话往共享索引放的东西都会被本枚
 * 一起交出去。safe-commit 的"发令前复量"(4-pre)结构上够不到这个窗口 —— 能挡住的只有
 * 【写树前】再复量一次,而写树前唯一还挂得住的点是 pre-commit 钩子自身的末尾。
 *
 * 机制(建议②,保留普通提交形态):
 *   1. safe-commit 每次发令前取**全量索引快照**作基线(含他人的已暂存水位 —— 那是既成事实,
 *      只拦"窗口期新进",差值棘轮语义与 4-pre 完全一致);
 *   2. 本模块生成一个临时 hooksPath 目录:**逐文件转发 `.husky` 下全部钩子**(少转一个就是静默
 *      摘钩子,O43 票面点名的代价),其中 `pre-commit` 在转发成功后追加一次复量;
 *   3. safe-commit 以 `git -c core.hooksPath=<临时目录> commit` 发令;
 *   4. 复量判据**只有一份**:`diffForeignIndexEntries()`(§0.6/§22c,本模块不重写第二遍)。
 *      expected 取 env `IHUI_DECLARED_FILES`(safe-commit 本就把声明集传给钩子链)—— 本链自己
 *      在窗口期对声明路径的 add 放行,其余新进一律判红;
 *   5. 判红输出以 `IHUI_HOOK_WINDOW_GUARD_BLOCK` 结尾,safe-commit 据此**拒绝 --no-verify 兜底**
 *      (兜底会把外来件照样交出去,护栏就白装了)并 exit 1。
 *
 * 刻意不给豁免 env(G-920 同判):出路只有两条 —— 等窗口期外来件被其主会话落地/撤走后重跑,
 * 或改走 `scripts/object-space-land.mjs`(只交声明集,天然无窗口)。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { diffForeignIndexEntries, foreignEntryAdvice } from './commit-payload-attribution.mjs'
import { gitStagedPaths } from './git-paths.mjs'

const norm = (p) => String(p).replaceAll('\\', '/')

/** 判红收尾标记:safe-commit 扫 hookOutput 找它来拒绝 --no-verify 兜底。 */
export const GUARD_MARK = 'IHUI_HOOK_WINDOW_GUARD_BLOCK'

/**
 * `.husky` 下需要转发的钩子文件名(排除 README.md 与点文件),字典序保证确定性。
 * `git commit` 只会触发 pre-commit / prepare-commit-msg / commit-msg / post-commit,
 * 但其余文件(pre-push / post-merge / …)原样转发成本为零、漏转风险不对称 —— 全转。
 */
export function huskyHookNames(repoRoot) {
  const dir = join(repoRoot, '.husky')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f !== 'README.md' && !f.startsWith('.')).sort()
}

/** 解析声明集 env(`IHUI_DECLARED_FILES`,换行分隔)→ 归一化数组;空/缺省 = 空集。 */
export function parseExpectedEnv(raw) {
  return String(raw ?? '')
    .split('\n')
    .map((s) => norm(s.trim()))
    .filter(Boolean)
}

/**
 * 生成单个转发器脚本体。`pre-commit` 转发成功后追加复量;其余原样 exec(参数/stdin 透传)。
 * 独立成纯函数是为了镜像测试能锁"先转发后复量"与"其余钩子不带复量"两个形状(O43 票面:
 * 漏转一个钩子 = 静默摘钩子,这是本方案最贵的失效方向)。
 */
export function buildForwardBody({ hook, realHookPath, repoRoot, baselineFile }) {
  const real = norm(realHookPath)
  const repo = norm(repoRoot)
  const nodeBin = norm(process.execPath)
  if (hook === 'pre-commit') {
    return [
      '#!/bin/sh',
      `# O43建议② 钩子运行期外来件护栏:先转发真实钩子(.husky/pre-commit),成功后写树前复量索引。`,
      `# 本文件由 safe-commit 每次发令前重生成,手改无效。`,
      `sh "${real}" "$@" || exit $?`,
      `exec "${nodeBin}" "${repo}/scripts/lib/hook-window-guard.mjs" --check --baseline "${norm(baselineFile)}" --repo "${repo}"`,
      '',
    ].join('\n')
  }
  return [
    '#!/bin/sh',
    `# O43建议② 原样转发真实钩子(.husky/${hook}),行为逐字不变(少转=静默摘钩子)。`,
    `# 本文件由 safe-commit 每次发令前重生成,手改无效。`,
    `exec sh "${real}" "$@"`,
    '',
  ].join('\n')
}

/**
 * 建临时 hooksPath 目录。`.husky` 不存在/为空 ⇒ 返回 `hooksDir: null`(无可转发,调用方裸跑,
 * 与现状等价 —— 夹具仓/无钩子仓不为此多出一层)。
 */
export function buildWrappedHooksDir({ repoRoot, tmpRoot, baselinePaths }) {
  const hooks = huskyHookNames(repoRoot)
  if (!hooks.length) {
    return { hooksDir: null, hookNames: [], baselineCount: 0, cleanup() {} }
  }
  const dir = join(tmpRoot, `hook-guard-${process.pid}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  const baselineFile = join(dir, 'baseline.json')
  writeFileSync(baselineFile, JSON.stringify(baselinePaths.map(norm)))
  for (const h of hooks) {
    const body = buildForwardBody({
      hook: h,
      realHookPath: join(repoRoot, '.husky', h),
      repoRoot,
      baselineFile,
    })
    writeFileSync(join(dir, h), body)
  }
  let cleaned = false
  return {
    hooksDir: dir,
    hookNames: hooks,
    baselineCount: baselinePaths.length,
    cleanup() {
      if (cleaned) return
      cleaned = true
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* 清理失败不影响提交正确性:目录在 .ihui-agent/tmp 下,不进库 */
      }
    },
  }
}

/**
 * pre-commit 末尾的复量(判据 = diffForeignIndexEntries,唯一一份)。
 * 基线 = 发令前全量索引快照;expected = env 声明集(本链窗口期对声明路径的 add 放行)。
 * 返回判据原样结果;CLI 层负责打印与退出码。
 */
export function checkHookWindow({ repoRoot, baselineFile, expectedRaw = '' }) {
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).map(norm)
  const current = gitStagedPaths({ root: repoRoot }).map(norm)
  return diffForeignIndexEntries({ baseline, current, expected: parseExpectedEnv(expectedRaw) })
}

function printCheck({ repoRoot, baselineFile }) {
  const d = checkHookWindow({
    repoRoot,
    baselineFile,
    expectedRaw: process.env.IHUI_DECLARED_FILES ?? '',
  })
  if (d.resolved.length) {
    console.log(
      `[hook-window] 窗口期 ${d.resolved.length} 条已从索引消失(别家先落地带走了)—— 只记账,不拦: ${d.resolved.slice(0, 6).join(', ')}${d.resolved.length > 6 ? ' …' : ''}`,
    )
  }
  if (!d.blocking) {
    console.log(`[hook-window] 写树前复量通过(基线 ${d.baselineForeign.length} 条水位未涨)`)
    return 0
  }
  console.error(
    `[hook-window] 拒发本枚提交:pre-commit 运行期间 ${d.newEntries.length} 条**非基线、非本票声明**的路径新进入共享索引 ——` +
      ' 此刻写树它们就会被本枚一起带走(Step 4 不带 pathspec),这就是 O43 那个"发令前复量够不到的窗口"。',
  )
  for (const p of d.newEntries.slice(0, 8)) console.error(`     ✗ ${p}`)
  if (d.newEntries.length > 8) console.error(`     …另 ${d.newEntries.length - 8} 条`)
  for (const line of foreignEntryAdvice().lines) console.error(line)
  console.error(GUARD_MARK)
  return 1
}

/** §22d:main() 守卫,process.exit 只在 main() 返回路径内。 */
function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--check') {
    const i = args.indexOf('--baseline')
    const j = args.indexOf('--repo')
    if (i < 0 || j < 0) {
      console.error('用法:node scripts/lib/hook-window-guard.mjs --check --baseline <file> --repo <root>')
      return 2
    }
    // 与 .husky/pre-commit 同一张去污处方(GIT_DIR 注入会让复量 git 读错仓)。
    for (const k of [
      'GIT_DIR',
      'GIT_WORK_TREE',
      'GIT_INDEX_FILE',
      'GIT_OBJECT_DIRECTORY',
      'GIT_ALTERNATE_OBJECT_DIRECTORIES',
      'GIT_QUARANTINE_PATH',
    ])
      delete process.env[k]
    return printCheck({ repoRoot: args[j + 1], baselineFile: args[i + 1] })
  }
  console.error(
    '用法:node scripts/lib/hook-window-guard.mjs --check --baseline <file> --repo <root>' +
      '(由 safe-commit 经临时 hooksPath 调用,不单独手跑)',
  )
  return 2
}

export const __test__ = {
  huskyHookNames,
  parseExpectedEnv,
  buildForwardBody,
  buildWrappedHooksDir,
  checkHookWindow,
  GUARD_MARK,
  // §22c 接线锁:护栏的判据必须是 commit-payload-attribution 那一份本体,不得复制第二遍。
  judgeRef: diffForeignIndexEntries,
  adviceRef: foreignEntryAdvice,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
