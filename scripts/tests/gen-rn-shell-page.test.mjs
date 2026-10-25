// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 壳包装页生成器(`gen-rn-shell-page`)的镜像测试(§22c:import 源 __test__,零复制判据)。
 *
 * 这件器物的判据只有一条是新的:"这个 RN 壳能不能零参渲染"。写错的后果不是红门,
 * 而是生成一个**编译不过或渲染空白**的页面 —— 所以必须把导出形态与 props 判定钉死:
 *   T1 无参命名导出 ⇒ 可生成;
 *   T2 有必填 props ⇒ 拒绝并点名(让调用方去做定向适配,而不是静默生成空壳);
 *   T3 `props = {}` ⇒ 可零参(默认空对象就是允许不传);
 *   T4 页面/配置文本形制(命名 vs 默认导入、函数名去 Screen 后缀、标题进配置);
 *   T5 "他席在飞"判据:工作树多出 HEAD 没有的非空行 ⇒ 不许整文件回写配置;
 *   T6 单一真相源:路由插入必须 import 现成实现,不许在本器里复制一份。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { __test__ as G } from '../gen-rn-shell-page.mjs'

const SRC = readFileSync(resolve(import.meta.dirname, '..', 'gen-rn-shell-page.mjs'), 'utf8')

test('T1 无参命名导出 ⇒ 可生成', () => {
  const r = G.parseShellExport('export function ActivityScreen() { return null }')
  assert.equal(r.ok, true)
  assert.equal(r.name, 'ActivityScreen')
  assert.equal(r.exportKind, 'named')
})

test('T2 必填 props ⇒ 拒绝并点名', () => {
  const r = G.parseShellExport('export function XScreen({ t, items }: Props) { return null }')
  assert.equal(r.ok, false)
  assert.deepEqual(r.props, ['t', 'items'], '要点名缺哪些 props,方便做定向适配')
  assert.match(r.why, /必填 props/)
})

test('T3 props 默认空对象 ⇒ 可零参', () => {
  const r = G.parseShellExport('export function YScreen({ t = {} }: Props) { return null }')
  assert.equal(r.ok, true)
})

test('T3b 默认导出与不可解析', () => {
  assert.equal(G.parseShellExport('export default function Z() { return null }').exportKind, 'default')
  assert.equal(G.parseShellExport('const x = 1').ok, false)
})

test('T4 页面与配置形制', () => {
  const named = G.buildPageFiles({ screenName: 'MoreCourseScreen', route: 'pkg-learn/more-course', title: '更多课程', exportKind: 'named' })
  assert.match(named.page, /import \{ MoreCourseScreen as Shell \} from '@rn-shells\/MoreCourseScreen'/)
  assert.match(named.page, /export default function MoreCoursePage\(/)
  assert.match(named.page, /<ThemeRoot>[\s\S]*<Shell \/>[\s\S]*<\/ThemeRoot>/)
  assert.match(named.config, /navigationBarTitleText: "更多课程"/)
  const def = G.buildPageFiles({ screenName: 'HomeScreen', route: 'pages/x', title: 'X', exportKind: 'default' })
  assert.match(def.page, /import Shell from '@rn-shells\/HomeScreen'/)
})

test('T5 工作树多出 HEAD 没有的非空行 ⇒ 判分叉', () => {
  const L = (...xs) => xs.join('\n')
  assert.equal(G.worktreeDiverges(L('a', 'b'), L('a', 'b', 'c')), true)
  assert.equal(G.worktreeDiverges(L('a', 'b'), L('b', 'a')), false, '行序变化不是分叉')
  assert.equal(G.worktreeDiverges(L('a', 'b'), L('a', '', 'b')), false, '空行不算他席在飞')
})

test('T6 路由插入必须 import 现成实现(不许复制第二份)', () => {
  assert.match(SRC, /import \{ insertConfigPage \} from '\.\/gen-miniapp-mirror\.mjs'/)
  assert.equal(/function insertConfigPage\s*\(/.test(SRC), false, '本器不得自带第二份路由插入实现')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
