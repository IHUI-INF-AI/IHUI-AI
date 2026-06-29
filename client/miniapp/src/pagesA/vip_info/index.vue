<template>
  <view class="page">
    <!-- 导航栏 -->
    <navigation-bars 
      :color="navColor" 
      :viscosity="true" 
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
      :title="title" 
      @pack="backPage" 
      :backgroundColor="navBackgroundColor" 
    />

    <!-- 会员支付弹窗组件 -->
    <BottomPopup 
      v-if="paymentPopupVisible" 
      :isShow="paymentPopupVisible" 
      @close="handleClosePaymentPopup" 
      :dataInfo="dataInfo" 
    />

    <!-- 会员介绍弹窗组件 -->
    <IntroducePopup 
      v-if="introducePopupVisible" 
      :userInfoDatas="userInfoDatas" 
      :isShow="introducePopupVisible"
      @close="handleCloseIntroducePopup" 
      @openLevelPopup="handleOpenLevelPopup" 
    />

    <!-- 会员等级介绍弹窗 -->
    <levelPopup 
      v-if="levelPopupVisible" 
      @openPopup="handleOpenPaymentPopup" 
      :userInfoDatas="userInfoDatas" 
      :btnFlag="btnFlag" 
      :isShow="levelPopupVisible"
      @close="handleCloseLevelPopup" 
      :dataInfo="dataInfo" 
    />

    <!-- 操盘手介绍弹窗组件 -->
    <IntroducePopups 
      v-if="introducePopupVisibles" 
      :userInfoDatas="userInfoDatas" 
      :dataInfo="dataInfo" 
      :isShow="introducePopupVisibles"
      @close="handleCloseIntroducePopups" 
    />

    <!-- 私董会 -->
    <PrivateAdvisory 
      v-if="privateAdvisoryVisibles" 
      :userInfoDatas="userInfoDatas" 
      :isShow="privateAdvisoryVisibles"
      @close="handleClosePrivateAdvisoryPopup" 
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import NavigationBars from '@/components/navigation-bars/index.vue'
import IntroducePopup from './introduce-popup/index.vue'
import levelPopup from './introduce-popup/levelIndex.vue'
import IntroducePopups from './introduce-popup/indexs.vue'
import PrivateAdvisory from './introduce-popup/privateAdvisory.vue'
import BottomPopup from '@/components/bottom-popup/index.vue'

// 状态
const title = ref('会员')
const navColor = ref('black')
const navBackgroundColor = ref('')
const userInfoDatas = ref<any>({})

// 弹窗状态
const introducePopupVisible = ref(false)
const introducePopupVisibles = ref(false)
const levelPopupVisible = ref(false)
const privateAdvisoryVisibles = ref(false)
const paymentPopupVisible = ref(false)

// 数据
const btnFlag = ref(false)
const dataInfo = ref<any>({})

onMounted(() => {
  userInfoDatas.value = uni.getStorageSync('data')
})

// 页面加载
onLoad((options: any) => {
  if (options.type == 'IntroducePopups') {
    title.value = '操盘手'
    handleOpenIntroducePopups()
  } else if (options.type == 'IntroducePopups1') {
    title.value = '操盘手'
    handleOpenIntroducePopups1()
  } else if (options.type == 'IntroducePopup') {
    title.value = '会员权益'
    introducePopupVisible.value = true
    updateNavBackgroundColor()
  } else if (options.type == 'PrivateAdvisory') {
    title.value = '私事会权益'
    privateAdvisoryVisibles.value = true
  } else if (options.type == 'levelPopup') {
    title.value = '会员等级介绍'
    levelPopupVisible.value = true
  }
})

// 更新导航栏背景颜色
function updateNavBackgroundColor() {
  if (introducePopupVisible.value || levelPopupVisible.value) {
    navBackgroundColor.value = 'transparent'
  } else {
    navBackgroundColor.value = ''
  }
}

// 打开支付弹窗
function handleOpenPaymentPopup() {
  paymentPopupVisible.value = true
}

// 关闭支付弹窗
function handleClosePaymentPopup() {
  paymentPopupVisible.value = false
}

// 关闭介绍弹窗
function handleCloseIntroducePopup() {
  introducePopupVisible.value = false
  updateNavBackgroundColor()
}

// 打开等级弹窗
function handleOpenLevelPopup() {
  levelPopupVisible.value = true
}

// 关闭等级弹窗
function handleCloseLevelPopup() {
  levelPopupVisible.value = false
}

// 打开操盘手介绍弹窗
function handleOpenIntroducePopups() {
  introducePopupVisibles.value = true
}

// 打开操盘手介绍弹窗1
function handleOpenIntroducePopups1() {
  // 打开操盘手介绍弹窗1
}

// 关闭操盘手介绍弹窗
function handleCloseIntroducePopups() {
  introducePopupVisibles.value = false
  updateNavBackgroundColor()
}

// 关闭私董会弹窗
function handleClosePrivateAdvisoryPopup() {
  privateAdvisoryVisibles.value = false
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
}
</style>
