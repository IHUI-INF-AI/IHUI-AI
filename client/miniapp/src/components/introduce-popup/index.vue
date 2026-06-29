<template>
  <view class="introduce-popup blur-background" v-if="isShow" @click="close">
    <view class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
      <view class="popup-container">
        <!-- <image src="https://file.aizhs.top/sys-mini/jieshaoye.jpg" mode="widthFix" style="width: 100%;" /> -->
        <view class="" style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
          <image style="width: 370rpx;height: 45rpx;" src="/static/images/headertitley.png"
            mode=""></image>
          <image style="width: 288rpx;height: 25.96rpx;" src="/static/images/headertitlet.png"
            mode=""></image>
        </view>
        <view style="display: flex;align-items: flex-end;justify-content: space-between;">
          <image style="width:152rpx;margin-top: 20rpx;margin-left: 48rpx;"
            src="/static/images/huiyuanqy.jpg" mode="widthFix" />
          <view class="avatar-section-wrapper">
            <image class="avatar-section-top" v-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 0"
              src="/static/images/danshuzhiq.png" mode="widthFix" />
            <image class="avatar-section-top" v-else-if="userInfoDatas.isVIP == 1 && userInfoDatas.identityTypy == 1"
              src="/static/images/danshuzhiq.png" mode="widthFix" />
            <image class="avatar-section-top" v-else-if="userInfoDatas.isVIP == 0 && userInfoDatas.identityTypy == 0"
              src="/static/images/pt-head.png" mode="widthFix" />
            <view class="avatar-section">
              <image
                :src="avatarPic ? avatarPic : '/static/images/daixaodiming.png'"
                class="avatar-image" mode="aspectFill" />
            </view>
          </view>

          <image style="width:245rpx;" src="/static/images/saomaa.jpg" mode="widthFix" />
        </view>
        <!-- 标题区域 -->
        <!-- <view class="popup-header">
          <text class="welcome-text">WELCOME</text>
          <text class="ai-text">IKUIINF-AI</text>
        </view> -->
        <!-- 图标区域 -->
        <!-- <view class="icon-section">
          <view class="icon-item">
            <image src="https://file.aizhs.top/sys-mini/Vector.png" mode="aspectFit" />
            <view>会员权益</view>
          </view>
          <image src="https://file.aizhs.top/sys-mini/Ellipse.png" class="avatar-image" mode="aspectFit" />
          <image src="https://file.aizhs.top/sys-mini/soamazixun.png" class="consult-image" mode="aspectFit" />
          <image src="https://file.aizhs.top/sys-mini/erweima.png" class="qr-image" mode="aspectFit" />
        </view> -->

        <!-- 权益列表 -->
        <view class="benefits-list" @touchmove="handleTouchMove">
          <view class="benefit-item" v-for="item in benefits" :key="item.id">
            <text class="benefit-number">{{ item.id }}.</text>
            <rich-text :nodes="item.content" class="benefit-content"></rich-text>
          </view>
        </view>

        <!-- 更多权益信息 -->
        <view class="more-benefits">
          <rich-text :nodes="moreBenefitsText"></rich-text>
        </view>

        <!-- 底部版权信息 -->
        <view class="copyright">
          COPYRIGHT © 2024 IKUIINE-AI ALL RIGHTS RESERVED.
        </view>
        <!-- 底部按钮 -->
        <view class="bottom-button" @click="handleOpen">
          去开通
        </view>

      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  isShow: {
    type: Boolean,
    default: false
  },
  userInfoDatas: {
    type: Object,
  },
})

const emit = defineEmits(['close', 'openPopup'])

const showPopup = ref(false)
const benefits = ref([
  { id: 1, content: '限时优惠<span style="font-weight: bold;">588</span>元,<span style="font-weight: bold;">8</span>月<span style="font-weight: bold;">8</span>日恢复<span style="font-weight: bold;">1288</span>元' },
  { id: 2, content: '赠送<span style="font-weight: bold;">800</span>万算力,爽用独家<span style="font-weight: bold;">Agent</span>' },
  { id: 3, content: '获得分销权益,用<span style="font-weight: bold;">AI</span>降本增效<span style="font-weight: bold;">100</span>倍赚米' },
  { id: 4, content: '私人<span style="font-weight: bold;">AI</span>客服定制权,拥有只属于自己的私密<span style="font-weight: bold;">AI</span>' },
  { id: 5, content: '无限次查看<span style="font-weight: bold;">垂类赛道</span>每日整理资讯,远超他人认知' },
  { id: 6, content: '创始人排队咨询资格,<span style="font-weight: bold;">AI</span>创业项目获取资格' },
  { id: 7, content: '多对一答疑陪跑:<span style="font-weight: bold;">AI</span>教学/自媒体账号搭建/<span style="font-weight: bold;">AI</span>+全域流量陪跑/<span style="font-weight: bold;">MCN</span>超级个人<span style="font-weight: bold;">IP</span>孵化权' },
  { id: 8, content: '免费<span style="font-weight: bold;">AI</span>导航站,<span style="font-weight: bold;">AI</span>服务成本价,不用再被<span style="font-weight: bold;">割</span>韭菜' },
  { id: 9, content: '最新研发<span style="font-weight: bold;">Agentic</span>内测使用资格一个月' },
  { id: 10, content: '升级系统增加算力充值/课程开通/服务开通折扣' }
])
const moreBenefitsText = ref('............约 <span style="font-weight: bold;">20</span> 项权益, 且持续增加 ↑')
const avatarPic = ref('')

watch(() => props.isShow, (val) => {
  if (val) {
    setTimeout(() => {
      showPopup.value = true
    }, 50)
  } else {
    showPopup.value = false
  }
})

onMounted(() => {
  avatarPic.value = uni.getStorageSync('avatarPic')
  uni.$on('setAvatarPic', (data) => {
    avatarPic.value = data
  })
})

function close() {
  showPopup.value = false
  setTimeout(() => {
    emit("close")
  }, 300)
}

function handleOpen() {
  emit("openPopup")
}

function handleTouchMove(e) {
  e.stopPropagation()
}
</script>

<style>
.introduce-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  perspective: 1200px;
}

.popup-content {
  position: relative;
  width: 100%;

  /* max-width: 730rpx; */
  height: 80vh;
  border-radius: 20rpx;
  overflow: hidden;
  transform: translateY(100vh) rotateX(5deg);
  transition: all 0.3s ease-in-out;
  opacity: 0.8;
  background-color: #F0F1FA;
  box-shadow: 0 5px 15px rgb(0 0 0 / 0.2), inset 0 -1px 2px rgb(255 255 255 / 0.7), inset 0 1px 1px rgb(255 255 255 / 0.7);
}

.popup-content.popup-show {
  transform: translateY(0) rotateX(0deg);
  opacity: 1;
}

.popup-container {
  width: 100%;
  height: 100%;
  padding: 40rpx 30rpx;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  backdrop-filter: blur(3px);
}

.popup-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  gap: 20rpx;
  justify-content: center;
}

.welcome-text {
  font-size: 40rpx;
  font-weight: bold;
  letter-spacing: 2rpx;
  color: #000;
  font-family: monospace;
}

.ai-text {
  font-size: 26rpx;
  color: #8257e6;
  font-weight: bold;
  margin-top: 5rpx;
}

.icon-section {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin: 20rpx 0 40rpx;
  padding: 0 20rpx;
  color: #FFF98F;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 130rpx;
  height: 130rpx;
  margin-right: 50rpx;
}


.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.consult-image {
  width: 100rpx;
  height: 130rpx;
}

.qr-image {
  width: 130rpx;
  height: 130rpx;
}

.benefits-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  -webkit-overflow-scrolling: touch;

  /* 增加iOS流畅滚动 */
}

.benefit-item {
  display: flex;
  align-items: flex-start;
  border: 1px solid #f3f4f6;
  padding: 8rpx;
  border-radius: 15rpx;
  font-size: 28rpx;
  color: #1f2937;
}

.benefit-number {
  font-weight: bold;
  padding-right: 8rpx;
}

.benefit-content {
  flex: 1;
}

.more-benefits {
  text-align: center;
  font-size: 26rpx;
  color: #D94646;
}

.bottom-button {
  width: 356rpx;
  height: 80rpx;
  background-color: #fff;
  border-radius: 30rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20rpx auto;
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  border: 1rpx solid rgb(255 255 255 / 0.8);
  box-shadow: 0 4rpx 10rpx rgb(0 0 0 / 0.15), inset 0 1px 0 rgb(255 255 255 / 1);
  background-image: linear-gradient(to bottom, #fff, #f9f9f9);
}

.copyright {
  font-size: 18rpx;
  color: #999;
  text-align: center;
  margin-top: 10rpx;
}

.avatar-section-wrapper {
  display: inline-block;
  position: relative;
}

.avatar-section-top {
  top: -13%;
  z-index: 100;
  position: absolute;
  width: 154rpx;
}

.avatar-section {
  width: 176rpx;
  height: 176rpx;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid #BFBEFF;
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
}
</style>
