# 生成单元测试

为选中的代码生成全面的单元测试。

## 指令

请为以下代码生成完整的单元测试：

{{selection}}

### 测试框架

- 根据项目配置自动选择测试框架（Vitest/Jest/Mocha）
- 使用 @vue/test-utils 测试 Vue 组件
- 使用 Testing Library 测试 React 组件

### 测试覆盖

1. **正常场景** - 测试预期的正常输入和输出
2. **边界条件** - 测试边界值和极端情况
3. **错误处理** - 测试错误场景和异常
4. **异步逻辑** - 测试 Promise/async/await
5. **组件交互** - 测试用户交互和事件

### 输出格式

```typescript
import { describe, it, expect } from 'vitest'

describe('功能描述', () => {
  it('应该...', () => {
    // 测试代码
  })
})
```

### 要求

- 测试用例名称使用中文描述
- 每个测试用例保持独立
- 使用 Mock 隔离外部依赖
