// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AGENTS.md §22c:测试直接 import 源脚本导出的 __test__,不复制镜像常量。
// 运行:node --test scripts/tests/check-adapter-wiring.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { __test__ as wiring } from '../check-adapter-wiring.mjs'

test('从 adapters 路径的具名 import 判定为已接线', () => {
  const bindings = wiring.extractAdapterBindings(
    "import { SectionHeader } from '@/components/adapters'",
  )
  assert.equal([...bindings].join(','), 'SectionHeader')
})

test('type-only import 同样算接线', () => {
  const bindings = wiring.extractAdapterBindings(
    "import type { SelecterProps } from '@/components/adapters'",
  )
  assert.equal([...bindings].join(','), 'SelecterProps')
})

test('as 别名取原组件名', () => {
  const bindings = wiring.extractAdapterBindings('import { TabBar as TB } from "./adapters"')
  assert.equal([...bindings].join(','), 'TabBar')
})

test('默认导入(specifier 含 adapters)算接线', () => {
  const bindings = wiring.extractAdapterBindings(
    "import PayButton from '@/components/adapters/PayButton.taro'",
  )
  assert.equal([...bindings].join(','), 'PayButton')
})

// 这条是本门初版的真实缺陷:端内存在同名自有组件(components/NavBar.tsx),
// 不限定 specifier 会把它们的 import 误判为适配器已接线 → 死代码被放过。
test('端内同名自有组件的 import 不得判为适配器接线', () => {
  const bindings = wiring.extractAdapterBindings("import { NavBar } from '@/components/NavBar'")
  assert.equal(bindings.size, 0)
})

test('注释里的组件名不算接线', () => {
  const code =
    'const x = 1\n// 对齐 RN SettingsScreen container\nexport default function P() { return null }'
  assert.equal(wiring.extractAdapterBindings(code).size, 0)
})

test('JSX 注释里的组件名不算接线', () => {
  const code =
    '{/* 对齐 RN MessageCenterScreen listBody */}\nexport default function P() { return null }'
  assert.equal(wiring.extractAdapterBindings(code).size, 0)
})

test('内建自检全部通过', () => {
  assert.equal(wiring.selfTest(), true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
