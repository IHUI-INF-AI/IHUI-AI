<template>
  <view class="outContainer">
    <!-- 导航栏 -->
    <navigation-bars 
      color="black" 
      :viscosity="true" 
      title="我的智汇值" 
      @pack="backPage"
      :image="'/static/images/back.svg'" 
    />

    <!-- 功能按钮 -->
    <view class="bar_body" style="margin: 0;">
      <view class="function_buttons_container">
        <view class="function_button" :class="{ active: activeButton === 'agent' }" @click="takeAgent">
          <text class="button_text">智能体消耗</text>
        </view>
        <view class="function_button" :class="{ active: activeButton === 'orders' }" @click="takeOrders">
          <text class="button_text">大模型消耗</text>
        </view>
      </view>
    </view>

    <!-- Tab 栏 -->
    <view class="bar_body">
      <TabBar :barList="barList" @change="onTabChange"></TabBar>
    </view>

    <!-- 列表 -->
    <scroll-view class="scroll_body" scroll-y lower-threshold="50" @scrolltolower="scrolltolower">
      <view v-if="zhList.length === 0" style="color: #666; text-align: center;">暂无智汇值消耗记录</view>
      <view class="scroll_item" v-for="(item, index) in zhList" :key="index">
        <view class="title">{{ item.agentName }}</view>
        <view class="content">
          <view class="value">花费时间： {{ item.create_at }}</view>
          <view class="count">-{{ item.token }}</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import TabBar from '@/components/study/bar.vue'
import { getZHZ, getZHZDMX } from '@/service/pay.js'

// 数据
const barList = ref([
  { name: '7天', value: 'w' },
  { name: '一个月', value: 'm' },
  { name: '近一年', value: 'y' },
  { name: '全部', value: 'a' },
])

const zhList = ref<any[]>([])
const uuid = ref('')
const type = ref('w')
const pageNum = ref(1)
const total = ref(0)
const orderType = ref(0)
const activeButton = ref('agent')

onMounted(() => {
  let userData = uni.getStorageSync('data')
  if (!userData) {
    userData = uni.getStorageSync('userInfo')
  }
  uuid.value = (userData || {}).uuid || ''
  getData()
})

// 获取数据
async function getData() {
  try {
    const res = await getZHZ({
      uuid: uuid.value,
      type: type.value,
      pageNum: pageNum.value,
      orderType: orderType.value,
    })
    if (res && res.data) {
      if (pageNum.value === 1) {
        zhList.value = res.data.list || []
      } else {
        zhList.value = [...zhList.value, ...(res.data.list || [])]
      }
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('获取数据失败:', error)
  }
}

// 切换智能体消耗
function takeAgent() {
  activeButton.value = 'agent'
  zhList.value = []
  pageNum.value = 1
  type.value = 'w'
  orderType.value = 0
  getData()
}

// 切换大模型消耗
function takeOrders() {
  activeButton.value = 'orders'
  zhList.value = []
  pageNum.value = 1
  type.value = 'w'
  orderType.value = 1
  getData()
}

// Tab 切换
function onTabChange(value: string) {
  type.value = value
  zhList.value = []
  pageNum.value = 1
  getData()
}

// 滚动加载
function scrolltolower() {
  if (zhList.value.length < total.value) {
    pageNum.value++
    getData()
  }
}

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.outContainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.bar_body {
  padding: 20rpx;
  background: #fff;
}

.function_buttons_container {
  display: flex;
  justify-content: space-around;
}

.function_button {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 10rpx;
  background: #f5f5f5;
  margin: 0 10rpx;

  &.active {
    background: #007aff;
    color: #fff;
  }
}

.button_text {
  font-size: 28rpx;
}

.scroll_body {
  height: calc(100vh - 300rpx);
  padding: 20rpx;
}

.scroll_item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .title {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 16rpx;
  }

  .content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .value {
      font-size: 26rpx;
      color: #999;
    }

    .count {
      font-size: 30rpx;
      color: #ff3b30;
      font-weight: bold;
    }
  }
}
</style>
