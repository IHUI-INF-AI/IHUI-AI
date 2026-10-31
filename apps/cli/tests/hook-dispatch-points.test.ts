// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 8 档事件派发点 · 第二笔接线(2026-10-31):fileChanged 与 configChange 两档从
// "载荷契约齐、无人派发"变成**真派发**。本册钉三格:
//  ① fileChanged —— runAgent 的 FsEventSource 每次 'event' 恰好派发一次
//     runHook('fileChanged', { filePath, fileChangeKind })(载荷字段与 HOOK_EVENT_KEYS
//     配套的 HookContext 单源一致);退订函数生效;接线行在位(形状锁,§0.9)。
//  ② configChange —— `ihui hooks trust/untrust` **写成功之后**各派发一次
//     (added / modified / removed);写失败/幂等未写/目标不存在 ⇒ 一条都不派
//     ("没发生的事不许报成事件",与 worktreeCreate 拒删不派发同纪律)。
//  ③ 未接档反向锁 —— **尚未接通**的档(cwdChanged/setup/elicitation/elicitationResult)
//     在仓库源码里不得出现假派发调用点(runHook('<档>' 零命中),防止"文档说接了、代码没有"
//     的回潮。〔2026-10-31 第三笔收窄〕instructionsLoaded 与 teammateIdle 已真接线,
//     从本锁名单移出,改由 hook-event-sources-third-leg.test.ts 正向钉住(锁只锁"没接的")。
// 运行链走 spy(不真跑钩子进程):本册判的是**派发**,不是执行面(执行面见
// hook-async-rewake / hooks-trust-* 各册)。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

import type * as HooksModule from '../src/hooks/index.js';

const runHookSpy = vi.hoisted(() =>
  vi.fn<(event: string, ctx: Record<string, unknown>) => Promise<{ proceed: boolean }>>(
    async () => ({ proceed: true }),
  ),
);

vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof HooksModule>();
  return { ...actual, runHook: runHookSpy };
});

// 内存假信任清单:测试绝不写真实 ~/.ihui/trusted-folders(与 hooks-trust-command.test.ts 同姿势)
const store = vi.hoisted(() => ({ folders: [] as string[] }));
const normalizeFolderPath = vi.hoisted(() => (p: string): string => {
  let n = path.resolve(p);
  if (n.length > 1 && (n.endsWith('/') || n.endsWith('\\'))) n = n.slice(0, -1);
  return process.platform === 'win32' ? n.toLowerCase() : n;
});

vi.mock('../src/hooks/trust.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/hooks/trust.js')>();
  return {
  ...actual,
  normalizeFolderPath,
  isFolderTrusted: (p: string) => store.folders.includes(normalizeFolderPath(p)),
  trustFolder: (p: string) => {
    const key = normalizeFolderPath(p);
    if (store.folders.includes(key)) return false;
    store.folders.push(key);
    return true;
  },
  untrustFolder: (p: string) => {
    const key = normalizeFolderPath(p);
    const before = store.folders.length;
    store.folders = store.folders.filter((f) => f !== key);
    return store.folders.length !== before;
  },
  listTrustedFolders: () => [...store.folders],
  isHookDisabled: () => false,
  listDisabledHooks: () => [],
  disableHook: () => false,
  enableHook: () => false,
  gateHook: () => ({ allowed: true }),
  };
});

import { attachHookFileChangedDispatch } from '../src/commands/agent.js';
import { FsEventSource } from '../src/fs-watcher/index.js';
import { registerHooksCommand } from '../src/commands/hooks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const agentSrc = fs.readFileSync(path.join(here, '../src/commands/agent.ts'), 'utf-8');
const EXPECTED_TRUST_LEDGER = path.join(os.homedir(), '.ihui', 'trusted-folders');

function mkTarget(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-dispatch-' + label + '-'));
}

function buildHooksProgram(): Command {
  const program = new Command();
  program.name('ihui').exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerHooksCommand(program);
  return program;
}

async function runHooks(program: Command, args: string[]): Promise<void> {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await program.parseAsync(['node', 'ihui', 'hooks', ...args]);
  } finally {
    infoSpy.mockRestore();
  }
}

beforeEach(() => {
  store.folders = [];
  runHookSpy.mockClear();
});

describe('① fileChanged:FsEventSource 事件 ⇒ 恰好一次派发', () => {
  it('监听源一次事件恰好派发一次 runHook fileChanged,载荷字段齐(filePath + fileChangeKind)', async () => {
    const root = mkTarget('fsw');
    const src = new FsEventSource(root, []);
    const detach = attachHookFileChangedDispatch(src);
    try {
      src.emit('event', { kind: 'modify', path: 'src/a.ts', timestamp: Date.now() });
      expect(runHookSpy).toHaveBeenCalledTimes(1);
      expect(runHookSpy).toHaveBeenCalledWith('fileChanged', {
        filePath: 'src/a.ts',
        fileChangeKind: 'modify',
      });
      // 档位与 fs-watcher 的 FsEventKind 同形:四种都能带着原档位派发
      for (const kind of ['create', 'delete', 'rename'] as const) {
        src.emit('event', { kind, path: `x/${kind}.ts`, timestamp: Date.now() });
      }
      expect(runHookSpy).toHaveBeenCalledTimes(4);
      const kinds = runHookSpy.mock.calls.map((c) => (c[1] as { fileChangeKind?: string }).fileChangeKind);
      expect(kinds).toEqual(['modify', 'create', 'delete', 'rename']);
      // 退订生效:摘线后再来事件不再派发
      detach();
      src.emit('event', { kind: 'modify', path: 'after-detach.ts', timestamp: Date.now() });
      expect(runHookSpy).toHaveBeenCalledTimes(4);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('形状锁:runAgent 在 fsEventSource.start() 之后接线(监听源真启动了才派发)', () => {
    const startIdx = agentSrc.indexOf('fsEventSource.start();');
    const attachIdx = agentSrc.indexOf('attachHookFileChangedDispatch(fsEventSource)');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(attachIdx).toBeGreaterThan(startIdx);
  });
});

describe('② configChange:信任清单真实写入 ⇒ 恰好一次;没写 ⇒ 一条不派', () => {
  it('hooks trust <已存在目录> 写成功 ⇒ configChange kind=added,载荷带清单路径与档位', async () => {
    const target = mkTarget('trust');
    await runHooks(buildHooksProgram(), ['trust', target]);
    expect(store.folders.length).toBe(1);
    expect(runHookSpy).toHaveBeenCalledTimes(1);
    expect(runHookSpy).toHaveBeenCalledWith('configChange', {
      configPath: EXPECTED_TRUST_LEDGER,
      configChangeKind: 'added',
    });
    fs.rmSync(target, { recursive: true, force: true });
  });

  it('再 trust 同一目录(假清单返回未写入)⇒ 不派发:"没发生的事不许报成事件"', async () => {
    const target = mkTarget('dup');
    const program = buildHooksProgram();
    await runHooks(program, ['trust', target]);
    expect(runHookSpy).toHaveBeenCalledTimes(1);
    await runHooks(program, ['trust', target]);
    // trustFolder 幂等返回 false ⇒ 第二次一条都不派
    expect(runHookSpy).toHaveBeenCalledTimes(1);
    fs.rmSync(target, { recursive: true, force: true });
  });

  it('hooks untrust 撤销成功 ⇒ configChange kind=removed 恰好一次;不在名单 ⇒ 不派', async () => {
    const target = mkTarget('untrust');
    const program = buildHooksProgram();
    await runHooks(program, ['trust', target]);
    expect(runHookSpy).toHaveBeenCalledTimes(1);
    await runHooks(program, ['untrust', target]);
    expect(runHookSpy).toHaveBeenCalledTimes(2);
    expect(runHookSpy).toHaveBeenLastCalledWith('configChange', {
      configPath: EXPECTED_TRUST_LEDGER,
      configChangeKind: 'removed',
    });
    // 已不在名单 ⇒ 第三次派发不许发生
    await runHooks(program, ['untrust', target]);
    expect(runHookSpy).toHaveBeenCalledTimes(2);
    fs.rmSync(target, { recursive: true, force: true });
  });

  it('trust 不存在的路径 ⇒ 拒绝且不派发(目标目录都不存在,谈不上配置变更)', async () => {
    await runHooks(buildHooksProgram(), ['trust', path.join(os.tmpdir(), 'no-such-dir-hr-20261031')]);
    expect(runHookSpy).toHaveBeenCalledTimes(0);
  });
});

describe('③ 反向锁:仍未接通的档不得出现假派发调用点', () => {
  // 这四档的状态见第三笔交付报告:cwdChanged 结构上无事件源、setup/elicitation 两档的
  // 真实点位在别席射程内 —— 接不了就不许装接了。已接的 instructionsLoaded / teammateIdle
  // 不在本名单(它们的正向断言见 hook-event-sources-third-leg.test.ts)。
  const unwiredEvents = [
    'cwdChanged',
    'setup',
    'elicitation',
    'elicitationResult',
  ] as const;

  it('全仓 cli 源码中 runHook 未接档派发调用零命中', () => {
    // 只扫 src(测试面出现档名字符串是本册自己的反向锁,不算派发)
    const srcRoot = path.join(here, '../src');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (ent.name.endsWith('.ts')) files.push(p);
      }
    };
    walk(srcRoot);
    for (const ev of unwiredEvents) {
      const call = `runHook('${ev}'`;
      const hits = files.filter((f) => fs.readFileSync(f, 'utf-8').includes(call));
      expect(hits, `event source not yet wired, but a dispatch call appeared: ${ev}`).toEqual([]);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
