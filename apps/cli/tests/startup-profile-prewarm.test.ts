// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 启动画像 + 预热命中读数 —— G-B49 C2(REA 对齐 WorkBuddy 缺口⑪)。
 *
 * 必过的四组对照(票面):
 *  ① 三态成对:profile measured/unjudged(缺里程碑必点名)、prewarm hit/miss/unjudged 各有正向对照;
 *  ② 0ms 禁令:未量到的里程碑**不得**被渲染成任何耗时读数;真实微小值渲染 `<0.01ms` 而非 `0.00ms`;
 *  ③ 指纹不符必判 miss 且点名两枚指纹;进程被换(pid 不存活)必判 miss;
 *  ④ 形状锁:profile 层不碰 fs/env,prewarm 层不 import 网络件(判据读源文件字节,不走运行时 mock)。
 *
 * 判据一律 import 生产出口(§22c,本文件不复制第二份判定);夹具落点走 §26 唯一出口,
 * 台账根经 CLI 既有 `IHUI_HOME` 出口重定向,不新增路径参数。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// 测试夹具唯一落点(§26)。它住在 scripts/ —— 运行时代码不引它,只有测试引。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  createStartupTracker,
  formatMs,
  renderStartupLine,
  DEFAULT_REQUIRED_MILESTONES,
} from '../src/startup/profile.js';
import {
  PREWARM_SCHEMA_VERSION,
  buildProcessFingerprint,
  defaultIsPidAlive,
  getPrewarmStatusPath,
  readPrewarmStatus,
  renderPrewarmLine,
  writePrewarmRecord,
  type PrewarmReadDeps,
} from '../src/startup/prewarm.js';

/** 「值为 0 的耗时读数」的 token 形态(=0ms / =0.00ms 这类账面化产儿)。 */
const ZERO_READING_TOKEN = /[=,\s]0(?:\.0+)?ms(?:\s|$)/;

function fixedClock(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe('startup/profile:三态成对 + 0ms 禁令', () => {
  it('P1 measured:全量必需里程碑 ⇒ delta 正确、单行、含可选 first-await', () => {
    const t = createStartupTracker(fixedClock([100.13, 149.67, 320.42, 810.99]));
    t.mark('entry');
    t.mark('commandParsed');
    t.mark('firstAwait');
    t.mark('exit');
    const r = t.reading();
    expect(r.status).toBe('measured');
    if (r.status !== 'measured') return;
    expect(r.deltasMs.commandParsed).toBeCloseTo(49.54, 2);
    expect(r.deltasMs.firstAwait).toBeCloseTo(220.29, 2);
    expect(r.deltasMs.exit).toBeCloseTo(710.86, 2);
    const line = renderStartupLine(r);
    expect(line).not.toContain('\n');
    expect(line).toContain('command-parsed=49.54ms');
    expect(line).toContain('first-await=220.29ms');
    expect(line).not.toMatch(ZERO_READING_TOKEN);
  });

  it('P2 unjudged:缺 command-parsed ⇒ 点名该枚,行内不得出现任何耗时读数', () => {
    const t = createStartupTracker(fixedClock([100, 810]));
    t.mark('entry');
    t.mark('exit'); // first-await 是可选里程碑,缺席不算缺失
    const r = t.reading();
    expect(r.status).toBe('unjudged');
    if (r.status !== 'unjudged') return;
    expect(r.missing).toEqual(['commandParsed']);
    const line = renderStartupLine(r);
    expect(line).toContain('missing=command-parsed');
    expect(line).not.toMatch(/\d+(?:\.\d+)?ms/);
  });

  it('P3 unjudged:时钟回拨(违序)⇒ 点名出序里程碑,不产出负耗时', () => {
    const t = createStartupTracker(fixedClock([500, 420, 410]));
    t.mark('entry');
    t.mark('commandParsed');
    t.mark('exit');
    const r = t.reading();
    expect(r.status).toBe('unjudged');
    if (r.status !== 'unjudged') return;
    expect(r.missing).toEqual([]);
    expect(r.nonMonotonic).toContain('commandParsed');
    expect(renderStartupLine(r)).not.toMatch(/\d+(?:\.\d+)?ms/);
  });

  it('P4 打点幂等(同名只认第一次)+ 微小正值守卫:0.004ms 渲染 <0.01ms 而非 0.00ms', () => {
    const t = createStartupTracker(fixedClock([100, 100.001, 100.004]));
    t.mark('entry');
    t.mark('entry'); // 重放:has 守卫先于取钟 ⇒ 第二个时钟值仍留给 commandParsed
    t.mark('commandParsed');
    t.mark('exit');
    const r = t.reading();
    if (r.status !== 'measured') throw new Error('measured expected');
    expect(r.deltasMs.commandParsed).toBeCloseTo(0.001, 6);
    expect(r.deltasMs.exit).toBeCloseTo(0.004, 6);
    expect(formatMs(0.004)).toBe('<0.01ms');
    const line = renderStartupLine(r);
    expect(line).toContain('exit=<0.01ms');
    expect(line).not.toMatch(ZERO_READING_TOKEN);
    expect(DEFAULT_REQUIRED_MILESTONES).toContain('commandParsed');
  });
});

describe('startup/prewarm:hit/miss/unjudged 成对', () => {
  let scratch: string | null = null;
  let previousHome: string | undefined;
  const FP = 'win32:x64:v22.1.0:1.0.0';

  beforeEach(() => {
    scratch = mkScratch('prewarm-c2');
    previousHome = process.env.IHUI_HOME;
    process.env.IHUI_HOME = scratch;
  });
  afterEach(() => {
    if (previousHome === undefined) delete process.env.IHUI_HOME;
    else process.env.IHUI_HOME = previousHome;
    if (scratch) rmScratch(scratch);
    scratch = null;
  });

  function deps(over: Partial<PrewarmReadDeps> = {}): PrewarmReadDeps {
    return { currentFingerprint: FP, nowMs: 61_000, isPidAlive: () => true, ...over };
  }
  function writeSeed(patch: Partial<{ schema: string; prewarmAtMs: number; fingerprint: string; pid: number }> = {}): void {
    const w = writePrewarmRecord({
      schema: PREWARM_SCHEMA_VERSION,
      prewarmAtMs: 1_000,
      fingerprint: FP,
      pid: 4242,
      ...patch,
    });
    expect(w.ok).toBe(true);
  }

  it('W1 hit(正向对照):指纹相符 ∧ pid 存活 ∧ 时刻不倒挂 ⇒ age=60000ms,单行渲染', () => {
    writeSeed();
    const r = readPrewarmStatus(deps());
    expect(r).toEqual({ status: 'hit', ageMs: 60_000, pid: 4242 });
    const line = renderPrewarmLine(r);
    expect(line).not.toContain('\n');
    expect(line).toContain('status=hit');
  });

  it('W2 miss(必点名):指纹不符 ⇒ 两枚指纹都出现在 detail', () => {
    writeSeed({ fingerprint: 'linux:x64:v20.9.0:0.9.0' });
    const r = readPrewarmStatus(deps());
    expect(r.status).toBe('miss');
    if (r.status !== 'miss') return;
    expect(r.reason).toBe('fingerprint-mismatch');
    expect(r.detail).toContain(`expected=${FP}`);
    expect(r.detail).toContain('got=linux:x64:v20.9.0:0.9.0');
  });

  it('W3 miss:进程被换(isPidAlive=false)⇒ process-replaced 并点名 pid', () => {
    writeSeed();
    const r = readPrewarmStatus(deps({ isPidAlive: () => false }));
    expect(r.status).toBe('miss');
    if (r.status !== 'miss') return;
    expect(r.reason).toBe('process-replaced');
    expect(r.detail).toContain('pid=4242');
  });

  it('W4 unjudged:状态件不存在/坏 JSON/schema 不符/时刻倒挂 ⇒ 全部未判定,不冒 hit/miss', () => {
    const absent = readPrewarmStatus(deps());
    expect(absent.status).toBe('unjudged');
    expect(renderPrewarmLine(absent)).not.toMatch(/\d+(?:\.\d+)?ms/);

    writeSeed();
    fs.writeFileSync(getPrewarmStatusPath(), '{not json', 'utf8');
    expect(readPrewarmStatus(deps()).status).toBe('unjudged');

    writeSeed({ schema: 'ihui-cli-prewarm-status.v0' });
    const bad = readPrewarmStatus(deps());
    expect(bad.status).toBe('unjudged');
    if (bad.status === 'unjudged') expect(bad.reason).toContain('schema-mismatch');

    writeSeed({ prewarmAtMs: 999_999 });
    expect(readPrewarmStatus(deps({ nowMs: 61_000 })).status).toBe('unjudged');
  });

  it('W5 defaultIsPidAlive 自身:本进程 pid ⇒ 存活;非正整数 ⇒ 不存活(不猜)', () => {
    expect(defaultIsPidAlive(process.pid)).toBe(true);
    expect(defaultIsPidAlive(0)).toBe(false);
    expect(defaultIsPidAlive(-7)).toBe(false);
  });

  it('W6 指纹构造纯拼接:四段按序冒号连接(超越点:身份即指纹,不采集进程外信息)', () => {
    expect(buildProcessFingerprint({ platform: 'a', arch: 'b', nodeVersion: 'c', cliVersion: 'd' })).toBe('a:b:c:d');
  });
});

describe('形状锁(读源文件字节,不走运行时 mock)', () => {
  const srcDir = path.join(__dirname, '..', 'src', 'startup');

  it('S1 profile.ts 不碰 fs/path/env/定时器 —— 纯判据 + 注入时钟', () => {
    const text = fs.readFileSync(path.join(srcDir, 'profile.ts'), 'utf8');
    for (const banned of ['node:fs', 'node:path', 'node:process', 'process.env', 'writeFileSync', 'readFileSync']) {
      expect(text, `profile.ts must not mention ${banned}`).not.toContain(banned);
    }
  });

  it('S2 prewarm.ts 不 import 网络件(不起常驻进程、不新增依赖的账面保证)', () => {
    const text = fs.readFileSync(path.join(srcDir, 'prewarm.ts'), 'utf8');
    for (const banned of ['node:http', 'node:https', 'node:net', 'node:tls', 'node:dgram', 'node:dns', 'node:child_process', 'fetch(']) {
      expect(text, `prewarm.ts must not import/call ${banned}`).not.toContain(banned);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
