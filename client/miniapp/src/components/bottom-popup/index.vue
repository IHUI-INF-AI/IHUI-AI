<template>
  <view v-if="isShow" class="bottom-popup" @click="handleMaskClick">
    <view class="popup-mask"></view>
    <view class="popup-content" @click.stop>
      <slot></slot>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  isShow: {
    type: Boolean,
    default: false
  },
  dataInfo: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close'])

const handleMaskClick = () => {
  emit('close')
}
</script>

<style lang="scss" scoped>
.bottom-popup {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.popup-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
}

.popup-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 40rpx;
  max-height: 80vh;
  overflow-y: auto;
}
</style>
