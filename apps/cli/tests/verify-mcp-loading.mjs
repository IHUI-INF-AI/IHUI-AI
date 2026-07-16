/* eslint-disable no-console */
/**
 * MCP 工具实际加载端到端验证 — 一次性脚本,验证 mcp-runtime 能正确:
 *   1. 读取 ~/.ihui/mcp.json
 *   2. spawn mock MCP server (stdio transport)
 *   3. JSON-RPC initialize → notifications/initialized → tools/list
 *   4. 将 MCP 工具转为 Tool 接口
 *   5. tools/call 转发正常
 *
 * 验证后会清理 ~/.ihui/mcp.json 残留配置。
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');
const mockServer = path.join(__dirname, 'mock-mcp-server.cjs');
const home = os.homedir();
const mcpJsonPath = path.join(home, '.ihui', 'mcp.json');

console.log('--- MCP 工具加载端到端验证 ---');
console.log('1. mock MCP server:', mockServer);
console.log('2. ~/.ihui/mcp.json:', mcpJsonPath);

const mcpExisted = fs.existsSync(mcpJsonPath);
const mcpBackup = mcpExisted ? fs.readFileSync(mcpJsonPath, 'utf-8') : null;
if (mcpExisted) {
  console.log('   检测到已有 mcp.json,先备份');
}

const ihuiBinNew = path.join(cliRoot, 'dist', 'index.js');
const ihuiBinOld = path.join(cliRoot, 'dist', 'src', 'index.js');
const ihuiBin = fs.existsSync(ihuiBinNew) ? ihuiBinNew : ihuiBinOld;
console.log('3. ihui bin:', ihuiBin);
try {
  execSync(`node "${ihuiBin}" mcp add mock node --args "${mockServer}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('✗ mcp add 失败:', err.message);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
console.log('4. mcp.json 内容:');
console.log(JSON.stringify(config, null, 2));
if (!config.servers || !config.servers.find((s) => s.name === 'mock')) {
  console.error('✗ mcp.json 缺少 mock server');
  cleanup();
  process.exit(1);
}

const mcpRuntimeNew = path.join(cliRoot, 'dist', 'tools', 'mcp-runtime.js');
const mcpRuntimeOld = path.join(cliRoot, 'dist', 'src', 'tools', 'mcp-runtime.js');
const mcpRuntimePath = fs.existsSync(mcpRuntimeNew) ? mcpRuntimeNew : mcpRuntimeOld;
const mcpRuntimeUrl = pathToFileURL(mcpRuntimePath).href;
let tools;
try {
  const mcpRuntime = await import(mcpRuntimeUrl);
  tools = await mcpRuntime.loadMcpTools({ workspacePath: process.cwd() });
} catch (err) {
  console.error('✗ loadMcpTools 失败:', err.message);
  cleanup();
  process.exit(1);
}

console.log(`5. loadMcpTools 返回 ${tools.length} 个工具:`);
for (const t of tools) {
  console.log(`   - ${t.name}: ${t.description} (必填: ${t.required.join(', ')})`);
}

const expected = ['add_numbers', 'echo'];
const actual = tools.map((t) => t.name).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error(`✗ 工具列表不匹配: 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
  cleanup();
  process.exit(1);
}

const addTool = tools.find((t) => t.name === 'add_numbers');
const r = await addTool.execute({ a: 1, b: 2 }, { workspacePath: process.cwd() });
console.log(`6. tools/call add_numbers(1,2) →`, r);
if (!r.success || !r.output.includes('3')) {
  console.error('✗ tools/call 失败');
  cleanup();
  process.exit(1);
}

const echoTool = tools.find((t) => t.name === 'echo');
const r2 = await echoTool.execute({ text: 'hello-mcp' }, { workspacePath: process.cwd() });
console.log(`7. tools/call echo('hello-mcp') →`, r2);
if (!r2.success || !r2.output.includes('hello-mcp')) {
  console.error('✗ tools/call echo 失败');
  cleanup();
  process.exit(1);
}

console.log('\n✅ MCP 工具加载端到端验证通过 (4 项检查)');
console.log('   ✓ mcp add 写入 ~/.ihui/mcp.json');
console.log('   ✓ loadMcpTools 连接 + tools/list 正确枚举 2 个工具');
console.log('   ✓ tools/call add_numbers 端到端调用成功 (1+2=3)');
console.log('   ✓ tools/call echo 端到端调用成功 (回显)');

cleanup();

function cleanup() {
  if (mcpExisted && mcpBackup !== null) {
    fs.writeFileSync(mcpJsonPath, mcpBackup, 'utf-8');
    console.log('   (已恢复原 mcp.json)');
  } else {
    if (fs.existsSync(mcpJsonPath)) {
      const cfg = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
      cfg.servers = (cfg.servers ?? []).filter((s) => s.name !== 'mock');
      fs.writeFileSync(mcpJsonPath, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('   (已从 mcp.json 移除 mock server)');
    }
  }
}
