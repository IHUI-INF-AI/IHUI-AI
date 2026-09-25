// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回补 guardian-runner 里"HEAD 有、工作树没有"的注册块。
 *
 * 为什么需要它(2026-09-25 实测):共享工作区里多会话都改这张注册表,而任何一次"整文件写回"
 * (含按滞后的旧副本编辑)都会把别人**已入库**的门从工作树里悄悄抹掉 —— 下一次提交 runner
 * 就等于替那个门持有者卸闸,而 `git status` 只显几行 diff,没人看得出少了一道门。
 * 本脚本只做一件事:把 HEAD 里有、工作树里缺的块原样搬回来(纯新增),并断言搬运前后
 * "工作树 ⊇ HEAD"成立。绝不删除、绝不重排已有条目。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'scripts/guardian-runner.mjs'
const ANCHOR = '  // --- info (1 项) ---'
const g = (a) => execFileSync('git', ['-c', 'safe.directory=*', ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true })

const head = g(['show', `HEAD:${FILE}`])
const wtPath = FILE
const wt = readFileSync(wtPath, 'utf8')

const idsOf = (t) => [...t.matchAll(/^    id: '([^']+)',$/gm)].map((m) => m[1])
const headIds = idsOf(head)
const wtIds = new Set(idsOf(wt))
const missing = headIds.filter((id) => !wtIds.has(id))
if (missing.length === 0) {
  console.log(`✅ 工作树已包含 HEAD 全部 ${headIds.length} 个 id,无需回补`)
  process.exit(0)
}

/** 从给定文本里切出某个 id 的注册块(含前后 `  {` / `  },`) */
function sliceBlock(src, id) {
  const lines = src.split('\n')
  const at = lines.findIndex((l) => l.trim() === `id: '${id}',`)
  if (at < 0) throw new Error(`HEAD 里找不到 id ${id}`)
  let start = at
  while (start >= 0 && !/^\s*\{$/.test(lines[start])) start -= 1
  let end = at
  while (end < lines.length && !/^\s*\},$/.test(lines[end])) end += 1
  if (start < 0 || end >= lines.length) throw new Error(`id ${id} 的块边界判不出来,拒绝猜测`)
  return lines.slice(start, end + 1).join('\n')
}

const anchorAt = wt.indexOf(ANCHOR)
if (anchorAt < 0) throw new Error('找不到 info 锚点,拒绝盲插')
const insert = missing.map((id) => sliceBlock(head, id) + '\n').join('\n')
const out = wt.slice(0, anchorAt) + insert + wt.slice(anchorAt)

// 落地前自证:回补后必须是 HEAD 的超集,且原有条目一条都没少
const outIds = idsOf(out)
const stillMissing = headIds.filter((id) => !outIds.includes(id))
const dropped = [...wtIds].filter((id) => !outIds.includes(id))
const dup = outIds.filter((v, i) => outIds.indexOf(v) !== i)
if (stillMissing.length || dropped.length || dup.length) {
  console.error(`❌ 回补后仍不成立:缺 HEAD 条目 ${stillMissing.join(',')||'-'} / 丢了工作树条目 ${dropped.join(',')||'-'} / 重复 ${dup.join(',')||'-'}`)
  console.error('   ⇒ 不落盘。这条路径需要人工核对块边界,不要让脚本猜。')
  process.exit(1)
}
writeFileSync(wtPath, out)
console.log(`✅ 已回补 ${missing.length} 个被抹掉的门:${missing.join(', ')}`)
console.log(`   回补后 id 总数 ${outIds.length}(HEAD ${headIds.length} / 工作树原 ${wtIds.size})`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
