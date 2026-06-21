<template>
  <div class="skeleton-loader" :class="[type, { animated: animated }]">
    <!-- 文本骨架 -->
    <div v-if="type === 'text'" class="skeleton-text">
      <div
        v-for="i in lines"
        :key="i"
        class="skeleton-line"
        :style="{
          width: i === lines && lastLineWidth ? lastLineWidth : '100%',
        }"
      ></div>
    </div>

    <!-- 卡片骨架 -->
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div v-if="showAvatar" class="skeleton-avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton-title"></div>
        <div class="skeleton-text-content">
          <div
            v-for="i in lines"
            :key="i"
            class="skeleton-line"
            :style="{
              width: i === lines && lastLineWidth ? lastLineWidth : '100%',
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 列表骨架 -->
    <div v-else-if="type === 'list'" class="skeleton-list">
      <div v-for="i in count" :key="i" class="skeleton-list-item">
        <div v-if="showAvatar" class="skeleton-avatar"></div>
        <div class="skeleton-item-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-line"></div>
        </div>
      </div>
    </div>

    <!-- 自定义骨架 -->
    <div v-else-if="type === 'custom'" class="skeleton-custom">
      <slot />
    </div>

    <!-- 图片骨架 -->
    <div v-else-if="type === 'image'" class="skeleton-image" :style="imageStyle"></div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 骨架类型 */
  type?: 'text' | 'card' | 'list' | 'image' | 'custom'
  /** 文本行数 */
  lines?: number
  /** 最后一行宽度（百分比） */
  lastLineWidth?: string
  /** 列表项数量 */
  count?: number
  /** 是否显示头像 */
  showAvatar?: boolean
  /** 是否显示动画 */
  animated?: boolean
  /** 图片样式 */
  imageStyle?: Record<string, string>
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  lines: 3,
  lastLineWidth: '60%',
  count: 5,
  showAvatar: true,
  animated: true,
})
</script>

<style scoped lang="scss">
.skeleton-loader {
  &.animated {
    .skeleton-line,
    .skeleton-avatar,
    .skeleton-title,
    .skeleton-image {
      background: linear-gradient(
        90deg,
        var(--el-fill-color-light) 25%,
        var(--el-fill-color-lighter) 50%,
        var(--el-fill-color-light) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
      will-change: background-position;
    }
  }
}

.skeleton-line,
.skeleton-avatar,
.skeleton-title,
.skeleton-image {
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.skeleton-line {
  height: 16px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
}

.skeleton-title {
  height: 20px;
  width: 60%;
  margin-bottom: 12px;
}

.skeleton-text {
  width: 100%;
}

.skeleton-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: none;
  border-radius: var(--global-border-radius);
}

.skeleton-content {
  flex: 1;
}

.skeleton-text-content {
  margin-top: 8px;
}

.skeleton-list {
  width: 100%;
}

.skeleton-list-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: none;

  &:last-child {
    border-bottom: none;
  }
}

.skeleton-item-content {
  flex: 1;
}

.skeleton-image {
  width: 100%;
  height: 200px;
  border-radius: var(--global-border-radius);
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

// 暗色模式支持
@media (prefers-color-scheme: dark) {
  .skeleton-line,
  .skeleton-avatar,
  .skeleton-title,
  .skeleton-image {
    background-color: var(--el-fill-color-darker);
  }
}
</style>
