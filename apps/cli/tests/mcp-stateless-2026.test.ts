// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { MCP_STATELESS_PROTOCOL_VERSION } from '@ihui/shared'
import { normalizeMcpInput } from '../src/commands/mcp-config.js'
import { buildStatelessMcpHttpRequest } from '../src/tools/mcp-runtime.js'

const clientInfo = { name: 'ihui-cli', version: '0.1.0' }

describe('MCP 2026-07-28 stateless HTTP request', () => {
  it('配置加载保留 protocolVersion，不被归一化丢掉', () => {
    const config = normalizeMcpInput({
      mcpServers: {
        search: {
          url: 'https://mcp.example.com',
          transport: 'http',
          protocolVersion: MCP_STATELESS_PROTOCOL_VERSION,
        },
      },
    })
    expect(config.servers[0]?.protocolVersion).toBe('2026-07-28')
  })

  it('tools/call 自带协议版本、方法、工具名与 _meta', () => {
    const built = buildStatelessMcpHttpRequest(
      'tools/call',
      { name: 'search', arguments: { q: 'otters' }, _meta: { traceparent: '00-abc' } },
      MCP_STATELESS_PROTOCOL_VERSION,
      clientInfo,
      { elicitation: {} },
    )
    expect(built.headers).toEqual({
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'search',
    })
    expect(built.params).toEqual({
      name: 'search',
      arguments: { q: 'otters' },
      _meta: {
        traceparent: '00-abc',
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientInfo': clientInfo,
        'io.modelcontextprotocol/clientCapabilities': { elicitation: {} },
      },
    })
  })

  it('tools/list 不写 Mcp-Name，也不伪造工具名', () => {
    const built = buildStatelessMcpHttpRequest(
      'tools/list',
      {},
      MCP_STATELESS_PROTOCOL_VERSION,
      clientInfo,
      {},
    )
    expect(built.headers).toEqual({
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/list',
    })
    expect(built.params._meta).toMatchObject({
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientCapabilities': {},
    })
  })

  it('非法工具名不进 HTTP 头，避免头注入/代理路由歧义', () => {
    const built = buildStatelessMcpHttpRequest(
      'tools/call',
      { name: 'bad name\r\nX-Injected: 1' },
      MCP_STATELESS_PROTOCOL_VERSION,
      clientInfo,
      {},
    )
    expect(built.headers['Mcp-Name']).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
