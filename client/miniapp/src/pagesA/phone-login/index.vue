<template>
  <view class="phone-login-container">
    <!-- Logo部分 -->
    <view class="logo-section">
      <image class="logo-image" src="https://file.aizhs.top/sys-mini/home-icon.png"></image>
    </view>
    
    <!-- 欢迎文案 -->
    <view class="welcome-title">欢迎来到AI智汇社</view>
    
    <!-- 提示文案 -->
    <view class="login-tip">
      AI智汇社平台需要保证服务质量和提高用户体验，请登录后使用
    </view>
    
    <!-- 空白区域 -->
    <view class="spacer"></view>
    
    <!-- 协议部分 -->
    <view class="agreement-section">
      <view class="agreement-box">
        <checkbox class="check-box" :checked="isAgree" @click="isAgree = !isAgree" />
        <view class="agreement-text">
          已阅读并同意
          <text class="link" @click="goToUserAgreement">《AI智汇社用户服务协议》</text>
          与
          <text class="link" @click="goToPrivacyPolicy">《AI智汇社隐私政策》</text>
        </view>
      </view>
    </view>
    
    <!-- 登录按钮 -->
    <button class="phone-login-btn" open-type="getPhoneNumber" @getphonenumber="getPhoneNumber" :disabled="!isAgree">
      手机号快捷登录
    </button>
    
    <!-- 由于只需要保留手机号快捷登录按钮，这里注释掉其他按钮 -->
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { openId, login, getPhoneNumberApi } from "@/service/login.js";

const isAgree = ref(false)

onLoad(() => {
  uni.hideHomeButton();
  
  if (uni.getSystemInfoSync().platform === 'android') {
    plus && plus.key.addEventListener('backbutton', function() {
      return false;
    });
  }
});

onUnload(() => {
  if (uni.getSystemInfoSync().platform === 'android') {
    plus && plus.key.removeEventListener('backbutton');
  }
});

function getPhoneNumber(e) {
  if (!isAgree.value) {
    uni.showToast({
      title: '请先同意用户协议',
      icon: 'none'
    });
    return;
  }
  
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    const phoneDetail = e.detail;
    
    uni.login({
      provider: "weixin",
      success: (loginRes) => {
        if (loginRes.code) {
          openId(loginRes.code)
            .then((openIdRes) => {
              getPhoneNumberApi(
                openIdRes.unionId,
                phoneDetail.code || "",
                openIdRes.openid,
                ""
              ).then((res) => {
                const userData = res.data;
                
                if (userData && !userData.phone) {
                  userData.phone = phoneDetail.phoneNumber || "已绑定手机号";
                }
                
                uni.setStorageSync("data", userData);
                uni.$emit('loginSuccess', userData);
                
                uni.showToast({
                  title: '手机号绑定成功',
                  icon: 'success'
                });
                
                setTimeout(() => {
                  uni.switchTab({
                    url: '/pages/table/tools/index'
                  });
                }, 1500);
              }).catch(err => {
                uni.showToast({
                  title: '绑定手机号失败',
                  icon: 'none'
                });
              });
            })
            .catch((err) => {
              uni.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              });
            });
        }
      }
    });
  } else {
    uni.showToast({
      title: '需要授权获取手机号才能继续使用',
      icon: 'none'
    });
  }
}

function navigateToPhoneInput() {
}

function skipLogin() {
  uni.switchTab({
    url: '/pages/table/tools/index'
  });
}

function goToUserAgreement() {
  uni.navigateTo({
    url: '/pagesA/agreement/user-agreement'
  });
}

function goToPrivacyPolicy() {
  uni.navigateTo({
    url: '/pagesA/agreement/privacy-policy'
  });
}
</script>

<style lang="scss" scoped>
.phone-login-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f0fdf9;
}

.logo-section {
  display: flex;
  justify-content: center;
  margin-top: 100rpx;
  margin-bottom: 40rpx;
  
  .logo-image {
    width: 180rpx;
    height: 180rpx;
    border-radius: 30rpx;
    box-shadow: 0 0 20rpx rgb(0 0 0 / 0.1);
  }
}

.welcome-title {
  font-size: 48rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
  color: #333;
}

.login-tip {
  font-size: 30rpx;
  line-height: 1.6;
  text-align: center;
  color: #666;
  padding: 0 40rpx;
  margin-bottom: 40rpx;
}

.spacer {
  flex: 1;
}

.agreement-section {
  display: flex;
  align-items: flex-start;
  margin-bottom: 30rpx;
}

.agreement-box {
  display: flex;
  align-items: center;
}

.check-box {
  transform: scale(0.8);
  margin-right: 10rpx;
}

.agreement-text {
  font-size: 24rpx;
  line-height: 1.4;
  color: #666;
}

.link {
  color: #007aff;
  text-decoration: underline;
}

.phone-login-btn {
  background: linear-gradient(to right, #3AD6B2, #2EC4A6);
  color: white;
  font-size: 36rpx;
  font-weight: 500;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 0 12rpx rgb(58 214 178 / 0.3);
}

.input-phone-btn {
  background: transparent;
  color: #2EC4A6;
  font-size: 34rpx;
  border: 1px solid #2EC4A6;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: 30rpx;
  margin-bottom: 40rpx;
}

.skip-login {
  text-align: center;
  font-size: 30rpx;
  color: #999;
  padding: 20rpx;
}
</style> 
