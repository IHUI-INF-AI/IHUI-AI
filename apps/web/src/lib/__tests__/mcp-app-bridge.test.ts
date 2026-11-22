// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  MCP_APP_METHODS,
  MCP_APP_PROTOCOL_VERSION,
  isAppRpcRequest,
  isMcpAppMethod,
  isMcpAppResource,
  rpcError,
  rpcResult,
} from '../mcp-app-bridge'

describe('isMcpAppResource', () => {
  it('ui:// 前缀一律按 App 渲染', () => {
    expect(isMcpAppResource(undefined, 'ui://dashboard/main.html')).toBe(true)
    expect(isMcpAppResource('text/plain', 'ui://x')).toBe(true)
  })

  it('只有带 mcp-app profile 的 text/html 才进宿主', () => {
    expect(isMcpAppResource('text/html;profile=mcp-app', 'file:///a.html')).toBe(true)
    expect(isMcpAppResource('Text/HTML; Profile=MCP-App', 'file:///a.html')).toBe(true)
    expect(isMcpAppResource('text/html', 'file:///a.html')).toBe(false)
    expect(isMcpAppResource('text/markdown', 'file:///a.md')).toBe(false)
  })
})

describe('isAppRpcRequest', () => {
  it('接受 JSON-RPC 2.0 请求', () => {
    expect(
      isAppRpcRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'x' },
      }),
    ).toBe(true)
    expect(isAppRpcRequest({ jsonrpc: '2.0', id: 'abc', method: 'ping' })).toBe(true)
  })

  it('拒绝通知(无 id)、坏版本、非对象', () => {
    expect(isAppRpcRequest({ jsonrpc: '2.0', method: 'ping' })).toBe(false)
    expect(isAppRpcRequest({ jsonrpc: '1.0', id: 1, method: 'ping' })).toBe(false)
    expect(isAppRpcRequest({ jsonrpc: '2.0', id: 1, method: '' })).toBe(false)
    expect(isAppRpcRequest({ jsonrpc: '2.0', id: 1, method: 'ping', params: null })).toBe(false)
    expect(isAppRpcRequest(null)).toBe(false)
    expect(isAppRpcRequest('ping')).toBe(false)
  })

  it('id 只认 string | number', () => {
    expect(isAppRpcRequest({ jsonrpc: '2.0', id: true, method: 'ping' })).toBe(false)
    expect(isAppRpcRequest({ jsonrpc: '2.0', id: {}, method: 'ping' })).toBe(false)
  })
})

describe('方法白名单', () => {
  it('只放行四个方法', () => {
    for (const method of MCP_APP_METHODS) expect(isMcpAppMethod(method)).toBe(true)
    expect(isMcpAppMethod('ui/unknown')).toBe(false)
    expect(isMcpAppMethod('resources/subscribe')).toBe(false)
  })
})

describe('回包构造', () => {
  it('成功包带同 id 与 result', () => {
    expect(rpcResult(7, { ok: true })).toEqual({ jsonrpc: '2.0', id: 7, result: { ok: true } })
  })

  it('错误包带 code / message', () => {
    expect(rpcError('x', -32601, '未知方法')).toEqual({
      jsonrpc: '2.0',
      id: 'x',
      error: { code: -32601, message: '未知方法' },
    })
  })

  it('协议版本与 MCP Apps 对齐', () => {
    expect(MCP_APP_PROTOCOL_VERSION).toBe('2025-06-18')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
