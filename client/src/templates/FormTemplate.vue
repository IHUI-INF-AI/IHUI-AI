<!-- 
  表单组件模板
  适用于：登录表单、注册表单、设置表单等
  
  特性：
  - 自动适配暗色模式
  - 支持表单验证状态
  - 支持加载状态
  - 支持响应式布局
-->

<template>
  <form class="form-template" @submit.prevent="handleSubmit">
    <!-- 表单标题 -->
    <div v-if="title || $slots.header" class="form-header">
      <slot name="header">
        <h3 v-if="title" class="form-title">{{ title }}</h3>
        <p v-if="subtitle" class="form-subtitle">{{ subtitle }}</p>
      </slot>
    </div>
    
    <!-- 表单内容 -->
    <div class="form-body">
      <slot />
    </div>
    
    <!-- 表单操作 -->
    <div class="form-actions">
      <slot name="actions">
        <el-button type="primary" native-type="submit" :loading="loading">
          {{ submitText || '提交' }}
        </el-button>
      </slot>
    </div>
    
    <!-- 表单底部 -->
    <div v-if="$slots.footer" class="form-footer">
      <slot name="footer" />
    </div>
  </form>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  submitText?: string
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  submit: [event: Event]
}>()

function handleSubmit(event: Event) {
  emit('submit', event)
}
</script>

<style lang="scss" scoped>
.form-template {
  --form-bg: var(--el-bg-color);
  --form-border: var(--el-border-color-lighter);
  --form-radius: var(--global-border-radius);
  --form-padding: 24px;
  --form-gap: 20px;
  
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: var(--form-padding);
  background: var(--form-bg);
  border: var(--unified-border);
  border-radius: var(--form-radius);
  box-shadow: var(--global-box-shadow);
}

// 表单头部
.form-header {
  margin-bottom: var(--form-gap);
  text-align: center;
}

.form-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.form-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

// 表单内容
.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  :deep(.el-form-item) {
    margin-bottom: 0;
  }
  
  :deep(.el-input__wrapper) {
    background: var(--el-fill-color-blank);
  }
}

// 表单操作
.form-actions {
  margin-top: var(--form-gap);
  padding-top: var(--form-gap);
  border-top: var(--unified-border);
  
  :deep(.el-button) {
    width: 100%;
  }
}

// 表单底部
.form-footer {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  
  a {
    color: var(--el-color-primary);
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

// 暗色模式
:global(html.dark) {
  .form-template {
    box-shadow: var(--global-box-shadow-lg);
  }
}

// 响应式
@media (width <= 768px) {
  .form-template {
    --form-padding: 16px;
    --form-gap: 16px;
  }
  
  .form-title {
    font-size: 20px;
  }
}
</style>
