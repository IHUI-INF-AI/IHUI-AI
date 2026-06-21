<template>
  <view class="settings-nav-bar" :style="{ paddingTop: statusBarHeightPx }">
    <view class="nav-bar-inner">
      <image
        class="nav-back"
        src="/static/images/back.svg"
        mode="heightFix"
        @click="onBackClick"
      />
      <text class="nav-title">{{ title }}</text>
      <view class="nav-placeholder"></view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  statusBarHeightPx: {
    type: String,
    default: '0px'
  },
  backToHome: {
    type: Boolean,
    default: false
  }
})

const onBackClick = () => {
  if (props.backToHome) {
    uni.reLaunch({ url: '/pages/table/tools/index' })
    return
  }
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.reLaunch({ url: '/pages/table/tools/index' })
    }
  })
}
</script>

<style lang="scss" scoped>
.settings-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1001;
  width: 100%;
  background-color: #fff;
  border-bottom: 1rpx solid #eee;
}

.nav-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
}

.nav-back {
  width: 40rpx;
  height: 40rpx;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #171717;
}

.nav-placeholder {
  width: 40rpx;
}
</style>
