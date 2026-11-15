#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * §22c 镜像测试 —— scripts/lib/disk-root-watch.mjs + git-guardian 挂点
 *
 * 照 audit-temp-landing.test.mjs 形态。钉死六件事:
 *   T1 盘根外流(diskRootStray>0) ⇒ notifyGuardRed 点名,报出条目路径,不报"2 个"吞名字;
 *   T2 节流窗口内 ⇒ 不重复派生卫生尺(同 tick 二次调用 ran=false);
 *   T3 取不到读数(rc≠0 / JSON 坏) ⇒ 「未判定」+**不推进节流戳**(一次失败不能瞎一窗口);
 *   T4 全绿 ⇒ 安静(不点名、notifyGuardRed 不触发);
 *   T5 装车锁:挂点必须在 `!CHECK_ONLY` 分支,且节流默认 10min、可 env 覆盖;
 *   T6 notifyGuardRed 两参签名:实参走 (name, detail),不把整串塞进 name。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { auditDiskRootWatch } from '../lib/disk-root-watch.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const WATCH_SRC = readFileSync(resolve(import.meta.dirname, '..', 'lib', 'disk-root-watch.mjs'), 'utf8')

const fixture = () => {
  const dir = mkScratch('disk-root-watch-')
  return { tickFile: join(dir, 'tick.ts') }
}

/** 造一个返回固定 JSON 的 runner(绕过真实派生,保持确定性)。 */
const jsonRunner = (obj, status = 0) => () => ({
  status,
  parsed: obj,
  raw: JSON.stringify(obj),
  stderr: '',
})

const greenParsed = {
  verdict: 'green',
  counts: { diskRootStray: 0, declaredContentStray: 0, worktreeOutside: 0 },
  violations: [],
}
const strayParsed = (n, entries) => ({
  verdict: 'red',
  counts: { diskRootStray: n, declaredContentStray: 0, worktreeOutside: 0 },
  violations: entries.map((e) => ({ kind: 'stray-root-entry', ...e })),
})

test('T1 盘根外流 ⇒ notifyGuardRed 点名,报出条目路径不吞名字', async () => {
  const f = fixture()
  const reds = []
  const logs = []
  const r = await auditDiskRootWatch({
    runner: jsonRunner(strayParsed(2, [
      { root: 'D:/', entry: '.turbo', path: 'D:/.turbo' },
      { root: 'C:/', entry: 'empty-d1b', path: 'C:/empty-d1b' },
    ])),
    logger: (l) => logs.push(l),
    notifyGuardRed: (name, detail) => reds.push({ name, detail }),
    tickFile: f.tickFile,
    now: Date.now(),
  })
  assert.equal(r.ran, true, '本轮应跑')
  assert.equal(r.ok, false, '外流 ⇒ 不 ok')
  assert.equal(r.stray, 2)
  assert.equal(reds.length, 1, '必须走到人通道')
  const detail = reds[0].detail || ''
  assert.match(detail, /D:\/\.turbo/, '必须点名 .turbo 路径')
  assert.match(detail, /C:\/empty-d1b/, '必须点名 empty-d1b 路径')
  assert.ok(!/检测到 2 个.*——\s*·/.test(detail), '不得把条目名吞成"2 个"+空点名')
})

test('T2 节流窗口内 ⇒ 不重复派生卫生尺', async () => {
  const f = fixture()
  let calls = 0
  const runner = () => {
    calls += 1
    return { status: 0, parsed: greenParsed, raw: '{}', stderr: '' }
  }
  const now = Date.now()
  auditDiskRootWatch({ runner, tickFile: f.tickFile, now })
  const r2 = await auditDiskRootWatch({ runner, tickFile: f.tickFile, now: now + 60_000 })
  assert.equal(calls, 1, '节流窗口内只派生一次')
  assert.equal(r2.ran, false)
  assert.equal(r2.why, '未到节流窗口')
})

test('T3 取不到读数 ⇒ 未判定且不推进节流戳(不瞎一窗口)', async () => {
  const f = fixture()
  const logs = []
  const reds = []
  const r = await auditDiskRootWatch({
    runner: () => ({ status: 2, parsed: null, raw: '', stderr: 'boom' }),
    logger: (l) => logs.push(l),
    notifyGuardRed: (name, detail) => reds.push({ name, detail }),
    tickFile: f.tickFile,
    now: Date.now(),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.why, '未判定')
  assert.equal(reds.length, 0, '未判定不得走到人通道(不冒红)')
  assert.ok(logs.length >= 1, '必须落日志说明未判定原因')
  // 不推进节流戳 ⇒ 紧接着再调应真跑(不被白占窗口)
  const r2 = await auditDiskRootWatch({
    runner: jsonRunner(greenParsed),
    tickFile: f.tickFile,
    now: Date.now() + 1000,
  })
  assert.equal(r2.ran, true, '未判定后节流戳不得推进,下轮应重试')
})

test('T4 全绿 ⇒ 安静(不点名、notifyGuardRed 不触发)', async () => {
  const f = fixture()
  const reds = []
  const logs = []
  const r = await auditDiskRootWatch({
    runner: jsonRunner(greenParsed),
    logger: (l) => logs.push(l),
    notifyGuardRed: (name, detail) => reds.push({ name, detail }),
    tickFile: f.tickFile,
    now: Date.now(),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.verdict, 'green')
  assert.equal(reds.length, 0, '健康时不得喊人')
  assert.equal(logs.length, 0, '健康时安静(本日志既有约定)')
})

test('T5 装车锁:挂点在 !CHECK_ONLY 块内 + 默认 10min + env 可覆盖', () => {
  // 挂点锁:必须在 !CHECK_ONLY 块内(2026-11-14 双层化后,轮询+实时共用一个 if (!CHECK_ONLY) {...} 块,
  // 故不能再断言"同一行",改为断言"挂点行的最近一个块开启 if 是 !CHECK_ONLY")。
  const lines = SRC.split('\n')
  const hangIdx = lines.findIndex((l) => l.includes('auditDiskRootWatch({ notifyGuardRed'))
  assert.ok(hangIdx >= 0, 'git-guardian.mjs 必须有 auditDiskRootWatch 挂点')
  // 向上找最近的块开启行,必须是 !CHECK_ONLY(保证 --check 零副作用)
  let opener = null
  for (let i = hangIdx; i >= 0; i--) {
    if (/if \(!CHECK_ONLY\)/.test(lines[i])) {
      opener = lines[i]
      break
    }
    // 若先撞到别的块开启(`{` 结尾)且不是本块,视为结构异常
    if (/^\s*if \(.*\)\s*\{\s*$/.test(lines[i]) && i !== hangIdx) {
      opener = lines[i]
      break
    }
  }
  assert.ok(opener && /if \(!CHECK_ONLY\)/.test(opener), `挂点必须在 !CHECK_ONLY 块内(--check 零副作用),实际最近块开启行:${opener}`)
  // 双层防线:实时监听也在同一 !CHECK_ONLY 块内。
  // 允许 startDiskRootLiveWatch / startDiskRootLiveWatchOnce(幂等守卫)—— daemon 常驻每轮走到挂点,
  // 裸 startDiskRootLiveWatch 会重复挂 watcher 泄漏句柄,故生产接线用 Once 包装;两者都算在位。
  // 用前缀 if (!CHECK_ONLY) 过滤掉 startDiskRootLiveWatchOnce 的函数定义行(定义不带挂点前缀)。
  const liveIdx = lines.findIndex((l) => /if \(!CHECK_ONLY\) startDiskRootLiveWatch(Once)?\(\{/.test(l))
  assert.ok(liveIdx > hangIdx && liveIdx - hangIdx < 8, '实时监听须紧跟轮询哨兵,同块内(间隔 beatRoundLock+注释)')
  // 默认节流 10min
  assert.match(WATCH_SRC, /10 \* 60 \* 1000/, '默认节流须 10min')
  assert.match(WATCH_SRC, /IHUI_DISK_ROOT_WATCH_INTERVAL_MS/, '节流须可 env 覆盖')
  // 判据单一真相源:不得在哨兵里重写白名单判据
  assert.ok(!/allowlist\s*=|new Set\(.*allow/i.test(WATCH_SRC.replace(/import.*\n/g, '')), '哨兵不得重抄白名单判据(单一真相源=卫生尺)')
})

test('T6 notifyGuardRed 两参签名:实参走 (name, detail)', () => {
  const callLine = WATCH_SRC.split('\n').find((l) => l.includes('notifyGuardRed(') && l.includes('盘根外流实时哨兵'))
  assert.ok(callLine, '必须有 notifyGuardRed(name, detail) 形态的调用')
  assert.match(callLine, /notifyGuardRed\(\s*['"`][^'"`]+['"`]\s*,\s*\w+\s*\)/, '必须传 (name, detail) 两参,不把整串塞 name')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
