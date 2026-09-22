// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as src } from '../check-declared-shortcuts.mjs'

const {
  normalizeChord,
  parseHandlers,
  matchHandler,
  modFactsFrom,
  reconcile,
  collectDeclarations,
  eventHasConsumer,
  FIXTURE,
  FIX_FILE,
} = src

const decl = (raw, kind = 'field', extra = {}) => ({ ...normalizeChord(raw), kind, file: 'fixture', ...extra })
const handlers = () => parseHandlers(FIX_FILE, FIXTURE)

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  for (const key of ['normalizeChord', 'parseHandlers', 'matchHandler', 'reconcile', 'collectDeclarations', 'eventHasConsumer', 'runSelfTest']) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

test('normalizeChord:Ctrl/Cmd/Mod 归一到同一 mod 槽位', () => {
  assert.equal(normalizeChord('Ctrl+Shift+P').canonical, 'mod+shift+p')
  assert.equal(normalizeChord('Cmd+Shift+P').canonical, normalizeChord('Ctrl+Shift+P').canonical)
  assert.equal(normalizeChord('Ctrl+Alt+D').canonical, 'mod+alt+d')
  assert.deepEqual(normalizeChord('Ctrl+Shift+P').required, ['mod', 'shift'])
})

test('normalizeChord:未知修饰键与空键位一律拒绝', () => {
  assert.equal(normalizeChord('Ctrl+Hyper+P'), null)
  assert.equal(normalizeChord('Ctrl++'), null)
})

test('modFactsFrom:普通条件与早退守卫的极性相反', () => {
  // if (ctrl && !shift) → ctrl 要求按下、shift 要求不按下
  assert.deepEqual(modFactsFrom('ctrl && !shift', false), { mod: '1', shift: '0', alt: null })
  // if (!isMod) return → 越过守卫意味着 mod 已按下(取反)
  assert.deepEqual(modFactsFrom('!isMod', true), { mod: '1', shift: null, alt: null })
  // !e.ctrlKey 形式:否定号与属性名之间隔着接收者也必须识别
  assert.deepEqual(modFactsFrom('!e.ctrlKey && !e.metaKey', true), { mod: '1', shift: null, alt: null })
  // 同槽位既要求又否定 → 不可判定(X)
  assert.equal(modFactsFrom('ctrl && !ctrl', false).mod, 'X')
})

test('parseHandlers:三来源(mod 断言)合成 — 条件内 / 外层块 / 早退守卫', () => {
  const hs = handlers()
  assert.equal(hs.length, 5, `夹具应有 5 个按键处理器,实得 ${hs.length}`)
  const u = hs.find((h) => h.key === 'u')
  assert.deepEqual([...u.required].sort(), ['mod', 'shift'])
  assert.equal(u.determined, false, 'alt 槽位未断言 → 非完全确定')
  const q = hs.find((h) => h.key === 'q')
  assert.deepEqual([...q.required], ['mod'])
  assert.deepEqual([...q.forbidden].sort(), ['alt', 'shift'])
  assert.equal(q.determined, true)
  const f11 = hs.find((h) => h.key === 'f11')
  assert.deepEqual([...f11.forbidden].sort(), ['alt', 'mod', 'shift'], '裸功能键的三个槽位都应被否定')
})

test('matchHandler:严格 / 宽松 / 矛盾 三态判定', () => {
  const hs = handlers()
  const u = hs.find((h) => h.key === 'u')
  const q = hs.find((h) => h.key === 'q')
  assert.equal(matchHandler(decl('Ctrl+Shift+U'), u), '宽松', 'alt 未断言 → 宽松')
  assert.equal(matchHandler(decl('Ctrl+Q'), q), '严格')
  assert.equal(matchHandler(decl('Ctrl+Shift+Q'), q), '矛盾', '处理器 !shift 与声明冲突')
  assert.equal(matchHandler(decl('Ctrl+U'), u), '矛盾', '处理器要求 Shift,声明没带')
  assert.equal(matchHandler(decl('Ctrl+Shift+U'), hs.find((h) => h.key === 'r')), null, '不同 key 不参与判定')
})

test('reconcile:正例四态齐全', () => {
  const hs = handlers()
  const ok = reconcile([decl('Ctrl+Shift+U')], hs, '{}')
  assert.equal(ok.bound.length, 1)
  assert.equal(ok.bound[0].mode, '宽松')

  const reg = reconcile([decl('Ctrl+Alt+D', 'registry', { event: 'global-shortcut:x' })], hs, "on('global-shortcut:x')")
  assert.equal(reg.bound.length, 1, '注册表条目由 matchShortcut 泛化匹配,键位存在即已绑')
  assert.equal(reg.bound[0].mode, '注册表')

  const conflict = reconcile([decl('Ctrl+Shift+Q')], hs, '{}')
  assert.equal(conflict.doubtful.length, 1)
  assert.equal(conflict.unbound.length, 0)
  assert.equal(conflict.bound.length, 0)

  const un = reconcile([decl('Ctrl+Alt+Y')], hs, '{}')
  assert.equal(un.unbound.length, 1)
  assert.equal(un.unbound[0].canonical, 'mod+alt+y')
})

test('reconcile(变异):喂入不存在的 chord 必须判缺陷且不吞成信息', () => {
  const before = reconcile([decl('Ctrl+Shift+U')], handlers(), '{}')
  assert.equal(before.unbound.length, 0, '基线不得有缺陷')
  const mutated = reconcile([decl('Ctrl+Shift+U'), decl('Ctrl+Shift+Z')], handlers(), '{}')
  assert.equal(mutated.unbound.length, 1, '注入不存在的 chord 后必须出现 1 项缺陷')
  assert.equal(mutated.unbound[0].canonical, 'mod+shift+z')
})

test('reconcile:注册表有键无消费者 = 缺陷(有键无功能)', () => {
  const ghost = reconcile([decl('Ctrl+Shift+U', 'registry', { event: 'global-shortcut:ghost' })], handlers(), '{}')
  assert.equal(ghost.unbound.length, 1)
  assert.match(ghost.unbound[0].reason, /无消费者/)
  assert.equal(eventHasConsumer('__toggle_help__', '{}'), true, '内置事件由 hook 自身消化')
})

test('collectDeclarations:只收结构化 UI 声明,注释里的 chord 不算', () => {
  const text = [
    "const A = [{ shortcut: 'Ctrl+B' }]",
    '<Tooltip shortcut="Ctrl+," />',
    '<div><kbd>Ctrl+Alt+Z</kbd></div>',
    '// 设计说明:Ctrl+K 走命令面板,注释里的不算 UI 声明',
    '<kbd>',
    '  Ctrl+Shift+I',
    '</kbd>',
  ].join('\n')
  const got = collectDeclarations('/abs/apps/web/src/components/x/y.tsx', text).map((d) => d.canonical)
  assert.ok(got.includes('mod+b'), 'shortcut 字段')
  assert.ok(got.includes('mod+,'), 'shortcut JSX 属性')
  assert.ok(got.includes('mod+alt+z'), '<kbd> 内联')
  assert.ok(got.includes('mod+shift+i'), '<kbd> 跨行')
  assert.ok(!got.includes('mod+k'), '注释里的 chord 不得进声明侧')
})

test('collectDeclarations:注册表条目带 event,供消费者反查', () => {
  const text = [
    'const DEFAULT_SHORTCUTS: DefaultShortcut[] = [',
    "  { key: 'Ctrl+Shift+U', description: '提及文件', event: 'global-shortcut:mention-file' },",
    ']',
    '',
    '// ====',
  ].join('\n')
  const got = collectDeclarations('/abs/apps/web/src/hooks/use-global-shortcuts.ts', text)
  assert.equal(got.length, 1)
  assert.equal(got[0].kind, 'registry')
  assert.equal(got[0].event, 'global-shortcut:mention-file')
  assert.equal(got[0].canonical, 'mod+shift+u')
})

test('源脚本自测入口 runSelfTest 返回 0', () => {
  assert.equal(src.runSelfTest(), 0, 'runSelfTest 内部断言必须全绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
