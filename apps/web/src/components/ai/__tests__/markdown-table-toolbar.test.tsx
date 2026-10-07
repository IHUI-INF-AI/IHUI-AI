// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const readPack = (locale: string): Record<string, string | undefined> => {
  const root = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    chat?: { markdownTable?: Record<string, string> }
  }
  return root.chat?.markdownTable ?? {}
}
const zhPack = readPack('zh-CN')
if (Object.keys(zhPack).length === 0) throw new Error('web 语言包缺少 chat.markdownTable 词表')

// t() 由**真实 web 词包**驱动(缺键时和 next-intl 一样回吐裸键名)。
// 于是用例断言的是真实文案:键没补齐 → 界面出现 markdownTable.xxx → 用例真红;
// 而不是把"显示裸键名"这个缺陷本身钉成期望值。
vi.mock('next-intl', async () => {
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const root = JSON.parse(
    readFile(
      cat(dir(toPath(import.meta.url)), '../../../../../../packages/i18n/messages/web/zh-CN.json'),
      'utf8',
    ),
  ) as { chat?: { markdownTable?: Record<string, string> } }
  const subtree = root.chat?.markdownTable ?? {}
  const flat: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(subtree).map(([k, v]) => [`markdownTable.${k}`, v]),
  )
  return {
    useTranslations:
      () =>
      (key: string): string => {
        const raw = flat[key]
        return raw === undefined ? key : raw
      },
  }
})

// 项目 Tooltip 基于 Radix,需 TooltipProvider 祖先;本单测直接 render 组件不走应用根布局
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import {
  MarkdownTableBlock,
  MarkdownTableToolbar,
  buildCsvText,
  buildMarkdownTableText,
  readRowsFromTable,
} from '../markdown-table-toolbar'

/** 让用例能把"非 table 元素"的 ref 直接喂进工具栏(生产里 ref 恒为 <table>) */
function MarkdownTableToolbarHarness({
  tableRef,
}: {
  tableRef: React.RefObject<HTMLElement | null>
}) {
  return <MarkdownTableToolbar tableRef={tableRef as React.RefObject<HTMLTableElement | null>} />
}

/** 造一张真实的 <table> DOM(GFM 形状),供回读函数直接吃 */
function makeTable(): HTMLTableElement {
  const table = document.createElement('table')
  table.innerHTML =
    '<thead><tr><th>姓名</th><th>角色</th></tr></thead>' +
    '<tbody><tr><td>张三</td><td>前端</td></tr><tr><td>李四</td><td>后端</td></tr></tbody>'
  document.body.appendChild(table)
  return table
}

describe('G-824 readRowsFromTable —— 从真实 DOM 回读', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('正例:thead 的 th 作表头,tbody 的 td 作数据行', () => {
    const rows = readRowsFromTable(makeTable())
    expect(rows).toEqual([
      ['姓名', '角色'],
      ['张三', '前端'],
      ['李四', '后端'],
    ])
  })

  it('回读的是 DOM 上的字,不是 markdown 源码:改单元格后读到的是改后的值', () => {
    const table = makeTable()
    // 模拟"表格被中途改过":DOM 上直接把首格改掉
    const cell = table.querySelector('tbody tr td') as HTMLTableCellElement
    cell.textContent = '王五'
    expect(readRowsFromTable(table)[1]).toEqual(['王五', '前端'])
  })

  it('反例:无表格(null)回读得空数组,不抛', () => {
    expect(readRowsFromTable(null)).toEqual([])
  })

  it('反例:非 table 元素(div)回读得空数组,不抛', () => {
    const div = document.createElement('div')
    div.innerHTML = '<p>根本不是表格</p>'
    document.body.appendChild(div)
    expect(readRowsFromTable(div as unknown as HTMLTableElement)).toEqual([])
  })

  it('流式半成品表(只有 thead 没 tbody)不把表头重复计入', () => {
    const table = document.createElement('table')
    table.innerHTML = '<thead><tr><th>a</th><th>b</th></tr></thead>'
    document.body.appendChild(table)
    expect(readRowsFromTable(table)).toEqual([['a', 'b']])
  })

  it('单元格内多段落(块级子节点)的文本被拼回一行,不丢字', () => {
    const table = document.createElement('table')
    table.innerHTML =
      '<thead><tr><th>h</th></tr></thead><tbody><tr><td><p>x</p><p>y</p></td></tr></tbody>'
    document.body.appendChild(table)
    expect(readRowsFromTable(table)).toEqual([['h'], ['xy']])
  })
})

describe('G-824 buildMarkdownTableText —— 由回读行拼 GFM', () => {
  it('正例:表头后插 --- 分隔行,列用 | 包裹', () => {
    expect(
      buildMarkdownTableText([
        ['姓名', '角色'],
        ['张三', '前端'],
      ]),
    ).toBe('| 姓名 | 角色 |\n| --- | --- |\n| 张三 | 前端 |')
  })

  it('列数不齐按 max 列数补空(流式半成品表)', () => {
    expect(buildMarkdownTableText([['a', 'b', 'c'], ['1']])).toBe(
      '| a | b | c |\n| --- | --- | --- |\n| 1 |  |  |',
    )
  })

  it('单元格里的 | 与 \\ 被转义,换行折成 <br>(折行即丢字)', () => {
    expect(
      buildMarkdownTableText([
        ['a|b', 'c'],
        ['x\\y', '1\n2'],
      ]),
    ).toBe('| a\\|b | c |\n| --- | --- |\n| x\\\\y | 1<br>2 |')
  })

  it('反例:空输入返回空串(不吐只有表头的假表)', () => {
    expect(buildMarkdownTableText([])).toBe('')
  })
})

describe('G-824 buildCsvText —— 由回读行拼 CSV', () => {
  it('正例:逗号/引号按 RFC 转义', () => {
    expect(buildCsvText([['a,b', 'c"d']])).toBe('\uFEFF"a,b","c""d"')
  })

  it('过既有唯一出口 neutralizeFormulaCell(= 开头的单元格被中和)', () => {
    expect(buildCsvText([['=SUM(A1)']])).toBe("\uFEFF'=SUM(A1)")
  })

  it('反例:空输入返回空串', () => {
    expect(buildCsvText([])).toBe('')
  })
})

describe('G-824 工具栏 —— 回读→复制/下载/全屏', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const TABLE_MD = '| 姓名 | 角色 |\n| --- | --- |\n| 张三 | 前端 |'

  it('正例:点复制 ⇒ 剪贴板拿到含分隔行的 GFM,且与源表格逐字一致', async () => {
    const { container } = render(
      <MarkdownTableBlock>
        <thead>
          <tr>
            <th>姓名</th>
            <th>角色</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>张三</td>
            <td>前端</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    expect(container.querySelector('[data-testid="markdown-table-toolbar"]')).toBeTruthy()

    fireEvent.click(container.querySelector('[data-testid="markdown-table-copy"]') as HTMLElement)

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    // 逐字断言:与上面 TABLE_MD 源表逐字一致(含分隔行)
    expect(writeText.mock.calls[0]![0]).toBe(TABLE_MD)
  })

  it('表格被中途改过 ⇒ 复制的是改后的 DOM 内容,不是 markdown 源码', async () => {
    const { container } = render(
      <MarkdownTableBlock>
        <thead>
          <tr>
            <th>姓名</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>张三</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    // 直接改真实 DOM(等价于流式追加 / 外部改写)
    const cell = container.querySelector('tbody td') as HTMLTableCellElement
    cell.textContent = '李四'

    fireEvent.click(container.querySelector('[data-testid="markdown-table-copy"]') as HTMLElement)

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copied = writeText.mock.calls[0]![0] as string
    expect(copied).toBe('| 姓名 |\n| --- |\n| 李四 |')
    // 反向对照:旧值不得残留,否则说明它是从源码/初始 props 复制的
    expect(copied).not.toContain('张三')
  })

  it('无表格内容时点复制 ⇒ 如实报 empty,不调剪贴板、不谎报成功', async () => {
    // <table> 存在但没有任何单元格(流式尚未吐出第一行/被上游清空)
    const { container } = render(<MarkdownTableBlock>{null}</MarkdownTableBlock>)
    fireEvent.click(container.querySelector('[data-testid="markdown-table-copy"]') as HTMLElement)
    // 判据是**报了 empty**:只断言"没调剪贴板"分不清是走了 empty 分支还是点击没生效
    await waitFor(() => {
      expect(container.querySelector('[data-testid="markdown-table-notice"]')?.textContent).toBe(
        zhPack.empty,
      )
    })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('反例:非 table 元素喂进回读 ⇒ 空结果,点复制不产出任何 GFM', async () => {
    // 直接锁"非 table 元素"这一格:ref 指向 div 时回读必须空、不得抛
    const NotATable = () => {
      const ref = React.useRef<HTMLDivElement | null>(null)
      return (
        <div>
          <MarkdownTableToolbarHarness tableRef={ref} />
        </div>
      )
    }
    const { container } = render(<NotATable />)
    fireEvent.click(container.querySelector('[data-testid="markdown-table-copy"]') as HTMLElement)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="markdown-table-notice"]')?.textContent).toBe(
        zhPack.empty,
      )
    })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('能力缺失(clipboard 不存在)⇒ 报 unsupported,不静默也不谎报成功', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    const { container } = render(
      <MarkdownTableBlock>
        <tbody>
          <tr>
            <td>a</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    fireEvent.click(container.querySelector('[data-testid="markdown-table-copy"]') as HTMLElement)
    await waitFor(() => {
      expect(container.querySelector('[data-testid="markdown-table-notice"]')?.textContent).toBe(
        zhPack.unsupported,
      )
    })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('下载 CSV ⇒ 真的落一个 <a download> 并 revokeObjectURL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { container } = render(
      <MarkdownTableBlock>
        <thead>
          <tr>
            <th>h1</th>
            <th>h2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>2</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    fireEvent.click(
      container.querySelector('[data-testid="markdown-table-download"]') as HTMLElement,
    )

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    // 临时 <a> 不留在 DOM 里
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('全屏 ⇒ 打开 Dialog 且表头带 sticky 类(形态对标上游 [&_th]:sticky)', async () => {
    const { container } = render(
      <MarkdownTableBlock>
        <thead>
          <tr>
            <th>姓名</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>张三</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    fireEvent.click(
      container.querySelector('[data-testid="markdown-table-fullscreen"]') as HTMLElement,
    )

    await waitFor(() => {
      const dialog = document.querySelector('[data-testid="markdown-table-dialog"]')
      expect(dialog).toBeTruthy()
      expect(dialog?.className).toContain('[&_th]:sticky')
      // 标题也是词表里的真实文案(chat.markdownTable.fullscreenTitle),不是裸键名
      expect(dialog?.textContent).toContain(String(zhPack.fullscreenTitle))
    })
    // 全屏里那张表是真实表格的克隆(用户点之前的内容在里头)
    const cloned = document.querySelector(
      '[data-testid="markdown-table-fullscreen-body"] table',
    ) as HTMLTableElement
    expect(readRowsFromTable(cloned)).toEqual([['姓名'], ['张三']])
  })

  it('工具栏按钮文案取 chat.markdownTable.* 的真实文案(键缺失会回吐裸键名 ⇒ 本用例真红)', () => {
    const { container } = render(
      <MarkdownTableBlock>
        <tbody>
          <tr>
            <td>a</td>
          </tr>
        </tbody>
      </MarkdownTableBlock>,
    )
    const labels = Array.from(
      container.querySelectorAll('[data-testid="markdown-table-toolbar"] button'),
    )
      .map((b) => b.getAttribute('aria-label'))
      .filter((x): x is string => x !== null)
    expect(labels).toEqual([zhPack.copy, zhPack.downloadCsv, zhPack.fullscreen])
    // 正向对照:aria-label 必须是词表里的真实文案,不是 markdownTable.xxx
    expect(labels.join(' ')).not.toContain('markdownTable.')
    // 反向对照:按钮面上不得出现任何中文字符(文案只进 aria-label / Tooltip)
    expect(container.querySelector('[data-testid="markdown-table-toolbar"]')?.textContent).toBe('')
  })

  it('组件用到的 8 个 chat.markdownTable.* 键在五语言词包齐全、键集一致、都是真实文案', () => {
    // 这份名单来自源码:4 个 t('markdownTable.*') 字面量 + 4 个经 flashNotice 变量喂给 t() 的键
    const COMPONENT_KEYS = [
      'copy',
      'downloadCsv',
      'fullscreen',
      'fullscreenTitle',
      'empty',
      'unsupported',
      'copyFailed',
      'csvFailed',
    ]
    for (const locale of LOCALES) {
      const pack = readPack(locale)
      expect(Object.keys(pack).sort(), locale).toEqual([...COMPONENT_KEYS].sort())
      for (const key of COMPONENT_KEYS) {
        const value = pack[key]
        expect(typeof value, `${locale}.chat.markdownTable.${key}`).toBe('string')
        expect((value ?? '').trim().length, `${locale}.${key} 不能是空串`).toBeGreaterThan(0)
        expect(value, `${locale}.${key} 不得把裸键名当文案`).not.toBe(`markdownTable.${key}`)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
