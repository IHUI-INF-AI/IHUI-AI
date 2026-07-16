/* eslint-disable no-console */
/**
 * settings.json 模板生成端到端验证 — 验证 settings init --force 能正确生成模板
 * 把 IHUI_HOME 重定向到临时目录,避免污染真实 ~/.ihui/settings.json
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-settings-verify-'));

console.log('--- settings.json 模板生成端到端验证 ---');
console.log('1. 临时 HOME:', tmpHome);

const ihuiBinNew = path.join(cliRoot, 'dist', 'index.js');
const ihuiBinOld = path.join(cliRoot, 'dist', 'src', 'index.js');
const ihuiBin = fs.existsSync(ihuiBinNew) ? ihuiBinNew : ihuiBinOld;

// 重定向 HOME 到临时目录
const env = { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome };

// 1. 验证 init --force 生成模板
try {
  execSync(`node "${ihuiBin}" settings init --force`, { stdio: 'inherit', env });
} catch (err) {
  console.error('✗ settings init 失败:', err.message);
  cleanup();
  process.exit(1);
}

const settingsPath = path.join(tmpHome, '.ihui', 'settings.json');
if (!fs.existsSync(settingsPath)) {
  console.error(`✗ 模板未生成: ${settingsPath}`);
  cleanup();
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
console.log('2. 生成的 settings.json:');
console.log(JSON.stringify(settings, null, 2));

const requiredKeys = [
  'apiUrl',
  'defaultModel',
  'maxIterations',
  'auditEnabled',
  'allowDangerous',
  'planFirst',
  'enableMcp',
  'sandbox',
];
const missing = requiredKeys.filter((k) => !(k in settings));
if (missing.length > 0) {
  console.error(`✗ 模板缺少字段: ${missing.join(', ')}`);
  cleanup();
  process.exit(1);
}

if (!settings.sandbox || !Array.isArray(settings.sandbox.allowedPaths)) {
  console.error('✗ sandbox.allowedPaths 必须是数组');
  cleanup();
  process.exit(1);
}

// 2. 验证 settings path 命令
const expectedPath = path.join(tmpHome, '.ihui', 'settings.json');
try {
  const out = execSync(`node "${ihuiBin}" settings path`, { encoding: 'utf-8', env }).trim();
  if (out !== expectedPath) {
    console.error(`✗ settings path 输出不匹配: 期望 ${expectedPath}, 实际 ${out}`);
    cleanup();
    process.exit(1);
  }
  console.log(`3. settings path 正确: ${out}`);
} catch (err) {
  console.error('✗ settings path 失败:', err.message);
  cleanup();
  process.exit(1);
}

console.log('\n✅ settings.json 模板生成验证通过 (3 项检查)');
console.log('   ✓ settings init --force 正确写入 ~/.ihui/settings.json');
console.log(`   ✓ 模板包含 8 个必填字段 (apiUrl/defaultModel/.../sandbox)`);
console.log('   ✓ settings path 输出与实际路径一致');

cleanup();

function cleanup() {
  try {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    console.log('   (已清理临时目录)');
  } catch {
    // ignore
  }
}
