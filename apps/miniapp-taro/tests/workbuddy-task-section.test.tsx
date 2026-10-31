// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「自动做任务」区块(WorkBuddy 任务中心六族)小程序端验收。
 *
 * 端不一致是本票的起点:web 端 WorkbuddyTaskPanel 早已有这块,小程序签到助手页没有。
 * 本文件量四件事:
 *  ① 无 workbuddy 账号 ⇒ 整块不挂载、零请求(api.get / api.post 都不许被打);
 *  ② 一键做任务的请求体必须 `{kind:'all', dry_run:false}`,预演必须 dry_run:true;
 *  ③ 巡检态判据必须读 `wb_tasks.enabled`(两门与),只看 tasks_enabled 会造出
 *     "显示已启用却永不跑"的假绿 —— 用反向用例钉死;
 *  ④ 装车证明:区块真的挂在签到助手页的渲染树里(摘掉渲染点本条必红)。
 *
 * 取证边界(如实):本仓小程序端无 DOM 测试环境(无 @testing-library / react-test-renderer),
 * 所以这里证的是**静态渲染输出**(renderToStaticMarkup)、**请求出口**(直接调导出的
 * loadTasks/run 函数)与**源码结构**;不是"真机点过按钮"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return { View: make('div'), Text: make('span') }
})

// 请求层整层替身:计数即"有没有打请求"的唯一证据。
vi.mock('@/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

import * as api from '@/api'
import {
  WorkbuddyTaskSection,
  deriveSweepView,
  loadWorkbuddyTasks,
  runWorkbuddyTasks,
  workbuddyTaskRunBody,
} from '@/pkg-user/checkin-assistant/WorkbuddyTaskSection'

const HERE = dirname(fileURLToPath(import.meta.url))
const SECTION_SOURCE = join(HERE, '../src/pkg-user/checkin-assistant/WorkbuddyTaskSection.tsx')
const PAGE_SOURCE = join(HERE, '../src/pkg-user/checkin-assistant/index.tsx')

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

const getMock = api.get as unknown as ReturnType<typeof vi.fn>
const postMock = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  getMock.mockReset()
  postMock.mockReset()
})

describe('小程序端「自动做任务」:只对有 workbuddy 账号的用户出现', () => {
  it('① 无 workbuddy 账号 ⇒ 整块不渲染,且零请求', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbuddyTaskSection, {
        accounts: [
          { id: 1, name: 'trae-1', platform: 'trae' },
          { id: 2, name: 'qoder-1', platform: 'qoder' },
          { id: 3, name: '无平台', platform: null },
        ],
        t: translate,
      }),
    )
    expect(html).toBe('')
    expect(getMock).toHaveBeenCalledTimes(0)
    expect(postMock).toHaveBeenCalledTimes(0)
  })

  it('①-反向对照:有 workbuddy 账号 ⇒ 标题挂出来(证明不是永远返回空)', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbuddyTaskSection, {
        accounts: [{ id: 9, name: 'wb-1', platform: 'workbuddy' }],
        t: translate,
      }),
    )
    expect(html).toContain('data-testid="wb-task-section"')
    expect(html).toContain('«checkinAssistant.taskTitle»')
    // 折叠态不拉巡检态:展开才请求(与 web 端"点开才查"同口径)
    expect(getMock).toHaveBeenCalledTimes(0)
  })

  it('② 一键做任务:body 恒为 kind=all,dry_run 随动作切换', async () => {
    postMock.mockResolvedValue({
      ok: true,
      kind: 'run',
      accepted: [],
      claimed: [],
      credit_delta: 0,
      reason: null,
      unjudged: false,
    })

    expect(workbuddyTaskRunBody(false)).toEqual({ kind: 'all', dry_run: false })
    expect(workbuddyTaskRunBody(true)).toEqual({ kind: 'all', dry_run: true })

    await runWorkbuddyTasks(7, false)
    expect(postMock).toHaveBeenLastCalledWith('/checkin/accounts/7/task-run', {
      kind: 'all',
      dry_run: false,
    })

    await runWorkbuddyTasks(7, true)
    expect(postMock).toHaveBeenLastCalledWith('/checkin/accounts/7/task-run', {
      kind: 'all',
      dry_run: true,
    })
    expect(postMock).toHaveBeenCalledTimes(2)
  })

  it('②-附带:读取任务是只读 GET,且账号 id 过了 encodeURIComponent', async () => {
    getMock.mockResolvedValue({ ok: true, kind: 'list', tasks: [], reason: null, unjudged: false })
    await loadWorkbuddyTasks(42)
    expect(getMock).toHaveBeenCalledWith('/checkin/accounts/42/tasks')
  })
})

describe('巡检态五档:enabled 必须是任务门 ∧ 总闸', () => {
  const base = {
    enabled: true,
    started: true,
    next_run: null,
    next_run_qoder: null,
  }

  it('两门都开且真实写入 ⇒ 已启用', () => {
    const view = deriveSweepView(
      {
        ...base,
        next_run_wb_tasks: '2026-10-31T12:34:56.000Z',
        wb_tasks: {
          enabled: true,
          tasks_enabled: true,
          cron_enabled: true,
          live_run: true,
          sweep_minutes: 30,
          claim_path_configured: true,
          activity_path_configured: true,
          last_sweep: null,
        },
      },
      null,
      translate,
    )
    expect(view.tone).toBe('on')
    expect(view.text).toBe('«checkinAssistant.taskAutoOn»({"minutes":30})')
    // ISO 前 16 位截断,不走 toLocaleString
    expect(view.next).toBe('2026-10-31 12:34')
  })

  it('两门开但是演练模式 ⇒ warn,不得说"已启用"', () => {
    const view = deriveSweepView(
      {
        ...base,
        wb_tasks: {
          enabled: true,
          tasks_enabled: true,
          cron_enabled: true,
          live_run: false,
          sweep_minutes: 30,
          claim_path_configured: true,
          activity_path_configured: true,
          last_sweep: null,
        },
      },
      null,
      translate,
    )
    expect(view.tone).toBe('warn')
    expect(view.text).toBe('«checkinAssistant.taskAutoDry»')
  })

  it('任务门开、总闸关 ⇒ warn 且点名总闸(enabled=false 的解释分支)', () => {
    const view = deriveSweepView(
      {
        ...base,
        wb_tasks: {
          enabled: false,
          tasks_enabled: true,
          cron_enabled: false,
          live_run: true,
          sweep_minutes: 30,
          claim_path_configured: true,
          activity_path_configured: true,
          last_sweep: null,
        },
      },
      null,
      translate,
    )
    expect(view.tone).toBe('warn')
    expect(view.text).toBe('«checkinAssistant.taskAutoCronBlocked»')
  })

  it('任务门也关 ⇒ off(未启用,仅手动)', () => {
    const view = deriveSweepView(
      {
        ...base,
        wb_tasks: {
          enabled: false,
          tasks_enabled: false,
          cron_enabled: true,
          live_run: true,
          sweep_minutes: 30,
          claim_path_configured: true,
          activity_path_configured: true,
          last_sweep: null,
        },
      },
      null,
      translate,
    )
    expect(view.tone).toBe('off')
    expect(view.text).toBe('«checkinAssistant.taskAutoOff»')
  })

  it('取不到状态(旧服务端/请求失败)⇒ unknown,绝不写成未启用', () => {
    const view = deriveSweepView(null, 'HTTP 404', translate)
    expect(view.tone).toBe('unknown')
    expect(view.text).toContain('«checkinAssistant.taskAutoUnknown»')
    expect(view.text).toContain('HTTP 404')
    expect(view.text).not.toBe('«checkinAssistant.taskAutoOff»')
  })

  it('还没取到 ⇒ loading 档(不是"未启用")', () => {
    const view = deriveSweepView(undefined, null, translate)
    expect(view.tone).toBe('unknown')
    expect(view.text).toBe('«checkinAssistant.taskAutoLoading»')
  })

  it('路径未配置 ⇒ 单独提示"只上报不领奖"', () => {
    const view = deriveSweepView(
      {
        ...base,
        wb_tasks: {
          enabled: true,
          tasks_enabled: true,
          cron_enabled: true,
          live_run: true,
          sweep_minutes: 30,
          claim_path_configured: false,
          activity_path_configured: true,
          last_sweep: null,
        },
      },
      null,
      translate,
    )
    expect(view.pathsMissing).toBe(true)
  })
})

describe('结构纪律与装车证明', () => {
  it('③ 判据只读 wb_tasks.enabled:出现 `!wt.tasks_enabled` 之类的假绿判据即红', () => {
    const src = readFileSync(SECTION_SOURCE, 'utf8')
    expect(src).toMatch(/if\s*\(!wt\.enabled\)/)
    expect(src).not.toMatch(/if\s*\(!wt\.tasks_enabled\)/)
    // "已启用"这一档只能在两门与判过之后才可能产出 —— 把它挪到 `!wt.enabled` 之前,
    // 就是"只开任务门就报已启用"的假绿,本条按源码顺序必红(tasks_enabled 只允许出现在
    // 解释分支里,即 `!wt.enabled` 之后)。
    const gateIdx = src.indexOf('if (!wt.enabled)')
    const onIdx = src.indexOf("tone: 'on'")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(onIdx).toBeGreaterThan(gateIdx)
    // 时间口径:ISO 截断,不许 toLocaleString(端/服务端时区差会让同一时刻显示成两格)
    expect(src).toMatch(/slice\(0,\s*16\)/)
    expect(src).not.toMatch(/\.toLocaleString\s*\(/)
    // 零请求的结构保证:挂载判据必须是 platform==='workbuddy'
    expect(src).toMatch(/platform\s*\?\?\s*''\)\s*===\s*'workbuddy'/)
  })

  it('④ 装车:签到助手页真的挂载本区块(摘掉渲染点本条必红)', () => {
    const page = readFileSync(PAGE_SOURCE, 'utf8')
    expect(page).toMatch(/import\s+WorkbuddyTaskSection\s+from\s+'\.\/WorkbuddyTaskSection'/)
    expect(page).toMatch(/<WorkbuddyTaskSection\s+accounts=\{list\}\s+t=\{t\}\s*\/>/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
