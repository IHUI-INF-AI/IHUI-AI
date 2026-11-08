// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 8 档事件派发点 · 第四笔接线(2026-11-06):此前"结构上无事件源"的六档全部接通。
 *
 * 与前三册不同,本册走**真派发**而非 spy —— 每个用例都在临时目录写一份 hooks.json,
 * 钩子进程读 IHUI_* 载荷并追加一行 JSON 到 marker 日志。判的是"钩子确实被执行且载荷正确",
 * 不是"注册在表里就算"。
 *
 *  ① setup —— `writeAgentsMd` 在**真正写 AGENTS.md 之前**派发一次,setupSource=init;
 *     钩子进程当时看得到"文件还不存在"(前置而不是事后补报)。
 *  ② cwdChanged —— ACP `newSession` 的工作区切换才派发(首个会话 / 同目录再开会话都不派),
 *     载荷带 cwdFrom + cwdTo 两端。
 *  ③ elicitation / elicitationResult —— `ask_user_question` 弹窗前派发 elicitation,
 *     回答后以同一个 elicitationId 落 accept;用户在 prompt 里取消落 cancel,
 *     且**原始错误原样抛给调用链**。
 *  ④ postToolUseFailure / permissionDenied —— 只在 `executeToolCall` 统一出口派发,
 *     拒绝与失败互斥;钩子非成功终态喊到 stderr(surfaceHookOutcome),不改工具结果;
 *     抛错路径先补 postToolUseFailure 再 rethrow 原始错误。
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Tool, ToolContract } from '../src/tools/index.js';
import { clearTools, executeToolCall, registerTools, resetRateLimiter } from '../src/tools/index.js';
import { ask_user_question } from '../src/tools/ask-user.js';
import { writeAgentsMd } from '../src/commands/template.js';
import { IhuiAcpAgent } from '../src/acp/server.js';

const inquirerState = vi.hoisted(() => ({
  impl: null as null | ((questions: unknown) => Promise<Record<string, unknown>>),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: async (questions: unknown) => {
      if (!inquirerState.impl) throw new Error('inquirer mock 未设置实现');
      return inquirerState.impl(questions);
    },
  },
}));

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const TMP_ROOT = path.join(ROOT, '.ihui-agent', 'tmp');
fs.mkdirSync(TMP_ROOT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(TMP_ROOT, 'hook-sources-fourth-'));
const CONFIG = path.join(TMP, 'hooks.json');
const MARKER = path.join(TMP, 'marker.jsonl');
const SCRIPT = path.join(TMP, 'marker.cjs');

/**
 * 钩子进程:把本次派发的关键载荷追加进 marker 日志。
 * agentsExistsAtHookTime 只在 setup 档有意义 —— 用来证明"写入前派发"。
 */
fs.writeFileSync(
  SCRIPT,
  [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const marker = process.argv[2];',
    'const row = {',
    '  event: process.env.IHUI_HOOK_TYPE,',
    '  tool: process.env.IHUI_TOOL,',
    '  error: process.env.IHUI_ERROR,',
    '  setupSource: process.env.IHUI_SETUP_SOURCE,',
    '  cwdFrom: process.env.IHUI_CWD_FROM,',
    '  cwdTo: process.env.IHUI_CWD_TO,',
    '  elicitationId: process.env.IHUI_ELICITATION_ID,',
    '  elicitationMessage: process.env.IHUI_ELICITATION_MESSAGE,',
    '  elicitationAction: process.env.IHUI_ELICITATION_ACTION,',
    '  elicitationContent: process.env.IHUI_ELICITATION_CONTENT,',
    '  agentsExistsAtHookTime: fs.existsSync(path.join(process.env.IHUI_WORKSPACE || ".", "AGENTS.md")),',
    '};',
    "fs.appendFileSync(marker, JSON.stringify(row) + '\\n');",
  ].join('\n'),
  'utf-8',
);

const hookCommand = `"${process.execPath}" "${SCRIPT}" "${MARKER}"`;

/** 单事件单条目的 hooks.json(全量覆盖写)。 */
function writeHookConfig(event: string, extraEvents: string[] = []): void {
  const config: Record<string, unknown> = {};
  for (const ev of [event, ...extraEvents]) {
    config[ev] = [{ name: `fixture-${ev}`, command: hookCommand }];
  }
  fs.writeFileSync(CONFIG, JSON.stringify(config), 'utf-8');
}

function readLog(): Array<Record<string, unknown>> {
  if (!fs.existsSync(MARKER)) return [];
  return fs
    .readFileSync(MARKER, 'utf-8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function resetLog(): void {
  fs.rmSync(MARKER, { force: true });
}

const origConfig = process.env.IHUI_HOOKS_CONFIG;
const origTrust = process.env.IHUI_TRUST_WORKSPACE;
const origSessions = process.env.IHUI_CLI_SESSIONS_DIR;
process.env.IHUI_HOOKS_CONFIG = CONFIG;
// 走非交互出口声明信任(信任门本身另有专册);否则 command 钩子连派生都不会发生。
process.env.IHUI_TRUST_WORKSPACE = '1';
process.env.IHUI_CLI_SESSIONS_DIR = path.join(TMP, 'sessions');

afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  if (origSessions === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR;
  else process.env.IHUI_CLI_SESSIONS_DIR = origSessions;
  fs.rmSync(TMP, { recursive: true, force: true });
});

function mkWorkspace(label: string): string {
  const dir = fs.mkdtempSync(path.join(TMP, `ws-${label}-`));
  return dir;
}

// ───────────────────────── ① setup ─────────────────────────

describe('① setup:写 AGENTS.md 前派发,载荷带装载来源', () => {
  it('writeAgentsMd 先派发 setup(此时文件还不存在),再真正写文件', async () => {
    resetLog();
    writeHookConfig('setup');
    const ws = mkWorkspace('setup');

    const existed = await writeAgentsMd(ws);

    expect(existed).toBe(false);
    const rows = readLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'setup',
      setupSource: 'init',
      agentsExistsAtHookTime: false,
    });
    // 派发之后文件才存在 —— 事实面与上面的"钩子当时看不到"互相印证
    expect(fs.readFileSync(path.join(ws, 'AGENTS.md'), 'utf-8')).toContain('# AGENTS.md');
  });
});

// ───────────────────────── ② cwdChanged ─────────────────────────

describe('② cwdChanged:只有会话工作区真的切换才派发', () => {
  function makeAgent(): IhuiAcpAgent {
    return new IhuiAcpAgent({
      apiUrl: 'http://localhost:8803',
      modelId: 'test-model',
      maxIterations: 3,
      planFirst: false,
      allowDangerous: false,
    });
  }

  it('首个会话不派发;换目录的新会话派发一次,载荷带 from/to', async () => {
    resetLog();
    writeHookConfig('cwdChanged');
    const wsA = mkWorkspace('cwd-a');
    const wsB = mkWorkspace('cwd-b');
    const agent = makeAgent();

    await agent.newSession({ cwd: wsA, mcpServers: [] } as never);
    expect(readLog()).toHaveLength(0);

    await agent.newSession({ cwd: wsB, mcpServers: [] } as never);
    const rows = readLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'cwdChanged',
      cwdFrom: path.resolve(wsA),
      cwdTo: path.resolve(wsB),
    });

    // 同一个目录再开会话 = 没有"变更",不许重复派发
    await agent.newSession({ cwd: wsB, mcpServers: [] } as never);
    expect(readLog()).toHaveLength(1);
  });
});

// ───────────────────── ③ elicitation / elicitationResult ─────────────────────

const ASK_ARGS = {
  question: '选哪个方案?',
  header: 'Pick',
  multiSelect: false,
  options: [{ label: 'A' }, { label: 'B' }],
};
const ASK_CTX = { workspacePath: '.' } as never;

describe('③ elicitation 与 elicitationResult:弹窗前后各一次,id 成对', () => {
  /** vitest 进程的 stdio 不是 TTY;本册临时声明交互态,用完还原。 */
  function setTTY(on: boolean): void {
    for (const stream of [process.stdin, process.stdout]) {
      Object.defineProperty(stream, 'isTTY', { value: on, configurable: true })
    }
  }

  beforeEach(() => {
    resetLog();
    writeHookConfig('elicitation', ['elicitationResult']);
    inquirerState.impl = null;
    setTTY(true);
  });

  afterAll(() => {
    setTTY(false);
  });

  it('正常回答 ⇒ elicitation 先、elicitationResult(accept)后,同一个 id', async () => {
    inquirerState.impl = async () => ({ selected: 'A' });

    const r = await ask_user_question.execute(ASK_ARGS, ASK_CTX);

    expect(r.success).toBe(true);
    expect(r.output).toContain('A');
    const rows = readLog();
    expect(rows.map((x) => x.event)).toEqual(['elicitation', 'elicitationResult']);
    expect(rows[0]).toMatchObject({
      elicitationMessage: '选哪个方案?',
    });
    expect(rows[1]).toMatchObject({
      elicitationAction: 'accept',
      elicitationId: rows[0]!.elicitationId,
    });
    expect(JSON.parse(rows[1]!.elicitationContent as string)).toEqual({ selected: 'A' });
  });

  it('用户在 prompt 里取消 ⇒ 落 cancel,原始错误原样抛给调用链', async () => {
    const cancelError = new Error('User force closed the prompt');
    inquirerState.impl = async () => {
      throw cancelError;
    };

    await expect(ask_user_question.execute(ASK_ARGS, ASK_CTX)).rejects.toBe(cancelError);

    const rows = readLog();
    expect(rows.map((x) => x.event)).toEqual(['elicitation', 'elicitationResult']);
    expect(rows[1]).toMatchObject({
      elicitationAction: 'cancel',
      elicitationId: rows[0]!.elicitationId,
    });
  });

  it('headless 档根本不弹窗 ⇒ 两档一条都不派(没发生的事不许报成事件)', async () => {
    setTTY(false);
    const r = await ask_user_question.execute(ASK_ARGS, ASK_CTX);
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_interactive');
    expect(readLog()).toEqual([]);
  });
});

// ─────────────── ④ postToolUseFailure / permissionDenied ───────────────

function makeTool(name: string, execute: Tool['execute']): Tool {
  return { name, description: `fixture ${name}`, parameters: {}, required: [], execute };
}

describe('④ 工具终态两档事后钩子:统一出口、互斥、不吞原始错误', () => {
  beforeEach(() => {
    clearTools();
    resetRateLimiter();
    resetLog();
  });

  /** 工具动作写进同一份 marker 日志,用来证明钩子发生在工具执行之后。 */
  function logFromTool(kind: string): void {
    fs.appendFileSync(MARKER, JSON.stringify({ kind, event: 'tool' }) + '\n');
  }

  it('失败结果 ⇒ postToolUseFailure 一次,且在工具执行之后', async () => {
    writeHookConfig('postToolUseFailure');
    registerTools([
      makeTool('fixture-fail', async () => {
        logFromTool('tool-run');
        return { success: false, output: '', error: 'boom' };
      }),
    ]);

    const r = await executeToolCall({ name: 'fixture-fail', arguments: {} }, { workspacePath: '.' });

    expect(r.success).toBe(false);
    expect(r.error).toBe('boom');
    const rows = readLog();
    expect(rows[0]).toMatchObject({ kind: 'tool-run', event: 'tool' });
    expect(rows[1]).toMatchObject({
      event: 'postToolUseFailure',
      tool: 'fixture-fail',
      error: 'boom',
    });
  });

  it('拒绝结果 ⇒ 只发 permissionDenied,不发 postToolUseFailure,工具一次都不跑', async () => {
    writeHookConfig('permissionDenied', ['postToolUseFailure']);
    registerTools([makeTool('fixture-denied', async () => { logFromTool('tool-run'); return { success: true, output: 'ran' }; })]);

    const r = await executeToolCall(
      { name: 'fixture-denied', arguments: {} },
      { workspacePath: '.', permissions: { deny: ['fixture-denied'] } },
    );

    expect(r.success).toBe(false);
    expect(r.denial?.decider).toBe('rule-deny');
    const rows = readLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event: 'permissionDenied', tool: 'fixture-denied' });
    expect(rows.some((x) => x.event === 'postToolUseFailure')).toBe(false);
    expect(rows.some((x) => x.kind === 'tool-run')).toBe(false);
  });

  it('成功结果 ⇒ 两档都不发', async () => {
    writeHookConfig('postToolUseFailure', ['permissionDenied']);
    registerTools([makeTool('fixture-ok', async () => ({ success: true, output: 'ran' }))]);

    const r = await executeToolCall({ name: 'fixture-ok', arguments: {} }, { workspacePath: '.' });
    expect(r.success).toBe(true);
    expect(readLog()).toEqual([]);
  });

  it('执行链抛错 ⇒ 先补 postToolUseFailure,再把原始错误原样 rethrow', async () => {
    writeHookConfig('postToolUseFailure');
    const thrown = new Error('fixture-contract-throw');
    const tool: Tool = {
      name: 'fixture-throws',
      description: 'fixture throws',
      parameters: {},
      required: [],
      execute: async () => ({ success: true, output: 'never' }),
      // requiresUserConfirmation 读契约时会取值即抛 ⇒ 走到 executeToolCall 的 catch 分支
      get contract(): ToolContract {
        throw thrown;
      },
    };
    registerTools([tool]);

    await expect(
      executeToolCall({ name: 'fixture-throws', arguments: {} }, { workspacePath: '.' }),
    ).rejects.toBe(thrown);

    const rows = readLog();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: 'postToolUseFailure',
      tool: 'fixture-throws',
      error: 'fixture-contract-throw',
    });
  });

  it('钩子非成功终态喊到 stderr,但工具结果逐字不变(钩子坏了不得改写结果)', async () => {
    // 失败但非阻断 ⇒ 终态不是 succeeded ⇒ surfaceHookOutcome 必须出声
    const failingCommand = process.platform === 'win32' ? 'cmd /c exit 3' : "sh -c 'exit 3'";
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ postToolUseFailure: [{ name: 'fixture-failing', command: failingCommand }] }),
      'utf-8',
    );
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    registerTools([
      makeTool('fixture-fail-visible', async () => ({ success: false, output: '', error: 'boom' })),
    ]);

    try {
      const r = await executeToolCall({ name: 'fixture-fail-visible', arguments: {} }, { workspacePath: '.' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('boom');
      const text = stderrSpy.mock.calls.map((c) => String(c[0]).replace(/\\u001b\[[0-9;]*m/g, '')).join('');
      expect(text).toContain('postToolUseFailure');
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
