// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D78 连接器授权卡 —— 共享屏层(packages/app)实现的判据锁。
//
// 本测试做三层事情:
//   1. **行为**:五态渲染 / 「暂不」负向出口在三个决策态恒在 / 拒绝与连接的动作上报 /
//      moreInfo 五态恒在(仅在宿主接了 onAction 时)。
//   2. **同源对账(本票核心)**:与 web 端既有实现
//      `apps/web/src/components/ai/connector-auth-card.tsx` 逐字比对五态清单、四动词
//      联合、`chat.connectorAuth.*` 键集、决策态判据 —— 两端语义同源,不得各写一套;
//      web 端若改表而本端未跟,本文件必红。
//   3. **词包对账**:mobile-rn 五语言 `chat.connectorAuth` 与 web 五语言逐值全等
//      (文案唯一真相在 messages/{web,mobile-rn},跨端必须逐字同)。
//
// 文案一律断言 key(渲染器用注入的假 `t`),真实语言纯度由
// `scripts/check-i18n-keys.mjs` / `scan-i18n-zh-residue.mjs` 负责,不在此重复。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement, type ReactNode } from 'react'

import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

// 共享屏层实现(被测本体)
import {
  CONNECTOR_AUTH_STATES,
  ConnectorAuthCard,
  isConnectorAuthDecisionState,
  type ConnectorAuthAction,
  type ConnectorAuthState,
} from '../src/features/chat/ConnectorAuthCard'

// RN 原语替身:与 apps/mobile-rn/tests/business-i18n.test.tsx 同一模式 ——
// View/Text 渲染为同名 DOM 标签,Pressable 渲染为可点击元素并把 onPress 接 onClick;
// testID/nativeID 映射 data-testid/id,使查询形态与 web 端 data-* 判据同位。
vi.mock('react-native', () => {
  const passThrough =
    (tag: string) =>
    ({
      children,
      testID,
      nativeID,
      accessibilityRole,
    }: {
      children?: ReactNode
      testID?: string
      nativeID?: string
      accessibilityRole?: string
    }) =>
      createElement(
        tag,
        { 'data-testid': testID, id: nativeID, role: accessibilityRole },
        children,
      )
  function MockPressable({
    children,
    testID,
    onPress,
    accessibilityRole,
  }: {
    children?: ReactNode
    testID?: string
    onPress?: (ev: unknown) => void
    accessibilityRole?: string
  }) {
    // Pressable 的 style 可为 ({pressed})=>... 函数,DOM 替身不解析,只保留命中语义
    return createElement(
      'pressable',
      {
        'data-testid': testID,
        role: accessibilityRole,
        onClick: () => onPress?.({}),
      },
      children,
    )
  }
  return {
    View: passThrough('View'),
    Text: passThrough('Text'),
    Pressable: MockPressable,
    StyleSheet: { create: <T,>(s: T): T => s },
  }
})

const here = dirname(fileURLToPath(import.meta.url))
const RN_CARD_PATH = join(here, '../src/features/chat/ConnectorAuthCard.tsx')
const RN_INDEX_PATH = join(here, '../src/index.ts')
const WEB_CARD_PATH = join(here, '../../../apps/web/src/components/ai/connector-auth-card.tsx')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 假 t:key 直通 + 插值参数显影(与 web 端测试同一显影形态,便于跨端比 key 集) */
const fakeT = (key: string, params?: Record<string, string | number>): string =>
  params ? `${key}(${JSON.stringify(params)})` : key

function card(
  state: ConnectorAuthState,
  opts: { onAction?: (a: ConnectorAuthAction) => void; t?: (k: string, p?: Record<string, string | number>) => string } = {},
) {
  return render(
    <ConnectorAuthCard
      connectorName="飞书"
      state={state}
      t={opts.t ?? fakeT}
      onAction={opts.onAction}
      colorScheme="light"
    />,
  )
}

const q = (container: HTMLElement, testId: string): Element | null =>
  container.querySelector(`[data-testid="${testId}"]`)

describe('D78 ConnectorAuthCard / 共享层与 web 端同源对账(G-107)', () => {
  const rnSrc = readFileSync(RN_CARD_PATH, 'utf8')
  const webSrc = readFileSync(WEB_CARD_PATH, 'utf8')

  it('web 端 CONNECTOR_AUTH_STATES 五态与共享层逐字同(序不判,集合必等)', () => {
    const m = webSrc.match(/CONNECTOR_AUTH_STATES = \[([\s\S]*?)\] as const/)
    expect(m, 'web 端清单形态漂移:提取式失配,须人工核对而非放过').not.toBeNull()
    const webStates = [...m![1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1])
    expect(new Set(webStates)).toEqual(new Set<string>(CONNECTOR_AUTH_STATES))
    expect(webStates.length).toBe(CONNECTOR_AUTH_STATES.length)
  })

  it('web 端 ConnectorAuthAction 动词联合与共享层逐字同', () => {
    // 无分号风格(prettier 无 semis)⇒ 取到行尾/分号为止,两种写法都认
    const m = webSrc.match(/ConnectorAuthAction = ([^\n;]+)/)
    expect(m, 'web 端动词形态漂移:提取式失配').not.toBeNull()
    const webActions = [...m![1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1])
    const rnMatch = rnSrc.match(/ConnectorAuthAction = ([^\n;]+)/)
    expect(rnMatch, '共享层动词形态漂移:提取式失配').not.toBeNull()
    const rnActions = [...rnMatch![1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1])
    expect(new Set(webActions)).toEqual(new Set(rnActions))
    expect(webActions.sort()).toEqual(rnActions.sort())
  })

  it('取词键集:web useTranslations 命名空间下的 t(key) 与共享层全路径 t(chat.connectorAuth.key) 同集', () => {
    const ns = webSrc.match(/useTranslations\('(chat\.connectorAuth)'\)/)
    expect(ns, 'web 端命名空间漂移').not.toBeNull()
    // web 卡片内所有 t('x') 调用都是该命名空间的键(useTranslations 已限定)
    const webKeys = [...webSrc.matchAll(/\bt\('([a-zA-Z]+)'/g)].map((x) => x[1])
    const rnKeys = [...rnSrc.matchAll(/\bt\('chat\.connectorAuth\.([a-zA-Z]+)'/g)].map((x) => x[1])
    expect(new Set(webKeys).size).toBeGreaterThan(0)
    expect(new Set(webKeys)).toEqual(new Set(rnKeys))
  })

  it('决策态判据:共享层 isConnectorAuthDecisionState 与 web DECISION_STATES 三态全等', () => {
    const m = webSrc.match(/DECISION_STATES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)
    expect(m, 'web DECISION_STATES 形态漂移').not.toBeNull()
    const webDecision = new Set([...m![1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1]))
    const rnDecision = new Set<string>(
      CONNECTOR_AUTH_STATES.filter((s) => isConnectorAuthDecisionState(s)),
    )
    expect(rnDecision).toEqual(webDecision)
  })

  it('共享层唯一实现已接线:@ihui/rn-app 出口必须真的导出该卡', () => {
    const idx = readFileSync(RN_INDEX_PATH, 'utf8')
    expect(idx).toMatch(
      /export \{[\s\S]*?ConnectorAuthCard,[\s\S]*?CONNECTOR_AUTH_STATES,[\s\S]*?isConnectorAuthDecisionState,[\s\S]*?\} from '\.\/features\/chat\/ConnectorAuthCard'/,
    )
  })
})

describe('D78 ConnectorAuthCard / 词包对账(mobile-rn 与 web 逐值全等)', () => {
  for (const locale of LOCALES) {
    it(`${locale}: chat.connectorAuth 两端逐值全等`, () => {
      const web = JSON.parse(
        readFileSync(join(here, `../../../packages/i18n/messages/web/${locale}.json`), 'utf8'),
      ).chat.connectorAuth
      const rn = JSON.parse(
        readFileSync(
          join(here, `../../../packages/i18n/messages/mobile-rn/${locale}.json`),
          'utf8',
        ),
      ).chat.connectorAuth
      expect(Object.keys(rn).sort()).toEqual(Object.keys(web).sort())
      expect(rn).toEqual(web)
    })
  }
})

describe('D78 ConnectorAuthCard / 行为(五态 + 负向出口恒在)', () => {
  it('五态逐个渲染:nativeID 携带状态(与 web data-connector-auth-state 同位挂载点),状态标签非空', () => {
    for (const state of CONNECTOR_AUTH_STATES) {
      const { container, unmount } = card(state)
      expect(
        container.querySelector(`#connector-auth-card--${state}`),
        state,
      ).not.toBeNull()
      const label = container.querySelector('[data-testid$="-label-title"], [data-testid$="-label-connected"], [data-testid$="-label-declined"]')
      expect((label?.textContent ?? '').length, state).toBeGreaterThan(0)
      unmount()
    }
  })

  it('未连接态:标题带 {connectorName} 插值,正向动作是「连接」+「暂不」', () => {
    const onAction = vi.fn()
    const { container } = card('disconnected', { onAction })
    expect(q(container, 'connector-auth-card-label-title')?.textContent).toBe(
      'chat.connectorAuth.title({"connectorName":"飞书"})',
    )
    expect(q(container, 'connector-auth-card-action-connect')).not.toBeNull()
    expect(q(container, 'connector-auth-card-action-reconnect')).toBeNull()
    fireEvent.click(q(container, 'connector-auth-card-action-connect')!)
    expect(onAction).toHaveBeenCalledWith('connect')
  })

  it('连接中态:不渲染正向动作按钮(避免重复发起),但「暂不」恒在(决策态含 connecting)', () => {
    const onAction = vi.fn()
    const { container } = card('connecting', { onAction })
    expect(q(container, 'connector-auth-card-action-connect')).toBeNull()
    expect(q(container, 'connector-auth-card-action-reconnect')).toBeNull()
    expect(q(container, 'connector-auth-card-label-connecting')?.textContent).toBe(
      'chat.connectorAuth.connecting',
    )
    const decline = q(container, 'connector-auth-card-action-decline')
    expect(decline).not.toBeNull()
    fireEvent.click(decline!)
    expect(onAction).toHaveBeenCalledWith('decline')
  })

  it('需重连态:动词是「重新连接 {connectorName}」+「暂不」', () => {
    const onAction = vi.fn()
    const { container } = card('reconnect', { onAction })
    expect(q(container, 'connector-auth-card-action-reconnect')).not.toBeNull()
    expect(q(container, 'connector-auth-card-action-connect')).toBeNull()
    expect(q(container, 'connector-auth-card-action-decline')).not.toBeNull()
    fireEvent.click(q(container, 'connector-auth-card-action-reconnect')!)
    expect(onAction).toHaveBeenCalledWith('reconnect')
    // 重连标签的插值经 Text 直通可断言(与 web reconnect({connectorName}) 同形)
    expect(
      q(container, 'connector-auth-card-action-reconnect')?.textContent,
    ).toBe('chat.connectorAuth.reconnect({"connectorName":"飞书"})')
  })

  it('已连接 / 已拒绝态:无动作按钮区(「暂不」不再渲染),但 moreInfo 仍可达', () => {
    const onAction = vi.fn()
    for (const state of ['connected', 'declined'] as const) {
      const { container, unmount } = card(state, { onAction })
      expect(q(container, 'connector-auth-card-action-decline'), state).toBeNull()
      expect(q(container, 'connector-auth-card-action-connect'), state).toBeNull()
      expect(q(container, 'connector-auth-card-action-moreInfo'), state).not.toBeNull()
      fireEvent.click(q(container, 'connector-auth-card-action-moreInfo')!)
      expect(onAction, state).toHaveBeenCalledWith('moreInfo')
      onAction.mockClear()
      unmount()
    }
    // 已拒绝态标签带 connectorName 插值(拒绝只作用于该连接器的动作)
    const { container } = card('declined', { onAction })
    expect(q(container, 'connector-auth-card-label-declined')?.textContent).toBe(
      'chat.connectorAuth.declined({"connectorName":"飞书"})',
    )
  })

  it('宿主未接 onAction:整卡只读,不出任何动作按钮', () => {
    const { container } = card('disconnected')
    expect(q(container, 'connector-auth-card-action-connect')).toBeNull()
    expect(q(container, 'connector-auth-card-action-decline')).toBeNull()
    expect(q(container, 'connector-auth-card-action-moreInfo')).toBeNull()
  })

  it('三个决策态(穷尽)均渲染「暂不」—— 规格硬要求:不得只有"允许"', () => {
    const decisionStates = CONNECTOR_AUTH_STATES.filter(isConnectorAuthDecisionState)
    expect(decisionStates).toEqual(['disconnected', 'connecting', 'reconnect'])
    for (const state of decisionStates) {
      const { container, unmount } = card(state, { onAction: vi.fn() })
      expect(q(container, 'connector-auth-card-action-decline'), state).not.toBeNull()
      unmount()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
