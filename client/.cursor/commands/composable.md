# 创建 Composable

生成 Vue 3 组合式函数（Composable）。

## 指令

请根据以下需求创建 Composable：

{{selection}}

### Composable 结构

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * useXxx - 功能描述
 * @param options 配置选项
 * @returns 返回值说明
 * @example
 * const { data, loading, execute } = useXxx({ ... })
 */
export function useXxx(options?: UseXxxOptions) {
  // ============ 配置 ============
  const { 
    immediate = true,
    onSuccess,
    onError,
  } = options ?? {}

  // ============ 状态 ============
  const data = ref<DataType | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // ============ 计算属性 ============
  const isReady = computed(() => !loading.value && !error.value)

  // ============ 方法 ============
  const execute = async () => {
    loading.value = true
    error.value = null
    try {
      // 执行逻辑
      data.value = await fetchData()
      onSuccess?.(data.value)
    } catch (e) {
      error.value = e as Error
      onError?.(e as Error)
    } finally {
      loading.value = false
    }
  }

  // ============ 生命周期 ============
  onMounted(() => {
    if (immediate) execute()
  })

  onUnmounted(() => {
    // 清理逻辑
  })

  // ============ 返回 ============
  return {
    data,
    loading,
    error,
    isReady,
    execute,
  }
}

// ============ 类型定义 ============
interface UseXxxOptions {
  immediate?: boolean
  onSuccess?: (data: DataType) => void
  onError?: (error: Error) => void
}
```

### 命名规范

- 函数名以 `use` 开头
- 文件名与函数名一致
- 放在 `composables` 或 `hooks` 目录
