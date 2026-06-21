# 简化代码

简化复杂的代码，提高可读性。

## 指令

请简化以下代码：

{{selection}}

### 简化策略

1. **减少嵌套**
```typescript
// 之前
if (condition1) {
  if (condition2) {
    if (condition3) {
      doSomething()
    }
  }
}

// 之后
if (!condition1) return
if (!condition2) return
if (!condition3) return
doSomething()
```

2. **使用现代语法**
```typescript
// 之前
const name = user && user.profile && user.profile.name

// 之后
const name = user?.profile?.name
```

3. **简化条件**
```typescript
// 之前
if (value === 'a' || value === 'b' || value === 'c') {}

// 之后
if (['a', 'b', 'c'].includes(value)) {}
```

4. **使用数组方法**
```typescript
// 之前
const result = []
for (let i = 0; i < arr.length; i++) {
  if (arr[i].active) {
    result.push(arr[i].name)
  }
}

// 之后
const result = arr.filter(x => x.active).map(x => x.name)
```

5. **解构和默认值**
```typescript
// 之前
function fn(options) {
  const a = options.a || 'default'
  const b = options.b || 0
}

// 之后
function fn({ a = 'default', b = 0 } = {}) {}
```

### 输出

1. 简化后的代码
2. 简化说明
3. 保持功能不变的验证
