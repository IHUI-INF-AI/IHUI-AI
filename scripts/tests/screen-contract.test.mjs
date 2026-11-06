// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * screen-contract.test.mjs —— 门 299 屏级契约四档的镜像测试。
 *
 * 只测纯函数,端到端(全量面)由 miniapp-shell-form.test.mjs T5 复用同一次门运行覆盖。
 * 每个判定档都配阴性对照:判据不得恒真,也不得对静态不可判的情况武断下结论。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  analyzeScreenContract,
  classifyPage,
  contractItemsOf,
  evaluateContractRatchet,
  mergeContractBaseline,
  validateContractBaseline,
  CONTRACT_BASELINE,
} from '../lib/miniapp-shell-form.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SPEC = 'packages/app/src/features/demo/DemoScreen.tsx'

const props = (r, bucket) => (r.buckets[bucket] ?? []).map((x) => x.prop).sort()

test('C1-C3 四档:单端 / 死契约 / 影子契约 各自命中且不串档', () => {
  const shared = `interface DemoScreenProps { title: string; flag: boolean; deadOne?: string; alive?: string }
export default function DemoScreen({ title, alive }: DemoScreenProps) {
  return <View><Text>{title}</Text><Text>{alive}</Text></View>
}`
  const page = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen title={title} />`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen title={'x'} flag={true} bogus={'z'} />`
  const r = analyzeScreenContract({ pageText: page, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(r.state, 'ok')
  assert.deepEqual(props(r, 'single-end'), ['flag'], 'bogus 未声明应先判影子,不得混入单端')
  assert.deepEqual(props(r, 'dead'), ['deadOne'])
  assert.deepEqual(props(r, 'shadow'), ['bogus'])
  assert.ok(!props(r, 'dead').includes('alive'), '阴性对照:屏内已消费的声明不得误报死契约')
})

test('C3 影子契约:只看最外层声明类别,对象类型里的回调不得误判 function', () => {
  const shared = `export default function DemoScreen({ trackFilter }: { trackFilter?: { items: string[]; onSelect: () => void } }) {
  return <View>{trackFilter ? 1 : 2}</View>
}`
  const page = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen />`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen trackFilter={{ items: [], onSelect: () => {} }} />`
  const r = analyzeScreenContract({ pageText: page, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(r.buckets.shadow.length, 0, '对象类型声明不得因文本里含 => 被误判为 function')
})

test('C3 影子契约:声明 boolean 却传函数 ⇒ 命中;声明语义 unknown ⇒ 不武断', () => {
  const pageForTyped = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen />`
  const pageForUnknown = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen onPress={() => {}} />`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen onPress={'oops'} />`
  const typed = analyzeScreenContract({
    pageText: pageForTyped,
    sharedText: 'export default function DemoScreen({ flag }: { flag: boolean }) { return <View>{flag ? 1 : 2}</View> }',
    rnText: `import { DemoScreen } from '@ihui/rn-app'\nexport const R = () => <DemoScreen flag={() => 1} />`,
    specs: [SPEC],
  })
  assert.deepEqual(props(typed, 'shadow'), ['flag'])
  const unknown = analyzeScreenContract({
    pageText: pageForUnknown,
    sharedText: 'export default function DemoScreen({ onPress }: { onPress: OnPress }) { return <View>{onPress ? 1 : 2}</View> }',
    rnText: rn,
    specs: [SPEC],
  })
  assert.equal(unknown.buckets.shadow.length, 0, '阴性对照:声明语义不可静态归类时不得报影子契约')
})

test('壳承载页模型修正:零 attrs 单壳页不作独立消费端;真传 prop / 额外渲染仍判 C1', () => {
  const shared = `interface DemoScreenProps { title: string; flag: boolean; deadOne?: string; alive?: string }
export default function DemoScreen({ title, alive }: DemoScreenProps) {
  return <View><Text>{title}</Text><Text>{alive}</Text></View>
}`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen title={'x'} flag={true} />
`
  const carrierPage = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <ThemeRoot><DemoScreen /></ThemeRoot>`
  const carrier = analyzeScreenContract({ pageText: carrierPage, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(carrier.carrier, true, '零 attrs + 仅宿主根 + 无页内取数 ⇒ 判为壳承载页')
  assert.deepEqual(props(carrier, 'single-end'), [], '承载页的「仅 RN 传」不得进 C1')
  assert.equal(carrier.carrierExempt, 2, '豁免计数必须可核对(title/flag 两条)')
  assert.deepEqual(props(carrier, 'dead'), ['deadOne'], '承载页内 RN 侧自身的死契约仍照常判')

  // 反证 1:页面真传 prop ⇒ 不是承载页,仍是 C1 消费端
  const propPage = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen title={'x'} />`
  const prop = analyzeScreenContract({ pageText: propPage, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(prop.carrier, false)
  assert.deepEqual(props(prop, 'single-end'), ['flag'], '真传 prop 的页不得因模型修正被误豁免')

  // 反证 2:零 attrs 但有额外渲染 ⇒ 不是纯承载页,保持原判
  const extraPage = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <AuthReadyGate><DemoScreen /></AuthReadyGate>`
  const extra = analyzeScreenContract({ pageText: extraPage, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(extra.carrier, false)
  assert.ok(extra.carrierReason?.startsWith('extra-jsx'))
  assert.deepEqual(props(extra, 'single-end'), ['flag', 'title'].sort())

  // 反证 3:页内自带取数 ⇒ 不是承载页
  const fetchPage = `import { DemoScreen } from '@rn-shells/DemoScreen'
import { fetchApi } from '@ihui/api-client'
export default () => { const d = fetchApi('/api/x'); return <DemoScreen /> }`
  const fetchRow = analyzeScreenContract({ pageText: fetchPage, sharedText: shared, rnText: rn, specs: [SPEC] })
  assert.equal(fetchRow.carrier, false, '页内取数的页是独立消费端,不得豁免')

  // 棘轮:旧基线残留的承载页单端条目不进 C5,其他页照常 C5
  const stale = [{ route: 'carrier-route', bucket: 'single-end', prop: 'p', why: 'w' }]
  const skipped = evaluateContractRatchet([], stale, { carrierRoutes: new Set(['carrier-route']) })
  assert.equal(skipped.advisories.length, 0)
  assert.equal(skipped.stats.carrierStaleExempt, 1)
  const notSkipped = evaluateContractRatchet([], stale, { carrierRoutes: new Set() })
  assert.equal(notSkipped.advisories.filter((a) => a.rule === 'C5').length, 1)
})

test('包装层扩模型(2026-11-07):可证明透传才豁免;cloneElement/context/页内钩子仍判 C1', () => {
  const shared = `interface DemoScreenProps { title: string; flag: boolean }
export default function DemoScreen({ title }: DemoScreenProps) { return <View>{title}</View> }`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen title={'x'} flag={true} />`
  const files = {
    'apps/miniapp-taro/src/components/DemoGate.tsx': `import type { ReactNode } from 'react'
export default function DemoGate({ children }: { children: ReactNode }) {
  return <>{children}</>
}`,
    'apps/miniapp-taro/src/components/PropGate.tsx': `import * as React from 'react'
export default function PropGate({ children }: { children?: React.ReactNode }) {
  return React.cloneElement(children as React.ReactElement, { title: 'injected' })
}`,
    'apps/miniapp-taro/src/pages/demo/wrapped.tsx': `import DemoGate from '@/components/DemoGate'
import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <ThemeRoot><DemoGate><DemoScreen /></DemoGate></ThemeRoot>`,
    'apps/miniapp-taro/src/pages/demo/prop.tsx': `import PropGate from '@/components/PropGate'
import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <ThemeRoot><PropGate><DemoScreen /></PropGate></ThemeRoot>`,
    'apps/miniapp-taro/src/pages/demo/taro.tsx': `import DemoGate from '@/components/DemoGate'
import { DemoScreen } from '@rn-shells/DemoScreen'
import { useDidShow } from '@tarojs/taro'
export default () => <ThemeRoot><DemoGate><DemoScreen /></DemoGate></ThemeRoot>`,
  }
  const readFile = (rel) => (Object.hasOwn(files, rel) ? files[rel] : null)
  const run = (page) =>
    analyzeScreenContract({
      pageText: files[`apps/miniapp-taro/src/pages/demo/${page}.tsx`],
      file: `apps/miniapp-taro/src/pages/demo/${page}.tsx`,
      sharedText: shared,
      rnText: rn,
      specs: [SPEC],
      readFile,
    })

  const wrapped = run('wrapped')
  assert.equal(wrapped.carrier, true, '只接 children + Fragment 透传 ⇒ 与零 attrs 壳页同属承载页')
  assert.equal(wrapped.carrierVia, 'wrapper')
  assert.deepEqual(props(wrapped, 'single-end'), [], '包装层承载页的「仅 RN 传」不得进 C1')
  assert.equal(wrapped.carrierExempt, 2)
  const w = wrapped.carrierEvidence.wrappers[0]
  assert.equal(w.file, 'apps/miniapp-taro/src/components/DemoGate.tsx')
  assert.equal(w.componentLine, 2)
  assert.equal(w.attrCount, 0, '使用处自身必须 0 attrs')
  assert.equal(w.proof.shellAttrsInjected, 0)

  const prop = run('prop')
  assert.equal(prop.carrier, false, '阴性对照:包装层 cloneElement 塞 prop ⇒ 不豁免')
  assert.deepEqual(props(prop, 'single-end'), ['flag', 'title'], '仍按 C1 报单端')

  const taro = run('taro')
  assert.equal(taro.carrier, false, '页内 import @tarojs/taro 运行时钩子 ⇒ 不是纯载体')
  assert.match(taro.carrierReason ?? '', /taro-hooks/)
  assert.deepEqual(props(taro, 'single-end'), ['flag', 'title'])
})

test('C4 未解析:读不到/类型解不开/属性展开/未渲染 都只进未解析', () => {
  const page = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen title={'x'} />`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen title={'x'} />`
  const shared = 'export default function DemoScreen({ title }: { title: string }) { return <View>{title}</View> }'
  assert.equal(analyzeScreenContract({ pageText: page, sharedText: null, rnText: rn, specs: [SPEC] }).reason, 'shared-unreadable')
  assert.equal(analyzeScreenContract({ pageText: page, sharedText: shared, rnText: null, specs: [SPEC] }).reason, 'rn-missing')
  assert.equal(
    analyzeScreenContract({ pageText: 'export default () => null', sharedText: shared, rnText: rn, specs: [SPEC] }).reason,
    'page-no-element',
  )
  const spread = analyzeScreenContract({
    pageText: `import { DemoScreen } from '@rn-shells/DemoScreen'\nexport default () => <DemoScreen {...all} />`,
    sharedText: shared,
    rnText: rn,
    specs: [SPEC],
  })
  assert.equal(spread.reason, 'spread', '属性展开时不得硬猜单端/死契约')
  const importType = analyzeScreenContract({
    pageText: page,
    sharedText: `import type { P } from '@ihui/types'\nexport default function DemoScreen(props: P) { return <View>{props.title}</View> }`,
    rnText: rn,
    specs: [SPEC],
  })
  assert.equal(importType.reason, 'props-type-unresolved', '无 readFile 时导入型 props 不得猜')
})

test('导入型 props:跟随 @ihui/types 的 export * 链解析,解到才判四档', () => {
  const files = {
    'packages/app/src/features/demo/DemoScreen.tsx': `import type { DemoProps } from '@ihui/types'
export default function DemoScreen(props: DemoProps) { return <View>{props.title}</View> }`,
    'packages/types/src/index.ts': `export * from './app'`,
    'packages/types/src/app.ts': `export interface DemoProps { title: string; onlyOne?: string; deadX?: string }`,
  }
  const readFile = (rel) => (Object.hasOwn(files, rel) ? files[rel] : null)
  const page = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default () => <DemoScreen title={title} onlyOne={'o'} />`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen title={title} />`
  const r = analyzeScreenContract({
    pageText: page,
    sharedText: files['packages/app/src/features/demo/DemoScreen.tsx'],
    rnText: rn,
    specs: [SPEC],
    readFile,
  })
  assert.equal(r.state, 'ok')
  assert.deepEqual(props(r, 'single-end'), ['onlyOne'])
  assert.deepEqual(props(r, 'dead'), ['deadX'])
  const broken = analyzeScreenContract({
    pageText: page,
    sharedText: files['packages/app/src/features/demo/DemoScreen.tsx'],
    rnText: rn,
    specs: [SPEC],
    readFile: () => null,
  })
  assert.equal(broken.reason, 'props-type-unresolved', '阴性对照:解析链断掉必须未解析')
})

test('拆提前 return:业务 JSX>2 / 未接入口的复制页也必须带完整契约证据', () => {
  const shared = `export default function DemoScreen({ renderX }: { renderX: () => void }) {
  return <View className="hero"><Text>Hi</Text></View>
}`
  const page = `import { DemoScreen } from '@rn-shells/DemoScreen'
export default function P() {
  return <View><View className="hero"><Text>Hi</Text></View><Text>a</Text><Text>b</Text><DemoScreen renderX={<View />} renderY={<Text />} /></View>
}`
  const rn = `import { DemoScreen } from '@ihui/rn-app'
export const R = () => <DemoScreen renderX={() => null} />`
  const row = classifyPage({
    route: 'demo/cut',
    file: 'demo/cut.tsx',
    text: page,
    declaredSpecs: [SPEC],
    analysisSpecs: [SPEC],
    sharedText: shared,
    rnText: rn,
  })
  assert.equal(row.impl, 'copy')
  assert.equal(row.duplicateUi, true, '旧实现在 JSX>2 处早退,此处会是 null')
  assert.deepEqual(row.singleEndProps, ['renderY'], '旧实现在 JSX>2 处早退,此处会是 null')
  assert.equal(row.contract.state, 'ok', '契约核对必须先于形态结论执行')
  const noEntry = classifyPage({
    route: 'demo/no-entry',
    file: 'demo/no-entry.tsx',
    text: `// 镜像 ${SPEC}\nexport default function P() { return <View><Text>x</Text></View> }`,
    declaredSpecs: [SPEC],
    sharedText: shared,
    rnText: rn,
  })
  assert.equal(noEntry.impl, 'copy')
  assert.equal(noEntry.contract.inScope, true, '未接入口的页面也必须跑契约核对,不得早退')
  assert.equal(noEntry.contract.reason, 'page-no-element')
})

test('回归棘轮:存量绿、新增红(C1-C4)、去条目只给 C5、非法基线 C0', () => {
  const baseline = [
    { route: 'r', bucket: 'single-end', prop: 'a', why: 'w' },
    { route: 'r', bucket: 'dead', prop: 'b', why: 'w' },
    { route: 'r', bucket: 'shadow', prop: 'c', why: 'w' },
    { route: 'r', bucket: 'unresolved', prop: 'spread', why: 'w' },
  ]
  const items = (b, p) => [{ route: 'r', bucket: b, prop: p, why: 'w' }]
  assert.equal(evaluateContractRatchet(baseline, baseline).reds.length, 0)
  assert.equal(evaluateContractRatchet(items('single-end', 'x'), baseline).reds[0].rule, 'C1')
  assert.equal(evaluateContractRatchet(items('dead', 'x'), baseline).reds[0].rule, 'C2')
  assert.equal(evaluateContractRatchet(items('shadow', 'x'), baseline).reds[0].rule, 'C3')
  assert.equal(evaluateContractRatchet(items('unresolved', 'x'), baseline).reds[0].rule, 'C4')
  const stale = evaluateContractRatchet([], baseline)
  assert.equal(stale.reds.length, 0)
  assert.ok(stale.advisories.every((a) => a.rule === 'C5'))
  const bad = evaluateContractRatchet([], [{ route: 'r', bucket: 'bogus', prop: 'p', why: 'w' }])
  assert.equal(bad.reds[0].rule, 'C0')
})

test('基线只许新增:已有条目逐字保留,只追加新命中;重复/缺字段必拒', () => {
  const existing = [{ route: 'r', bucket: 'dead', prop: 'old', why: '原文' }]
  const merged = mergeContractBaseline(existing, [
    { route: 'r', bucket: 'dead', prop: 'old', why: '想改写' },
    { route: 'r', bucket: 'dead', prop: 'fresh', why: '新增' },
  ])
  assert.equal(merged.kept, 1)
  assert.equal(merged.added, 1)
  assert.equal(merged.entries[0].why, '原文', '已有条目语义不得被改写凑绿')
  assert.equal(merged.entries.length, 2)
  assert.throws(() => mergeContractBaseline([{ route: 'r', bucket: 'dead', prop: 'x' }], []), /缺字段/)
  assert.throws(
    () => mergeContractBaseline([{ route: 'r', bucket: 'dead', prop: 'x', why: 'w' }, { route: 'r', bucket: 'dead', prop: 'x', why: 'w' }], []),
    /重复/,
  )
})

test('真实基线文件:形状合法、条目非空、四档都在枚举内', () => {
  const doc = JSON.parse(readFileSync(join(ROOT, CONTRACT_BASELINE), 'utf8'))
  assert.ok(Array.isArray(doc.entries) && doc.entries.length > 0, '基线不得为空(否则等于无基准)')
  assert.equal(validateContractBaseline(doc.entries).length, 0)
  const buckets = new Set(doc.entries.map((e) => e.bucket))
  assert.ok([...buckets].every((b) => ['single-end', 'dead', 'shadow', 'unresolved'].includes(b)))
  assert.match(doc.$comment ?? '', /只许新增/, '基线头注必须写明只许新增')
})

test('四档拍平:contractItemsOf 覆盖 ok 与未解析两种行', () => {
  const rows = [
    { route: 'a', contract: { inScope: true, state: 'ok', buckets: { 'single-end': [{ prop: 'p1', why: 'w' }], dead: [], shadow: [], unresolved: [] } } },
    { route: 'b', contract: { inScope: true, state: 'unresolved', buckets: { 'single-end': [], dead: [], shadow: [], unresolved: [{ prop: 'spread', why: 'w' }] } } },
    { route: 'c', contract: null },
  ]
  const items = contractItemsOf(rows)
  assert.deepEqual(items.map((i) => `${i.route}/${i.bucket}/${i.prop}`).sort(), ['a/single-end/p1', 'b/unresolved/spread'])
})
