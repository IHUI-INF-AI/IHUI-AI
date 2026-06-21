import { describe, it, expect } from 'vitest'
import { markIcon, markIcons } from '../markRaw'
import { defineComponent } from 'vue'

// 创建测试用的组件
const TestComponent = defineComponent({
  name: 'TestComponent',
  template: '<div>test</div>',
})

const AnotherComponent = defineComponent({
  name: 'AnotherComponent',
  template: '<span>another</span>',
})

describe('markRaw', () => {
  describe('markIcon', () => {
    it('应该返回markRaw包装后的组件', () => {
      const wrapped = markIcon(TestComponent)
      expect(wrapped).toBeDefined()
      expect(wrapped).toBe(TestComponent)
    })

    it('应该能处理多个不同组件', () => {
      const wrapped1 = markIcon(TestComponent)
      const wrapped2 = markIcon(AnotherComponent)
      expect(wrapped1).toBe(TestComponent)
      expect(wrapped2).toBe(AnotherComponent)
    })
  })

  describe('markIcons', () => {
    it('应该批量包装数组中的icon字段', () => {
      const items = [
        { icon: TestComponent, label: '测试1' },
        { icon: AnotherComponent, label: '测试2' },
      ]
      const result = markIcons(items)
      expect(result).toHaveLength(2)
      expect(result[0].icon).toBe(TestComponent)
      expect(result[1].icon).toBe(AnotherComponent)
      expect(result[0].label).toBe('测试1')
    })

    it('应该处理没有icon字段的项目', () => {
      const items = [
        { label: '无icon' },
        { icon: TestComponent, label: '有icon' },
      ]
      const result = markIcons(items)
      expect(result).toHaveLength(2)
      expect(result[0].icon).toBeUndefined()
      expect(result[1].icon).toBe(TestComponent)
    })

    it('应该处理空数组', () => {
      const result = markIcons([])
      expect(result).toHaveLength(0)
    })

    it('应该保留其他字段', () => {
      const items = [
        { icon: TestComponent, label: '测试', value: 123, nested: { a: 1 } },
      ]
      const result = markIcons(items)
      expect(result[0].label).toBe('测试')
      expect(result[0].value).toBe(123)
      expect(result[0].nested).toEqual({ a: 1 })
    })
  })
})
