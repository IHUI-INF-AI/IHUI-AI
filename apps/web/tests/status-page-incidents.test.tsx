// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 状态页事件区降级契约回归(2026-09-28 立)。
//
// 配套后端改动:`GET /api/public/status/incidents` 现在恒为 `{ incidents, degraded }`。
// 本文件锁两件事:
//  ① 前端读 degraded 字段不得崩,且**缺失该字段(老缓存/旧版响应)时按 false 读**;
//  ② 降级态必须有可见提示 —— 不得再和「最近 30 天无事件记录」共用同一张脸。

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { parseIncidents, IncidentsUnavailableNotice } from '../app/status/page'

// 组件自身不再持有文案:文案由 RSC 从语言包取出后传进来。夹具刻意用一个与五语言
// 都不同的哨兵串,这样"组件里还留着硬编码中文"或"页面没把文案传下来"都会当场红。
const NOTICE_FIXTURE = '__label-from-language-pack__'
// 与同目录既有测试(ai-ws-business-labels.test.ts)同一套定位法:__dirname = apps/web/tests
const PACK_DIR = resolve(__dirname, '../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const VALID_INCIDENT = {
  id: 'incident-openai-2026-09-13',
  providerCode: 'openai',
  modelId: 'gpt-5-mini',
  startedAt: '2026-09-12T18:54:03.000Z',
  resolvedAt: '2026-09-13T15:50:07.000Z',
  severity: 'critical',
  description: '24 errors reported for openai on 2026-09-13',
}

describe('parseIncidents — 降级字段容错', () => {
  it('degraded:true 被读到(查询失败)', () => {
    const parsed = parseIncidents({ incidents: [], degraded: true })
    expect(parsed?.degraded).toBe(true)
    expect(parsed?.incidents).toEqual([])
  })

  it('degraded:false 被读到(确实没有事件)', () => {
    const parsed = parseIncidents({ incidents: [], degraded: false })
    expect(parsed?.degraded).toBe(false)
  })

  it('响应里没有 degraded(老缓存/旧版后端)→ 按 false 读,不得崩', () => {
    const parsed = parseIncidents({ incidents: [VALID_INCIDENT] })
    expect(parsed).not.toBeNull()
    expect(parsed?.degraded).toBe(false)
    expect(parsed?.incidents).toHaveLength(1)
  })

  it('degraded 是非布尔的脏值时同样按 false 读,不得把字符串当 true', () => {
    expect(parseIncidents({ incidents: [], degraded: 'false' })?.degraded).toBe(false)
    expect(parseIncidents({ incidents: [], degraded: null })?.degraded).toBe(false)
  })

  it('条目本身仍逐字段校验:坏条目 → null(整块不采信)', () => {
    expect(parseIncidents({ incidents: [{ ...VALID_INCIDENT, startedAt: 20260913 }] })).toBeNull()
    expect(parseIncidents({ incidents: 'not-an-array' })).toBeNull()
    expect(parseIncidents(null)).toBeNull()
  })
})

describe('IncidentsUnavailableNotice — 降级必须可见', () => {
  it('渲染出降级提示,且与"无事件记录"文案不同形', () => {
    const { container } = render(<IncidentsUnavailableNotice label={NOTICE_FIXTURE} />)
    expect(screen.getByText(NOTICE_FIXTURE)).toBeTruthy()
    // 反向对照:空态文案不得出现在降级提示里(否则两种状态在页面上长得一样)
    expect(container.textContent).not.toContain('最近 30 天无事件记录')
    // 图标必须是矢量(svg),不是 emoji 充当
    expect(container.querySelector('svg')).not.toBeNull()
    // 项目硬约束:不得用分割线 / title 属性做提示
    expect(container.querySelector('hr')).toBeNull()
    expect(container.querySelector('[title]')).toBeNull()
  })

  // 声明↔消费成对:组件只认 prop,真正的文案住在语言包里。
  // 缺了这组断言,「把硬编码中文搬进组件的默认值」也能过上面那一条。
  it('五语言包各有 statusPage.incidentsUnavailable,且非空', () => {
    const values: Record<string, string> = {}
    for (const locale of LOCALES) {
      const pack = JSON.parse(readFileSync(resolve(PACK_DIR, `${locale}.json`), 'utf8')) as Record<
        string,
        unknown
      >
      const ns = pack.statusPage as Record<string, unknown> | undefined
      const value = ns?.incidentsUnavailable
      expect(typeof value, `${locale} 缺 statusPage.incidentsUnavailable`).toBe('string')
      expect((value as string).trim().length, `${locale} 该键为空`).toBeGreaterThan(0)
      values[locale] = (value as string).trim()
    }
    // 语种对(守门 133 的窄版前置):en/ja/ko 不得就是那句中文
    const zh = values['zh-CN']
    for (const locale of ['en', 'ja', 'ko'] as const) {
      expect(values[locale], `${locale} 被中文原文糊过去了`).not.toBe(zh)
    }
  })

  it('page.tsx 里不再留着那句硬编码中文,而是从 statusPage 命名空间取', () => {
    const src = readFileSync(resolve(__dirname, '../app/status/page.tsx'), 'utf8')
    expect(src).toContain("getTranslations('statusPage')")
    expect(src).toContain("copy('incidentsUnavailable')")
    // 反向锁:硬编码那句一旦回到组件里,上面两条仍可能绿,所以这一条独立存在
    expect(src).not.toContain('事件数据暂不可用')
  })
})
