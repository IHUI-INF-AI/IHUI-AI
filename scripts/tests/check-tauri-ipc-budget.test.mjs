// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-3 镜像测试:check-tauri-ipc-budget 的判据本体。
 *
 * 正反成对,避免只留正向用例让判据整族空转:
 *   ① 绿:单一 facade + 逐键注释 + 经门面调用 + 探测唯一落点 ⇒ 零违规;
 *   ② 红:超 20 键 / 缺 owner 或 purpose / 两处直连 @tauri-apps / 裸全局;
 *   ③ 反假绿:注释里的 @tauri-apps 与 window.__TAURI_* 不算违规,空扫描面也不算绿。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DETECTOR_REL,
  FACADE_REL,
  MAX_IPC_KEYS,
  evaluate,
  parseFacade,
  stripComments,
} from '../check-tauri-ipc-budget.mjs'

function facadeSource(keys, { annotate = true } = {}) {
  return [
    'export const ihuiIpc = {',
    ...keys.map((k) => {
      const doc = annotate ? `  /** owner: desktop-platform · purpose: ${k} 用途 */\n` : ''
      return `${doc}  ${k}: () => {},`
    }),
    '} as const',
  ].join('\n')
}

test('① parseFacade:逐键解析 owner/purpose 注释', () => {
  const parsed = parseFacade(facadeSource(['call', 'listen']))
  assert.equal(parsed.ok, true)
  assert.deepEqual(
    parsed.keys.map((k) => k.name),
    ['call', 'listen'],
  )
  assert.ok(parsed.keys.every((k) => k.annotated), '两枚键都必须带注释')

  const bad = parseFacade(facadeSource(['call'], { annotate: false }))
  assert.equal(bad.keys[0].annotated, false, '缺注释必须被解析成未标注')
  assert.equal(parseFacade('export const other = {}').ok, false, '找不到 ihuiIpc 不得静默绿')
})

test('② 绿夹具:单一门面 + 8 键 + 业务代码只经门面', () => {
  const result = evaluate({
    files: [
      { rel: FACADE_REL, source: facadeSource(['call', 'channel', 'listen']) },
      {
        rel: 'apps/web/src/lib/tauri-bridge.ts',
        source: "import { ihuiIpc } from '@/lib/tauri-ipc'\nexport const x = ihuiIpc.call('x')",
      },
      {
        rel: DETECTOR_REL,
        source: "export const isTauri = () => '__TAURI_INTERNALS__' in window",
      },
    ],
  })
  assert.equal(result.ok, true, JSON.stringify(result.violations))
  assert.equal(result.stats.keys, 3)
})

test('③ 红夹具:键数超预算 / 缺注释', () => {
  const over = evaluate({
    files: [
      {
        rel: FACADE_REL,
        source: facadeSource(Array.from({ length: MAX_IPC_KEYS + 1 }, (_, i) => `k${i}`)),
      },
    ],
  })
  assert.ok(over.violations.some((v) => v.kind === 'key-budget'))
  assert.equal(over.stats.keys, MAX_IPC_KEYS + 1)

  const unannotated = evaluate({
    files: [
      { rel: FACADE_REL, source: facadeSource(['call'], { annotate: false }) },
    ],
  })
  assert.ok(unannotated.violations.some((v) => v.kind === 'key-annotation'))
})

test('④ 红夹具:两个直连 import(多命名空间反例)逐条点名', () => {
  const result = evaluate({
    files: [
      { rel: FACADE_REL, source: facadeSource(['call']) },
      {
        rel: 'apps/web/src/lib/a.ts',
        source: "import { invoke } from '@tauri-apps/api/core'\nexport const a = invoke",
      },
      {
        rel: 'apps/web/src/lib/b.ts',
        source: "const { listen } = await import('@tauri-apps/api/event')\nexport const b = listen",
      },
    ],
  })
  const raw = result.violations.filter((v) => v.kind === 'raw-import')
  assert.deepEqual(
    raw.map((v) => v.file),
    ['apps/web/src/lib/a.ts', 'apps/web/src/lib/b.ts'],
  )
})

test('⑤ 红夹具:裸全局只认代码,不认注释;探测落点豁免', () => {
  const result = evaluate({
    files: [
      { rel: FACADE_REL, source: facadeSource(['call']) },
      {
        rel: 'apps/web/src/lib/c.ts',
        source: "export const x = Boolean(window.__TAURI_INTERNALS__)",
      },
      {
        rel: DETECTOR_REL,
        source: "export const x = '__TAURI_INTERNALS__' in window",
      },
      {
        rel: 'apps/web/src/lib/d.ts',
        source: '/** 注释里提到 window.__TAURI__ 与 @tauri-apps/api/core 不算违规 */\nexport const ok = true',
      },
    ],
  })
  assert.deepEqual(
    result.violations.filter((v) => v.kind === 'raw-global').map((v) => v.file),
    ['apps/web/src/lib/c.ts'],
  )
  assert.equal(result.violations.filter((v) => v.kind === 'raw-import').length, 0)
})

test('⑥ 反假绿:空面 / facade 缺失 / 用门面却没导入 都判红', () => {
  assert.equal(evaluate({ files: [] }).ok, false, '空扫描面不得读成全绿')

  const missing = evaluate({
    files: [{ rel: 'apps/web/src/lib/a.ts', source: 'export const a = 1' }],
  })
  assert.ok(missing.violations.some((v) => v.kind === 'facade-missing'))

  const noImport = evaluate({
    files: [
      { rel: FACADE_REL, source: facadeSource(['call']) },
      { rel: 'apps/web/src/lib/a.ts', source: 'export const a = ihuiIpc.call' },
    ],
  })
  assert.ok(noImport.violations.some((v) => v.kind === 'facade-import-missing'))
})

test('⑦ stripComments 保留字符串里的 // 与 @tauri-apps 字面量', () => {
  const src = [
    '// import { invoke } from "@tauri-apps/api/core"',
    'const url = "https://aizhs.top/#/chat"',
    '/* window.__TAURI__ 只在注释里 */',
    'export const mod = "@tauri-apps/api/event"',
  ].join('\n')
  const code = stripComments(src)
  assert.equal(code.includes('import { invoke }'), false)
  assert.equal(code.includes('window.__TAURI__'), false)
  assert.ok(code.includes('https://aizhs.top/#/chat'), '字符串里的 // 不能被吞')
  assert.ok(code.includes('@tauri-apps/api/event'), '字符串字面量仍由 raw-import 判据处理')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
