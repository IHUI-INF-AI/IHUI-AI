// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

import { Command } from 'commander'
import { afterEach, describe, expect, it } from 'vitest'

import {
  formatMcpDiscovery,
  parseMcpDiscoverMaxCards,
  registerMcpDiscoverCommand,
} from '../src/commands/mcp-discover.js'
import { setLocale } from '../src/i18n/index.js'
import type { DiscoverMcpServerCardsResult } from '../src/tools/mcp-server-card.js'

afterEach(() => setLocale('zh-CN'))

describe('mcp discover 参数', () => {
  it('max-cards 缺省 10，0 与 100 合法', () => {
    expect(parseMcpDiscoverMaxCards(undefined)).toBe(10)
    expect(parseMcpDiscoverMaxCards('0')).toBe(0)
    expect(parseMcpDiscoverMaxCards('100')).toBe(100)
  })

  it('负数、超上限、小数、非数字都在发请求前拒绝', () => {
    for (const raw of ['-1', '101', '1.5', 'abc', '']) {
      expect(() => parseMcpDiscoverMaxCards(raw)).toThrow()
    }
  })

  it('注册到 mcp 命令组，带 --json 与 --max-cards', () => {
    const root = new Command()
    const mcp = root.command('mcp')
    registerMcpDiscoverCommand(mcp)
    const discover = mcp.commands.find((command) => command.name() === 'discover')
    expect(discover).toBeDefined()
    expect(discover?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining(['--json', '--max-cards']),
    )
  })
})

describe('mcp discover 输出', () => {
  const base: DiscoverMcpServerCardsResult = {
    catalogUrl: 'https://example.com/.well-known/ai-catalog.json',
    catalogOk: true,
    errors: [],
    cards: [],
  }

  it('合法目录但零卡片不报错，明确说没发现', () => {
    setLocale('zh-CN')
    const lines = formatMcpDiscovery(base)
    expect(lines[0]).toContain(base.catalogUrl)
    expect(lines.at(-1)).toContain('未发现')
  })

  it('逐卡输出标识、名称与版本；坏卡片带原因', () => {
    setLocale('zh-CN')
    const result: DiscoverMcpServerCardsResult = {
      ...base,
      cards: [
        {
          identifier: 'com.example/demo',
          url: 'https://example.com/card.json',
          ok: true,
          errors: [],
          card: {
            $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
            name: 'com.example/demo',
            version: '1.2.3',
            description: '示例服务',
          },
        },
        {
          identifier: 'com.example/broken',
          ok: false,
          errors: ['version 必须是具体版本'],
        },
      ],
    }
    const text = formatMcpDiscovery(result).join('\n')
    expect(text).toContain('com.example/demo')
    expect(text).toContain('1.2.3')
    expect(text).toContain('示例服务')
    expect(text).toContain('com.example/broken')
    expect(text).toContain('version 必须是具体版本')
  })

  it('目录不可用时只输出失败原因，不装作零卡片', () => {
    setLocale('zh-CN')
    const lines = formatMcpDiscovery({
      ...base,
      catalogOk: false,
      errors: ['HTTP 404'],
    })
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('HTTP 404')
  })
})
