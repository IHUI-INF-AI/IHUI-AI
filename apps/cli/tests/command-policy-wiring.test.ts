// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * argv 命令策略求值器**是否真的接进了执行链**的回归(装车证明)。
 *
 * 立因:`command-policy/` 那套三态求值 40 例测试全绿,但 `tools/builtins.ts`(run_command)
 * 与 `tools/terminal.ts`(terminal_open)当时仍只调旧的两个函数
 * (`matchDangerousCommand` / `isReadonlyCommand`)—— 于是新登记的
 * `alwaysConfirm` / `destructive` 两档对真实执行链**零影响**:
 * `npm uninstall x`、`kubectl delete pod y`、`git rm f`、`find . -delete` 这些
 * 结构化档里 alwaysConfirm=Y 而旧危险档判 n 的命令,在 IHUI_YOLO + `--allow-dangerous`
 * 下会被确认回调直接橡皮图章放行、静默执行。"模块绿了但没人调用"是本仓反复踩的同一类事故。
 *
 * 三层证明,缺一层都可能出现"绿但没装车":
 *   ① 静态:两个调用方必须从 command-safety 取闸门,且不再直接调旧的两个函数;
 *   ② 行为:YOLO + alwaysConfirm 命令必须被拒(这是本次新增的那一条边);
 *   ③ 反向对照:同一条命令**不设 YOLO** 时仍走确认路径;普通危险档在 YOLO 下
 *      照旧可越(证明本票只收紧新档,没有顺手把逃生舱整体焊死)。
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run_command } from '../src/tools/builtins.js';
import { terminal_open } from '../src/tools/terminal.js';
import {
  describeCommandBlock,
  gateCommandExecution,
  isReadonlyCommand,
} from '../src/tools/command-safety.js';
import type { ToolContext } from '../src/tools/index.js';
import { setLocale } from '../src/i18n/index.js';

// 拦截文案已接进 t()/语言包(守门 70 拦硬编码中文),取词 locale 由系统语言推。
// 本文件断言的是中文子串,非中文机器 / CI 上会假红 —— 显式钉住 zh-CN
// (同 branch-ops.test.ts 的既有夹具),不放宽断言。
beforeAll(() => {
  setLocale('zh-CN');
});

const here = path.dirname(fileURLToPath(import.meta.url));

/** 读调用方源码(按文件名定位,不写死盘符) */
function sourceOf(rel: string): string {
  return readFileSync(path.resolve(here, '..', 'src', rel), 'utf-8');
}

/** 结构化 alwaysConfirm 而旧危险档判 n 的命令:这一批正是"接上前完全没被拦过"的那一类 */
const ALWAYS_CONFIRM_ONLY = [
  'npm uninstall left-pad',
  'pnpm remove foo',
  'cargo clean',
  'kubectl delete pod nginx-1',
  'git push --delete origin stale-branch',
  'git rm secret.env',
  'find . -delete',
];

interface Probe {
  called: number;
}

function ctxWithConfirm(allow: boolean, probe: Probe): ToolContext {
  return {
    workspacePath: here,
    confirmDangerous: async () => {
      probe.called += 1;
      return allow;
    },
  };
}

describe('① 静态:两个执行链调用方都从同一个闸门取判定', () => {
  for (const file of ['tools/builtins.ts', 'tools/terminal.ts']) {
    it(`${file} import 了 gateCommandExecution + describeCommandBlock`, () => {
      const src = sourceOf(file);
      // 按 import 语句那一行判,而不是"全文含该标识符" —— 注释里提一句不算装车
      const importLine = src
        .split('\n')
        .find((line) => line.includes("from './command-safety.js'"));
      expect(importLine).toBeDefined();
      expect(importLine).toContain('gateCommandExecution');
      expect(importLine).toContain('describeCommandBlock');
    });

    it(`${file} 不再直接调旧的两个函数(判据只留一处实现)`, () => {
      const src = sourceOf(file);
      expect(src).not.toMatch(/matchDangerousCommand\s*\(/);
      expect(src).not.toMatch(/isReadonlyCommand\s*\(/);
      // 而且必须真的调用了闸门(只有 import 没有调用点 = 装了一半)
      expect(src).toMatch(/gateCommandExecution\s*\(/);
      expect(src).toMatch(/describeCommandBlock\s*\(/);
    });
  }
});

describe('② 行为:alwaysConfirm 档在真实执行链上生效', () => {
  let origYolo: string | undefined;
  beforeEach(() => {
    origYolo = process.env.IHUI_YOLO;
    process.env.IHUI_YOLO = '1';
  });
  afterEach(() => {
    if (origYolo === undefined) delete process.env.IHUI_YOLO;
    else process.env.IHUI_YOLO = origYolo;
  });

  for (const command of ALWAYS_CONFIRM_ONLY) {
    it(`run_command 在 IHUI_YOLO 下仍拒执行:${command}`, async () => {
      const probe: Probe = { called: 0 };
      const result = await run_command.execute({ command }, ctxWithConfirm(true, probe));
      expect(result.success).toBe(false);
      expect(result.output).toContain('永远需要确认');
      // 没走到确认回调 = 拦在闸门本身,而不是靠某个回调"恰好"返回 false
      expect(probe.called).toBe(0);
    });
  }

  it('terminal_open 同一档同样拒(两个调用方共用一份判据)', async () => {
    const probe: Probe = { called: 0 };
    const result = await terminal_open.execute(
      { command: 'git rm secret.env' },
      ctxWithConfirm(true, probe),
    );
    expect(result.success).toBe(false);
    expect(result.output).toContain('永远需要确认');
    expect(probe.called).toBe(0);
  });
});

describe('③ 反向对照:本票只收紧新档,没有顺手改旧档语义', () => {
  let origYolo: string | undefined;
  beforeEach(() => {
    origYolo = process.env.IHUI_YOLO;
  });
  afterEach(() => {
    if (origYolo === undefined) delete process.env.IHUI_YOLO;
    else process.env.IHUI_YOLO = origYolo;
  });

  it('同一条 alwaysConfirm 命令,不设 YOLO 时仍走确认路径(不是全面禁)', async () => {
    // 刻意只测"确认被拒"这一半:另一半(确认放行)会真的执行一次删除类命令,
    // 测试里没有沙箱可撤销的落点 —— probe.called===1 已经足够证明拦点是闸门而非回调。
    delete process.env.IHUI_YOLO;
    const probe: Probe = { called: 0 };
    const denied = await run_command.execute({ command: 'cargo clean' }, ctxWithConfirm(false, probe));
    expect(probe.called).toBe(1);
    expect(denied.success).toBe(false);
    expect(denied.error).toContain('被拒绝');
    expect(denied.output ?? '').not.toContain('永远需要确认');
  });

  it('普通危险档(非 alwaysConfirm 子集)在 YOLO 下照旧可越', async () => {
    // `rm -rf /tmp/x`:命中旧危险档,但语法表没把它标成 alwaysConfirm
    // (标它的是 `rm --no-preserve-root`)—— 用它证明本票没有把逃生舱整体焊死。
    process.env.IHUI_YOLO = '1';
    const probe: Probe = { called: 0 };
    const result = await run_command.execute(
      { command: 'rm -rf /tmp/x' },
      ctxWithConfirm(false, probe),
    );
    // 命中危险档 → YOLO 放行 → 交给确认;确认返回 false 才拒
    expect(probe.called).toBe(1);
    expect(result.output).not.toContain('永远需要确认');
  });

  it('只读命令仍然免确认(YOLO 与否都一样,免确认面没被缩到只剩 YOLO)', async () => {
    delete process.env.IHUI_YOLO;
    const gate = gateCommandExecution('git status');
    expect(gate.autoApprovable).toBe(true);
    expect(describeCommandBlock(gate, false)).toBeNull();
  });
});

describe('④ 闸门与旧函数的关系:只收紧不放宽', () => {
  const corpus = [
    ...ALWAYS_CONFIRM_ONLY,
    'git status',
    'ls -la',
    'date',
    'rm -rf /tmp/x',
    'git reset --keep HEAD',
    'kubectl delete pod nginx-1',
    '',
    '   ',
  ];

  for (const command of corpus) {
    it(`autoApprovable ⇒ isReadonlyCommand:${command || '(空命令)'}`, () => {
      const gate = gateCommandExecution(command);
      if (gate.autoApprovable) expect(isReadonlyCommand(command)).toBe(true);
      // 空/空白命令不可能拿到免确认资格
      if (!command.trim()) expect(gate.autoApprovable).toBe(false);
    });
  }

  it('describeCommandBlock 的三档组合各自唯一落点', () => {
    const rm = gateCommandExecution('git reset --hard HEAD~1'); // 危险档 + alwaysConfirm 同时命中
    expect(describeCommandBlock(rm, false)).toContain('危险命令被拦截');
    expect(describeCommandBlock(rm, true)).toContain('永远需要确认');
    const uninstall = gateCommandExecution('npm uninstall left-pad'); // 只命中新档
    expect(describeCommandBlock(uninstall, false)).toBeNull();
    expect(describeCommandBlock(uninstall, true)).toContain('永远需要确认');
    const status = gateCommandExecution('git status');
    expect(describeCommandBlock(status, false)).toBeNull();
    expect(describeCommandBlock(status, true)).toBeNull();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
