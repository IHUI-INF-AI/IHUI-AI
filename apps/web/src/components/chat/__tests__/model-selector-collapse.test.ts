// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型选择器「反代平台折叠/展开」的判据锁(2026-11-21 立)。
 *
 * 两段:
 *  ① 纯逻辑 —— 切换 / 解析 / 序列化(坏存储必须退化成"全部展开",不能把整组模型藏起来);
 *  ② 接线 —— 直接读 model-selector.tsx 的代码面,确认组标题真的是可点击项、带 aria-expanded,
 *     且模型行真的被 collapsed 门住(防止以后有人把折叠改成"只是加个箭头"的假动作)。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  MODEL_SELECTOR_COLLAPSED_VENDORS_STORAGE_KEY,
  parseCollapsedVendors,
  serializeCollapsedVendors,
  toggleCollapsedVendor,
} from '../model-selector-collapse'
import {
  prettifyVendorCode,
  resolveVendorDisplayName,
  resolveVendorLabel,
  stripInternalVendorSuffix,
  vendorGroupKey,
} from '../fallback-models'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SELECTOR_SRC = fs.readFileSync(path.resolve(HERE, '..', 'model-selector.tsx'), 'utf8')

describe('反代平台折叠态·纯逻辑', () => {
  it('切换返回新 Set:先收起再展开,且不原地改传入集合', () => {
    const empty = new Set<string>()
    const collapsed = toggleCollapsedVendor(empty, 'vendor.deepseek')
    expect(collapsed.has('vendor.deepseek')).toBe(true)
    expect(empty.size, '传入集合不得被原地修改').toBe(0)

    const expanded = toggleCollapsedVendor(collapsed, 'vendor.deepseek')
    expect(expanded.has('vendor.deepseek')).toBe(false)
    expect(expanded.size).toBe(0)
  })

  it('两个组互不影响', () => {
    const next = toggleCollapsedVendor(
      toggleCollapsedVendor(new Set(), 'vendor.qwen'),
      'vendor.glm',
    )
    expect([...next].sort()).toEqual(['vendor.glm', 'vendor.qwen'])
  })

  it('空值 / 坏 JSON / 非数组一律解析成空集(= 全部展开)', () => {
    expect(parseCollapsedVendors(null).size).toBe(0)
    expect(parseCollapsedVendors('').size).toBe(0)
    expect(parseCollapsedVendors('{').size).toBe(0)
    expect(parseCollapsedVendors('{"a":1}').size).toBe(0)
    expect(parseCollapsedVendors('null').size).toBe(0)
  })

  it('只保留非空字符串条目,数字/空串/对象丢弃', () => {
    const parsed = parseCollapsedVendors('["vendor.deepseek","",1,null,{"k":"v"},"WorkBuddy"]')
    expect([...parsed].sort()).toEqual(['WorkBuddy', 'vendor.deepseek'])
  })

  it('序列化后能原样读回', () => {
    const set = new Set(['vendor.deepseek', 'WorkBuddy'])
    expect(parseCollapsedVendors(serializeCollapsedVendors(set))).toEqual(set)
  })

  it('存储键在 @ihui/shared 单源登记(改名必须同步改这里)', () => {
    expect(MODEL_SELECTOR_COLLAPSED_VENDORS_STORAGE_KEY).toBe(
      'ihui-model-selector-collapsed-vendors',
    )
  })
})

describe('平台展示名·内部接入后缀永不外露', () => {
  const t = (key: string) => (key === 'vendor.ihuiRelay' ? '智汇AI' : key)

  it('workbuddy_relay 与 workbuddy 落在同一展示名', () => {
    expect(resolveVendorDisplayName('workbuddy_relay', t)).toBe('WorkBuddy')
    expect(resolveVendorDisplayName('workbuddy', t)).toBe('WorkBuddy')
    expect(vendorGroupKey('workbuddy_relay')).toBe('WorkBuddy')
  })

  it('大小写 / 连字符形态也剥掉(真实 code 是下划线小写)', () => {
    expect(stripInternalVendorSuffix('WORKBUDDY_RELAY')).toBe('WORKBUDDY')
    expect(stripInternalVendorSuffix('foo-relay')).toBe('foo')
    expect(resolveVendorDisplayName('FOO_RELAY', t)).toBe('Foo')
  })

  it('未知平台的兜底名也不带 relay,不做原样回退', () => {
    const name = resolveVendorDisplayName('unknown_platform_relay', t)
    expect(name.toLowerCase()).not.toContain('relay')
    expect(prettifyVendorCode('some_new_platform_relay')).toBe('Some New Platform')
  })

  it('ihui_relay 有 i18n 名时走翻译;没有时兜底也不带 relay', () => {
    expect(resolveVendorDisplayName('ihui_relay', t)).toBe('智汇AI')
    expect(resolveVendorDisplayName('ihui_relay').toLowerCase()).not.toContain('relay')
    expect(resolveVendorLabel('ihui_relay').key).toBe('vendor.ihuiRelay')
  })
})

describe('反代平台折叠态·接线锁', () => {
  it('组标题是可点击菜单项(不是纯 Label),并带 aria-expanded 与折叠标记', () => {
    expect(SELECTOR_SRC).toContain('data-vendor-group={label}')
    expect(SELECTOR_SRC).toContain('data-vendor-collapsed={collapsed ?')
    expect(SELECTOR_SRC).toContain('aria-expanded={!collapsed}')
    expect(SELECTOR_SRC).toContain('toggleVendorCollapsed(label)')
  })

  it('模型行真的被 collapsed 门住(收起后不再铺出来)', () => {
    // `{!collapsed &&` 后面紧跟的必须是模型行渲染,不接受"箭头改了但行还照旧铺"
    expect(SELECTOR_SRC).toMatch(/\{!collapsed &&\s*items\.map\(\(opt\) => \(/)
  })

  it('默认全展开:初始集合为空,且从本机存储读回折叠态', () => {
    expect(SELECTOR_SRC).toContain('React.useState<Set<string>>(() => new Set())')
    expect(SELECTOR_SRC).toContain('parseCollapsedVendors(')
    expect(SELECTOR_SRC).toContain('serializeCollapsedVendors(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
