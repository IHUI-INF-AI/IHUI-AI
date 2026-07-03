<template>
  <view class="main-container">
    <navigation-bars :viscosity="true" color="#171717" font-size-30 title="分销订单列表" @pack="backPage"
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" :isShowSearch="true" @clicksearch="handleSearchClick" />
    <view style="padding: 20rpx;">
      <view style="margin-bottom: 18rpx;" v-if="showSearchBox">
        <InputArea 
          :needBottom="false" 
          :isIOS="isIOS" 
          :prompt="searchText" 
          @send-message="onSearch" 
          :showFile="false"
          :isShowIcon="false"
          :imgsList="[]"
          :modelName="''"
          :isVoiceAnimationActive="false"
          :isVoiceInput="false"
          :isLoading="false"
          :inputFocused="inputFocused"
          :isVoiceAnimationActiveStart="false"
          :isClear="isCleara"
          :statusBarHeight="statusBarHeight"
          :titleBarHeight="titleBarHeight"
          :textarea_int="textarea_int"
          :showSend="true"
          @input-focus="handleInputFocus"
          @input-blur="handleInputBlur"
          @input-click="handleInputClick"
          @update:prompt="updatePrompt"
          @update:isClear="isClearaUpdate"
          :placeHolder="'搜索我的分销订单，订单号或名称'"
        />
      </view>
      <StudyBar :barList="tabs" @change="handleTabChange" />
      <view class="team-total">共{{ filteredOrders.length }}笔分销订单,佣金总额：{{ amountCount }}</view>

      <view class="order-list">
        <template v-if="filteredOrders.length > 0">
          <view class="order-card" v-for="(order, index) in filteredOrders" :key="index">
            <view class="order-card-header">
              <view>
                <text class="order-label">关联订单号：</text>
                <text class="order-value">{{ order.outTradeNo }}</text>
              </view>
              <view class="order-status-group">
                <text class="order-status-finish" :class="{
                  'status-pending': order.orderStatus === 0,
                  'status-settled': order.orderStatus === 1,
                  'status- canceled': order.orderStatus === 2
                }">{{ statusText(order.orderStatus) }}</text>
              </view>
              <view class="order-status-settled" :class="{
                'pending': order.orderStatus === 0,
                'finished': order.orderStatus === 1
              }">{{ statusText2(order.status) }}</view>
            </view>
            <view class="order-card-user">
              <text class="order-label">买家用户：</text>
              <text class="order-value">{{ order.nickname }}</text>
            </view>
            <view class="order-card-main">
              <image class="order-product-img" :src="order.images" mode="aspectFill" />
              <view class="order-product-info">
                <view class="order-product-title">{{ order.productName }}</view>
              </view>
            </view>
            <view class="order-product-price">¥{{ order.orderAmount/100 }}</view>
            <view class="order-card-footer">
              <view>
                <text class="order-label">下单时间：</text>
                <text class="order-value">{{ formatTime(order.time) }}</text>
              </view>
              <view class="order-commission">
                <text class="order-label">本单佣金</text>
                <text class="order-commission-amount">￥{{ order.amount.toFixed(2) }}</text>
              </view>
            </view>
          </view>
        </template>

        <view v-else class="empty-state">
          <text>暂无订单数据</text>
        </view>

      </view>
    </view>
  </view>

</template>

<script setup>
import { ref, computed } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import StudyBar from "@/components/study/bar.vue";
import InputArea from '@/components/InputArea.vue';
import { getflowList } from "@/service/trader.js";

const amountCount = ref(0)
const currentTab = ref("all")
const searchKeyword = ref("")
const searchText = ref("")
const originalOrders = ref([])
const tabs = ref([
  { name: "全部", value: "all" },
  { name: "待结算", value: "0" },
  { name: "退单", value: "1" },
  { name: "已完成", value: "2" },
])
const orders = ref([])
const isIOS = ref(false)
const inputFocused = ref(false)
const isCleara = ref(false)
const textarea_int = ref(true)
const showSearchBox = ref(false)
let _searchTimer = null

const statusBarHeight = computed(() => {
  return 0
})

const titleBarHeight = computed(() => {
  return 0
})

const indicatorStyle = computed(() => {
  const index = tabs.value.findIndex((tab) => tab.value === currentTab.value);
  const width = 100 / tabs.value.length;
  return {
    width: width + "%",
    transform: `translateX(${index * 100}%)`,
  };
})

const filteredOrders = computed(() => {
  return orders.value;
})

const handleSearchClick = () => {
  showSearchBox.value = !showSearchBox.value;
}

const handleTabChange = (item) => {
  currentTab.value = item.value;
  updateDisplayList();
}

const statusText2 = (status) => {
  const statusMap = {
    0: "未提现",
    1: "已提现",
    2: "审批中"
  };
  return statusMap[status] || "未知状态";
}

const statusText = (status) => {
  const statusMap2 = {
    0: "未结算",
    1: "退单",
    2: "已完成"
  };
  return statusMap2[status] || "未知状态";
}

const getStatusClass = (status) => {
  const statusClassMap = {
    0: "pending",
    1: "canceled",
    2: "settled"
  };
  return statusClassMap[status] || "pending";
}

const formatTime = (timestamp) => {
  if (!timestamp) return '';

  const ts = String(timestamp).length === 10
    ? Number(timestamp) * 1000
    : Number(timestamp);

  const date = new Date(ts);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

const onSearch = (text) => {
  searchText.value = text || '';
  searchKeyword.value = text || '';
  if (!text || (typeof text === 'string' && text.trim() === '')) {
    searchText.value = '';
    searchKeyword.value = '';
  }
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    updateDisplayList();
  }, 500);
}

const updatePrompt = (newValue) => {
  searchText.value = newValue;
  searchKeyword.value = newValue;
  if (!newValue || (typeof newValue === 'string' && newValue.trim() === '')) {
    searchText.value = '';
    searchKeyword.value = '';
  }
}

const handleInputFocus = () => {
  inputFocused.value = true;
}

const handleInputBlur = () => {
  inputFocused.value = false;
}

const handleInputClick = () => {
}

const isClearaUpdate = (newVal) => {
  isCleara.value = newVal;
}

const updateDisplayList = () => {
  let result = [...originalOrders.value];

  if (searchKeyword.value || searchText.value) {
    const keyword = (searchKeyword.value || searchText.value).toLowerCase();

    let statusFilter = null;
    if (keyword === "未结算" || keyword === "待结算") {
      statusFilter = "0";
    } else if (keyword === "退单") {
      statusFilter = "1";
    } else if (keyword === "已完成") {
      statusFilter = "2";
    }

    result = result.filter(order =>
      order.outTradeNo?.toLowerCase().includes(keyword) ||
      order.nickname?.toLowerCase().includes(keyword) ||
      order.productName?.toLowerCase().includes(keyword) ||
      String(order.orderAmount || '')?.includes(keyword) ||
      String(order.amount || '')?.includes(keyword) ||
      formatTime(order.time)?.toLowerCase().includes(keyword) ||
      (statusFilter && order.orderStatus.toString() === statusFilter) ||
      statusText(order.orderStatus).includes(keyword)
    );
  }

  if (currentTab.value !== "all") {
    result = result.filter(order => order.orderStatus.toString() === currentTab.value);
  }

  orders.value = result;
}

const listOrder = () => {
  const token = uni.getStorageSync("data").uuid;
  getflowList(token).then((res) => {
    amountCount.value = res.amountCount;
    originalOrders.value = res.data || [];
    updateDisplayList();
  });
}

const backPage = () => {
}

listOrder()
</script>

<style lang="less" scoped>
::v-deep .input-area {
  padding: 0 !important;
}

.main-container {
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
}


.tab-container {
  display: flex;
  width: 95%;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  background-color: #f6f6f6;
  height: 80rpx;
  margin: 20rpx auto;
  font-weight: bolder;
}
.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 80rpx;
  background-color: #93d2f3;
  border-radius: 0;
  transition: transform 0.3s ease;
  z-index: 0;
}

.order-list {
  height: calc(100vh - 200rpx);
  flex: 1;
  overflow-y: auto;
}

.order-card {
  position: relative;
  padding: 24rpx 24rpx 24rpx 24rpx;
  background: linear-gradient(114deg, rgba(205, 208, 255, 0.3) 3%, rgba(253, 255, 225, 0.3) 104%);
  border-color: rgba(251, 255, 203, 0.08);
  backdrop-filter: blur(10px);
  box-shadow: 0px 0 2px 0px rgba(0, 0, 0, 0.3);
  border-radius: 30rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
  font-size: 28rpx;
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.order-label {
  color:#3D3D3D;
  font-size: 28rpx;
}

.order-value {
  color: #3D3D3D;
  font-size: 28rpx;
}

.order-status-group {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.order-status-finish {
  color: #000000;
  font-size: 26rpx;
  border-radius: 8rpx;
  padding: 4rpx 20rpx;
}

.order-status-settled {
  font-size: 26rpx;
  margin-left: 0;
  position: absolute;
}
.order-status-settled.pending{
  color: #FF0B0B;
}
.order-status-settled.finished{
  color: #00B578;
}
.order-card-user {
  margin: 12rpx 0 0 0;
  font-size: 28rpx;
  color: #888;
}

.order-card-main {
  display: flex;
  align-items: center;
  margin: 24rpx 0 0 0;
}

.order-product-img {
  width: 130rpx;
  height: 130rpx;
  border-radius: 15rpx;
  background: #f0f0f0;
  margin-right: 24rpx;
}

.order-product-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.order-product-title {
  font-size: 32rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.order-product-price {
  font-size: 32rpx;
  color: #000;
  font-weight: bold;
  position: absolute;
  right: 20rpx;
  top: 65%;
}

.order-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
}

.order-commission {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.order-commission-amount {
  color: #e94d3a;
  font-size: 36rpx;
  font-weight: bold;
  margin-left: 8rpx;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200rpx;
  color: #999;
}


.order-tab-bar {
  border-radius: 8px;
  background: linear-gradient(111deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
  margin-top: 16rpx;
  overflow: hidden;
}

.tab-list {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.tab-item-wrap {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-width: 0;
}

.tab-item {
  width: 100%;
  text-align: center;
  font-size: 36rpx;
  color: #333;
  padding: 20rpx 10rpx;
}

.tab-item.active {
  background: linear-gradient(311deg, #FFF59E -13%, #DEE2FF 47%, #ACB4FF 115%);
}

.tab-divider {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2rpx;
  height: 48rpx;
  background: #e0e0e0;
  z-index: 1;
  pointer-events: none;
}
.team-total {
  color: #3D3D3D;
  margin: 16rpx 0;
  font-size: 30rpx;
}
.status-pending {
  background-color: #73C269;
}

.status-settled {
  background-color: #FCD8A7;
}

.status-canceled {
  background-color: #4ea153;
}
.order-status-settled{
  position: absolute;
  right: 30rpx;
  top: 22%;
}
.no-more-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.line {
  flex: 1;
  height: 1rpx;
  background-color: #e0e0e0;
}

.no-more-text {
  margin: 0 20rpx;
  color: #767676;
  font-size: 24rpx;
}
</style>
