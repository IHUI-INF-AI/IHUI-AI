// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `flow` 命令的本地工作流编排(workflow-run)。
 *
 * 钉四件事:
 *   ① 声明文件的三类错误都在**跑任何命令之前**报错(读不到 / JSON 坏 / 字段缺失);
 *   ② 依赖拓扑真的生效(下游在上游之后);
 *   ③ **失败隔离**:非 optional 失败只取消下游,无关分支照跑;
 *   ④ optional 失败记 skipped,不阻断下游。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  parseDeclaration,
  runDeclaredWorkflow,
  WorkflowDeclarationError,
} from '../src/commands/workflow-run.js';

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-flow-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeDecl(obj: unknown, name = 'wf.json'): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

describe('parseDeclaration 校验(全部在跑命令之前)', () => {
  it('合法声明可解析', () => {
    const d = parseDeclaration('{"steps":[{"id":"a","run":"echo hi"}]}');
    expect(d.steps).toHaveLength(1);
    expect(d.steps[0]!.id).toBe('a');
  });

  it('JSON 坏 ⇒ 报错并说明', () => {
    expect(() => parseDeclaration('{oops')).toThrow(WorkflowDeclarationError);
  });

  it('顶层不是对象 ⇒ 报错', () => {
    for (const bad of ['[]', 'null', '"str"', '123']) {
      expect(() => parseDeclaration(bad)).toThrow(WorkflowDeclarationError);
    }
  });

  it('steps 为空或不是数组 ⇒ 报错', () => {
    for (const bad of ['{}', '{"steps":[]}', '{"steps":"x"}']) {
      expect(() => parseDeclaration(bad)).toThrow(WorkflowDeclarationError);
    }
  });

  it('缺 id / 缺 run ⇒ 报错并点名索引', () => {
    expect(() => parseDeclaration('{"steps":[{"run":"echo"}]}')).toThrow(/steps\[0\].*id/);
    expect(() => parseDeclaration('{"steps":[{"id":"a"}]}')).toThrow(/steps\[0\].*run/);
  });

  it('needs 不是字符串数组 ⇒ 报错', () => {
    expect(() => parseDeclaration('{"steps":[{"id":"a","run":"x","needs":[1]}]}')).toThrow(
      WorkflowDeclarationError,
    );
  });

  it('optional 不是布尔 ⇒ 报错', () => {
    expect(() => parseDeclaration('{"steps":[{"id":"a","run":"x","optional":"yes"}]}')).toThrow(
      WorkflowDeclarationError,
    );
  });
});

describe('runDeclaredWorkflow 真实执行', () => {
  it('线性依赖按序执行', async () => {
    const f = writeDecl({
      steps: [
        { id: 'a', run: 'echo A >> order.txt' },
        { id: 'b', run: 'echo B >> order.txt', needs: ['a'] },
      ],
    });
    const r = await runDeclaredWorkflow({ declarationPath: f });
    expect(r.succeeded).toBe(true);
    // Windows 下 echo 会带 \r;按行切后需 trim 每行,否则断言被行尾符干扰
    const order = fs
      .readFileSync(path.join(dir, 'order.txt'), 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim());
    expect(order).toEqual(['A', 'B']);
  });

  it('失败隔离:非 optional 失败只取消下游,无关分支照跑', async () => {
    const f = writeDecl({
      steps: [
        { id: 'root', run: 'echo R >> log.txt' },
        { id: 'bad', run: 'exit 1', needs: ['root'] },
        { id: 'down', run: 'echo DOWN >> log.txt', needs: ['bad'] },
        { id: 'free', run: 'echo FREE >> log.txt', needs: ['root'] },
      ],
    });
    const r = await runDeclaredWorkflow({ declarationPath: f });
    expect(r.succeeded).toBe(false);
    const log = fs.readFileSync(path.join(dir, 'log.txt'), 'utf8');
    expect(log).toContain('R');
    expect(log).toContain('FREE'); // 无关分支跑了
    expect(log).not.toContain('DOWN'); // 下游被取消
    expect(r.failed).toEqual(expect.arrayContaining(['bad', 'down']));
  });

  it('optional 失败 ⇒ skipped,不阻断下游', async () => {
    const f = writeDecl({
      steps: [
        { id: 'opt', run: 'exit 1', optional: true },
        { id: 'next', run: 'echo NEXT > next.txt', needs: ['opt'] },
      ],
    });
    const r = await runDeclaredWorkflow({ declarationPath: f });
    expect(r.succeeded).toBe(true); // optional 跳过不算失败
    expect(fs.readFileSync(path.join(dir, 'next.txt'), 'utf8').trim()).toBe('NEXT');
  });

  it('命令输出被捕获(供上层回报)', async () => {
    const f = writeDecl({ steps: [{ id: 'a', run: 'echo captured-output' }] });
    const r = await runDeclaredWorkflow({ declarationPath: f });
    expect(r.outputs.a?.stdout).toContain('captured-output');
  });

  it('声明文件不存在 ⇒ 报错(不静默跑空)', async () => {
    await expect(
      runDeclaredWorkflow({ declarationPath: path.join(dir, 'nope.json') }),
    ).rejects.toThrow(WorkflowDeclarationError);
  });

  it('cwd 字段生效(相对声明文件目录)', async () => {
    fs.mkdirSync(path.join(dir, 'sub'));
    const f = writeDecl({ steps: [{ id: 'a', run: 'pwd > where.txt', cwd: 'sub' }] });
    await runDeclaredWorkflow({ declarationPath: f });
    const where = fs.readFileSync(path.join(dir, 'sub', 'where.txt'), 'utf8');
    expect(where).toContain('sub');
  });
});
