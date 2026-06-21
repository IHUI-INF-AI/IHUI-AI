<template>
  <view class="settings-modal" v-if="visible" @click="onMaskClick">
    <view class="settings-modal-mask"></view>
    <view class="settings-modal-content" @click.stop>
      <view class="settings-modal-header">
        <text class="settings-modal-title">{{ title }}</text>
      </view>
      <view class="settings-modal-body">
        <slot name="body">
          <text v-if="message" class="settings-modal-tip">{{ message }}</text>
        </slot>
      </view>
      <view class="settings-modal-footer">
        <view class="settings-modal-btn cancel-btn" @click="onCancel">
          <text class="settings-modal-btn-text">{{ cancelText }}</text>
        </view>
        <view
          class="settings-modal-btn confirm-btn"
          :class="{ disabled: confirmDisabledInternal }"
          @click="onConfirm"
        >
          <text class="settings-modal-btn-text">{{ confirmDisabledInternal ? confirmText + '(' + confirmCountdown + 's)' : confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  message: {
    type: String,
    default: ''
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  maskClosable: {
    type: Boolean,
    default: true
  },
  confirmDisabledSeconds: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['cancel', 'confirm'])

const confirmCountdown = ref(0)
const confirmTimer = ref(null)

const confirmDisabledInternal = computed(() => confirmCountdown.value > 0)

watch(() => props.visible, (val) => {
  if (val && props.confirmDisabledSeconds > 0) {
    startConfirmCountdown()
  } else if (!val) {
    clearConfirmCountdown()
  }
})

const startConfirmCountdown = () => {
  confirmCountdown.value = props.confirmDisabledSeconds
  confirmTimer.value = setInterval(() => {
    confirmCountdown.value--
    if (confirmCountdown.value <= 0) {
      clearConfirmCountdown()
    }
  }, 1000)
}

const clearConfirmCountdown = () => {
  if (confirmTimer.value) {
    clearInterval(confirmTimer.value)
    confirmTimer.value = null
  }
  confirmCountdown.value = 0
}

const onMaskClick = () => {
  if (props.maskClosable) {
    emit('cancel')
  }
}

const onCancel = () => {
  emit('cancel')
}

const onConfirm = () => {
  if (confirmDisabledInternal.value) return
  emit('confirm')
}

onBeforeUnmount(() => {
  clearConfirmCountdown()
})
</script>

<style lang="scss" scoped>
</style>
