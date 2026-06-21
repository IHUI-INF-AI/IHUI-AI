import { describe, it, expect, vi } from 'vitest'
import { FormValidator, ElementFormRules, useFormValidation, validateUsername, validatePassword, validatePhone, validateEmail, validateAmount, sanitizeInput } from '../formValidation'

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

describe('formValidation', () => {
  describe('FormValidator.containsXSS', () => {
    it('应该检测script标签', () => {
      expect(FormValidator.containsXSS('<script>alert("xss")</script>')).toBe(true)
    })

    it('应该检测iframe标签', () => {
      expect(FormValidator.containsXSS('<iframe src="evil.com"></iframe>')).toBe(true)
    })

    it('应该检测javascript协议', () => {
      expect(FormValidator.containsXSS('javascript:alert(1)')).toBe(true)
    })

    it('应该检测事件处理器', () => {
      expect(FormValidator.containsXSS('<img onerror="alert(1)">')).toBe(true)
    })

    it('应该检测img标签', () => {
      expect(FormValidator.containsXSS('<img src="x" onerror="alert(1)">')).toBe(true)
    })

    it('应该检测object标签', () => {
      expect(FormValidator.containsXSS('<object data="evil.swf"></object>')).toBe(true)
    })

    it('应该检测embed标签', () => {
      expect(FormValidator.containsXSS('<embed src="evil.swf"></embed>')).toBe(true)
    })

    it('应该检测link标签', () => {
      expect(FormValidator.containsXSS('<link rel="stylesheet" href="evil.css">')).toBe(true)
    })

    it('应该检测meta标签', () => {
      expect(FormValidator.containsXSS('<meta http-equiv="refresh" content="0;url=evil.com">')).toBe(true)
    })

    it('应该检测expression', () => {
      expect(FormValidator.containsXSS('style="width: expression(alert(1))"')).toBe(true)
    })

    it('应该检测vbscript', () => {
      expect(FormValidator.containsXSS('vbscript:msgbox(1)')).toBe(true)
    })

    it('应该检测data:text/html', () => {
      expect(FormValidator.containsXSS('data:text/html,<script>alert(1)</script>')).toBe(true)
    })

    it('应该返回false当没有XSS', () => {
      expect(FormValidator.containsXSS('Hello World')).toBe(false)
    })

    it('应该返回false当输入为空', () => {
      expect(FormValidator.containsXSS('')).toBe(false)
      expect(FormValidator.containsXSS(null as unknown as string)).toBe(false)
    })
  })

  describe('FormValidator.containsSQLInjection', () => {
    it('应该检测SELECT语句', () => {
      expect(FormValidator.containsSQLInjection('SELECT * FROM users')).toBe(true)
    })

    it('应该检测INSERT语句', () => {
      expect(FormValidator.containsSQLInjection("INSERT INTO users VALUES (1, 'admin')")).toBe(true)
    })

    it('应该检测UPDATE语句', () => {
      expect(FormValidator.containsSQLInjection("UPDATE users SET password='x'")).toBe(true)
    })

    it('应该检测DELETE语句', () => {
      expect(FormValidator.containsSQLInjection('DELETE FROM users')).toBe(true)
    })

    it('应该检测DROP语句', () => {
      expect(FormValidator.containsSQLInjection('DROP TABLE users')).toBe(true)
    })

    it('应该检测CREATE语句', () => {
      expect(FormValidator.containsSQLInjection('CREATE TABLE evil')).toBe(true)
    })

    it('应该检测ALTER语句', () => {
      expect(FormValidator.containsSQLInjection('ALTER TABLE users ADD col')).toBe(true)
    })

    it('应该检测EXEC语句', () => {
      expect(FormValidator.containsSQLInjection('EXEC sp_help')).toBe(true)
    })

    it('应该检测UNION语句', () => {
      expect(FormValidator.containsSQLInjection('UNION SELECT * FROM users')).toBe(true)
    })

    it('应该检测SCRIPT语句', () => {
      expect(FormValidator.containsSQLInjection('SCRIPT test')).toBe(true)
    })

    it('应该检测注释', () => {
      expect(FormValidator.containsSQLInjection("admin'--")).toBe(true)
    })

    it('应该检测#注释', () => {
      expect(FormValidator.containsSQLInjection('admin#')).toBe(true)
    })

    it('应该检测/*注释', () => {
      expect(FormValidator.containsSQLInjection('/* comment */')).toBe(true)
    })

    it('应该检测OR条件', () => {
      expect(FormValidator.containsSQLInjection("' OR '1'='1")).toBe(true)
    })

    it('应该检测AND条件', () => {
      expect(FormValidator.containsSQLInjection("' AND '1'='1")).toBe(true)
    })

    it('应该检测CHAR函数', () => {
      expect(FormValidator.containsSQLInjection('CHAR(65)')).toBe(true)
    })

    it('应该返回false当没有SQL注入', () => {
      expect(FormValidator.containsSQLInjection('Hello World')).toBe(false)
    })

    it('应该返回false当输入为空', () => {
      expect(FormValidator.containsSQLInjection('')).toBe(false)
    })
  })

  describe('FormValidator.stripHtml', () => {
    it('应该移除HTML标签', () => {
      expect(FormValidator.stripHtml('<p>Hello</p>')).toBe('Hello')
    })

    it('应该移除多个标签', () => {
      expect(FormValidator.stripHtml('<div><span>test</span></div>')).toBe('test')
    })

    it('应该返回空字符串当输入为空', () => {
      expect(FormValidator.stripHtml('')).toBe('')
      expect(FormValidator.stripHtml(null as unknown as string)).toBe('')
    })
  })

  describe('FormValidator.escapeHtml', () => {
    it('应该转义&符号', () => {
      expect(FormValidator.escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('应该转义<和>', () => {
      expect(FormValidator.escapeHtml('<script>')).toBe('&lt;script&gt;')
    })

    it('应该转义引号', () => {
      expect(FormValidator.escapeHtml('"test"')).toBe('&quot;test&quot;')
    })

    it('应该转义单引号', () => {
      expect(FormValidator.escapeHtml("'test'")).toBe('&#x27;test&#x27;')
    })

    it('应该转义斜杠', () => {
      expect(FormValidator.escapeHtml('a/b')).toBe('a&#x2F;b')
    })

    it('应该返回空字符串当输入为空', () => {
      expect(FormValidator.escapeHtml('')).toBe('')
      expect(FormValidator.escapeHtml(null as unknown as string)).toBe('')
    })
  })

  describe('FormValidator.validateLength', () => {
    it('应该返回true当长度在范围内', () => {
      expect(FormValidator.validateLength('hello', 1, 10)).toBe(true)
    })

    it('应该返回false当长度小于最小值', () => {
      expect(FormValidator.validateLength('hi', 5, 10)).toBe(false)
    })

    it('应该返回false当长度大于最大值', () => {
      expect(FormValidator.validateLength('hello world', 1, 5)).toBe(false)
    })

    it('应该返回true当min为0且输入为空', () => {
      expect(FormValidator.validateLength('', 0, 10)).toBe(true)
    })

    it('应该返回false当min大于0且输入为空', () => {
      expect(FormValidator.validateLength('', 1, 10)).toBe(false)
    })
  })

  describe('FormValidator.validateCharacters', () => {
    it('应该返回true当匹配模式', () => {
      expect(FormValidator.validateCharacters('abc123', /^[a-z0-9]+$/)).toBe(true)
    })

    it('应该返回false当不匹配模式', () => {
      expect(FormValidator.validateCharacters('abc@123', /^[a-z0-9]+$/)).toBe(false)
    })

    it('应该返回true当输入为空', () => {
      expect(FormValidator.validateCharacters('', /^[a-z]+$/)).toBe(true)
    })
  })

  describe('FormValidator.isValidUsername', () => {
    it('应该返回true当用户名有效', () => {
      expect(FormValidator.isValidUsername('user123')).toBe(true)
      expect(FormValidator.isValidUsername('test_user')).toBe(true)
      expect(FormValidator.isValidUsername('用户名')).toBe(true)
    })

    it('应该返回false当用户名太短', () => {
      expect(FormValidator.isValidUsername('ab')).toBe(false)
    })

    it('应该返回false当用户名太长', () => {
      expect(FormValidator.isValidUsername('a'.repeat(21))).toBe(false)
    })

    it('应该返回false当用户名包含特殊字符', () => {
      expect(FormValidator.isValidUsername('user@name')).toBe(false)
    })

    it('应该返回false当输入为空', () => {
      expect(FormValidator.isValidUsername('')).toBe(false)
    })

    it('应该返回false当用户名包含XSS', () => {
      expect(FormValidator.isValidUsername('<script>')).toBe(false)
    })
  })

  describe('FormValidator.validateUsername', () => {
    it('应该返回valid=true当用户名有效', () => {
      const result = FormValidator.validateUsername('user123')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('应该返回错误当用户名为空', () => {
      const result = FormValidator.validateUsername('')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该返回错误当用户名只有空格', () => {
      const result = FormValidator.validateUsername('   ')
      expect(result.valid).toBe(false)
    })
  })

  describe('FormValidator.validatePassword', () => {
    it('应该调用validatePasswordStrength', () => {
      const result = FormValidator.validatePassword('Abc123!@#$')
      expect(result.valid).toBe(true)
    })
  })

  describe('FormValidator.validatePasswordStrength', () => {
    it('应该返回strong当密码复杂', () => {
      const result = FormValidator.validatePasswordStrength('Abc123!@#$')
      expect(result.valid).toBe(true)
      expect(result.strength).toBe('strong')
    })

    it('应该返回错误当密码太短', () => {
      const result = FormValidator.validatePasswordStrength('Abc1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('密码长度不能少于8个字符')
    })

    it('应该返回错误当密码太长', () => {
      const result = FormValidator.validatePasswordStrength('A'.repeat(129) + '1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('密码长度不能超过128个字符')
    })

    it('应该返回错误当密码太简单', () => {
      const result = FormValidator.validatePasswordStrength('password')
      expect(result.valid).toBe(false)
    })

    it('应该返回警告当有重复字符', () => {
      const result = FormValidator.validatePasswordStrength('AAAbbb123!')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('应该返回错误当缺少字符类型', () => {
      const result = FormValidator.validatePasswordStrength('abcdefgh')
      expect(result.valid).toBe(false)
    })

    it('应该返回medium当复杂度为2', () => {
      const result = FormValidator.validatePasswordStrength('Abcdefgh')
      expect(result.strength).toBe('medium')
    })

    it('应该返回weak当复杂度为1', () => {
      const result = FormValidator.validatePasswordStrength('abcdefgh')
      expect(result.strength).toBe('weak')
    })

    it('应该检测弱密码123456', () => {
      const result = FormValidator.validatePasswordStrength('123456')
      expect(result.valid).toBe(false)
    })

    it('应该检测弱密码qwerty', () => {
      const result = FormValidator.validatePasswordStrength('qwerty')
      expect(result.valid).toBe(false)
    })

    it('应该检测弱密码admin', () => {
      const result = FormValidator.validatePasswordStrength('admin')
      expect(result.valid).toBe(false)
    })

    it('应该检测键盘序列', () => {
      const result = FormValidator.validatePasswordStrength('qwertyABC123!')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('应该检测数字序列', () => {
      const result = FormValidator.validatePasswordStrength('123456Abc!')
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('FormValidator.validatePhone', () => {
    it('应该返回valid=true当手机号有效', () => {
      const result = FormValidator.validatePhone('13812345678')
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当手机号为空', () => {
      const result = FormValidator.validatePhone('')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该返回错误当手机号格式错误', () => {
      const result = FormValidator.validatePhone('12345678901')
      expect(result.valid).toBe(false)
    })

    it('应该返回警告当是虚拟号段', () => {
      const result = FormValidator.validatePhone('17012345678')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('应该处理带空格的手机号', () => {
      const result = FormValidator.validatePhone('138 1234 5678')
      expect(result.valid).toBe(true)
    })

    it('应该处理带横线的手机号', () => {
      const result = FormValidator.validatePhone('138-1234-5678')
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当手机号只有空格', () => {
      const result = FormValidator.validatePhone('   ')
      expect(result.valid).toBe(false)
    })
  })

  describe('FormValidator.validateEmail', () => {
    it('应该返回valid=true当邮箱有效', () => {
      const result = FormValidator.validateEmail('test@example.com')
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当邮箱为空', () => {
      const result = FormValidator.validateEmail('')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('应该返回错误当邮箱格式错误', () => {
      const result = FormValidator.validateEmail('invalid-email')
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当邮箱太长', () => {
      const longEmail = 'a'.repeat(255) + '@test.com'
      const result = FormValidator.validateEmail(longEmail)
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当本地部分太长', () => {
      const longLocal = 'a'.repeat(65) + '@test.com'
      const result = FormValidator.validateEmail(longLocal)
      expect(result.valid).toBe(false)
    })

    it('应该返回警告当是临时邮箱', () => {
      const result = FormValidator.validateEmail('test@10minutemail.com')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('应该返回错误当邮箱只有空格', () => {
      const result = FormValidator.validateEmail('   ')
      expect(result.valid).toBe(false)
    })
  })

  describe('FormValidator.validateVerificationCode', () => {
    it('应该返回valid=true当验证码有效', () => {
      const result = FormValidator.validateVerificationCode('123456')
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当验证码为空', () => {
      const result = FormValidator.validateVerificationCode('')
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当验证码长度不对', () => {
      const result = FormValidator.validateVerificationCode('12345')
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当验证码包含非数字', () => {
      const result = FormValidator.validateVerificationCode('abc123')
      expect(result.valid).toBe(false)
    })

    it('应该支持自定义长度', () => {
      const result = FormValidator.validateVerificationCode('1234', 4)
      expect(result.valid).toBe(true)
    })
  })

  describe('FormValidator.validateAmount', () => {
    it('应该返回valid=true当金额有效', () => {
      const result = FormValidator.validateAmount('100')
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当金额为空', () => {
      const result = FormValidator.validateAmount('')
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当金额无效', () => {
      const result = FormValidator.validateAmount('abc')
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当金额小于最小值', () => {
      const result = FormValidator.validateAmount('50', 100)
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当金额大于最大值', () => {
      const result = FormValidator.validateAmount('200', 0, 100)
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当小数位超过2位', () => {
      const result = FormValidator.validateAmount('100.123')
      expect(result.valid).toBe(false)
    })

    it('应该返回警告当金额较大', () => {
      const result = FormValidator.validateAmount('15000')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('应该支持数字类型', () => {
      const result = FormValidator.validateAmount(100)
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当金额为null', () => {
      const result = FormValidator.validateAmount(null as unknown as string)
      expect(result.valid).toBe(false)
    })
  })

  describe('FormValidator.validateText', () => {
    it('应该返回valid=true当文本有效', () => {
      const result = FormValidator.validateText('hello', { required: true })
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当必填但为空', () => {
      const result = FormValidator.validateText('', { required: true })
      expect(result.valid).toBe(false)
    })

    it('应该返回valid=true当允许空值', () => {
      const result = FormValidator.validateText('', { allowEmpty: true })
      expect(result.valid).toBe(true)
    })

    it('应该返回错误当长度不足', () => {
      const result = FormValidator.validateText('hi', { minLength: 5 })
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当长度超限', () => {
      const result = FormValidator.validateText('hello world', { maxLength: 5 })
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当格式不匹配', () => {
      const result = FormValidator.validateText('abc', { pattern: /^\d+$/ })
      expect(result.valid).toBe(false)
    })

    it('应该返回错误当包含XSS', () => {
      const result = FormValidator.validateText('<script>alert(1)</script>', {})
      expect(result.valid).toBe(false)
    })

    it('应该调用自定义验证器', () => {
      const customValidator = vi.fn().mockReturnValue({ valid: true, errors: [], warnings: [] })
      FormValidator.validateText('test', { customValidator })
      expect(customValidator).toHaveBeenCalled()
    })

    it('应该合并自定义验证器的错误', () => {
      const customValidator = vi.fn().mockReturnValue({ valid: false, errors: ['自定义错误'], warnings: [] })
      const result = FormValidator.validateText('test', { customValidator })
      expect(result.errors).toContain('自定义错误')
    })
  })

  describe('FormValidator.sanitizeInput', () => {
    it('应该移除尖括号', () => {
      expect(FormValidator.sanitizeInput('<script>')).toBe('script')
    })

    it('应该移除javascript协议', () => {
      expect(FormValidator.sanitizeInput('javascript:alert(1)')).toBe('alert(1)')
    })

    it('应该移除事件处理器', () => {
      expect(FormValidator.sanitizeInput('onclick=alert(1)')).toBe('alert(1)')
    })

    it('应该移除控制字符', () => {
      expect(FormValidator.sanitizeInput('hello\x00world')).toBe('helloworld')
    })

    it('应该返回空字符串当输入为空', () => {
      expect(FormValidator.sanitizeInput('')).toBe('')
      expect(FormValidator.sanitizeInput(null as unknown as string)).toBe('')
    })

    it('应该去除首尾空格', () => {
      expect(FormValidator.sanitizeInput('  hello  ')).toBe('hello')
    })
  })

  describe('ElementFormRules', () => {
    describe('username', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.username()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效用户名', () => {
        const rules = ElementFormRules.username()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'validuser', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效用户名', () => {
        const rules = ElementFormRules.username()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'ab', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('password', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.password()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效密码', () => {
        const rules = ElementFormRules.password()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'Abc123!@#', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效密码', () => {
        const rules = ElementFormRules.password()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'weak', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('phone', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.phone()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效手机号', () => {
        const rules = ElementFormRules.phone()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, '13812345678', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效手机号', () => {
        const rules = ElementFormRules.phone()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, '12345', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('email', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.email()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效邮箱', () => {
        const rules = ElementFormRules.email()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'test@example.com', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效邮箱', () => {
        const rules = ElementFormRules.email()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'invalid', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('verificationCode', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.verificationCode()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效验证码', () => {
        const rules = ElementFormRules.verificationCode()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, '123456', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效验证码', () => {
        const rules = ElementFormRules.verificationCode()
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'abc', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('amount', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.amount()
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效金额', () => {
        const rules = ElementFormRules.amount(0, 1000)
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, '100', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效金额', () => {
        const rules = ElementFormRules.amount(100, 1000)
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, '50', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('confirmPassword', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.confirmPassword(() => 'password123')
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证匹配的密码', () => {
        const rules = ElementFormRules.confirmPassword(() => 'password123')
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'password123', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝不匹配的密码', () => {
        const rules = ElementFormRules.confirmPassword(() => 'password123')
        const validator = rules[1].validator!
        let error: Error | undefined
        validator({}, 'different', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })

    describe('customText', () => {
      it('应该返回验证规则', () => {
        const rules = ElementFormRules.customText({ required: true })
        expect(rules.length).toBeGreaterThan(0)
      })

      it('应该验证有效文本', () => {
        const rules = ElementFormRules.customText({ minLength: 3 })
        const validator = rules[0].validator!
        let error: Error | undefined
        validator({}, 'hello', (e) => { error = e })
        expect(error).toBeUndefined()
      })

      it('应该拒绝无效文本', () => {
        const rules = ElementFormRules.customText({ minLength: 5 })
        const validator = rules[0].validator!
        let error: Error | undefined
        validator({}, 'hi', (e) => { error = e })
        expect(error).toBeDefined()
      })
    })
  })

  describe('便捷函数导出', () => {
    it('validateUsername应该工作', () => {
      const result = FormValidator.validateUsername('user123')
      expect(result.valid).toBe(true)
    })

    it('validatePassword应该工作', () => {
      const result = FormValidator.validatePassword('Abc123!@#$')
      expect(result.valid).toBe(true)
    })

    it('validatePhone应该工作', () => {
      const result = validatePhone('13812345678')
      expect(result.valid).toBe(true)
    })

    it('validateEmail应该工作', () => {
      const result = validateEmail('test@example.com')
      expect(result.valid).toBe(true)
    })

    it('validateAmount应该工作', () => {
      const result = validateAmount('100')
      expect(result.valid).toBe(true)
    })

    it('sanitizeInput应该工作', () => {
      const result = sanitizeInput('<script>')
      expect(result).toBe('script')
    })
  })

  describe('useFormValidation', () => {
    it('应该返回验证工具', () => {
      const utils = useFormValidation()
      expect(utils.FormValidator).toBe(FormValidator)
      expect(utils.validateUsername).toBe(validateUsername)
      expect(utils.validatePassword).toBe(validatePassword)
      expect(utils.validatePhone).toBe(validatePhone)
      expect(utils.validateEmail).toBe(validateEmail)
      expect(utils.validateAmount).toBe(validateAmount)
      expect(utils.sanitizeInput).toBe(sanitizeInput)
    })
  })
})
