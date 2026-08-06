#!/usr/bin/env node
/**
 * 推送删除守门(2026-08-06 事故防线)。
 *
 * 背景:一次子代理执行 git add -A 时,把全仓库 9005 个文件标记为删除后
 * commit+push(实际只想新增 1 个 workflow 文件),远程 main 被删空(只剩
 * .github 目录),386 万行代码丢失,靠本地完整历史 force push 才恢复。
 *
 * 本脚本在 .husky/pre-push 中调用,读取 pre-push stdin(每行:
 * `<local ref> <local sha> <remote ref> <remote sha>`),对每个待推送的
 * 本地提交统计"相对其父提交删除的文件数",超过阈值即拦截推送。
 *
 * 跳过方法(仅人工复核删除清单后使用):HUSKY_SKIP_DELETE_GUARD=1 git push
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

/** 累计删除文件数 >= 此值 → 阻止推送(正常提交不会一次删这么多文件) */
const DELETE_HARD_LIMIT = 500
/** 累计删除文件数 >= 此值 → 警告(允许推送,提示人工确认) */
const DELETE_WARN_LIMIT = 100

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
  } catch {
    return ''
  }
}

/** 统计某提交相对其父提交删除的文件数。无法解析父提交时返回 0。 */
function countDeletions(sha) {
  const parent = run(`git rev-parse --verify -q "${sha}^"`)
  if (!parent) return 0
  const out = run(`git diff --name-status --diff-filter=D "${parent}" "${sha}"`)
  if (!out) return 0
  return out.split('\n').filter((l) => l.trim().length > 0).length
}

function main() {
  // pre-push stdin 格式:<local ref> <local sha> <remote ref> <remote sha>
  const input = fs.readFileSync(0, 'utf8').trim()
  if (!input) return 0
  const shas = input
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 2)
    .map((p) => p[1])
  if (shas.length === 0) return 0

  let total = 0
  for (const sha of shas) {
    total += countDeletions(sha)
  }

  if (total >= DELETE_HARD_LIMIT) {
    console.error(`\n❌ 推送被拦截:本次推送累计删除 ${total} 个文件(阈值 ${DELETE_HARD_LIMIT})。`)
    console.error(`   原因:pre-push 删除守门(2026-08-06 事故防线)。`)
    console.error(`   上次事故:git add -A 误把全仓库文件当删除提交,远程仓库被删空(386 万行)。`)
    console.error(`   如果你确实要删除这么多文件(仓库级重构/迁移),请先人工核对清单:`)
    console.error(`     git diff --name-status --diff-filter=D <commit>^ <commit>`)
    console.error(`   确认无误后临时跳过(不推荐):HUSKY_SKIP_DELETE_GUARD=1 git push`)
    process.exit(1)
  }

  if (total >= DELETE_WARN_LIMIT) {
    console.error(`\n⚠️  本次推送删除 ${total} 个文件,请确认是有意删除(删除守门阈值 ${DELETE_WARN_LIMIT})。`)
  } else if (total > 0) {
    console.error(`[删除守门] 本次推送删除 ${total} 个文件,在正常范围内。`)
  } else {
    console.error('[删除守门] 通过(无文件删除)。')
  }
  return 0
}

process.exit(main())
