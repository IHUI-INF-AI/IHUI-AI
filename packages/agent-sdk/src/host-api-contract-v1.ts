// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 宿主 API v1 的四个高频面(session / turn / tool / prompt)。
 *
 * 这是**契约数据**,不是第二套实现:方法名与 ACP/扩展面保持一致,
 * 事件全部引用 payload 类型,给三端构建比对一个逐字节稳定的基准。
 * 21 个服务的全量收口不在本轮;新增服务必须先登记类型与事件 payload。
 */

import type { HostApiContract } from './host-api-contract-types.js';

export const HOST_API_CONTRACT_V1: HostApiContract = {
  version: 1,
  types: [
    { name: 'Void', shape: 'void' },
    { name: 'SessionNewRequest', shape: 'object' },
    { name: 'SessionRef', shape: 'object' },
    { name: 'SessionSnapshot', shape: 'object' },
    { name: 'SessionUpdate', shape: 'union' },
    { name: 'TurnRef', shape: 'object' },
    { name: 'TurnPromptRequest', shape: 'object' },
    { name: 'TurnState', shape: 'object' },
    { name: 'ToolRef', shape: 'object' },
    { name: 'ToolInvokeRequest', shape: 'object' },
    { name: 'ToolList', shape: 'array' },
    { name: 'ToolStatus', shape: 'object' },
    { name: 'ToolResult', shape: 'object' },
    { name: 'PromptEnvelope', shape: 'object' },
  ],
  services: [
    {
      name: 'session',
      methods: [
        { name: 'session/new', requestType: 'SessionNewRequest', responseType: 'SessionRef' },
        { name: 'session/load', requestType: 'SessionRef', responseType: 'SessionSnapshot' },
        { name: 'x.ai/session/snapshot', requestType: 'SessionRef', responseType: 'SessionSnapshot' },
      ],
      events: [
        { name: 'session.created', payloadType: 'SessionRef' },
        { name: 'session.update', payloadType: 'SessionUpdate' },
        { name: 'session.snapshot.changed', payloadType: 'SessionSnapshot' },
      ],
    },
    {
      name: 'turn',
      methods: [
        { name: 'x.ai/turn/create', requestType: 'SessionRef', responseType: 'TurnRef' },
        { name: 'x.ai/turn/state', requestType: 'SessionRef', responseType: 'TurnState' },
        { name: 'x.ai/turn/transition', requestType: 'TurnRef', responseType: 'TurnState' },
      ],
      events: [
        { name: 'x.ai/turn.phase', payloadType: 'TurnState' },
        { name: 'x.ai/turn.payload', payloadType: 'SessionUpdate' },
      ],
    },
    {
      name: 'tool',
      methods: [
        { name: 'x.ai/mcp/listServers', requestType: 'Void', responseType: 'ToolList' },
        { name: 'x.ai/mcp/serverStatus', requestType: 'ToolRef', responseType: 'ToolStatus' },
        { name: 'x.ai/mcp/callTool', requestType: 'ToolInvokeRequest', responseType: 'ToolResult' },
        { name: 'x.ai/mcp/reconnect', requestType: 'ToolRef', responseType: 'Void' },
      ],
      events: [
        { name: 'tool.started', payloadType: 'ToolInvokeRequest' },
        { name: 'tool.completed', payloadType: 'ToolResult' },
      ],
    },
    {
      name: 'prompt',
      methods: [
        { name: 'session/prompt', requestType: 'TurnPromptRequest', responseType: 'PromptEnvelope' },
        { name: 'x.ai/prompt/estimate', requestType: 'TurnPromptRequest', responseType: 'Void' },
      ],
      events: [
        { name: 'prompt.delta', payloadType: 'SessionUpdate' },
        { name: 'prompt.completed', payloadType: 'PromptEnvelope' },
      ],
    },
  ],
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
