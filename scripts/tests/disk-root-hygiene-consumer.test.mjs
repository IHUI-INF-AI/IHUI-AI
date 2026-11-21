// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 接线锁:第 83 项(2026-11-21)—— 盘根卫生"判红"这一格不得自身抛异常,且尺子产出的每个
// 违规 kind 必须在消费侧有专属措辞(否则信文把真问题喊成"请核对尺子是否同代")。
// 判据不复制任何阈值:全部按源码面逐字读,两侧同源比对。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const G = join(ROOT, 'scripts', 'git-guardian.mjs')
const GATE = join(ROOT, 'scripts', 'check-disk-root-hygiene.mjs')

/** 取出盘根卫生消费侧那一段(从 counts 解构到 catch 兜底行),判据只看这一面。 */
function consumerBlock() {
  const src = readFileSync(G, 'utf8')
  const from = src.indexOf('const c = parsed.counts || {}')
  // 终点用 catch 兜底那行的**日志前缀**(注释里提到同一句话不算,必须认带 ⚠️ 的那一行)
  const to = src.indexOf('⚠️ 盘根卫生自身异常', from)
  assert.ok(from > 0 && to > from, '盘根卫生消费侧的 counts 解构与 catch 兜底必须都在位')
  return { src, block: src.slice(from, to) }
}

// 模块级标识符:不在这段里声明、但确实住在 git-guardian 顶层(改名前必须同步改这里)。
const MODULE_LEVEL = new Set([
  'parsed',
  'c',
  'WORKTREE',
  'join',
  'log',
  'notifyGuardRed',
  'alertCountTier',
  'alertHeldTier',
  'noteUndeterminedStreak',
  'String',
  'Number',
  'JSON',
  'Math',
  'Array',
  'Object',
  'Boolean',
])

test('① 消费侧引用的每个 ${标识符} 都必须在该段内声明(第 83 项:cuN 曾是悬空的)', () => {
  const { block } = consumerBlock()
  const declared = new Set(
    [...block.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  )
  const refs = new Set([...block.matchAll(/\$\{([A-Za-z_$][\w$]*)\}/g)].map((m) => m[1]))
  const dangling = [...refs].filter((n) => !declared.has(n) && !MODULE_LEVEL.has(n))
  assert.deepEqual(dangling, [], `这段里悬空引用会在判红那一刻抛 ReferenceError:${dangling.join('、')}`)
})

test('② 四维未判定必须逐维报名,申报内容维不得缺位', () => {
  const { src } = consumerBlock()
  assert.match(
    src,
    /盘根维 \$\{uN\}、申报内容维 \$\{cuN\}、worktree 维 \$\{wN\};不适用盘根 \$\{nN\}/,
    '未判定必须四维各自量出来(旧写法只印盘根/worktree 两维,内容维缺位与"已判干净"同形)',
  )
  assert.match(
    src,
    /const cuN = Number\(c\.declaredContentUndetermined\)/,
    'cuN 的取数面必须与尺子 counts 字段逐字同名',
  )
})

test('③ 尺子产出的每个违规 kind 在消费侧都有专属措辞(不得落"未识别类别"兜底)', () => {
  const kinds = new Set(
    [...readFileSync(GATE, 'utf8').matchAll(/kind:\s*'([a-z0-9-]+)'/g)]
      .map((m) => m[1])
      .filter((k) => k !== 'undetermined'),
  )
  assert.ok(kinds.size >= 4, `尺子的违规 kind 至少要枚举到 4 型(现读 ${kinds.size})`)
  const { src } = consumerBlock()
  const missing = [...kinds].filter(
    (k) => !new RegExp(`'${k}':\\s*(?:\\()?[\\s\\S]{0,40}`).test(src),
  )
  assert.deepEqual(missing, [], `这些 kind 落到"未识别类别"兜底,整改方向被误导:${missing.join('、')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
