<template>
  <view class="outContainer">
    <!-- 导航栏 -->
    <view style="position: fixed; left: 0; top: 0; right: 0; z-index: 999;">
      <navigationBars 
        ref="navbar" 
        :showFenLei="true" 
        :showMenu="true" 
        :viscosity="true"
        :isShowSearch="true" 
        @nav-click="handleFenLeiClick" 
        @menu-click="handleMenuClick"
        @clicksearch="handleSearchClick" 
        title="A I 应用商店" 
      />
    </view>

    <view class="main-container" style="padding-top: var(--app-top-bar-height);">
      <!-- 轮播图 -->
      <view class="custom-carousel-wrapper" style="margin: 18rpx 20rpx 0;">
        <view class="gradient-border">
          <view class="carousel-inner">
            <Carousel :banner="HomePagedata.banner_carousel" @item-click="onCarouselItemClick" />
          </view>
        </view>
      </view>

      <!-- 搜索框 -->
      <view style="padding: 20rpx;">
        <InputArea 
          v-if="showSearchBox" 
          :needBottom="false" 
          :prompt="searchText" 
          @send-message="onSearch"
          :showFile="false" 
          :isShowIcon="isShowIcon"
          :imgsList="imgsList"
          :modelName="modelName"
          :isLoading="loading"
          :placeholderStyle="placeholderStyle"
          :inputFocused="inputFocused"
          :isClear="isCleara"
          :statusBarHeight="statusBarHeight"
          :titleBarHeight="titleBarHeight"
          :textarea_int="textarea_int"
          :showSend="true"
          @toggle-voice-input="toggleVoiceInput"
          @remove-image="removeImage"
          @input-focus="handleInputFocus"
          @input-blur="handleInputBlur"
          @update:prompt="updatePrompt"
          @update:isClear="isClearaUpdate"
          ref="toogleBtn"
          :placeHolder="'请输入查找的智能体名称'"
        />
      </view>

      <!-- 最近使用 -->
      <RecentAgents :recentAgents="recentAgents" v-if="recentAgents.length > 0" />

      <!-- 我的智能体 -->
      <MyAgents :myAgents="myAgents" v-if="myAgents.length > 0" />

      <!-- 智能体列表 -->
      <view class="ailist_content" style="padding: 0 20rpx;">
        <ai-list 
          :showTitle="true" 
          :showTabbar="showTabbar" 
          :search-keyword="searchKeyword" 
          :ailist="agentList"
          :showAssistant="showAssistanta" 
          :isBottoma="isBottom" 
          :showBottom="false"
          @getAgentCollect="getAgentCollect" 
          @getAgentLike="getAgentLike" 
        />
      </view>
    </view>

    <!-- 返回顶部 -->
    <view v-if="showToodown" class="toodown-wrapper">
      <view class="toodown" @click="backToTop">
        <image class="toodownimg" src="/static/images/back.svg" mode="widthFix"></image>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '@/store/modules/user'
import request from '@/utils/service/index.js'
import NavigationBars from '@/components/navigation-bars/index.vue'
import Carousel from '@/components/Carousel/index.vue'
import InputArea from '@/components/InputArea.vue'
import RecentAgents from './components/RecentAgents.vue'
import MyAgents from './components/MyAgents.vue'
import AiList from './components/Ai-list_b.vue'

const userStore = useUserStore()

// 搜索相关
const searchText = ref('')
const searchKeyword = ref('')
const showSearchBox = ref(true)
const isShowIcon = ref(true)
const isCleara = ref(false)
const inputFocused = ref(false)

// 列表数据
const agentList = ref<any[]>([])
const recentAgents = ref<any[]>([])
const myAgents = ref<any[]>([])

// 分类数据
const agentCategory = ref<any[]>([])
const agentMainCategory = ref<any[]>([])

// 页面数据
const HomePagedata = reactive({
  banner_carousel: [] as any[],
})

// 状态
const loading = ref(false)
const isBottom = ref(false)
const showTabbar = ref(true)
const showAssistanta = ref(true)
const showToodown = ref(false)
const statusBarHeight = ref('0')
const titleBarHeight = ref('0')
const imgsList = ref<any[]>([])
const modelName = ref('')
const placeholderStyle = ref('')
const textarea_int = ref(false)

onMounted(() => {
  loadData()
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res: any = await request({
      url: '/agents/list',
      method: 'GET',
      data: { page: 1, limit: 20 },
      base: 1,
    })
    agentList.value = (res && res.data) || []
  } catch (error) {
    console.error('加载数据失败:', error)
    uni.showToast({ title: '加载智能体列表失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 搜索
function onSearch() {
  searchKeyword.value = searchText.value
}

// 语音输入
function toggleVoiceInput() {
  // 切换语音输入
}

// 移除图片
function removeImage() {
  imgsList.value = []
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

// 分类点击
function handleFenLeiClick() {
  // 打开分类面板
}

function handleMenuClick() {
  // 打开菜单
}

function handleSearchClick() {
  showSearchBox.value = true
}

// 轮播图点击
function onCarouselItemClick(item: any) {
  console.log('轮播图点击:', item)
}

// 收藏
function getAgentCollect(agent: any) {
  console.log('收藏智能体:', agent)
}

// 点赞
function getAgentLike(agent: any) {
  console.log('点赞智能体:', agent)
}

// 返回顶部
function backToTop() {
  uni.pageScrollTo({ scrollTop: 0, duration: 300 })
}
</script>

<style lang="scss" scoped>
.outContainer {
  min-height: 100vh;
  background: #f5f5f5;
}

.main-container {
  padding-bottom: 120rpx;
}

.custom-carousel-wrapper {
  margin-bottom: 20rpx;
}

.gradient-border {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  padding: 2rpx;
}

.carousel-inner {
  background: #fff;
  border-radius: 14rpx;
  overflow: hidden;
}

.ailist_content {
  margin-top: 20rpx;
}

.toodown-wrapper {
  position: fixed;
  right: 30rpx;
  bottom: 200rpx;
  z-index: 100;
}

.toodown {
  width: 80rpx;
  height: 80rpx;
  background: rgb(0 0 0 / 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toodownimg {
  width: 40rpx;
  height: 40rpx;
  transform: rotate(180deg);
}
</style>
