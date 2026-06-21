# 创建 API 接口

快速生成 API 请求函数和类型定义。

## 指令

请根据以下接口信息生成完整的 API 代码：

{{selection}}

### 代码结构

1. **类型定义**
```typescript
// 请求参数类型
interface RequestParams {
  // ...
}

// 响应数据类型
interface ResponseData {
  // ...
}
```

2. **API 函数**
```typescript
import request from '@/utils/request'

/**
 * 接口描述
 * @param params 请求参数
 * @returns 响应数据
 */
export const apiName = (params: RequestParams) => {
  return request<ResponseData>({
    url: '/api/path',
    method: 'GET', // POST, PUT, DELETE
    params, // GET 参数
    data: params, // POST 参数
  })
}
```

### 要求

- 类型定义完整且准确
- 使用项目的 request 封装
- 添加 JSDoc 注释
- 处理可选参数
- 考虑分页和错误处理
