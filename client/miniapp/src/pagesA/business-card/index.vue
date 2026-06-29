<template>
  <view class="type">
    <!-- 导航栏 -->
    <navigation-bars 
      :viscosity="true" 
      color="#171717" 
      font-size-30 
      title="我的社区名片" 
      @pack=""
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" 
    />

    <view style="padding: 20rpx 20rpx 0;">
      <!-- 上传组件 -->
      <Upload @upload="onUploadClick" :isShow="isShow" :card="card" ref="uploadComponent"></Upload>

      <!-- 制作过程按钮 -->
      <view class="card_items" @click="buyToken" style="float: right;">
        <view class="item-right">
          <image src="https://file.aizhs.top/sys-mini/geren-icon.png"></image>
        </view>
        <view class="item-left">
          <view>社区名片定制入口</view>
        </view>
      </view>

      <view style="overflow: hidden;">
        <!-- 名片分享组件 -->
        <business-card-sharing 
          :isShow="isShow" 
          :card="card" 
          @wx="onWxClick" 
          @pyq="onPyqClick" 
          @upload="onUploadClick"
          ref="sharingComponent"
        ></business-card-sharing>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavigationBars from '@/components/navigation-bars/index.vue'
import Upload from './components/upload/index.vue'
import BusinessCardSharing from './components/business-card-sharing/index.vue'
import { uploadBusinessCard } from '@/service/businessCard.js'

// 数据
const isShow = ref(false)
const card = ref('')
const avatarUrl = ref<any>(null)

onShow(() => {
  loadCardData()
})

onLoad(() => {
  loadCardData()
})

// 加载名片数据
function loadCardData() {
  const data = uni.getStorageSync('data')
  if (data && data['thirdPartyAccounts'] && data['thirdPartyAccounts'].card) {
    isShow.value = true
    card.value = data['thirdPartyAccounts'].card
  } else {
    isShow.value = false
  }
}

// 上传名片
async function onUploadClick(avatar: any) {
  avatarUrl.value = avatar
  const { uuid } = uni.getStorageSync('data')
  const id = uuid

  // 显示加载中提示
  uni.showLoading({ title: '上传中...' })

  // 暂存当前状态
  const previousIsShow = isShow.value
  const previousCard = card.value

  try {
    const res = await uploadBusinessCard(id, avatar.base64, avatar.fileName)
    if (res && res.data) {
      isShow.value = true
      card.value = res.data.url || res.data
      uni.showToast({ title: '上传成功', icon: 'success' })
    }
  } catch (error) {
    // 恢复之前的状态
    isShow.value = previousIsShow
    card.value = previousCard
    uni.showToast({ title: '上传失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

// 制作过程
function buyToken() {
  uni.navigateTo({ url: '/pagesA/business-card/components/process' })
}

// 微信分享
function onWxClick() {
  // 微信分享逻辑
}

// 朋友圈分享
function onPyqClick() {
  // 朋友圈分享逻辑
}
</script>

<style lang="scss" scoped>
.type {
  min-height: 100vh;
  background: #f5f5f5;
}

.card_items {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;

  .item-right {
    image {
      width: 60rpx;
      height: 60rpx;
      margin-right: 16rpx;
    }
  }

  .item-left {
    font-size: 28rpx;
    color: #333;
  }
}
</style>
