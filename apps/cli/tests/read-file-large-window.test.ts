// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { MAX_READ_BYTES, read_file } from '../src/tools/builtins.js'
import { countLines, readLineWindow } from '../src/tools/line-window-reader.js'
import type { ToolContext } from '../src/tools/index.js'

/**
 * > MAX_READ_BYTES 的大文件:offset / limit 是**行号窗口**,行数是**真实总行数**。
 *
 * 病灶实测:842KB 以上的文件被 read_file 用「首 512KB 内的换行数」冒充总行数,
 * 于是任何落在 512KB 之后的 offset 都被判成越过末尾(假 EOF),那一段**结构上不可达**。
 * 这里钉三件事:① 512KB 之后的行真读得到;② 报的行数是真实总行数;
 * ③ 只有真越界才给 EOF 提示,且提示里的行数是真实总行数(不是头部行数)。
 *
 * 夹具全在 os.tmpdir() 下造,afterEach 删干净 —— 不在仓库树里留大文件。
 */

/** 每行固定 120 字节(+1 字节换行 = 121),行号窗口与字节偏移的换算才是确定的 */
const LINE_WIDTH = 120

function tag(n: number): string {
  return `L${String(n).padStart(5, '0')}`
}

/** 造第 n 行(1-based),前 6 字节是唯一标记,其余填 'y' 把行撑到 LINE_WIDTH 字节 */
function makeLine(n: number): string {
  const head = tag(n)
  return head + 'y'.repeat(LINE_WIDTH - head.length)
}

describe('read_file 大文件行号窗口(> MAX_READ_BYTES)', () => {
  let dir: string
  let ctx: ToolContext

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-readwin-'))
    ctx = { workspacePath: dir }
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  /** 写一个 lineCount 行的文件;trailing=true 时以换行符结尾(split 语义会多一个空行) */
  function writeBig(name: string, lineCount: number, opts: { eol?: string; trailing?: boolean } = {}): string {
    const eol = opts.eol ?? '\n'
    const trailing = opts.trailing ?? true
    const body = Array.from({ length: lineCount }, (_, i) => makeLine(i + 1)).join(eol) + (trailing ? eol : '')
    const abs = path.join(dir, name)
    fs.writeFileSync(abs, body, 'utf8')
    return abs
  }

  it('offset 落在 512KB 之后 ⇒ 真读到那几行(不是假 EOF,也不是文件开头)', async () => {
    const abs = writeBig('big.txt', 9000)
    expect(fs.statSync(abs).size).toBeGreaterThan(MAX_READ_BYTES)

    const result = await read_file.execute({ path: 'big.txt', offset: 8000, limit: 3 }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).not.toContain('shorter than the provided offset')
    expect(result.output).toContain(tag(8000))
    expect(result.output).toContain(tag(8002))
    // 读的是点名的那一窗,不是文件开头
    expect(result.output).not.toContain(tag(1))
  })

  it('报的行数是真实总行数(9000 行 + 结尾换行 ⇒ 与快路径同口径 9001)', async () => {
    writeBig('big.txt', 9000)
    const result = await read_file.execute({ path: 'big.txt', offset: 8000, limit: 3 }, ctx)
    expect(result.output).toContain('(lines 8000-8002 of 9001)')
    // 头部行数(约 4300)绝不能再冒充总行数
    expect(result.output).not.toMatch(/of 43\d\d\)/)
  })

  it('offset 真越界时才给 EOF 提示,且提示里的行数是真实总行数', async () => {
    writeBig('big.txt', 9000)
    const result = await read_file.execute({ path: 'big.txt', offset: 9002 }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).toContain('shorter than the provided offset (9002)')
    expect(result.output).toContain('The file has 9001 lines')
    // 只允许真实总行数出现在 "The file has N lines" 里
    expect(result.output).toMatch(/The file has 9001 lines\./)
  })

  it('offset 恰好等于总行数 ⇒ 读到的是末尾那个空行,不是 EOF 提示', async () => {
    writeBig('big.txt', 9000)
    const result = await read_file.execute({ path: 'big.txt', offset: 9001, limit: 1 }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).not.toContain('shorter than the provided offset')
    expect(result.output).toContain('9001')
  })

  it('末尾没有换行符 ⇒ 最后一行照样按行取到,总行数少 1', async () => {
    writeBig('nonl.txt', 9000, { trailing: false })
    const result = await read_file.execute({ path: 'nonl.txt', offset: 9000, limit: 1 }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).toContain(tag(9000))
    expect(result.output).toContain('(lines 9000-9000 of 9000)')
  })

  it('CRLF 文件:行内容保留 \\r(与 split(\'\\n\') 同形),512KB 之后照样可读', async () => {
    const abs = writeBig('crlf.txt', 9000, { eol: '\r\n' })
    expect(fs.statSync(abs).size).toBeGreaterThan(MAX_READ_BYTES)

    const result = await read_file.execute({ path: 'crlf.txt', offset: 8000, limit: 1 }, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toContain(tag(8000))

    // 模块口径与快路径逐字一致:行内容带 \r,总行数 = 换行符数 + 1
    const win = readLineWindow(abs, { offset: 8000, limit: 1, maxBytes: MAX_READ_BYTES })
    expect(win.lines).toEqual([`${makeLine(8000)}\r`])
    expect(win.totalLines).toBe(9001)
  })

  it('limit 跨过 512KB 边界 ⇒ 给 token 预算内的部分视图 + 续读 offset(不静默变短)', async () => {
    writeBig('big.txt', 9000)
    const result = await read_file.execute({ path: 'big.txt', offset: 1, limit: 9000 }, ctx)

    expect(result.success).toBe(true)
    expect(result.output).toContain('partial view of lines 1-')
    expect(result.output).toContain('of 9001')
    expect(result.output).toContain('Use read_file with offset')
    // 点名的 9000 行没有一次给完 —— 这一点必须写在明面上
    expect(result.output).not.toContain(tag(9000))
  })

  it('窗口本身读全了却超 token 预算 ⇒ 仍按既有契约硬错(不替模型砍窗口)', async () => {
    writeBig('big.txt', 9000)
    // 3000 行 ≈ 363KB:字节闸没动它,但 token 上远超 25000
    const result = await read_file.execute({ path: 'big.txt', offset: 1, limit: 3000 }, ctx)

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('read_output_too_many_tokens')
  })

  it('512KB 以内的文件继续走原快路径(逐字不变:split 语义的总行数)', async () => {
    fs.writeFileSync(path.join(dir, 'small.txt'), 'one\ntwo\nthree\n', 'utf8')
    const result = await read_file.execute({ path: 'small.txt', offset: 9 }, ctx)
    expect(result.output).toContain('shorter than the provided offset (9)')
    expect(result.output).toContain('The file has 4 lines')
  })
})

describe('line-window-reader(纯函数:数行 + 行窗口)', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-readwin-unit-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  function write(name: string, content: string): string {
    const abs = path.join(dir, name)
    fs.writeFileSync(abs, content, 'utf8')
    return abs
  }

  it('总行数与 split(\'\\n\').length 同口径(结尾换行 ⇒ 末尾空行;无换行 ⇒ 末行有内容)', () => {
    const withNl = write('a.txt', 'a\nb\nc\n')
    expect(countLines(withNl).totalLines).toBe('a\nb\nc\n'.split('\n').length)
    expect(countLines(withNl).totalLinesExact).toBe(true)

    const noNl = write('b.txt', 'a\nb\nc')
    expect(countLines(noNl).totalLines).toBe(3)

    const empty = write('c.txt', '')
    expect(countLines(empty).totalLines).toBe(1)
  })

  it('空行、单行、越界三种端点', () => {
    const abs = write('blank.txt', 'a\n\nb\n')
    expect(readLineWindow(abs, { offset: 2, limit: 1, maxBytes: 1024 }).lines).toEqual([''])
    expect(readLineWindow(abs, { offset: 3, limit: 1, maxBytes: 1024 }).lines).toEqual(['b'])

    const oneLine = write('one.txt', 'only')
    expect(readLineWindow(oneLine, { offset: 1, limit: 5, maxBytes: 1024 }).lines).toEqual(['only'])
    expect(readLineWindow(oneLine, { offset: 2, maxBytes: 1024 }).offsetResolution).toBe('beyond-eof')
  })

  it('单行超过 maxBytes ⇒ 按字节前缀给出,且不把 U+FFFD 当成文件内容', () => {
    // 300 个 3 字节汉字:切在第 100 字节会落在字符中间
    const abs = write('wide.txt', `${'汉'.repeat(300)}\ntail\n`)
    const win = readLineWindow(abs, { offset: 1, limit: 1, maxBytes: 100 })

    expect(win.byteLimited).toBe(true)
    expect(win.lines).toHaveLength(1)
    const first = win.lines[0] ?? ''
    expect(first).not.toContain('\uFFFD')
    expect(Buffer.byteLength(first, 'utf8')).toBeLessThanOrEqual(100)
  })

  it('撞上扫描硬上限 ⇒ 行数是下界、offset 判不了(indeterminate),不冒充结论', () => {
    const body = Array.from({ length: 9000 }, (_, i) => makeLine(i + 1)).join('\n') + '\n'
    const abs = write('capped.txt', body)

    const capped = countLines(abs, { byteCap: 100 })
    expect(capped.totalLinesExact).toBe(false)
    expect(capped.totalLines).toBe(1) // 100 字节还没走完第一行 ⇒ 下界 1,不是 9001
    expect(capped.bytesScanned).toBe(100)

    const win = readLineWindow(abs, { offset: 20, maxBytes: MAX_READ_BYTES, byteCap: 100 })
    expect(win.offsetResolution).toBe('indeterminate')
    expect(win.totalLinesExact).toBe(false)
    expect(win.endLine).toBe(19)

    // 成对:同一个文件不设上限时结论是确定的
    const full = readLineWindow(abs, { offset: 20, maxBytes: MAX_READ_BYTES })
    expect(full.offsetResolution).toBe('ok')
    expect(full.totalLinesExact).toBe(true)
    expect(full.totalLines).toBe(9001)
  })
})
