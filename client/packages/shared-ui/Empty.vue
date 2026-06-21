/**
 * 共享空状态组件
 * 无 Element Plus 依赖
 */
<template>
  <view class="shared-empty">
    <view v-if="image" class="shared-empty-image">
      <image :src="image" mode="aspectFit" />
    </view>
    <view v-else class="shared-empty-icon">
      <text class="icon">📭</text>
    </view>
    <text class="shared-empty-text">{{ description }}</text>
    <view v-if="$slots.default" class="shared-empty-action">
      <slot />
    </view>
  </view>
</template>

<script>
export default {
  name: 'SharedEmpty',
  props: {
    description: {
      type: String,
      default: '暂无数据'
    },
    image: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.shared-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.shared-empty-image {
  width: 160px;
  height: 160px;
  margin-bottom: 16px;
}

.shared-empty-image image {
  width: 100%;
  height: 100%;
}

.shared-empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.shared-empty-text {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

.shared-empty-action {
  margin-top: 16px;
}
</style>
