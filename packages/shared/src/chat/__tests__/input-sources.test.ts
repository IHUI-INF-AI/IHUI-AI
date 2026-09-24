// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D89 输入源与队列小项打包 —— 判定层用例(G-119/G-121/G-122)。
// 覆盖:①快照三态 + 首用引导只出一次 + 「附加 {appName}」+ 分流穷尽;
//       ②两命令项 + Undo 三态 + W27 不冲突**源码级结构断言**;
//       ③计数空态(0 不显示「0 条」)+ goal 耗时人类可读格式化。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  INPUT_SOURCE_ROUTES,
  INPUT_SOURCES_NAMESPACE,
  QUEUE_COMMANDS,
  QUEUE_COMMAND_IDS,
  SNAPSHOT_STATES,
  UNDO_RESTORE_PHASES,
  attachAppView,
  firstRunGuideNeeded,
  goalAchievementView,
  inputSourceRoute,
  isInputSourceRoute,
  isSnapshotState,
  memoryRefCountView,
  queueCommandView,
  snapshotView,
  undoRestoreView,
} from '../input-sources'

// ---------------------------------------------------------------------------
// ① 智能快照:三态 + 首用引导 + 附加 {appName} + 分流
// ---------------------------------------------------------------------------

describe('D89 ① 智能快照 / 三态视图', () => {
  it('三态逐态给出视图,switch 穷尽(类型守卫与集合一致)', () => {
    expect(SNAPSHOT_STATES).toHaveLength(3)
    for (const state of SNAPSHOT_STATES) {
      expect(isSnapshotState(state)).toBe(true)
      const view = snapshotView(state)
      expect(view.state).toBe(state)
      expect(view.labelKey.length).toBeGreaterThan(0)
      expect(isSnapshotState(view.state)).toBe(true)
    }
    expect(isSnapshotState('whatever')).toBe(false)
  })

  it('三态不同形:disabled 给启用动作 / enabled 无动作 / failed 必须显式带失败说明', () => {
    const disabled = snapshotView('disabled')
    const enabled = snapshotView('enabled')
    const failed = snapshotView('failed')

    expect(disabled.actionKey).toBe('enable')
    expect(disabled.hintKey).toBeNull()
    expect(enabled.actionKey).toBeNull()
    // 失败态不得静默:label + hint 双键齐备,且与成功态 tone 不同
    expect(failed.hintKey).toBe('failedHint')
    expect(failed.tone).not.toBe(enabled.tone)
    expect(failed.labelKey).not.toBe(enabled.labelKey)
  })
})

describe('D89 ① 首次使用引导 / 只出一次判据', () => {
  it('enabled 且从未引导过 ⇒ 引导;引导过 ⇒ 永不再出', () => {
    expect(firstRunGuideNeeded('enabled', { guidedBefore: false })).toBe(true)
    expect(firstRunGuideNeeded('enabled', { guidedBefore: true })).toBe(false)
  })

  it('非 enabled 态(未启用/失败)不出引导', () => {
    expect(firstRunGuideNeeded('disabled', { guidedBefore: false })).toBe(false)
    expect(firstRunGuideNeeded('failed', { guidedBefore: false })).toBe(false)
  })
})

describe('D89 ① 附加 {appName} 键生成', () => {
  it('有应用名 → attachApp 键 + 插值参数透传(去首尾空白)', () => {
    const view = attachAppView('IHUI 桌面端')
    expect(view).not.toBeNull()
    expect(view?.labelKey).toBe('snapshot.attachApp')
    expect(view?.values.appName).toBe('IHUI 桌面端')
    expect(attachAppView('  app-x  ')?.values.appName).toBe('app-x')
  })

  it('空应用名 → null(渲染层不渲染空壳附加片段)', () => {
    expect(attachAppView('')).toBeNull()
    expect(attachAppView('   ')).toBeNull()
  })
})

describe('D89 ① 添加远程文件/照片分流', () => {
  it('三类源穷尽分流,各归各入口,attach 形态正确', () => {
    expect(INPUT_SOURCE_ROUTES).toHaveLength(3)
    const app = inputSourceRoute('appSnapshot')
    const file = inputSourceRoute('remoteFile')
    const photo = inputSourceRoute('remotePhoto')
    expect(app.entryKey).toBe('route.appSnapshot')
    expect(app.attach).toBe('app')
    expect(file.entryKey).toBe('route.remoteFile')
    expect(file.attach).toBe('file')
    expect(photo.entryKey).toBe('route.remotePhoto')
    expect(photo.attach).toBe('image')
    // 入口与源一一对应,不混用
    expect(app.entry).toBe('appSnapshot')
    expect(file.entry).not.toBe(app.entry)
    expect(photo.entry).not.toBe(file.entry)
  })

  it('类型守卫与集合一致;非法源被拒', () => {
    for (const source of INPUT_SOURCE_ROUTES) expect(isInputSourceRoute(source)).toBe(true)
    expect(isInputSourceRoute('localDisk')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ② 队列命令化 + Undo(+ W27 不冲突结构断言)
// ---------------------------------------------------------------------------

describe('D89 ② 队列与引导命令化', () => {
  it('两命令项(id/labelKey/descKey/semantic)齐备,id 唯一', () => {
    expect(QUEUE_COMMANDS).toHaveLength(2)
    expect([...QUEUE_COMMAND_IDS].sort()).toEqual(['queuePrompt', 'steerPrompt'].sort())
    expect(new Set(QUEUE_COMMANDS.map((c) => c.id)).size).toBe(2)
    for (const cmd of QUEUE_COMMANDS) {
      expect(cmd.labelKey.length).toBeGreaterThan(0)
      expect(cmd.descKey.length).toBeGreaterThan(0)
      expect(cmd.labelKey).not.toBe(cmd.descKey)
    }
  })

  it('语义归属与 command-registry 一致:queuePrompt=w27-pending / steerPrompt=steer', () => {
    expect(queueCommandView('queuePrompt').semantic).toBe('w27-pending')
    expect(queueCommandView('steerPrompt').semantic).toBe('steer')
  })
})

describe('D89 ② Undo 恢复三态', () => {
  it('三态逐态给视图,switch 穷尽', () => {
    expect(UNDO_RESTORE_PHASES).toHaveLength(3)
    for (const phase of UNDO_RESTORE_PHASES) {
      const view = undoRestoreView(phase)
      expect(view.phase).toBe(phase)
      expect(view.labelKey.length).toBeGreaterThan(0)
    }
  })

  it('restored 同族双文案按变体择一:「已恢复队列中的消息」/「已恢复排队的消息」', () => {
    expect(undoRestoreView('restored', 'queue').labelKey).toBe('undo.restored')
    expect(undoRestoreView('restored', 'queued').labelKey).toBe('undo.restoredQueued')
    expect(undoRestoreView('restored').labelKey).toBe('undo.restored')
    // 两键互异(不是同一句话敷衍两个变体)
    expect(undoRestoreView('restored', 'queue').labelKey).not.toBe(
      undoRestoreView('restored', 'queued').labelKey,
    )
  })

  it('restoring/failed 与 restored 不同形(进行中/失败态不冒充成功)', () => {
    expect(undoRestoreView('restoring').labelKey).toBe('undo.restoring')
    expect(undoRestoreView('failed').labelKey).toBe('undo.failed')
    expect(undoRestoreView('failed').tone).not.toBe(undoRestoreView('restored').tone)
  })
})

describe('D89 ② W27 不冲突 / 源码级结构断言(同 D75 纪律)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const source = readFileSync(join(here, '../input-sources.ts'), 'utf8')

  it('模块不 import 任何队列 store / 发送短路链(判定层只读不写)', () => {
    // W27 语义真身:message-input.tsx 流结束 effect + use-message-send.ts 短路;
    // 本模块若 import 其一即有能力改写队首选择,直接违宪。
    const forbidden = [
      'use-message-send',
      'message-input',
      'stores/chat',
      'stores/goal',
      'setPendingMessages',
      'pendingMessages',
      'sideQueue',
      'useChatStore',
    ]
    for (const token of forbidden) {
      expect(source.includes(token), `input-sources.ts 不得出现 ${token}`).toBe(false)
    }
  })

  it('模块唯一相对依赖是 quota-ownership(复用 formatDurationHuman,不沾其他业务模块)', () => {
    const relImports = [...source.matchAll(/from\s+'(\.[^']*)'/g)].map((m) => m[1])
    expect(relImports).toEqual(['./quota-ownership'])
  })

  it('命令视图是纯描述:QUEUE_COMMANDS 不含回调/动作执行字段', () => {
    for (const cmd of QUEUE_COMMANDS) {
      const keys = Object.keys(cmd)
      expect(keys.sort()).toEqual(['descKey', 'id', 'labelKey', 'semantic'].sort())
    }
  })
})

// ---------------------------------------------------------------------------
// ③ 记忆引用计数 + goal 成就耗时
// ---------------------------------------------------------------------------

describe('D89 ③ 记忆引用计数条', () => {
  it('0/负数/非有限数 ⇒ 空态(明确空态文案,不显示「0 条」),无 tooltip', () => {
    for (const bad of [0, -1, NaN, Infinity, -Infinity]) {
      const view = memoryRefCountView(bad)
      expect(view.empty, String(bad)).toBe(true)
      expect(view.labelKey).toBe('memoryRefs.empty')
      expect(view.tooltipKey).toBeNull()
      expect(view.values.count).toBe(0)
    }
  })

  it('正数 ⇒ 计数键 + tooltip「引用的记忆」键,小数向下取整', () => {
    const view = memoryRefCountView(7)
    expect(view.empty).toBe(false)
    expect(view.labelKey).toBe('memoryRefs.count')
    expect(view.tooltipKey).toBe('memoryRefs.tooltip')
    expect(view.values.count).toBe(7)
    expect(memoryRefCountView(3.9).values.count).toBe(3)
  })
})

describe('D89 ③ goal 成就耗时条(已在 {totalTime} 内达成目标)', () => {
  it('键固定为 goal.achievedIn,totalTime 为人类可读中文时长(复用 formatDurationHuman)', () => {
    const view = goalAchievementView(9_000_000)
    expect(view.labelKey).toBe('goal.achievedIn')
    expect(view.values.totalTime).toBe('2小时30分')
    expect(goalAchievementView(7_200_000).values.totalTime).toBe('2小时')
    expect(goalAchievementView(1_800_000).values.totalTime).toBe('30分')
  })

  it('非法输入兜底不抛异常(负数/非有限 → 「0分」),支持自定义单位', () => {
    expect(goalAchievementView(-5).values.totalTime).toBe('0分')
    expect(goalAchievementView(NaN).values.totalTime).toBe('0分')
    const en = goalAchievementView(9_000_000, { hour: 'h', minute: 'm' })
    expect(en.values.totalTime).toBe('2h30m')
  })
})

describe('D89 词包命名空间', () => {
  it('命名空间为 ai.pane.inputSources(五语言词包按此挂载)', () => {
    expect(INPUT_SOURCES_NAMESPACE).toBe('ai.pane.inputSources')
  })
})
// ⁠[tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
