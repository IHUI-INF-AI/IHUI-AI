#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * safe-gc.mjs — 带锁的手动 git gc(2026-08-06 立;2026-10-11 补"不静默销毁"护栏)。
 *
 * 背景:autoGc 并发 repack 是 .git 损坏主因(8-06 实锤),已通过 gc.auto=0 禁用自动触发。
 * 但手动 git gc 若与其他 agent 的写操作并发,同样可能损坏 pack。
 * 本脚本:获取 git 写锁后执行 gc,杜绝 gc 与任何 git 写操作并发。
 *
 * ─── 2026-10-11 为什么改缺省档(这条是本文件存在的理由,别再改回去)───
 * 旧实现把 `git gc --prune=now` 写死在 main() 里,而 AGENTS.md §5b 又写着"禁止手工 git gc /
 * repack / prune:需要时用 node scripts/safe-gc.mjs"。两句话合起来的效果是:**本仓唯一被推荐的
 * GC 出口,会一次性销毁全部不可达对象,而它自己不做任何内容检查**。这正好是 §22 记过的那起事故
 * ("15 条未推送 commit 对象永久丢失")的复制品,只是这次由"安全"工具主动执行 —— 名字里的 safe
 * 一直只指"并发安全",不含"内容安全",而读文档的人会把 safe 理解成后者。
 * 现缺省档 = `git gc --prune=never`:散落对象照样收进 cruft pack(空间收益不丢),
 * 但**一个都不删**;破坏性档必须显式 `--prune-now`,且先量 §29 的三条前置,量不到即拒绝。
 *
 * 用法:
 *   node scripts/safe-gc.mjs                 # 带锁执行 git gc --prune=never(不销毁任何对象)
 *   node scripts/safe-gc.mjs --dry-run        # 只做前置与锁检查,不执行
 *   node scripts/safe-gc.mjs --prune-now      # 破坏性档:须先过 §29 三条前置,任一不成立或量不到即拒绝
 *   IHUI_GIT_NO_GC=1 环境变量可完全禁用 gc(可选策略)
 *
 * 退出码:0 = 已执行 / 已按旗标跳过;1 = 破坏性档被前置拦下(会逐条点名并给出路);2 = 脚本自身异常。
 */
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
// 剥 ANSI 只做一件事,且**不另立第四份实现**:`commit-gate-attribution` 已是"解析门输出"那层的
// 共用出口(analyze-hook-log-unknown / check-test-collection-runs / plan-bypass-ledger-report
// 各留了一份是历史欠账,不是可以照着抄的先例)。
import { stripAnsi } from './lib/commit-gate-attribution.mjs'

function run(cmd, allowFail = false) {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    // 返回值被消费(.trim() 后 return)⇒ stdout 仍须 pipe,只把 stdin 切掉
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

// ─── 判据(纯函数;镜像测试直接 import 这里,禁止在测试里抄第二份)───────────
export const FLAG_PRUNE_NOW = '--prune-now'
export const FLAG_DRY_RUN = '--dry-run'

/**
 * gc 参数的唯一出口。两档的差别只有一处,但方向不可混:
 * `--prune=never` 仍会把不可达的散落对象打进 cruft pack ⇒ 空间收益照常,而内容一个不删;
 * `--prune=now` 才销毁,且只允许在 decideGcRun() 放行后到达这里。
 */
export function gcArgsFor({ destructive = false } = {}) {
  return destructive ? ['gc', '--prune=now'] : ['gc', '--prune=never']
}

/**
 * §29 的三条前置(工作区干净 / stash 空 / 无未备份悬空 commit)。
 * 三态绝不并桶:`null` = 没量到 ⇒ 落 undetermined,而**不得**被读成"通过"。
 * 破坏性档因此只有在"三项都量到了、且都是空"时才放行 —— 拿一把量不到的尺子去授权销毁,
 * 是本仓反复记过的那一型(§5e"失败必须响"、守门 117/118"把没判写成判过了")。
 */
export function preconditionViolations({ statusLines = null, stashLines = null, unbackedHashes = null } = {}) {
  const violations = []
  const undetermined = []
  const check = (name, value, remedy) => {
    if (!Array.isArray(value)) {
      undetermined.push({ name, detail: '未取到值(派生失败或输出解析不出)', remedy })
      return
    }
    if (value.length === 0) return
    violations.push({ name, count: value.length, remedy })
  }
  check('工作区干净', statusLines, '先提交本会话改动(§12 多会话并行用 safe-commit.mjs),别人的在飞文件不得代裁')
  check('stash 为空', stashLines, '§12d 全面禁止新建 stash;存量按零损失流程 git tag backup/stash-<名>-<sha> 后再 drop 该条')
  check(
    '未备份悬空 commit 为 0',
    unbackedHashes,
    '跑 node scripts/check-commit-loss-guard.mjs --blocking --filter-stash --list-unbacked --window-days 0 取完整名单,逐枚 git tag lost-commit/<name> <hash> 并推远端(AGENTS §22/§29)',
  )
  return { violations, undetermined }
}

/**
 * 落地决定。refuse 时必须逐条点名并带 remedy —— "拒绝而不说清缺哪一条"等于给用户一条跑不通的出路。
 */
export function decideGcRun({ destructive = false, violations = [], undetermined = [] } = {}) {
  if (!destructive) {
    return { action: 'gc', args: gcArgsFor({ destructive: false }), note: '缺省档:不可达对象收进 cruft pack,不销毁' }
  }
  if (undetermined.length > 0) {
    return { action: 'refuse', why: '前置量不到(未判定不等于通过)', undetermined, violations }
  }
  if (violations.length > 0) {
    return { action: 'refuse', why: 'AGENTS §29 前置未满足', undetermined, violations }
  }
  return { action: 'gc', args: gcArgsFor({ destructive: true }), note: '破坏性档:§29 三条前置已量到且全空' }
}

/** 把 git 输出的行清单取成数组;取不到(异常)由调用方传 null 落"未判定"。 */
export function toLines(text) {
  if (typeof text !== 'string') return null
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * 门 30a 的机器可读清单解析(**纯函数**,契约由镜像测试钉住)。
 * 三态:
 *  - rc=0 而面上没有清单头 ⇒ `[]`(门判定"无未备份悬空";缺头在这里**有含义**,不是解析失败)
 *  - rc=1 且有头 ⇒ 逐枚 oid
 *  - 其它 rc / rc=1 却找不到头 / 头后一行不是完整 oid ⇒ `null` = 未判定
 * 刻意把"没头"分成两种结论:把它一律读成 `[]` 会让前置在最危险的情况下放行(门异常退出 = 没量到)。
 */
export function parseUnbackedList(stdoutText, exitCode) {
  if (typeof stdoutText !== 'string') return null
  if (exitCode !== 0 && exitCode !== 1) return null
  const lines = stripAnsi(stdoutText)
    .split('\n')
    .map((l) => l.trim())
  const at = lines.findIndex((l) => l.startsWith('--list-unbacked:'))
  if (at < 0) return exitCode === 0 ? [] : null
  const oids = []
  for (const l of lines.slice(at + 1)) {
    if (l === '') continue
    if (!/^[0-9a-f]{40}$/.test(l)) break
    oids.push(l)
  }
  return oids.length > 0 || exitCode === 0 ? oids : null
}

const DRY_RUN = process.argv.includes(FLAG_DRY_RUN)

/**
 * 量 §29 三条前置。全部在**取到锁之后**调用:锁外量到的"干净"到销毁那一刻已经不成立。
 * 三项一律"量不到 ⇒ null",由 preconditionViolations 落未判定 ⇒ 破坏性档拒绝。
 */
function measurePreconditions(repoRoot) {
  const status = run('git status --porcelain', true)
  const stash = run('git stash list', true)
  return preconditionViolations({
    statusLines: status === null ? null : toLines(status),
    stashLines: stash === null ? null : toLines(stash),
    unbackedHashes: listUnbackedHashes(repoRoot),
  })
}

/**
 * 未备份悬空清单 = **只消费守门 30a 的机器可读出口**,本器不自立"什么算未备份"的判据
 * (§22c:两处算同一件事必然漂开)。`--window-days 0` 是刻意的:破坏性 gc 会销毁**全部**不可达
 * 对象,不看窗;窗只决定"提交链拦哪一档",不决定"gc 毁哪一档"。
 */
function listUnbackedHashes(repoRoot) {
  const gate = join(repoRoot, 'scripts', 'check-commit-loss-guard.mjs')
  const r = spawnSync(
    process.execPath,
    [gate, '--blocking', '--filter-stash', '--list-unbacked', '--window-days', '0'],
    // 2026-10-04 同一条本机纪律:不吃的子进程也必须给 stdio,否则 spawnSync EBUSY
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 900000 },
  )
  if (r.error || typeof r.status !== 'number') return null
  return parseUnbackedList(r.stdout ?? '', r.status)
}

function printPreconditionReport({ violations = [], undetermined = [] }) {
  for (const v of violations) {
    console.log(`  ❌ 前置不成立:${v.name}(实测 ${v.count} 条)⇒ 出路:${v.remedy}`)
  }
  for (const u of undetermined) {
    console.log(`  ⚠️ 前置量不到:${u.name}(${u.detail})⇒ 未判定不等于通过,破坏性档拒绝`)
  }
}

function main() {
  if (process.env.IHUI_GIT_NO_GC === '1') {
    console.log('⏭  IHUI_GIT_NO_GC=1,gc 已禁用')
    return
  }
  const repoRoot = run('git rev-parse --show-toplevel', true)
  if (!repoRoot) {
    console.error('❌ 不在 git 仓库中')
    process.exit(1)
  }
  // separate-git-dir 布局下 repoRoot/.git 只是指针文件,直接拼路径恒不存在;
  // 用 rev-parse --absolute-git-dir 动态取真实 gitdir 再拼锁路径。
  // 若取不到真实 gitdir,则跳过预检(不抛异常中断 gc)。
  const absGitDir = run('git rev-parse --absolute-git-dir', true)
  const lockPath = absGitDir ? join(absGitDir, 'ihui-git-write.lock') : null
  if (lockPath && existsSync(lockPath)) {
    console.log('⏭  检测到 git 写锁,跳过 gc(有其他写操作进行中)')
    return
  }
  const destructive = process.argv.includes(FLAG_PRUNE_NOW)
  if (DRY_RUN && !destructive) {
    console.log('✅ 无写锁,gc 可安全执行(--dry-run 未执行;缺省档不销毁任何对象)')
    return
  }
  const unit = `safe-gc-${process.pid}-${Date.now()}`
  let acquired = false
  try {
    run(`node ${repoRoot}/scripts/git-lock.mjs acquire --unit ${unit} --timeout 60000`)
    acquired = true
    // 2026-09-18:gc repack 可达数分钟,spawn 心跳续期防长流程被误判悬挂锁抢占
    try {
      spawn(
        process.execPath,
        [`${repoRoot}/scripts/git-lock.mjs`, 'heartbeat', '--unit', unit, '--parent-pid', String(process.pid)],
        // windowsHide 必须带:Windows 下 detached+控制台程序会弹新 cmd 窗口
        { detached: true, windowsHide: true, stdio: 'ignore' },
      ).unref()
    } catch {
      /* 心跳失败不阻塞(stale 判定仍按"pid 存活"兜底) */
    }

    // 前置**必须在锁内量**:锁的意义就是"这段时间没有别的写者",出了锁量到的"干净"
    // 到销毁那一刻已经不成立。缺省档不销毁,所以不需要前置(也就不为它付 fsck 的代价)。
    const pre = destructive
      ? measurePreconditions(repoRoot)
      : { violations: [], undetermined: [] }
    if (destructive) printPreconditionReport(pre)
    const decision = decideGcRun({ destructive, violations: pre.violations, undetermined: pre.undetermined })

    if (decision.action === 'refuse') {
      console.error(
        `❌ 拒绝执行破坏性 gc(${decision.why})—— \`git gc --prune=now\` 会一次性销毁全部不可达对象,` +
          `而本仓 §22/§29 的前提是"先备份才允许毁"。跑不带 --prune-now 的本器可拿到不销毁的整理效果。`,
      )
      process.exit(1)
    }
    if (DRY_RUN) {
      console.log(`✅ 前置齐备,破坏性档可执行(本次 --dry-run 未执行):git ${decision.args.join(' ')}`)
      return
    }
    console.log(`🔒 已获取写锁,执行 git ${decision.args.join(' ')}(可能耗时,请勿并行 git 操作)`)
    console.log(`   └ ${decision.note}`)
    const before = run('git count-objects -v -H', true) ?? '(未量到)'
    const out = execFileSync('git', ['-c', 'safe.directory=*', ...decision.args], {
      cwd: repoRoot,
      encoding: 'utf8',
      // 2026-10-04 同一条本机纪律:必须显式 stdio,否则 spawnSync git EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      // gc 在 19GB 仓上可远超默认 execSync 上限;给 60 分钟,超时按失败报出而不是静默
      timeout: 3600000,
      maxBuffer: 64 * 1024 * 1024,
    })
    console.log(out || '')
    console.log('── gc 前 ──\n' + before)
    console.log('── gc 后 ──\n' + (run('git count-objects -v -H', true) ?? '(未量到)'))
  } finally {
    if (acquired) run(`node ${repoRoot}/scripts/git-lock.mjs release --unit ${unit}`, true)
  }
}

import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// main 是同步函数 ⇒ §22d 规定的 try/catch 形(不得写成 main().catch)
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  run,
  gcArgsFor,
  preconditionViolations,
  decideGcRun,
  parseUnbackedList,
  toLines,
  FLAG_PRUNE_NOW,
  FLAG_DRY_RUN,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
