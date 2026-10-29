// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-web-portal-label-keys.mjs 的镜像测试(§22c:判据 import 源脚本 __test__,零复算)。
//
// 立因:门户表引用的 titleKey 若在十份词包(两端×五语言)任一份缺失,端上按约定回落中文 fallbackLabel
// —— 界面不报错只是变成中文,是一类永远不会自己叫的失效。本文件钉两件事:① 缺一份就判红并逐份点名;
// ② 取不到面/解不开 JSON 时落未判定,绝不冒充绿。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { __test__ as G } from '../check-web-portal-label-keys.mjs'

const TABLE = `titleKey: 'webViewPortal.sections.more',\n  titleKey: 'webViewPortal.demo',\n`
const FULL = '{"webViewPortal":{"demo":"x","sections":{"more":"y"}}}'
const NO_DEMO = '{"webViewPortal":{"sections":{"more":"y"}}}'
const mk = (body) => Object.fromEntries(G.PACKS.map((p) => [p, body]))

test('M1 阳性对照:十份词包任一份缺该键 ⇒ 判红且逐份点名', () => {
  const r = G.judge(TABLE, mk(NO_DEMO))
  assert.equal(r.state, 'red')
  assert.equal(r.missing.length, G.PACKS.length)
  assert.ok(r.missing.every((m) => m.key === 'webViewPortal.demo'))
})

test('M2 十份齐 ⇒ 绿,且键数如实报出', () => {
  const r = G.judge(TABLE, mk(FULL))
  assert.equal(r.state, 'green')
  assert.equal(r.keys, 2)
})

test('M3 分组标题键也在射程(只查条目会把整段标题的缺失放过去)', () => {
  assert.ok(G.titleKeysOf(TABLE).includes('webViewPortal.sections.more'))
  const onlySectionMissing = '{"webViewPortal":{"demo":"x","sections":{}}}'
  assert.equal(G.judge(TABLE, mk(onlySectionMissing)).state, 'red')
})

test('M4 任一份取不到就落未判定(不回落另一个面,也不记绿)', () => {
  assert.equal(G.judge(TABLE, { ...mk(FULL), [G.PACKS[3]]: null }).state, 'undetermined')
})

test('M5 坏 JSON ⇒ 未判定,不猜', () => {
  assert.equal(G.judge(TABLE, { ...mk(FULL), [G.PACKS[5]]: '{' }).state, 'undetermined')
})

test('M6 空表 ⇒ 未判定(枚举到 0 个候选判死,不读成零缺口)', () => {
  assert.equal(G.judge('', mk(FULL)).state, 'undetermined')
})

test('M7 孤儿标签只报数不判红,且门户页自身 chrome(title/hint)不算孤儿', () => {
  const body =
    '{"webViewPortal":{"title":"t","hint":"h","demo":"x","orphanOne":"z","sections":{"more":"y"}}}'
  const r = G.judge(TABLE, mk(body))
  assert.equal(r.state, 'green')
  assert.equal(r.orphan, 1, '只应剩 orphanOne;title/hint 是页面 chrome')
  assert.deepEqual(r.orphanKeys, ['webViewPortal.orphanOne'])
})

test('M8 词包清单 = 两端 × 五语言,十份且不重复', () => {
  assert.equal(G.PACKS.length, 10)
  assert.equal(new Set(G.PACKS).size, 10)
  for (const t of ['mobile-rn', 'miniapp-taro'])
    for (const l of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'])
      assert.ok(G.PACKS.includes(`packages/i18n/messages/${t}/${l}.json`), `${t}/${l} 不在清单`)
})

test('M10 W3 阳性对照:门户条目指向不存在的 web 路由 ⇒ 逐条点名(用户点开就是 404)', () => {
  const table = `path: '/rules',\n  path: '/gone-page'`
  assert.deepEqual(
    G.phantomPortalPaths(table, (p) => p === '/rules'),
    ['/gone-page'],
  )
})

test('M11 W3 反向对照:全部存在 ⇒ 空集(不制造假红)', () => {
  assert.deepEqual(
    G.phantomPortalPaths(`path: '/rules'`, () => true),
    [],
  )
  assert.deepEqual(G.staticPathsOf(`path: '/a'\npath: '/a'\npath: '/b'`), ['/a', '/b'])
})

test('M9 装车形状:§22d 直执行守卫在位、判据只在源脚本一份(import 本文件不得触发主流程)', () => {
  const src = readFileSync(new URL('../check-web-portal-label-keys.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /const isDirectRun = process\.argv\[1\]/,
    '无 isDirectRun 守卫 ⇒ 测试 import 即跑主流程',
  )
  assert.match(src, /if \(isDirectRun\)/, '守卫存在但没被执行路径引用 = 摆设')
  assert.match(src, /export const __test__ = /, '未导出 __test__ ⇒ 镜像只能复算判据(§22c)')
  // 面读取与键扁平化必须来自既有出口(§0.6 单一真相源),不许在本门再抄一份
  assert.match(src, /import \{ __test__ as X \} from '\.\/add-web-portal-entries\.mjs'/)
  assert.match(src, /import \{ __test__ as cov \} from '\.\/check-cross-end-screen-coverage\.mjs'/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
