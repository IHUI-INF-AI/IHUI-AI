<template>
  <view class="personal-card">
    <view class="personal-card-title">
      <view style="
          margin-top: 39rpx;
          margin-right: 40rpx;
          display: flex;
          width: 100%;
          justify-content: flex-end;
          align-items: center;
        ">
        <view class="nickname">{{ user.thirdPartyAccounts.nickname }}</view>
        <image v-if="imageSrc" :src="imageSrc" mode="aspectFill"
          style="width:74rpx;height: 66rpx;border-radius: 8rpx;" />
        <image v-else src="/static/images/daixaodiming.png" mode="aspectFill"
          style="width:74rpx;height: 66rpx;" />
      </view>
      <view class="income-box" style="line-height: 46rpx">
        <view class="boxItem">累计收入(元):</view>
        <view class="boxItemCount">{{
          formatPrice(data.totalIncome)
        }}</view>
      </view>
      <view class="button_max_box">
        <view style="line-height: 46rpx;text-align: center;display: flex;flex-direction: row;align-items: center;">
          <view class="boxItem">可提现金额:</view>
          <view class="boxItemCount">{{ formatPrice(data.currentAmount) }}</view>
        </view>
        <view class="button_box" @click="withdrawalClick">
          提现
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { formatPrice } from "@/utils/time.js"
import { getWithdrawal } from "@/service/tixian.js"

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits([])

const user = ref({})
const imageSrc = ref('')

function withdrawalClick() {
  let userData = uni.getStorageSync('data')['authInfo']
  if (!userData['certificate'] && !userData['username']) {
    uni.showModal({
      title: '提现前请先实名认证！',
      icon: 'none',
      confirmText: '去实名',
      cancelText: '不，谢谢',
      success: (res) => {
        if (!res['confirm']) return
        uni.$emit('closeVerify', true)
      }
    })
  } else {
    const amount = Number(props.data.currentAmount || 0)
    if (amount <= 0) {
      uni.showToast({ title: '可提现金额为0，暂时无法提现', icon: 'none', duration: 2000 })
      return
    }
    uni.navigateTo({
      url: "/pages/withdrawal/index?currentAmount=" + props.data.currentAmount,
    })
  }
}

function handleClose() {
}

onMounted(() => {
  const data = uni.getStorageSync("data")
  const { nickname, uuid } = data
  const openId = data.thirdPartyAccounts.openId
  user.value = data
  imageSrc.value = data.thirdPartyAccounts.avatar

  getWithdrawal(nickname, uuid, openId).then(res => {
    if (res.code == "200") {
      if (wx.canIUse('requestMerchantTransfer')) {
        wx.requestMerchantTransfer({
          mchId: res.data.mchId,
          appId: res.data.appId,
          package: res.data.packageInfo,
          success: (res) => {
            uni.showToast({ title: '提交成功请等待到账！', icon: 'none' })
            uni.navigateBack({ delta: 1 })
          },
          fail: (res) => {
            uni.showToast({ title: '提现失败', icon: 'none' })
          },
        })
      } else {
        wx.showModal({
          content: '你的微信版本过低，请更新至最新版本。',
          showCancel: false,
        })
      }
    }
  })
})
</script>

<style lang="less" scoped>
.personal-card {
  width: 100%;
  height: 390rpx;
  background-image: url("/static/images/bjcspNew.jpg");
  background-size: 100% 100%;

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
    height: 80vh;
    border-radius: 20rpx;
    overflow: hidden;
    transform: translateY(100vh) rotateX(5deg);
    transition: all 0.3s ease-in-out;
    opacity: 0.8;
    background-image: linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7);
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
    font-family: 'AlimamaFangYuanTi';
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
    border: 1rpx solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1);
    background-image: linear-gradient(to bottom, #ffffff, #f9f9f9);
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
    box-shadow: 0px 0px 6px 0px rgba(0, 0, 0, 0.3);
  }

  .personal-card-title {
    width: 97%;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 35rpx;
    font-weight: bold;

    .income-box {
      margin-top: 66rpx;
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 100%;
      height: 40rpx;
      box-sizing: border-box;
      padding-left: 180rpx;
      font-size: 32rpx;
      color: #fff;
    }
    .boxItem {
      width: 220rpx;
      text-align: right;
      margin-right: 8rpx;
    }
    .boxItemCount {
      width: 160rpx;
      text-align: left;
    }

    .button_max_box {
      color: #fff;
      width: 100%;
      margin-top: 30rpx;
      display: flex;
      flex-direction: row;
      align-items: center;
      box-sizing: border-box;
      padding-left: 180rpx;
      font-size: 32rpx;

      .button_box {
        width: 100rpx;
        height: 46rpx;
        font-size: 28rpx;
        text-align: center;
        line-height: 46rpx;
        border-radius: 20rpx;
        background-color: #000000;
        border: 1px solid #ffffff;
        color: #ffffff;
      }
    }
  }

  .nickname {
    margin-top: -29rpx;
    font-size: 15rpx;
    margin-right: 18px;
    width: 100rpx;
    text-align: center;
  }
}
</style>
