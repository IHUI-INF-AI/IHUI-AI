<template>
  <div class="empty">
    <img v-if="image" class="empty-image" :src="image" alt="empty" />
    <span class="empty-text">{{ text }}</span>
    <div class="empty-action" v-if="showAction">
      <slot name="action">
        <el-button type="primary" @click="handleAction">
          {{ actionText }}
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus'

defineProps<{
  image?: string
  text?: string
  showAction?: boolean
  actionText?: string
}>()

const emit = defineEmits<{
  action: []
}>()

const handleAction = () => {
  emit('action')
}
</script>

<style scoped lang="scss">
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;

  .empty-image {
    width: 2rem;
    height: 2rem;
    margin-bottom: 0.4rem;
  }

  .empty-text {
    font-size: 0.28rem;
    color: var(--el-text-color-secondary);
    margin-bottom: 0.4rem;
  }

  .empty-action {
    margin-top: 0.4rem;
  }
}
</style>
