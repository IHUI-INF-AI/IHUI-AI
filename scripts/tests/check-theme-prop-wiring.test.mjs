// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-theme-prop-wiring.mjs 的镜像测试(AGENTS.md §22c)。
 *
 * 重点不是再跑一遍扫描逻辑(源脚本自带 --self-test),而是钉住两件"本地全绿也发现不了"的事:
 *  ① 装车证明 —— 这道门必须真的挂在 guardian-runner 的 blocking 清单里。历史上
 *     "脚本造好没接线"至少发生过两次(守门 64 的适配层接线、守门 70 的硬编码中文),
 *     门不装车等于没有门。
 *  ② 编号唯一 —— 同日多会话各加一道门时最容易撞号。
 * 另有三条最小正反对照,钉住 classify 的三态语义不被改宽。
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-theme-prop-wiring.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const runner = readFileSync(join(here, '..', 'guardian-runner.mjs'), 'utf8')

/**
 * 编号不写死:同日多会话在数组同一位各加一道门必撞号,而撞号后的正当处置就是"后登记者改号"
 * (AGENTS 门 80 的登记纪律)。把断言锚在编号字面值上,会让每次正常改号都把自证测试变红 ——
 * 2026-09-24 同日另一道门 90→93 时红的就是它自己。现按 script 名反查自己的编号,
 * 只钉真不变量:该编号在 runner 里唯一 / blocking / 有紧急跳过变量。
 */
const MY_SCRIPT = "script: 'check-theme-prop-wiring.mjs'"
const idCount = (text, id) => text.split(`id: '${id}'`).length - 1
function myGateId(text) {
  const at = text.indexOf(MY_SCRIPT)
  assert.ok(at > 0, 'runner 里必须注册本门(按 script 名反查)')
  const before = [...text.slice(0, at).matchAll(/^\s+id:\s*'([^']+)',?$/gm)]
  assert.ok(before.length, '本门注册块之前必须能找到 id 行')
  return before[before.length - 1][1]
}

test('门已装车:本门编号(反查所得)必须 blocking 且指向本脚本', () => {
  const id = myGateId(runner)
  const block = runner.slice(runner.indexOf(`id: '${id}'`), runner.indexOf(MY_SCRIPT) + 400)
  assert.match(block, /script: 'check-theme-prop-wiring\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_THEME_PROP_WIRING'/)
})

test('编号唯一(并配合成撞号反空绿,证明本条不是恒真)', () => {
  const id = myGateId(runner)
  assert.equal(idCount(runner, id), 1, `id ${id} 出现 ${idCount(runner, id)} 次,应为 1 次`)
  const dup = runner.replace(/\n(\s+)label:/, `\n$1id: '${id}',\n$1label:`)
  assert.equal(idCount(dup, id), 2, '合成撞号未被识别 = 本条判据恒真')
})

test('导出面稳定:__test__ 必须暴露这三个函数,否则本文件会假绿', () => {
  for (const key of ['findThemeDrivenComponents', 'findJsxElementSites', 'inspectThemeAttr']) {
    assert.equal(typeof __test__[key], 'function', `__test__.${key} 缺失`)
  }
})

test('classify 三态:漏传 / 字面量 / 正确传值', () => {
  assert.equal(__test__.inspectThemeAttr(' t={x} /').kind, 'missing')
  assert.equal(__test__.inspectThemeAttr(' colorScheme="light" /').kind, 'literal')
  assert.equal(__test__.inspectThemeAttr(' colorScheme="dark" /').kind, 'literal')
  assert.equal(__test__.inspectThemeAttr(' colorScheme={resolvedTheme} /').kind, 'ok')
})

test('整标签 {...props} 转发归 spread-unknown,不当成 ok 也不当成 missing', () => {
  const r = __test__.inspectThemeAttr(' {...props} /')
  assert.equal(r.kind, 'spread-unknown')
  // 判不出就是判不出 —— 不许静默放行成 ok,那会让 115 处里最隐蔽的一类彻底隐形
  assert.notEqual(r.kind, 'ok')
})

test('渲染点枚举:同名多站点逐个报,不合并', () => {
  const sites = __test__.findJsxElementSites(
    'const a = <Foo t={x} />\nconst b = <Foo colorScheme="light" />\n',
  )
  assert.equal(sites.length, 2)
  assert.deepEqual(
    sites.map((s) => s.name),
    ['Foo', 'Foo'],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠