# 创建 Vue 组件

根据描述快速生成 Vue 3 组件。

## 指令

请根据以下需求创建 Vue 3 组件：

{{selection}}

### 组件规范

1. **使用 Composition API** + `<script setup>`
2. **TypeScript** 类型支持
3. **样式** 使用 `<style scoped>` 或 Tailwind CSS

### 组件结构

```vue
<template>
  <!-- 模板 -->
</template>

<script setup lang="ts">
// 导入
import { ref, computed, onMounted } from 'vue'

// Props 定义
interface Props {
  // ...
}
const props = withDefaults(defineProps<Props>(), {
  // 默认值
})

// Emits 定义
const emit = defineEmits<{
  (e: 'event-name', value: string): void
}>()

// 响应式状态
const state = ref()

// 计算属性
const computed = computed(() => {})

// 方法
const handleClick = () => {}

// 生命周期
onMounted(() => {})
</script>

<style scoped>
/* 样式 */
</style>
```

### 最佳实践

- Props 使用 TypeScript 接口定义
- 事件名使用 kebab-case
- 提供合理的默认值
- 添加必要的注释
