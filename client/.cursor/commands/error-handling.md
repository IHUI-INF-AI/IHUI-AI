# 错误处理

为代码添加完善的错误处理机制。

## 指令

请为以下代码添加完善的错误处理：

{{selection}}

### 错误处理策略

1. **异步操作**
```typescript
const fetchData = async () => {
  try {
    const response = await api.getData()
    return response.data
  } catch (error) {
    if (error instanceof AxiosError) {
      // HTTP 错误
      if (error.response?.status === 401) {
        // 未授权，跳转登录
        router.push('/login')
      } else if (error.response?.status === 403) {
        // 无权限
        message.error('您没有权限执行此操作')
      } else if (error.response?.status >= 500) {
        // 服务器错误
        message.error('服务器繁忙，请稍后重试')
      }
    } else if (error instanceof TypeError) {
      // 类型错误
      console.error('数据格式错误:', error)
    } else {
      // 未知错误
      console.error('未知错误:', error)
      message.error('操作失败，请重试')
    }
    throw error // 重新抛出供上层处理
  }
}
```

2. **边界检查**
```typescript
const getItem = (arr: unknown[], index: number) => {
  if (!Array.isArray(arr)) {
    throw new TypeError('参数必须是数组')
  }
  if (index < 0 || index >= arr.length) {
    throw new RangeError('索引越界')
  }
  return arr[index]
}
```

3. **Vue 错误边界**
```vue
<ErrorBoundary @error="handleError">
  <ChildComponent />
</ErrorBoundary>
```

### 输出

1. 添加错误处理后的完整代码
2. 错误处理说明
3. 建议的错误监控方案
