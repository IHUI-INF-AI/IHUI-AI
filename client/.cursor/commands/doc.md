# 生成文档

为选中的代码生成专业的文档注释。

## 指令

请为以下代码生成完整的文档：

{{selection}}

### 文档类型

根据代码类型自动生成对应格式的文档：

#### TypeScript/JavaScript
使用 JSDoc/TSDoc 格式：
```typescript
/**
 * 函数描述
 * @param paramName - 参数描述
 * @returns 返回值描述
 * @example
 * // 使用示例
 * functionName(arg)
 */
```

#### Vue 组件
包含以下部分：
- 组件功能描述
- Props 说明
- Events 说明
- Slots 说明
- 使用示例

#### API 接口
生成接口文档：
- 请求方法和路径
- 请求参数
- 响应格式
- 错误码说明

### 输出要求

- 文档使用中文
- 包含使用示例
- 说明注意事项和边界条件
