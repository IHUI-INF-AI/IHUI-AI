// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钩子终态拆分 + 人工放行对账(2026-09-29 拆终态票立)。
 *
 * 立论(AGENTS §30 原文"钩子无终态不得渲染成'完成'"):改动前 `runHook` 一系的对外只有
 * `proceed` 一维,今天把 5 种结束法("跑了且退出 0 / 非零但不阻断 / 被信任门跳过 /
 * 超时被杀 / 根本没跑到")全折成同一个 true —— 症状是"钩子什么都没发生却账面全绿"。
 * 本文件走**生产入口**(真派生子进程的 runPreToolCall/runPostToolCall/runHook + trust.ts
 * 的真 gateHook),断言各终态互不同形;测试内不得内联第二份终态判定 —— 变异对照必须作用在
 * 生产实现上(把 result_unknown 折回 succeeded,第 ②③ 组必翻红)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runHook,
  runPreToolCall,
  runPostToolCall,
  computeHookContentDigests,
  describeHookTerminal,
  isTerminalComplete,
  HOOK_TERMINAL_STATES,
  type HookEvent,
} from '../src/hooks/index.js';
import {
  gateHook,
  grantHumanHookOverride,
  readHumanHookOverrides,
  listHumanHookOverrides,
} from '../src/hooks/trust.js';

// ROOT = 仓库根(tests 在 apps/cli/tests 下),临时面统一落 §15/§26 批准的 .ihui-agent/tmp
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TMP = fs.mkdtempSync(path.join(ROOT, '.ihui-agent', 'tmp', 'hook-terminal-states-'));
const CONFIG = path.join(TMP, 'hooks.json');
const OVERRIDES = path.join(TMP, 'hook-overrides.jsonl');

const isWin = process.platform === 'win32';
let uniq = 0;
const hookName = (tag: string) => `hts-${tag}-${++uniq}`;

/** 写一份最小 hooks.json(单事件单条目),返回条目名。 */
function writeHookConfig(event: HookEvent, entries: Array<Record<string, unknown>>): void {
  fs.writeFileSync(CONFIG, JSON.stringify({ [event]: entries }), 'utf-8');
}

const nodeEval = (code: string): string => `"${process.execPath}" -e "${code.replace(/"/g, '')}"`;
const exit0Cmd = isWin ? 'cmd /c exit 0' : "sh -c 'exit 0'";
const exit3Cmd = isWin ? 'cmd /c exit 3' : "sh -c 'exit 3'";
// 自述成功 + 真退出 3:验证"钩子不得用自己的 stdout 改写终态"
const lieCmd = nodeEval("process.stdout.write('hook-state:succeeded all good');process.exit(3)");
const longCmd = isWin ? 'cmd /c ping -n 10 127.0.0.1 >nul' : "sh -c 'sleep 10'";

let origConfig: string | undefined;
let origTrust: string | undefined;
let origHome: string | undefined;
let fakeHome: string | null = null;

beforeAll(() => {
  origConfig = process.env.IHUI_HOOKS_CONFIG;
  origTrust = process.env.IHUI_TRUST_WORKSPACE;
  origHome = process.env.HOME;
  process.env.IHUI_HOOKS_CONFIG = CONFIG;
  // CI runner 的工作区在 $HOME 之下(/home/runner/work/...):classifyHooksSource 会把
  // 仓库自带配置判成 'user' 而整条短路信任门 —— skipped 用例拿到 succeeded,其余用例
  // 靠"门被短路"蒙混。HOME 指到工作区之外的临时目录,把来源分类打回 'project' 支路。
  if (process.platform !== 'win32') {
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hts-home-'));
    process.env.HOME = fakeHome;
  }
  // 默认放行钩子真跑(门拒后的显式出口,见 hookTrustSkipReason);skip 用例自行删掉它,
  // 验证"未信任 ⇒ skipped"的拒绝面。
  process.env.IHUI_TRUST_WORKSPACE = '1';
});

afterAll(() => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  if (fakeHome) fs.rmSync(fakeHome, { recursive: true, force: true });
  if (origConfig === undefined) delete process.env.IHUI_HOOKS_CONFIG;
  else process.env.IHUI_HOOKS_CONFIG = origConfig;
  if (origTrust === undefined) delete process.env.IHUI_TRUST_WORKSPACE;
  else process.env.IHUI_TRUST_WORKSPACE = origTrust;
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('终态拆分 — 走真派生子进程的生产链', () => {
  beforeEach(() => {
    // 这些用例测的是"跑了之后怎么记账",信任门自身的判定另有 tests/hooks-trust-gate.test.ts;
    // 走既有的非交互出口声明信任(与 hooks-lifecycle 同一姿势)。
    process.env.IHUI_TRUST_WORKSPACE = '1';
  });

  it('① 退出 0 ⇒ succeeded,且不产出任何反馈行(成功不该占用回传面)', () => {
    const name = hookName('ok');
    writeHookConfig('preToolCall', [{ name, command: exit0Cmd }]);
    const r = runPreToolCall('bash', {});
    expect(r.proceed).toBe(true);
    expect(r.terminal).toBe('succeeded');
    expect(r.feedback).toBeUndefined();
  });

  it('② 非零+不阻断 与 未取到结果 是两个不同的终态(本票立论点)', () => {
    const name = hookName('nonblock');
    writeHookConfig('notification', [{ name, command: exit3Cmd }]);
    const failed = runHook('notification', {});
    expect(failed.proceed).toBe(true);
    expect(failed.terminal).toBe('non_blocking_error');
    expect(failed.feedback).toContain('state=non_blocking_error');

    // "根本没跑到":无 command/webhook 载体的条目 —— 旧账面它与成功完全同形
    const name2 = hookName('no-carrier');
    writeHookConfig('notification', [{ name: name2 }]);
    const unknown = runHook('notification', {});
    expect(unknown.terminal).toBe('result_unknown');
    expect(unknown.terminal).not.toBe(failed.terminal);
    expect(unknown.feedback).toContain('state=result_unknown');
  });

  it('③ 未取到结果不得被渲染成"完成"(呈现出口逐条判)', () => {
    expect(isTerminalComplete('result_unknown')).toBe(false);
    expect(isTerminalComplete('succeeded')).toBe(true);
    expect(describeHookTerminal('result_unknown')).not.toBe(describeHookTerminal('succeeded'));
    // 码本身带 not-complete 后缀:任何直接上屏这条码的表面都不可能读成"完成"
    expect(describeHookTerminal('result_unknown')).toContain('not-complete');

    // 真链:外层异常(buildHookEnv 对循环引用 toolArgs JSON.stringify 必抛)也落 result_unknown
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    writeHookConfig('postToolCall', []);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const r = runHook('postToolCall', { toolName: 'bash', toolArgs: circ });
      expect(r.proceed).toBe(true); // 行为不变:不因拆终态多拦一次
      expect(r.terminal).toBe('result_unknown');
      expect(r.reason).toBeUndefined();
      // 且必须"被喊出来"(stderr warnOnce),不是静默
      const shouted = errSpy.mock.calls.some((c) => String(c[0]).includes('result_unknown'));
      expect(shouted).toBe(true);
    } finally {
      errSpy.mockRestore();
    }
  });

  it('超时被杀 ⇒ timed_out(没跑完 ≠ 跑失败,proceed 语义逐字不变)', () => {
    const name = hookName('slow');
    writeHookConfig('notification', [{ name, command: longCmd, timeout: 300 }]);
    const r = runHook('notification', {});
    expect(r.proceed).toBe(true);
    expect(r.terminal).toBe('timed_out');
    expect(r.feedback).toContain('state=timed_out');
  });

  it('被信任门跳过 ⇒ skipped,非零阻断仍 ⇒ blocked', () => {
    // 无 IHUI_TRUST_WORKSPACE:临时目录不在信任清单 → 跳过态(旧账面 = exit 0 = 与成功同形)
    delete process.env.IHUI_TRUST_WORKSPACE;
    const name = hookName('skip');
    writeHookConfig('preToolCall', [{ name, command: exit0Cmd }]);
    const skipped = runPreToolCall('bash', {});
    expect(skipped.proceed).toBe(true); // 跳过不反向阻断工具调用(既有语义保留)
    expect(skipped.terminal).toBe('skipped');
    expect(skipped.feedback).toContain('state=skipped');

    // 对照:阻断态仍是 proceed=false
    process.env.IHUI_TRUST_WORKSPACE = '1';
    const name2 = hookName('block');
    writeHookConfig('preToolCall', [{ name: name2, command: exit3Cmd }]);
    const blocked = runPreToolCall('bash', {});
    expect(blocked.proceed).toBe(false);
    expect(blocked.terminal).toBe('blocked');
    expect(blocked.reason).toContain(name2);
  });

  it('钩子自述"成功"不得改写终态(判据只看宿主侧观察)', () => {
    const name = hookName('lie');
    writeHookConfig('notification', [{ name, command: lieCmd }]);
    const r = runHook('notification', {});
    expect(r.terminal).toBe('non_blocking_error');
    expect(r.terminal).not.toBe('succeeded');
    // 它的自述只作为**文本**进入反馈行(origin 已标不可信),不进入判定
    expect(r.feedback).toContain('hook-state:succeeded all good');
  });

  it('runPostToolCall 链:默认不阻断的非零退出落 non_blocking_error', () => {
    const name = hookName('post');
    writeHookConfig('postToolCall', [{ name, command: exit3Cmd }]);
    const r = runPostToolCall('bash', {});
    expect(r.proceed).toBe(true);
    expect(r.terminal).toBe('non_blocking_error');
  });

  it('枚举封闭:六个终态各配唯一机器码,只有 succeeded 算完成', () => {
    expect(HOOK_TERMINAL_STATES).toHaveLength(6);
    const codes = HOOK_TERMINAL_STATES.map(describeHookTerminal);
    expect(new Set(codes).size).toBe(6);
    for (const s of HOOK_TERMINAL_STATES) {
      expect(isTerminalComplete(s)).toBe(s === 'succeeded');
    }
  });
});

describe('人工放行 — 拒绝是判定,不是永久禁止(trust.ts 生产入口)', () => {
  afterEach(() => {
    if (fs.existsSync(OVERRIDES)) fs.rmSync(OVERRIDES);
  });

  const specFor = (name: string): { digests: ReturnType<typeof computeHookContentDigests>; spec: { name: string; bundleDigest: string; hookName: string; declarationDigest: string } } => {
    writeHookConfig('preToolCall', [{ name, command: exit0Cmd }]);
    const digests = computeHookContentDigests(TMP);
    return {
      digests,
      spec: {
        name,
        bundleDigest: digests.bundleDigest,
        hookName: name,
        declarationDigest: digests.declarations[name] ?? '',
      },
    };
  };

  it('不放行时行为与改动前同:folder-not-trusted 拒绝且给出既有出路', () => {
    const name = hookName('g1');
    const { spec } = specFor(name);
    const g = gateHook(spec, TMP, '');
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('folder-not-trusted');
    expect(g.detail).toContain('trusted-folders');
    expect(g.overridden).toBeUndefined();
  });

  it('无理由的放行请求被拒(不许静默放行),且不落任何台账', () => {
    const name = hookName('g2');
    const { digests } = specFor(name);
    const res = grantHumanHookOverride(
      { hookName: name, folder: TMP, bundleDigest: digests.bundleDigest, reason: '   ' },
      OVERRIDES,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('reason-required');
    expect(fs.existsSync(OVERRIDES)).toBe(false);
  });

  it('带理由的人工放行可用且留痕;放行后同一次判定被清除', () => {
    const name = hookName('g3');
    const { digests, spec } = specFor(name);
    const grant = grantHumanHookOverride(
      {
        hookName: name,
        folder: TMP,
        bundleDigest: digests.bundleDigest,
        declarationDigest: digests.declarations[name],
        reason: '人工复核过这条命令,只跑本次',
      },
      OVERRIDES,
    );
    expect(grant.ok).toBe(true);
    // 留痕:台账逐条可回读,身份恒为 human,时间与理由都在
    const recs = listHumanHookOverrides(OVERRIDES);
    expect(recs).toHaveLength(1);
    expect(recs[0]?.grantedBy).toBe('human');
    expect(recs[0]?.reason).toContain('人工复核');
    expect(recs[0]?.grantedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readHumanHookOverrides(undefined, OVERRIDES).malformed).toBe(0);

    const text = fs.readFileSync(OVERRIDES, 'utf-8');
    const g = gateHook(spec, TMP, '', text);
    expect(g.allowed).toBe(true);
    expect(g.overridden).toBe('human');
    expect(g.detail).toContain('人工放行');
  });

  it('放行绑"被拒那一刻的内容":单条声明摘要变了,带声明位的旧放行不覆盖新内容', () => {
    // 口径如实:束摘要只管"清单与根级面"(A20 设计),改一条命令动的是**单条声明摘要**
    // —— 所以这一对照必须让 grant 带 declarationDigest(整束放行按设计覆盖整束取值,
    // 那是人明确批过整束的语义,不在本对照射程)。
    const name = hookName('g4');
    const { digests } = specFor(name);
    grantHumanHookOverride(
      {
        hookName: name,
        folder: TMP,
        bundleDigest: digests.bundleDigest,
        declarationDigest: digests.declarations[name],
        reason: '看过那份了',
      },
      OVERRIDES,
    );
    const text = fs.readFileSync(OVERRIDES, 'utf-8');
    // 同一目录、同一钩子名,但那条命令换了一份(声明摘要不同)⇒ 必须回到拒绝
    writeHookConfig('preToolCall', [{ name, command: exit3Cmd }]);
    const changed = computeHookContentDigests(TMP);
    expect(changed.declarations[name]).not.toBe(digests.declarations[name]);
    const g = gateHook(
      { name, bundleDigest: changed.bundleDigest, hookName: name, declarationDigest: changed.declarations[name] ?? '' },
      TMP,
      '',
      text,
    );
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('folder-not-trusted');
  });

  it('整束放行(不带声明位)对该束当前取值生效,束一变即失效', () => {
    const name = hookName('g4b');
    const { digests } = specFor(name);
    grantHumanHookOverride(
      { hookName: name, folder: TMP, bundleDigest: digests.bundleDigest, reason: '整束都看过了' },
      OVERRIDES,
    );
    const text = fs.readFileSync(OVERRIDES, 'utf-8');
    // 束未动、单条取值被换:整束放行的语义就是覆盖这份束 ⇒ 仍放行(登记此语义,非漏洞)
    writeHookConfig('preToolCall', [{ name, command: exit3Cmd }]);
    const declChanged = computeHookContentDigests(TMP);
    expect(declChanged.bundleDigest).toBe(digests.bundleDigest);
    expect(gateHook({ name, bundleDigest: declChanged.bundleDigest }, TMP, '', text).allowed).toBe(true);
    // 束变了(加了一条钩子)⇒ 旧放行不覆盖新清单
    fs.writeFileSync(
      CONFIG,
      JSON.stringify({ preToolCall: [{ name, command: exit3Cmd }, { name: hookName('g4b-extra'), command: exit0Cmd }] }),
      'utf-8',
    );
    const bundleChanged = computeHookContentDigests(TMP);
    expect(bundleChanged.bundleDigest).not.toBe(digests.bundleDigest);
    expect(gateHook({ name, bundleDigest: bundleChanged.bundleDigest }, TMP, '', text).allowed).toBe(false);
  });

  it('用户自己的开关不被人工放行复活(disabled-in-config 仍拒绝)', () => {
    const name = hookName('g5');
    const { digests } = specFor(name);
    grantHumanHookOverride(
      { hookName: name, folder: TMP, bundleDigest: digests.bundleDigest, reason: '就算给了理由' },
      OVERRIDES,
    );
    const text = fs.readFileSync(OVERRIDES, 'utf-8');
    const g = gateHook({ name, enabled: false, bundleDigest: digests.bundleDigest }, TMP, '', text);
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('disabled-in-config');
  });

  it('半套摘要无从核对 ⇒ 台账不参与(与改动前同形地拒绝)', () => {
    const name = hookName('g6');
    specFor(name);
    grantHumanHookOverride(
      { hookName: name, folder: TMP, bundleDigest: 'v1-sha256-some', reason: '理由有,但对方没给摘要' },
      OVERRIDES,
    );
    const text = fs.readFileSync(OVERRIDES, 'utf-8');
    const g = gateHook({ name }, TMP, '', text);
    expect(g.allowed).toBe(false);
    // 没有束摘要就无从核对"放的是哪份内容" → 台账不参与,按原有目录拒绝支走
    expect(g.reason).toBe('folder-not-trusted');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
