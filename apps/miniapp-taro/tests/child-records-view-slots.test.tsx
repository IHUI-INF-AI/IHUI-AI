// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ChildRecordsView 两个可选槽(rowActions / headerAction)+ reloadToken 的接线锁。
 *
 * 判的是本票真不变量,每条都能被破坏、破了就红:
 *  ① 不传槽时渲染**逐字节等于旧形态**:标题行里没有动作容器,整棵树不含任何槽容器类名;
 *     reloadToken 未传时不得触发第二次取数(否则每次挂载多打一枪)。
 *  ② 传槽时动作区确实出现(标题行右侧出现容器与节点),且槽内容原样透传。
 *  ③ 考勤页作为真实消费方:整班点名按钮经 headerAction 挂进树里(引了没用 = 本仓最高频失效型);
 *     一行 classId 都取不到时按钮禁用并给出可读原因。
 *  ④ 行内动作判据:签退只看「已签到 ∧ 未签退」,**绝不按 checkInMethod 挡**
 *     (学生自签过的行也必须能签退 —— web 侧已踩并修过的缺陷,不得回潮)。
 *
 * 端内 vitest 无 jsdom / testing-library(实测 node_modules 三者皆无),故走
 * react-dom/server 同步渲染:能真渲染的是「始终在树上的槽」(headerAction),
 * 行内槽依赖取数后的 rows(服务端渲染停在 loading 分支)⇒ ④ 用页面导出的同一判据函数钉,
 * 不在测试里复刻第二份判据(§22c)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'

const SHELL_SRC = readFileSync('src/pkg-user/edu-child/records-page.tsx', 'utf8')
const PAGE_SRC = readFileSync('src/pkg-user/edu-mgmt-attendance/index.tsx', 'utf8')

vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span' }))
vi.mock('@tarojs/taro', () => {
  const Taro = { showToast: vi.fn(), getCurrentInstance: () => ({ router: { params: {} } }) }
  return { default: Taro, ...Taro, useDidShow: () => {}, useLoad: () => {} }
})
vi.mock('@/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN', tList: () => [] }), t }
})
vi.mock('@/components/ScreenStates.taro', () => {
  const EmptyState = () => createElement('div', { 'data-empty': '' })
  const ScreenSkeleton = () => createElement('div', { 'data-skeleton': '' })
  return { EmptyState, ScreenSkeleton }
})
vi.mock('@/components/ThemeRoot', () => {
  const ThemeRoot = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  return { default: ThemeRoot }
})
vi.mock('@/components/Button', () => {
  const Button = (props: {
    children?: ReactNode
    disabled?: boolean
    loading?: boolean
    variant?: string
  }) =>
    createElement(
      'button',
      {
        'data-disabled': String(Boolean(props.disabled || props.loading)),
        'data-variant': props.variant ?? 'default',
      },
      props.children,
    )
  return { default: Button, Button }
})
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
vi.mock('@/api', () => ({
  get: (...a: unknown[]) => mockGet(...a),
  post: (...a: unknown[]) => mockPost(...a),
  put: (...a: unknown[]) => mockPut(...a),
}))

import { ChildRecordsView } from '../src/pkg-user/edu-child/records-page'
import AttendancePage, { actionAvailability } from '../src/pkg-user/edu-mgmt-attendance/index'

const COLUMNS = [{ key: 'student', title: 'COL-STUDENT' }]
const ROWS = [{ id: 'r1', cells: { student: 'S1' } }]

/** 壳的旧形态标题行(2026-11-03 加槽前的逐字形态),① 的比对基准 */
const OLD_TITLE_ROW =
  '<div class="flex items-center gap-3 py-3">' +
  '<span class="text-xl font-bold text-foreground">eduMgmt.attendanceTitle</span>' +
  '</div>'

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockPut.mockReset()
})

describe('ChildRecordsView 槽位', () => {
  it('① 不传槽:标题行逐字节等于加槽前的旧形态,整树不含任何槽容器', () => {
    const html = renderToStaticMarkup(
      createElement(ChildRecordsView, {
        titleKey: 'eduMgmt.attendanceTitle',
        columns: COLUMNS,
        load: async () => ROWS,
      }),
    )
    expect(html).toContain(OLD_TITLE_ROW)
    // 三个槽容器类名一个都不许出现(ml-auto 头部 / justify-end 行尾 / pt-1 行尾)
    expect(html).not.toContain('ml-auto')
    expect(html).not.toContain('justify-end')
    expect(html).not.toContain('pt-1')
  })

  it('①b 显式传 undefined 槽与不传槽输出完全一致(可选槽不得改变默认形态)', () => {
    const bare = renderToStaticMarkup(
      createElement(ChildRecordsView, {
        titleKey: 'eduMgmt.attendanceTitle',
        columns: COLUMNS,
        load: async () => ROWS,
      }),
    )
    const undef = renderToStaticMarkup(
      createElement(ChildRecordsView, {
        titleKey: 'eduMgmt.attendanceTitle',
        columns: COLUMNS,
        load: async () => ROWS,
        headerAction: undefined,
        rowActions: undefined,
        reloadToken: undefined,
      }),
    )
    expect(undef).toBe(bare)
  })

  it('② 传槽:标题行右侧出现动作容器,槽内容原样透传', () => {
    const html = renderToStaticMarkup(
      createElement(ChildRecordsView, {
        titleKey: 'eduMgmt.attendanceTitle',
        columns: COLUMNS,
        load: async () => ROWS,
        headerAction: createElement('button', { 'data-marker': 'hdr-slot' }, 'HDR'),
      }),
    )
    expect(html).toContain('data-marker="hdr-slot"')
    expect(html).toContain('ml-auto flex flex-wrap items-center justify-end gap-2')
    expect(html).not.toContain(OLD_TITLE_ROW) // 旧形态已被槽撑开,证明①判的是真变化
  })

  it('①c reloadToken 未传时不额外取数(挂载只由 useDidShow 打一枪)', () => {
    const load = vi.fn(async () => ROWS)
    renderToStaticMarkup(
      createElement(ChildRecordsView, {
        titleKey: 'eduMgmt.attendanceTitle',
        columns: COLUMNS,
        load,
      }),
    )
    // 服务端渲染停在 loading 分支,槽 effect 必须在 reloadToken===undefined 时 early-return
    expect(load).not.toHaveBeenCalled()
    expect(SHELL_SRC).toContain('if (options.reloadToken === undefined) return')
  })

  it('②b 行内槽容器只包真实动作节点:rowActions 返回 null 时连容器都不产生', () => {
    // 行内区要等取数,本册按源码形状钉住同一承诺(空节点不产生容器)
    expect(SHELL_SRC).toMatch(
      /const actions = options\.rowActions \? options\.rowActions\(r\) : null/,
    )
    expect(SHELL_SRC).toMatch(
      /\{actions \?\s*\([\s\S]{0,140}flex flex-wrap items-center justify-end/,
    )
    expect(SHELL_SRC).toMatch(/\{options\.headerAction \?\s*\([\s\S]{0,140}ml-auto/)
  })
})

describe('考勤页接线', () => {
  it('③ 整班点名经 headerAction 真挂进树;无 classId 时禁用并给可读原因', () => {
    mockGet.mockResolvedValue({ list: [] })
    const html = renderToStaticMarkup(createElement(AttendancePage))
    expect(html).toContain('eduAttendance.batchCheckIn')
    expect(html).toContain('data-disabled="true"')
    expect(html).toContain('eduAttendance.noClassReason')
  })

  it('③b 三条动作的调用面原文钉住(路径 + 载荷键,防止悄悄改契约)', () => {
    expect(PAGE_SRC).toContain("post('/edu-ai-management/attendance/check-in'")
    expect(PAGE_SRC).toContain("put('/edu-ai-management/attendance/check-out'")
    expect(PAGE_SRC).toMatch(/post[^\n]*'\/edu-ai-management\/attendance\/batch-check-in'/)
    expect(PAGE_SRC).toContain("checkInMethod: 'manual'")
    expect(PAGE_SRC).toContain("status: 'present'")
    expect(PAGE_SRC).toContain("checkOutMethod: 'manual'")
    // 成功后一律重新取列表,不做本地乐观更新
    expect(PAGE_SRC).toContain('setReloadToken((n) => n + 1)')
  })

  it('④ 行内动作判据:自签过的行必须仍能签退;已签退的行两个动作都不给', () => {
    expect(actionAvailability({ checkInTime: null, checkOutTime: null })).toEqual({
      canCheckIn: true,
      canCheckOut: false,
    })
    // 学生自签(签到方式非 manual)—— 签退不得被挡
    expect(actionAvailability({ checkInTime: '2026-11-03T08:00:00Z', checkOutTime: null })).toEqual(
      { canCheckIn: false, canCheckOut: true },
    )
    expect(
      actionAvailability({
        checkInTime: '2026-11-03T08:00:00Z',
        checkOutTime: '2026-11-03T16:00:00Z',
      }),
    ).toEqual({ canCheckIn: false, canCheckOut: false })
    // 判据体内不许出现签到方式这一维(射程取函数体,不取整页,免误伤载荷契约)
    const judge = PAGE_SRC.slice(
      PAGE_SRC.indexOf('export function actionAvailability'),
      PAGE_SRC.indexOf('export default function Page'),
    )
    expect(judge.length).toBeGreaterThan(0)
    expect(judge).not.toContain('checkInMethod')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
