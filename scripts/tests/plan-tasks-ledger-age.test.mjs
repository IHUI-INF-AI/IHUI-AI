// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks 的 F8「交代」判据 —— 提交链端到端镜像测试(§22c,2026-09-27 立)
 *
 * 为什么不并进 `plan-tasks.test.mjs`:那一文件是并发会话同写的热区,而本条要造的是一整套
 * 临时 git 仓 + 真 CLI 派生;混在一起只会让别人下一次改 M 系列时把我的夹具一起带走。
 *
 * 判据本身在 `plan-tasks.test.mjs` 的 M11(纯函数成套性)已经证明过一次"会给答案"。
 * 本文件证的是**有人问它** —— 这条链路断在任何一环,表现都一样是"门一路绿灯而无人判":
 *   runner 追加 `--staged` → readPlan 取 `:PROJECT_PLAN.md` → before 取 HEAD →
 *   countNewUndisposed → grewViolations → exit 1
 * 所以这里走真 CLI + 临时仓,四臂成对:
 *   ① 什么都没改(控制测量 ⇒ 必须先证明"绿"是量出来的,而不是命令压根没跑)
 *   ② 新登记一条裸账(没日期、没说归谁、没认领)⇒ 必拦且必须点名 F8
 *   ③ 同一行补上出生日 ⇒ 必放(证明拦的是"没交代",不是"新登记")
 *   ④ 同一行只写清归属 ⇒ 必放(交代三选一都得被认)
 * 只留 ② 一臂等于给"判据瞎了"留背书空间;只留 ③④ 则是把恒红门当成合规。
 *
 * 用临时仓而不是真仓的私有索引:真仓索引此刻有什么由并发会话决定,那会把本条测试变成
 * "取决于别人在不在飞"(守门 103 T12 那一课 —— 证明取材面只能用构造面)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */

import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { gitBinary } from '../lib/face-reader.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

// Windows 上 `new URL().pathname` 会给出 `/G:/...` 这种带前导斜杠的形态 —— 直接喂 path.resolve
// 会解析到错误的根。取路径必须经 fileURLToPath(§22d 同一课)。
const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const CLI = path.join(ROOT, 'scripts', 'plan-tasks.mjs')
const BASE = '# 计划\n- [ ] **O1 已有账**:2026-09-20 立,没人做。\n'

function withRepo(fn) {
  const dir = mkScratch('plan-gate')
  const git = (...args) =>
    spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      },
    )
  const run = () =>
    spawnSync(process.execPath, [CLI, '--staged', '--gate', '--root', dir], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  const put = (body) => writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), body, 'utf8')
  const stage = () => git('add', '-A', '--', 'PROJECT_PLAN.md')
  try {
    fn({ dir, git, run, put, stage })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('F8-E2E-1 控制测量:索引与 HEAD 同形时提交链必须绿(先证明"0"是量出来的)', () => {
  withRepo(({ git, run, put, stage }) => {
    assert.equal(git('init', '-q', '.').status, 0)
    put(BASE)
    stage()
    assert.equal(git('commit', '-q', '-m', 'base').status, 0)
    const r = run()
    assert.equal(r.status, 0, `控制测量不该红:${r.stdout}\n${r.stderr}`)
    // 派生确实跑起来了、也确实判了 —— 否则"绿"可能是命令没跑
    assert.match(
      `${r.stdout}${r.stderr}`,
      /差值棘轮|F8/,
      '报告里必须出现差值棘轮/F8 的判定行,否则"绿"可能只是没跑',
    )
  })
})

test('F8-E2E-2 注入无交代新登记 ⇒ 提交链必须拦且点名 F8', () => {
  withRepo(({ git, run, put, stage }) => {
    git('init', '-q', '.')
    put(BASE)
    stage()
    git('commit', '-q', '-m', 'base')
    put(`${BASE}- [ ] **O2 裸账**:今天新登记,没日期没说归谁。\n`)
    stage()
    const r = run()
    assert.notEqual(r.status, 0, '注入无交代新行却被放行 ⇒ F8 在提交链上没牙')
    assert.match(
      `${r.stdout}${r.stderr}`,
      /F8/,
      `拦下了但没点名 F8(归因不清的红灯会把人教成"跳门")`,
    )
  })
})

test('F8-E2E-3 同一行补出生日 ⇒ 必须放行(拦的是"没交代",不是"新登记")', () => {
  withRepo(({ git, run, put, stage }) => {
    git('init', '-q', '.')
    put(BASE)
    stage()
    git('commit', '-q', '-m', 'base')
    put(`${BASE}- [ ] **O2 裸账**:2026-09-27 立,今晚就做。\n`)
    stage()
    const r = run()
    assert.equal(
      r.status,
      0,
      `补了出生日仍被拦 ⇒ 这一维等于"新登记一律拦",会逼各会话跳门:\n${r.stdout}`,
    )
  })
})

test('F8-E2E-4 同一行只写清归属 ⇒ 也算交代,必须放行', () => {
  withRepo(({ git, run, put, stage }) => {
    git('init', '-q', '.')
    put(BASE)
    stage()
    git('commit', '-q', '-m', 'base')
    put(`${BASE}- [ ] **O2 裸账**:归属:desktop 持有人,本线只登记。\n`)
    stage()
    const r = run()
    assert.equal(r.status, 0, `写清归属仍被拦 ⇒ "交代三选一"没被完整认:\n${r.stdout}`)
  })
})

test('F8-E2E-5 到期清单必须落到"量得到年龄"这一面:追溯器报覆盖面闭合', () => {
  // 这一条不跑 CLI(全仓 blame ≈ 9s,且读数随并发会话变),只问追溯器自己的不变量:
  // 它给的行数必须等于面上的未勾选行数 —— 第一版漏掉 79/308 行时账面完全看不出。
  const r = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'lib', 'plan-line-age.mjs'), '--self-test'],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
    },
  )
  assert.equal(r.status, 0, `年龄追溯自检应全绿:\n${r.stdout}\n${r.stderr}`)
  assert.match(
    r.stdout,
    /S12 覆盖面闭合|年龄追溯自检:\d+ 通过 \/ 0 失败/,
    '自检必须自带"覆盖面闭合"这一档',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
