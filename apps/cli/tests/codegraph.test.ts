/**
 * Codegraph 工具测试 — 依赖图 / 定义跳转 / 引用查找
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { codegraph, goto_definition, find_references } from '../src/tools/codegraph.js';
import type { ToolContext } from '../src/tools/index.js';

describe('Codegraph 工具', () => {
  let workspace: string;
  let ctx: ToolContext;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-codegraph-'));
    ctx = { workspacePath: workspace };
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function writeFile(rel: string, content: string): void {
    const abs = path.join(workspace, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }

  describe('codegraph', () => {
    it('空工作区返回提示', async () => {
      const result = await codegraph.execute({}, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('无代码文件');
    });

    it('扫描 .ts/.tsx/.js/.jsx 文件', async () => {
      writeFile('a.ts', "import { b } from './b';\n");
      writeFile('b.tsx', "export const b = 1;\n");
      writeFile('c.js', "const c = 2;\n");
      writeFile('d.jsx', "export default () => null;\n");
      writeFile('ignore.txt', 'should be ignored\n');
      const result = await codegraph.execute({}, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('代码文件: 4');
    });

    it('忽略 node_modules / dist / .git 等目录', async () => {
      writeFile('src/main.ts', "import { x } from './x';\n");
      writeFile('src/x.ts', 'export const x = 1;\n');
      writeFile('node_modules/pkg/index.ts', "export const y = 2;\n");
      writeFile('dist/build.ts', "export const z = 3;\n");
      const result = await codegraph.execute({}, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('代码文件: 2');
    });

    it('解析相对 import 依赖', async () => {
      writeFile('src/index.ts', "import { foo } from './utils';\nimport { bar } from './helpers/bar';\n");
      writeFile('src/utils.ts', 'export const foo = 1;\n');
      writeFile('src/helpers/bar.ts', 'export const bar = 2;\n');
      const result = await codegraph.execute({ file: 'src/index.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('src/utils.ts');
      expect(result.output).toContain('src/helpers/bar.ts');
      expect(result.output).toContain('[relative]');
    });

    it('解析裸模块 import 为 bare', async () => {
      writeFile('index.ts', "import React from 'react';\nimport _ from 'lodash';\n");
      const result = await codegraph.execute({ file: 'index.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('react');
      expect(result.output).toContain('lodash');
      expect(result.output).toContain('[bare]');
    });

    it('解析 dynamic import', async () => {
      writeFile('index.ts', "const mod = await import('./lazy');\n");
      writeFile('lazy.ts', 'export const x = 1;\n');
      const result = await codegraph.execute({ file: 'index.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('lazy.ts');
      expect(result.output).toContain('[dynamic]');
    });

    it('解析 require() 调用', async () => {
      writeFile('index.cjs', "const fs = require('fs');\n");
      const result = await codegraph.execute({ file: 'index.cjs' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('fs');
    });

    it('反向依赖查询', async () => {
      writeFile('a.ts', "import { x } from './b';\n");
      writeFile('b.ts', 'export const x = 1;\n');
      writeFile('c.ts', "import { x } from './b';\n");
      const result = await codegraph.execute({ file: 'b.ts', reverse: true }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('c.ts');
      expect(result.output).toContain('←');
    });

    it('省略扩展名解析', async () => {
      writeFile('index.ts', "import { x } from './mod';\n");
      writeFile('mod.ts', 'export const x = 1;\n');
      const result = await codegraph.execute({ file: 'index.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('mod.ts');
    });

    it('index 文件解析', async () => {
      writeFile('index.ts', "import { x } from './mod';\n");
      writeFile('mod/index.ts', 'export const x = 1;\n');
      const result = await codegraph.execute({ file: 'index.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('mod/index.ts');
    });

    it('全局统计输出', async () => {
      writeFile('a.ts', "import { x } from './b';\nimport { y } from './c';\n");
      writeFile('b.ts', 'export const x = 1;\n');
      writeFile('c.ts', "import { z } from './b';\nexport const y = 2;\n");
      const result = await codegraph.execute({}, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('代码文件: 3');
      expect(result.output).toContain('依赖边:');
      expect(result.output).toContain('依赖最多');
      expect(result.output).toContain('被依赖最多');
      expect(result.output).toContain('b.ts'); // b 被 a 和 c 依赖
    });

    it('文件不存在时返回无依赖', async () => {
      writeFile('a.ts', "import { x } from './b';\n");
      const result = await codegraph.execute({ file: 'nonexistent.ts' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('无依赖');
    });
  });

  describe('goto_definition', () => {
    it('缺少 symbol 参数报错', async () => {
      const result = await goto_definition.execute({}, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少参数');
    });

    it('非法标识符报错', async () => {
      const result = await goto_definition.execute({ symbol: '123invalid' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('合法标识符');
    });

    it('查找 function 定义', async () => {
      writeFile('a.ts', 'export function foo() { return 1; }\n');
      const result = await goto_definition.execute({ symbol: 'foo' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('[function]');
      expect(result.output).toContain('foo');
    });

    it('查找 const 定义', async () => {
      writeFile('a.ts', 'export const bar = 42;\n');
      const result = await goto_definition.execute({ symbol: 'bar' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[const]');
    });

    it('查找 class 定义', async () => {
      writeFile('a.ts', 'export class MyClass { x: number = 0; }\n');
      const result = await goto_definition.execute({ symbol: 'MyClass' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[class]');
    });

    it('查找 interface 定义', async () => {
      writeFile('types.ts', 'export interface User { id: string; }\n');
      const result = await goto_definition.execute({ symbol: 'User' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[interface]');
    });

    it('查找 type 定义', async () => {
      writeFile('types.ts', 'export type ID = string;\n');
      const result = await goto_definition.execute({ symbol: 'ID' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[type]');
    });

    it('查找 enum 定义', async () => {
      writeFile('types.ts', 'export enum Color { Red, Green, Blue }\n');
      const result = await goto_definition.execute({ symbol: 'Color' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[enum]');
    });

    it('多文件多定义命中', async () => {
      writeFile('a.ts', 'export function helper() { return 1; }\n');
      writeFile('b.ts', 'function helper() { return 2; }\n');
      const result = await goto_definition.execute({ symbol: 'helper' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('b.ts');
      expect(result.output).toContain('2 处');
    });

    it('未找到返回提示', async () => {
      writeFile('a.ts', 'export const x = 1;\n');
      const result = await goto_definition.execute({ symbol: 'nonexistent' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('未找到');
    });
  });

  describe('find_references', () => {
    it('缺少 symbol 参数报错', async () => {
      const result = await find_references.execute({}, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少参数');
    });

    it('查找 import 引用', async () => {
      writeFile('def.ts', 'export const myVar = 1;\n');
      writeFile('use.ts', "import { myVar } from './def';\nconsole.log(myVar);\n");
      const result = await find_references.execute({ symbol: 'myVar' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('use.ts');
      expect(result.output).toContain('[import]');
      expect(result.output).toContain('[usage]');
    });

    it('查找代码内使用(非 import)', async () => {
      writeFile('a.ts', 'const x = 1;\nconsole.log(x);\nconsole.log(x);\n');
      // x 是定义,被排除;但 console.log(x) 是使用
      const result = await find_references.execute({ symbol: 'x' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('[usage]');
    });

    it('排除定义本身', async () => {
      writeFile('a.ts', 'export function foo() {}\nfoo();\n');
      const result = await find_references.execute({ symbol: 'foo' }, ctx);
      expect(result.success).toBe(true);
      // 应只算引用行 foo(); 不算定义行
      const lines = result.output.split('\n').filter((l) => l.includes('a.ts:'));
      // 定义行被排除,只有 foo() 调用算引用
      expect(lines.length).toBe(1);
    });

    it('无引用时提示', async () => {
      writeFile('a.ts', 'export const unused = 1;\n');
      const result = await find_references.execute({ symbol: 'unused' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('无引用');
    });

    it('跨文件引用统计', async () => {
      writeFile('def.ts', 'export const shared = 42;\n');
      writeFile('a.ts', "import { shared } from './def';\nconsole.log(shared);\n");
      writeFile('b.ts', "import { shared } from './def';\nconst y = shared + 1;\n");
      const result = await find_references.execute({ symbol: 'shared' }, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('b.ts');
      expect(result.output).toMatch(/\d+ import/);
      expect(result.output).toMatch(/\d+ usage/);
    });
  });

  describe('集成场景', () => {
    it('完整工作流:定义 → 引用 → 依赖图', async () => {
      // 模拟一个小项目
      writeFile('src/types.ts', 'export interface User { id: string; name: string; }\n');
      writeFile('src/api.ts', "import { User } from './types';\nexport function getUser(id: string): User { return { id, name: 'x' }; }\n");
      writeFile('src/main.ts', "import { getUser } from './api';\nimport { User } from './types';\nconst u: User = getUser('1');\n");

      // 1. 查找 User 定义
      const defResult = await goto_definition.execute({ symbol: 'User' }, ctx);
      expect(defResult.success).toBe(true);
      expect(defResult.output).toContain('src/types.ts');
      expect(defResult.output).toContain('[interface]');

      // 2. 查找 User 引用
      const refResult = await find_references.execute({ symbol: 'User' }, ctx);
      expect(refResult.success).toBe(true);
      expect(refResult.output).toContain('src/api.ts');
      expect(refResult.output).toContain('src/main.ts');

      // 3. 查看 main.ts 依赖图
      const graphResult = await codegraph.execute({ file: 'src/main.ts' }, ctx);
      expect(graphResult.success).toBe(true);
      expect(graphResult.output).toContain('src/api.ts');
      expect(graphResult.output).toContain('src/types.ts');
    });
  });
});
