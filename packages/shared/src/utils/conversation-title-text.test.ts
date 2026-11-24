// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { clipTitleChars, plainTitleText } from './conversation-title-text'

describe('plainTitleText(会话标题纯文本净化,2026-11-23 立)', () => {
  it('普通标题原样保留', () => {
    expect(plainTitleText('帮我修复登录 bug')).toBe('帮我修复登录 bug')
    expect(plainTitleText('  SQLite 迁移方案  ')).toBe('SQLite 迁移方案')
  })

  it('剥成对与落单的加粗星号(标题栏不渲染 Markdown)', () => {
    expect(plainTitleText('**登录修复**')).toBe('登录修复')
    expect(plainTitleText('**登录修复')).toBe('登录修复')
    expect(plainTitleText('登录修复**')).toBe('登录修复')
    expect(plainTitleText('**登录修复:**')).toBe('登录修复:')
  })

  it('剥行首井号/引用/列表/有序编号(含多层叠加)', () => {
    expect(plainTitleText('# 登录修复')).toBe('登录修复')
    expect(plainTitleText('> 引用标题')).toBe('引用标题')
    expect(plainTitleText('- 列表项')).toBe('列表项')
    expect(plainTitleText('1. 第一步')).toBe('第一步')
    expect(plainTitleText('2、第二步')).toBe('第二步')
    expect(plainTitleText('> - # 叠了三层')).toBe('叠了三层')
  })

  it('剥 think 块/标签与内联 (think) 标记', () => {
    expect(plainTitleText('<think>用户想修登录</think>登录页修复')).toBe('登录页修复')
    expect(plainTitleText('<thinking type="x">先想一想</thinking>')).toBeNull()
    expect(plainTitleText('(think) 登录修复')).toBe('登录修复')
    expect(plainTitleText('[thinking]: 登录修复')).toBe('登录修复')
    expect(plainTitleText('(think)')).toBeNull()
  })

  it('思考套话整串命中判废(宁可保持默认标题,不写假标题)', () => {
    expect(plainTitleText('1. **分析用户的请求: **')).toBeNull()
    expect(plainTitleText('分析用户的请求')).toBeNull()
    expect(plainTitleText('1. **分析用户需求：**')).toBeNull()
    expect(plainTitleText('理解用户的意图')).toBeNull()
    expect(plainTitleText('用户请求分析')).toBeNull()
    expect(plainTitleText('Let me analyze the request')).toBeNull()
  })

  it('剥 HTML 标签与零宽字符', () => {
    expect(plainTitleText('<br>登录修复')).toBe('登录修复')
    expect(plainTitleText('登录\u200b修复')).toBe('登录修复')
    expect(plainTitleText('\ufeff登录修复')).toBe('登录修复')
  })

  it('Markdown 链接/图片只留可读文字', () => {
    expect(plainTitleText('[登录修复](https://x.test/a)')).toBe('登录修复')
    expect(plainTitleText('![架构图](https://x.test/a_b.png)')).toBe('架构图')
  })

  it('行内代码剥反引号,内容保留', () => {
    expect(plainTitleText('`pnpm dev` 启动')).toBe('pnpm dev 启动')
  })

  it('正文里的合法符号不能被剥掉', () => {
    expect(plainTitleText('C# 教程')).toBe('C# 教程')
    expect(plainTitleText('2*3 等于几')).toBe('2*3 等于几')
    // 单个尾部下划线是内容(工具名/代码标识符),不是 Markdown 标记
    expect(plainTitleText('先用 task_')).toBe('先用 task_')
  })

  it('多行只取第一个非空行', () => {
    expect(plainTitleText('\n\n登录修复\n这是解释')).toBe('登录修复')
    expect(plainTitleText('登录修复\n第二行')).toBe('登录修复')
  })

  it('纯噪音返回 null(调用方保持默认标题)', () => {
    expect(plainTitleText('')).toBeNull()
    expect(plainTitleText('   \n  ')).toBeNull()
    expect(plainTitleText('**')).toBeNull()
  })

  it('截断到指定上限,<=0 表示不截断', () => {
    const long = '这是一个非常长的标题超过上限需要被截断'
    expect(plainTitleText(long, 6)).toBe('这是一个非常')
    expect(plainTitleText(long)?.length).toBe(long.length)
  })
})

describe('clipTitleChars(按码位截断,2026-11-23 立)', () => {
  it('不在代理对中间切断 emoji', () => {
    // 标题栏出现半个 emoji 会渲染成「口」方块,所以截断必须按码位而不是 UTF-16 码元
    expect(clipTitleChars('🚀🚀🚀🚀🚀', 3)).toBe('🚀🚀🚀')
    expect(plainTitleText('🚀'.repeat(30), 20)).toBe('🚀'.repeat(20))
  })

  it('不超长时原样返回,空串与上限<=0 不处理', () => {
    expect(clipTitleChars('短标题', 10)).toBe('短标题')
    expect(clipTitleChars('', 10)).toBe('')
    expect(clipTitleChars('不截断', 0)).toBe('不截断')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
