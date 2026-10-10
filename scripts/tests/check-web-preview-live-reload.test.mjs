// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「:8806 预览自动刷新链路判据」镜像测试(§22c:直接 import 源模块,不复制实现,
 * 不碰网络——判据断言一律喂**今天现测到的真实形状**,不是拿真仓瞬时状态当尺子)。
 *
 * 要钉死的事:
 *  1. bundle URL 提取与 reload 协议帧(`{version:2, method:'reload'}`)逐字符合运行中的
 *     @expo/cli 服务器实测读数(不带 version=2 的消息服务器会静默丢弃——今天就踩过一次 NO-ECHO);
 *  2. /hot 消息归类的"初始 vs 增量"边界:初始注册回路的 update/update-done 绝不能触发重载
 *     (否则每个打开预览的页面刚连上就被自己刷一遍),非初始的 update / 带 changeId 的
 *     update-done / 注册后 error 必须触发(编译错误也要如实刷新反映状态);
 *  3. decide/decideStatus 的退出码优先级:未判定(:8806 不可达) > 红 > 绿,
 *     不可达时**绝不**下"桥坏了"的红结论(AGENTS §12e 机器运行态不判恒红);
 *  4. 装载锁:判据脚本必须 import 桥的单一真相源,且两文件都不得被接进提交链。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as B } from '../web-preview-live-reload.mjs'
import { __test__ as C } from '../check-web-preview-live-reload.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// ——— 2026-10-10 现测于 http://127.0.0.1:8806 的真实形状 ———
const LIVE_HTML =
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="root"></div>' +
  '<script src="/apps/mobile-rn/App.tsx.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable" defer></script>' +
  '</body></html>'
const HOT_INITIAL_UPDATE_START = '{"type":"update-start","body":{"isInitialUpdate":true}}'
const HOT_INITIAL_UPDATE =
  '{"type":"update","body":{"revisionId":"5e9ca365de4778d8","isInitialUpdate":true,"added":[],"modified":[],"deleted":[]}}'
const HOT_INITIAL_DONE = '{"type":"update-done","body":{}}'
const HOT_REGISTERED = '{"type":"bundle-registered"}'
const HOT_LIVE_UPDATE =
  '{"type":"update","body":{"revisionId":"ac1664db31f4ef47","isInitialUpdate":false,"added":[],"modified":[{"module":[0,"__d(function (global…"]}],"deleted":[]}}'
const HOT_LIVE_DONE =
  '{"type":"update-done","body":{"changeId":"3916fdf9-f6a9-40ea-a06d-2de7768dd948"}}'

test('extractBundleUrl:从现测 HTML 逐字取出含 hot=false 的注入 URL', () => {
  const rel = B.extractBundleUrl(LIVE_HTML)
  assert.ok(rel, '取不到 bundle URL 则 A 轴失去意义')
  assert.ok(rel.startsWith('/apps/mobile-rn/App.tsx.bundle?'), rel)
  assert.ok(rel.includes('hot=false'), 'hot=false 逐字保留(它是取证对象,不是过滤对象)')
  assert.equal(B.extractBundleUrl('<html><body>nothing</body></html>'), null)
  assert.equal(B.extractBundleUrl(''), null)
})

test('reload 协议帧:version=2 必须在帧内,method=reload(服务器只转发 version===2)', () => {
  const msg = JSON.parse(B.RELOAD_MSG)
  assert.equal(msg.version, 2)
  assert.equal(msg.method, 'reload')
  assert.equal(B.PROTOCOL_VERSION, 2)
})

test('classifyHotMessage:初始注册回路一律 ignore(触发它=页面一连上就自刷)', () => {
  for (const raw of [
    HOT_INITIAL_UPDATE_START,
    HOT_INITIAL_UPDATE,
    HOT_INITIAL_DONE,
    HOT_REGISTERED,
  ]) {
    const cls = B.classifyHotMessage(raw, { registered: false })
    if (raw === HOT_REGISTERED) assert.equal(cls.kind, 'registered')
    else assert.equal(cls.kind, 'ignore', `初始回路不该触发:` + raw.slice(0, 60))
  }
})

test('classifyHotMessage:非初始 update / 带 changeId 的 done / 注册后 error ⇒ trigger', () => {
  assert.equal(B.classifyHotMessage(HOT_LIVE_UPDATE, { registered: true }).kind, 'trigger')
  const done = B.classifyHotMessage(HOT_LIVE_DONE, { registered: true })
  assert.equal(done.kind, 'trigger')
  assert.equal(done.changeId, '3916fdf9-f6a9-40ea-a06d-2de7768dd948')
  assert.equal(
    B.classifyHotMessage('{"type":"error","body":"bundling failed"}', { registered: true }).reason,
    'hot-error',
  )
})

test('classifyHotMessage:注册前的 error 是自家 GraphNotFound 类故障 ⇒ bootstrap-error,不刷页面', () => {
  assert.equal(
    B.classifyHotMessage('{"type":"error","body":{"message":"GraphNotFound"}}', {
      registered: false,
    }).kind,
    'bootstrap-error',
  )
})

test('classifyHotMessage:垃圾输入不崩也不触发', () => {
  for (const raw of ['not json', '', '{}', '{"type":123}', 'null']) {
    assert.equal(B.classifyHotMessage(raw, { registered: true }).kind, 'ignore')
  }
})

test('decideStatus:不可达=未判定(2)优先,绝不因"服务没起"判桥红', () => {
  const r = B.decideStatus({ reachable: false, status: null })
  assert.equal(r.code, 2)
  const deadButDontJudge = B.decideStatus({
    reachable: false,
    status: { ts: new Date().toISOString(), phase: 'listening' },
  })
  assert.equal(deadButDontJudge.code, 2, '8806 不在 ⇒ 即便状态文件新鲜也不能判任何一边')
})

test('decideStatus:8806 在而桥缺/心跳陈旧 ⇒ 红;新鲜 ⇒ 绿', () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0)
  assert.equal(B.decideStatus({ reachable: true, status: null }, now).code, 1)
  assert.equal(
    B.decideStatus({ reachable: true, status: { ts: new Date(now - 120_000).toISOString() } }, now)
      .code,
    1,
  )
  const green = B.decideStatus(
    {
      reachable: true,
      status: {
        ts: new Date(now - 10_000).toISOString(),
        phase: 'listening',
        reloadsSent: 3,
        pid: 4242,
      },
    },
    now,
  )
  assert.equal(green.code, 0)
  assert.ok(green.line.includes('reloadsSent=3'))
})

const GREEN_R = () => ({
  endpoint: {
    status: 'ok',
    bundleUrl: '/apps/mobile-rn/App.tsx.bundle?platform=web&dev=true&hot=false',
  },
  listener: { status: 'ok', bytes: 29_058_912, found: [...C.LISTENER_MARKERS] },
  sockets: [
    { path: '/hot', status: 'open' },
    { path: '/message', status: 'open' },
  ],
  bridge: { status: 'ok', ageMs: 8000, phase: 'listening', reloadsSent: 1, lastTrigger: null },
  relay: null,
})

test('decide:全绿 ⇒ 0,且 D 轴默认 SKIPPED(有创中继不旗标不跑)', () => {
  const r = C.decide(GREEN_R())
  assert.equal(r.code, 0, r.lines.join('\n'))
  assert.ok(r.lines.some((l) => l.startsWith('D relay    : SKIPPED')))
})

test('decide:endpoint 不可达 ⇒ 2 且早退,不带任何下游红字(未判定优先)', () => {
  const r = C.decide({
    endpoint: { status: 'unreachable', error: 'ECONNREFUSED' },
    listener: { status: 'unreachable' },
    sockets: [],
    bridge: { status: 'missing' },
    relay: null,
  })
  assert.equal(r.code, 2)
  assert.ok(r.lines[0].includes('ECONNREFUSED'))
  assert.ok(!r.lines.some((l) => l.includes('红')), '不可达时不得输出红字——机器没开预览不是门的事')
})

test('decide:监听标记没在交付内容里 ⇒ 红(这正是"接线绿而链路不通"要抓的形态)', () => {
  const r = C.decide({
    ...GREEN_R(),
    listener: { status: 'ok', bytes: 29_058_912, found: [C.LISTENER_MARKERS[0]] },
  })
  assert.equal(r.code, 1)
  assert.ok(r.lines.join('\n').includes('缺标记'))
})

test('decide:桥缺失 ⇒ 红;relay no-echo ⇒ 红;红与未判定并存时红优先', () => {
  assert.equal(C.decide({ ...GREEN_R(), bridge: { status: 'missing' } }).code, 1)
  assert.equal(
    C.decide({ ...GREEN_R(), relay: { status: 'no-echo', error: '3s 内无中继回环' } }).code,
    1,
  )
  const both = C.decide({
    ...GREEN_R(),
    listener: { status: 'timeout', error: '>90000ms' },
    bridge: { status: 'missing' },
  })
  assert.equal(both.code, 1, 'B 轴超时(未判定级)与桥红并存 ⇒ 整体仍是红')
})

test('decide:/hot 或 /message 连不上 ⇒ 红(通道断在服务器侧)', () => {
  const r = C.decide({
    ...GREEN_R(),
    sockets: [
      { path: '/hot', status: 'open' },
      { path: '/message', status: 'fail', error: 'ws-error' },
    ],
  })
  assert.equal(r.code, 1)
})

test('装载锁:判据必须 import 桥的单一真相源,不得另抄协议/解析', () => {
  const src = readFileSync(path.join(ROOT, 'scripts', 'check-web-preview-live-reload.mjs'), 'utf8')
  assert.ok(src.includes(`from './web-preview-live-reload.mjs'`), '判据必须 import 桥')
  assert.ok(
    !/version:\s*2\b/.test(src.split('__test__')[0].replace(/\/\/.*$/gm, '')),
    '判据内不得另写 version:2 帧(用 RELOAD_MSG)',
  )
})

test('定级锁(§12e):本门判机器运行态,绝不接进提交链', () => {
  const hook = readFileSync(path.join(ROOT, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  const runner = readFileSync(path.join(ROOT, 'scripts', 'all-checks-runner.mjs'), 'utf8')
  for (const [name, src] of [
    ['pre-commit-hook.js', hook],
    ['all-checks-runner.mjs', runner],
  ]) {
    assert.ok(
      !src.includes('web-preview-live-reload'),
      `${name} 引用了本门 ⇒ 把运行态门接进了提交链(恒红门事故形态)`,
    )
  }
})

// ── 本会话补:阈值单一真相锁(G-977963 第②半的落地期发现)────────────────
// 门里原本写着 45_000 这个字面量,而桥自判陈旧用的是 3 * HEARTBEAT_MS —— 数值今天相同,
// 但那是两份真相:谁调心跳间隔,门就会和桥答出两个"陈旧",而且账面都不红。
test('阈值单一真相锁:陈旧界限必须 import 桥的那个导出数,门内不得再写字面量', () => {
  const src = readFileSync(path.join(ROOT, 'scripts', 'check-web-preview-live-reload.mjs'), 'utf8')
  const body = src.split('__test__')[0]
  assert.ok(src.includes('STATUS_STALE_AFTER_MS'), '门必须引桥导出的 STATUS_STALE_AFTER_MS')
  // 阳性对照:把"回归形态"喂给下面那条锁,它必须抓住 —— 否则这条锁等于"我记得没有",不是有牙。
  assert.match('if (ageMs > 45_000) x', /ageMs\s*>\s*\d/, "'ageMs > 字面量'必须被下面那条锁抓住")
  assert.doesNotMatch(
    body,
    /ageMs\s*>\s*\d/,
    '门内不得出现"ageMs > 字面量"—— 陈旧界限只许住在桥那一处',
  )
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
