<template>
  <view class="page-container">
    <!-- 导航栏 -->
    <navigation-bars 
      color="black" 
      :viscosity="true"
      :title="'我的订单'" 
      @pack="goBack"
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" 
      @nav-click="handleNavClick" 
      :isShowSearch="true" 
      @clicksearch="handleSearchClick" 
    />

    <view style="padding: 0 20rpx 24rpx;">
      <!-- Tab 列表 -->
      <StudyBar :barList="tabList" @change="handleTabChange" />

      <!-- 搜索栏 -->
      <view style="margin-bottom: 18rpx;" v-if="showSearchBox">
        <InputArea 
          :needBottom="false"
          :prompt="searchText" 
          @send-message="onSearch" 
          :showFile="false"
          :isShowIcon="false"
          :imgsList="[]"
          :modelName="''"
          :isLoading="false"
          :inputFocused="inputFocused"
          :isClear="isCleara"
          :statusBarHeight="statusBarHeight"
          :titleBarHeight="titleBarHeight"
          :textarea_int="textarea_int"
          :showSend="true"
          @input-focus="handleInputFocus"
          @input-blur="handleInputBlur"
          @update:prompt="updatePrompt"
          @update:isClear="isClearaUpdate"
          :placeHolder="'搜索我的订单'"
        />
      </view>

      <!-- 订单列表 -->
      <view class="content-list" style="margin-top: 0;">
        <block v-if="orderList.length > 0">
          <view v-for="(item, idx) in filteredList" :key="item.id">
            <view class="content-card" :class="['card-' + getStatusType(item.status)]">
              <view class="card-header">
                <text class="order-no">订单号：<text>{{ item.outTradeNo }}</text></text>
                <view class="order-status" :class="'status-' + getStatusType(item.status)">
                  {{ getStatusText(item.status) }}
                </view>
              </view>
              <view class="card-body">
                <image v-if="item.images" :src="item.images" class="card-img" mode="aspectFill"></image>
                <view v-else class="card-img"></view>
                <view class="card-info">
                  <view class="card-title">{{ item.productName }}</view>
                  <view class="card-desc">{{ item.productName }}</view>
                </view>
              </view>
              <view class="card-bottom-row">
                <view class="card-time">
                  <view>
                    <text class="time-label">下单时间：</text>
                    <text class="time-value">{{ formatTimestamp(item.createdAt) }}</text>
                  </view>
                </view>
                <view class="card-price">
                  <text class="price">¥{{ (item.amount / 100).toFixed(2) }}</text>
                </view>
              </view>
            </view>
          </view>
        </block>
        <view v-else class="empty-state">
          <text>暂无订单数据</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 搜索相关
const searchText = ref('')
const searchKeyword = ref('')
const showSearchBox = ref(true)
const inputFocused = ref(false)
const isCleara = ref(false)
const statusBarHeight = ref(0)
const titleBarHeight = ref(0)
const textarea_int = ref('')

// Tab 相关
const currentTab = ref(0)
const tabList = ref([
  { id: 0, name: '全部' },
  { id: 1, name: '待支付' },
  { id: 2, name: '已完成' },
  { id: 3, name: '已取消' },
])

// 订单数据
const orderList = ref<any[]>([])

// 过滤后的订单列表
const filteredList = computed(() => {
  if (currentTab.value === 0) return orderList.value
  return orderList.value.filter(item => item.status === currentTab.value)
})

onMounted(() => {
  loadOrders()
})

// 加载订单列表
async function loadOrders() {
  try {
    // TODO: 调用 API 加载订单列表
    // const res = await getOrderList()
    // orderList.value = res.list || []
  } catch (error) {
    console.error('加载订单列表失败:', error)
  }
}

// 获取状态类型
function getStatusType(status: number) {
  const statusMap: Record<number, string> = {
    0: 'pending',
    1: 'paid',
    2: 'completed',
    3: 'cancelled',
  }
  return statusMap[status] || 'pending'
}

// 获取状态文本
function getStatusText(status: number) {
  const statusMap: Record<number, string> = {
    0: '待支付',
    1: '已支付',
    2: '已完成',
    3: '已取消',
  }
  return statusMap[status] || '未知'
}

// 格式化时间戳
function formatTimestamp(timestamp: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// Tab 切换
function handleTabChange(tabId: number) {
  currentTab.value = tabId
}

// 搜索
function onSearch() {
  searchKeyword.value = searchText.value
}

// 搜索点击
function handleSearchClick() {
  showSearchBox.value = !showSearchBox.value
}

// 输入焦点
function handleInputFocus() {
  inputFocused.value = true
}

function handleInputBlur() {
  inputFocused.value = false
}

// 更新提示词
function updatePrompt(value: string) {
  searchText.value = value
}

function isClearaUpdate(value: boolean) {
  isCleara.value = value
}

// 导航点击
function handleNavClick() {
  // 导航操作
}

// 返回上一页
function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.content-list {
  margin-top: 20rpx;
}

.content-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.order-no {
  font-size: 26rpx;
  color: #999;
}

.order-status {
  font-size: 24rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;

  &.status-pending {
    background: #fff3cd;
    color: #856404;
  }

  &.status-paid {
    background: #d4edda;
    color: #155724;
  }

  &.status-completed {
    background: #d1ecf1;
    color: #0c5460;
  }

  &.status-cancelled {
    background: #f8d7da;
    color: #721c24;
  }
}

.card-body {
  display: flex;
  margin-bottom: 20rpx;
}

.card-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 8rpx;
  margin-right: 20rpx;
  background: #f5f5f5;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.card-desc {
  font-size: 26rpx;
  color: #999;
}

.card-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1rpx solid #f0f0f0;
  padding-top: 20rpx;
}

.card-time {
  font-size: 24rpx;
  color: #999;
}

.time-label {
  margin-right: 8rpx;
}

.card-price {
  .price {
    font-size: 32rpx;
    font-weight: bold;
    color: #ff3b30;
  }
}

.empty-state {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
