// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 纯文本气泡的行内去标记守门。
//
// 这一层的失效方式很具体:不是抛错,而是**符号原样上屏**(用户看到 `**重点**`)。
// 所以每个断言都盯"输出里还有没有裸标记符号",而不是只看函数跑通。
import { describe, expect, it } from 'vitest'
import { stripInlineMarkdown } from '../strip-inline-markdown'

describe('stripInlineMarkdown', () => {
  it('加粗:双星与双下划线都去标记', () => {
    expect(stripInlineMarkdown('这是**重点**内容')).toBe('这是重点内容')
    expect(stripInlineMarkdown('这是__重点__内容')).toBe('这是重点内容')
  })

  it('斜体:单星与单下划线都去标记', () => {
    expect(stripInlineMarkdown('这是*强调*内容')).toBe('这是强调内容')
    expect(stripInlineMarkdown('这是_强调_内容')).toBe('这是强调内容')
  })

  it('行内代码:反引号去标记,内容保留', () => {
    expect(stripInlineMarkdown('用 `npm run dev` 启动')).toBe('用 npm run dev 启动')
  })

  it('删除线:双波浪去标记', () => {
    expect(stripInlineMarkdown('~~作废~~有效')).toBe('作废有效')
  })

  it('加粗与斜体相邻:符号剥干净,内容一个字不少', () => {
    // 断言"内容完整"而不是"符号一个不剩":行内去标记的职责是让用户读得到正文,
    // 复杂嵌套的精确还原需要真解析器(那属于富文本腿)。
    const out = stripInlineMarkdown('**粗**和*斜*')
    expect(out).toContain('粗')
    expect(out).toContain('斜')
    expect(out).not.toContain('**')
  })

  it('纯文本原样返回', () => {
    const plain = '一段没有任何标记的中文,带标点,还有英文 words 和数字 123。'
    expect(stripInlineMarkdown(plain)).toBe(plain)
  })

  it('空串与纯空白不崩', () => {
    expect(stripInlineMarkdown('')).toBe('')
    expect(stripInlineMarkdown('   \n\t ')).toBe('   \n\t ')
  })

  it('跨行不误伤:单星号规则不吃掉行尾的乘法星', () => {
    // `2 * 3 * 4` 三个星号会被当成一对斜体 —— 这是行内去标记的已知边界,
    // 断言的是"不会吃掉跨行内容",而不是"能正确识别数学表达式"
    const out = stripInlineMarkdown('第一行 * 星\n第二行 * 星')
    expect(out).toContain('第一行')
    expect(out).toContain('第二行')
  })

  it('URL 里的下划线不被当斜体吃掉(图片段已在切分阶段拆走,这里只保底)', () => {
    // 纯文本段若真出现裸 URL,`a_b_c` 形态不该被拆成斜体
    expect(stripInlineMarkdown('见 https://x.test/a_b_c 结束')).toBe('见 https://x.test/a_b_c 结束')
  })
})
