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
 *  ⑤ 2026-11 后端契约收口:写接口**不再接受 status**(状态服务端按该班规则现算),
 *     回填非当日必须同批给出该日内时刻 ⇒ 端上禁用按钮并拒发请求;业务日一律上海日,
 *     状态一律按服务端回带的 status 渲染(逐行色档要等壳补 rowCellTone,列级死色档已摘)。
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
const CONTRACT_SRC = readFileSync('src/pkg-user/edu-mgmt-attendance/contract.ts', 'utf8')
const DAYBAR_SRC = readFileSync('src/pkg-user/edu-mgmt-attendance/day-bar.tsx', 'utf8')

vi.mock('@tarojs/components', () => {
  // Picker 渲染成纯容器:只验"槽里真挂了节点",不验原生选择器行为(端内无 jsdom)
  const Picker = (props: { children?: ReactNode }) => createElement('div', null, props.children)
  return { View: 'div', Text: 'span', Picker }
})
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
  '<div class="flex items-center gap-md py-md">' +
  '<span class="text-heading font-bold text-foreground">eduMgmt.attendanceTitle</span>' +
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
    // 三个槽容器类名一个都不许出现(ml-auto 头部 / justify-end 行尾 / pt-xs 行尾)
    expect(html).not.toContain('ml-auto')
    expect(html).not.toContain('justify-end')
    expect(html).not.toContain('pt-xs')
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
    expect(html).toContain('ml-auto flex flex-wrap items-center justify-end gap-sm')
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
    // 业务日/时刻选择条同挂 headerAction(整页作用域的取数与写入口径,不进逐行槽)
    expect(html).toContain('eduAttendance.checkInAt')
  })

  it('③b 三条动作的调用面原文钉住(路径 + 载荷构造出口,防止悄悄改契约)', () => {
    expect(PAGE_SRC).toContain("post('/edu-ai-management/attendance/check-in', payload")
    expect(PAGE_SRC).toMatch(/put\(\s*'\/edu-ai-management\/attendance\/check-out'/)
    expect(PAGE_SRC).toMatch(
      /post<BatchOutcome>\(\s*'\/edu-ai-management\/attendance\/batch-check-in'/,
    )
    // 载荷一律经 contract 的三个构造出口,页面不自己手拼 body
    expect(PAGE_SRC).toContain('buildCheckInPayload')
    expect(PAGE_SRC).toContain('buildBatchPayload')
    expect(PAGE_SRC).toContain('buildCheckOutPayload')
    expect(CONTRACT_SRC).toContain("checkInMethod: 'manual'")
    expect(CONTRACT_SRC).toContain("checkOutMethod: 'manual'")
    // 成功后一律重新取列表,不做本地乐观更新
    expect(PAGE_SRC).toContain('setTick((n) => n + 1)')
  })

  it('③c 写接口一律不自报 status(后端已删该字段,状态服务端现算)', () => {
    // 五个状态码字面量在任何写载荷附近都不许出现
    const STATUS_LITERAL = /status:\s*'(present|late|early|absent|leave)'/
    expect(PAGE_SRC).not.toMatch(STATUS_LITERAL)
    expect(CONTRACT_SRC).not.toMatch(STATUS_LITERAL)
    expect(DAYBAR_SRC).not.toMatch(STATUS_LITERAL)
    // 列表渲染只按服务端回带的 status 出字(读回来的状态,不是页面自己写的)
    expect(PAGE_SRC).toContain('status: st(r.status)')
    // 状态列不再挂按列生效的死色档(把迟到/缺勤一起染绿就是账面造假的显示面)
    expect(PAGE_SRC).not.toContain("tone: 'ok'")
  })

  it('③d 回填同日时刻这条新约束在端上有闸:缺时刻 ⇒ 禁用写按钮 + 可读原因上屏', () => {
    // 按钮禁用判据与"拒发请求"两道都用同一个 contract 出口,页面不复算
    expect(PAGE_SRC).toContain('backfillBlocked')
    expect(PAGE_SRC).toContain('disabled={Boolean(busy) || !r.classId || momentMissing}')
    expect(PAGE_SRC).toContain('disabled={noClass || Boolean(busy) || momentMissing}')
    expect(PAGE_SRC).toContain("setNotice(t('eduAttendance.backfillNeedsTime'))")
    expect(DAYBAR_SRC).toContain("t('eduAttendance.backfillNeedsTime')")
  })

  it('③e 业务日单源:页面取上海日,不得再用 UTC 日键', () => {
    expect(PAGE_SRC).toContain('nowDate()')
    expect(PAGE_SRC).not.toMatch(/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
    // 壳的取数回调是首帧闭包(依赖 []),业务日必须经 ref 传递,否则换日不重取
    expect(PAGE_SRC).toContain('dateRef.current = date')
    expect(PAGE_SRC).toContain('/attendance?date=${dateRef.current}')
    // 签退按服务端回带的行日期发起,不被页顶选择带跑
    expect(PAGE_SRC).toContain('date: r.date || date')
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
