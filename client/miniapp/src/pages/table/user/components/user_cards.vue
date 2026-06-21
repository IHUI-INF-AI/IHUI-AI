<template>
    <view class="money_info">
        <view class="card_items" @click="handleClick('order')">
            <view class="item-right">
                <image src="/static/images/dingdan.jpg"></image>
            </view>
            <view class="item-left">
                <view>我的订单</view>
                <view class="the-text">查看相关订单</view>
            </view>
        </view>
        <view class="card_items" @click="handleClick('distribution')">
            <view class="item-right">
                <image src="/static/images/tuandui-icon.png"></image>
            </view>
            <view class="item-left">
                <view>我的公司</view>
                <view class="the-text">查看员工与业绩</view>
            </view>
        </view>
        <view class="card_items" @click="handleClick('token')">
            <view class="item-right">
                <image src="/static/images/zhihuizhi.png"></image>
            </view>
            <view class="item-left">
                <view>我的智汇值</view>
                <view class="the-text">智汇消耗信息</view>
            </view>
        </view>
        <view class="card_items my-wallet" @click="handleClick('money')">
            <view class="wallet-icon">
                <image src="/static/images/qianbao.png"></image>
            </view>
            <view class="item-left">
                <view>我的钱包</view>
                <view class="the-text">查看余额与充值</view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { reactive } from 'vue'

const urls = reactive({
  'order': '/pages/user_order_list/index',
  'money': '/pagesA/top-up/index',
  'token': '/pages/tools/token_value',
  'model': '/pagesA/my_ai_model/index',
  'distribution': '/pagesA/distribution/index'
})

function handleClick(key) {
  const userInfodata = uni.getStorageSync('data')
  if (!userInfodata) {
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })
    return
  }
  if (urls[key]) {
    uni.navigateTo({
      url: urls[key],
    })
  }
}
</script>
<style lang="scss" scoped>
.money_info {
    display: flex;
    justify-content: space-between;
    width: 100%;
    flex-wrap: wrap;
    font-family: 'AlimamaFangYuanTi';
    margin: 0 0 0 0;

    .my-wallet {
        width: 100%;

        .wallet-icon {
            width: 90rpx;
            height: 90rpx;
            margin-right: 15rpx;

            image {
                width: 100%;
                height: 100%;
            }
        }
    }

    .card_items {
        width: calc(50vw - 47rpx);
        height: 120rpx;
        border-radius: 15rpx;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        padding: 0 10rpx 0 12rpx;
        background: rgba(0, 4, 255, 0.03);
        backdrop-filter: blur(10rpx);
        box-shadow: 4rpx 4rpx 4rpx 0px rgba(0, 0, 0, 0.07);
        margin: 0 0 14rpx 0;


        .item-left {
            font-size: 32rpx;
            color: #101010;

            .the-text {
                font-size: 26rpx;
                color: #676767;
                letter-spacing: 0px;
            }
        }

        .item-right {
            width: 90rpx;
            height: 90rpx;
            margin-right: 15rpx;

            image {
                width: 100%;
                height: 100%;
            }
        }
    }
}
</style>
