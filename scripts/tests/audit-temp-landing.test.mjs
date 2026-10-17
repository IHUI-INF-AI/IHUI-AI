// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活 TEMP 落点回潮哨兵调度器(`auditTempLanding`)的镜像测试。
 *
 * 立因:尺子 `scripts/check-temp-landing.mjs` 的文件头早就写着"派生出面的唯一调度器 =
 * `scripts/git-guardian.mjs` 健康轮次 `!CHECK_ONLY` 巡检格(auditTempLanding())",
 * 而那个函数**从来不存在** —— 判据、声明表、镜像测试全在,却没有任何人调度它。
 * 这是本仓对这一型的名字:"造好没装车",而失效形态是**安静**(不是报错,是根本不跑)。
 *
 * 测试钉死五件事:
 *   T1 drift ⇒ 必须喊出来(点名是哪一层、并写明清理归属);
 *   T2 节流窗口内 ⇒ 不重复读注册表(落点配置一天不会变两次);
 *   T3 取不到读数(rc≠0 / JSON 坏)⇒ 「未判定」点名原因,**不喊人**,且**不推进节流戳**
 *      (一次失败就瞎 24 小时是这条最容易写错的地方);
 *   T4 全绿 ⇒ 安静(健康时不写行是本日志的既有约定);
 *   T5 装车锁:挂点必须在 `!CHECK_ONLY` 分支,且阈值可由 env 覆盖但默认 24h。
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { auditTempLanding } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => {
  const dir = mkScratch('temp-landing-')
  return { tickFile: join(dir, 'tick.ts') }
}

/** 造一个返回固定 JSON 的 runner。 */
const jsonRunner = (obj, status = 0) => () => ({
  status,
  stdout: JSON.stringify(obj),
  stderr: '',
})

test('T1 drift ⇒ 喊出来,点名层级并写明清理归属', () => {
  const f = fixture()
  const logs = []
  const r = auditTempLanding({
    ...f,
    logger: (m) => logs.push(m),
    runner: jsonRunner({
      counts: { drift: 1, undetermined: 0, recentWrites: 0 },
      tiers: [{ judged: true, state: 'drift', label: 'INTERACTIVE-ACCOUNT' }],
    }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.drift, 1)
  const line = logs.find((l) => /TEMP 落点回潮/.test(l))
  assert.ok(line, 'drift 必须写日志 —— 安静是这一型最贵的失效形态')
  assert.match(line, /INTERACTIVE-ACCOUNT/, '要点名是哪一层不一致')
  assert.match(line, /scrubTempFixtures/, '要写明清理归既有清扫器,本格只判不动手')
})

test('T2 节流窗口内 ⇒ 不重复读注册表', () => {
  const f = fixture()
  writeFileSync(f.tickFile, new Date().toISOString(), 'utf8')
  const r = auditTempLanding({
    ...f,
    logger: () => {},
    runner: () => {
      throw new Error('节流窗口内不该跑尺子')
    },
  })
  assert.equal(r.ran, false)
  assert.equal(r.why, '未到节流窗口')
})

test('T3 取不到读数 ⇒ 未判定、不喊人、且不推进节流戳', () => {
  const f = fixture()
  const logs = []
  const r = auditTempLanding({
    ...f,
    logger: (m) => logs.push(m),
    runner: () => ({ status: 3, stdout: '', stderr: 'reg 派生失败' }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.why, '未判定')
  const line = logs.find((l) => /未判定/.test(l))
  assert.ok(line, '未判定必须点名')
  assert.match(line, /reg 派生失败/, '要带上尺子的原因,否则无人能答"为什么"')
  // 关键:一次失败不得把 24h 窗口白占掉 —— 用"再跑一次仍是未判定"来证明戳没被推进,
  // 而不是靠 runner 抛错(那样测的是异常吞掉,不是节流戳的推进条件)。
  const again = auditTempLanding({
    ...f,
    logger: () => {},
    runner: () => ({ status: 3, stdout: '', stderr: 'reg 派生失败' }),
  })
  assert.equal(
    again.why,
    '未判定',
    '未判定不得写节流戳 —— 否则一次失败就瞎一整天(第二次必须仍真的去跑尺子)',
  )
})

test('T4 全绿 ⇒ 安静(健康时不写行)', () => {
  const f = fixture()
  const logs = []
  const r = auditTempLanding({
    ...f,
    logger: (m) => logs.push(m),
    runner: jsonRunner({ counts: { drift: 0, undetermined: 0, recentWrites: 0 }, tiers: [] }),
  })
  assert.equal(r.ok, true)
  assert.equal(logs.length, 0, `全绿不该写任何日志行,实写:${logs.join(' | ')}`)
})

test('T5 装车锁:挂点带 !CHECK_ONLY,节流默认 24h 且可 env 覆盖', () => {
  // 只认**代码行**:注释里也写着 auditTempLanding()(函数头注与挂点注),不排掉会自己骗自己。
  const callLine = SRC.split(/\r?\n/).find(
    (l) => !l.trim().startsWith('//') && /if\s*\(\s*!\s*CHECK_ONLY\s*\)\s*auditTempLanding\(\)/.test(l),
  )
  assert.ok(
    callLine,
    '挂点不见了(或写成了不带 !CHECK_ONLY 的形态)—— 尺子造好了但没人调度,正是本测试要防的那一型',
  )
  assert.match(
    callLine,
    /if\s*\(\s*!\s*CHECK_ONLY\s*\)/,
    `挂点必须写成 if (!CHECK_ONLY) auditTempLanding(),实为:${callLine.trim()}`,
  )
  assert.match(
    SRC,
    /IHUI_TEMP_LANDING_INTERVAL_MS\s*\|\|\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    '节流默认应为 24h 且可由 env 覆盖',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
