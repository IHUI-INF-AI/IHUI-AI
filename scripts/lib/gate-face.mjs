// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-face.mjs — 判据取材面小工具(2026-11-05,门 TBD-miniapp-shell / TBD-api-endpoints 共用)。
 *
 * 为什么需要它:`scripts/lib/face-reader.mjs` 只给原语(catBatch / gitRaw / readWorktreeFile),
 * 但「一次列清单 + 一次批量取正文」这层在 check-cross-end-screen-coverage.mjs 里是私有实现。
 * 本文件把这一层抽出来给两把新尺复用,口径与既有门一致:
 *   - 默认 HEAD:`git ls-tree` 列清单,`cat-file --batch` 一次批量取正文;
 *   - `--staged`:索引面(git ls-files + `:` spec);
 *   - `--worktree`:磁盘面(人工逃生舱,允许并行会话半编辑态);
 *   - 取不到 ⇒ 抛 Undetermined(调用方 exit 2),**绝不折成空集**(空集会冒绿)。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Undetermined, catBatch, gitRaw } from './face-reader.mjs'

export const FACES = ['head', 'staged', 'worktree']
export const FACE_LABEL = {
  head: 'HEAD blob(git ls-tree + cat-file --batch)',
  staged: '索引 blob(git ls-files + :<path>)',
  worktree: '工作树(磁盘,人工逃生舱)',
}

/** 该面上的文件清单(仓库相对路径、正斜杠、排序)。dirPrefix 必须带尾斜杠或为精确目录。 */
export function faceList(root, face, dirPrefix) {
  if (face === 'worktree') {
    const base = join(root, dirPrefix)
    if (!existsSync(base)) throw new Undetermined(`worktree 面没有目录 ${dirPrefix}`)
    const out = []
    const stack = [base]
    while (stack.length) {
      const cur = stack.pop()
      for (const ent of readdirSync(cur, { withFileTypes: true })) {
        const abs = join(cur, ent.name)
        if (ent.isDirectory()) stack.push(abs)
        else out.push(relative(root, abs).replace(/\\/g, '/'))
      }
    }
    return out.sort()
  }
  const args =
    face === 'staged'
      ? ['ls-files', '-c', '--', dirPrefix]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', dirPrefix]
  try {
    return (
      gitRaw(args, root, { maxBuffer: 64 * 1024 * 1024 })
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\\/g, '/'))
        .sort()
    )
  } catch (e) {
    throw new Undetermined(`faceList(${face}, ${dirPrefix}) 取不到 ${FACE_LABEL[face]}: ${e?.message ?? e}`)
  }
}

/**
 * 批量取正文。返回 Map<rel, string|null>:null = 该面没有这份件(合法缺件,不回落另一面)。
 * 读失败(git 派生故障)⇒ 抛 Undetermined。
 */
export function readFaceBatch(root, face, rels) {
  const out = new Map()
  const list = [...new Set((rels || []).filter(Boolean).map((r) => r.replace(/\\/g, '/')))]
  if (list.length === 0) return out
  if (face === 'worktree') {
    for (const rel of list) {
      try {
        out.set(rel, readFileSync(join(root, rel), 'utf8'))
      } catch {
        out.set(rel, null)
      }
    }
    return out
  }
  const specs = list.map((rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`))
  let got
  try {
    got = catBatch(root, specs, { maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    throw new Undetermined(`readFaceBatch(${face}) 取不到 ${FACE_LABEL[face]}: ${e?.message ?? e}`)
  }
  list.forEach((rel, i) => out.set(rel, got.get(specs[i]) ?? null))
  return out
}

/** 单件读取;该面没有 ⇒ null。 */
export function readFaceOne(root, face, rel) {
  return readFaceBatch(root, face, [rel]).get(rel.replace(/\\/g, '/')) ?? null
}

/** 解析面旗标:`--worktree` / `--staged` 同给 = 面不明 ⇒ 未判定。 */
export function resolveFace(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    throw new Undetermined('--staged 与 --worktree 同给,取材面不明(不回落另一个面)')
  }
  return staged ? 'staged' : worktree ? 'worktree' : 'head'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
