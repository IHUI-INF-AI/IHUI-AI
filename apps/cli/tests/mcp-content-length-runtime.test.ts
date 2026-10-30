// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { connectMcpServer, disconnectMcpConnection } from '../src/tools/mcp-runtime.js'

const FRAME_SERVER = [
  "'use strict';",
  "var Buffer = require('buffer').Buffer;",
  'var buf = Buffer.alloc(0);',
  'function frame(obj) {',
  '  var body = Buffer.from(JSON.stringify(obj));',
  "  process.stdout.write('Content-Length: ' + body.length + '\\r\\n\\r\\n');",
  '  process.stdout.write(body);',
  '}',
  'function reply(id, result) { frame({ jsonrpc: "2.0", id: id, result: result }); }',
  'function fail(id) { frame({ jsonrpc: "2.0", id: id, error: { code: -32601, message: "Method not found" } }); }',
  "process.stdin.on('data', function (d) {",
  '  buf = Buffer.concat([buf, d]);',
  '  while (true) {',
  "    var text = buf.toString('utf8');",
  "    var sep = text.indexOf('\\r\\n\\r\\n');",
  '    if (sep < 0) return;',
  "    var match = /content-length:\\s*(\\d+)/i.exec(text.slice(0, sep));",
  '    if (!match) return;',
  '    var len = Number(match[1]);',
  '    var headerBytes = Buffer.byteLength(text.slice(0, sep + 4));',
  '    if (buf.length < headerBytes + len) return;',
  "    var body = buf.subarray(headerBytes, headerBytes + len).toString('utf8');",
  '    buf = buf.subarray(headerBytes + len);',
  '    var msg = JSON.parse(body);',
  '    if (msg.id === undefined) continue;',
  "    if (msg.method === 'initialize') reply(msg.id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'frame', version: '0' } });",
  "    else if (msg.method === 'tools/list') reply(msg.id, { tools: [{ name: 'analyze_javascript_application', description: 'analyze', inputSchema: { type: 'object' } }] });",
  '    else fail(msg.id);',
  '  }',
  '});',
].join('\n')

describe('content-length stdio', () => {
  it('initialize 与 tools/list 走官方分帧', async () => {
    const conn = await connectMcpServer({
      name: 'frame',
      transport: 'stdio',
      command: process.execPath,
      args: ['-e', FRAME_SERVER],
      framing: 'content-length',
    })
    try {
      expect(conn.connected).toBe(true)
      expect(conn.tools.map((tool) => tool.name)).toEqual(['analyze_javascript_application'])
    } finally {
      disconnectMcpConnection(conn)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
