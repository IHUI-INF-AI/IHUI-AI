/**
 * 共享卡片组件
 * 无 Element Plus 依赖
 */
<template>
  <view class="shared-card" :class="{ 'shared-card-shadow': shadow, 'shared-card-bordered': bordered }">
    <view v-if="$slots.header || title" class="shared-card-header">
      <slot name="header">
        <text class="shared-card-title">{{ title }}</text>
      </slot>
    </view>
    <view class="shared-card-body">
      <slot />
    </view>
    <view v-if="$slots.footer" class="shared-card-footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<script>
export default {
  name: 'SharedCard',
  props: {
    title: {
      type: String,
      default: ''
    },
    shadow: {
      type: Boolean,
      default: true
    },
    bordered: {
      type: Boolean,
      default: true
    }
  }
}
</script>

<style scoped>
.shared-card {
  background: var(--color-bg-primary, #ffffff);
  border-radius: 12px;
  overflow: hidden;
}

.shared-card-shadow {
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
}

.shared-card-bordered {
  border: 1px solid var(--color-border-light, #e5e7eb);
}

.shared-card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light, #e5e7eb);
}

.shared-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #171717);
}

.shared-card-body {
  padding: 20px;
}

.shared-card-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border-light, #e5e7eb);
}
</style>
