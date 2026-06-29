<template>
  <view class="payment-test-container">
    <view class="header">
      <text class="title">支付测试页面</text>
    </view>

    <view class="info-card">
      <view class="info-item">
        <text class="label">OpenID:</text>
        <text class="value">{{ openid || "正在获取..." }}</text>
      </view>

      <view class="goods-item">
        <text class="goods-title">测试商品</text>
        <text class="goods-price">¥0.01</text>
      </view>
    </view>

    <view class="action-area">
      <button class="pay-btn" @click="handlePay" :disabled="!openid || loading">
        <text v-if="loading">处理中...</text>
        <text v-else>立即支付</text>
      </button>
    </view>

    <view class="result-area" v-if="payResult">
      <view class="result-title">支付结果</view>
      <view class="result-content">
        <text>{{ payResult }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const openid = ref("")
const loading = ref(false)
const payResult = ref("")
const orderInfo = ref({
  goods_name: "测试商品",
  price: 0.01,
  order_no: "",
})

function getOpenid() {
  const { open_id } = uni.getStorageSync("data");
  openid.value = open_id;
}

function handlePay() {
  if (!openid.value) {
    uni.showToast({
      title: "OpenID未获取，无法支付",
      icon: "none",
    });
    return;
  }

  loading.value = true;
  payResult.value = "";

  uni.request({
    url: "http://test12.cc/index.php/unifiedOrder",
    method: "POST",
    data: {
      openid: openid.value,
      out_trade_no: orderInfo.value.order_no,
      body: orderInfo.value.goods_name,
      total_fee: orderInfo.value.price * 100,
      attach: "测试支付",
    },
    success: (res) => {
      if (res.data && res.data.code === 0) {
        const payParams = res.data.data;

        uni.requestPayment({
          provider: "wxpay",
          timeStamp: payParams.timeStamp,
          nonceStr: payParams.nonceStr,
          package: payParams.package,
          signType: payParams.signType,
          paySign: payParams.paySign,
          success: (res) => {
            payResult.value = "支付成功！订单号：" + orderInfo.value.order_no;
            uni.showToast({
              title: "支付成功",
              icon: "success",
            });
          },
          fail: (err) => {
            payResult.value =
              "支付失败：" + (err.errMsg || JSON.stringify(err));
            uni.showToast({
              title: "支付失败",
              icon: "none",
            });
          },
          complete: () => {
            loading.value = false;
          },
        });
      } else {
        loading.value = false;
        payResult.value =
          "统一下单失败：" + (res.data.msg || JSON.stringify(res.data));
        uni.showToast({
          title: res.data.msg || "统一下单失败",
          icon: "none",
        });
      }
    },
    fail: (err) => {
      loading.value = false;
      payResult.value =
        "统一下单请求失败：" + (err.errMsg || JSON.stringify(err));
      uni.showToast({
        title: "统一下单失败，请检查网络",
        icon: "none",
      });
    },
  });
}

onLoad(() => {
  getOpenid();
})
</script>

<style>
.payment-test-container {
  padding: 30rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  margin-bottom: 30rpx;
  padding: 20rpx 0;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.info-card {
  background-color: #fff;
  border-radius: 15rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 0 10rpx rgb(0 0 0 / 0.05);
}

.info-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1px solid #f0f0f0;
}

.label {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.value {
  font-size: 30rpx;
  color: #333;
  word-break: break-all;
}

.goods-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
}

.goods-title {
  font-size: 32rpx;
  color: #333;
}

.goods-price {
  font-size: 34rpx;
  font-weight: bold;
  color: #f50;
}

.action-area {
  margin: 50rpx 0;
}

.pay-btn {
  background-color: #07c160;
  color: #fff;
  font-size: 32rpx;
  padding: 20rpx 0;
  border-radius: 15rpx;
  width: 100%;
}

.pay-btn[disabled] {
  background-color: #aaa;
}

.result-area {
  background-color: #fff;
  border-radius: 15rpx;
  padding: 30rpx;
  margin-top: 50rpx;
}

.result-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.result-content {
  padding: 20rpx;
  background-color: #f9f9f9;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #666;
}
</style>
