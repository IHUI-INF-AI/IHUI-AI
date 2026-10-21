// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-plan-row-length.mjs` 的镜像测试(§22c:判据 import 源脚本的 `__test__`,本文件零复制)。
 * 除行为臂外钉一条形状锁:登记行的识别必须来自 `lib/plan-task-index.mjs`,
 * 门体不许自带"什么算一条登记行"的正则 —— 31 vs 59 那次事故就是两处各写一份漂出来的。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { __test__ as g } from '../check-plan-row-length.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LONG = `- [ ] G-901 ${'长'.repeat(500)}`
const SHORT = '- [ ] G-902 一句现状'
const DOC = `${SHORT}\n${LONG}\n- [x] G-903 ✅(2026-10-01) ${'叙述'.repeat(400)}\n`
const keys = (o) => o.over.map((x) => x.key)

test('行为:未勾长行计入,已勾长行不计,短行不违规', () => {
  const f = g.findOverLength(DOC, g.DEFAULT_MAX)
  assert.equal(f.counts.rows, 2, '已勾行不得进未勾射程')
  assert.equal(f.over.length, 1)
  assert.match(f.over[0].key, /^K:/, '有主键的行应按主键认身份')
})

test('棘轮:存量同主键一律只报数,新增主键才判红', () => {
  const f = g.findOverLength(DOC, g.DEFAULT_MAX)
  assert.equal(g.judge(f.over, keys(f), g.DEFAULT_MAX).state, 'ok', '存量被判红 ⇒ 造出恒红门(§12e)')
  assert.equal(g.judge([{ line: 3, len: 999, key: 'K:G-777' }], keys(f), g.DEFAULT_MAX).state, 'blocking', '新主键超阈必须拦得住')
})

test('未判定:锚点取不到既不记绿也不冒红(§0.3)', () => {
  const f = g.findOverLength(DOC, g.DEFAULT_MAX)
  const v = g.judge(f.over, null, g.DEFAULT_MAX)
  assert.equal(v.state, 'undetermined')
  assert.equal(v.fresh.length, 0, '未判定不得顺手产出判红集')
})

test('无主键的叙述式待办退化为整行文本身份,不许悄悄不认', () => {
  assert.match(g.violationKey(`- [ ] ${'叙述式待办'.repeat(90)}`), /^T:/)
})

test('面选择四臂:--staged 不得落回 head(第一版就是把 selectFace 调错参数,门自称 blocking 却永远只报数)', () => {
  assert.equal(g.pickFace(['--staged']).face, 'staged')
  assert.equal(g.pickFace([]).face, 'head')
  assert.equal(g.pickFace(['--worktree']).face, 'worktree')
  assert.equal(g.pickFace(['--staged', '--worktree']).face, null, '两面旗同给必须判死,不得选一个面')
})

test('形状锁:登记行识别来自单源,门体不自带正则', () => {
  const src = readFileSync(path.join(HERE, '..', 'check-plan-row-length.mjs'), 'utf8')
  assert.match(
    src,
    /import \{[^}]*parseTaskRows[^}]*keyOfRow[^}]*\} from '\.\/lib\/plan-task-index\.mjs'/,
    '门体未从单源 import parseTaskRows/keyOfRow',
  )
  assert.doesNotMatch(
    src,
    /^\s*const\s+\w*(ROW|TASK)_RE\s*=\s*\/.*\\\[ \\ \]/m,
    '门体内另立了一份"什么算登记行"的正则 —— 两处各写一份迟早漂成 31 vs 59',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
