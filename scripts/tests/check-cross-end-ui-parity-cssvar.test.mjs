// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:门 128 几何维的 **CSS 命名档腿** + **间距档键长**。
 *
 * 立因(两型同一个后果):
 *  ① 间距/字号「任意值落档」自动化把 web 与小程序的盒档从裸 px/rpx 改写成 CSS 变量
 *     (`var(--spacing-3xl)`),而几何维的提取式全按数字字面量取档 ⇒ 落档越干净、这一侧读数越空,
 *     门把"两端同一档"报成"仅另一端档 N"(2026-10-31 实测 CategoryBar 凭空 4 档假分叉、门当场翻红)。
 *  ② `specTiers` 解析 `SPACING_STEPS` 的键正则限长 6 字符,10-31 新补的半步档 `xs-loose`/`sm-loose`
 *     (8 字符)整档解不到 ⇒ RN 侧写 `rnSpacing['xs-loose']` 落进 unreadable,而小程序侧经 `buildEntries`
 *     的 CSS 名解得到同一档 ⇒ 反向造出"仅小程序档 6"。
 * 两条都是**尺子瞎**,不是两端长得不一样;按 §12e/§0.10,失效方向只能是"多要一次定向说明"
 * (unreadable 点名),绝不能是"给单端补数字把红抵掉"。
 *
 * 判据不复制(§22c):本测试 import 门体 `__test__` 直接用生产判据;档名→px 交
 * `sync-css-tokens.buildEntries`(与写 tokens.css 受管块**同一个生产者**),于是命名换算一漂就翻红,
 * 而不是在门的读数里静默变成假分叉。
 *
 * 用法:node scripts/tests/check-cross-end-ui-parity-cssvar.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

import { __test__ as P } from '../check-cross-end-ui-parity.mjs'
import { ELEVATION_REL, SPACING_REL, TYPOGRAPHY_REL } from '../sync-css-tokens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8')

/**
 * 真实档源 → CSS 档名 → px。走**门自己的** `cssTierPxFrom`(它内部再交 sync-css-tokens 的
 * `buildEntries`),本测试不另写一份过滤/换算 —— §22c:测试复制判据必然漂移。
 */
function realCssTiers() {
  return P.cssTierPxFrom({
    spacing: read(SPACING_REL),
    typography: read(TYPOGRAPHY_REL),
    elevation: read(ELEVATION_REL),
  })
}

const valset = (g) => [...g.values]
let n = 0
const t = (name, fn) => {
  n++
  fn()
  console.log(`  ✓ T${n} ${name}`)
}

console.log('[镜像] 门 128 几何维 · CSS 命名档腿 + 间距档键长')

t('阳性对照:CSS 变量写法按档表折成 px 进集合(与另一端裸数字判成同档)', () => {
  const map = realCssTiers()
  assert.ok(Object.keys(map).length > 10, `档表解析过少(${Object.keys(map).length} 条),枚举本身可能失效`)
  assert.equal(map['--spacing-3xl'], 32, '间距 3xl 应为 32')
  assert.equal(map['--spacing-xs-loose'], 6, '半步档 xs-loose 应为 6')
  const a = P.readGeometry('.x { height: var(--spacing-3xl); gap: var(--spacing-xs-loose); }', 'miniapp', map)
  const b = P.readGeometry('const s = { height: 32, gap: 6 }', 'rn', map)
  assert.deepEqual(P.diffValues(new Set(valset(a)), new Set(valset(b))), { onlyMiniapp: [], onlyRn: [] }, '同一档两种写法必须零分叉')
})

t('阴性对照:档表里没有这一档 ⇒ 逐枚进 unreadable,不得静默记成"没写档"(§0.3)', () => {
  const g = P.readGeometry('.x { height: var(--spacing-not-a-tier); }', 'miniapp', { '--spacing-md': 12 })
  assert.equal(valset(g).length, 0, `解不到的档不该进值集,实读 [${valset(g).join(',')}]`)
  assert.equal(g.unreadable.length, 1, `unreadable 应点名 1 枚,实得 ${g.unreadable.length}`)
  assert.match(g.unreadable[0].raw, /--spacing-not-a-tier/, '未判定必须带上档名')
})

t('串味防线一:行高/字重后缀不是几何档(与 NON_GEO_KEY 同口径,且不报未判定)', () => {
  const map = realCssTiers()
  const g = P.readGeometry(
    '.x { line-height: var(--text-badge--line-height); font-weight: var(--text-badge--font-weight); }',
    'miniapp',
    map,
  )
  assert.equal(valset(g).length, 0, `行高/字重不该进几何集,实读 [${valset(g).join(',')}]`)
  assert.equal(g.unreadable.length, 0, '不在本腿射程的后缀不该报未判定(否则噪声会盖住真缺口)')
})

t('串味防线二:圆角一律留给 RD 维 —— 并进几何即同一处双计', () => {
  const g = P.readGeometry('.x { border-radius: var(--radius-md); }', 'miniapp', {
    '--spacing-md': 12,
    '--radius-md': 6,
  })
  assert.equal(valset(g).length, 0, `--radius-* 不得进几何集,实读 [${valset(g).join(',')}]`)
  assert.equal(g.unreadable.length, 0, '不在本腿射程的写法不该报未判定')
})

t('字号档同一条腿:font-size 写 var(--text-badge) 与另一端写 10 判成同档', () => {
  const map = realCssTiers()
  assert.equal(map['--text-badge'], 10, 'badge 档应为 10(web 计数徽章模板既有值)')
  const a = P.readGeometry('.x { font-size: var(--text-badge); }', 'miniapp', map)
  const b = P.readGeometry('const s = { fontSize: 10 }', 'rn', map)
  assert.deepEqual(P.diffValues(new Set(valset(a)), new Set(valset(b))), { onlyMiniapp: [], onlyRn: [] }, '同档两写法必须零分叉')
})

t('0 值档:解得到但不进值集,也不报未判定(C4:0 进集合=造同值假账)', () => {
  const map = realCssTiers()
  assert.equal(map['--spacing-none'], 0, 'none 档应保留在表里(值 0)——由消费腿排除,不是"解不到"')
  const g = P.readGeometry('.x { gap: var(--spacing-none); }', 'miniapp', map)
  assert.ok(!valset(g).includes(0), '值集不得出现 0')
  assert.equal(g.unreadable.length, 0, '合法的 0 值档不该伪装成未判定')
})

t('键长回归:真实 spacing 表经 specTiers 解析,半步档 xs-loose/sm-loose 必须在表里', () => {
  const tiers = P.specTiers({ [SPACING_REL]: read(SPACING_REL) })
  assert.equal(tiers['rnSpacing.xs-loose'], 6, 'xs-loose 解不到 ⇒ RN 侧该档整族隐身')
  assert.equal(tiers['rnSpacing.sm-loose'], 10, 'sm-loose 解不到 ⇒ 同上')
  // 反向对照:限长复发时,这一枚必须落 unreadable 而不是静默丢值
  const g = P.readGeometry('const s = { gap: rnSpacing[\'xs-loose\'] }', 'rn', { 'rnSpacing.其他': 12 })
  assert.equal(g.unreadable.length, 1, '解不到的成员必须点名(限长复发的可见性凭据)')
})

t('真实配对件回归:RN 引用 rnSpacing[xs-loose] 时几何维读得到 6,且零未判定', () => {
  const tiers = { ...P.specTiers({ [SPACING_REL]: read(SPACING_REL) }), ...realCssTiers() }
  const rn = P.readGeometry(read('packages/app/src/components/category/CategoryInlineBar.tsx'), 'rn', tiers)
  const mp = P.readGeometry(
    [
      read('apps/miniapp-taro/src/components/CategoryBar.tsx'),
      read('apps/miniapp-taro/src/components/CategoryBar.css'),
    ].join('\n'),
    'miniapp',
    tiers,
  )
  assert.ok(valset(rn).includes(6), `RN 侧 6 档必须读得到,实读 [${valset(rn).join(',')}]`)
  assert.equal(rn.unreadable.length, 0, `RN 侧不该有解不到的成员:${JSON.stringify(rn.unreadable)}`)
  assert.deepEqual(
    P.diffValues(new Set(valset(mp)), new Set(valset(rn))),
    { onlyMiniapp: [], onlyRn: [] },
    '本票要消的假分叉:两端同一档不得报出任何一侧独有',
  )
})

t('覆盖面不缩:小程序组件里出现的每个 CSS 档名都能被档表解到', () => {
  const map = realCssTiers()
  const names = new Set()
  for (const rel of [
    'apps/miniapp-taro/src/components/CategoryBar.css',
    'apps/miniapp-taro/src/components/BusinessFormCard.css',
    'apps/miniapp-taro/src/components/ScreenStates.taro.css',
  ]) {
    for (const m of read(rel).matchAll(/\bvar\(\s*(--(?:spacing|text)-[a-z0-9-]+)\s*\)/g)) names.add(m[1])
  }
  const unsolved = [...names].filter((k) => map[k] === undefined && !/--(?:line-height|font-weight)$/.test(k))
  assert.deepEqual(unsolved, [], `这些 CSS 档名在仓里被引用却解不到:${unsolved.join(',')}`)
  assert.ok(names.size >= 4, `覆盖面读数过少(${names.size} 枚),枚举可能失效`)
})

console.log(`\n✅ 门 128 CSS 命名档腿镜像测试 ${n} 例全过`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
