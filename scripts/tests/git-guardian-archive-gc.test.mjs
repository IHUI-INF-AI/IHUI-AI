// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-24 事故归档回收器**调度接线臂**的镜像测试(§22c:import 源模块 __test__,零复制实现)。
//
// 立因(票 goal-20261026-b14r3):回收器本体(scripts/archive-gc.mjs)与 11/11 镜像测试都在,
// HEAD 面 `git grep -l archive-gc` 只命中本体与测试 ⇒ 调度未接,判据在、工具在、无人调度
// (本仓最贵的失效型)。本臂把回收器挂进 guardian 巡检轮:以 dry-run 调 CLI、读数写日志留痕、
// 开关面默认关、读不到如实报未判定。真 --apply 永远由机主核过读数后手按 ⇒ 本层结构上不产 --apply。
//
// 钉的事:
//  (a) 装车锁:派发挂在**真正会执行**的分支(main 的 !CHECK_ONLY 一支 + daemon tick 各一处);
//  (b) dry-run 锁:实际派发的 argv 必须带 --root 与 --dry-run、**绝不带 --apply**(argv 面取证,
//      不是文案面 —— 文案里写一百遍"dry-run"也拦不住 argv 里混进 --apply);
//  (c) 默认关:开关配置 enabled=false ⇒ 一次都不派生;配置读不到/坏形 ⇒ 未判定(既不派生也不记绿);
//  (d) 三态不并桶:判干净 ⇒ ✅ / 未判定>0 或 rc=2 ⇒ ⚠️ 且 ok:false / 读数取不到 ⇒ ⚠️ 未跑成;
//  (e) 节流:未到窗口 ⇒ 零派生零日志;
//  (f) 归属锁:世代/双上限/未判定的判法只许住在回收器那一份实现里,本臂只解析它的人读汇总行。
// 全部构造输入 + 假 runner ⇒ 零真派生、零真删除、零生产开关面副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const DAY = 24 * 3_600_000
const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')
const LIB = readFileSync(join(HERE, '..', 'lib', 'git-guardian-archive-gc.mjs'), 'utf8')

function arm({ enabled = true, root = 'X:/fixture/archive', call = { status: 0, stdout: '', stderr: '' }, threshold } = {}) {
  const dir = mkScratch('archive-gc-arm-')
  const tickFile = join(dir, 'tick.iso')
  const flagFile = join(dir, 'scope-mismatch.flag')
  const configPath = join(dir, 'arm.json')
  if (enabled === 'missing') {
    // 不写配置 ⇒ 读不到
  } else if (enabled === 'broken') {
    writeFileSync(configPath, '{ 这不是 JSON', 'utf8')
  } else {
    writeFileSync(configPath, JSON.stringify({ enabled }), 'utf8')
  }
  const logs = []
  const argvs = []
  const run = () =>
    G.archiveGcDryRun({
      now: NOW,
      intervalMs: DAY,
      tickFile,
      flagFile,
      configPath,
      root,
      threshold,
      logger: (m) => logs.push(String(m)),
      runner: (argv) => {
        argvs.push(argv)
        return call
      },
    })
  return { dir, logs, argvs, run, tickFile, flagFile }
}

test('T1 装车锁:main() 单轮路径必须带 !CHECK_ONLY 旗调用本臂 —— 挂进 CHECK_ONLY 分支等于永不执行', () => {
  const mainBlock = SRC.slice(0, SRC.indexOf('function startDaemon'))
  assert.equal(
    /if \(!CHECK_ONLY\) archiveGcDryRun\(\)/.test(mainBlock),
    true,
    'main() 健康轮次分支里找不到 `if (!CHECK_ONLY) archiveGcDryRun()`',
  )
  assert.equal(/if \(CHECK_ONLY\) archiveGcDryRun/.test(SRC), false, '不得挂进 --check 路径(那是零副作用档)')
})

test('T2 装车锁:daemon tick 也要有一处调用(双执行体并存是本机实况),两处共用同一节流戳', () => {
  const daemonBlock = SRC.slice(SRC.indexOf('function startDaemon'))
  assert.match(daemonBlock, /archiveGcDryRun\(\)/, 'daemon 分支里必须同样派发')
  assert.ok(SRC.split('archiveGcDryRun()').length - 1 >= 2, '两处挂点缺一处 = 另一半执行体永不巡检')
  assert.match(LIB, /archive-gc-arm-tick\.iso/, '节流戳必须落在 state 下唯一一枚(双执行体共用)')
})

test('T3 dry-run 锁:实际派发的 argv 必含 --root 与 --dry-run,绝不含 --apply', () => {
  const a = arm({
    enabled: true,
    call: { status: 0, stdout: '[dry-run] 未发起任何删除。\n保留 12 / 待删 3 / 未判定 0\n', stderr: '' },
  })
  try {
    const r = a.run()
    assert.equal(a.argvs.length, 1, '开臂且到窗口 ⇒ 恰好派生一次')
    const argv = a.argvs[0]
    assert.ok(argv.includes('--dry-run'), `argv 缺 --dry-run:${JSON.stringify(argv)}`)
    assert.ok(argv.includes('--root'), '回收器 CLI 契约:--root 必填')
    assert.equal(argv[argv.indexOf('--root') + 1], 'X:/fixture/archive', '射程必须原样传给回收器')
    assert.equal(argv.includes('--apply'), false, '接线臂结构上不得产 --apply —— 真删是机主的动作')
    assert.match(String(argv[0]), /archive-gc\.mjs$/, '派生的必须是回收器本体那一份')
    assert.equal(r.ok, true)
  } finally {
    rmScratch(a.dir)
  }
})

test('T4 默认关:enabled=false ⇒ 一次都不派生,只留一行合臂 ⏸', () => {
  const a = arm({ enabled: false })
  try {
    const r = a.run()
    assert.equal(a.argvs.length, 0, '合臂却派生了')
    assert.equal(r.ran, false)
    assert.equal(a.logs.length, 1)
    assert.match(a.logs[0], /⏸/)
    assert.match(a.logs[0], /enabled=false/)
  } finally {
    rmScratch(a.dir)
  }
})

test('T5 开关读不到 ⇒ 如实报未判定(不得把"没读到"写成"已关"或"已过"),且不派生', () => {
  for (const shape of ['missing', 'broken']) {
    const a = arm({ enabled: shape })
    try {
      const r = a.run()
      assert.equal(a.argvs.length, 0, `${shape} 形态却派生了`)
      assert.equal(r.ok, false, `${shape} 形态不得记绿`)
      assert.equal(a.logs.length, 1)
      assert.match(a.logs[0], /⚠️ .*未判定\(开关配置读不到/)
      assert.match(a.logs[0], /不记为已判/)
    } finally {
      rmScratch(a.dir)
    }
  }
})

test('T6 三态不并桶:判干净 ✅ / 未判定>0 或 rc=2 ⇒ ⚠️ 且 ok:false(与回收器"未判定不记绿"同口径)', () => {
  const clean = arm({ call: { status: 0, stdout: '保留 12 / 待删 0 / 未判定 0', stderr: '' } })
  try {
    const r = clean.run()
    assert.equal(r.ok, true)
    assert.deepEqual({ kept: r.kept, retire: r.retire, undetermined: r.undetermined }, { kept: 12, retire: 0, undetermined: 0 })
    assert.match(clean.logs[0], /^✅/)
  } finally {
    rmScratch(clean.dir)
  }
  const und = arm({ call: { status: 2, stdout: '未判定 2 件(不删、不记绿)\n保留 9 / 待删 1 / 未判定 2', stderr: '' } })
  try {
    const r = und.run()
    assert.equal(r.ok, false, '回收器报未判定(rc=2)时接线臂不得记绿')
    assert.equal(r.undetermined, 2)
    assert.match(und.logs[0], /^⚠️/)
    assert.match(und.logs[0], /不记绿/)
  } finally {
    rmScratch(und.dir)
  }
})

test('T7 未跑成(读数取不到)⇒ ⚠️ 且 ok:false,"没跑成"不得被读成"无可删"', () => {
  const a = arm({ call: { status: 1, stdout: '', stderr: '取不到目录清单: EPERM' } })
  try {
    const r = a.run()
    assert.equal(r.ran, true)
    assert.equal(r.ok, false)
    assert.match(a.logs[0], /未跑成/)
    assert.match(a.logs[0], /未跑成≠没有待删/)
  } finally {
    rmScratch(a.dir)
  }
})

test('T8 节流:未到窗口 ⇒ 零派生零日志;取不到戳一律视为该跑', () => {
  assert.equal(G.archiveGcArmDue(NOW, NaN, DAY), true, '没跑过 ⇒ 该跑')
  assert.equal(G.archiveGcArmDue(NOW, NOW - 1000, DAY), false)
  assert.equal(G.archiveGcArmDue(NOW, NOW - DAY, DAY), true)
  const a = arm()
  try {
    writeFileSync(a.tickFile, new Date(NOW - 1000).toISOString(), 'utf8')
    const r = a.run()
    assert.equal(r.ran, false)
    assert.equal(a.argvs.length, 0)
    assert.equal(a.logs.length, 0, '静默跳过可以,但不得写日志冒充"已巡检"')
  } finally {
    rmScratch(a.dir)
  }
})

test('T9 回收器不在位 ⇒ 报名跳过,绝不记为"这一格已巡检"(空扫不得冒充通过)', () => {
  assert.ok(existsSync(join(HERE, '..', 'archive-gc.mjs')), '回收器必须真在位,否则接线臂恒走"不在位"分支而账面看不出来')
  const a = arm()
  try {
    // 注入 exists=false 走"不在位"分支:用假 runner 永不被调用来证明未派生
    const logs = []
    const r = G.archiveGcDryRun({
      now: NOW,
      intervalMs: DAY,
      tickFile: join(a.dir, 't2.iso'),
      root: 'X:/fixture/archive',
      logger: (m) => logs.push(String(m)),
      exists: () => false,
      runner: () => {
        throw new Error('不在位分支不得派生')
      },
    })
    assert.equal(r.ran, false)
    assert.match(logs[0], /不在位/)
    assert.match(logs[0], /不记为已判/)
  } finally {
    rmScratch(a.dir)
  }
})

test('T10 归属锁:判据只住回收器那一份实现 —— 本臂不重抄世代/上限/删除逻辑,主文件也不得长出第二份', () => {
  const from = LIB.indexOf('export function archiveGcDryRun')
  const body = LIB.slice(from, LIB.length)
  assert.ok(body.length > 400, '切不到函数体(锚点漂了 ⇒ 本条恒真)')
  for (const forbidden of ['planGc', 'classifyEntry', 'parseGeneration', 'rmSync', 'keepGenerations']) {
    assert.equal(body.includes(forbidden), false, `本臂出现了回收器判据「${forbidden}」:两处各写一份必漂移`)
  }
  assert.match(body, /parseArchiveGcSummary\(/, '读数只许从回收器的人读汇总行里取')
  assert.equal(/^export function archiveGcDryRun/m.test(SRC), false, '主文件不得再长出一份实现(守门 103 的拆法:单源在 lib)')
})

test('T11 默认档锁:入库的开关面必须是 enabled=false(开臂是机主的决定,不是接线的默认)', () => {
  const raw = JSON.parse(readFileSync(join(HERE, '..', 'data', 'archive-gc-arm.json'), 'utf8'))
  assert.equal(raw.enabled, false, '默认档必须关;机主核过读数后自行改 true(改档请连同本钉一起过目)')
})

test('T12 待删量超阈值 ⇒ ⚠️ 且 ok:false(合臂/开臂都适用:积压不该只在人翻日志时可见)', () => {
  const a = arm({
    threshold: 20,
    call: {
      status: 0,
      stdout: '可判(in-scope)40 件 · 受保护 0 件 · 未判定 0 件\n保留 15 / 待删 25 / 未判定 0\n',
      stderr: '',
    },
  })
  try {
    const r = a.run()
    assert.equal(r.ok, false, '待删 25 > 阈值 20 ⇒ 不得记绿')
    assert.equal(r.retire, 25)
    assert.match(a.logs[0], /^⚠️/)
    assert.match(a.logs[0], /超阈值 20/, `必须点名阈值:${a.logs[0]}`)
    assert.equal(a.argvs[0].includes('--apply'), false, '告警仍不得改 argv 面去删')
  } finally {
    rmScratch(a.dir)
  }
})

test('T13 射程内 0 件可判 ⇒ ⏸ 且 ok:false,只报一次;树形态恢复后自动解除', () => {
  // 解析面:取不到该行 ⇒ null,不把"没这行"读成 0 件。
  assert.equal(
    G.parseArchiveGcSummary('可判(in-scope)7 件 · 受保护 2 件 · 未判定 0 件\n保留 7 / 待删 2 / 未判定 0').inScope,
    7,
  )
  assert.equal(G.parseArchiveGcSummary('保留 1 / 待删 0 / 未判定 0').inScope, null)

  const a = arm({ call: { status: 0, stdout: '可判(in-scope)0 件\n保留 313 / 待删 0 / 未判定 0\n', stderr: '' } })
  try {
    const first = a.run()
    assert.equal(first.ok, false, '射程内无可判对象不得记 ✅(那是"射程错配"被写成"干净")')
    assert.match(a.logs[0], /^⏸/)
    assert.match(a.logs[0], /retire-git-archive/, '必须点名该射程真正的回收器')
    assert.ok(existsSync(a.flagFile), '只报一次的标记必须落盘')

    // 第二个窗口、同一棵树 ⇒ 不再写日志(恒响会把通道喊废)。
    const logs2 = []
    const second = G.archiveGcDryRun({
      now: NOW + DAY,
      intervalMs: DAY,
      tickFile: a.tickFile,
      flagFile: a.flagFile,
      configPath: join(a.dir, 'arm.json'),
      root: 'X:/fixture/archive',
      logger: (m) => logs2.push(String(m)),
      runner: () => ({ status: 0, stdout: '可判(in-scope)0 件\n保留 313 / 待删 0 / 未判定 0\n', stderr: '' }),
    })
    assert.equal(second.ok, false)
    assert.equal(logs2.length, 0, '射程错配是常量结论:第二轮不得再刷一条')

    // 树形态恢复(有可判件)⇒ 标记自动解除,回 ✅。
    const logs3 = []
    const third = G.archiveGcDryRun({
      now: NOW + 2 * DAY,
      intervalMs: DAY,
      tickFile: a.tickFile,
      flagFile: a.flagFile,
      configPath: join(a.dir, 'arm.json'),
      root: 'X:/fixture/archive',
      logger: (m) => logs3.push(String(m)),
      runner: () => ({ status: 0, stdout: '可判(in-scope)4 件\n保留 4 / 待删 0 / 未判定 0\n', stderr: '' }),
    })
    assert.equal(third.ok, true)
    assert.match(logs3[0], /^✅/)
    assert.equal(existsSync(a.flagFile), false, '恢复后标记必须自删,否则下次错配会被静默吞掉')
  } finally {
    rmScratch(a.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
