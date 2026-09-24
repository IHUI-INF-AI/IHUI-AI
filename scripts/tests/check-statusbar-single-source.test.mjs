// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「顶部状态栏避让单一源头」的 §22c 镜像测试。
 *
 * 与 --self-test 的分工:self-test 验**判据**;本文件验**接线**——
 * 判据存在而永不调用 = 没有(守门 70/76/81 的同型教训)。故这里全是"门是否真装上车"的断言。
 *
 * 另含两条"豁免面不得变成逃生舱"的源码级断言(M1 Modal / M2 行内 exempt 是本门最容易被
 * 改坏的两侧:放宽过头=门失效，收紧过头=假红逼人 --no-verify)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as gate } from '../check-statusbar-single-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')

test('源脚本必须 export __test__ 且含核心判据(§22c phase B)', () => {
  for (const k of [
    'scan',
    'stripComments',
    'findMagicPads',
    'collectExemptLines',
    'CURRENT_HEIGHT_RE',
    'SBAR_LAYOUT_USE_RE',
    'MODAL_RE',
    'MECHANISM_FILE',
  ]) {
    assert.ok(k in gate, `__test__ 缺 ${k}`)
  }
})

test('本门编号在 runner 中必须出现恰好一次(防撞号)', () => {
  const ids = [...RUNNER.matchAll(/^\s*id: '(\d+)',/gm)].map((m) => m[1])
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual([...new Set(dupes)], [], `runner 存在重复编号:${[...new Set(dupes)].join(',')}`)
  assert.equal(ids.filter((v) => v === '97').length, 1, 'id 97 必须恰好注册一次')
})

test('装车证明:runner 里必须真有 blocking + skipEnv + script(缺一即门未上车)', () => {
  const block = RUNNER.slice(RUNNER.indexOf("id: '97'"))
  const body = block.slice(0, block.indexOf("onFailHint:") + 400)
  assert.match(body, /script:\s*'check-statusbar-single-source\.mjs'/, 'script 未注册')
  assert.match(body, /mode:\s*'blocking'/, '未设为 blocking')
  assert.match(body, /skipEnv:\s*'HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE'/, '缺应急通道声明')
})

test('扫描面必须覆盖共享屏层与端内层，并把机制文件自身也罩住', () => {
  assert.deepEqual(gate.SCAN_DIRS, ['packages/app', 'apps/mobile-rn'])
  for (const d of gate.SCAN_DIRS) assert.ok(existsSync(join(ROOT, d)), `扫描面目录不存在:${d}`)
  // App.tsx 自己偷加顶距同样是第二源 —— 它必须落在扫描面里，而不是只被 S1 看一眼
  assert.ok(
    gate.SCAN_DIRS.some((d) => gate.MECHANISM_FILE.startsWith(`${d}/`)),
    '机制文件不在扫描面内:S1 之外它对 S2/S3 免疫',
  )
})

test('机制文件路径必须真的存在(路径漂移会让 S1 恒报"取不到")', () => {
  assert.equal(gate.MECHANISM_FILE, 'apps/mobile-rn/App.tsx')
  assert.ok(existsSync(join(ROOT, gate.MECHANISM_FILE)))
})

test('判据语义回归:48 计红 / insets.top 与 12 不计 / 块注释不判红', () => {
  assert.equal(gate.findMagicPads('  header: { paddingTop: 48, height: 44 },').length, 1)
  assert.equal(gate.findMagicPads('  header: { paddingTop: insets.top }').length, 0)
  assert.equal(gate.findMagicPads('  card: { paddingTop: 12 }').length, 0)
  assert.equal(gate.CURRENT_HEIGHT_RE.test(gate.stripComments('/* 说明 */ const h = StatusBar.currentHeight')), true)
  assert.equal(gate.CURRENT_HEIGHT_RE.test(gate.stripComments('/**\n * a\n   再加一次 StatusBar.currentHeight 会推歪 */')), false)
})

test('M1 豁免面不得外溢:只有真 JSX `<Modal` 才免检，注释里提一句不算', () => {
  assert.equal(gate.MODAL_RE.test('<Modal visible={v}>'), true)
  assert.equal(gate.MODAL_RE.test(gate.stripComments('// 借鉴 <Modal 的写法')), false, '注释成了逃生舱')
  assert.equal(gate.MODAL_RE.test("const doc = '<Modal'"), false, '字符串成了逃生舱')
})

test('M2 行内豁免必须带原因且逐行生效(整文件免检就是原来的洞)', () => {
  assert.equal(gate.collectExemptLines('a // statusbar-exempt:').size, 0)
  assert.equal(gate.collectExemptLines('a // statusbar-exempt: 与封面同高').size, 1)
  assert.equal(gate.collectExemptLines('a\nb // statusbar-exempt: 原因\nc').size, 1)
})

test('S2 只拦"布局取值"，共享层"调用方注入、默认 0"的 prop 声明不得判红', () => {
  const use = (s) => {
    gate.SBAR_LAYOUT_USE_RE.lastIndex = 0
    return [...s.matchAll(gate.SBAR_LAYOUT_USE_RE)].length
  }
  assert.ok(use('paddingTop: statusBarHeight,'), '布局取值漏判')
  assert.ok(use('top: statusBarHeight + 8'), '算术形态漏判')
  assert.equal(use('statusBarHeight?: number'), 0, '类型字段被判红=共享层假红')
  assert.equal(use('  statusBarHeight = 0,'), 0, '解构默认值被判红=共享层假红')
})

test('CLI 必须认 --all(被无声忽略=我以为跑了全量而实际没有)', () => {
  const src = readFileSync(join(ROOT, 'scripts/check-statusbar-single-source.mjs'), 'utf8')
  assert.match(src, /argv\.includes\('--all'\)/)
  assert.match(src, /--staged'\)\s*\?\s*'index'\s*:\s*'head'/, '取材面切换不在 main 里 = 口径可能旁路')
})

test('AGENTS.md 与 README 必须点名本门(守门 89 R4:判据在而文档不点名即拦)', () => {
  for (const doc of ['AGENTS.md', 'README.md']) {
    const text = readFileSync(join(ROOT, doc), 'utf8')
    assert.ok(
      /check-statusbar-single-source/.test(text),
      `${doc} 未登记本门 —— R4 会判红,且后人无从知道顶距该往哪写`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
