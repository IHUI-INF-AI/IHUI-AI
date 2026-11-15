// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows 计划任务 COM 兼容层的触发器类型锁(2026-11-15 立)。
 *
 * 立因(真根因,非止血):`--register-reextract` 在本机 PS7 无 ScheduledTasks 模块时
 * 回退到 Schedule.Service COM,而 COM 层恒用 `Triggers.Create(1)`(TASK_TRIGGER_TIME,
 * 一次性时刻触发器);daily 分支却去设只有 DailyTrigger 才有的 `DaysInterval` ⇒
 * PowerShell 抛 "The property 'DaysInterval' cannot be found on this object"。
 * 结果是本机重扫兜底任务 IHUI-Pool-Local-Reextract 从未真正注册,每日 09:10 那条
 * 「客户端重登后新票回池」的兜底腿一直没装车。
 *
 * 每条含「同形正例 + 反向牙 + 合法改动仍绿」:
 *  - daily ⇒ Create(2) + DaysInterval=1,绝不出现 Create(1) / Repetition;
 *  - interval ⇒ Create(1) + Repetition.Interval,绝不出现 Create(2) / DaysInterval;
 *  - 两型都带 StartBoundary / RegisterTaskDefinition(没这两样等于没装车);
 *  - 任务名 / 描述 / 参数 / 分钟数换成任意合法值,触发器类型结论不变。
 *
 * 只测生成的 PowerShell 文本(纯函数),不注册任何系统任务、不连库。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ } from '../register-pool-sync-task.mjs'

const { comRegisterScript } = __test__

const dailySpec = {
  taskName: 'IHUI-Pool-Local-Reextract',
  description: '无刷新协议平台的本机重新提取兜底',
  trigger: { kind: 'daily', time: '09:10' },
  startBoundaryExpr: "(Get-Date).Date.Add('09:10').ToString('yyyy-MM-ddTHH:mm:ss')",
}

const intervalSpec = {
  taskName: 'IHUI-Pool-Sync',
  description: '号池跨环境双向自动同步',
  trigger: { kind: 'interval', minutes: 2 },
  startBoundaryExpr: '',
}

test('daily 用每日触发器 Create(2) 且只设 DaysInterval', () => {
  const ps = comRegisterScript('//B "D:/IHUI-AI/scripts/reextract-hidden.vbs"', dailySpec)
  assert.match(ps, /\$trig=\$td\.Triggers\.Create\(2\)/)
  assert.match(ps, /\$trig\.DaysInterval=1/)
  assert.ok(!ps.includes('Create(1)'), 'daily 不得退回一次性时刻触发器(原缺陷)')
  assert.ok(!ps.includes('Repetition.Interval'), 'daily 不得带重复间隔')
  assert.match(ps, /\$trig\.StartBoundary=/)
  assert.match(ps, /RegisterTaskDefinition\('IHUI-Pool-Local-Reextract'/)
})

test('interval 用时刻触发器 Create(1) 且带 Repetition', () => {
  const ps = comRegisterScript('//B "D:/IHUI-AI/scripts/sync-hidden.vbs"', intervalSpec)
  assert.match(ps, /\$trig=\$td\.Triggers\.Create\(1\)/)
  assert.match(ps, /\$trig\.Repetition\.Interval='PT2M'/)
  assert.match(ps, /\$trig\.Repetition\.Duration='P3650D'/)
  assert.ok(!ps.includes('Create(2)'), 'interval 不得用每日触发器')
  assert.ok(!ps.includes('DaysInterval'), 'TimeTrigger 没有 DaysInterval,出现即抛属性不存在')
  assert.match(ps, /\$trig\.StartBoundary=/)
  assert.match(ps, /RegisterTaskDefinition\('IHUI-Pool-Sync'/)
})

test('反向牙:两型都必须真注册、动作与工作目录齐全', () => {
  for (const spec of [dailySpec, intervalSpec]) {
    const ps = comRegisterScript('//B "x.vbs"', spec)
    assert.match(ps, /New-Object -ComObject Schedule\.Service/)
    assert.match(ps, /\$act=\$td\.Actions\.Create\(0\)/)
    assert.match(ps, /\$act\.Path=/)
    assert.match(ps, /\$act\.Arguments=/)
    assert.match(ps, /\$act\.WorkingDirectory=/)
    assert.match(ps, /\$t\.Enabled=\$true/)
    assert.match(ps, /Write-Output 'REGISTERED'/)
  }
})

test('合法改动仍绿:任务名/描述/参数/分钟数换值,触发器类型不变', () => {
  const renamed = comRegisterScript('//B "another.vbs"', {
    ...dailySpec,
    taskName: 'Another-Daily',
    description: '另一段描述',
  })
  assert.match(renamed, /Create\(2\)/)
  assert.match(renamed, /DaysInterval=1/)
  assert.ok(!renamed.includes('Create(1)'))
  assert.match(renamed, /RegisterTaskDefinition\('Another-Daily'/)

  const otherInterval = comRegisterScript('//B "another.vbs"', {
    ...intervalSpec,
    trigger: { kind: 'interval', minutes: 17 },
  })
  assert.match(otherInterval, /Create\(1\)/)
  assert.match(otherInterval, /Repetition\.Interval='PT17M'/)
  assert.ok(!otherInterval.includes('Create(2)'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
