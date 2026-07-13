import { describe, it, expect } from 'vitest'
import { optimize, optimizeBatch } from '../src/services/ai/prompt-optimizer-service.js'

describe('prompt-optimizer-service Prompt 优化器', () => {
  describe('optimize 类型自动识别', () => {
    it('画图相关识别为 image', () => {
      const r = optimize('画一只猫')
      expect(r.type).toBe('image')
    })

    it('代码相关识别为 code', () => {
      const r = optimize('实现一个 function')
      expect(r.type).toBe('code')
    })

    it('总结相关识别为 summary', () => {
      const r = optimize('总结这篇文章')
      expect(r.type).toBe('summary')
    })

    it('翻译相关识别为 translation', () => {
      const r = optimize('翻译成英文')
      expect(r.type).toBe('translation')
    })

    it('写作相关识别为 text', () => {
      const r = optimize('写文章 about AI')
      expect(r.type).toBe('text')
    })

    it('无法识别时为 default', () => {
      const r = optimize('xyz')
      expect(r.type).toBe('default')
    })

    it('显式指定 type 覆盖自动识别', () => {
      const r = optimize('画一只猫', { type: 'code' })
      expect(r.type).toBe('code')
    })
  })

  describe('optimize 模糊词替换', () => {
    it('替换"好一点"', () => {
      const r = optimize('让文章好一点')
      expect(r.optimized).toContain('更具体、更有深度')
      expect(r.improvements.some((i) => i.includes('替换'))).toBe(true)
    })

    it('替换"简单说"', () => {
      const r = optimize('简单说一下')
      expect(r.optimized).toContain('3-5 个要点')
    })

    it('替换"详细点"', () => {
      const r = optimize('详细点写')
      expect(r.optimized).toContain('500 字以上')
    })

    it('替换"专业点"', () => {
      const r = optimize('专业点描述')
      expect(r.optimized).toContain('领域专业术语')
    })

    it('替换英文 interesting', () => {
      const r = optimize('make it interesting')
      expect(r.optimized).toContain('新颖性与启发性')
    })

    it('无模糊词时不替换', () => {
      const r = optimize('写一段关于历史的文字')
      expect(r.improvements.some((i) => i.includes('替换'))).toBe(false)
    })
  })

  describe('optimize 输出结构', () => {
    it('返回 original 与 optimized', () => {
      const r = optimize('测试')
      expect(r.original).toBe('测试')
      expect(r.optimized).toBeTruthy()
      expect(r.optimized.length).toBeGreaterThan(r.original.length)
    })

    it('优化后包含角色设定段落', () => {
      const r = optimize('测试')
      expect(r.optimized).toContain('# 角色设定')
    })

    it('优化后包含任务段落', () => {
      const r = optimize('测试任务')
      expect(r.optimized).toContain('# 任务')
      expect(r.optimized).toContain('测试任务')
    })

    it('优化后包含要求段落', () => {
      const r = optimize('测试')
      expect(r.optimized).toContain('# 要求')
    })

    it('improvements 包含应用模板', () => {
      const r = optimize('测试')
      expect(r.improvements.some((i) => i.includes('类型模板'))).toBe(true)
    })

    it('improvements 包含设定角色', () => {
      const r = optimize('测试')
      expect(r.improvements.some((i) => i.includes('设定角色'))).toBe(true)
    })
  })

  describe('optimize 角色设定', () => {
    it('image 类型角色为视觉设计师', () => {
      const r = optimize('画图', { type: 'image' })
      expect(r.optimized).toContain('视觉设计师')
    })

    it('code 类型角色为软件工程师', () => {
      const r = optimize('code', { type: 'code' })
      expect(r.optimized).toContain('软件工程师')
    })

    it('summary 类型角色为信息提炼专家', () => {
      const r = optimize('x', { type: 'summary' })
      expect(r.optimized).toContain('信息提炼专家')
    })

    it('translation 类型角色为专业译员', () => {
      const r = optimize('x', { type: 'translation' })
      expect(r.optimized).toContain('专业译员')
    })

    it('text 类型角色为专业写作者', () => {
      const r = optimize('x', { type: 'text' })
      expect(r.optimized).toContain('专业写作者')
    })

    it('default 类型角色为专业助手', () => {
      const r = optimize('x', { type: 'default' })
      expect(r.optimized).toContain('专业助手')
    })

    it('显式指定 role 覆盖默认', () => {
      const r = optimize('x', { type: 'default', role: '你是定制角色' })
      expect(r.optimized).toContain('你是定制角色')
    })
  })

  describe('optimize 输出格式约束', () => {
    it('json 格式约束', () => {
      const r = optimize('x', { outputFormat: 'json' })
      expect(r.optimized).toContain('合法 JSON')
      expect(r.improvements.some((i) => i.includes('输出格式'))).toBe(true)
    })

    it('markdown 格式约束', () => {
      const r = optimize('x', { outputFormat: 'markdown' })
      expect(r.optimized).toContain('markdown 格式')
    })

    it('list 格式约束', () => {
      const r = optimize('x', { outputFormat: 'list' })
      expect(r.optimized).toContain('有序/无序列表')
    })

    it('plain 格式无 # 输出格式 段落', () => {
      const r = optimize('x', { outputFormat: 'plain' })
      expect(r.optimized).not.toContain('# 输出格式')
    })

    it('未指定格式时无 # 输出格式 段落', () => {
      const r = optimize('x', {})
      expect(r.optimized).not.toContain('# 输出格式')
    })
  })

  describe('optimize 长度与语言约束', () => {
    it('maxLength 约束', () => {
      const r = optimize('x', { maxLength: 100 })
      expect(r.optimized).toContain('100 字以内')
    })

    it('无 maxLength 时不约束', () => {
      const r = optimize('x')
      expect(r.optimized).not.toContain('字以内')
    })

    it('language=zh 约束', () => {
      const r = optimize('x', { language: 'zh' })
      expect(r.optimized).toContain('中文')
    })

    it('language=en 约束', () => {
      const r = optimize('x', { language: 'en' })
      expect(r.optimized).toContain('英文')
    })

    it('language=ja 约束', () => {
      const r = optimize('x', { language: 'ja' })
      expect(r.optimized).toContain('日文')
    })

    it('language=ko 约束', () => {
      const r = optimize('x', { language: 'ko' })
      expect(r.optimized).toContain('韩文')
    })
  })

  describe('optimizeBatch 批量优化', () => {
    it('批量优化返回对应数量结果', () => {
      const results = optimizeBatch(['画图', '写代码', '翻译'])
      expect(results.length).toBe(3)
      expect(results.map((r) => r.type)).toEqual(['image', 'code', 'translation'])
    })

    it('空数组返回空数组', () => {
      expect(optimizeBatch([])).toEqual([])
    })

    it('批量优化共享 options', () => {
      const results = optimizeBatch(['a', 'b'], { type: 'code', maxLength: 200 })
      expect(results.every((r) => r.type === 'code')).toBe(true)
      expect(results.every((r) => r.optimized.includes('200 字以内'))).toBe(true)
    })
  })
})
