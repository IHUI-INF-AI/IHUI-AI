/**
 * 共享基础按钮组件
 * 无 Element Plus 依赖
 */
<template>
  <button
    class="shared-btn"
    :class="[
      `shared-btn-${type}`,
      `shared-btn-${size}`,
      { 'shared-btn-block': block, 'shared-btn-disabled': disabled, 'shared-btn-loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <text v-if="loading" class="shared-btn-loading-icon">⏳</text>
    <text class="shared-btn-text">
      <slot />
    </text>
  </button>
</template>

<script>
export default {
  name: 'SharedButton',
  props: {
    type: {
      type: String,
      default: 'default',
      validator: (val) => ['default', 'primary', 'success', 'warning', 'danger', 'text'].includes(val)
    },
    size: {
      type: String,
      default: 'medium',
      validator: (val) => ['small', 'medium', 'large'].includes(val)
    },
    block: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click'],
  methods: {
    handleClick(e) {
      if (!this.disabled && !this.loading) {
        this.$emit('click', e)
      }
    }
  }
}
</script>

<style scoped>
.shared-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;
}

.shared-btn:active {
  opacity: 0.8;
  transform: scale(0.98);
}

.shared-btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.shared-btn-medium {
  padding: 10px 20px;
  font-size: 14px;
}

.shared-btn-large {
  padding: 14px 28px;
  font-size: 16px;
}

.shared-btn-block {
  display: flex;
  width: 100%;
}

.shared-btn-default {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #333);
}

.shared-btn-primary {
  background: var(--color-primary, #171717);
  color: #ffffff;
}

.shared-btn-success {
  background: var(--color-success, #16a34a);
  color: #ffffff;
}

.shared-btn-warning {
  background: var(--color-warning, #f59e0b);
  color: #ffffff;
}

.shared-btn-danger {
  background: var(--color-danger, #ef4444);
  color: #ffffff;
}

.shared-btn-text {
  background: transparent;
  color: var(--color-primary, #171717);
  padding: 0;
}

.shared-btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shared-btn-loading {
  pointer-events: none;
}

.shared-btn-loading-icon {
  margin-right: 6px;
}
</style>
