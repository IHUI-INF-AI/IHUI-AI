// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { clipCsvRows, CSV_PREVIEW_MAX_ROWS, parseCsv } from '@/lib/csv-preview'
import {
  classifyDelimitedText,
  clipPreviewRows,
  columnWidthsInCh,
  displayWidthOf,
  parseDelimited,
  previewExtFromHref,
  richPreviewKindOf,
  RICH_PREVIEW_MAX_TEXT_BYTES,
} from '@/lib/file-preview-attachment'

/**
 * V3 #70 富预览纯函数判据。
 *
 * 最重要的一条是 P 组:CSV(逗号)**必须与既有 parseCsv 逐字同果**。
 * 本票新建了第二型解析器(制表符),如果逗号那型也各写一遍,就会出现
 * "同一个 CSV 两种命运" —— 那是本仓反复记录的漂移型(两份 _TOOL_ALIASES、
 * 两处算同一 key)。这条用例是那件事的锁,不是装饰。
 */

describe('扩展名判型 richPreviewKindOf / previewExtFromHref', () => {
  it('pdf / csv / tsv 各自落对型,且 tsv 的判据字段是真制表符', () => {
    expect(richPreviewKindOf('pdf')).toEqual({ kind: 'pdf' })
    expect(richPreviewKindOf('csv')).toEqual({ kind: 'delimited', format: 'csv', delimiter: ',' })
    expect(richPreviewKindOf('TSV')).toEqual({ kind: 'delimited', format: 'tsv', delimiter: '\t' })
  })

  it('office 那一族转交、未知扩展名判不支持(不静默当 csv)', () => {
    expect(richPreviewKindOf('xlsx')).toEqual({ kind: 'office' })
    expect(richPreviewKindOf('doc')).toEqual({ kind: 'office' })
    expect(richPreviewKindOf('zip')).toEqual({ kind: 'unsupported', ext: 'zip' })
    expect(richPreviewKindOf('')).toEqual({ kind: 'unsupported', ext: '' })
  })

  it('从 href 取扩展名要剥掉 query 与 hash(带签名的对象存储 URL 是常态)', () => {
    expect(previewExtFromHref('/uploads/a.pdf')).toBe('pdf')
    expect(previewExtFromHref('https://cdn/x/y.CSV?sig=1&t=2')).toBe('csv')
    expect(previewExtFromHref('/f/data.tsv#frag')).toBe('tsv')
    expect(previewExtFromHref('/f/noext')).toBe('')
    expect(previewExtFromHref('/dir.d/file')).toBe('')
  })
})

describe('解析前失败态 classifyDelimitedText', () => {
  it('声明体积超上限判 tooLarge(以实测字节为准,不猜)', () => {
    expect(classifyDelimitedText('a,b\n1,2', RICH_PREVIEW_MAX_TEXT_BYTES + 1)).toBe('tooLarge')
    expect(classifyDelimitedText('a,b\n1,2', RICH_PREVIEW_MAX_TEXT_BYTES)).toBeNull()
  })

  it('正文含 NUL 判 binary(扩展名说 csv 但内容是二进制 = 类型不符)', () => {
    expect(classifyDelimitedText('a,b\n\0\x001,2', null)).toBe('binary')
  })

  it('纯空白判 empty;正常文本返回 null', () => {
    expect(classifyDelimitedText('   \n\t \n', 8)).toBe('empty')
    expect(classifyDelimitedText('a,b\n1,2', 6)).toBeNull()
  })

  it('Content-Length 缺失时用正文编码长度兜底(UTF-8 多字节不得按字符数低估)', () => {
    const cjk = '名称,值\n北京,1'
    const byBytes = new TextEncoder().encode(cjk).length
    expect(byBytes).toBeGreaterThan(cjk.length)
    expect(classifyDelimitedText(cjk, null)).toBeNull()
  })
})

describe('P 组:CSV 与既有 parseCsv 的逐字奇偶(反漂移锁)', () => {
  const corpus: readonly string[] = [
    'a,b,c\n1,2,3\n',
    'name,note\n"Doubled ""quote""",x\n',
    'name,note\n"has,comma",y\n',
    'a,b\n"multi\nline",z\n',
    'a,b,c\r\n1,2,3\r\n',
    'a,b,\n1,2,\n',
    '',
    '\n\n\n',
    'a\nb\nc\n',
    'x,,y\n',
    '"just one quoted field"\n',
    'a,b\n"trailing",\n',
  ]

  it.each(corpus.map((text, i) => [i, text] as const))(
    '语料 #%n:parseDelimited(text, ",") 与 parseCsv(text) 结果必须逐字相等',
    (_idx, text) => {
      expect(parseDelimited(text, ',')).toEqual(parseCsv(text))
    },
  )

  it('转发口径:引号内含逗号这种最易漂的语料上,两路必须同果', () => {
    const text = 'a,b\n"x,1",2\n'
    expect(parseDelimited(text, ',')).toStrictEqual(parseCsv(text))
  })

  it('制表符:引号内逗号不得被当分隔符(RFC 4180 语义对 TSV 同样成立)', () => {
    expect(parseDelimited('a\tb\n"x,y"\tz\n', '\t')).toEqual([
      ['a', 'b'],
      ['x,y', 'z'],
    ])
  })

  it('制表符:引号转义 "" 与跨行引号字段', () => {
    expect(parseDelimited('a\tb\n"q""t"\t"l\nm"\n', '\t')).toEqual([
      ['a', 'b'],
      ['q"t', 'l\nm'],
    ])
  })

  it('纯空白行被滤掉,尾空单元格保留', () => {
    expect(parseDelimited('a\tb\n\t\n1\t\n', '\t')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ])
  })

  it('空输入返回空表(不是抛错,也不是 [[\'\'』)', () => {
    expect(parseDelimited('', '\t')).toEqual([])
    expect(parseDelimited('', ',')).toEqual([])
  })
})

describe('行数裁剪 clipPreviewRows(诚实性)', () => {
  const rows = Array.from({ length: 137 }, (_, i) => [`r${i}`, 'x'])

  it('total 恒为全量,shown 恒为可见数,truncated 如实', () => {
    const v = clipPreviewRows(rows, CSV_PREVIEW_MAX_ROWS)
    expect(v.total).toBe(137)
    expect(v.shown).toBe(CSV_PREVIEW_MAX_ROWS)
    expect(v.rows.length).toBe(CSV_PREVIEW_MAX_ROWS)
    expect(v.truncated).toBe(true)
  })

  it('未超上限时 truncated=false(不得让 UI 误报截断)', () => {
    const v = clipPreviewRows(rows, 200)
    expect(v.truncated).toBe(false)
    expect(v.shown).toBe(137)
  })

  it('展开态(MAX_SAFE_INTEGER)不截断,且 total 仍报全量', () => {
    const v = clipPreviewRows(rows, Number.MAX_SAFE_INTEGER)
    expect(v.shown).toBe(137)
    expect(v.truncated).toBe(false)
  })

  it('与既有 clipCsvRows 在逗号口径下同数(total/shown/truncated 三值一致)', () => {
    const a = clipPreviewRows(rows, CSV_PREVIEW_MAX_ROWS)
    const b = clipCsvRows(rows, CSV_PREVIEW_MAX_ROWS)
    expect({ total: a.total, truncated: a.truncated, rows: a.rows.length }).toEqual({
      total: b.total,
      truncated: b.truncated,
      rows: b.rows.length,
    })
  })

  it('空表不炸', () => {
    expect(clipPreviewRows([], 50)).toEqual({ rows: [], total: 0, shown: 0, truncated: false })
  })
})

describe('列宽自适应 columnWidthsInCh', () => {
  it('CJK 记双宽,窄列夹到下限,超长列夹到上限', () => {
    const w = columnWidthsInCh([
      ['名', 'x'],
      ['这是一个非常非常非常非常非常非常长的中文列标题内容', 'y'],
    ])
    expect(w[0]).toBeGreaterThanOrEqual(6)
    expect(w[0]).toBeLessThanOrEqual(42)
    expect(w[1]).toBe(6)
  })

  it('列数不等(脏数据)不得越界崩:按最长行的列数补齐', () => {
    const w = columnWidthsInCh([['a'], ['b', 'cc', 'ddd']])
    expect(w.length).toBe(3)
    expect(w.every((x) => Number.isFinite(x) && x >= 6 && x <= 42)).toBe(true)
  })

  it('空表返回空数组(渲染层据此走无表头分支)', () => {
    expect(columnWidthsInCh([])).toEqual([])
  })

  it('displayWidthOf:ASCII 单宽、非 ASCII 双宽,代理对不误计', () => {
    expect(displayWidthOf('abc')).toBe(3)
    expect(displayWidthOf('中')).toBe(2)
    expect(displayWidthOf('中a')).toBe(3)
    expect(displayWidthOf('')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
