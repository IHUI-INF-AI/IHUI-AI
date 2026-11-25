// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('输入框加号菜单的连接器只读挂载(2026-11-25)', () => {
  it('加号菜单在能力分组提供"连接器"toggle 入口,与插件市场并列', () => {
    const menu = read('../add-menu-popover.tsx')
    // 入口回调 prop 已声明并解构(toggle + 选中态)
    expect(menu).toContain('onToggleConnectors: () => void')
    expect(menu).toContain('connectorsMounted: boolean')
    expect(menu).toContain('    onToggleConnectors,')
    expect(menu).toContain('    connectorsMounted,')
    // 菜单项渲染:role=menuitem + tNav('connectors') + Cable 图标 + aria-pressed 选中态
    expect(menu).toContain("tNav('connectors')")
    expect(menu).toContain('<Cable className={MENU_ITEM_ICON_CLASS} />')
    expect(menu).toContain('aria-pressed={connectorsMounted}')
    // 入口紧跟插件市场(同属"能力"分组)
    const pluginIdx = menu.indexOf("tNav('pluginMarket')")
    const connectorIdx = menu.indexOf("tNav('connectors')")
    expect(pluginIdx).toBeGreaterThan(-1)
    expect(connectorIdx).toBeGreaterThan(pluginIdx)
  })

  it('主组件把连接器入口接到 selectedTools 的 toggle(非假跳转)', () => {
    const input = read('../message-input.tsx')
    expect(input).toContain('onToggleConnectors={() => {')
    expect(input).toContain('store.addSelectedTool(CONNECTORS_TOOL_ID)')
    expect(input).toContain('store.removeSelectedTool(CONNECTORS_TOOL_ID)')
    expect(input).toContain("const CONNECTORS_TOOL_ID = 'connectors-readonly'")
    expect(input).toContain('connectorsMounted={selectedToolsIds.includes(CONNECTORS_TOOL_ID)}')
  })

  it('虚拟 pluginId 只映射到两个只读工具,绝无写类工具', () => {
    const cfg = readFileSync(
      resolve(process.cwd(), 'src/hooks/use-chat/tool-config.ts'), 'utf8',
    )
    expect(cfg).toContain("'connectors-readonly': ['connector_capabilities', 'connector_call_read']")
    const line = cfg.split('\n').find((l) => l.includes("'connectors-readonly':"))
    expect(line).toBeDefined()
    for (const forbidden of ['invoke', 'write', 'action', 'send', 'delete']) {
      expect(line!.toLowerCase()).not.toContain(forbidden)
    }
  })

  it('五语均有 nav.connectors 标签(非纯中文硬编码)', () => {
    for (const lang of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
      const json = JSON.parse(
        readFileSync(resolve(process.cwd(), `../../packages/i18n/messages/web/${lang}.json`), 'utf8'),
      )
      expect(json.nav.connectors, `${lang} 缺 nav.connectors`).toBeTruthy()
    }
  })

  it('变异锁:不得把连接器入口写成只插入引用标签的假挂载', () => {
    const menu = read('../add-menu-popover.tsx')
    const block = menu.slice(
      menu.indexOf('onToggleConnectors()'),
      menu.indexOf('onToggleConnectors()') + 120,
    )
    expect(block).not.toContain('addTextReference')
  })
})
