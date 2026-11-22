// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * App 更新卡对账派发腿的镜像测试(2026-11-03 立)。
 *
 * 立因:iOS 的 latest 行 + 自有站点腿今天上架了,而派发器此前**只跑 android 一端**。
 * 尺子的第③条现在按 `PLATFORM_PROFILES` 判 Content-Type ⇒ 派发面若不同步按端循环,新腿的
 * "行写新版本、腿回旧包"这一型就永远没人量(§0.9「造好没装车 = 没有」)。
 *
 * 钉死的是拆层后最容易丢的四件事:
 *   D1 两端各跑一次,argv/env 里的端名不能写死成 android;
 *   D2 告警身份必须含端名 —— 两端同时红要寄两封(共一条 key = 第二端永远静默,§5e-3);
 *   D3 状态件按端分开 —— 共一本连欠账会让另一端的起点被洗掉(抑制窗失去终态);
 *   D4 节流共用一枚:加端不得改变发信频次;
 *   D5 未判定不喊人(§0.3)、全绿清欠账;
 *   D6 装车锁:定义/循环调用/出口表/派发目标在位/尺子真接受 --platform。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  auditAppVersionLatest,
  auditAppVersionPlatform,
  APP_VER_PLATFORMS,
  appVersionStateFiles,
} from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const NOW = Date.parse('2026-11-03T06:00:00.000Z')

function verdict(state, platform, extras = {}) {
  return JSON.stringify({
    platform,
    state,
    red: state === 'fail' ? [{ id: `${platform}-downloadable`, detail: 'HTTP 404' }] : [],
    undetermined:
      state === 'undetermined' ? [{ id: 'endpoint', detail: 'ETIMEDOUT' }] : [],
    ...extras,
  })
}

/**
 * `verdictOf(platform)` 决定这一端尺子回什么;runner 记下自己收到了哪个端名,
 * 于是"写死 android"这种回归会被 D1 直接打红。
 */
function harness({ verdictOf = () => 'pass', scratchName = 'app-ver-dispatch' } = {}) {
  const scratch = mkScratch(scratchName)
  const tickFile = join(scratch, 'tick.ts')
  const seen = []
  const logs = []
  const mails = []
  const result = auditAppVersionLatest({
    now: NOW,
    tickFile,
    stateFilesFor: (platform) => ({
      firstFile: join(scratch, `first-${platform}.json`),
      lastFile: join(scratch, `last-${platform}.json`),
    }),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opts) => mails.push({ title, body, opts }),
    runner: ({ platform }) => {
      seen.push(platform)
      const state = verdictOf(platform)
      return {
        status: state === 'pass' ? 0 : state === 'fail' ? 1 : 2,
        stdout: verdict(state, platform),
        stderr: '',
      }
    },
  })
  return { result, seen, logs, mails, scratch, tickFile }
}

test('D1 端清单逐一派发,端名由循环传入(不得写死 android)', () => {
  const h = harness()
  assert.deepEqual(h.seen, [...APP_VER_PLATFORMS])
  assert.deepEqual(APP_VER_PLATFORMS, ['android', 'ios'], '端清单本身是判据:iOS 上架后必须并入')
  assert.equal(h.result.ran, true)
  assert.equal(h.result.judged, true)
  assert.equal(h.result.reds, 0)
  assert.equal(h.mails.length, 0)
  rmScratch(h.scratch)
})

test('D2 两端同时红 ⇒ 寄两封且身份含端名(共 key 会让第二端永远静默)', () => {
  const h = harness({ verdictOf: () => 'fail' })
  assert.equal(h.mails.length, 2)
  const keys = h.mails.map((m) => String(m.opts.dedupKey))
  assert.equal(new Set(keys).size, 2, `两条身份必须不同:${keys.join(' | ')}`)
  assert.match(keys[0], /platform=android/)
  assert.match(keys[1], /platform=ios/)
  assert.match(h.mails[0].title, /安卓/)
  assert.match(h.mails[1].title, /iOS/)
  assert.match(h.mails[1].body, /--platform ios/, '整改命令要点名出问题的那一端')
  assert.equal(h.result.reds, 2)
  rmScratch(h.scratch)
})

test('D2b 只有一端红 ⇒ 只喊那一端,正文点名该端端点', () => {
  const h = harness({ verdictOf: (p) => (p === 'ios' ? 'fail' : 'pass') })
  assert.equal(h.mails.length, 1)
  assert.match(h.mails[0].body, /platform=ios/)
  assert.equal(h.result.reds, 1)
  rmScratch(h.scratch)
})

test('D3 状态件按端分开落到各自路径(共一本账会洗掉另一端的连欠起点)', () => {
  const a = appVersionStateFiles('android')
  const i = appVersionStateFiles('ios')
  assert.notEqual(a.firstFile, i.firstFile)
  assert.notEqual(a.lastFile, i.lastFile)
  assert.match(a.firstFile, /app-version-latest-first-android\.json$/)
  const h = harness({ verdictOf: (p) => (p === 'android' ? 'undetermined' : 'pass') })
  assert.equal(existsSync(join(h.scratch, 'last-android.json')), true, '未判定也要留最后一轮读数')
  assert.equal(existsSync(join(h.scratch, 'last-ios.json')), true)
  rmScratch(h.scratch)
})

test('D4 节流戳只一枚:加端不改变发信频次', () => {
  const h = harness({ scratchName: 'app-ver-throttle' })
  let second = 0
  const r = auditAppVersionLatest({
    now: NOW + 60 * 60 * 1000,
    tickFile: h.tickFile,
    stateFilesFor: (platform) => ({
      firstFile: join(h.scratch, `first-${platform}.json`),
      lastFile: join(h.scratch, `last-${platform}.json`),
    }),
    logger: () => {},
    notify: () => {},
    runner: () => {
      second += 1
      return { status: 0, stdout: verdict('pass', 'x'), stderr: '' }
    },
  })
  assert.equal(r.ran, false, '本轮已写节流戳 ⇒ 6h 窗口内不得再跑')
  assert.equal(second, 0)
  rmScratch(h.scratch)
})

test('D5 未判定不喊人;结论取不到时如实记未判定并点名端', () => {
  const h = harness({ verdictOf: () => 'undetermined' })
  assert.equal(h.mails.length, 0, '网络抖动不是缺陷(§5e-1 可整改性准入)')
  assert.equal(h.result.judged, false)
  assert.equal(h.result.undetermined, 2)
  const scratch = mkScratch('app-ver-unparsed')
  const unparsed = auditAppVersionPlatform({
    platform: 'ios',
    now: NOW,
    logger: () => {},
    notify: () => {},
    firstFile: join(scratch, 'first-ios.json'),
    lastFile: join(scratch, 'last-ios.json'),
    runner: () => ({ status: 1, stdout: 'not json', stderr: 'boom' }),
  })
  assert.equal(unparsed.judged, false)
  assert.equal(unparsed.platform, 'ios')
  assert.equal(existsSync(join(scratch, 'last-ios.json')), false, '结论不可解析 ⇒ 不写最后一轮读数')
  rmScratch(scratch)
  rmScratch(h.scratch)
})

test('D5b 全绿要清掉该端的连欠台账(否则抑制窗没有终态)', () => {
  const scratch = mkScratch('app-ver-clear')
  const firstFile = join(scratch, 'first-android.json')
  writeFileSync(firstFile, JSON.stringify({ firstMs: NOW - 3_600_000 }), 'utf8')
  const r = auditAppVersionPlatform({
    platform: 'android',
    now: NOW,
    logger: () => {},
    notify: () => {},
    firstFile,
    lastFile: join(scratch, 'last-android.json'),
    runner: () => ({ status: 0, stdout: verdict('pass', 'android'), stderr: '' }),
  })
  assert.equal(r.judged, true)
  assert.equal(existsSync(firstFile), false, '成功后必须清欠账,否则下次故障从旧起点起算')
  rmScratch(scratch)
})

test('D6 装车锁:两层定义 + 循环调用 + 出口表 + 派发目标在位 + 尺子真吃 --platform', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'git-guardian.mjs'), 'utf-8')
  assert.match(src, /export function auditAppVersionLatest\(/)
  assert.match(src, /export function auditAppVersionPlatform\(/)
  assert.match(src, /if \(!CHECK_ONLY\) auditAppVersionLatest\(\)/, '必须挂在巡检轮体内')
  assert.match(src, /auditAppVersionPlatform\(\{[\s\S]{0,200}firstFile: sf\.firstFile/, '端级状态件必须由循环注入')
  assert.match(src, /--json', '--platform', platform/, '派生命令必须带端名')
  for (const name of ['auditAppVersionLatest', 'auditAppVersionPlatform', 'APP_VER_PLATFORMS']) {
    assert.match(src, new RegExp(`  ${name},\\n`), `${name} 必须在出口表里`)
  }
  assert.ok(
    existsSync(join(import.meta.dirname, '..', 'check-app-version-latest.mjs')),
    '派发目标必须真在位(门 89 R7 同型)',
  )
  const ruler = readFileSync(join(import.meta.dirname, '..', 'check-app-version-latest.mjs'), 'utf-8')
  assert.match(ruler, /else if \(a === '--platform'\)/, '尺子必须真解析 --platform')
  assert.match(ruler, /ios: \{[\s\S]{0,200}octet-stream/, 'iOS 档案必须在表内')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
