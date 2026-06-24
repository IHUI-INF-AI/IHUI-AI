<!-- 
  卡片组件模板
  适用于：信息展示、列表项、功能卡片等
  
  特性：
  - 自动适配暗色模式
  - 支持悬停效果
  - 支持加载状态
  - 支持响应式布局
-->

<template>
  <div 
    class="card-template" 
    :class="{ 
      'is-loading': loading,
      'is-clickable': clickable,
      'is-selected': selected
    }"
    @click="handleClick"
  >
    <!-- 图片区域 -->
    <div v-if="$slots.image || image" class="card-image">
      <slot name="image">
        <img v-if="image" :src="image" :alt="imageAlt" />
      </slot>
      <!-- 图片上的标签 -->
      <div v-if="$slots.badge" class="card-badge">
        <slot name="badge" />
      </div>
    </div>
    
    <!-- 头部区域 -->
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <h4 class="card-title">{{ title }}</h4>
        <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
      </slot>
    </div>
    
    <!-- 内容区域 -->
    <div class="card-body">
      <slot />
    </div>
    
    <!-- 底部区域 -->
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
    
    <!-- 加载遮罩 -->
    <div v-if="loading" class="card-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'

interface Props {
  title?: string
  subtitle?: string
  image?: string
  imageAlt?: string
  loading?: boolean
  clickable?: boolean
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  clickable: false,
  selected: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

function handleClick(event: MouseEvent) {
  if (props.clickable && !props.loading) {
    emit('click', event)
  }
}
</script>

<style lang="scss" scoped>
.card-template {
  --card-bg: var(--el-bg-color);
  --card-border: var(--el-border-color-lighter);
  --card-shadow: var(--global-box-shadow);
  --card-radius: var(--global-border-radius);
  --card-padding: 16px;
  
  position: relative;
  background: var(--card-bg);
  border: var(--unified-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  transition: all var(--transition-normal, 0.3s ease);
  
  // 可点击状态
  &.is-clickable {
    cursor: pointer;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--global-box-shadow-lg);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
  
  // 选中状态
  &.is-selected {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    outline: 2px solid var(--el-color-primary-light-7);
    outline-offset: -1px;
  }
  
  // 加载状态
  &.is-loading {
    pointer-events: none;
    opacity: 0.7;
  }
}

// 图片区域
.card-image {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.card-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

// 头部区域
.card-header {
  padding: var(--card-padding);
  padding-bottom: 0;
}

.card-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
}

.card-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

// 内容区域
.card-body {
  padding: var(--card-padding);
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 1.6;
}

// 底部区域
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px var(--card-padding);
  border-top: var(--unified-border);
  background: var(--el-fill-color-lighter);
}

// 加载遮罩
.card-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-mask-color);
  
  .el-icon {
    font-size: 24px;
    color: var(--el-color-primary);
  }
}

// 暗色模式
:global(html.dark) {
  .card-template {
    &.is-clickable:hover {
      box-shadow: var(--global-box-shadow-lg);
    }
  }
  
  .card-loading {
    background: var(--el-mask-color);
  }
}

// 响应式
@media (width <= 768px) {
  .card-template {
    --card-padding: 12px;
  }
  
  .card-title {
    font-size: 15px;
  }
}
</style>
