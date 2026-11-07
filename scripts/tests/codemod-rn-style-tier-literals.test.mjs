// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * codemod-rn-style-tier-literals 的镜像测试(阳性对照 + 阴性对照)。
 *
 * 阳性对照:恰在档位的裸值必须被改成 token 引用,且**只改值**;
 * 阴性对照:表外值(B)、布局几何(C)、静态例外(D)、负值、胶囊圆角、注释与字符串里的同形文本
 *           必须一个都不动 —— 这正是"不许为了数量硬改"的机器化证明。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../codemod-rn-style-tier-literals.mjs'

const { transformText, tokenRef, maskCode, tiers } = __test__

/** 单文件改写便捷入口 */
function apply(src) {
  return transformText(src)
}

test('档表解析自真源:三表关键档位在册(防解析漂移)', () => {
  const t = tiers()
  assert.equal(t.spacing.get('sm'), 8)
  assert.equal(t.spacing.get('md'), 12)
  assert.equal(t.spacing.get('lg'), 16)
  assert.equal(t.spacing.get('none'), 0)
  assert.equal(t.spacing.get('2xs'), 2)
  assert.equal(t.spacing.get('md-loose'), 14)
  assert.equal(t.types.get('body').size, 14)
  assert.equal(t.types.get('body').lineHeight, 20)
  assert.equal(t.types.get('bodySm').size, 13)
  assert.equal(t.types.get('label').lineHeight, 16)
  assert.equal(t.types.get('caption').lineHeight, 16)
  assert.equal(t.radius.get('lg'), 8)
  assert.equal(t.radius.get('DEFAULT'), 8)
})

test('spacing 档内裸值 → rnSpacing 引用(点号/下标两种写法)', () => {
  const r = apply('const s = { padding: 8, marginLeft: 12, gap: 2 }')
  assert.equal(r.hits, 3)
  assert.equal(
    r.text,
    "const s = { padding: rnSpacing.sm, marginLeft: rnSpacing.md, gap: rnSpacing['2xs'] }",
  )
  assert.deepEqual(r.stats.byKind, { spacing: 3, fontSize: 0, lineHeight: 0, borderRadius: 0 })
})

test('fontSize / lineHeight 档内裸值 → rnType 引用;16 同值双档固定取 label', () => {
  const r = apply('const s = { fontSize: 14, lineHeight: 20 }')
  assert.equal(
    r.text,
    'const s = { fontSize: rnType.body.size, lineHeight: rnType.body.lineHeight }',
  )

  const ambiguous = apply('const s = { lineHeight: 16 }')
  assert.equal(ambiguous.text, 'const s = { lineHeight: rnType.label.lineHeight }')
  // 确定性:重复调用、输入相同必须同输出(不依赖遍历顺序/随机量)
  assert.equal(apply('const s = { lineHeight: 16 }').text, ambiguous.text)
})

test('borderRadius 档内裸值 → rnRadius 引用;8 双名固定取角色档 lg(不取 Tailwind 别名 DEFAULT)', () => {
  const r = apply('const s = { borderRadius: 8, borderTopLeftRadius: 12 }')
  assert.equal(r.text, 'const s = { borderRadius: rnRadius.lg, borderTopLeftRadius: rnRadius.xl }')
})

test('阴性对照:B 桶表外值一律不动', () => {
  const src =
    'const s = { padding: 5, paddingTop: 19, marginBottom: 33, fontSize: 17, lineHeight: 19 }'
  const r = apply(src)
  assert.equal(r.hits, 0)
  assert.equal(r.stats.B, 5)
  assert.equal(r.text, src)
})

test('阴性对照:C 桶布局几何一个都不碰(明确排除 width/height/inset 系)', () => {
  const src =
    'const s = { width: 16, height: 8, minWidth: 12, maxHeight: 20, size: 8, flexBasis: 16, top: 0, bottom: 0, left: 8, right: 12 }'
  const r = apply(src)
  assert.equal(r.hits, 0)
  assert.equal(r.stats.C, 10)
  assert.equal(r.text, src)
})

test('阴性对照:D 桶静态例外一个都不碰(borderWidth 发丝线 / letterSpacing)', () => {
  const src = 'const s = { borderWidth: 1, letterSpacing: 2, letterSpacing: 0 }'
  const r = apply(src)
  assert.equal(r.hits, 0)
  assert.equal(r.stats.D, 3)
  assert.equal(r.text, src)
})

test('阴性对照:负值与胶囊圆角(>=500 / 999 / 1000)不 token 化', () => {
  const src =
    'const s = { marginTop: -16, borderRadius: 999, borderRadius: 1000, borderTopLeftRadius: 500 }'
  const r = apply(src)
  assert.equal(r.hits, 0)
  assert.equal(r.stats.B, 1)
  assert.equal(r.stats.pill, 3)
  assert.equal(r.text, src)
})

test('阴性对照:注释与字符串/模板字面量里的同形文本不匹配(等长遮罩)', () => {
  const src = [
    '// padding: 8',
    '/* margin: 16, fontSize: 14 */',
    'const css = `margin: 0; padding: 12px;`',
    "const label = 'padding: 8'",
    "const pick = 'image/*', type = 'audio/*'",
  ].join('\n')
  const r = apply(src)
  assert.equal(r.hits, 0)
  assert.equal(r.text, src)
  // 遮罩等长:偏移与原文一一对应
  const masked = maskCode(src)
  assert.equal(masked.length, src.length)
  assert.equal(masked.split('\n').length, src.split('\n').length)
})

test('只改值不动结构:一行多处替换保留原有空格/逗号/缩进,不重排', () => {
  const r = apply('const s = {padding:8,marginLeft:12,lineHeight:16}')
  assert.equal(
    r.text,
    'const s = {padding:rnSpacing.sm,marginLeft:rnSpacing.md,lineHeight:rnType.label.lineHeight}',
  )
  const indent = apply('      padding:    16,')
  assert.equal(indent.text, '      padding:    rnSpacing.lg,')
})

test('小数与已 token 化的行不重复改写(幂等性单元级)', () => {
  const src = 'const s = { padding: 2.5, marginTop: rnSpacing.sm }'
  const r = apply(src)
  assert.equal(r.hits, 0)
})

test('幂等:同一文本改写两遍,第二遍 0 命中且字节不变', () => {
  const src = [
    'const s = {',
    '  paddingHorizontal: 12,',
    '  paddingTop: 16,',
    '  fontSize: 13,',
    '  lineHeight: 18,',
    '  borderRadius: 8,',
    '}',
  ].join('\n')
  const once = apply(src).text
  const twice = apply(once)
  assert.equal(twice.hits, 0)
  assert.equal(twice.text, once)
})

test('tokenRef:非法标识符档名走下标,且不产生多余转义', () => {
  assert.equal(tokenRef('rnSpacing', 'sm'), 'rnSpacing.sm')
  assert.equal(tokenRef('rnSpacing', '2xs'), "rnSpacing['2xs']")
  assert.equal(tokenRef('rnSpacing', 'xs-loose'), "rnSpacing['xs-loose']")
})

test('阴性对照:几何与例外键不得被 A 桶规则借道改写(混排场景)', () => {
  const src = 'const s = { padding: 8, width: 8, borderWidth: 8, borderRadius: 8 }'
  const r = apply(src)
  assert.equal(r.hits, 2)
  assert.equal(
    r.text,
    'const s = { padding: rnSpacing.sm, width: 8, borderWidth: 8, borderRadius: rnRadius.lg }',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
