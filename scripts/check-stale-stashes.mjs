#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-stale-stashes.mjs — Stash 滞留源码改动守门(AGENTS.md §12d 配套)
 *
 * 背景(2026-09-08 事故):
 *   "压缩上下文入口整合进添加菜单"的完整开发(3 文件)在 rebase 时被 stash
 *   (temp-stash-for-rebase)后无人回收,滞留 2 天 + 并行会话合流推进,
 *   导致 UI 上"按钮回来了"的假象(实际是工作从未落地)。stash 是黑盒:
 *   没有任何机制提醒存在滞留改动 → 内容默默失联。
 *
 * 防护目标:
 *   让 stash 里的工作**可见**且**不可静默丢失**:
 *   1. 扫描全部 stash,列出滞留时长 + 改动文件数(区分"源码改动"与纯锁文件/空 stash)
 *   2. warn:源码改动滞留超过 WARN_HOURS(默认 24h)
 *   3. blocking:源码改动滞留超过 BLOCK_HOURS(默认 48h)且**未做零损失备份**
 *      (无 backup/stash-* 或 lost-commit/* tag 指向该 stash 的 WIP commit)
 *      → 阻塞 commit,逼出处置(应用回工作区 或 tag 备份后 drop)
 *
 * 处置指引(阻塞时打印):
 *   A. 内容还想要:git stash apply "stash@{n}" → 验证 → commit 落地 → git stash drop
 *   B. 内容暂不要:零损失备份(AGENTS.md §12d):
 *      git tag backup/stash-<slug>-<sha7> "stash@{n}" -m "<subject>"
 *      (tag 指向 stash commit,内容永不丢;此后本守门放行)
 *
 * 参数:
 *   --strict        任一 stash 超过 WARN_HOURS 即 exit 1(CI/手动审计用)
 *   --warn-hours=N  warn 阈值小时数(默认 24,可用 STALE_STASH_WARN_HOURS 覆盖)
 *   --block-hours=N block 阈值小时数(默认 48,可用 STALE_STASH_BLOCK_HOURS 覆盖)
 *
 * 退出码:
 *   0 — 通过(无 stash / 全部新鲜 / 滞留但已 tag 备份)
 *   1 — blocking 条件命中(存在滞留 + 源码改动 + 未备份)
 *   2 — 脚本自身异常
 *
 * 调用方:
 *   - scripts/guardian-runner.mjs 第 30b 项(blocking,commit 守门)
 *   - scripts/dev-web.mjs 启动前(warn-only,dev 启动即看见)
 *   - apps/web predev(warn-only)
 */
import { execSync, spawnSync } from 'node:child_process'

const SKIP_ENV = 'HUSKY_SKIP_STALE_STASH_CHECK'
const isStrict = process.argv.includes('--strict')
const isBlocking = process.argv.includes('--blocking')
const skip = process.env[SKIP_ENV] === '1'

const WARN_HOURS = Number(
  process.argv.find((a) => a.startsWith('--warn-hours='))?.split('=')[1] ??
    process.env.STALE_STASH_WARN_HOURS ??
    24,
)
const BLOCK_HOURS = Number(
  process.argv.find((a) => a.startsWith('--block-hours='))?.split('=')[1] ??
    process.env.STALE_STASH_BLOCK_HOURS ??
    48,
)

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// 与 check-commit-loss-guard.mjs 同款:argv 直调 git(绕过 MSYS git shim 双重陷阱)
const GIT_BIN = (() => {
  if (process.platform !== 'win32') return 'git'
  try {
    const whereOut = execSync('where git', { encoding: 'utf8' })
    for (const raw of whereOut.split('\n')) {
      const p = raw.trim()
      if (/\\cmd\\git\.exe$/i.test(p)) return p
    }
    for (const raw of whereOut.split('\n')) {
      const p = raw.trim()
      if (/git\.exe$/i.test(p) && !/\\usr\\bin\\/i.test(p)) return p
    }
  } catch {
    /* where 失败时回退裸 git */
  }
  return 'git'
})()

function runGit(args, opts = {}) {
  const r = spawnSync(GIT_BIN, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 10_000,
    ...opts,
  })
  if (r.status !== 0) {
    if (opts.allowFail) return ''
    throw new Error(`git ${args[0]} 失败(exit=${r.status}): ${(r.stderr || '').trim().slice(0, 200)}`)
  }
  return (r.stdout || '').trim()
}

/** 锁文件/生成物不算"源码改动"(单独 stash 或混入不构成丢失风险) */
const NON_WORK_FILE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb)$/

function formatAge(ms) {
  const h = ms / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))} 分钟`
  if (h < 48) return `${Math.round(h)} 小时`
  return `${(h / 24).toFixed(1)} 天`
}

function main() {
  if (skip) {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 stash 滞留守门(不推荐)${C.reset}`)
    process.exit(0)
  }

  // 1. 列出全部 stash(ref | committer-timestamp | subject)
  const listOut = runGit(['stash', 'list', '--format=%gd%x09%ct%x09%gs'], { allowFail: true })
  if (!listOut) {
    console.log(`${C.green}✅ Stash 滞留守门:git stash 为空,无滞留改动风险${C.reset}`)
    process.exit(0)
  }

  // 2. 逐个取改动文件清单(区分源码改动 / 纯锁文件)
  const stashes = []
  for (const line of listOut.split('\n').filter(Boolean)) {
    const [ref, ts, subject] = line.split('\t')
    const createdAt = Number(ts) * 1000
    const ageMs = Date.now() - createdAt
    const filesOut = runGit(['stash', 'show', '--name-only', ref], { allowFail: true })
    const files = filesOut.split('\n').filter(Boolean)
    const workFiles = files.filter((f) => !NON_WORK_FILE.test(f))
    stashes.push({ ref, subject, ageMs, files, workFiles })
  }

  // 3. 批量取已存在的 backup/stash-* 与 lost-commit/* tag(→ peeled commit hash)
  const backupHashes = new Set()
  const tagOut = runGit(
    [
      'for-each-ref',
      'refs/tags/backup',
      'refs/tags/lost-commit',
      '--format=%(*objectname)%09%(objectname)',
    ],
    { allowFail: true },
  )
  for (const line of tagOut.split('\n').filter(Boolean)) {
    const [peeled, obj] = line.trim().split('\t')
    const h = peeled || obj
    if (/^[0-9a-f]{40}$/.test(h || '')) backupHashes.add(h)
  }

  // 4. 判级
  const report = []
  let blocking = false
  let warnOnly = false

  for (const s of stashes) {
    const ageH = s.ageMs / 3_600_000
    const level =
      ageH >= BLOCK_HOURS ? 'block' : ageH >= WARN_HOURS ? 'warn' : 'ok'
    let backed = false
    if (level === 'block') {
      // stash commit SHA(含 index/parents)任一被 tag 备份即视为已处理
      const sha = runGit(['rev-parse', s.ref], { allowFail: true })
      const parents = sha
        ? runGit(['rev-list', '--parents', '-n', '1', sha], { allowFail: true })
            .split(/\s+/)
            .slice(1)
        : []
      backed = [sha, ...parents].some((h) => h && backupHashes.has(h))
    }
    if (level === 'block' && !backed && s.workFiles.length > 0) blocking = true
    if (level === 'warn') warnOnly = true
    report.push({ ...s, level, backed, ageH })
  }

  // 5. 输出报告
  console.log(`${C.cyan}${C.bold}🎒 Stash 滞留守门(AGENTS.md §12d 配套,2026-09-08 立)${C.reset}`)
  console.log(
    `  ${C.dim}共 ${stashes.length} 个 stash | warn≥${WARN_HOURS}h | block≥${BLOCK_HOURS}h(源码改动且未备份)${C.reset}`,
  )

  for (const s of report) {
    const icon =
      s.level === 'block'
        ? `${C.red}❌`
        : s.level === 'warn'
          ? `${C.yellow}⚠️ `
          : `${C.green}✅`
    const workNote =
      s.workFiles.length > 0
        ? `源码改动 ${s.workFiles.length} 文件`
        : s.files.length > 0
          ? `仅锁文件/生成物 ${s.files.length} 文件`
          : '空 stash'
    const backNote = s.backed ? ` ${C.dim}[已 tag 备份]${C.reset}` : ''
    console.log(
      `  ${icon} ${C.cyan}${s.ref}${C.reset} ${C.dim}滞留 ${formatAge(s.ageMs)}${C.reset} | ${workNote}${backNote}`,
    )
    console.log(`     ${C.dim}${s.subject}${C.reset}`)
    if (s.level === 'block' && !s.backed) {
      for (const f of s.workFiles.slice(0, 8)) {
        console.log(`       ${C.dim}- ${f}${C.reset}`)
      }
      if (s.workFiles.length > 8) {
        console.log(`       ${C.dim}…另有 ${s.workFiles.length - 8} 个文件${C.reset}`)
      }
    }
  }

  if (!blocking && !warnOnly) {
    console.log(`${C.green}✅ 全部 stash 新鲜或无源码改动${C.reset}`)
    process.exit(0)
  }

  if (blocking && (isStrict || isBlocking)) {
    console.log(`\n${C.red}${C.bold}❌ 存在滞留 stash 含未落地源码改动且未备份,阻塞 commit${C.reset}`)
    console.log(`   处置(二选一,防再次发生"改了但页面没变"的事故):`)
    console.log(
      `   A. 落地:${C.cyan}git stash apply "stash@{n}"${C.reset} → 验证 → commit → ${C.cyan}git stash drop${C.reset}`,
    )
    console.log(
      `   B. 零损失备份后放行(AGENTS.md §12d):`,
    )
    console.log(
      `      ${C.cyan}git tag backup/stash-<slug>-<sha7> "stash@{n}" -m "<subject>"${C.reset}`,
    )
    console.log(
      `   紧急跳过(不推荐):${C.cyan}HUSKY_SKIP_STALE_STASH_CHECK=1 git commit ...${C.reset}`,
    )
    process.exit(1)
  }

  if (isStrict && warnOnly) {
    console.log(`\n${C.yellow}⚠️  --strict 模式:存在超过 ${WARN_HOURS}h 的 stash,判定失败${C.reset}`)
    process.exit(1)
  }

  console.log(
    `\n${C.yellow}💡 存在滞留 stash(见上)。若内容已完成开发,请尽快 apply 落地或 tag 备份,防止改动静默失联${C.reset}`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
  process.exit(2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
