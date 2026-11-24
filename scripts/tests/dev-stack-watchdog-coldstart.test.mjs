// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/dev-stack-watchdog-coldstart.test.mjs — 冷启动期心跳接线锁(§22c 镜像模式)
//
// 立因(2026-10-31 本机一手现场,每条读数都取自当时的真实文件/进程):
//   · 守护 pid 26048 的进程创建时刻(Get-CimInstance Win32_Process.CreationDate)= 22:11:13,
//     而 `.tmp-sync/dev-stack-watcher.log` 里第一条带时刻的行是
//     `[22:13:53] ai-service(:8803) 掉线,重拉中...` ⇒ 进入 watch 块之前的「初始启动阶段」
//     实测 **160s**(api 首编译 75s + web 就绪 + ai-service 干等 readyTimeoutMs=120s +
//     prod-proxy / web-preview 等腿;各腿 pid 文件 mtime 22:11:14 → 22:13:38 与之一致)。
//   · 这 160s 里旧实现**一个心跳字节都没写**(writeHeartbeat 只在进入 watch 块时和每轮
//     rawTick 首行各跑一次)。于是 `.tmp-sync/dev-stack-watchdog.log` 记下
//     `2026-10-31T14:12:04.627Z 心跳缺失,需要复活`(=22:12:04 本地,+51s)→ revive 出
//     第二个守护头;同一秒 `dev-stack-watcher.pid` 被改写成 4204(mtime 22:12:04.709)、
//     `dev-stack-watcher.err.log` 被以 'w' 截成 0 字节(mtime 22:12:04.702,ctime 同刻)。
//     第二头自己也得跑完整初始启动(22:12:04→22:13:53,实测 109s)才走到锁检查然后
//     自杀退场 —— 这 109s 内两头的 ensure/startSvc/killStale 同写一批 dev-stack-<腿>.log。
//   · 守护侧那把单实例锁读的正是这枚心跳,而它在冷启动期不存在 ⇒ 锁在这个窗口结构性失明。
//   · 同型第二格(顺带量到):22:45:44 落的心跳在 22:46:44 已龄 85s(rawTick 单轮最坏
//     7 条腿×45s,心跳只在 tick 首行写),再抖一点就翻过 90s 阈值 ⇒ 又是一次无效复活。
//
// 本锁钉住:① 心跳与锁检查都排在初始启动阶段之前,冷启动全程巡检判「健康」;
// ② 续写只挂在真推进事件上(把判据改松成"永不 revive"会当场翻红);
// ③ 自愈口径(新鲜阈值 90s + 巡检 2 分钟)一字未动,守护真死仍按原速被复活;
// ④ 一次性体检 / --check 不写心跳(否则等于用注定退场的 pid 冒充守护)。
// 判据一律 import 生产实现(dev-stack.mjs / dev-stack-watchdog.mjs 的 __test__),禁止复制。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs';

const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STACK_SRC = fs.readFileSync(path.join(SCRIPTS_DIR, 'dev-stack.mjs'), 'utf8');
const WATCHDOG_SRC = fs.readFileSync(path.join(SCRIPTS_DIR, 'dev-stack-watchdog.mjs'), 'utf8');
const LAUNCHER_SRC = fs.readFileSync(path.join(SCRIPTS_DIR, 'dev-stack-launch.mjs'), 'utf8');

const STACK = await import(pathToFileURL(path.join(SCRIPTS_DIR, 'dev-stack.mjs')).href);
const WATCHDOG = await import(pathToFileURL(path.join(SCRIPTS_DIR, 'dev-stack-watchdog.mjs')).href);

const {
  heartbeatIsFresh,
  secondInstanceLockHit,
  heartbeatShouldRefresh,
  heartbeatPath,
  HEARTBEAT_FILE_ENV,
  HEARTBEAT_FILE_NAME,
  HEARTBEAT_FRESH_MS,
  HEARTBEAT_REFRESH_MS,
  HEARTBEAT_PHASE_WATCH,
} = STACK.__test__;

const { decidePatrol, heartbeatAgeMs, FRESH_MS, PATROL_INTERVAL_MINUTES, HB_PATH_ENV } = WATCHDOG.__test__;

// —— 现场取样值(见文件头注),不是拍的 ——
const COLD_START_MS = 160_000; // 22:11:13 → 22:13:53
const PATROL_STEP_MS = PATROL_INTERVAL_MINUTES * 60_000; // 120_000
const DAEMON_PID = 26048; // 现场那台守护
// 时间轴原点用现场一枚真实心跳的 ts(22:41:13 本地)。用绝对 epoch 值而不是 0,是因为
// 生产判据对 now<=0 一律判「取不到时钟 ⇒ 不写」,把 0 当原点会撞那条防御。
const T0 = 1_793_457_673_884;
// 旧实现在 +51s(22:12:04,有日志原文)多派了一个头;+171s 是同一轮里的第二次巡检落点
const SPURIOUS_REVIVE_AT_MS = 51_000;
const NEXT_PATROL_AT_MS = 171_000;
const POLL_STEP_MS = 5_000; // 冷启动期一次探活的最坏形状(tcp 双栈 1.2s×2 + http 2.5s + sleep 1.5s)
const LONG_TICK_MS = 95_000; // 现场实测的长 tick 形状(单轮最坏 7 条腿×45s)

const aliveOf = () => true; // 喂给 secondInstanceLockHit 的判活回调(纯注入,不派生 tasklist)
const deadOf = () => false;

/**
 * 时间轴复演:把「守护在各时刻发生了哪些真推进事件」喂给**生产判据**,算出最后落盘的心跳。
 * 入参是相对 T0 的毫秒偏移;事件即写点候选(锁检查后第一枚 / 每条腿 / 每轮探活 / 每轮 tick),
 * 是否真打盘由 heartbeatShouldRefresh 判,写成功则 lastTs 前移 —— 与 writeHeartbeat 同一条判据。
 * 进程死亡 / 事件循环卡住 = 不再有任何推进事件(不是"心跳被改成过期"),所以判据里不需要
 * 任何"停滞"分支,也就无从被改松成永不复活。
 */
function replayHeartbeat(offsets, { refreshMs = HEARTBEAT_REFRESH_MS, freshMs = HEARTBEAT_FRESH_MS, lastTs = 0 } = {}) {
  let cur = lastTs;
  const landed = [];
  for (const off of [...offsets].sort((a, b) => a - b)) {
    const atMs = T0 + off;
    if (heartbeatShouldRefresh({ lastTs: cur, now: atMs, freshMs, refreshMs })) {
      cur = atMs;
      landed.push(off);
    }
  }
  return { hb: cur === 0 ? null : { pid: DAEMON_PID, ts: cur }, landed };
}

/** 巡检裁决:偏移时刻 + 显式判活布尔(两维各自独立,不得混成一个) */
function verdictAt(hb, offset, isAlive = true) {
  return decidePatrol({ hb, now: T0 + offset, freshMs: HEARTBEAT_FRESH_MS, alive: isAlive });
}

/** 等间隔推进事件 */
function grid(from, to, step) {
  const out = [];
  for (let at = from; at <= to; at += step) out.push(at);
  return out;
}

// ───────────────────── 一、判据单源:阈值不许被放宽,两侧不许各算一份 ─────────────────────

test('单源:写方与巡检方的新鲜阈值同值,且都没被改大(改大任一即红)', () => {
  assert.equal(HEARTBEAT_FRESH_MS, FRESH_MS, '两侧阈值不同值 ⇒ "写方以为没事、巡检以为死了"');
  assert.equal(HEARTBEAT_FRESH_MS, 90_000, '新鲜阈值被改大 = 把自愈改松,本锁拒绝');
  assert.equal(PATROL_INTERVAL_MINUTES, 2, '巡检节律被改慢 = 把自愈改松,本锁拒绝');
  assert.ok(HEARTBEAT_REFRESH_MS < HEARTBEAT_FRESH_MS, '续写节律必须落在新鲜窗口内');
  assert.ok(
    HEARTBEAT_REFRESH_MS <= HEARTBEAT_FRESH_MS / 3,
    `续写节律不得粗于新鲜窗口的 1/3(现 ${HEARTBEAT_REFRESH_MS}/${HEARTBEAT_FRESH_MS})`,
  );
  // 现场冷启动 160s:窗口内至少要有 4 次续写机会,否则等于没有心跳
  assert.ok(
    Math.ceil(COLD_START_MS / HEARTBEAT_REFRESH_MS) >= 4,
    `160s 冷启动内续写机会不足 4 次(现 ${Math.ceil(COLD_START_MS / HEARTBEAT_REFRESH_MS)})`,
  );
  assert.equal(HB_PATH_ENV, HEARTBEAT_FILE_ENV, '写方与巡检方必须认同同一个测试缝变量名');
  // 节律只有一份实现:注册任务那行必须插值常量,不得再手写 "-Minutes 2"
  assert.match(WATCHDOG_SRC, /New-TimeSpan -Minutes \$\{PATROL_INTERVAL_MINUTES\}\)/, '巡检节律必须由常量单点供给');
  assert.doesNotMatch(WATCHDOG_SRC, /New-TimeSpan -Minutes 2\)/, '不得残留硬编码节律(两份实现必然漂移)');
  // 真死的第三种形态:心跳仍新鲜但记录进程已不在 ⇒ 判活为假 ⇒ revive(不得借"新鲜"宽限)
  assert.equal(decidePatrol({ hb: { pid: DAEMON_PID, ts: 1000 }, now: 2000, freshMs: HEARTBEAT_FRESH_MS, alive: false }), 'revive');
});

test('形状锁:巡检侧 patrol 必须经 decidePatrol,不得在原地复算心跳龄', () => {
  const patrolBody = WATCHDOG_SRC.match(/function patrol\(\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.ok(patrolBody, 'dev-stack-watchdog.mjs 必须存在 function patrol');
  assert.match(patrolBody, /decidePatrol/, 'patrol 必须调生产纯判据 decidePatrol');
  assert.match(patrolBody, /revive\(\)/, 'patrol 的 revive 分支必须真调 revive()(裁决不能悬空)');
  assert.doesNotMatch(patrolBody, /Date\.now\(\)\s*-\s*Number\(/, 'patrol 里不得再复算心跳龄(两份判据必然漂移,§0.6)');
  assert.match(WATCHDOG_SRC, /heartbeatAgeMs/, '日志里点名的"龄"也走同一个出口');
});

// ───────────────────────── 二、新鲜度与单实例锁的边界 ─────────────────────────

test('心跳新鲜度:89s 算新鲜、90s 整即过期、缺字段/坏形状一律不猜健康', () => {
  assert.ok(heartbeatIsFresh({ ts: 1000, now: 1000 + HEARTBEAT_FRESH_MS - 1000 }));
  assert.ok(!heartbeatIsFresh({ ts: 1000, now: 1000 + HEARTBEAT_FRESH_MS }), '刚好过期即不新鲜');
  assert.ok(!heartbeatIsFresh({ ts: 0, now: 10_000 }), 'ts=0 属缺字段');
  assert.ok(!heartbeatIsFresh({ ts: 'abc', now: 10_000 }), '坏 ts 不判新鲜');
  assert.ok(!heartbeatIsFresh({ ts: 5000, now: Number.NaN }), '取不到"现在"⇒ 未判定,不猜健康');
  // 巡检侧同一枚心跳龄读数:坏形状 ⇒ null(不冒充 0,也不冒充健康)
  assert.equal(heartbeatAgeMs({ hb: { ts: 1000 }, now: 4000 }), 3000);
  assert.equal(heartbeatAgeMs({ hb: null, now: 4000 }), null);
  assert.equal(heartbeatAgeMs({ hb: { ts: 0 }, now: 4000 }), null);
});

test('单实例锁:新鲜+活=已有守护,过期/死进程/无心跳/坏 pid 一律可接管', () => {
  const hb = { pid: DAEMON_PID, ts: 1000 };
  assert.ok(secondInstanceLockHit({ hb, now: 1000, pidAliveOf: aliveOf }));
  assert.ok(!secondInstanceLockHit({ hb, now: HEARTBEAT_FRESH_MS + 1000, pidAliveOf: aliveOf }), '过期 ⇒ 可接管');
  assert.ok(!secondInstanceLockHit({ hb, now: 1000, pidAliveOf: deadOf }), 'pid 已死 ⇒ 可接管');
  assert.ok(!secondInstanceLockHit({ hb: null, now: 1000, pidAliveOf: aliveOf }), '无心跳文件 ⇒ 可接管');
  assert.ok(!secondInstanceLockHit({ hb: { pid: 0, ts: 1000 }, now: 1000, pidAliveOf: aliveOf }), 'pid 非法 ⇒ 可接管');
  assert.ok(!secondInstanceLockHit({ hb: { pid: 1.5, ts: 1000 }, now: 1000, pidAliveOf: aliveOf }), 'pid 非整数 ⇒ 可接管');
  let seenPid = null;
  secondInstanceLockHit({
    hb: { pid: DAEMON_PID, ts: 1000 },
    now: 1000,
    pidAliveOf: (p) => {
      seenPid = p;
      return false;
    },
  });
  assert.equal(seenPid, DAEMON_PID, '锁判据必须把心跳里的 pid 交给进程判活回调');
  assert.match(
    STACK_SRC,
    /secondInstanceLockHit\(\{ hb: hb0, now: Date\.now\(\), pidAliveOf: \(p\) => pidAlive\(p\) \}\)/,
    '生产侧必须把真 tasklist 判活接进锁判据(接错=锁失明)',
  );
});

test('续写判据:第一枚无条件,之后按节律;坏输入不冒充"该写"', () => {
  assert.ok(heartbeatShouldRefresh({ lastTs: 0, now: T0 }), '第一枚必须无条件落地(冷启动第 0 秒)');
  assert.ok(!heartbeatShouldRefresh({ lastTs: T0, now: T0 + HEARTBEAT_REFRESH_MS - 1 }), '节律未到不打盘');
  assert.ok(heartbeatShouldRefresh({ lastTs: T0, now: T0 + HEARTBEAT_REFRESH_MS }), '节律到点必须续写');
  assert.ok(heartbeatShouldRefresh({ lastTs: T0, now: T0 + 1, refreshMs: 0 }), '阶段交接(refreshMs=0)无条件落一枚');
  assert.ok(!heartbeatShouldRefresh({ lastTs: T0, now: Number.NaN }), '时钟取不到 ⇒ 不写');
  assert.ok(!heartbeatShouldRefresh({ lastTs: T0, now: 0 }), 'now=0 属取不到时钟 ⇒ 不写');
  // 坏 lastTs 与"还没写过"同档(0):写方陈述的是"我此刻活着且在推进",落一枚永远比不落诚实
  assert.ok(heartbeatShouldRefresh({ lastTs: Number.NaN, now: T0 }), '坏 lastTs ⇒ 按第一枚处理(落盘)');
});

// ───────────────── 三、现场时间轴:160s 冷启动全程判健康(病理本体) ─────────────────

test('现场时间轴(22:11:13→22:13:53):旧病理落点在新实现里判 healthy', () => {
  const { landed } = replayHeartbeat(grid(0, COLD_START_MS, POLL_STEP_MS));
  assert.ok(landed.length >= 8, `冷启动期心跳落盘次数过少(现 ${landed.length}),等于还有空窗`);
  for (const at of [SPURIOUS_REVIVE_AT_MS, NEXT_PATROL_AT_MS]) {
    const cur = replayHeartbeat(grid(0, Math.min(at, COLD_START_MS), POLL_STEP_MS)).hb;
    assert.equal(
      verdictAt(cur, at),
      'healthy',
      `巡检 t=+${Math.round(at / 1000)}s(现场 22:12:04 / 22:14:04)必须判 healthy —— 判 revive 就是本次要消灭的无效复活`,
    );
  }
  // 冷启动窗口内逐 POLL_STEP 扫一遍:任何一刻都不许出现空窗(空窗即会被巡检抓到并多派一头)
  for (const at of grid(0, COLD_START_MS, POLL_STEP_MS)) {
    const cur = replayHeartbeat(grid(0, at, POLL_STEP_MS)).hb;
    assert.equal(verdictAt(cur, at), 'healthy', `t=+${at}ms 出现心跳空窗`);
  }
});

test('反向对照:旧行为在同一落点必须仍判 revive(证明牙还在)', () => {
  // 旧实现 (a):进入 watch 块才写第一枚心跳 ⇒ 现场 22:12:04(+51s)时文件根本不存在
  // (巡检日志原文就是「心跳缺失,需要复活」)
  const oldEvents = [COLD_START_MS, ...grid(COLD_START_MS + 30_000, COLD_START_MS + 5 * PATROL_STEP_MS, 30_000)];
  const oldAt51 = replayHeartbeat(oldEvents.filter((e) => e <= SPURIOUS_REVIVE_AT_MS));
  assert.equal(oldAt51.hb, null, '旧行为在 +51s 应还没有任何心跳');
  assert.equal(
    verdictAt(oldAt51.hb, SPURIOUS_REVIVE_AT_MS),
    'revive',
    '旧病理必须仍被判 revive(证明这一型确由缺心跳引起,而不是判据本身失灵)',
  );
  // 旧实现 (b):心跳只在 rawTick 首行写,而单轮最坏 7 条腿×45s ⇒ 现场实测 22:45:44 落的
  // 心跳在 22:46:44 已龄 85s。同一形状在新实现里(每轮 tick + 每条腿 + 每次探活都是写点)不留空窗。
  const starveMoment = LONG_TICK_MS + HEARTBEAT_FRESH_MS; // 长 tick 进行到恰好 90s
  const oldAtStarve = replayHeartbeat(grid(0, starveMoment, LONG_TICK_MS));
  assert.equal(oldAtStarve.hb.ts, T0 + LONG_TICK_MS, '旧实现最后一枚心跳停在上一轮 tick 首行');
  assert.equal(verdictAt(oldAtStarve.hb, starveMoment), 'revive', '旧实现的"长 tick"同样会被判死(阳性对照)');
  const newAtStarve = replayHeartbeat(grid(0, starveMoment, POLL_STEP_MS));
  assert.equal(verdictAt(newAtStarve.hb, starveMoment), 'healthy', '新实现同一形状必须不空窗');
});

test('常驻期:冷启动之后连续 5 轮巡检全程 healthy', () => {
  const events = [...grid(0, COLD_START_MS, POLL_STEP_MS), ...grid(COLD_START_MS, COLD_START_MS + 5 * PATROL_STEP_MS, 4_000)];
  for (const at of grid(PATROL_STEP_MS, COLD_START_MS + 5 * PATROL_STEP_MS, PATROL_STEP_MS)) {
    const { hb } = replayHeartbeat(events.filter((e) => e <= at));
    assert.equal(verdictAt(hb, at), 'healthy', `巡检 +${at}ms 空窗`);
  }
});

// ───────────── 四、自愈不许降速:真死与卡死的检测口径必须与改动前一致 ─────────────

test('守护真死:心跳停更后 89s 仍判健康、91s 即判 revive(与改动前同界)', () => {
  const deathAt = 200_000;
  const { hb, landed } = replayHeartbeat(grid(0, deathAt, POLL_STEP_MS));
  const lastWriteOff = landed[landed.length - 1];
  assert.equal(hb.ts, T0 + lastWriteOff);
  assert.ok(hb.ts <= T0 + deathAt, '心跳不得越过进程死亡时刻继续前进');
  // 死亡之后没有任何推进事件(进程都不在了,写点根本不会被调用)⇒ 心跳必然停更
  assert.deepEqual(replayHeartbeat([], { lastTs: Number(hb.ts) }).landed, [], '进程死后不得再有心跳落盘');
  assert.equal(verdictAt(hb, lastWriteOff + HEARTBEAT_FRESH_MS - 1000), 'healthy', '新鲜窗口内不得提前复活');
  assert.equal(verdictAt(hb, lastWriteOff + HEARTBEAT_FRESH_MS + 1000), 'revive', '过期即复活,阈值没被放宽');
  // 另一维独立生效:同一枚新鲜心跳,pid 判活为假 ⇒ 立刻 revive(不等过期)
  assert.equal(verdictAt(hb, lastWriteOff + 1000, false), 'revive', 'pid 判活那一维必须独立起作用');
});

test('真死检测上界 = 新鲜阈值 + 巡检节律,与旧实现逐毫秒相同', () => {
  const worstMs = HEARTBEAT_FRESH_MS + PATROL_INTERVAL_MINUTES * 60_000;
  assert.equal(worstMs, 90_000 + 120_000, '上界必须等于现场口径(90s 新鲜 + 2 分钟巡检)');
  // 巡检脚本的阈值与节律都没被本次改动触碰(防"顺手放宽")
  assert.match(WATCHDOG_SRC, /const FRESH_MS = 90_000;/);
  assert.doesNotMatch(WATCHDOG_SRC, /const FRESH_MS = (9\d{4,}|[1-9]\d{5,});/);
  assert.match(WATCHDOG_SRC, /const PATROL_INTERVAL_MINUTES = 2;/);
  // 反向牙:把"任务在跑就宽限"塞进巡检 ⇒ 卡死的守护永不复活,本仓禁止该出路
  assert.doesNotMatch(WATCHDOG_SRC, /SCHED_S_TASK_RUNNING|267009|Get-ScheduledTaskInfo/, '巡检侧不得引入任务态宽限');
});

test('卡死(进程还在但不再推进)必须仍能让心跳过期:写点只挂在推进事件上', () => {
  const stalledAt = 60_000; // 冷启动中途卡死:最后一个推进事件在 60s
  const { hb, landed } = replayHeartbeat(grid(0, stalledAt, POLL_STEP_MS));
  assert.ok(landed.length >= 2, '停滞前的心跳必须确实落过盘');
  assert.ok(hb.ts <= T0 + stalledAt, '心跳不得越过最后一个推进事件继续前进');
  assert.ok(
    stalledAt - landed[landed.length - 1] < POLL_STEP_MS + HEARTBEAT_REFRESH_MS,
    `最后一个推进事件与最后落盘心跳之间不得留空窗(实差 ${stalledAt - landed[landed.length - 1]}ms)`,
  );
  assert.equal(verdictAt(hb, stalledAt + PATROL_STEP_MS), 'revive', '卡死但 pid 还活着也必须被复活');
  // 反证"没有无条件续写源":停滞之后不再喂推进事件 ⇒ 复演不得再落任何一枚
  assert.deepEqual(replayHeartbeat([], { lastTs: Number(hb.ts) }).landed, [], '只有推进事件才续写');
});

// ───────────── 五、形状锁:写点顺序与"只在守护形态写心跳" ─────────────

test('形状锁:锁检查 → 心跳开关 → 第一枚心跳,全部排在 await run() 之前', () => {
  const lockAt = STACK_SRC.indexOf('secondInstanceLockHit({');
  const enableAt = STACK_SRC.indexOf('heartbeatEnabled = true;');
  const firstWriteAt = STACK_SRC.indexOf('writeHeartbeat(HEARTBEAT_PHASE_STARTUP)', enableAt);
  const runAt = STACK_SRC.indexOf('const code = await run()');
  assert.ok(lockAt > 0, 'main() 必须调用 secondInstanceLockHit');
  assert.ok(enableAt > 0, '守护形态心跳开关必须存在');
  assert.ok(firstWriteAt > 0, '进入初始启动阶段前必须写第一枚心跳');
  assert.ok(runAt > 0, 'run() 调用点必须存在(形状锁锚点)');
  assert.ok(lockAt < enableAt, '先判锁再开心跳:锁命中即退场,不得抢写在跑那头的锁');
  assert.ok(enableAt < firstWriteAt, '开关打开后才谈落盘');
  assert.ok(firstWriteAt < runAt, '第一枚心跳必须在初始启动阶段之前落地(否则本次修复无效)');
  assert.match(STACK_SRC.slice(lockAt - 200, enableAt + 400), /process\.exit\(0\)/, '锁命中应以 0 退场');
  // 进入 watch 块后先翻阶段,再跑首轮 tick(rawTick 单轮最坏 7×45s)
  const watchBlock = STACK_SRC.slice(runAt);
  const entryWrite = watchBlock.indexOf('writeHeartbeat(HEARTBEAT_PHASE_WATCH)');
  const firstTick = watchBlock.indexOf('await tick()');
  assert.ok(entryWrite > 0 && firstTick > entryWrite, 'watch 块内必须先翻阶段再跑首轮 tick');
});

test('形状锁:心跳只在守护形态写;推进事件覆盖每条腿/每次探活/每轮 tick', () => {
  assert.equal(STACK_SRC.split('heartbeatEnabled = true;').length - 1, 1, '开关只能有一处赋值(多处必漂移)');
  const enableAt = STACK_SRC.indexOf('heartbeatEnabled = true;');
  const watchGuardAt = STACK_SRC.lastIndexOf('if (watchMode) {', enableAt);
  assert.ok(watchGuardAt >= 0, '开关必须在 watchMode 分支内打开');
  assert.ok(enableAt - watchGuardAt < 600, '开关应紧贴 watchMode 分支,不得漂到别处');
  // 推进事件写点:探活轮询、初始启动逐腿、复检逐腿、tick 起点、adb 每条转发、taskkill 每条
  assert.match(
    STACK_SRC,
    /while \(Date\.now\(\) < deadline\) \{[^{}]{0,400}?writeHeartbeat\(\);/,
    'waitReady 轮询必须带心跳写点(否则单腿 120s 就空窗)',
  );
  assert.match(
    STACK_SRC,
    /for \(const svc of targets\) \{[^{}]{0,200}?writeHeartbeat\(HEARTBEAT_PHASE_STARTUP\);/,
    '初始启动阶段必须逐腿写心跳',
  );
  assert.match(
    STACK_SRC,
    /for \(const svc of targets\) \{[^{}]{0,200}?writeHeartbeat\(HEARTBEAT_PHASE_WATCH\);/,
    '常驻复检必须逐腿写心跳',
  );
  const writeSites = (STACK_SRC.match(/writeHeartbeat\(/g) || []).length;
  assert.ok(writeSites >= 9, `写点总数不得少于 8 处 + 1 处定义(实得 ${writeSites})`);
  // 心跳文件是锁的载体:任何删除它的动作都会自造"从未跑过"窗口
  assert.doesNotMatch(STACK_SRC, /rmSync\([^)]*HEARTBEAT/, '不得删除心跳文件');
  assert.doesNotMatch(WATCHDOG_SRC, /rmSync\([^)]*HB_FILE/, '巡检侧不得删除心跳文件');
});

test('落点:默认仍是线上那枚,测试缝只改路径不改判据', () => {
  const def = heartbeatPath({});
  assert.ok(def.endsWith(path.join('.tmp-sync', HEARTBEAT_FILE_NAME)), `默认落点漂移: ${def}`);
  assert.ok(fs.existsSync(def), '默认落点必须存在(线上守护正在写它)—— 本测试只读,绝不写');
  assert.equal(heartbeatPath({ [HEARTBEAT_FILE_ENV]: path.join('X:', 'hb.json') }), path.join('X:', 'hb.json'));
  assert.equal(heartbeatPath({ [HEARTBEAT_FILE_ENV]: '   ' }), def, '空串/纯空白不算重定向(不猜意图)');
});

// ───────────── 六、真跑子进程:锁命中退场 / 一次性形态不冒充守护 ─────────────

/** 派生子进程必须显式接管 stdio + windowsHide(§12g);输出全量回读,不留缓冲 */
function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: SCRIPTS_DIR,
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test('真跑:心跳新鲜且 pid 活着 ⇒ 第二个 --watch 实例立刻退场,且不覆盖在跑那枚心跳', async () => {
  const scratch = mkScratch('dev-stack-coldstart-lock');
  const hbPath = path.join(scratch, 'hb.json');
  // 用测试自身 pid(node.exe,tasklist 必判活)冒充"已有守护";心跳当下就新鲜
  fs.writeFileSync(hbPath, JSON.stringify({ pid: process.pid, ts: Date.now(), phase: HEARTBEAT_PHASE_WATCH }));
  const before = fs.readFileSync(hbPath, 'utf8');
  const r = await runNode([path.join(SCRIPTS_DIR, 'dev-stack.mjs'), '--watch', '--only=__no_such_service__'], {
    [HEARTBEAT_FILE_ENV]: hbPath,
  });
  try {
    assert.match(r.stdout, /本实例退出\(防双开\)/, `锁未生效就跑了启动阶段: ${r.stdout}|${r.stderr}`);
    assert.equal(r.code, 0, `锁命中应以 0 退场(实得 ${r.code}/${r.signal})`);
    assert.doesNotMatch(r.stdout, /本地服务栈|守护中:/, '锁命中后不得再跑初始启动阶段,也不得进守护循环');
    assert.equal(fs.readFileSync(hbPath, 'utf8'), before, '锁命中不得改写正在跑的守护的心跳(改了就是抢锁)');
  } finally {
    rmScratch(scratch);
  }
});

test('真跑:--check 只体检,不写心跳(否则注定退场的 pid 会冒充守护)', async () => {
  const scratch = mkScratch('dev-stack-coldstart-check');
  const hbPath = path.join(scratch, 'hb.json');
  const r = await runNode([path.join(SCRIPTS_DIR, 'dev-stack.mjs'), '--check', '--json'], {
    [HEARTBEAT_FILE_ENV]: hbPath,
    DEV_STACK_NO_FOREIGN_LEG_PREEMPT: '1',
  });
  try {
    assert.ok(
      [0, 1].includes(r.code),
      `--check 应只按体检结果退场(实得 ${r.code}/${r.signal}): ${r.stderr.slice(0, 200)}`,
    );
    assert.ok(r.stdout.includes('"results"'), `--json 应有结果: ${r.stdout.slice(0, 200)}`);
    assert.ok(!fs.existsSync(hbPath), '一次性体检/--check 不得落心跳');
  } finally {
    rmScratch(scratch);
  }
});

// ───────────── 七、落选方案登记:启动器仍用 'w' 截日志(本次刻意未改) ─────────────

test('登记:方案②(启动器不再截日志)本次未上,截断点原样留档备查', () => {
  // 证据必须钉住"判据为什么不需要它":冷启动期不再产生 revive ⇒ 不会再有第二把 'w' 句柄
  assert.match(LAUNCHER_SRC, /fs\.openSync\(outPath, 'w'\)/, "spawnPipeChain 仍以 'w' 打开日志(本次未改)");
  assert.match(LAUNCHER_SRC, /fs\.openSync\(errPath, 'w'\)/, 'err 日志同上');
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
