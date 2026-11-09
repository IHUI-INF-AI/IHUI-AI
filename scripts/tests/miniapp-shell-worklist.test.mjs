// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生成式薄壳工作表与写盘台账的单测(2026-11-07)。
 *
 * 钉三件事,不允许用「看起来对」放过:
 *   1. 开标签数:薄壳极值 2(`<ThemeRoot><Shell/></ThemeRoot>`);嵌套回调里的 JSX 不计;
 *      非组件文件 ⇒ 0,且调用方必须同时判「不可判定」,不得把 0 当薄壳(本测只钉计数口径)。
 *   2. 工作表:可生成页必须给出可直接执行的命令;每条 blocked 必须带 ≥1 条 missing,
 *      且顺序确定(同输入逐字一致)——不允许静默跳过。
 *   3. 写盘台账(单源):dry-run 报的行数/sha256 与真落盘文件逐字一致;水印注入幂等
 *      (对已注入内容再注入 ⇒ skip-done,字节不变)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildWorklist,
  buildWriteAccount,
  countOpenTags,
  formatWorklistMarkdown,
} from '../lib/miniapp-shell-worklist.mjs'
import { injectText } from '../watermark.mjs'
import { buildShellPage } from '../gen-miniapp-mirror.mjs'

const SHELL_PAGE = `import { ThemeRoot } from '@/rn-compat/theme'
import { SharedScreen } from '@rn-shells/distribution-commission'

export default function Page() {
  return (
    <ThemeRoot>
      <SharedScreen />
    </ThemeRoot>
  )
}
`

const RICH_PAGE = `export default function Page() {
  const renderRow = (x) => <View><Text>{x}</Text></View>
  return (
    <ThemeRoot>
      <NavBar />
      <View><Text>a</Text></View>
      <View><Text>b</Text></View>
    </ThemeRoot>
  )
}
`

test('开标签数:薄壳极值 2,嵌套回调 JSX 不计,非组件为 0', () => {
  assert.equal(countOpenTags(SHELL_PAGE), 2)
  // ThemeRoot + NavBar + View + Text + View + Text = 6;
  // renderRow 里的 View/Text 属于嵌套函数,不计(否则会是 8)。
  assert.equal(countOpenTags(RICH_PAGE), 6)
  const onlyNested = `export default function Page() {
  const rows = [1].map((x) => <View><Text>{x}</Text></View>)
  return null
}
`
  assert.equal(countOpenTags(onlyNested), 0)
  assert.equal(countOpenTags('const x = 1\n'), 0)
  assert.equal(countOpenTags(''), 0)
})

const ledgerRows = [
  { route: 'pages/a/index', file: 'apps/miniapp-taro/src/pages/a/index.tsx', loc: 383 },
  { route: 'pages/b/index', file: 'apps/miniapp-taro/src/pages/b/index.tsx', loc: 28 },
]
const classifiedRows = [
  {
    route: 'pages/a/index',
    file: 'apps/miniapp-taro/src/pages/a/index.tsx',
    impl: 'copy',
    shellEntry: false,
    businessJsx: 48,
    duplicateUi: false,
    singleEndProps: [],
    reasonClass: 'local-delta',
    mapStatus: 'declared',
    note: '',
  },
  {
    route: 'pages/b/index',
    file: 'apps/miniapp-taro/src/pages/b/index.tsx',
    impl: 'shell',
    shellEntry: true,
    businessJsx: 0,
    duplicateUi: false,
    singleEndProps: [],
    mapStatus: 'declared',
    note: '',
  },
]
const plannerRows = [
  {
    route: 'pages/a/index',
    kind: 'page-only-capability',
    why: '带着壳没有的能力:@/api, Taro.navigateTo',
  },
]

test('工作表:shell 页 done、copy 页 blocked 且逐条写缺什么、顺序确定', () => {
  const pageTexts = new Map([
    ['pages/a/index', RICH_PAGE],
    ['pages/b/index', SHELL_PAGE],
  ])
  const args = {
    ledgerRows,
    classifiedRows,
    plannerRows,
    ledgerPhysicalCount: 2,
    ledgerRetiredCount: 0,
    pageTexts,
    face: 'head',
  }
  const w1 = buildWorklist(args)
  const w2 = buildWorklist(args)
  assert.deepEqual(w1, w2)
  assert.deepEqual(
    w1.items.map((x) => x.route),
    ['pages/a/index', 'pages/b/index'],
  )
  const a = w1.items[0]
  assert.equal(a.status, 'blocked')
  assert.equal(a.loc, RICH_PAGE.split('\n').length)
  assert.equal(a.openTags, 6)
  assert.ok(a.missing.length >= 1, 'blocked 页必须至少一条 missing,禁止静默跳过')
  assert.ok(a.missing.some((m) => /规划阻塞\(页面独有能力\)/.test(m)))
  assert.ok(a.missing.some((m) => /业务 JSX 48 > 2/.test(m)))
  assert.ok(a.missing.some((m) => /未接共享壳入口/.test(m)))
  const b = w1.items[1]
  assert.equal(b.status, 'done')
  assert.equal(b.shell, true)
  assert.deepEqual(b.missing, [])
  assert.equal(w1.stats.done, 1)
  assert.equal(w1.stats.blocked, 1)
  // Markdown 逐字确定
  assert.equal(formatWorklistMarkdown(w1), formatWorklistMarkdown(w2))
})

test('工作表:可生成页给出可复制命令;拒落原因必须变成 blocked', () => {
  const base = {
    ledgerRows: [{ route: 'pages/c/index', file: 'apps/miniapp-taro/src/pages/c/index.tsx', loc: 200 }],
    classifiedRows: [
      {
        route: 'pages/c/index',
        file: 'apps/miniapp-taro/src/pages/c/index.tsx',
        impl: 'copy',
        shellEntry: true,
        businessJsx: 2,
        duplicateUi: false,
        singleEndProps: [],
        mapStatus: 'declared',
        note: '',
      },
    ],
    plannerRows: [{ route: 'pages/c/index', kind: 'convertible', shell: 'X' }],
    ledgerPhysicalCount: 1,
    ledgerRetiredCount: 0,
    pageTexts: new Map([['pages/c/index', RICH_PAGE]]),
  }
  const ready = buildWorklist(base)
  assert.equal(ready.items[0].status, 'ready')
  assert.match(ready.items[0].nextAction, /--generate --route=pages\/c\/index/)
  assert.equal(ready.items[0].blockedReason, null)

  const held = buildWorklist({ ...base, refusedReasons: new Map([['pages/c/index', '工作树脏 ⇒ held']]) })
  assert.equal(held.items[0].status, 'blocked')
  assert.equal(held.items[0].blockedReason, '工作树脏 ⇒ held')
  assert.ok(held.items[0].missing.length >= 1)
})

test('写盘台账:dry-run 预测 == 真落盘字节;水印注入幂等', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-worklist-'))
  try {
    const rel = 'apps/miniapp-taro/src/pages/demo/index.tsx'
    const before = RICH_PAGE
    const body = SHELL_PAGE // 生成器产出的壳正文
    const first = injectText(body, { rel })
    assert.equal(first.action, 'injected')
    const acc1 = buildWriteAccount({ pageRel: rel, beforeText: before, finalText: first.text })
    const acc2 = buildWriteAccount({ pageRel: rel, beforeText: before, finalText: injectText(body, { rel }).text })
    assert.deepEqual(acc1, acc2, '同一输入两次 dry-run 必须逐字一致')

    const out = join(dir, 'index.tsx')
    writeFileSync(out, first.text, 'utf8')
    const disk = readFileSync(out, 'utf8')
    assert.equal(disk, first.text)
    const diskAcc = buildWriteAccount({ pageRel: rel, beforeText: before, finalText: disk })
    assert.equal(diskAcc.sha256, acc1.sha256, 'dry-run 报的 sha256 必须等于盘上实测')
    assert.equal(diskAcc.afterLines, acc1.afterLines)

    // 对已注入内容再注入 ⇒ skip-done,字节不变(幂等)
    const again = injectText(disk, { rel })
    assert.equal(again.action, 'skip-done')
    assert.equal(again.text, disk)
    writeFileSync(out, again.text, 'utf8')
    assert.equal(readFileSync(out, 'utf8'), disk)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('生成器→水印→写盘:产出 2 开标签,两次逐字一致', () => {
  const shellText = `import DemoScreen from '@ihui/rn-app/features/demo/DemoScreen'
export default function DemoShell() {
  return <DemoScreen />
}
`
  const body = buildShellPage({
    spec: '@ihui/rn-app/features/demo/DemoScreen',
    base: 'Demo',
    shellName: 'DemoShell',
    shellText,
    sharedText: '',
    navTitle: null,
  })
  assert.equal(typeof body, 'string')
  assert.equal(countOpenTags(body), 2, '生成的壳页必须落到薄壳极值 2 个开标签')
  const rel = 'apps/miniapp-taro/src/pages/demo/index.tsx'
  const a = injectText(body, { rel })
  const b = injectText(body, { rel })
  assert.equal(a.action, 'injected')
  assert.equal(a.text, b.text, '同一生成输入两次水印必须逐字一致')
  const acc1 = buildWriteAccount({ pageRel: rel, beforeText: '', finalText: a.text })
  const acc2 = buildWriteAccount({ pageRel: rel, beforeText: '', finalText: b.text })
  assert.deepEqual(acc1, acc2)
  assert.equal(acc1.op, 'create')
  assert.equal(acc1.beforeLines, 0, '新建文件的前行数必须是 0')
  assert.ok(acc1.afterLines > 2)
})

test('工作表:台账外新增复制页不得静默消失', () => {
  const w = buildWorklist({
    ledgerRows: [],
    classifiedRows: [
      {
        route: 'pages/new/index',
        file: 'apps/miniapp-taro/src/pages/new/index.tsx',
        impl: 'copy',
        shellEntry: false,
        businessJsx: 10,
        duplicateUi: false,
        singleEndProps: [],
        mapStatus: 'declared',
        note: '',
      },
    ],
    plannerRows: [],
    pageTexts: new Map([['pages/new/index', RICH_PAGE]]),
  })
  assert.equal(w.items.length, 1)
  assert.equal(w.items[0].inLedger, false)
  assert.equal(w.items[0].status, 'blocked')
  assert.ok(w.items[0].missing.some((m) => /规划器未覆盖/.test(m)))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
