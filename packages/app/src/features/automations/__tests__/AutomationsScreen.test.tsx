// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-241 终态徽章 —— RN 共享屏(packages/app AutomationsScreen)渲染测试。
 *
 * 覆盖:
 *  1. 有 terminalReason ⇒ 渲染终态徽章(文案取 automations.terminalReason.* );
 *  2. 无 terminalReason(null)⇒ 不渲染终态徽章,只留状态徽章;
 *  3. 取值不在封闭集内 ⇒ 不渲染终态徽章。
 *
 * react-native 在本包 vitest(jsdom)下无 DOM 承载,故用文件内替身把 RN 基础组件
 * 映射到 DOM 标签(style / numberOfLines 等 RN 专属 prop 剥掉,否则 React DOM 抛
 * "The `style` prop expects a mapping … not an array")。
 */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { getRnTokens } from '@ihui/design-tokens'

vi.mock('react-native', async () => {
  const react = await import('react')
  const h = react.createElement
  interface RnStubProps {
    children?: React.ReactNode
    onPress?: () => void
    [key: string]: unknown
  }
  const RN_ONLY = [
    'style',
    'numberOfLines',
    'accessibilityRole',
    'accessibilityLabel',
    'contentContainerStyle',
    'refreshControl',
    'onRefresh',
    'refreshing',
    'collapsable',
    'pointerEvents',
  ]
  const clean = (props: RnStubProps): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(props)) {
      if (RN_ONLY.includes(k)) continue
      out[k] = v
    }
    return out
  }
  return {
    ActivityIndicator: (props: RnStubProps) => h('span', clean(props)),
    RefreshControl: (props: RnStubProps) => h('span', null, props.children),
    ScrollView: (props: RnStubProps) => h('div', clean(props), props.children),
    StyleSheet: {
      create: <T,>(styles: T): T => styles,
      flatten: (style: unknown) => style,
    },
    Text: (props: RnStubProps) => h('span', clean(props), props.children),
    TouchableOpacity: (props: RnStubProps) =>
      h('button', { type: 'button', onClick: props.onPress }, props.children),
    View: (props: RnStubProps) => h('div', clean(props), props.children),
  }
})

import { AutomationsScreen, type AutomationItem } from '../AutomationsScreen'

const tk = getRnTokens('light')

/** RN 端 i18n 键是扁平形态:automations.terminalReason.<后缀> */
const t = (key: string): string => {
  const map: Record<string, string> = {
    'automations.terminalReason.manualPause': '手动暂停',
    'automations.terminalReason.failedPermanent': '永久失败',
    'automations.terminalReason.failedRetriesExhausted': '重试次数已用尽',
    'automations.terminalReason.completed': '已完成',
    'automations.schedule': '调度',
    'automations.nextRun': '下次运行',
    'automations.lastRun': '上次运行',
    'automations.noResult': '暂无结果',
    'automations.prompt': '提示词',
    'automations.timezone': '时区',
    'automations.rrule': '重复规则',
    'automations.empty': '暂无自动化',
  }
  return map[key] ?? key
}

function makeItem(overrides: Partial<AutomationItem>): AutomationItem {
  return {
    id: 'auto-1',
    name: '每日简报',
    active: false,
    statusText: '已暂停',
    scheduleType: 'recurring',
    scheduleText: '重复',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    scheduledAtText: null,
    timezoneText: 'Asia/Shanghai',
    lastRunText: '—',
    nextRunText: '—',
    prompt: '总结今日新闻',
    lastResultSummary: null,
    terminalReason: null,
    ...overrides,
  }
}

function renderScreen(items: AutomationItem[]) {
  return render(
    <AutomationsScreen
      t={t}
      tk={tk}
      items={items}
      detail={null}
      loading={false}
      refreshing={false}
      error=""
      onRefresh={() => undefined}
      onOpen={() => undefined}
    />,
  )
}

describe('G-241 终态徽章(RN 共享屏 AutomationsScreen)', () => {
  it('有 terminalReason ⇒ 渲染终态徽章', () => {
    renderScreen([makeItem({ terminalReason: 'failed_permanent' })])
    expect(screen.getByText('永久失败')).toBeTruthy()
    expect(screen.getByText('已暂停')).toBeTruthy()
    cleanup()
  })

  it('四档成因各自出对应文案', () => {
    renderScreen([
      makeItem({ id: 'a1', name: '任务一', terminalReason: 'manual_pause' }),
      makeItem({ id: 'a2', name: '任务二', terminalReason: 'failed_retries_exhausted' }),
      makeItem({ id: 'a3', name: '任务三', terminalReason: 'completed' }),
    ])
    expect(screen.getByText('手动暂停')).toBeTruthy()
    expect(screen.getByText('重试次数已用尽')).toBeTruthy()
    expect(screen.getByText('已完成')).toBeTruthy()
    cleanup()
  })

  it('无 terminalReason(null)⇒ 不渲染终态徽章,列表保持原状', () => {
    renderScreen([makeItem({ terminalReason: null })])
    expect(screen.queryByText('永久失败')).toBeNull()
    expect(screen.queryByText('已完成')).toBeNull()
    expect(screen.getByText('已暂停')).toBeTruthy()
    cleanup()
  })

  it('取值不在封闭集内 ⇒ 不渲染终态徽章(未知不折成默认成因)', () => {
    renderScreen([
      makeItem({
        terminalReason: 'cancelled' as unknown as AutomationItem['terminalReason'],
      }),
    ])
    expect(screen.queryByText('永久失败')).toBeNull()
    expect(screen.queryByText('已完成')).toBeNull()
    expect(screen.getByText('已暂停')).toBeTruthy()
    cleanup()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
