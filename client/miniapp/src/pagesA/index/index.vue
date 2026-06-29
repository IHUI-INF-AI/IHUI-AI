<template>
  <view class="main-container" >
    <CommissionFloatingIcon></CommissionFloatingIcon>

    <!-- 用户信息展示区 (隐形登录后展示) -->
    <view v-if="isLogin && userInfo" class="user-info-bar">
      <image v-if="userInfo.avatar" class="user-avatar" :src="userInfo.avatar" mode="aspectFill"></image>
      <image v-else class="user-avatar"
        src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png" mode="aspectFill">
      </image>
      <view class="user-details">
        <text class="user-name">{{ userInfo.userName || "用户" }}</text>
        <text v-if="userInfo.isVip" class="user-vip-tag">VIP</text>
      </view>
    </view>

    <scroll-view scroll-y class="page-scroll" :enhanced="true" :show-scrollbar="false" :bounce="true"
      :fast-deceleration="true">

      <view class="custom-carousel-wrapper" style="margin-top: 180rpx">
        <Carousel :banner="HomePagedata.banner_carousel" @item-click="onCarouselItemClick" />
      </view>

      <ToolBar @id-service="handerServiceClick" />
      <!-- <PopularCourses :CourseList1="CourseList1" :CourseList2="CourseList2" @oncourses="oncourseClick" /> -->
      <KnowledgePlanet :kList1="kList1" :kList2="kList2" />
      <view style="padding-bottom: 20rpx">
        <BottomFigure />
      </view>
    </scroll-view>

    <view v-if="showModal" class="mask" style="padding: 20rpx">
      <view style="width: 100%">
        <view style="width: 100%; height: 400rpx; position: relative">
          <text style="
              position: absolute;
              top: 20rpx;
              right: 20rpx;
              z-index: 999;
              font-size: 50rpx;
            " @click="close">x</text>
          <image show-menu-by-longpress="true" style="width: 100%; border-radius: 20rpx; height: 100%"
            src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/home/ewm.png"></image>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import CommissionFloatingIcon from "@/pages/tools/components/CommissionFloatingIcon/index.vue";
import Carousel from "@/components/Carousel/index.vue";
import ToolBar from "@/components/Toolbar/index.vue";
import PopularCourses from "@/components/PopularCourses/index.vue";
import KnowledgePlanet from "@/components/KnowledgePlanet/index.vue";
import BottomFigure from "@/components/BottomFigure/index.vue";
import { openId, login } from "@/service/login.js";
import { getHomePageResources } from "@/service/index.js";
import { pay } from "@/utils/pay/index.js";
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

const id = ref("1")
const type = ref("1")
const showModal = ref(false)
const userInfo = ref(null)
const isLogin = ref(false)
const CourseList1 = ref([])
const CourseList2 = ref([])
const kList1 = ref([])
const kList2 = ref([])
const HomePagedata = ref({})

function refreshUserInfo() {
  try {
    const userData = uni.getStorageSync("data");
    if (userData) {
      updateUserInfo(userData);
    }
  } catch (e) {
    console.error("刷新用户信息失败:", e);
  }
}

function silentLogin() {
  console.log('=====隐形登录=====')
  try {
    const userData = uni.getStorageSync("data");
    if (userData) {
      updateUserInfo(userData);
      console.log("从本地存储获取用户数据成功");
    } else {
      wxLogin();
    }
  } catch (e) {
    console.error("检查登录状态失败:", e);
    wxLogin();
  }
}

function updateUserInfo(data) {
  userInfo.value = data;
  isLogin.value = true;
  getApp().globalData.userInfo = data;
  userStore.setUserInfo(data);
  console.log("用户信息已更新:", data);
}

function wxLogin() {
  uni.login({
    provider: "weixin",
    success: (loginRes) => {
      if (loginRes.code) {
        console.log("获取微信code成功:", loginRes.code);
        openId(loginRes.code)
          .then((openIdRes) => {
            const yqm = "";
            login(openIdRes.openid, yqm)
              .then((res) => {
                const data = res.data;
                console.log("登录成功，用户数据:", data);
                uni.setStorageSync("data", data);
                updateUserInfo(data);
              })
              .catch((err) => {
                console.error("系统登录失败:", err);
                uni.showToast({
                  title: "登录失败，请稍后再试",
                  icon: "none",
                });
              });
          })
          .catch((err) => {
            console.error("获取openid失败:", err);
          });
      } else {
        console.error("微信登录失败：没有code");
        uni.showToast({
          title: "登录失败，请检查网络",
          icon: "none",
        });
      }
    },
    fail: (err) => {
      console.error("微信登录接口调用失败:", err);
      uni.showToast({
        title: "登录失败，请检查网络",
        icon: "none",
      });
    },
  });
}

function onCarouselItemClick(item) {
  console.log("父组件收到点击事件，轮播图ID：", item.id);
}

function handerServiceClick(item) {
  if (item.id === 1) {
    showModal.value = true;
  }
  console.log("从子组件接收到的ID:", item.id);
}

function close() {
  showModal.value = false;
}

function oncourseClick(item) {
  if (item.type === 1) {
    const vip = uni.getStorageSync("vip");
    if (vip === true) {
      uni.showToast({
        title: "用户已是会员",
        icon: "none",
      });
    } else {
      uni.showToast({
        title: "请充值会员",
        icon: "none",
      });
    }
    console.log("vip", vip);
  } else {
    pay(item.id, 3).then((res) => {
      console.log("执行了购买");
    });
  }
  console.log("父组件", item);
}

function handleFeatureClick(type) {
  uni.vibrateShort();

  if (type === "ai-copywriting") {
    uni.navigateTo({
      url: "/pages/tools/ai_wenan",
    });
    return;
  }

  if (type === "ai-image") {
    uni.navigateTo({
      url: "/pages/tools/ai_photo",
    });
    return;
  }

  if (type === "marketing") {
    uni.navigateTo({
      url: "/pages/tools/ai-marketing",
    });
    return;
  }

  uni.showToast({
    title: "功能开发中",
    icon: "none",
  });
}

function handleCourseClick(course) {
  uni.vibrateShort();
  uni.showToast({
    title: "课程详情开发中",
    icon: "none",
  });
}

function handleNewsClick(news) {
  uni.vibrateShort();
  uni.showToast({
    title: "资讯详情开发中",
    icon: "none",
  });
}

function handleViewAll(type) {
  uni.vibrateShort();
  uni.showToast({
    title: "更多内容开发中",
    icon: "none",
  });
}

function home() {
  getHomePageResources(0).then((res) => {
    HomePagedata.value = res.data;
    console.log("res", res.data);
  });
}

onLoad(() => {
  home();
  silentLogin();
});

onShow(() => {
  refreshUserInfo();
  console.log("页面显示，当前用户信息:", userInfo.value);
});
</script>

<style lang="scss" scoped>
.main-container {
  height: 100vh;
  background-image: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/WechatIMG032f010ce4ee6be32aca6623cde9de09.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 用户信息栏样式 */
.user-info-bar {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  display: flex;
  align-items: center;
  background: rgb(255 255 255 / 0.2);
  backdrop-filter: blur(10px);
  border-radius: 30rpx;
  padding: 10rpx 20rpx;
  z-index: 100;
  box-shadow: 0 0 10rpx rgb(0 0 0 / 0.1);
  border: 1px solid rgb(255 255 255 / 0.3);
}

.user-avatar {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  margin-right: 10rpx;
  border: 2rpx solid #fff;
}

.user-details {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.user-name {
  font-size: 28rpx;
  color: #fff;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1rpx 3rpx rgb(0 0 0 / 0.3);
}

.user-vip-tag {
  background: linear-gradient(135deg, #fc0, #ff9500);
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  margin-left: 10rpx;
}

.mask {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(0 0 0 / 0.5);
  z-index: 998;
}

.page-scroll {
  height: 100vh;
  position: relative;
  width: 95%;
  margin: 0 auto;
}

.container {
  min-height: 100vh;
  padding-bottom: 40rpx;
}

/* 欢迎区域样式 */
.welcome {
  position: relative;
  padding: 160rpx 30rpx 40rpx;
}

.glass-panel {
  background: rgb(15 15 20 / 0.7);
  backdrop-filter: blur(10px);
  border-radius: 30rpx;
  padding: 40rpx;
  box-shadow: 0 0 32rpx rgb(0 0 0 / 0.3);
  border: 1px solid rgb(0 242 255 / 0.2);
  z-index: 10;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg,
        transparent,
        rgb(0 242 255 / 0.5),
        rgb(139 92 246 / 0.5),
        transparent);
    filter: blur(1px);
  }

  &::after {
    content: "";
    position: absolute;
    top: 1px;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg,
        rgb(0 242 255 / 0.1),
        transparent 20%);
    opacity: 0.5;
  }
}

.welcome-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.welcome-title {
  font-size: 48rpx;
  font-weight: 700;
  background: linear-gradient(135deg, #00f2ff, #8b5cf6, #00f2ff);
  background-size: 200% 100%;
  animation: gradientFlow 6s linear infinite;
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 16rpx;
  text-shadow: 0 0 30rpx rgb(0 242 255 / 0.6);
}

.welcome-subtitle {
  font-size: 32rpx;
  color: rgb(255 255 255 / 0.9);
  text-shadow: 0 0 20rpx rgb(0 242 255 / 0.4);
}

/* 板块容器 */
.section-container {
  padding: 30rpx;
  margin-bottom: 20rpx;
  background: rgb(15 15 20 / 0.7);
  backdrop-filter: blur(10px);
  border-radius: 30rpx;
  margin: 0 30rpx 30rpx;
  border: 1px solid rgb(0 242 255 / 0.1);
  box-shadow: 0 0 32rpx rgb(0 0 0 / 0.3);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg,
        transparent,
        rgb(0 242 255 / 0.3),
        transparent);
  }
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #00f2ff;
  margin-bottom: 24rpx;
  text-shadow: 0 0 15rpx rgb(0 242 255 / 0.4);
  position: relative;

  .title-icon {
    margin-right: 12rpx;
    font-size: 36rpx;
  }

  &::after {
    content: "";
    position: absolute;
    left: -20rpx;
    top: 50%;
    transform: translateY(-50%);
    width: 6rpx;
    height: 36rpx;
    background: linear-gradient(180deg, #00f2ff, #8b5cf6);
    border-radius: 8rpx;
    box-shadow: 0 0 20rpx rgb(0 242 255 / 0.6);
  }
}

.view-all {
  display: flex;
  align-items: center;
  color: rgb(255 255 255 / 0.7);
  font-size: 26rpx;

  .arrow-icon {
    margin-left: 6rpx;
    font-size: 22rpx;
  }
}

/* 功能区样式 */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.feature-item {
  background-color: rgb(20 20 30 / 0.7);
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 0 30rpx rgb(0 0 0 / 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
  position: relative;
  border: 1px solid rgb(0 242 255 / 0.1);

  &::after {
    content: "";
    position: absolute;
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    background: linear-gradient(135deg,
        rgb(0 242 255 / 0.05),
        rgb(139 92 246 / 0.05));
    right: -40rpx;
    bottom: -40rpx;
    z-index: 0;
  }

  &:active {
    transform: scale(0.98);
    box-shadow: 0 0 15rpx rgb(0 0 0 / 0.03);
    background: rgb(0 242 255 / 0.08);
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 70%;
    height: 1px;
    background: linear-gradient(to right, rgb(0 242 255 / 0.5), transparent);
  }
}

.feature-item-icon {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15rpx;
  margin-bottom: 16rpx;
  font-size: 36rpx;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgb(255 255 255 / 0.2), transparent);
    border-radius: inherit;
    opacity: 0.6;
  }

  &.copywriting-icon {
    background: linear-gradient(135deg,
        rgb(255 235 59 / 0.2),
        rgb(255 193 7 / 0.2));
    color: #ffc107;
    box-shadow: 0 0 12rpx rgb(255 193 7 / 0.2);
    border: 1px solid rgb(255 193 7 / 0.3);
  }

  &.image-icon {
    background: linear-gradient(135deg,
        rgb(255 152 0 / 0.2),
        rgb(255 87 34 / 0.2));
    color: #ff9800;
    box-shadow: 0 0 12rpx rgb(255 87 34 / 0.2);
    border: 1px solid rgb(255 87 34 / 0.3);
  }

  &.video-icon {
    background: linear-gradient(135deg,
        rgb(244 67 54 / 0.2),
        rgb(233 30 99 / 0.2));
    color: #e91e63;
    box-shadow: 0 0 12rpx rgb(233 30 99 / 0.2);
    border: 1px solid rgb(233 30 99 / 0.3);
  }

  &.marketing-icon {
    background: linear-gradient(135deg,
        rgb(3 169 244 / 0.2),
        rgb(3 155 229 / 0.2));
    color: #03a9f4;
    box-shadow: 0 0 12rpx rgb(3 169 244 / 0.2);
    border: 1px solid rgb(3 169 244 / 0.3);
  }
}

.feature-item-content {
  display: flex;
  flex-direction: column;
}

.feature-item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8rpx;
  text-shadow: 0 0 15rpx rgb(0 242 255 / 0.3);
}

.feature-item-desc {
  font-size: 24rpx;
  color: rgb(255 255 255 / 0.7);
}

/* 课程区域样式 */
.course-scroll {
  width: 100%;
  white-space: nowrap;
}

.course-list {
  display: inline-flex;
  padding: 8rpx 0;
  gap: 20rpx;
}

.course-card {
  background: rgb(20 20 30 / 0.7);
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 0 30rpx rgb(0 0 0 / 0.2);
  margin-right: 20rpx;
  width: 400rpx;
  flex-shrink: 0;
  transition: transform 0.2s;
  position: relative;
  border: 1px solid rgb(0 242 255 / 0.1);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg,
        rgb(0 242 255 / 0.7),
        rgb(139 92 246 / 0.7));
  }

  &:active {
    transform: scale(0.98);
  }
}

.course-card-content {
  padding: 24rpx;
}

.course-card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12rpx;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 84rpx;
  text-shadow: 0 0 10rpx rgb(0 242 255 / 0.3);
}

.course-card-info {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;

  .course-lessons {
    color: #00f2ff;
    text-shadow: 0 0 10rpx rgb(0 242 255 / 0.3);
  }

  .course-students {
    color: rgb(255 255 255 / 0.7);
  }
}

/* 资讯区域样式 */
.news-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.news-item {
  background: rgb(20 20 30 / 0.7);
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  transition: transform 0.2s;
  box-shadow: 0 0 30rpx rgb(0 0 0 / 0.2);
  border: 1px solid rgb(0 242 255 / 0.1);

  &:active {
    transform: scale(0.98);
    background: rgb(0 242 255 / 0.08);
  }

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 70%;
    height: 1px;
    background: linear-gradient(to right, rgb(0 242 255 / 0.5), transparent);
  }
}

.news-item-badge {
  width: 80rpx;
  height: 80rpx;
  background: rgb(20 20 30 / 0.8);
  border-radius: 15rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  flex-shrink: 0;
  border: 1px solid rgb(0 242 255 / 0.1);
  box-shadow: 0 0 15rpx rgb(0 242 255 / 0.2);
}

.news-item-content {
  flex: 1;
  min-width: 0;
}

.news-item-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #fff;
  margin-bottom: 12rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0 10rpx rgb(0 242 255 / 0.3);
}

.news-item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: rgb(255 255 255 / 0.7);
}

@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}
</style>
