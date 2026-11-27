// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ITCP 契约注册表导出器的锁(2026-11-27, T1.1)。
//
// 钉四件事:
//   ① 导出物结构合法(schema / 每条工具都有可判定的 permission);
//   ② 幂等:同一工作树跑两次 --json,输出逐字节相同(导出物要能入库做 diff);
//   ③ --check 能发现"源码变了注册表没重生成";
//   ④ contractFor / 常量引用两种动态装配的语义与 TS 源码锚一致 —— 改 ai-bridge.ts:54
//      的 requiresApproval/effectScope/预算而不改导出器,这条必须红。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const EXPORT = resolve(REPO, 'scripts/itcp-export.mjs');
const REGISTRY = resolve(REPO, 'protocol/itcp-registry.json');

function runExport(args) {
  return execFileSync(process.execPath, [EXPORT, ...args], { cwd: REPO, encoding: 'utf8' });
}

describe('itcp-export: 结构与判定面完整性', () => {
  test('schema 与工具计数', () => {
    const registry = JSON.parse(runExport(['--json']));
    assert.equal(registry.schema, 'itcp-registry/v0.1');
    assert.ok(registry.tools.length > 0, '至少要导出到工具');
    assert.equal(registry.source.registeredTools, registry.tools.length);
  });

  test('每条工具都有可判定的 permission(未判定必须显式标 dynamic-unresolved)', () => {
    const registry = JSON.parse(runExport(['--json']));
    for (const tool of registry.tools) {
      if (tool.contractForm === 'dynamic-unresolved') {
        assert.equal(tool.permission, null, `${tool.name}: 未判定不得伪造 permission`);
        continue
      }
      assert.ok(tool.permission, `${tool.name}: 有契约形态却读不出 permission`)
      assert.ok(tool.permission.effectScope, `${tool.name}: 缺 effectScope`)
      assert.equal(typeof tool.permission.requiresApproval, 'boolean', `${tool.name}: requiresApproval 必须是显式布尔`)
    }
  });
});

describe('itcp-export: 幂等与同步锁', () => {
  test('跑两次 --json 逐字节相同', () => {
    const a = runExport(['--json']);
    const b = runExport(['--json']);
    assert.equal(a, b);
  });

  test('--check 对已同步的注册表 exit 0', () => {
    // 先把盘上文件刷成最新,再 check —— 只验"同步时不报红",不验"不同步时能报红"(见下一条)
    runExport([]);
    assert.doesNotThrow(() => runExport(['--check']));
  });

  test('--check 在注册表被篡改时 exit 1', () => {
    const original = readFileSync(REGISTRY, 'utf8');
    try {
      // 写真篡改:把注册表里第一个工具的 riskLevel 换掉
      const tampered = original.replace('"riskLevel": "read"', '"riskLevel": "dangerous"');
      assert.notEqual(tampered, original, '篡改必须真的改到内容');
      writeFileSync(REGISTRY, tampered, 'utf8');
      assert.throws(
        () => execFileSync(process.execPath, [EXPORT, '--check'], { cwd: REPO, encoding: 'utf8', stdio: 'pipe' }),
        (error) => error?.status === 1,
        '不同步必须 exit 1',
      );
    } finally {
      writeFileSync(REGISTRY, original, 'utf8');
    }
  });
});

describe('itcp-export: 动态装配语义与 TS 源码锚', () => {
  test('contractFor 三档语义与 ai-bridge.ts 锚一致', () => {
    const src = readFileSync(resolve(REPO, 'apps/cli/src/tools/ai-bridge.ts'), 'utf8');
    // 源码锚:这三行是导出器复刻的依据,改了就必须同步导出器
    assert.match(src, /effectScope:\s*'network'\s*as const/, 'ai-bridge 的 effectScope 锚变了')
    assert.match(src, /requiresApproval:\s*dangerous/, 'ai-bridge 的 requiresApproval 锚变了')
    assert.match(src, /\.\.\.\(dangerous \? \{ alwaysAsk: true \} : \{\}\)/, 'ai-bridge 的 alwaysAsk 锚变了')

    const registry = JSON.parse(runExport(['--json']));
    const byName = new Map(registry.tools.map((t) => [t.name, t]))
    const readTool = byName.get('ai_read');
    const deleteTool = byName.get('ai_delete');
    assert.ok(readTool && deleteTool, 'ai_read / ai_delete 必须在注册表里');
    assert.equal(readTool.permission.effectScope, 'network');
    assert.equal(readTool.permission.requiresApproval, false);
    assert.equal(deleteTool.permission.requiresApproval, true);
    assert.equal(deleteTool.permission.alwaysAsk, true);
  });

  test('常量引用形态解析到同文件常量(ai_task_run)', () => {
    const src = readFileSync(resolve(REPO, 'apps/cli/src/tools/ai-task-template-tools.ts'), 'utf8');
    assert.match(src, /const WRITE_CONTRACT/, '常量定义锚变了')
    const registry = JSON.parse(runExport(['--json']));
    const tool = registry.tools.find((t) => t.name === 'ai_task_run');
    assert.ok(tool, 'ai_task_run 必须在注册表里');
    assert.equal(tool.contractForm, 'constant-ref');
    assert.ok(tool.permission, 'constant-ref 必须解出 permission');
  });

  test('关键工具字段锚(read_file / run_command)', () => {
    const registry = JSON.parse(runExport(['--json']));
    const byName = new Map(registry.tools.map((t) => [t.name, t]))
    const readFile = byName.get('read_file');
    const runCommand = byName.get('run_command');
    assert.ok(readFile && runCommand);
    assert.equal(readFile.permission.permissionKey, 'fs.read');
    assert.equal(readFile.permission.effectScope, 'workspace');
    assert.equal(runCommand.permission.permissionKey, 'cmd.run');
    assert.equal(runCommand.permission.effectScope, 'system');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
