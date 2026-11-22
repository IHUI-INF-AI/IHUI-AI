// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * G-415/A9 跨语言快照:pySplitLines 必须 ≡ Python str.splitlines()。
 * 快照表由 apps/ai-service/.venv 的真实 Python 量出(生成命令见文件尾),Python 侧
 * 同表钉在 apps/ai-service/tests/test_splitlines_parity.py —— 两侧任一侧偏离此表即红
 * (照守门 147/151 的"一份表、两侧判"形状;不另立门,测试级对账)。
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { calculateAddedLines, calculateDeletedLines, pySplitLines } from '../tool-call-summary-card'

afterEach(() => {
  cleanup()
})

/** 与 Python 侧 test_splitlines_parity.py 逐字同表(改任一侧必须同笔改另一侧) */
const SPLITLINES_SNAPSHOT: ReadonlyArray<readonly [string, string[]]> = [
  ['a\nb', ['a', 'b']],
  ['a\r\nb', ['a', 'b']],
  ['a\rb', ['a', 'b']],
  ['a\x0bb', ['a', 'b']], // \v 垂直制表
  ['a\x0cb', ['a', 'b']], // \f 换页
  ['a\x1cb', ['a', 'b']], // FS —— G-415/A9 修复点:旧正则漏,py 得 2 行、TS 得 1 行
  ['a\x1db', ['a', 'b']], // GS —— 同上
  ['a\x1eb', ['a', 'b']], // RS —— 同上
  ['a\x85b', ['a', 'b']], // NEL
  ['a\u2028b\u2029c', ['a', 'b', 'c']], // LS/PS
  ['a\n', ['a']], // 末尾行边界不产生空行
  ['', []],
  ['a', ['a']],
  ['a\n\n', ['a', '']], // 中间空行保留,只去末尾
  ['a\n\nb', ['a', '', 'b']],
]

describe('G-415/A9 pySplitLines ≡ Python str.splitlines() 跨语言快照', () => {
  it.each(SPLITLINES_SNAPSHOT.map((c) => [JSON.stringify(c[0]), c] as const))(
    '%s',
    (_label, [input, expected]) => {
      expect(pySplitLines(input)).toEqual(expected)
    },
  )

  it('快照表必须覆盖 \u001c\u001d\u001e 三个曾漏掉的码位(防修复被回退)', () => {
    const covered = SPLITLINES_SNAPSHOT.filter(([s]) =>
      // LF/CR/VT/FF/NEL/LS/PS 之外,表里必须有且仅有 FS/GS/RS 三行命中此断言
      /[\u001C\u001D\u001E]/.test(s),
    )
    expect(covered).toHaveLength(3)
  })
})

describe('G-415/A9 行统计口径(与 llm.py calculate_added/deleted_lines 同表)', () => {
  it('diff 字符串:统计 + 行(排除 +++;统一 diff 删除边界码位不得再吞行)', () => {
    // 第 3/4 行 "+\x1c+" 在旧 pySplitLines 下粘连成一行 "+"(少算一行 added);
    // 修复后 FS 独立成行,+ 行 = '+added'、'+'、'+' 共 3 行
    const diff = 'ctx\n+added\n+\x1c+\n-sub\n'
    expect(calculateAddedLines({ diff })).toBe(3)
    expect(calculateDeletedLines({ diff })).toBe(1)
  })

  it('content/new_string/old_string:整体行数(修复后边界码位独立成行)', () => {
    expect(calculateAddedLines({ content: 'a\x1cb' })).toBe(2)
    expect(calculateAddedLines({ new_string: 'x\x1dy' })).toBe(2)
    expect(calculateDeletedLines({ old_string: 'p\x1eq' })).toBe(2)
    expect(calculateAddedLines({ diff: 'only-sub\n-x' })).toBe(0)
    expect(calculateDeletedLines({ content: '整体写入无删除' })).toBe(0)
    expect(calculateAddedLines(undefined)).toBe(0)
  })
})

/*
 * 快照表再生成命令(venv 真实 Python,勿凭记忆手写期望值):
 *   ./apps/ai-service/.venv/Scripts/python.exe -c \
 *     "print([('a\nb', 'a\nb'.splitlines()), ('a\x1cb', 'a\x1cb'.splitlines())])"
 * 全表见 apps/ai-service/tests/test_splitlines_parity.py 的 SPLITLINES_SNAPSHOT。
 */
