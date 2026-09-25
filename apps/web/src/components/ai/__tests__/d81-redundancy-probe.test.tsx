// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D81 尾票「②活动级耗时条 / ③搜索查询词」的**渲染取证**(不是组件单测)。
//
// 为什么要这一条:上一轮把 ②③ 判成"刻意未接,属删冗余不属补接线",依据是**读注释**得出的
// "现役宿主已经在显示同样的信息"。读注释不构成证明 —— 本仓最高频的失败形态正是
// "文档说的与产物不一致"。所以这里喂**真** `ToolCallCard`,从渲染出的 DOM 的 `textContent`
// 上正则量出耗时文本与查询词文本,并在同一条用例里给出**反向对照**(拿掉入参即必须查不到),
// 否则断言退化成"页面上本来就有这串字"的假绿。
//
// 取词 mock 与 tool-activity-line-wiring.test.tsx 同源:读 packages/i18n 真实语言包,
// 因此本探针断的是**线上文案**,不是 mock 里编出来的字符串。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReactNode } from 'react'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu, hasIcuSyntax: hasIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/shared/zh-CN.json',
  )
  const status = (JSON.parse(readFile(pack, 'utf8')) as { taskStatus: Record<string, string> })
    .taskStatus
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        if (ns !== 'taskStatus') return key
        const raw = status[key] ?? key
        if (hasIcu(raw)) return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
        return raw.replace(/\{(\w+)\}/gu, (_m, name: string) => String(values?.[name] ?? ''))
      },
  }
})

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

import { ToolCallCard } from '../tool-call-card'

const here = dirname(fileURLToPath(import.meta.url))
/**
 * 五语 shared 词包按需读取。刻意**不**再提供"取某键文案"的 helper:
 * `taskStatus.workedForDuration` / `taskStatus.searchWithQuery` 自 D81 尾票起全仓零消费点
 * (唯一取用者是本探针,而它做的是反向断言),已随本轮从五语删除 —— 反向断言改用字面量,
 * 免得测试反过来依赖一个"应当不存在"的键。
 */
const sharedPack = (loc: string) =>
  JSON.parse(
    readFileSync(
      join(here, '../../../../../../packages/i18n/messages/shared', `${loc}.json`),
      'utf8',
    ),
  ) as { taskStatus: Record<string, string> }

/** 取某一行的可见文本(整行 textContent,不是"元素存不存在") */
function rowText(container: HTMLElement, id: string): string {
  const row = container.querySelector<HTMLElement>(`[data-testid="tool-call-row-${id}"]`)
  if (!row) throw new Error(`未找到工具行 tool-call-row-${id}`)
  return row.textContent ?? ''
}

/** 现役的查询词载体:StreamRow 上带 data-stream-subject 的那一段 */
function subjectText(container: HTMLElement, id: string): string {
  const row = container.querySelector<HTMLElement>(`[data-testid="tool-call-row-${id}"]`)
  const subject = row?.querySelector<HTMLElement>('[data-stream-subject="true"]')
  return subject?.textContent ?? ''
}

describe('D81 ② 现役活动条自行显示耗时(无需 ActivityDuration)', () => {
  afterEach(() => cleanup())

  it('duration=2400 → 活动行文本含 "2.4s"(共享层 formatDuration 的产物)', () => {
    const { container } = render(
      <ToolCallCard
        toolCallId="p-dur"
        toolName="read_file"
        args={{ path: 'apps/web/package.json' }}
        status="success"
        duration={2400}
      />,
    )
    const text = rowText(container, 'p-dur')
    expect(text).toMatch(/2\.4s/u)
    // 一分钟以上也必须走同一个格式化器(证明不是"恰好 2.4 这串数字在页面上")
    cleanup()
    const long = render(
      <ToolCallCard
        toolCallId="p-dur-long"
        toolName="read_file"
        args={{ path: 'apps/web/package.json' }}
        status="success"
        duration={75_000}
      />,
    )
    expect(rowText(long.container, 'p-dur-long')).toMatch(/1m15s/u)
  })

  it('反向对照:不传 duration 时同一正则必须查不到(否则上一条断言无牙)', () => {
    const { container } = render(
      <ToolCallCard
        toolCallId="p-nodur"
        toolName="read_file"
        args={{ path: 'apps/web/package.json' }}
        status="success"
      />,
    )
    expect(rowText(container, 'p-nodur')).not.toMatch(/2\.4s|1m15s/u)
  })
})

describe('D81 ③ 现役活动条自行显示查询词(无需 ActivitySearchQuery)', () => {
  afterEach(() => cleanup())

  // 两个登记为 query 类目的检索工具都要量:只测一个会让"表里漏登记那一枚"溜过去
  for (const toolName of ['file_search', 'search_codebase']) {
    it(`${toolName}:args.query 逐字落在活动行上`, () => {
      const query = '守门 83 前景配对 落点'
      const { container } = render(
        <ToolCallCard
          toolCallId={`p-q-${toolName}`}
          toolName={toolName}
          args={{ query }}
          result={{ results: 3 }}
          status="success"
        />,
      )
      const text = rowText(container, `p-q-${toolName}`)
      expect(text).toContain(query)
      // subject 位必须显式带查询类目(等宽渲染),不是靠"整页搜字符串"蒙对
      expect(subjectText(container, `p-q-${toolName}`)).toContain(query)
    })
  }

  it('反向对照:无 query 入参时 subject 位为空(证明上一条测的就是查询词)', () => {
    const { container } = render(
      <ToolCallCard
        toolCallId="p-noq"
        toolName="file_search"
        args={{ path: 'README.md' }}
        status="success"
      />,
    )
    expect(subjectText(container, 'p-noq')).toBe('')
  })

  it('口径对账:③ 的措辞键已从五语删除,现役行只出裸查询词(反向对照防"前缀文案"回潮)', () => {
    const query = 'hello-ihui'
    const { container } = render(
      <ToolCallCard
        toolCallId="p-key"
        toolName="file_search"
        args={{ query }}
        status="success"
      />,
    )
    const text = rowText(container, 'p-key')
    // 旧措辞键 searchWithQuery = "查询:{query}"。现役只出裸查询词 ⇒ ②③ 与现役的差异**只在措辞**,
    // 信息(耗时数值 / 查询词本身)已在行上;该键与 workedForDuration 同批因零消费点被删。
    expect(text).toContain(query)
    expect(text).not.toContain(`查询:${query}`)
    for (const loc of ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']) {
      const pack = sharedPack(loc)
      expect(pack.taskStatus.searchWithQuery ?? null).toBeNull()
      expect(pack.taskStatus.workedForDuration ?? null).toBeNull()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
