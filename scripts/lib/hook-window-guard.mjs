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
 *      (兜底会把外来件照样交出去,护栏就白装了)并 exit 1;
 *   6. **空树档(2026-10-30 补)**:同一处复量还比较"此刻写树是否等于 HEAD 的树"。相等 ⇒ 这枚
 *      提交什么都没交出去(索引被并发会话 reset 清空那格的实测形态),一律拦。它排在
 *      `blocking` 之前:外来件至少说明有内容进了提交,空树则连内容都没有,而调用者毫不知情。
 *
 * 刻意不给豁免 env(G-920 同判):出路只有两条 —— 等窗口期外来件被其主会话落地/撤走后重跑,
 * 或改走 `scripts/object-space-land.mjs`(只交声明集,天然无窗口)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { diffForeignIndexEntries, foreignEntryAdvice } from './commit-payload-attribution.mjs'
import { gitStagedPaths } from './git-paths.mjs'
import { describeFlagToken, flagValue } from './flag-value.mjs'

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
 * 当前索引写出的树是否与 HEAD **完全相同**(⇒ 提交出去只能得到一枚空提交)。
 *
 * 2026-10-30 立(实测踩中):`git commit` 在索引已空、而钩子运行前已判定"有变化"时,
 * 会把 HEAD 的树原样交成一枚新提交 —— 树与父提交一字不差,`git log` 多一条噪音,
 * 而调用者声明的文件**根本没进去**。safe-commit 随后在 Step 5 报"未落地的声明路径",
 * 归因却指向"暂存面被清空" —— 现象与成因对不上,因为真正该拦住它的时刻是**这里**。
 *
 * 判据只取退出码,不取路径(路径取材仍唯一走 gitStagedPaths,§22c):
 *   `git diff --cached --quiet HEAD --` → 0 = 无差异 / 1 = 有差异 / 其余 = 取不到判定面。
 * 取不到(初生仓无 HEAD、索引损坏)一律返回 **false 不据此拦** —— 宁可漏拦一次,
 * 也不让一个读不出的判定面把所有提交钉死(§12e 恒红门禁令)。
 */
export function indexMatchesHead(repoRoot) {
  const r = spawnSync('git', ['diff', '--cached', '--quiet', 'HEAD', '--'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r.status === 0
}

/**
 * pre-commit 末尾的复量(判据 = diffForeignIndexEntries,唯一一份)。
 * 基线 = 发令前全量索引快照;expected = env 声明集(本链窗口期对声明路径的 add 放行)。
 * 返回判据原样结果(附 `emptyWrite`:此刻写树是否必然产出空提交);CLI 层负责打印与退出码。
 */
export function checkHookWindow({ repoRoot, baselineFile, expectedRaw = '' }) {
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')).map(norm)
  const current = gitStagedPaths({ root: repoRoot }).map(norm)
  const d = diffForeignIndexEntries({ baseline, current, expected: parseExpectedEnv(expectedRaw) })
  return { ...d, emptyWrite: indexMatchesHead(repoRoot) }
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
  // 2026-10-30:空树档必须排在 blocking 之前 —— 它的后果比"被灌入外来件"更彻底:
  // 外来件至少说明有内容进了提交,空树则是这一枚什么都没交出去,而调用者毫不知情。
  if (d.emptyWrite) {
    console.error(
      '[hook-window] 拒发本枚提交:当前索引与 HEAD 完全相同 —— 写树得到的树与父提交一字不差,' +
        '这一枚会是一枚**空提交**(git log 多一条噪音,而声明的改动根本没进去)。',
    )
    console.error(
      '  最常见成因:并发会话的 safe-commit Step 1 会 `git reset HEAD` 清空整个共享索引,' +
        '而本机钩子链长达 9~15 分钟,窗口期足以被清空 —— 于是 git 在索引已空的时刻写树。',
    )
    if (d.resolved.length)
      console.error(
        `  本次窗口期已观测到 ${d.resolved.length} 条从索引消失(见上方记账行),与"空树"互相印证。`,
      )
    for (const p of parseExpectedEnv(process.env.IHUI_DECLARED_FILES ?? '').slice(0, 6))
      console.error(`     声明: ${p}`)
    console.error(
      '  出路:原样重试本命令(Step 1-3 会重新暂存并逐文件校验)。' +
        '**不要** `git reset HEAD~1` —— HEAD~1 是相对位置不是身份,并发会话随时可以把尖端推走。',
    )
    console.error(GUARD_MARK)
    return 1
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
    // G-322 第十六批(B 档收口):旗标在场但缺值/被顶值时点名判死,不得把 undefined 静默往下传。
    for (const name of ['--baseline', '--repo']) {
      const flag = flagValue(args, name)
      if (!flag.valid) {
        console.error(`❌ ${name} 需要一个参数 —— 紧邻的 token 实得:${describeFlagToken(flag)}`)
        return 2
      }
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
  indexMatchesHead,
  GUARD_MARK,
  // §22c 接线锁:护栏的判据必须是 commit-payload-attribution 那一份本体,不得复制第二遍。
  judgeRef: diffForeignIndexEntries,
  adviceRef: foreignEntryAdvice,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
