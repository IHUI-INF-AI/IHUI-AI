# 生成正则表达式

根据需求生成正则表达式并提供解释。

## 指令

请根据以下需求生成正则表达式：

{{selection}}

### 输出格式

1. **正则表达式**
```javascript
const regex = /pattern/flags
```

2. **详细解释**
逐部分解释正则表达式的含义

3. **测试用例**
```javascript
// 匹配成功的例子
regex.test('example1') // true
regex.test('example2') // true

// 不匹配的例子
regex.test('invalid1') // false
regex.test('invalid2') // false
```

4. **使用示例**
```javascript
// 验证
const isValid = regex.test(input)

// 提取
const matches = input.match(regex)

// 替换
const result = input.replace(regex, replacement)
```

### 常见正则模式

- 手机号：`/^1[3-9]\d{9}$/`
- 邮箱：`/^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/`
- 身份证：`/^\d{17}[\dXx]$/`
- URL：`/^https?:\/\/[^\s]+$/`
- 中文：`/[\u4e00-\u9fa5]/`

### 要求

- 正则尽量简洁高效
- 提供完整的测试用例
- 说明可能的边界情况
