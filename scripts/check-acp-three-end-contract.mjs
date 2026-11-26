// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L14 三端协议接线门(2026-11-26):
 *  - 单一真相源在 packages/types/src/agent-protocol.ts;
 *  - agent-sdk/src/contract.ts 只转发,不得再写方法字面量;
 *  - web / RN / 小程序各有协议出口,且必须从 @ihui/api-client 取;
 *  - api-client 的 chat / agent-chat-stream / agent-runtime 必须在真实业务
 *    请求上写 ACP 方法身份头。
 *
 * 本门只读源码文本,不跑构建;字面量真值由 L14 contract 测试另钉。
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const files = {
  singleSource: 'packages/types/src/agent-protocol.ts',
  sdkContract: 'packages/agent-sdk/src/contract.ts',
  apiProtocol: 'packages/api-client/src/agent-protocol.ts',
  chat: 'packages/api-client/src/endpoints/chat.ts',
  agentStream: 'packages/api-client/src/endpoints/agent-chat-stream.ts',
  agentRuntime: 'packages/api-client/src/endpoints/agent-runtime.ts',
  web: 'apps/web/src/lib/agent-protocol.ts',
  rn: 'apps/mobile-rn/src/lib/agent-protocol.ts',
  mini: 'apps/miniapp-taro/src/lib/agent-protocol.ts',
}

const missing = []
const problems = []

for (const [key, rel] of Object.entries(files)) {
  if (!existsSync(resolve(root, rel))) missing.push(`${key}:${rel}`)
}

const read = (key) => readFileSync(resolve(root, files[key]), 'utf8')
if (missing.length === 0) {
  const single = read('singleSource')
  const sdk = read('sdkContract')
  const api = read('apiProtocol')
  const chat = read('chat')
  const stream = read('agentStream')
  const runtime = read('agentRuntime')

  if (!single.includes("sessionNew: 'session/new'")) problems.push('single-source 缺 session/new')
  if (!single.includes("sessionPrompt: 'session/prompt'")) problems.push('single-source 缺 session/prompt')
  if (/export const ACP_METHODS/.test(sdk)) {
    problems.push('agent-sdk/contract.ts 仍定义方法表(应只转发 @ihui/types)')
  }
  if (!sdk.includes("from '@ihui/types'")) problems.push('agent-sdk/contract.ts 未从 @ihui/types 转发')
  if (!api.includes("from '@ihui/types'")) problems.push('api-client/agent-protocol.ts 未从 @ihui/types 转发')

  for (const [end, rel] of [['web', files.web], ['rn', files.rn], ['mini', files.mini]]) {
    const source = readFileSync(resolve(root, rel), 'utf8')
    if (!source.includes("from '@ihui/api-client'")) problems.push(`${end} 协议出口未从 @ihui/api-client 取`)
    if (!source.includes('ACP_METHODS')) problems.push(`${end} 协议出口未暴露 ACP_METHODS`)
  }

  if (!chat.includes('acpMethodHeaders(ACP_METHODS.sessionNew)')) {
    problems.push('chat.createConversation 未带 session/new')
  }
  if (!chat.includes('acpMethodHeaders(ACP_METHODS.sessionPrompt)')) {
    problems.push('chat.sendMessage 未带 session/prompt')
  }
  if (!stream.includes('acpMethodHeaders(ACP_METHODS.sessionPrompt)')) {
    problems.push('agent-chat-stream 未带 session/prompt')
  }
  const runtimeCount = (runtime.match(/acpMethodHeaders\(ACP_METHODS\.sessionPrompt\)/g) ?? []).length
  if (runtimeCount < 2) problems.push(`agent-runtime 流请求未全部带 session/prompt(命中=${runtimeCount})`)
}

const report = {
  files: Object.keys(files).length,
  missing: missing.length,
  problems: problems.length,
  ends: missing.length === 0 ? 3 : 0,
}
process.stdout.write(`acp-three-end-contract ${JSON.stringify(report)}\n`)
for (const item of missing) process.stdout.write(`  ❌ 缺文件 ${item}\n`)
for (const item of problems) process.stdout.write(`  ❌ ${item}\n`)
if (missing.length > 0 || problems.length > 0) process.exit(1)