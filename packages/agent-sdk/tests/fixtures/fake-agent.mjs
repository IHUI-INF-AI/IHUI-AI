#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 测试用 ACP agent fixture —— 只实现公开的 NDJSON JSON-RPC 帧，
 * 不 import 本仓任何源码，保证 SDK 测试验证的是线协议而不是实现耦合。
 *
 * 用法: node fake-agent.mjs <success|bad-line|exit-nonzero|hang>
 */

import { createInterface } from 'node:readline';

const scenario = process.argv[2] ?? 'success';
const sessionId = 's1';
let permissionSeq = 100;
const pendingPermissions = new Map();

const write = (message) => {
  process.stdout.write(`${JSON.stringify(message)}\n`);
};
const respond = (id, result) => write({ jsonrpc: '2.0', id, result });
const notify = (method, params) => write({ jsonrpc: '2.0', method, params });
const askClient = (id, method, params) => write({ jsonrpc: '2.0', id, method, params });

function chunk(text) {
  notify('session/update', {
    sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    },
  });
}

function requestPermission(toolCallId, title) {
  const id = permissionSeq;
  permissionSeq += 1;
  return new Promise((resolve) => {
    pendingPermissions.set(id, resolve);
    askClient(id, 'session/request_permission', {
      sessionId,
      toolCall: {
        toolCallId,
        title,
        kind: 'execute',
        status: 'pending',
        rawInput: { command: 'echo hi' },
      },
      options: [
        { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
        { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
      ],
    });
  });
}

async function runPrompt(message) {
  if (scenario === 'bad-line') {
    process.stdout.write('this-is-not-json\n');
  }
  if (scenario === 'exit-nonzero') {
    process.stderr.write('fixture exploded\n', () => process.exit(3));
    return;
  }
  if (scenario === 'hang') {
    return;
  }

  chunk('hello');
  notify('session/update', {
    sessionId,
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 'tc1',
      title: 'shell',
      kind: 'execute',
      status: 'in_progress',
      rawInput: { command: 'echo hi' },
      content: [],
    },
  });

  const outcome = await requestPermission('tc1', 'shell');
  const picked = outcome?.outcome?.outcome === 'selected' ? outcome.outcome.optionId : null;
  const text = picked === 'allow' ? 'approved' : picked === 'deny' ? 'denied' : 'cancelled';

  notify('session/update', {
    sessionId,
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'tc1',
      title: 'shell',
      status: picked === 'allow' ? 'completed' : 'failed',
      content: [{ type: 'content', content: { type: 'text', text } }],
      rawOutput: { text },
    },
  });
  chunk(`final:${text}`);
  respond(message.id, { stopReason: 'end_turn' });
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === 'initialize') {
    respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } });
    return;
  }
  if (message.method === 'session/new') {
    respond(message.id, { sessionId });
    return;
  }
  if (message.method === 'session/prompt') {
    void runPrompt(message);
    return;
  }
  if (message.method === 'session/cancel') {
    return;
  }
  if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
    const resolve = pendingPermissions.get(message.id);
    if (resolve) {
      pendingPermissions.delete(message.id);
      resolve(message.result);
    }
  }
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
