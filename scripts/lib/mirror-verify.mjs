// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// seal/re-home 共用的"镜像复制内容校验链" —— 唯一实现,别处不得再抄。
//
// 立因(G-1018197,2026-10-02):这条链此前只住在 scripts/re-home-junctions.mjs 里,
// 而做同一件事(seal C 盘盘根游离目录 → 搬进外置根 → 才删源)的 scripts/seal-c-root-stray.mjs
// 自己另写了一份"路径存在性对账",配上 cpSync(force:false) 会在目标已有同名文件时
// **保留目标侧旧字节然后删掉源**。两处算同一件事必须共用一份实现(§22c / 守门 134 同一条理由),
// 所以把整条链搬到这里,两个调用方各自 import。
//
// 分工口径不得混:
// - fingerprintTree/sameFingerprint/diffFingerprint 只量**路径集合与字节数**,便宜,可以每轮跑;
// - contentDiff/firstContentMismatch 走流式 sha256,只在"真的要把源删掉"之前跑一次
//   (守护每 2 分钟一趟,.cargo 型 947MB/21760 文件的树不能每次全量哈希);
// - 两者都**不跟随重解析点**(§26 junction 穿透会把别处真实数据算进我们的账)。

import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

/** 全量走一遍,**不跟随重解析点**;返回 { files: Map<相对路径, 字节> } */
export function fingerprintTree(root) {
  const files = new Map()
  if (!existsSync(root)) return files
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()
    let entries = []
    try {
      entries = readdirSyncSafe(cur)
    } catch {
      continue // 权限/占用:该子树读不到,由校验步骤按"数量不一致"抓住
    }
    for (const e of entries) {
      const full = join(cur, e.name)
      let st = null
      try {
        st = lstatSync(full)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) continue // 不穿透
      if (st.isDirectory()) stack.push(full)
      else if (st.isFile()) files.set(relative(root, full).replace(/\\/g, '/'), st.size)
    }
  }
  return files
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir).map((n) => ({ name: n }))
  } catch {
    return []
  }
}

/** 两份指纹全等?(相对路径集合 + 每个字节数) */
export function sameFingerprint(a, b) {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    if (!b.has(k) || b.get(k) !== v) return false
  }
  return true
}

/** 分块算 sha256(不把整个文件读进内存 —— .cargo 里有数百 MB 的单文件)。读不到返回 null。 */
export function digestFile(p) {
  const h = createHash('sha256')
  const buf = Buffer.alloc(1 << 20)
  let fd
  try {
    fd = openSync(p, 'r')
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null)
      if (n <= 0) break
      h.update(buf.subarray(0, n))
    }
    return h.digest('hex')
  } catch {
    return null
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        /* 关闭失败不影响已算出的摘要 */
      }
    }
  }
}

/**
 * fpA 与 fpB **同路径同尺寸**的相对路径迭代器 —— 内容级判据的唯一取材入口。
 * 尺寸已不同的条目不在这里报(那是 sameFingerprint/diffFingerprint 的活),因为
 * 两处各喊一次会让同一条差异进两份台账(守门 134 的"两把尺子互相顶结论"同型)。
 * 刻意只走 fpA 的键:两侧都跳过重解析点(fingerprintTree 的定义),所以这里出现的
 * rel 两侧都是普通文件,digestFile 不会顺着 junction 穿透到别处(§26 头号危险)。
 */
function* eachSameSizeFile(fpA, fpB) {
  for (const [rel, size] of fpA) {
    if (fpB.has(rel) && fpB.get(rel) === size) yield rel
  }
}

/**
 * 内容级对账,只比"两侧同尺寸"的文件。
 *
 * 为什么必须有它:`fingerprintTree` 记的是 `相对路径 → 字节数`,而 §26 承诺的是
 * "逐文件(相对路径 + **字节**)校验" —— 同尺寸不同内容可以一路通过,然后源被删掉,
 * 删的还是别家工具的真实数据(`.cargo`/`.codex`)。**尺寸已不同**的在 sameFingerprint
 * 那一层就出局,所以本函数的 IO 与"改道本身"同量级,且只对"真的要删源"的项跑一次
 * (守护每 2 分钟一趟,不能每次全量哈希 —— 这也是不把它塞进 fingerprintTree 的理由)。
 *
 * 任一侧读不到 = **不能证明相同** ⇒ 计入不同,不猜"应该一样"。攒够一条即提前停,
 * 因为结论已经成立,不必把几百 GB 读完。
 */
export function contentDiff(rootA, rootB, fpA, fpB) {
  const mismatched = []
  for (const rel of eachSameSizeFile(fpA, fpB)) {
    const a = digestFile(join(rootA, rel))
    const b = digestFile(join(rootB, rel))
    if (a === null || b === null || a !== b) mismatched.push(rel)
    if (mismatched.length >= 20) break
  }
  return mismatched
}

/**
 * 删源/删 stash 前的**最终**内容闸:全部同尺寸文件 sha256 全等 ⇒ null;
 * 任一处不同(或读不到)⇒ 立即返回该相对路径,不再把剩下的几百 GB 读完
 * (可中断性在这里是硬要求:`.cargo` 型 947MB/21760 文件的树,失败要在第一条上喊停)。
 * 与 contentDiff 共用 eachSameSizeFile/digestFile 两份实现,不另起第三遍扫描。
 * 只比**字节内容**:mtime / inode 属性 / 属主不同一律不计内容差(robocopy 复制后
 * 这些字段本就可能两侧不同,拿它们判不一致等于把门钝成另一型 —— 拦不住该拦的,还天天误拦)。
 */
export function firstContentMismatch(rootA, rootB, fpA, fpB) {
  for (const rel of eachSameSizeFile(fpA, fpB)) {
    const a = digestFile(join(rootA, rel))
    const b = digestFile(join(rootB, rel))
    if (a === null || b === null || a !== b) return rel
  }
  return null
}

/** 两份指纹的差异分类:src 独有 / dst 独有 / 字节不同 */
export function diffFingerprint(a, b) {
  const onlyA = []
  const onlyB = []
  const differ = []
  for (const [k, v] of a) {
    if (!b.has(k)) onlyA.push(k)
    else if (b.get(k) !== v) differ.push(k)
  }
  for (const k of b.keys()) if (!a.has(k)) onlyB.push(k)
  return { onlyA, onlyB, differ }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
