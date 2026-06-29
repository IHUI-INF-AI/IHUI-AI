<template>
  <view class="main-container">
    <Loading v-if="loading"></Loading>
    
    <!-- 导航栏 -->
    <navigation-bars 
      :viscosity="true" 
      distribution 
      color="#171717" 
      font-size-30 
      title="我的公司" 
      @pack="backPage"
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" 
    />

    <!-- 个人信息卡片 -->
    <PersonalInformationCard :data="data"></PersonalInformationCard>

    <!-- 收益统计卡片 -->
    <EarningsStatisticsCard 
      :dayStatistics="dayStatistics" 
      :monthStatistics="monthStatistics"
      :sumStatistics="sumStatistics" 
      @tab-change="handleTabChange"
    ></EarningsStatisticsCard>

    <!-- 功能模块 -->
    <FunctionBlockColumn @pack="onPackCick"></FunctionBlockColumn>

    <!-- 二维码弹窗 -->
    <bottom-pops :isShow="isShow" @close="onClose">
      <template v-slot:center>
        <view style="display: flex; justify-content: center; align-items: center">
          <image 
            :src="erweima" 
            show-menu-by-longpress="true" 
            mode="widthFix"
            style="width: 400rpx; margin-bottom: 10rpx;" 
          />
        </view>
        <view class="qrcode-footer">
          <view class="qrcode-title">我的分享二维码</view>
          <view class="qrcode-copyright-row">
            <view class="qrcode-copyright-text">
              COPYRIGHT © 2025-2035 IHUIINF AGI<br />
              ALL RIGHTS RESERVED.
            </view>
          </view>
          <view class="qrcode-divider"></view>
          <button class="qrcode-share-btn" open-type="share">分享给好友</button>
          <view class="qrcode-save-text" @click="handleSave">保存到相册</view>
        </view>
      </template>
    </bottom-pops>

    <!-- 身份验证弹窗 -->
    <view class="introduce-popup blur-background" v-if="showVerify" @click="close">
      <view class="popup-content" :class="{ 'popup-show': showVerify }" @click.stop>
        <view class="popup-container">
          <view class="verifyBox">
            <view class="userIcon">
              <image 
                :src="avatarPic ? avatarPic : 'https://file.aizhs.top/sys-mini/daixaodiming.png'"
                class="avatar-img" 
                @click="editProfile" 
              />
            </view>
            <view class="verifyText">身份信息验证</view>
            <view class="ID_input ID_num">
              <input 
                class="search-input" 
                type="text" 
                v-model="IDNum" 
                placeholder="请输入身份证号码"
                :placeholder-style="placeholderStyle" 
              />
            </view>
            <view class="ID_input ID_name">
              <input 
                class="search-input" 
                type="text" 
                v-model="IDName" 
                placeholder="请输入姓名"
                :placeholder-style="placeholderStyle" 
              />
            </view>
            <view class="verifyConfirm" @click="saveUserInfo">确认</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

// 组件
import NavigationBars from '@/components/navigation-bars/index.vue'
import PersonalInformationCard from './PersonalInformationCard/index.vue'
import EarningsStatisticsCard from './EarningsStatisticsCard/index.vue'
import FunctionBlockColumn from './FunctionBlockColumn/index.vue'
import request from '@/utils/service/index.js'

// 状态
const loading = ref(false)
const isShow = ref(false)
const showVerify = ref(false)

// 数据
const data = ref<any>({})
const dayStatistics = ref<any>({})
const monthStatistics = ref<any>({})
const sumStatistics = ref<any>({})

// 二维码
const erweima = ref('')

// 身份验证
const IDNum = ref('')
const IDName = ref('')
const avatarPic = ref('')
const placeholderStyle = ref('color: #999; font-size: 28rpx;')

onMounted(() => {
  loadData()
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await request({
      url: '/finance/distribution/team/center',
      method: 'GET',
    })
    const payload = res?.data || {}
    data.value = payload
    dayStatistics.value = payload.dayStatistics || payload.day || {}
    monthStatistics.value = payload.monthStatistics || payload.month || {}
    sumStatistics.value = payload.sumStatistics || payload.sum || {}
    erweima.value = payload.erweima || payload.qrcode || payload.qrCode || ''
  } catch (error) {
    console.error('加载数据失败:', error)
    uni.showToast({ title: '加载数据失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}

// Tab 切换
function handleTabChange(tab: string) {
  console.log('Tab 切换:', tab)
}

// 功能模块点击
function onPackCick(action: string) {
  console.log('功能模块点击:', action)
  if (action === 'qrcode') {
    isShow.value = true
  }
}

// 关闭弹窗
function onClose() {
  isShow.value = false
}

// 保存二维码
function handleSave() {
  uni.showToast({ title: '保存成功', icon: 'success' })
}

// 编辑资料
function editProfile() {
  // 编辑资料
}

// 保存用户信息
async function saveUserInfo() {
  if (!IDNum.value || !IDName.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  try {
    await request({
      url: '/auth_identity/submit',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { IDNum: IDNum.value, IDName: IDName.value },
    })
    showVerify.value = false
    uni.showToast({ title: '验证成功', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: '验证失败', icon: 'none' })
  }
}

// 关闭验证弹窗
function close() {
  showVerify.value = false
}
</script>

<style lang="scss" scoped>
.main-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.qrcode-footer {
  padding: 20rpx;
  text-align: center;
}

.qrcode-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.qrcode-copyright-row {
  margin-bottom: 20rpx;
}

.qrcode-copyright-text {
  font-size: 20rpx;
  color: #999;
}

.qrcode-divider {
  height: 1rpx;
  background: #eee;
  margin: 20rpx 0;
}

.qrcode-share-btn {
  background: #007aff;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  margin-bottom: 20rpx;
}

.qrcode-save-text {
  color: #007aff;
  font-size: 28rpx;
}

/* 验证弹窗 */
.introduce-popup {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.blur-background {
  background: rgb(0 0 0 / 0.5);
  backdrop-filter: blur(10px);
}

.popup-content {
  width: 80%;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
}

.verifyBox {
  text-align: center;
}

.userIcon {
  margin-bottom: 20rpx;
}

.avatar-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
}

.verifyText {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
}

.ID_input {
  margin-bottom: 20rpx;
}

.search-input {
  width: 100%;
  height: 80rpx;
  border: 1rpx solid #eee;
  border-radius: 10rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.verifyConfirm {
  margin-top: 30rpx;
  padding: 20rpx;
  background: #007aff;
  color: #fff;
  border-radius: 10rpx;
  font-size: 30rpx;
}
</style>
