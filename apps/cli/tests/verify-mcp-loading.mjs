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

// 1. 备份现有 mcp.json
const mcpExisted = fs.existsSync(mcpJsonPath);
const mcpBackup = mcpExisted ? fs.readFileSync(mcpJsonPath, 'utf-8') : null;
if (mcpExisted) {
  console.log('   检测到已有 mcp.json,先备份');
}

// 2. 用 mcp add 写入 mock server 配置
// tsconfig outDir 是 ./dist,include 是 src/**/*.ts,所以编译产物在 dist/src/index.js
const ihuiBin = path.join(cliRoot, 'dist', 'src', 'index.js');
try {
  execSync(`node "${ihuiBin}" mcp add mock node --args "${mockServer}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('✗ mcp add 失败:', err.message);
  process.exit(1);
}

// 3. 验证 mcp.json 内容
const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
console.log('3. mcp.json 内容:');
console.log(JSON.stringify(config, null, 2));
if (!config.servers || !config.servers.find((s) => s.name === 'mock')) {
  console.error('✗ mcp.json 缺少 mock server');
  cleanup();
  process.exit(1);
}

// 4. 用动态 import 调用 mcp-runtime.loadMcpTools
const mcpRuntimeUrl = pathToFileURL(path.join(cliRoot, 'dist', 'src', 'tools', 'mcp-runtime.js')).href;
let tools;
try {
  const mcpRuntime = await import(mcpRuntimeUrl);
  tools = await mcpRuntime.loadMcpTools({ workspacePath: process.cwd() });
} catch (err) {
  console.error('✗ loadMcpTools 失败:', err.message);
  cleanup();
  process.exit(1);
}

console.log(`4. loadMcpTools 返回 ${tools.length} 个工具:`);
for (const t of tools) {
  console.log(`   - ${t.name}: ${t.description} (必填: ${t.required.join(', ')})`);
}

// 5. 断言
const expected = ['echo', 'add_numbers'];
const actual = tools.map((t) => t.name).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error(`✗ 工具列表不匹配: 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
  cleanup();
  process.exit(1);
}

// 6. 端到端 tools/call 验证(add_numbers: 1+2=3)
const addTool = tools.find((t) => t.name === 'add_numbers');
const r = await addTool.execute({ a: 1, b: 2 }, { workspacePath: process.cwd() });
console.log(`5. tools/call add_numbers(1,2) →`, r);
if (!r.success || !r.output.includes('3')) {
  console.error('✗ tools/call 失败');
  cleanup();
  process.exit(1);
}

console.log('\n✅ MCP 工具加载端到端验证通过 (3 项检查)');
console.log('   ✓ mcp add 写入 ~/.ihui/mcp.json');
console.log('   ✓ loadMcpTools 连接 + tools/list 正确枚举 2 个工具');
console.log('   ✓ tools/call add_numbers 端到端调用成功');

cleanup();

function cleanup() {
  if (mcpExisted && mcpBackup !== null) {
    fs.writeFileSync(mcpJsonPath, mcpBackup, 'utf-8');
    console.log('   (已恢复原 mcp.json)');
  } else {
    // 移除 mock server 但保留 mcp.json
    if (fs.existsSync(mcpJsonPath)) {
      const cfg = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
      cfg.servers = (cfg.servers ?? []).filter((s) => s.name !== 'mock');
      fs.writeFileSync(mcpJsonPath, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('   (已从 mcp.json 移除 mock server)');
    }
  }
}
