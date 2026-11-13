// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作树台账纯函数(F-Forge,2026-11-13 立)
 *
 * 对标 DSH Forge 的「worktree option for new Sessions」。历史组件
 * `move-to-worktree-dialog.tsx`(D102)早已实现 UI,却因**没有 API 数据面**而成为孤儿;
 * 本模块把可测的三件事独立出来,路由只做"权限闸 + 执行":
 *   1. 分支名严格白名单(任何越界一律抛错,不做"清洗后放行");
 *   2. 工作树路径服务端派生(`.ihui-worktrees/<slug>`,不接受客户端路径);
 *   3. `git worktree list --porcelain` 的解析(主工作树标记 / 分支 / HEAD)。
 */

export const WORKTREE_BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/

/** 分支名 → 目录 slug(仅保留 `[A-Za-z0-9._-]`,其余压成 `-`) */
export function worktreeSlug(branch: string): string {
  return branch.replace(/[\\/]+/g, '-').replace(/[^A-Za-z0-9._-]/g, '-')
}

/** 校验分支名;不合法直接抛错(调用方转 400),不返回"清洗后的名字" */
export function assertSafeWorktreeBranch(branch: string): void {
  if (!WORKTREE_BRANCH_RE.test(branch)) throw new Error('分支名不合法')
  if (branch.includes('..') || branch.includes('//')) throw new Error('分支名不合法')
  if (branch.endsWith('/') || branch.endsWith('.') || branch.endsWith('.lock')) {
    throw new Error('分支名不合法')
  }
}

/**
 * 构造 `git worktree ...` 命令。只放行 worktree 子命令,并沿用既有 git 参数禁忌
 * (`..` / `~` / 绝对路径),避免借 slug 之外的参数逃逸。
 */
export function buildWorktreeCmd(args: readonly string[]): string {
  if (args[0] !== 'worktree') throw new Error('git 子命令未授权')
  for (const a of args) {
    if (a.includes('..') || a.includes('~') || a.startsWith('/')) {
      throw new Error(`git 参数包含不安全片段: ${a}`)
    }
  }
  return `git ${args.map((a) => (a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ')}`
}

export interface WorktreeEntry {
  path: string
  branch: string | null
  head: string | null
  /** porcelain 输出的第一段即主工作树 */
  isMain: boolean
}

export function parseWorktreePorcelain(raw: string): WorktreeEntry[] {
  const out: WorktreeEntry[] = []
  let cur: { path?: string; branch?: string | null; head?: string | null } = {}
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur.path) {
        out.push({
          path: cur.path,
          branch: cur.branch ?? null,
          head: cur.head ?? null,
          isMain: out.length === 0,
        })
      }
      cur = { path: line.slice('worktree '.length).trim() }
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length).trim()
    } else if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      cur.branch = ref.replace(/^refs\/heads\//, '') || null
    }
  }
  if (cur.path) {
    out.push({
      path: cur.path,
      branch: cur.branch ?? null,
      head: cur.head ?? null,
      isMain: out.length === 0,
    })
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
