<template>
  <div class="feature-card unified-feature-card unified-hover-lift" @click="handleClick">
    <!-- 图标容器 -->
    <div class="feature-icon-box">
      <el-icon :size="28">
        <component :is="icon" />
      </el-icon>
    </div>
    
    <!-- 标题 -->
    <h3 class="feature-title">{{ title }}</h3>
    
    <!-- 描述 -->
    <p class="feature-desc">{{ description }}</p>
    
    <!-- 操作按钮 -->
    <div class="feature-action">
      <button class="unified-btn secondary small">
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  icon: Component
  title: string
  description: string
  actionText: string
  route: string
}

const props = defineProps<Props>()
const router = useRouter()

const handleClick = () => {
  router.push(props.route)
}
</script>

<style scoped>
/* 功能卡片 - 使用全局统一样式，仅添加必要的覆盖 */
.feature-card {
  cursor: pointer;
}

/* 暗色模式下图标容器适配 */
:where(html.dark) .feature-icon-box {
  background-color: var(--el-fill-color-darker);
}
</style>
