// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-stale-copy.mjs — 陈旧副本检测守门(pre-commit blocking, AGENTS.md §22)。
 *
 * 背景(2026-09-14 338 快照事故):338 项 staged WIP 夹带 2026-09-13 生产关键工作
 * 的整体回退(计费 roundCents/多模态计费/4 迁移/守门脚本),typecheck/守门全绿
 * 也发现不了(删功能不报错、测试也被删)。根因:staged 区被并行会话塞入
 * **陈旧副本**(文件内容 = 基线祖先的历史版本,如从旧检出/旧分支 checkout 的文件)。
 *
 * 判定(仅对 staged 的 M/D 文件):
 *   D 红旗类:被删除文件命中保护区(数据库迁移/测试/守门脚本)→ blocking,
 *     要求 HUSKY_SKIP_STALE_COPY=1 或逐条给出理由。
 *   M 陈旧副本:worktree blob 与**基线祖先的历史版本**一致(即内容是旧版)→ blocking。
 *     判定法:该 blob 曾出现在「基线祖先」的历史提交中(而非基线之后),即
 *     `git log --all --find-object=<blob> -- <path>` 最早命中 commit 是 HEAD 的祖先。
 *
 * 红旗路径(删除即拦):
 *   packages/database/drizzle 下的 .sql   数据库迁移(计费/多模态/结构变更)
 *   apps 下各端 tests 目录中的测试文件     测试文件
 *   scripts/check-*.mjs                   守门脚本
 *   scripts/lib/*.mjs                     守门共享库
 *
 * 跳过方法:HUSKY_SKIP_STALE_COPY=1 git commit ...
 */
import { execSync } from 'node:child_process'

const shSafe = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim()
  } catch {
    return ''
  }
}

/** 基线提交:main 分支与 origin/main 的分叉点 */
const BASE = shSafe('git merge-base HEAD origin/main') || 'HEAD'

/** 红旗路径(删除即拦):数据库迁移 / 测试 / 守门脚本 / 守门共享库 */
const RED_FLAG_DELETE = [
  /packages\/database\/drizzle\/.*\.sql$/,
  /packages\/database\/drizzle\/meta\//,
  /^apps\/[^/]+\/tests\/.*\.(test|spec)\.(ts|tsx|py)$/,
  /^tests\/.*\.(test|spec)\.(ts|py)$/,
  /^scripts\/(check|guard)[\w-]*\.mjs$/,
  /^scripts\/lib\/[\w-]+\.mjs$/,
]

function main() {
  // pre-commit 场景:只看 staged 区(git diff --cached),即本次要提交的内容
  // core.quotePath=false:中文路径不被引号转义,保证 slice(3) 定位准确
  const statusRaw = shSafe('git -c core.quotePath=false diff --cached --name-status')
  // name-status 行以制表符分隔状态与路径(R/C 改名行还有第二路径);slice(3) 定位
  // 对含中文/改名行会错位,必须按 \t 分割
  const entries = statusRaw
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const tab = l.indexOf('\t')
      return { x: l[0], path: l.slice(tab + 1).trim() }
    })
    .filter((e) => !e.path.startsWith('.ihui-agent/') && !e.path.includes('loop-runtime'))

  const blocked = []
  const checked = { deleted: [], stale: [] }

  for (const e of entries) {
    const path = e.path.replace(/\\/g, '/')
    // D = 工作区删除(staged 删除在 porcelain 里是 'D ')
    const isDeleted = e.x === 'D' || e.y === 'D'
    if (isDeleted && RED_FLAG_DELETE.some((r) => r.test(path))) {
      blocked.push({ path, kind: '删除红旗文件(迁移/测试/守门脚本)' })
      continue
    }
    if (e.y === 'M' || e.x === 'M') {
      // 已修改文件:blob 级陈旧副本检测(blob 在基线祖先中出现过)
      const blob = shSafe(`git rev-parse :${JSON.stringify(path)}`)
      if (!blob) continue
      const hits = shSafe(
        `git log --all --format=%H --find-object=${blob} -- "${path}"`,
      )
        .split('\n')
        .filter(Boolean)
      const real = hits.filter((h) => h !== BASE)
      if (real.length === 0) continue // 新内容
      const oldest = real[real.length - 1]
      const isAncestor = shSafe(`git merge-base --is-ancestor ${oldest} ${BASE} && echo yes`)
      if (isAncestor === 'yes' && real.length > 1) {
        blocked.push({ path, kind: '陈旧副本(blob=基线祖先历史版本)' })
        checked.stale.push(path)
      }
    }
  }

  if (blocked.length > 0) {
    console.error('\n❌ 陈旧副本守门(blocking):检测到生产关键文件被回退/删除\n')
    console.error('违反 AGENTS.md §22 + 2026-09-15 立规:338 快照曾夹带生产关键工作的')
    console.error('整体回退(计费 roundCents/多模态计费/4 迁移/守门脚本),typecheck/守门')
    console.error('全绿也发现不了(删功能不报错、测试也被删)。逐项:')
    for (const b of blocked) {
      console.error(`  [陈旧副本] ${b.path}\n    原因: ${b.kind}`)
    }
    console.error('\n修复方法:')
    console.error('  1. 确为有意删除 → HUSKY_SKIP_STALE_COPY=1 git commit ...(并在 commit message 说明理由)')
    console.error('  2. 确为陈旧副本 → git checkout origin/main -- <文件路径> 还原后重新暂存')
    console.error('  3. 详细检测法:.ihui-agent/tmp/detect-stale2.mjs(blob 是否为基线祖先历史版本)')
    process.exit(1)
  }
  console.log('✅ 陈旧副本守门通过')
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
