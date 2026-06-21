<template>
  <view class="commission-container">
    <!-- 佣金总额 -->
    <view class="commission-card">
      <view class="commission-left">
        <view class="title">累计佣金</view>
        <view class="main-amount">
          <text class="amount-highlight">{{ totalEarnings }}</text>
          <text class="unit">元</text>
        </view>
        <view class="row">
          <text>可提现佣金</text>
          <text class="amount-highlight">{{ available }}</text>
          <text class="unit">元</text>
        </view>
        <view class="row">
          <text>已提现佣金</text>
          <text class="amount-highlight">{{ withdrawn }}</text>
          <text class="unit">元</text>
        </view>
        <view class="row">
          <text>待结算佣金</text>
          <text class="amount-highlight">{{ pending }}</text>
          <text class="unit">元</text>
        </view>
      </view>
      <view class="commission-right">
        <view class="today-row">
          <text>今日佣金</text>
          <text class="amount-highlight">{{ today }}</text>
          <text class="unit">元</text>
        </view>
        <button class="withdraw-btn" @click="
        ">提现</button>
        <view class="withdraw-detail" @click="onDetail">提现明细</view>
      </view>
    </view>

    <!-- Tab 列表 -->
    <view class="order-tab-bar">
      <view class="tab-list">
        <view v-for="(tab, idx) in tabList" :key="tab.id" :class="['tab-item', { active: idx === activeTab }]"
          @click="activeTab = idx">
          {{ tab.name }}
          <view v-if="idx !== tabList.length - 1"></view>
        </view>
      </view>
    </view>

    <!-- 佣金明细列表 -->
    <view class="commission-list">
      <view class="list-item" v-for="item in lists" :key="item.id">
        <view class="item-left">
          <text class="status pending"><text>佣金</text><text style="margin-left: 20rpx">待结算</text>
            <text style="position: obsolute; margin-left: 370rpx">¥{{ item.amount }}</text>
          </text>
          <text class="order-user">下单人：{{ item.buyer_nickname }}</text>
          <text class="order-id">下单时间:{{ happenTimeFun(item.time) }}</text>
          <text class="order-id">关联订单：{{ item.out_trade_no }}</text>
        </view>
        <button class="copy-btn" @click="copyOrderId(item.order_id)">
          复制
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { happenTimeFun, formatFullTime } from "@/utils/time.js";

const props = defineProps({
  today_commission: {
    type: Number,
    default: "",
  },
  total_earnings: {
    type: Number,
    default: "",
  },
  balance: {
    type: Number,
    default: "",
  },
  lists: {
    type: Array,
    default: () => [],
  },
})

const isShow = ref(true)
const activeTabIndex = ref(0)
const center = ref([
  { id: 1, price: 6470.68, name: "王丽丽", order: "Y1241022141153950429dd" },
  { id: 2, price: 6470.68, name: "王丽丽", order: "Y1241022141153950429ss" },
  { id: 3, price: 6470.68, name: "王丽丽", order: "Y1241022141153950429tt" },
  { id: 4, price: 6470.68, name: "王丽丽", order: "Y12410221411539504291sds" },
  { id: 5, price: 6470.68, name: "王丽丽", order: "Y1241022141153950429sq" },
])
const tabs = ref([
  { name: "全部", content: "佣金明细", active: true },
  { name: "待结算", content: "待结算", active: true },
  { name: "已结算", content: "已结算", active: true },
  {
    name: "取消结算",
    icon: "https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/icon1.png",
    content: "取消结算",
    active: true,
  },
])
const tabList = ref([
  { id: 1, name: '全部' },
  { id: 2, name: '待结算' },
  { id: 4, name: '已结算' },
  { id: 5, name: '取消结算' }
])
const activeTab = ref(0)
const totalEarnings = ref('188.84')
const today = ref('100.00')
const available = ref('78.84')
const withdrawn = ref('100.00')
const pending = ref('10.00')

const handleWithdraw = () => {
  uni.showToast({
    title: "提现申请已提交",
    icon: "success",
  });
}

const handleDetail = () => {
  uni.navigateTo({
    url: "/pages/income/withdraw/index",
  });
}

const copyOrderId = (orderId) => {
  uni.setClipboardData({
    data: String(orderId),
    success: () => {
      uni.showToast({ title: "已复制订单号" });
    },
    fail: (err) => {
    },
  });
}

const switchTab = (index) => {
  activeTabIndex.value = index;
  tabs.value.forEach((tab, i) => {
    tab.active = i === index;
  });
}

const onWithdraw = () => {
}

const onDetail = () => {
}
</script>

<style>
.commission-container {
  height: 100%;
  padding: 20rpx 20rpx 40rpx 20rpx;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
}

.time {
  font-size: 28rpx;
  color: #333;
}

.status-icons {
  display: flex;
  gap: 15rpx;
}

.status-icon {
  width: 30rpx;
  height: 30rpx;
  margin-left: 10rpx;
  margin-top: -10rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin: 30rpx 0;
}

.commission-card {
  margin: 24rpx auto;
  background: linear-gradient(180deg, #cfd6fa 0%, #fff 100%);
  border-radius: 30rpx;
  box-shadow: 0 0 16rpx rgba(186, 202, 255, 0.12);
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 32rpx 32rpx 24rpx 32rpx;
  position: relative;
  border-bottom: 6rpx solid #ffd86b;
}

.commission-left {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10rpx;
}

.title {
  font-size: 28rpx;
  color: #444;
  margin-bottom: 8rpx;
}

.main-amount {
  font-size: 44rpx;
  font-weight: bold;
  color: #ff9800;
  margin-bottom: 8rpx;
  display: flex;
  align-items: baseline;
}

.amount-highlight {
  color: #ff9800;
  font-size: 38rpx;
  font-weight: bold;
  margin: 0 4rpx;
}

.unit {
  color: #444;
  font-size: 26rpx;
  margin-left: 2rpx;
}

.row {
  font-size: 28rpx;
  color: #444;
  margin-bottom: 2rpx;
  display: flex;
  align-items: baseline;
}

.commission-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 16rpx;
  margin-left: 24rpx;
}

.today-row {
  font-size: 28rpx;
  color: #444;
  margin-bottom: 18rpx;
  display: flex;
  align-items: baseline;
}

.withdraw-btn {
  color: #fff;
  border-radius: 30rpx;
  font-size: 28rpx;
  padding: 0 40rpx;
  height: 56rpx;
  line-height: 56rpx;
  margin-bottom: 8rpx;
  margin: 0;
  box-shadow: 0 0 8rpx rgba(186, 202, 255, 0.12);
  background: linear-gradient(0deg, #8278F0 38%, rgba(88, 78, 203, 0) 100%);
  box-sizing: border-box;
  border: 1px solid #8D88C5;
}

.withdraw-detail {
  color: #4D45A8;
  font-size: 24rpx;
  text-align: center;
  margin-top: 0;
  margin-right: 20rpx;
}

.commission-summary {
  border-radius: 15rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  background: linear-gradient(180deg, #f9fbff 0%, #bfd9ff 100%);
}

.withdrawn,
.pending {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.tabs {
  display: flex;
  justify-content: space-between;
  background: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/yongjin/juxing5Copy2@2x.png");
  border-radius: 15rpx;
  margin-bottom: 20rpx;
}

.tab {
  width: 25%;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  color: #333;
}

.tab.active {
  text-align: center;
  color: #fff;
  color: #2979ff;
  border-radius: 15rpx;
}

.commission-list {
  border-radius: 15rpx;
  padding: 10rpx 0 0 0;
  border-radius: 15rpx;
  margin-bottom: 20rpx;
}

.total-summary {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 20rpx;
  border-bottom: 1rpx solid #eee;
  margin-bottom: 20rpx;
  border-radius: 20rpx;
  background: linear-gradient(180deg, #f9fbff 4%, #bfd9ff 65%, #9cc4ff 100%);
}

.item-left {
  flex: 1;
}

.status {
  font-size: 28rpx;
  margin-bottom: 10rpx;
  display: block;
}

.status.pending {
  color: #ff9900;
}

.status.completed {
  color: #19be6b;
}

.status.canceled {
  color: #ed3f14;
}

.order-user,
.order-id {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 5rpx;
}

.copy-btn {
  background-color: #f5f5f5;
  color: #333;
  font-size: 24rpx;
  padding: 0 20rpx;
  height: 50rpx;
  line-height: 50rpx;
  border-radius: 30rpx;
  border: none;
  position: absolute;
  margin-top: 125rpx;
  margin-left: 410rpx;
}

.status-icon {
  height: 45rpx;
  width: 45rpx;
  margin-right: 10rpx;
}

.order-tab-bar {
  width: 92vw;
  margin: 24rpx auto 0 auto;
  background: linear-gradient(90deg, #f6f7fa 0%, #eceafd 100%);
  border-radius: 30rpx;
  padding: 0 0;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-list {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 80rpx;
  align-items: center;
  justify-content: space-between;
  border-radius: 30rpx;
  overflow: hidden;
  background: rgba(206, 203, 241, 0.5);

}

.tab-item {
  flex: 1;
  text-align: center;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 30rpx;
  color: #888;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-item.active {
  background: #CECBF1;
  color: #3D3D3D;
}
</style>
