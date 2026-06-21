# 生成 TypeScript 类型

根据数据结构生成 TypeScript 类型定义。

## 指令

请根据以下数据生成 TypeScript 类型：

{{selection}}

### 类型生成规则

1. **从 JSON 推断类型**
   - 自动识别基础类型
   - 识别数组和对象
   - 处理可选字段
   - 识别联合类型

2. **类型命名**
   - 使用 PascalCase
   - 名称具有描述性
   - 避免使用 any

3. **类型组织**
```typescript
// 基础类型
interface User {
  id: number
  name: string
  email: string
  avatar?: string // 可选字段
  role: 'admin' | 'user' // 联合类型
  createdAt: string
}

// 列表类型
type UserList = User[]

// 分页响应
interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// API 响应包装
interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
```

### 输出要求

- 为每个字段添加注释
- 识别并处理嵌套结构
- 提供类型别名简化使用
- 考虑类型复用
