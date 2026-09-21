// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  REASONING_SECTION_MIN_BODY,
  REASONING_TITLE_MAX,
  splitReasoningSections,
} from '../reasoning-sections'

/**
 * P3 #33 reasoning 分节解析测试(2026-09-16 立)
 */
describe('splitReasoningSections', () => {
  it('空/纯空白输入返回空数组(渲染层零渲染)', () => {
    expect(splitReasoningSections('')).toEqual([])
    expect(splitReasoningSections('   \n  \n')).toEqual([])
  })

  it('单段短内容:退化为无标题单节(不加噪音)', () => {
    const out = splitReasoningSections('用户想让我查天气,先调工具。')
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ title: '', body: '用户想让我查天气,先调工具。' })
  })

  it('按空行切多段:长段落获得隐式标题(首行截断)', () => {
    const firstPara =
      '需要先分析用户的意图,判断是查询类还是操作类问题,然后再决定调用哪个工具来完成任务,同时考虑上下文里是否已有足够信息可以直接回答,避免不必要的工具往返开销,最后组织成结构化的回答输出给用户。'
    const out = splitReasoningSections(`${firstPara}\n\n第二段内容。`)
    expect(out).toHaveLength(2)
    expect(out[0]?.title.length).toBeGreaterThan(0)
    expect(out[0]?.title.length).toBeLessThanOrEqual(REASONING_TITLE_MAX)
    expect(out[0]?.body).toBe(firstPara)
    // 第二段过短 → 无标题
    expect(out[1]?.title).toBe('')
    expect(out[1]?.body).toBe('第二段内容。')
  })

  it('显式 markdown 标题:标题行从正文剔除,标题去 # 保留文本', () => {
    // "## 分析问题" 后跟空行 → 标题段(body 为空);其后两段各自成节
    const out = splitReasoningSections('## 分析问题\n\n正文第一段。\n\n正文第二段。')
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ title: '分析问题', body: '' })
    expect(out[1]?.body).toBe('正文第一段。')
    expect(out[2]?.body).toBe('正文第二段。')
  })

  it('隐式标题剥列表符号/序号前缀', () => {
    const longBody = `- 第一步,先检查输入参数的合法性,包括必填项与格式约束是否满足要求。${'补充说明'.repeat(20)}`
    const out = splitReasoningSections(`${longBody}\n\n收尾。`)
    // 标题 = 首行剥 "- " 前缀后按 REASONING_TITLE_MAX 截断
    expect(out[0]?.title).toBe('第一步,先检查输入参数的合法性,包括必填项与格式')
    expect(out[0]?.body).toBe(longBody)
  })

  it('正文保留段内原始换行', () => {
    const body = `第一行${'x'.repeat(90)}\n第二行`
    const out = splitReasoningSections(`${body}\n\n结尾`)
    expect(out[0]?.body).toBe(body)
    expect(out[0]?.body).toContain('\n')
  })

  it('\\r\\n 容错:回车符被清理', () => {
    const out = splitReasoningSections(`第一段${'x'.repeat(90)}\r\n\r\n第二段`)
    expect(out).toHaveLength(2)
    expect(out[0]?.body).not.toContain('\r')
  })

  it('首行极长(无换行长文本):标题取截断,正文完整', () => {
    const long = '长'.repeat(200)
    const out = splitReasoningSections(long)
    expect(out).toHaveLength(1)
    expect(out[0]?.title).toHaveLength(REASONING_TITLE_MAX)
    expect(out[0]?.body).toBe(long)
  })

  it('段落长度阈值:恰好等于阈值时无标题,超过才有标题', () => {
    const exactly = 'a'.repeat(REASONING_SECTION_MIN_BODY)
    expect(splitReasoningSections(exactly)[0]?.title).toBe('')
    const over = `${exactly}x`
    expect(splitReasoningSections(over)[0]?.title.length).toBeGreaterThan(0)
  })
})
