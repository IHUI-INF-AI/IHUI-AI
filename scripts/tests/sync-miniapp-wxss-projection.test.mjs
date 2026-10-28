// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * base.css → 小程序 app.css 受管段的"按目标端投影"这一格。
 *
 * 立因(2026-10-22 实测):微信开发者工具 Stable 2.02.2608080 对 `:where()` 报
 * 「编译 .wxss 文件错误」,整份样式编译失败 ⇒ 小程序开屏白屏。摘掉那一条后重新编译,首页立刻渲染。
 * 而 base.css 原件**不能改**(守门 W5 以它为真相源,且 `:where()` 的零特异性是 web 侧的有意设计),
 * 所以修法只能住在投影这一层 —— 判据也就要钉在投影层,而不是钉在源文件上。
 *
 * 判据一律 import 源脚本的 `__test__`(§22c:测试里不复制第二份判据)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as S } from '../sync-miniapp-tokens.mjs'
import { maskComments } from '../lib/design-token-blocks.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE_REL = 'packages/design-tokens/src/styles/base.css'
const baseCss = readFileSync(join(ROOT, BASE_REL), 'utf8')

/** app.css 的最小外壳:只放受管段的两枚标记(与 sync-miniapp-tokens.mjs 的 BASE_OPEN/BASE_CLOSE 同前缀)。 */
const shell = (body) =>
  `/* ===== 共享基础样式(自动同步自 ${BASE_REL},勿手动编辑)===== */\n${body}\n/* ===== 共享基础样式结束(自动生成,勿手动编辑)===== */\n`

/**
 * 取"投影后写进受管段的那一截"。
 * 注意别在返回值上再套 `slice(0, -0)` 之类的"看起来无害"的收尾 —— `-0` 会被当成 0,
 * 整段被切成空串,P1/P4 就会**空跑变绿**(本轮差点就这么交出去,是 P2/P3/P6 拦住的)。
 */
const project = (src) => {
  const merged = S.mergeAppCssBase(shell(''), src)
  const open = merged.indexOf('===== */') + '===== */'.length
  const close = merged.indexOf('/* ===== 共享基础样式结束')
  assert.ok(open > 8 && close > open, '夹具外壳标记没对上 ⇒ 本测试的输入面不成立')
  return merged.slice(open, close)
}

test('P1 真实 base.css 投影后,代码位不再有任何 :where(', () => {
  const out = project(baseCss)
  assert.ok(maskComments(baseCss).includes(':where('), '前提:源文件确实带 :where( 规则(否则本判据在射空靶)')
  assert.ok(!maskComments(out).includes(':where('), `投影后仍剩 :where( ⇒ wxss 仍会编译失败`)
})

test('P2 投影只拆包裹,不丢声明也不丢选择器', () => {
  const out = project(baseCss)
  const srcDecl = (maskComments(baseCss).match(/accent-color\s*:/g) ?? []).length
  const outDecl = (maskComments(out).match(/accent-color\s*:/g) ?? []).length
  assert.equal(outDecl, srcDecl, 'accent-color 声明条数必须一致')
  for (const sel of ["input[type='checkbox']", "input[type='radio']", "input[type='range']", 'progress']) {
    assert.ok(out.includes(sel), `选择器 ${sel} 被投影吃掉了`)
  }
})

test('P3 注释里的 `:where()` 是文档措辞,必须逐字留在原位', () => {
  // base.css 那段说明里出现 3 次 `:where()`(带反引号),它们不是规则 —— 改了就等于把设计理由改掉。
  const srcMentions = (baseCss.match(/`:where\(\)`/g) ?? []).length
  assert.ok(srcMentions >= 1, '前提:源注释里确实提到 `:where()`')
  assert.equal((project(baseCss).match(/`:where\(\)`/g) ?? []).length, srcMentions)
})

test('P4 幂等:对已投影的段再投影,逐字节不变', () => {
  const once = project(baseCss)
  const twice = project(once)
  assert.equal(twice, once)
})

test('P5 拆不动的形态必须拒绝写回,而不是把白屏交给下一次构建', () => {
  // `:where(:not(a))` 带嵌套括号,本投影按"选择器里不含括号"收口 ⇒ 拆不动 ⇒ 该喊响。
  assert.throws(
    () => project(":where(:not(a)) {\n  accent-color: var(--color-primary);\n}\n"),
    /拒绝写回/,
  )
})

test('P6 反向对照:声明值里的 :where( 不当规则处理,也不因此误伤整份写回', () => {
  // 前像不是 `^`/`}`/`;`/`*/` ⇒ 不是规则开头,不替换;但它也不会被遮注释判成漏网(它在注释里)。
  const src = `/* 说明::where() 由 weapp 编译器不认 */\na {\n  color: red;\n}\n`
  const out = project(src)
  assert.ok(out.includes('/* 说明::where() 由 weapp 编译器不认 */'), '注释原文必须逐字保留')
  assert.ok(out.includes('a {\n  color: red;\n}'), '块外内容一行不碰')
})

test('P7 排版不是漂移:已折行的等价段必须原样返回(prettier 与生成器打架的回归锁)', () => {
  // 2026-10-28 实测:生成器投影出**单行**选择器,prettier 把同一段折成四行 ⇒ 按字节比永远不等,
  // `--check` 恒红、每次自动写回都把文件改回单行 ⇒ 与格式门互相打架。判据必须按值,不按排版。
  const once = project(baseCss)
  const oneLine = "input[type='checkbox'], input[type='radio'], input[type='range'], progress {"
  assert.ok(once.includes(oneLine), '前提:生成器当前输的是单行形态(否则本判据在射空靶)')
  const folded = once.replace(
    oneLine,
    "input[type='checkbox'],\ninput[type='radio'],\ninput[type='range'],\nprogress {",
  )
  assert.notEqual(folded, once, '前提:夹具确实改成了折行形态')
  assert.equal(
    S.mergeAppCssBase(shell(folded), baseCss),
    shell(folded),
    '折行只是排版,内容等价 ⇒ 必须原样返回,一个字节都不许重写',
  )
})

test('P8 真改动仍必须写回(归一只放过排版,不得放过取值)', () => {
  // 反向锁的反向:把声明值真改掉,归一面必须判出差异并整段写回 —— 否则 P7 就成了"永远不写"的假绿。
  const once = project(baseCss)
  const tampered = once.replace('accent-color: var(--color-primary)', 'accent-color: #ff0000')
  assert.notEqual(tampered, once, '前提:夹具确实改了取值')
  const merged = S.mergeAppCssBase(shell(tampered), baseCss)
  assert.equal(normalize(merged), normalize(shell(once)), '取值不同 ⇒ 必须写回源的真值')
})

/** 只给 P8 做"写回结果为何等于源投影"的对齐,不参与判据(判据在 S.mergeAppCssBase 里)。 */
function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
