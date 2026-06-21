<template>
  <view>
    <!-- 遮罩层 -->
    <view class="login-popup-mask" @click.stop="handleMaskClick" @touchmove.prevent></view>
    <!-- 弹窗主体 -->
    <view :class="['login-popup', 'show']" @touchmove="handleTouchMove" @scroll="handleScroll" :style="{ '--blur-amount': blurAmount + 'px' }">
      <view class="login-popup-header">
        <view class="" style="width: 100%;    display: flex;align-items: flex-end;justify-content: space-between; ">
          <image style="width: 370rpx;height: 45rpx;" src="/static/images/headertitley.png"
            mode=""></image>
          <image style="width: 288rpx;height: 25.96rpx;" src="/static/images/headertitlet.png"
            mode=""></image>
        </view>
        <!-- <text class="login-popup-title">WELCOME <text class="login-popup-sub">IHUI INF.AI</text></text> -->
        <!-- <image class="login-popup-avatar" :src="avatarUrl" /> -->
        <image :src="avatarUrlNew ||
          'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/act.png'
          " class="login-popup-avatar" @click="chooseAvatar" mode="aspectFill">
        </image>
      </view>
      <view class="login-popup-card">
        <view class="login-popup-row">
          <view class="icon user"></view>

          <view class="login-popup-nickname-prefix">

            <!-- <image style="width: 169rpx;height: 30rpx;margin-top: 1rpx;margin-right: 10rpx;" src="https://file.aizhs.top/sys-mini/default/aihui.png" mode="widthFix">
            </image> -->
            <input class="login-popup-username-input1" style="width: auto; min-width: 200rpx; text-align: center; margin: 0 auto; display: block;" v-model="nickname" placeholder="请输入用户名" maxlength="8"
            :key="nickname" @input="" @blur="onInput" />

          </view>
          
        </view>
      </view>
      <view class="login-popup-card">
        <view class="login-popup-row" style="display: flex; justify-content: space-between">
          <view class="icon id"></view>
          <text v-if="loginInfo.isVip==1" class="login-popup-role"
                style="padding-right: 0rpx; padding-left: 120rpx;">会员</text>
          <text v-if="loginInfo.isVip==2" class="login-popup-role" style="width: 100%;text-align: center;">操盘手</text>
          <text v-if="loginInfo.isVip==0" class="login-popup-role" style="width: 100%;text-align: center;">普通用户</text>

          <view class="upgradeImg"
                v-if="loginInfo.isVip==0"
                @click="openIntroduce"
          >
            <image
                class="up_img"
                src="/static/images/Upgrade.png"
                mode="aspectFit"></image>
          </view>
          <view class="upgradeImg"
                v-if="loginInfo.isVip==1"
                @click="openIntroduces"
          >
            <image
                class="up_img"
                src="/static/images/Upgrade.png"
                mode="aspectFit"></image>
          </view>
        </view>
      </view>
      <view class="login-popup-card" style="margin-bottom: 0rpx;">
        <view class="login-popup-row phone-row" :class="{ bg: disabledFlag }">
          <view class="icon phone"></view>
          <input :disabled="disabledFlag" style="text-align: center;padding-right: 50rpx;"
            class="login-popup-username-input" v-model="phone" placeholder="请输入电话号码" maxlength="20" disabled />
        </view>
      </view>

      <view class="login-popup-card33"
        style="  border-bottom: 4rpx solid rgba(0, 0, 0, 0.2); box-shadow:0rpx;display: flex;justify-content: center;">
        <view class="">
          <image src="/static/images/infolink.png" style="width: 254rpx;height: 22rpx;margin-top: 16rpx;" mode="">
          </image>
        </view>
      </view>

      <view class="login-popup-footer" style="margin-top: 24rpx;">
        <button class="login-popup-btn save" @click="handleLogin">
          保存信息
        </button>
        <button class="login-popup-btn logout" @click="loginOut">登出</button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { uploadPictures } from "@/utils/uploadImage.js"
import { getvipPrice } from "@/service/vip.js"

const props = defineProps(['loginInfo'])
const emit = defineEmits(['close', 'update:login-out', 'login'])

const isImage = ref(false)
const nickname = ref('')
const showTip = ref(false)
const avatarUrl = ref('')
const avatarUrlNew = ref('')
const phone = ref('')
const fileName = ref('')
const newUserInfo = ref({
  isLoggedIn: false,
  username: '请登录',
  isVip: null,
  knowledgeBaseQuota: 'N/A',
  remainingTokens: '',
  userId: 'N/A',
  avatarUrl: '',
  memberLevelText: '显示用户的会员等级',
  nextLevelInfoText: '显示距离下一个等级还差多少积分也就是钱',
})
const introducePopupVisible = ref(false)
const introducePopupVisibles = ref(false)
const disabledFlag = ref(false)
const blurAmount = ref(0)
const scrollTop = ref(0)

if (props.loginInfo.username && props.loginInfo.username.length > 0) {
  nickname.value = props.loginInfo.username
}
if (props.loginInfo['avatarUrl'] == null || props.loginInfo['avatarUrl'] == undefined || !props.loginInfo['avatarUrl'].length) {
  avatarUrl.value = uni.getStorageSync('avatarPic')
  avatarUrlNew.value = uni.getStorageSync('avatarPic')
} else {
  avatarUrl.value = props.loginInfo.avatarUrl
  avatarUrlNew.value = props.loginInfo.avatarUrl
}

if (props.loginInfo.phone.length > 0) {
  phone.value = props.loginInfo.phone
  disabledFlag.value = true
}

function onInput(e) {
  let val = e.detail.value
  let newVal = ''
  let len = 0
  for (let i = 0; i < val.length; i++) {
    const char = val[i]
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (len + 1 > 6) break
      newVal += char
      len += 1
    } else if (/[a-zA-Z0-9]/.test(char)) {
      if (len + 0.5 > 10) break
      newVal += char
      len += 0.5
    }
  }
  
  nextTick(() => {
    nickname.value = newVal
  })
}

function openIntroduce() {
  uni.navigateTo({
    url: 'pagesA/vip_info/index?type=IntroducePopup'
  })
}

function openIntroduces() {
  uni.navigateTo({
    url: 'pagesA/vip_info/index?type=IntroducePopups1'
  })
}

function handleMaskClick(e) {
  emit('close')
}

function handleTouchMove(e) {
  if (e.touches && e.touches.length > 0) {
    const touch = e.touches[0]
    const scrollY = touch.clientY
    blurAmount.value = Math.min(Math.max(scrollY / 10, 0), 20)
  }
}

function handleScroll(e) {
  const scrollTopVal = e.detail ? e.detail.scrollTop : 0
  scrollTop.value = scrollTopVal
  blurAmount.value = Math.min(Math.max(scrollTopVal / 10, 0), 20)
}

function clearLoginDataSync() {
  try {
    const storageKeys = [
      'token', 'userInfo', 'data', 'accessToken', 'refreshToken',
      'openid', 'openId', 'uuid', 'thirdPartyAccounts', 'authInfo',
      'userMargin', 'isVip', 'vipExpireTime', 'loginState', 'hasLogin',
      'isLoggedIn', 'phone', 'nickname', 'avatar'
    ]
    
    storageKeys.forEach(key => {
      try {
        uni.removeStorageSync(key)
      } catch (e) {
      }
    })
    
    try {
      uni.clearStorageSync()
    } catch (e) {
      uni.clearStorage()
    }
  } catch (e) {
  }
}

function loginOut() {
  emit('close')
  
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        try {
          const { clearLoginDataCompletely } = require('@/utils/auth.js')
          clearLoginDataCompletely()
        } catch (e) {
          clearLoginDataSync()
        }
        
        uni.$emit('loginOut')
        emit('update:login-out', newUserInfo.value)
        
        uni.reLaunch({
          url: '/pages/login-app/login'
        })
      }
    }
  })
}

function handleCancel() {
  emit('close')
}

function chooseAvatar() {
  uploadPictures()
    .then((res) => {
      if (res && res.length > 0) {
        avatarUrlNew.value = res[0].base64
        fileName.value = res[0].fileName
        isImage.value = true
      }
    })
    .catch((err) => {
      const errorMsg = err && err.message ? err.message : '选择图片失败，请重试'
      uni.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 2000
      })
    })
}

function handleLogin() {
  if (nickname.value.length > 8) {
    uni.showToast({
      title: '昵称过长 不能超过8个字符',
      icon: 'none',
    })
    return
  }
  if (!nickname.value) {
    uni.showToast({
      title: '请输入昵称',
      icon: 'none',
    })
    return
  }

  if (!phone.value || phone.value.length !== 11) {
    uni.showToast({
      title: '请输入正确的手机号码',
      icon: 'none',
    })
    return
  }

  emit('login', {
    avatar: avatarUrlNew.value,
    nickname: nickname.value,
    phone: phone.value,
    fileName: fileName.value,
  })

  if (!isImage.value) {
  } else {
    uni.setStorageSync('avatarPic', avatarUrlNew.value)
    uni.$emit('setAvatarPic', avatarUrlNew.value)
  }

  isImage.value = false

  emit('close')
}

onMounted(() => {
  // document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  // document.body.style.overflow = 'auto'
})
</script>

<style lang="scss" scoped>
.login-popup-mask {
  -webkit-transform: translateZ(0);
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  transition: backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease;
  z-index: 1001;
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.login-popup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: -100%;
  border-radius: 34.5rpx 34.5rpx 0 0;
  z-index: 1001;
  padding: 20rpx 32rpx 0rpx 32rpx;
  transition: bottom 0.35s cubic-bezier(0.4, 1.4, 0.6, 1);
  // min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #F0F1FA;
  backdrop-filter: blur(var(--blur-amount, 0px));
  -webkit-backdrop-filter: blur(var(--blur-amount, 0px));
  transition: bottom 0.35s cubic-bezier(0.4, 1.4, 0.6, 1), backdrop-filter 0.3s ease, -webkit-backdrop-filter 0.3s ease;
  box-shadow: 0rpx 0 20rpx 0rpx rgba(255, 255, 255, 0.8);
  border-width: 6rpx 6rpx 0rpx 6rpx;
  border-style: solid;
  border-color: rgba(251, 255, 203, 0.08);
  overflow-y: auto;
  padding-bottom: 50rpx;
  &.show {
    bottom: 0;
  }
}

.login-popup-header {
  width: 100%;
  text-align: center;
  margin-bottom: 24rpx;

  .login-popup-title {
    font-size: 44rpx;
    font-family: 'AlimamaFangYuanTi';
    letter-spacing: 4rpx;
    color: #222;
    font-weight: bold;

    .login-popup-sub {
      color: #9694ff;
      font-size: 32rpx;
      margin-left: 12rpx;
    }
  }

  .login-popup-avatar {
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    margin: 18rpx auto 0 auto;
    display: block;
  }
}
.login-popup-card33 {
	width: 80%;
}
.login-popup-card {
  width: 80%;
  border-radius: 15rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 0 8rpx #e0e0ff;

  .login-popup-row {
    display: flex;
    align-items: center;
    font-size: 32rpx;
    color: #444;
    border: 1px solid #ffffff;

    .icon {
      width: 48rpx;
      height: 48rpx;
      margin-right: 16rpx;

      &.user {
        background: url("/static/images/User_02.png") no-repeat center/contain;
      }

      &.id {
        background: url("/static/images/identification-documents1.png") no-repeat center/contain;
      }

      &.phone {
        background: url("/static/images/phone9.png") no-repeat center/contain;
      }
    }

    .login-popup-username {
      font-weight: bold;
      font-size: 36rpx;
      letter-spacing: 2rpx;
    }

    .login-popup-role {
      font-size: 32rpx;
    }

    .login-popup-upgrade {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.73) 5%, #FFFB00 99%);
      color: #FF2525;
      border-radius: 8rpx;
      border: none;
      outline: none;
      margin: 0;
      height: 40rpx;
      line-height: 40rpx;
	  font-family: 'AlimamaFangYuanTi';
	  font-size: 26rpx;
	  font-weight: normal;
	  line-height: normal;
    }

    &.phone-row {
      border-radius: 15rpx;
      padding: 8rpx 16rpx;
      font-family: 'AlimamaFangYuanTi';
      font-size: 34rpx;
      color: #646464;
      margin-bottom: 0;
    }

    &.bg {
      background: #848484;
    }
  }
}

.login-popup-footer {
  width: 80%;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 12rpx;

  .login-popup-btn {
    width: 100%;
    font-size: 30rpx;
    border-radius: 15rpx;
    letter-spacing: 2rpx;
    border: none;
    outline: none;
  }

  .save {
    font-size: 48rpx;
    font-weight: bold;
    color: #000;
    text-transform: uppercase;
    border-radius: 15rpx;
    border: 4rpx solid #000;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    animation: bouncea 0.5s ease-in-out infinite;
    margin-bottom: 8rpx;
    height: 70rpx;
    line-height: 70rpx;
  }

  .logout {
    font-size: 48rpx;
    font-weight: bold;
    color: #000;
    text-transform: uppercase;
    border-radius: 15rpx;
    border: 4rpx solid #000;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    animation: bouncea 0.5s ease-in-out infinite;
    height: 70rpx;
    line-height: 70rpx;
  }
}
.upgradeImg {
  width: 155rpx;
  height: 50rpx;
  right: 0;
  .up_img {
    width: 100%;
    height: 100%;
  }
}
.login-popup-row {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.25);
  border: 1.5rpx solid #d6d6e7;
  border-radius: 15rpx;
  box-shadow: 0 0 8rpx #e0e0ff;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 0 18rpx;
  height: 60rpx;
}

.icon.user {
  width: 40rpx;
  height: 40rpx;
  margin-right: 12rpx;
  background: url("https://img.icons8.com/ios/50/000000/user--v1.png") no-repeat center/contain;
}

.login-popup-username-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 32rpx;
  color: #222;
  font-family: 'AlimamaFangYuanTi';
  letter-spacing: 2rpx;
  font-weight: bold;
  padding: 0;
}

.login-popup-username-input1 {
  border: none;
  outline: none;
  background: transparent;
  font-size: 32rpx;
  color: #222;
  font-family: 'AlimamaFangYuanTi';
  letter-spacing: 2rpx;
  font-weight: bold;
  padding: 0;
}

.login-popup-nickname-prefix {
  width: 100%;
  margin-right: 8rpx;
  color: #333;

  display: flex;
  align-items: center;
  justify-content: center;

  image {
    display: block;
  }
}

@keyframes bouncea {
  0% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }

  50% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    transform: translate(0, 0);
  }

  100% {
    box-shadow: none;
    transform: translate(3rpx, 3rpx);
  }
}
</style>
