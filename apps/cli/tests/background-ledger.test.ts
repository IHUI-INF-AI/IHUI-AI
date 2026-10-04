// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务台账测试 —— 口径:**只报不恢复**(用户拍板,2026-09-28)。
 *
 * 四组必须同时成立的对照(缺任何一组,这份台账就只是"看起来有"):
 *  ① 正常结束 ⇒ 记到**真终态**;
 *  ② 写账进程已不在而终态没记到 ⇒ `detached-unknown`,并且**没有新任务被创建**
 *     (断言副作用,不只断言状态字符串 —— 只断言字符串会放过"顺手重跑一次"那种实现);
 *  ③ 进程还在 ⇒ 不得判成 detached;
 *  ④ 台账超限 ⇒ 拒绝自动清理并点名,文件字节不动。
 *
 * 判据一律走生产入口(`recordTaskStart` / `recordTaskSettle` / `summarizeLedger` /
 * `classifyLedgerRecord`),本文件**不内联第二份**"是不是 detached"的判定 ——
 * 抄一份判据进测试,测试就从防线变成了实现当前形状的复读机(§22c)。
 *
 * 夹具落点:`scripts/lib/scratch-dir.mjs` 的 mkScratch(§26 —— 不落 os.tmpdir(),
 * 因活进程的 TEMP 可能仍钉在 C 盘),台账根经 CLI 既有的 `IHUI_HOME` 出口重定向,
 * 不新增任何路径参数或第五个落点。
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// 测试夹具唯一落点(§26)。它住在 scripts/ —— 运行时代码不引它,只有测试引;
// 跨包相对路径在本仓没有配置 import plugin,故不写 eslint-disable(引用一条不存在的规则本身就是错误)。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import {
  LEDGER_MAX_LINES,
  classifyLedgerRecord,
  drainLedgerAlerts,
  isOutcomeEstablished,
  ledgerFilePath,
  ledgerStateLabel,
  pruneLedger,
  recordTaskSettle,
  recordTaskStart,
  summarizeLedger,
  type BackgroundLedgerRecord,
} from '../src/tools/background-ledger.js';
import { listTasks } from '../src/tools/background-registry.js';

let scratch: string | null = null;
let previousHome: string | undefined;

function ledgerText(): string | null {
  try {
    return fs.readFileSync(ledgerFilePath(), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * 拿一个"确定已经不在"的 pid:派生一个立刻退出的 node 进程,用它退出后的 pid。
 * `windowsHide: true` 是硬要求(§5b —— 无控制台宿主下派生控制台程序必弹窗,守门 52 blocking)。
 */
function deadPid(): number {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const r = spawnSync(process.execPath, ['-e', ''], { windowsHide: true, timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (typeof r.pid !== 'number' || r.pid <= 0) {
    throw new Error('无法取得一个已退出的 pid,②③ 两组对照失去意义');
  }
  // 走到这里 spawnSync 已完成 ⇒ 该 pid 已死(与"没跑起来"的 ENOENT 区分开:那种 pid 拿不到)
  if (r.error) throw new Error(`探测进程派生失败:${r.error.message}`);
  return r.pid;
}

function recordFromLedger(id: string): BackgroundLedgerRecord | undefined {
  return summarizeLedger().entries.find((e) => e.record.id === id)?.record;
}

/** 台账最后一行(最近一次写入的那条)—— 用来证明"没被改写成已知终态"。 */
function lastLedgerLine(): string {
  const lines = (ledgerText() ?? '').trim().split('\n');
  return lines[lines.length - 1] ?? '';
}

beforeEach(() => {
  scratch = mkScratch('bg-ledger-');
  previousHome = process.env.IHUI_HOME;
  process.env.IHUI_HOME = path.join(scratch, 'home');
  drainLedgerAlerts(); // 上一用例留下的告警不得串进本次断言
});

afterEach(() => {
  if (previousHome === undefined) delete process.env.IHUI_HOME;
  else process.env.IHUI_HOME = previousHome;
  if (scratch) rmScratch(scratch);
  scratch = null;
});

describe('后台任务台账 · ① 正常结束记到真终态', () => {
  it('创建时无终态,结束后落 succeeded 并带退出码', () => {
    const start = recordTaskStart({ id: 'bg_ok', command: 'pnpm test', childPid: 4242 });
    expect(start.ok).toBe(true);
    const before = summarizeLedger().entries.find((e) => e.record.id === 'bg_ok');
    expect(before?.record.terminal).toBeNull();
    // 本进程写的账、又没进 liveIds ⇒ 属主还活着 ⇒ owned-elsewhere,绝不是 detached
    expect(before?.state).toBe('owned-elsewhere');
    expect(isOutcomeEstablished(before!.state)).toBe(false);

    const settle = recordTaskSettle({ id: 'bg_ok', terminal: 'succeeded', exitCode: 0, note: 'closed' });
    expect(settle.ok).toBe(true);
    const after = summarizeLedger().entries.find((e) => e.record.id === 'bg_ok');
    expect(after?.state).toBe('succeeded');
    expect(after?.record.exitCode).toBe(0);
    expect(ledgerStateLabel('succeeded')).toBe('succeeded');
    expect(isOutcomeEstablished('succeeded')).toBe(true);
  });

  it('非零退出 ⇒ failed;被信号终止 ⇒ cancelled', () => {
    recordTaskStart({ id: 'bg_fail', command: 'git push', childPid: null });
    recordTaskSettle({ id: 'bg_fail', terminal: 'failed', exitCode: 1, note: 'closed' });
    recordTaskStart({ id: 'bg_kill', command: 'node long.js', childPid: null });
    recordTaskSettle({ id: 'bg_kill', terminal: 'cancelled', exitCode: null, note: 'closed by signal SIGTERM' });
    const s = summarizeLedger();
    expect(s.entries.find((e) => e.record.id === 'bg_fail')?.state).toBe('failed');
    expect(s.entries.find((e) => e.record.id === 'bg_kill')?.state).toBe('cancelled');
    expect(s.counts.failed).toBe(1);
    expect(s.counts.cancelled).toBe(1);
  });
});

describe('后台任务台账 · ② 进程已不在且没记终态 ⇒ detached-unknown,且不重跑', () => {
  it('点名该条并给出判定依据;读台账不创建任何任务、不改写终态', () => {
    const dead = deadPid();
    recordTaskStart({ id: 'bg_lost', command: 'sleep 999', childPid: null, ownerPid: dead });

    const s = summarizeLedger({ liveIds: [] });
    const lost = s.entries.find((e) => e.record.id === 'bg_lost');
    expect(lost?.state).toBe('detached-unknown');
    expect(lost?.basis).toContain(String(dead));
    // §30:没有终态就不得渲染成"完成"
    expect(ledgerStateLabel('detached-unknown')).toContain('NOT completed');
    expect(isOutcomeEstablished('detached-unknown')).toBe(false);
    expect(s.unsettled.map((e) => e.record.id)).toContain('bg_lost');

    // **副作用断言**,不只断言状态字符串:读台账之后不得有任何任务被创建/重跑
    expect(listTasks()).toEqual([]);
    expect(s.counts.succeeded).toBe(0);
    expect(s.counts.failed).toBe(0);

    // 也**不得**把这一格改写成任何已知终态(磁盘上仍然是 terminal:null)
    const text = ledgerText() ?? '';
    expect(text).toContain('"id":"bg_lost"');
    expect(JSON.parse(lastLedgerLine()).terminal).toBeNull();

    // 再读一次:纯读,内容逐字不变(否则"呈现"就在悄悄改台账)
    const first = ledgerText();
    summarizeLedger({ liveIds: [] });
    expect(ledgerText()).toBe(first);
  });

  it('跨机器记录判不成"已脱离" ⇒ outcome-unknown(无从判断,不冒红也不记绿)', () => {
    const foreign: BackgroundLedgerRecord = {
      id: 'bg_foreign',
      kind: 'node',
      commandDigest: 'deadbeefcafebabe',
      startedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      terminal: null,
      exitCode: null,
      host: 'a-host-that-is-not-this-one',
      ownerPid: 999999,
      childPid: null,
      note: '',
    };
    const classified = classifyLedgerRecord(foreign, { liveIds: new Set<string>() });
    expect(classified.state).toBe('outcome-unknown');
    expect(ledgerStateLabel(classified.state)).toContain('NOT completed');
  });

  it('同一个 id 的后续记录覆盖前一条(折叠取最后写入)', () => {
    const dead = deadPid();
    recordTaskStart({ id: 'bg_fold', command: 'echo hi', childPid: null, ownerPid: dead });
    recordTaskStart({ id: 'bg_fold', command: 'echo again', childPid: null, ownerPid: dead });
    const s = summarizeLedger();
    expect(s.entries.filter((e) => e.record.id === 'bg_fold')).toHaveLength(1);
  });
});

describe('后台任务台账 · ③ 进程还活着 ⇒ 不得判成 detached', () => {
  it('属主是本进程(还活着)⇒ owned-elsewhere;在本注册表里 ⇒ running-here', () => {
    recordTaskStart({ id: 'bg_mine', command: 'watch something', childPid: null });
    const notLive = summarizeLedger({ liveIds: [] }).entries.find((e) => e.record.id === 'bg_mine');
    expect(notLive?.state).toBe('owned-elsewhere');
    const live = summarizeLedger({ liveIds: ['bg_mine'] }).entries.find((e) => e.record.id === 'bg_mine');
    expect(live?.state).toBe('running-here');
    expect(summarizeLedger({ liveIds: ['bg_mine'] }).counts['detached-unknown']).toBe(0);
  });

  it('probeOwnerAlive 对本进程返回 true(阳性对照:判据不是恒"已死")', () => {
    const rec = recordFromLedger('bg_probe');
    expect(rec).toBeUndefined(); // 尚未写入 ⇒ 走下面的显式记录
    recordTaskStart({ id: 'bg_probe', command: 'node keep-alive.js', childPid: null });
    const r = recordFromLedger('bg_probe');
    expect(r).toBeDefined();
    expect(classifyLedgerRecord(r as BackgroundLedgerRecord, { liveIds: new Set<string>() }).state).toBe(
      'owned-elsewhere',
    );
  });
});

describe('后台任务台账 · ④ 规模闸:拒绝自动清理并点名', () => {
  it('超限后写入被拒,文件字节不动,告警点名路径与人工出口', () => {
    const file = ledgerFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stamp = new Date().toISOString();
    const lines: string[] = [];
    for (let i = 0; i <= LEDGER_MAX_LINES; i++) {
      lines.push(
        JSON.stringify({
          id: `bg_bulk_${i}`,
          kind: 'node',
          commandDigest: 'x'.repeat(16),
          startedAt: stamp,
          lastSeenAt: stamp,
          terminal: 'succeeded',
          exitCode: 0,
          host: 'bulk',
          ownerPid: 1,
          childPid: null,
          note: '',
        }),
      );
    }
    const body = `${lines.join('\n')}\n`;
    fs.writeFileSync(file, body, 'utf-8');

    const attempt = recordTaskStart({ id: 'bg_should_not_land', command: 'echo nope', childPid: null });
    expect(attempt.ok).toBe(false);
    expect(attempt.code).toBe('oversized');
    // 内容被动过 = 所谓"拒绝自动清理"是假的
    expect(ledgerText()).toBe(body);
    expect(ledgerText()).not.toContain('bg_should_not_land');

    const alerts = drainLedgerAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.join('\n')).toContain(file);
    expect(alerts.join('\n')).toContain('AUTO-CLEAN REFUSED');

    // 摘要也要如实把这格报成超限,而不是静默按现状出合格证
    const s = summarizeLedger();
    expect(s.oversize).not.toBeNull();
    expect(s.oversize?.lines).toBeGreaterThan(LEDGER_MAX_LINES);
  });

  it('pruneLedger 默认档一条不动;人工确认后只搬走已落终态的,未终态的永久保留', () => {
    recordTaskStart({ id: 'bg_p_settled', command: 'echo done', childPid: null });
    recordTaskSettle({ id: 'bg_p_settled', terminal: 'succeeded', exitCode: 0 });
    recordTaskStart({ id: 'bg_p_open', command: 'echo open', childPid: null });
    const before = ledgerText();

    const refused = pruneLedger();
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe('not-confirmed');
    expect(ledgerText()).toBe(before); // 默认档:磁盘一个字节都不动

    const pruned = pruneLedger({ confirm: true });
    expect(pruned.ok).toBe(true);
    if (!pruned.ok) throw new Error('unreachable');
    expect(pruned.archived).toBe(1);
    expect(pruned.retained).toBe(1);

    const after = summarizeLedger();
    expect(after.entries.map((e) => e.record.id)).toEqual(['bg_p_open']);
    expect(fs.existsSync(pruned.archivePath)).toBe(true);
    expect(fs.readFileSync(pruned.archivePath, 'utf-8')).toContain('bg_p_settled');
  });
});

describe('后台任务台账 · 记录内容不涉密', () => {
  it('命令行原文不落盘:只留程序名 + 不可逆摘要,凭据一律被脱掉', () => {
    const secret = 'ak活-1234567890abcdef';
    recordTaskStart({
      id: 'bg_secret',
      command: `aws sts assume-role --token ${secret} --secret-access-key ${secret}`,
      childPid: 1,
    });
    const rec = recordFromLedger('bg_secret');
    expect(rec?.kind).toBe('aws');
    expect(rec?.commandDigest).toMatch(/^[0-9a-f]{16}$/);
    const text = ledgerText() ?? '';
    expect(text).not.toContain(secret);
    expect(text).not.toContain('assume-role');
  });

  it('说明字段也走同一出口并截断(失败原因常带凭据)', () => {
    recordTaskStart({ id: 'bg_note', command: 'node x.js', childPid: null });
    recordTaskSettle({
      id: 'bg_note',
      terminal: 'failed',
      exitCode: 7,
      note: `Authorization: Bearer secret-token-value-abc123 ${'x'.repeat(400)}`,
    });
    const text = ledgerText() ?? '';
    expect(text).not.toContain('secret-token-value-abc123');
    const rec = recordFromLedger('bg_note');
    expect(rec?.note).toContain('…[+');
    expect(rec?.exitCode).toBe(7);
  });

  it('坏行跳过并计数,不半收下(收下半个残缺记录就是替它编状态)', () => {
    recordTaskStart({ id: 'bg_good', command: 'echo ok', childPid: null });
    const file = ledgerFilePath();
    fs.appendFileSync(file, '{"id":"bg_broken","kind":123}\nnot json at all\n', 'utf-8');
    const s = summarizeLedger();
    expect(s.malformedLines).toBe(2);
    expect(s.entries.map((e) => e.record.id)).toEqual(['bg_good']);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
