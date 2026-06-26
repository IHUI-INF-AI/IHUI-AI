<!-- 
  组件样式模板
  使用方法：复制此模板并修改组件名称和样式
  
  命名规范?  1. 使用 CSS 变量代替硬编码颜?  2. 使用语义化命?  3. 支持暗色模式
-->

<template>
  <div class="component-template">
    <!-- 头部区域 -->
    <div class="component-header">
      <h3 class="component-title">{{ title }}</h3>
      <div class="component-actions">
        <slot name="actions" />
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="component-body">
      <slot />
    </div>
    
    <!-- 底部区域 -->
    <div v-if="$slots.footer" class="component-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style lang="scss" scoped>
// ============================================
// 组件变量定义（如需要覆盖全局变量?// ============================================
.component-template {
  // 组件级变?  --component-bg: var(--el-bg-color);
  --component-border: var(--el-border-color-lighter);
  --component-shadow: var(--global-box-shadow);
  --component-radius: var(--global-border-radius);
  --component-padding: 16px;
  
  // 基础样式
  background: var(--component-bg);
  border: var(--unified-border);
  border-radius: var(--component-radius);
  box-shadow: var(--component-shadow);
  overflow: hidden;
  transition: box-shadow var(--transition-normal, 0.3s ease);

  // 悬停效果
  &:hover {
    box-shadow: var(--global-box-shadow-lg);
  }
}

// ============================================
// 头部区域
// ============================================
.component-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--component-padding);
  border-bottom: var(--unified-border-bottom);
  
  .component-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .component-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

// ============================================
// 内容区域
// ============================================
.component-body {
  padding: var(--component-padding);
  color: var(--el-text-color-regular);
}

// ============================================
// 底部区域
// ============================================
.component-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px var(--component-padding);
  border-top: var(--unified-border);
  background: var(--el-fill-color-lighter);
}

// ============================================
// 暗色模式适配（如需要特殊处理）
// ============================================
:global(html.dark) {
  .component-template {
    // 暗色模式特定样式（如需要）
  }
  
  .component-footer {
    background: var(--el-fill-color);
  }
}

// ============================================
// 响应式适配
// ============================================
@media (width <= 768px) {
  .component-template {
    --component-padding: 12px;
  }
  
  .component-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
