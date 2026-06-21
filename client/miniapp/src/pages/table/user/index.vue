<template>
  <view class="outContainer">
    <!-- 导航栏 -->
    <navigation-bars 
      color="black" 
      backgroundColor="#fff" 
      :viscosity="true" 
      title="我的"
      :showFeedback="true" 
      :userInfo="currentUser" 
      :showMenu="true"
      @feedback-click="handleFeedbackClick" 
      @nav-click="handleNavClick" 
      @menu-click="handleMenuClick" 
    />

    <view class="content-container">
      <!-- 用户信息卡片 -->
      <UserInfoCard 
        ref="userInfoCard" 
        :userInfo="currentUser" 
        :openid="currentUser.open_id"
        @edit-profile="handleEditProfile"
        @update:login-out="handleLoginOut" 
      />

      <!-- 登录弹窗 -->
      <login-pop-up 
        v-if="showLoginPopup" 
        :loginInfo="currentUser" 
        @login="onLogin"
        @close="handleCloseLoginPopup" 
        @update:login-out="handleLoginOut" 
      />

      <!-- 用户卡片 -->
      <UserCard v-if="!isshow" />

      <!-- 会员权益 -->
      <view v-if="!isshow" class="membership-benefits-container">
        <view class="membership-benefits-header" @click="toggleMembershipBenefits">
          <view class="membership-benefits-arrow" :class="{ 'arrow-rotate': showMembershipBenefits }">
            <image class="arrow-icon" src="/static/images/back.svg" mode="aspectFit" />
          </view>
        </view>
        <view class="membership-benefits-content" v-show="showMembershipBenefits">
          <UserMembershipBenefits 
            @openIntroduces="openIntroduces" 
            :isMember="!!currentUser.isVip" 
            :benefits="memberBenefitsData" 
          />
        </view>
      </view>

      <!-- Tab 列表 -->
      <view style="padding: 0 20rpx; margin-bottom: 20rpx;">
        <StudyBar :barList="tabList" @change="handleTabChange" />
      </view>

      <!-- 内容展示区域 -->
      <view class="content-display-area">
        <view v-if="activeTab === 1" class="content-list">
          <view v-for="(item, index) in textContentList" :key="index" class="content-item text-item">
            <view class="content-header">
              <text class="content-title">{{ item.title || '文本内容' }}</text>
              <text class="content-time">{{ item.time || '' }}</text>
            </view>
            <view class="content-body">
              <rich-text class="content-text" :nodes="formatContent(item.content)"></rich-text>
            </view>
          </view>
          <view v-if="textContentList.length === 0" class="empty-content">
            <text>暂无文本内容</text>
          </view>
        </view>

        <view v-if="activeTab === 2" class="content-list">
          <view v-for="(item, index) in imageContentList" :key="index" class="content-item image-item">
            <view class="content-header">
              <text class="content-title">{{ item.title || '图片内容' }}</text>
              <text class="content-time">{{ item.time || '' }}</text>
            </view>
            <view class="content-body">
              <image 
                v-for="(imgUrl, imgIndex) in item.imageList" 
                :key="imgIndex"
                :src="imgUrl" 
                mode="aspectFill" 
                class="content-image"
              />
            </view>
          </view>
          <view v-if="imageContentList.length === 0" class="empty-content">
            <text>暂无图片内容</text>
          </view>
        </view>

        <view v-if="activeTab === 3" class="content-list">
          <view v-for="(item, index) in videoContentList" :key="index" class="content-item video-item">
            <view class="content-header">
              <text class="content-title">{{ item.title || '视频内容' }}</text>
              <text class="content-time">{{ item.time || '' }}</text>
            </view>
            <view class="content-body">
              <video :src="item.videoUrl" class="content-video" controls />
            </view>
          </view>
          <view v-if="videoContentList.length === 0" class="empty-content">
            <text>暂无视频内容</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/store/modules/user'
import NavigationBars from '@/components/navigation-bars/index.vue'
import UserInfoCard from './UserInfoCard/UserInfoCard.vue'
import loginPopUp from './loginPopUp/index.vue'
import UserCard from './components/user_cards.vue'
import UserMembershipBenefits from '@/components/UserMembershipBenefits/UserMembershipBenefits.vue'
import StudyBar from '@/components/study/bar.vue'

const userStore = useUserStore()

// 用户信息
const currentUser = ref<any>({})
const isshow = ref(false)
const showLoginPopup = ref(false)
const showMembershipBenefits = ref(false)

// Tab 相关
const activeTab = ref(1)
const tabList = ref([
  { id: 1, name: '文本' },
  { id: 2, name: '图片' },
  { id: 3, name: '视频' },
])

// 内容列表
const textContentList = ref<any[]>([])
const imageContentList = ref<any[]>([])
const videoContentList = ref<any[]>([])

// 会员权益数据
const memberBenefitsData = ref<any[]>([])

onMounted(() => {
  loadUserInfo()
})

// 加载用户信息
function loadUserInfo() {
  const userInfo = uni.getStorageSync('userInfo')
  if (userInfo) {
    currentUser.value = userInfo
  }
}

// 切换会员权益显示
function toggleMembershipBenefits() {
  showMembershipBenefits.value = !showMembershipBenefits.value
}

// Tab 切换
function handleTabChange(tabId: number) {
  activeTab.value = tabId
}

// 格式化内容
function formatContent(content: string) {
  return content || ''
}

// 编辑资料
function handleEditProfile() {
  uni.navigateTo({ url: '/pagesA/settings/edit-profile' })
}

// 退出登录
function handleLoginOut() {
  userStore.clearUserData()
  uni.reLaunch({ url: '/pages/login-app/login' })
}

// 关闭登录弹窗
function handleCloseLoginPopup() {
  showLoginPopup.value = false
}

// 登录
function onLogin() {
  showLoginPopup.value = false
  loadUserInfo()
}

// 反馈点击
function handleFeedbackClick() {
  uni.navigateTo({ url: '/pagesA/fankui/index' })
}

// 导航点击
function handleNavClick() {
  // 返回上一页
  uni.navigateBack()
}

// 菜单点击
function handleMenuClick() {
  // 菜单操作
}

// 打开介绍
function openIntroduces() {
  uni.navigateTo({ url: '/pagesA/vip/details' })
}
</script>

<style lang="scss" scoped>
.outContainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.content-container {
  padding: 0 20rpx;
  padding-top: 100rpx;
}

.membership-benefits-container {
  margin: 20rpx 0;
}

.membership-benefits-header {
  padding: 20rpx 0;
}

.membership-benefits-arrow {
  transition: transform 0.3s;
  
  &.arrow-rotate {
    transform: rotate(90deg);
  }
}

.arrow-icon {
  width: 30rpx;
  height: 30rpx;
}

.content-display-area {
  margin-top: 20rpx;
}

.content-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.content-item {
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
}

.content-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.content-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.content-time {
  font-size: 24rpx;
  color: #999;
}

.content-text {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.content-image {
  width: 100%;
  height: 300rpx;
  border-radius: 8rpx;
  margin-bottom: 10rpx;
}

.content-video {
  width: 100%;
  height: 400rpx;
}

.empty-content {
  padding: 60rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
