# JSON 转 TypeScript

将 JSON 数据转换为 TypeScript 接口。

## 指令

请将以下 JSON 转换为 TypeScript 类型：

{{selection}}

### 转换规则

1. **基础类型推断**
```json
{
  "name": "张三",
  "age": 25,
  "active": true,
  "score": null
}
```
```typescript
interface User {
  name: string
  age: number
  active: boolean
  score: null
}
```

2. **嵌套对象**
```json
{
  "user": {
    "profile": {
      "avatar": "url"
    }
  }
}
```
```typescript
interface Data {
  user: {
    profile: {
      avatar: string
    }
  }
}
// 或拆分
interface Profile {
  avatar: string
}
interface User {
  profile: Profile
}
interface Data {
  user: User
}
```

3. **数组处理**
```json
{
  "items": [1, 2, 3],
  "users": [{ "name": "a" }]
}
```
```typescript
interface Data {
  items: number[]
  users: { name: string }[]
}
```

### 选项

- 是否拆分嵌套接口
- 是否添加可选标记 (?)
- 是否添加 readonly
- 命名风格 (interface/type)

### 输出

完整的 TypeScript 类型定义
