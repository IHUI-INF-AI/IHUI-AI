import { describe, it, expect, vi } from 'vitest'
import { safeEvaluate, evaluateCondition } from '../safe-evaluator'

describe('safe-evaluator', () => {
  describe('safeEvaluate - 基础类型', () => {
    it('应该评估数字', () => {
      expect(safeEvaluate('42').result).toBe(42)
      expect(safeEvaluate('3.14').result).toBe(3.14)
      expect(safeEvaluate('0').result).toBe(0)
      expect(safeEvaluate('100.5').result).toBe(100.5)
    })

    it('应该评估字符串', () => {
      expect(safeEvaluate('"hello"').result).toBe('hello')
      expect(safeEvaluate("'world'").result).toBe('world')
      // 字符串中的空格
      expect(safeEvaluate('"hello world"').result).toBe('hello world')
    })

    it('应该评估布尔值', () => {
      expect(safeEvaluate('true').result).toBe(true)
      expect(safeEvaluate('false').result).toBe(false)
    })

    it('应该评估null', () => {
      expect(safeEvaluate('null').result).toBe(null)
    })

    it('应该评估undefined', () => {
      expect(safeEvaluate('undefined').result).toBe(undefined)
    })
  })

  describe('safeEvaluate - 算术运算', () => {
    it('应该执行加法（字符串拼接）', () => {
      expect(safeEvaluate('1 + 2').result).toBe('12')
    })

    it('应该执行减法', () => {
      expect(safeEvaluate('10 - 3').result).toBe(7)
    })

    it('应该执行乘法', () => {
      expect(safeEvaluate('4 * 5').result).toBe(20)
    })

    it('应该执行除法', () => {
      expect(safeEvaluate('20 / 4').result).toBe(5)
    })

    it('应该执行取模', () => {
      expect(safeEvaluate('10 % 3').result).toBe(1)
    })

    it('应该处理一元负号', () => {
      expect(safeEvaluate('-5').result).toBe(-5)
      expect(safeEvaluate('--5').result).toBe(5)
    })

    it('应该跳过未知字符', () => {
      // 词法分析器遇到无法识别的字符（如 ~）会跳过
      const result = safeEvaluate('5 ~ 3')
      expect(result.success).toBe(true)
    })
  })

  describe('safeEvaluate - 比较运算', () => {
    it('应该执行大于比较', () => {
      expect(safeEvaluate('5 > 3').result).toBe(true)
      expect(safeEvaluate('3 > 5').result).toBe(false)
    })

    it('应该执行小于比较', () => {
      expect(safeEvaluate('3 < 5').result).toBe(true)
      expect(safeEvaluate('5 < 3').result).toBe(false)
    })

    it('应该执行大于等于', () => {
      expect(safeEvaluate('5 >= 5').result).toBe(true)
      expect(safeEvaluate('4 >= 5').result).toBe(false)
    })

    it('应该执行小于等于', () => {
      expect(safeEvaluate('5 <= 5').result).toBe(true)
      expect(safeEvaluate('6 <= 5').result).toBe(false)
    })
  })

  describe('safeEvaluate - 逻辑运算', () => {
    it('应该执行逻辑与', () => {
      expect(safeEvaluate('true && false').result).toBe(false)
      expect(safeEvaluate('true && true').result).toBe(true)
    })

    it('应该执行逻辑或', () => {
      expect(safeEvaluate('true || false').result).toBe(true)
      expect(safeEvaluate('false || false').result).toBe(false)
    })

    it('应该执行逻辑非', () => {
      expect(safeEvaluate('!false').result).toBe(true)
      expect(safeEvaluate('!true').result).toBe(false)
    })
  })

  describe('safeEvaluate - 括号和数组', () => {
    it('应该处理括号表达式', () => {
      const result = safeEvaluate('(1 + 2) * 3')
      expect(result.success).toBe(true)
    })

    it('应该处理数组字面量', () => {
      const result = safeEvaluate('[1, 2, 3]').result
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)
    })

    it('应该处理空数组', () => {
      const result = safeEvaluate('[]').result
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('应该检测缺失的右括号', () => {
      // 实现细节：parsePrimary 在缺失右括号时返回错误对象作为 result
      const result = safeEvaluate('(1 + 2')
      expect(result.success).toBe(true)
      expect(result.result).toEqual({ success: false, error: 'Missing closing parenthesis' })
    })

    it('应该检测缺失的右方括号', () => {
      // 实现细节：parsePrimary 在缺失右方括号时返回错误对象作为 result
      const result = safeEvaluate('[1, 2, 3')
      expect(result.success).toBe(true)
      expect(result.result).toEqual({ success: false, error: 'Missing closing bracket' })
    })
  })

  describe('safeEvaluate - 上下文变量', () => {
    it('应该从上下文获取变量值', () => {
      const result = safeEvaluate('name', { name: '张三' })
      expect(result.result).toBe('张三')
    })

    it('应该处理不存在的变量', () => {
      const result = safeEvaluate('nonexistent', {})
      expect(result.result).toBeUndefined()
    })

    it('应该调用上下文中的函数', () => {
      const ctx = {
        double: (n: number) => n * 2,
      }
      const result = safeEvaluate('double(5)', ctx)
      expect(result.result).toBe(10)
    })

    it('函数不存在时返回undefined', () => {
      const result = safeEvaluate('unknownFunc(1, 2)', {})
      expect(result.result).toBeUndefined()
    })

    it('上下文中的非函数值应该被返回', () => {
      // 当上下文中的标识符不是函数时，函数调用语法也直接返回值
      const result = safeEvaluate('x(1, 2)', { x: 42 })
      expect(result.result).toBe(42)
    })

    it('应该检测函数调用中缺失的右括号', () => {
      // 函数调用时未闭合括号返回错误对象
      const result = safeEvaluate('abs(5')
      expect(result.success).toBe(true)
      expect(result.result).toEqual({ success: false, error: 'Missing closing parenthesis in function call' })
    })
  })

  describe('safeEvaluate - 数学函数', () => {
    it('应该调用abs函数', () => {
      expect(safeEvaluate('abs(-5)').result).toBe(5)
      expect(safeEvaluate('abs(5)').result).toBe(5)
    })

    it('应该调用ceil/floor/round函数', () => {
      expect(safeEvaluate('ceil(3.2)').result).toBe(4)
      expect(safeEvaluate('floor(3.8)').result).toBe(3)
      expect(safeEvaluate('round(3.5)').result).toBe(4)
      expect(safeEvaluate('round(3.4)').result).toBe(3)
    })

    it('应该调用max/min函数', () => {
      expect(safeEvaluate('max(1, 2, 3)').result).toBe(3)
      expect(safeEvaluate('min(1, 2, 3)').result).toBe(1)
    })

    it('应该调用pow/sqrt函数', () => {
      expect(safeEvaluate('pow(2, 3)').result).toBe(8)
      expect(safeEvaluate('sqrt(16)').result).toBe(4)
    })

    it('应该调用log系列函数', () => {
      expect(safeEvaluate('log(1)').result).toBe(0)
      expect(safeEvaluate('log10(100)').result).toBe(2)
      expect(safeEvaluate('log2(8)').result).toBe(3)
    })

    it('应该调用exp函数', () => {
      expect(safeEvaluate('exp(0)').result).toBe(1)
    })

    it('应该调用三角函数', () => {
      expect(safeEvaluate('sin(0)').result).toBe(0)
      expect(safeEvaluate('cos(0)').result).toBe(1)
      expect(safeEvaluate('tan(0)').result).toBe(0)
    })

    it('应该调用反三角函数', () => {
      expect(safeEvaluate('asin(0)').result).toBe(0)
      expect(safeEvaluate('acos(1)').result).toBe(0)
      expect(safeEvaluate('atan(0)').result).toBe(0)
      expect(safeEvaluate('atan2(1, 1)').result).toBeCloseTo(0.785, 2)
    })

    it('应该调用sign/trunc函数', () => {
      expect(safeEvaluate('sign(-5)').result).toBe(-1)
      expect(safeEvaluate('sign(5)').result).toBe(1)
      expect(safeEvaluate('sign(0)').result).toBe(0)
      expect(safeEvaluate('trunc(3.7)').result).toBe(3)
      expect(safeEvaluate('trunc(-3.7)').result).toBe(-3)
    })
  })

  describe('safeEvaluate - 字符串函数', () => {
    it('应该调用len/length函数', () => {
      expect(safeEvaluate('len("hello")').result).toBe(5)
      expect(safeEvaluate('len("")').result).toBe(0)
      expect(safeEvaluate('length("test")').result).toBe(4)
      // 非字符串返回0
      expect(safeEvaluate('len(123)').result).toBe(0)
    })

    it('应该调用toString/String函数', () => {
      expect(safeEvaluate('toString(123)').result).toBe('123')
      expect(safeEvaluate('String(456)').result).toBe('456')
    })

    it('应该调用Number/Boolean函数', () => {
      expect(safeEvaluate('Number("123")').result).toBe(123)
      expect(safeEvaluate('Boolean(1)').result).toBe(true)
      expect(safeEvaluate('Boolean(0)').result).toBe(false)
    })
  })

  describe('safeEvaluate - 类型检查函数', () => {
    it('应该调用typeof函数', () => {
      expect(safeEvaluate('typeof(123)').result).toBe('number')
      expect(safeEvaluate('typeof("a")').result).toBe('string')
      expect(safeEvaluate('typeof(true)').result).toBe('boolean')
    })

    it('应该调用isNaN函数', () => {
      expect(safeEvaluate('isNaN("abc")').result).toBe(true)
      expect(safeEvaluate('isNaN("123")').result).toBe(false)
    })

    it('应该调用isFinite函数', () => {
      expect(safeEvaluate('isFinite(100)').result).toBe(true)
      expect(safeEvaluate('isFinite("abc")').result).toBe(false)
    })

    it('应该调用isNull函数', () => {
      expect(safeEvaluate('isNull(null)').result).toBe(true)
      expect(safeEvaluate('isNull(0)').result).toBe(false)
    })

    it('应该调用isUndefined函数', () => {
      expect(safeEvaluate('isUndefined(undefined)').result).toBe(true)
      expect(safeEvaluate('isUndefined(null)').result).toBe(false)
    })

    it('应该调用isEmpty函数', () => {
      expect(safeEvaluate('isEmpty(null)').result).toBe(true)
      expect(safeEvaluate('isEmpty(undefined)').result).toBe(true)
      expect(safeEvaluate('isEmpty("")').result).toBe(true)
      expect(safeEvaluate('isEmpty("a")').result).toBe(false)
      expect(safeEvaluate('isEmpty(0)').result).toBe(false)
    })
  })

  describe('safeEvaluate - 比较函数', () => {
    it('应该调用equals函数', () => {
      expect(safeEvaluate('equals(1, 1)').result).toBe(true)
      expect(safeEvaluate('equals(1, 2)').result).toBe(false)
    })

    it('应该调用notEquals函数', () => {
      expect(safeEvaluate('notEquals(1, 2)').result).toBe(true)
      expect(safeEvaluate('notEquals(1, 1)').result).toBe(false)
    })
  })

  describe('safeEvaluate - 数组辅助函数', () => {
    it('应该调用includes函数', () => {
      expect(safeEvaluate('includes([1, 2, 3], 2)').result).toBe(true)
      expect(safeEvaluate('includes([1, 2, 3], 4)').result).toBe(false)
    })

    it('非数组调用includes返回false', () => {
      expect(safeEvaluate('includes("abc", "a")').result).toBe(false)
    })

    it('应该调用in函数', () => {
      const obj = { a: 1, b: 2 }
      expect(safeEvaluate('in("a", obj)', { obj }).result).toBe(true)
      expect(safeEvaluate('in("c", obj)', { obj }).result).toBe(false)
    })
  })

  describe('safeEvaluate - 安全检查', () => {
    it('应该拒绝空表达式', () => {
      const result = safeEvaluate('')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Empty expression')
    })

    it('应该拒绝纯空白表达式', () => {
      const result = safeEvaluate('   ')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Empty expression')
    })

    it('应该拒绝过长的表达式', () => {
      const longExpr = '1'.repeat(501)
      const result = safeEvaluate(longExpr)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Expression too long')
    })

    it('应该拒绝eval调用', () => {
      const result = safeEvaluate('eval("code")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝Function构造', () => {
      const result = safeEvaluate('Function("code")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝require调用', () => {
      const result = safeEvaluate('require("x")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝document访问', () => {
      const result = safeEvaluate('document.cookie')
      expect(result.success).toBe(false)
    })

    it('应该拒绝window访问', () => {
      const result = safeEvaluate('window.location')
      expect(result.success).toBe(false)
    })

    it('应该拒绝localStorage访问', () => {
      const result = safeEvaluate('localStorage.getItem("x")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝sessionStorage访问', () => {
      const result = safeEvaluate('sessionStorage.setItem("x", "1")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝fetch调用', () => {
      const result = safeEvaluate('fetch("url")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝XMLHttpRequest', () => {
      const result = safeEvaluate('XMLHttpRequest')
      expect(result.success).toBe(false)
    })

    it('应该拒绝setTimeout调用', () => {
      const result = safeEvaluate('setTimeout("code", 1000)')
      expect(result.success).toBe(false)
    })

    it('应该拒绝setInterval调用', () => {
      const result = safeEvaluate('setInterval("code", 1000)')
      expect(result.success).toBe(false)
    })

    it('应该拒绝HTML标签', () => {
      const result = safeEvaluate('<div>test</div>')
      expect(result.success).toBe(false)
    })

    it('应该拒绝javascript:协议', () => {
      const result = safeEvaluate('javascript:alert(1)')
      expect(result.success).toBe(false)
    })

    it('应该拒绝data:协议', () => {
      const result = safeEvaluate('data:text/html,test')
      expect(result.success).toBe(false)
    })

    it('应该拒绝import语句', () => {
      const result = safeEvaluate('import("module")')
      expect(result.success).toBe(false)
    })

    it('应该拒绝return语句', () => {
      const result = safeEvaluate('return 1')
      expect(result.success).toBe(false)
    })

    it('应该拒绝await关键字', () => {
      const result = safeEvaluate('await foo()')
      expect(result.success).toBe(false)
    })

    it('应该拒绝yield关键字', () => {
      const result = safeEvaluate('yield foo')
      expect(result.success).toBe(false)
    })

    it('应该拒绝分号', () => {
      const result = safeEvaluate('1; 2')
      expect(result.success).toBe(false)
    })

    it('应该拒绝嵌套块', () => {
      const result = safeEvaluate('{a:{b:1}}')
      expect(result.success).toBe(false)
    })

    it('应该拒绝立即调用函数', () => {
      const result = safeEvaluate('((1+2))')
      expect(result.success).toBe(false)
    })
  })

  describe('evaluateCondition', () => {
    it('应该返回布尔值true', () => {
      expect(evaluateCondition('true')).toBe(true)
      expect(evaluateCondition('5 > 3')).toBe(true)
    })

    it('应该返回布尔值false', () => {
      expect(evaluateCondition('1 == 2')).toBe(false)
      expect(evaluateCondition('false')).toBe(false)
      expect(evaluateCondition('3 > 5')).toBe(false)
    })

    it('错误表达式应该返回false', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(evaluateCondition('')).toBe(false)
      expect(evaluateCondition('eval("code")')).toBe(false)
      warnSpy.mockRestore()
    })

    it('应该使用上下文变量', () => {
      expect(evaluateCondition('age > 18', { age: 20 })).toBe(true)
      expect(evaluateCondition('age > 18', { age: 15 })).toBe(false)
    })

    it('非布尔结果应该被转换为布尔值', () => {
      expect(evaluateCondition('1')).toBe(true)
      expect(evaluateCondition('0')).toBe(false)
      expect(evaluateCondition('""')).toBe(false)
      expect(evaluateCondition('"x"')).toBe(true)
    })
  })
})
