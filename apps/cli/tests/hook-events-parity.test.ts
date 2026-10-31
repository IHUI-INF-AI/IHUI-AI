// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 钩子事件全集"三处一致"锁(2026-10-31 补 8 档同批登记)。
//
// 立论:改动前 `HookEvent`(类型)与 `HOOK_EVENT_KEYS`(运行时清单)是同一份东西的两份抄本,
// 那处注释自己写着"新增事件只改一处就会静默漏掉另一处"。本次把清单收成一份(类型由
// `HOOK_EVENT_KEYS` 派生)+ `HooksConfig` 键集由模块内编译期双向锁钉住。本册钉的是:
//  ① 反向钉:测试里逐条点名的全集既是 `HookEvent` 的成员、又能当 `keyof HooksConfig` 用
//     ⇒ 少补任何一处,**tsc 当场红**(不是靠注释提醒);
//  ② 运行时:HOOK_EVENT_KEYS 与该全集**同集且无重复**;
//  ③ 既有 23 档的**登记顺序不动**(新档只许追加在末尾 —— 单条摘要登记表是"先读到的赢",
//     重排会把已批准的钩子打回重批,那不是重构);
//  ④ 三条消费链真的认新档:深合并 / 来源盖章 / 事件载荷 → 环境变量映射。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HOOK_EVENT_KEYS,
  deepMergeHooks,
  loadHooksConfig,
  __test__,
  type HookEntry,
  type HookEvent,
  type HooksConfig,
} from '../src/hooks/index.js';

// 反向钉 ①:这一份名字表**同时**受两个编译期约束 ——
//   - 元素不在 `HookEvent` 值域 ⇒ tsc 红;
//   - 下面 `asConfigKeys` 的赋值要求 HookEvent ⊆ keyof HooksConfig ⇒ HooksConfig 漏登记 ⇒ tsc 红。
const ALL_EVENTS: HookEvent[] = [
  // 既有 23 档(登记顺序)
  'preToolCall',
  'postToolCall',
  'sessionStart',
  'sessionEnd',
  'userPromptSubmit',
  'preCompact',
  'postCompact',
  'notification',
  'stop',
  'stopFailure',
  'postToolUseFailure',
  'permissionDenied',
  'permissionRequest',
  'subagentStart',
  'subagentStop',
  'taskCreated',
  'taskCompleted',
  'worktreeCreate',
  'worktreeRemove',
  'turnStart',
  'turnEnd',
  'turnError',
  'turnComplete',
  // 2026-10-31 对齐上游补的 8 档(上游 PascalCase:Setup / ConfigChange / FileChanged /
  // CwdChanged / InstructionsLoaded / TeammateIdle / Elicitation / ElicitationResult)
  'setup',
  'configChange',
  'fileChanged',
  'cwdChanged',
  'instructionsLoaded',
  'teammateIdle',
  'elicitation',
  'elicitationResult',
];

const LEGACY_EVENTS: HookEvent[] = ALL_EVENTS.slice(0, 23);
const NEW_EVENTS: HookEvent[] = ALL_EVENTS.slice(23);

/** 反向钉 ① 的第二半:全集必须能当 HooksConfig 的键用。 */
const asConfigKeys: Array<keyof HooksConfig> = ALL_EVENTS;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'hook-events-parity-'));
const CONFIG = path.join(TMP, 'hooks.json');

let origConfig: string | undefined;
beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
});
afterAll(() => {
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('事件全集 — 三处一致(类型 / HooksConfig / HOOK_EVENT_KEYS)', () => {
  it('① 全集 31 档:既有 23 + 本次补 8,一张表里既无重复也不缺项', () => {
    expect(ALL_EVENTS).toHaveLength(31);
    expect(NEW_EVENTS).toHaveLength(8);
    expect(new Set(ALL_EVENTS).size).toBe(31);
  });

  it('② HOOK_EVENT_KEYS 与全集同集(顺序无关的那一维:排序后逐字相等)', () => {
    expect([...HOOK_EVENT_KEYS].sort()).toEqual([...ALL_EVENTS].sort());
  });

  it('②b HOOK_EVENT_KEYS 自身无重复,且档数与全集一致', () => {
    expect(new Set(HOOK_EVENT_KEYS).size).toBe(HOOK_EVENT_KEYS.length);
    expect(HOOK_EVENT_KEYS.length).toBe(ALL_EVENTS.length);
    // 反向锁的取材面:asConfigKeys 与 ALL_EVENTS 必须同源(不因重构而变空表)
    expect(asConfigKeys).toEqual(ALL_EVENTS);
  });

  it('③ 既有 23 档的登记顺序逐字不动,新档只追加在末尾(摘要归属依赖它)', () => {
    expect([...HOOK_EVENT_KEYS].slice(0, 23)).toEqual(LEGACY_EVENTS);
    expect([...HOOK_EVENT_KEYS].slice(23)).toEqual(NEW_EVENTS);
  });

  it('④a 深合并认新档:两边各一条 fileChanged ⇒ 拼接两条,顺序 a 在前', () => {
    const a: HooksConfig = { fileChanged: [{ name: 'a-watch', command: 'exit 0' }] };
    const b: HooksConfig = { fileChanged: [{ name: 'b-watch', command: 'exit 0' }] };
    const merged = deepMergeHooks(a, b);
    expect((merged.fileChanged ?? []).map((e) => e.name)).toEqual(['a-watch', 'b-watch']);
    // 未被两边声明的事件不得凭空长出键
    expect(merged.elicitation).toBeUndefined();
  });

  it('④b 来源盖章认新档:磁盘上的 elicitation 条目必须被盖上 source/sourceFolder', () => {
    // 盖章走 HOOK_EVENT_KEYS 遍历;新档漏在那份清单里时,这一条会拿到 undefined(本票立点)
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({
        elicitation: [{ name: 'ask-notify', command: 'exit 0' }],
        elicitationResult: [{ name: 'answer-notify', command: 'exit 0' }],
        setup: [{ name: 'setup-notify', command: 'exit 0' }],
        configChange: [{ name: 'cfg-notify', command: 'exit 0' }],
        fileChanged: [{ name: 'fs-notify', command: 'exit 0' }],
        cwdChanged: [{ name: 'cwd-notify', command: 'exit 0' }],
        instructionsLoaded: [{ name: 'rules-notify', command: 'exit 0' }],
        teammateIdle: [{ name: 'mate-notify', command: 'exit 0' }],
      }),
      'utf-8',
    );
    const loaded = loadHooksConfig(TMP);
    const byEvent: Array<[HookEvent, HookEntry | undefined]> = NEW_EVENTS.map((event) => [
      event,
      loaded[event]?.[0],
    ]);
    for (const [event, entry] of byEvent) {
      expect(entry, `事件 ${event} 的条目没被盖章 ⇒ HOOK_EVENT_KEYS 与类型必有一处漏`).toBeDefined();
      // 归属目录就在 TMP 里 ⇒ 判成 'project'(来源不明不得成为免检通道)
      expect(entry?.source, `${event} 的 source 未盖`).toBe('project');
      expect(entry?.sourceFolder, `${event} 的 sourceFolder 未盖`).toBe(TMP);
    }
  });

  it('④c 载荷 → 环境变量映射逐档齐(新档字段缺一条,钩子侧就只能猜)', () => {
    const env = __test__.buildHookEnv('fileChanged', {
      setupSource: 'init',
      configPath: '/tmp/hooks.json',
      configChangeKind: 'modified',
      filePath: '/tmp/a.ts',
      fileChangeKind: 'modify',
      cwdFrom: '/tmp/old',
      cwdTo: '/tmp/new',
      instructionsPath: '/tmp/AGENTS.md',
      teammateId: 'tm-1',
      elicitationId: 'el-1',
      elicitationMessage: '继续吗',
      elicitationAction: 'accept',
      elicitationContent: '{"ok":true}',
    });
    expect(env.IHUI_HOOK_TYPE).toBe('fileChanged');
    expect(env.IHUI_SETUP_SOURCE).toBe('init');
    expect(env.IHUI_CONFIG_PATH).toBe('/tmp/hooks.json');
    expect(env.IHUI_CONFIG_CHANGE_KIND).toBe('modified');
    expect(env.IHUI_FILE_PATH).toBe('/tmp/a.ts');
    expect(env.IHUI_FILE_CHANGE_KIND).toBe('modify');
    expect(env.IHUI_CWD_FROM).toBe('/tmp/old');
    expect(env.IHUI_CWD_TO).toBe('/tmp/new');
    expect(env.IHUI_INSTRUCTIONS_PATH).toBe('/tmp/AGENTS.md');
    expect(env.IHUI_TEAMMATE_ID).toBe('tm-1');
    expect(env.IHUI_ELICITATION_ID).toBe('el-1');
    expect(env.IHUI_ELICITATION_MESSAGE).toBe('继续吗');
    expect(env.IHUI_ELICITATION_ACTION).toBe('accept');
    expect(env.IHUI_ELICITATION_CONTENT).toBe('{"ok":true}');
  });

  it('④d 未提供的载荷不写成空串(未提供 ≠ 提供了空值)', () => {
    const env = __test__.buildHookEnv('configChange', { configPath: '/tmp/hooks.json' });
    expect(env.IHUI_CONFIG_PATH).toBe('/tmp/hooks.json');
    expect('IHUI_FILE_PATH' in env).toBe(false);
    expect('IHUI_ELICITATION_ACTION' in env).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
