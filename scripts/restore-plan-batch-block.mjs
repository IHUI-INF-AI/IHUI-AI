// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 找回被并发会话抹掉的"第N批"整块正文 —— 门 71 的 --heal 只回捞带编号标记的登记行,
// 批次标题之下那些不带编号的正文 bullet 不在任何一道的视野里(门 13c 同样只认任务标题)。
// 2026-09-23 实测两次命中:并发会话按内存里的旧计划文档整文件重写工作区,第二十四批标题被
// 门 71 回捞回来后正文 6 行仍缺,第二十三批标题一直在、正文 4 行静默消失。
//
// 语义:纯插入。绝不改动、绝不删除目标文件的任何一行 —— 目标文档是共享文档,里面是别人的
//      在飞改动,本工具只负责把"HEAD 里有、目标里没有"的整行按原序补回去。
// 判据:整行精确比对(改写过措辞的行按"不同行"处理,所以必须人工点名批次,不接受通配)。
//
// 用法:
//   node scripts/restore-plan-batch-block.mjs 第二十四批 [...]        # 写工作区
//   node scripts/restore-plan-batch-block.mjs --check 第二十三批      # 只报数,缺则 exit 1
//   node scripts/restore-plan-batch-block.mjs --from <sha> 第N批     # 换内容来源(默认 HEAD)
//   node scripts/restore-plan-batch-block.mjs --self-test            # 逻辑自检,零副作用
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin, resolveWorktree } from './lib/gitdir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = 'PROJECT_PLAN.md'

/** 解析 git 二进制(绝对路径:服务账户与交互账户的 safe.directory 互不相通,§5b) */
function gitBin() {
  try {
    const r = resolveGitBin()
    return typeof r === 'string' ? r : r?.git || r?.path || null
  } catch {
    return null
  }
}

/** 读一个提交里的文件原文(不解码,保持字节级行内容) */
function showAt(sha, rel, root) {
  const bin = gitBin() || 'git'
  const r = spawnSync(bin, ['-c', 'safe.directory=*', 'show', `${sha}:${rel}`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 27,
  })
  if (r.status !== 0) throw new Error(`git show ${sha}:${rel} → ${String(r.stderr).slice(0, 160)}`)
  return String(r.stdout)
}

/**
 * 从 srcLines 的 index 处切出一块:该行到下一个 2-3 级标题为止,并剥掉块间空行。
 */
export function extractBlockAt(srcLines, index) {
  if (index < 0 || index >= srcLines.length) return null
  let end = index + 1
  while (end < srcLines.length && !/^#{2,3}\s/.test(srcLines[end])) end += 1
  const lines = srcLines.slice(index, end)
  while (lines.length > 1 && !lines[lines.length - 1].trim()) lines.pop() // 块间空行不属于内容
  return { lines, start: index }
}

/** 从 src 里切出以 headingRe 命中的那一行为首的整块(首个命中;兼容旧调用)。 */
export function extractBlock(srcLines, headingRe) {
  const start = srcLines.findIndex((l) => headingRe.test(l))
  return start < 0 ? null : extractBlockAt(srcLines, start)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 把操作员给的批次名解析成命中列表:标题必须以 `### <name>` 开头(前缀匹配,
 * 名字里的正则元字符一律转义 —— `第二十五批(2026-09-23)` 是合法前缀,不是量词)。
 */
export function headingMatches(srcLines, name) {
  const re = new RegExp('^#{2,3}\\s*' + escapeRe(name))
  return srcLines.map((l, i) => ({ line: l, index: i })).filter((h) => re.test(h.line))
}

/**
 * 唯一性策略(2026-09-24 加,起因是当天实测撞号:并发会话在 04:06 又登记了一枚
 * `### 第十九批:守门 70 覆盖补齐三端`,与本会话 09-23 的 `### 第十九批(2026-09-23):守门 71 …`
 * 同号。"取首个命中"会静默回捞错批次,所以撞号必须显式失败并要求更长前缀。)
 * 返回 { ok:true, block } | { ok:false, reason:'notfound'|'ambiguous', hits }
 */
export function resolveBlock(srcLines, name) {
  const hits = headingMatches(srcLines, name)
  if (hits.length === 0) return { ok: false, reason: 'notfound', hits }
  if (hits.length > 1) return { ok: false, reason: 'ambiguous', hits }
  return { ok: true, block: extractBlockAt(srcLines, hits[0].index), hits }
}

/**
 * 把 block(含标题行)纯插入地补齐到 target。
 * - 标题在 target 里:只把 target 缺失的正文行插到该标题之后(保持块内原序)。
 * - 标题也不在:整块追加到文件末尾(门 71 的 --heal 同款兜底,不猜锚点)。
 * 返回 { out, inserted, appendedTitle },已存在的行永不重复插。
 */
export function restoreBlock(targetLines, blockLines) {
  const heading = blockLines[0]
  const out = [...targetLines]
  const present = new Set(out)
  const at = out.findIndex((l) => l === heading)
  if (at < 0) {
    const missing = blockLines.filter((l) => l.trim() && !present.has(l))
    if (missing.length === 0) return { out, inserted: 0, appendedTitle: false }
    out.push(...missing)
    return { out, inserted: missing.length, appendedTitle: true }
  }
  const missing = blockLines.slice(1).filter((l) => l.trim() && !present.has(l))
  if (missing.length === 0) return { out, inserted: 0, appendedTitle: false }
  out.splice(at + 1, 0, ...missing)
  return { out, inserted: missing.length, appendedTitle: false }
}

/**
 * 断言"纯插入":after 必须是 before 的超序列(原行原文原序一行不少),
 * 且多出来的行数恰等于声称的插入数。不成立即抛 —— 宁可不动目标文档。
 */
export function assertPureInsertion(before, after, inserted) {
  if (after.length - before.length !== inserted)
    throw new Error(`行数变化 ${after.length - before.length} ≠ 声称插入 ${inserted},拒写`)
  let i = 0
  for (const line of before) {
    while (i < after.length && after[i] !== line) i++
    if (i >= after.length) throw new Error('目标某一行在结果里消失了 —— 不是纯插入,拒写')
    i++
  }
  return true
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push([name, fn])
  const HEAD = '### 第二十四批(2026-09-23):标题'
  const body = ['- 正文一', '- 正文二', '- 正文三']

  t('标题在、正文缺 3 行 → 插 3 行且原行一行不动', () => {
    const target = [HEAD, '- 别人的新段落', '## 下一节']
    const { out, inserted } = restoreBlock(target, [HEAD, ...body])
    assertPureInsertion(target, out, inserted)
    if (inserted !== 3) throw new Error(`inserted=${inserted}`)
    if (out.filter((l) => l === HEAD).length !== 1) throw new Error('标题被复制')
  })
  t('幂等:已存在的正文行不会被二次插入(反例=负向对照)', () => {
    const target = [HEAD, '- 正文一', '- 正文二', '- 正文三']
    const { out, inserted } = restoreBlock(target, [HEAD, ...body])
    if (inserted !== 0 || out.length !== target.length) throw new Error('发生了重复插入')
  })
  t('标题也没了 → 整块追加而不是丢弃', () => {
    const target = ['- 别人的新段落']
    const { out, inserted, appendedTitle } = restoreBlock(target, [HEAD, ...body])
    assertPureInsertion(target, out, inserted)
    if (!appendedTitle || inserted !== 4 || !out.includes(HEAD)) throw new Error('追加路径不成立')
  })
  t('extractBlock 在下一个二级标题处收口(不吞他人内容)', () => {
    const src = [HEAD, ...body, '', '### 第二十五批:别的会话的批次', '- 不该被带走']
    const blk = extractBlock(src, /^### 第二十四批/)
    if (blk.lines.length !== 4) throw new Error(`块长 ${blk.lines.length}`)
    if (blk.lines.some((l) => l.includes('不该被带走'))) throw new Error('越界吞了别人的块')
  })
  t('resolveBlock:同日撞号(两枚"第十九批")必须显式失败,不得静默取首枚', () => {
    const src = [
      '### 第十九批(2026-09-23):守门 71 补盲区',
      '- 甲批正文',
      '### 第十九批:守门 70 覆盖补齐三端(2026-09-24)',
      '- 乙批正文',
    ]
    const r = resolveBlock(src, '第十九批')
    if (r.ok || r.reason !== 'ambiguous' || r.hits.length !== 2)
      throw new Error(`应报 ambiguous/2,实为 ${JSON.stringify({ ok: r.ok, n: r.hits?.length })}`)
    const a = resolveBlock(src, '第十九批(2026-09-23)')
    if (!a.ok || a.block.lines[0] !== src[0]) throw new Error('更长前缀应能唯一化')
  })
  t('批次名里的 ( ) 必须按字面量匹配,不得被当成正则量词', () => {
    const src = ['### 第二十五批(2026-09-23):标题', '- 正文']
    const r = resolveBlock(src, '第二十五批(2026-09-23)')
    if (!r.ok) throw new Error(`元字符未转义:${r.reason}`)
    if (resolveBlock(src, '第二十五批(2099').ok) throw new Error('不存在的日期前缀却命中了')
  })
  t('assertPureInsertion 能识别"替换式改写"并非纯插入', () => {
    let threw = false
    try {
      assertPureInsertion(['- 旧措辞'], ['- 新措辞'], 1)
    } catch {
      threw = true
    }
    if (!threw) throw new Error('把删旧插新误判成了纯插入')
  })
  let fail = 0
  for (const [name, fn] of cases) {
    try {
      fn()
      console.log(`✅ ${name}`)
    } catch (e) {
      fail++
      console.log(`❌ ${name} — ${e.message}`)
    }
  }
  console.log(`\nself-test: ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const fromIdx = argv.indexOf('--from')
  const from = fromIdx >= 0 ? argv[fromIdx + 1] : 'HEAD'
  const check = argv.includes('--check')
  const batches = argv.filter((a, i) => !a.startsWith('--') && !(fromIdx >= 0 && i === fromIdx + 1))
  if (batches.length === 0) {
    console.error(
      '用法: node scripts/restore-plan-batch-block.mjs [--check] [--from <sha>] <第N批> [...]',
    )
    return 2
  }
  const root = resolveWorktree() || ROOT
  const srcLines = showAt(from, PLAN, root).split(/\r?\n/)
  const path_ = path.join(root, PLAN)
  let lines = readFileSync(path_, 'utf8').split(/\r?\n/)
  let total = 0
  let ambiguous = 0
  const report = []
  for (const b of batches) {
    const r = resolveBlock(srcLines, b)
    if (!r.ok && r.reason === 'notfound') {
      console.log(`⚠️ ${b}: ${from} 里找不到该批次标题,跳过`)
      continue
    }
    if (!r.ok) {
      ambiguous++
      console.log(
        `❌ ${b}: ${from} 里有 ${r.hits.length} 枚同号标题 —— 取首枚会回捞错批次,请改用能唯一化的前缀(带日期):`,
      )
      for (const h of r.hits) console.log(`   · ${h.line.slice(0, 76)}`)
      continue
    }
    const blk = r.block
    const { out, inserted, appendedTitle } = restoreBlock(lines, blk.lines)
    report.push(
      `${b}: 源块 ${blk.lines.filter((l) => l.trim()).length} 行 → 补回 ${inserted} 行${appendedTitle ? '(含标题追加)' : ''}`,
    )
    if (inserted) {
      assertPureInsertion(lines, out, inserted)
      lines = out
      total += inserted
    }
  }
  for (const r of report) console.log(r)
  if (check) {
    const why = [total ? `缺 ${total} 行` : '', ambiguous ? `${ambiguous} 个批次号撞号` : '']
      .filter(Boolean)
      .join(' + ')
    console.log(why ? `❌ --check:${why}(未写盘)` : '✅ --check:全部齐在')
    return why ? 1 : 0
  }
  if (ambiguous) console.log(`⚠️  ${ambiguous} 个批次号未处理(上方已点名),其余批次照常落盘`)
  if (!total) {
    console.log(
      ambiguous ? '⚠️ 本轮可写的批次无缺失,仅撞号批次待人工点名' : '✅ 无缺失,未改动目标文档',
    )
    return ambiguous ? 1 : 0
  }
  writeFileSync(path_, lines.join('\n'), 'utf8')
  const back = readFileSync(path_, 'utf8').split(/\r?\n/)
  if (back.length !== lines.length) {
    console.error('❌ 回读行数与写入不符(并发写入?),请重跑')
    return 1
  }
  console.log(`✅ 纯插入 ${total} 行到 ${PLAN}(工作区),回读行数一致`)
  return ambiguous ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = {
  extractBlock,
  extractBlockAt,
  headingMatches,
  resolveBlock,
  restoreBlock,
  assertPureInsertion,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
