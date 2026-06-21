# 创建 Pinia Store

快速生成 Pinia 状态管理模块。

## 指令

请根据以下需求创建 Pinia Store：

{{selection}}

### Store 结构

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useXxxStore = defineStore('xxx', () => {
  // ============ State ============
  const data = ref<DataType[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============ Getters ============
  const isEmpty = computed(() => data.value.length === 0)
  const total = computed(() => data.value.length)

  // ============ Actions ============
  const fetchData = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await api.getData()
      data.value = res.data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = []
    loading.value = false
    error.value = null
  }

  // ============ 返回 ============
  return {
    // state
    data,
    loading,
    error,
    // getters
    isEmpty,
    total,
    // actions
    fetchData,
    reset,
  }
})
```

### 规范

- 使用 Setup Store 语法
- State 使用 ref/reactive
- Getters 使用 computed
- Actions 处理异步和错误
- 提供 reset 方法
