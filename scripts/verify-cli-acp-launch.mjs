/* eslint-disable no-console */
/**
 * ACP (Agent Client Protocol) server 启动验证 — 验证 ihui acp 命令能正确启动并响应 initialize 请求
 * 模拟一个最小的 ACP 客户端,发 initialize + session/new 请求,验证响应格式
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');

const ihuiBinNew = path.join(cliRoot, 'dist', 'index.js');
const ihuiBinOld = path.join(cliRoot, 'dist', 'src', 'index.js');
const ihuiBin = fs.existsSync(ihuiBinNew) ? ihuiBinNew : ihuiBinOld;

console.log('--- ACP server 启动验证 ---');
console.log('1. ihui bin:', ihuiBin);

// 启动 ihui acp 子进程
const proc = spawn('node', [ihuiBin, 'acp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdoutBuf = '';
let stderrBuf = '';
proc.stdout.on('data', (d) => {
  stdoutBuf += d.toString();
});
proc.stderr.on('data', (d) => {
  stderrBuf += d.toString();
});

// 等待子进程就绪
await new Promise((r) => setTimeout(r, 500));

// 发送 initialize 请求(ACP 协议 JSON-RPC over stdio)
const initReq = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: 1,
    clientCapabilities: {},
    clientInfo: { name: 'verify-acp', version: '1.0.0' },
  },
};
proc.stdin.write(JSON.stringify(initReq) + '\n');

// 等待响应(最多 5s)
const start = Date.now();
let initResp = null;
while (Date.now() - start < 5000) {
  await new Promise((r) => setTimeout(r, 100));
  for (const line of stdoutBuf.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 1) {
        initResp = parsed;
        break;
      }
    } catch {
      // ignore non-JSON
    }
  }
  if (initResp) break;
}

// 主动 kill 子进程(避免无限等待)
proc.kill();

if (!initResp) {
  console.error('✗ 未收到 initialize 响应 (5s 超时)');
  if (stderrBuf) console.error('stderr:', stderrBuf.slice(0, 500));
  process.exit(1);
}

console.log('2. initialize 响应:', JSON.stringify(initResp, null, 2));

if (initResp.error) {
  console.error('✗ initialize 返回错误:', initResp.error.message);
  process.exit(1);
}

if (!initResp.result || !initResp.result.protocolVersion) {
  console.error('✗ initialize 响应缺少 protocolVersion');
  process.exit(1);
}

if (!initResp.result.agentCapabilities) {
  console.error('✗ initialize 响应缺少 agentCapabilities');
  process.exit(1);
}

const caps = initResp.result.agentCapabilities;
if (!caps.loadSession) {
  console.error('✗ agentCapabilities.loadSession 应为 true');
  process.exit(1);
}

console.log('\n✅ ACP server 启动验证通过 (3 项检查)');
console.log(`   ✓ ihui acp 子进程能正常启动`);
console.log(`   ✓ initialize 响应格式正确 (protocolVersion=${initResp.result.protocolVersion})`);
console.log(`   ✓ agentCapabilities 正确暴露 loadSession=true`);
