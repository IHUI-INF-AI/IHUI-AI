<template>
  <view class="main-container">
    <!-- 导航栏 -->
    <navigation-bars 
      :viscosity="true" 
      color="#171717" 
      font-size-30 
      title="我邀请的团队" 
      @pack="backPage"
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'" 
      :isShowSearch="true" 
      @clicksearch="handleSearchClick" 
    />

    <view style="padding: 20rpx;">
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
          :placeHolder="'搜索我的团友'"
          :padding="0"
        />
      </view>

      <!-- 团队统计 -->
      <view class="team-total">
        团队总人数: <text style="font-weight: bold; margin-left: 10rpx;">{{ teamTotal }}</text>
      </view>

      <!-- Tab 切换 -->
      <view class="bar_body" style="margin: 0;">
        <view class="function_buttons_container">
          <view class="function_button" :class="{ active: activeTab === '成交订单数' }" @click="switchTab('成交订单数')">
            <text class="button_text">成交订单数</text>
          </view>
          <picker mode="date" :value="selectedDate" @change="onDateChange">
            <view class="function_button" style="width: 100%;" :class="{ active: activeTab === '邀请时间' }">
              <text class="button_text">{{ selectedDate || '邀请时间' }}</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 用户列表 -->
      <scroll-view class="user-list" scroll-y @scrolltolower="scrolltolower">
        <view class="no-result" v-if="teamList.length === 0">
          <text>没有找到相关用户</text>
        </view>

        <view class="person-card" v-for="(member, index) in teamList" :key="member.id">
          <view class="medal">
            <image class="medal-img" :src="`https://file.aizhs.top/sys-mini/No${index + 1}@3x.png`" />
          </view>
          <view class="person-left">
            <view class="avatar-wrap">
              <image 
                v-if="member.avatar" 
                class="avatar" 
                :src="member.avatar" 
                mode="aspectFill"
              ></image>
              <image 
                v-else 
                class="avatar"
                src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/user/act.png" 
                mode="aspectFill" 
              />
            </view>
          </view>
          <view class="person-right">
            <view class="person-name">{{ member.nickname || '用户' }}</view>
            <view class="person-info">邀请时间：{{ member.inviteTime || '未知' }}</view>
            <view class="person-info">成交订单数：{{ member.orderCount || 0 }}</view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

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
const activeTab = ref('成交订单数')
const selectedDate = ref('')

// 列表数据
const teamList = ref<any[]>([])
const teamTotal = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)

onMounted(() => {
  loadTeamList()
})

// 加载团队列表
async function loadTeamList() {
  try {
    // TODO: 调用 API 加载团队列表
    // const res = await getTeamList({ pageNum: pageNum.value, pageSize: pageSize.value })
    // teamList.value = res.list || []
    // teamTotal.value = res.total || 0
  } catch (error) {
    console.error('加载团队列表失败:', error)
  }
}

// 搜索
function onSearch() {
  searchKeyword.value = searchText.value
  teamList.value = []
  pageNum.value = 1
  loadTeamList()
}

// Tab 切换
function switchTab(tab: string) {
  activeTab.value = tab
  teamList.value = []
  pageNum.value = 1
  loadTeamList()
}

// 日期切换
function onDateChange(e: any) {
  selectedDate.value = e.detail.value
  teamList.value = []
  pageNum.value = 1
  loadTeamList()
}

// 滚动加载
function scrolltolower() {
  pageNum.value++
  loadTeamList()
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

// 返回上一页
function backPage() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.main-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.team-total {
  font-size: 28rpx;
  color: #666;
  padding: 20rpx 0;
}

.bar_body {
  padding: 20rpx 0;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
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
  font-size: 26rpx;
}

.user-list {
  height: calc(100vh - 400rpx);
}

.no-result {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
}

.person-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;

  .medal {
    width: 60rpx;
    margin-right: 16rpx;

    .medal-img {
      width: 60rpx;
      height: 60rpx;
    }
  }

  .person-left {
    margin-right: 20rpx;

    .avatar-wrap {
      .avatar {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
      }
    }
  }

  .person-right {
    flex: 1;

    .person-name {
      font-size: 30rpx;
      font-weight: bold;
      color: #333;
      margin-bottom: 8rpx;
    }

    .person-info {
      font-size: 24rpx;
      color: #999;
      margin-bottom: 4rpx;
    }
  }
}
</style>
