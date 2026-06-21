<template>
  <view class="settings-page">
    <SettingsPageLayout title="营业执照">
      <view class="content-inner">
        <view class="license-wrap">
          <image
            class="license-image"
            :src="licenseImage"
            mode="widthFix"
            @click="previewLicense"
          />
        </view>
      </view>
    </SettingsPageLayout>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import SettingsPageLayout from './common/SettingsPageLayout.vue'

const licenseImage = ref('/static/images/yyzz.jpg')

const previewLicense = () => {
  uni.previewImage({
    urls: [licenseImage.value]
  })
}
</script>

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.content-inner {
  padding: 24rpx 24rpx 48rpx;
}

.license-wrap {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  padding: 24rpx;
  box-sizing: border-box;
}

.license-image {
  width: 100%;
  display: block;
  border-radius: 8rpx;
}
</style>
