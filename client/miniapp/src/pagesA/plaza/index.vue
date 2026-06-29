<template>
  <view class="plaza_body">
    <!-- 侧边栏 -->
    <DrawerComponent 
      ref="drawerComponent" 
      :showTabbar="showTabbar" 
      :tagWrapShow="tagWrapShow" 
      :statusBarHeight="statusBarHeight"
      :groupedData="groupedData"
      :active_date="active_date" 
      :active_menu="active_menu" 
      :userinfo="userinfo" 
      :modelList="modelList" 
      @close-drawer="close_drawer"
      @go-page="gopage" 
      @go-company="gotocompany" 
      @lingqu="lingqu" 
      @add-new-chat="addNewChat"
      @show-full-list="handleShowFullList" 
      @touch-start="handleTouchStart" 
      @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd" 
      @remove-chat="removeChat" 
    />

    <!-- 遮罩层 -->
    <view class="mask-bottom" @click="closeTitleSwitcha" v-if="showBottom"></view>

    <!-- 导航栏 -->
    <view class="navbar-fixed">
      <navigation-bars 
        ref="navbar" 
        color="black" 
        :tagWrapShow="tagWrapShow" 
        :showFenLei="isShowFenlei" 
        :showMenu="!showSetPath"
        :viscosity="true"
        :isbackindex="true" 
        :title="showSetPath ? '发布需求' : 'AI需求广场'" 
        @pack="goBack" 
        :showBack="false"
        :showSetPath="showSetPath" 
        @nav-click="handleNavClick" 
        @menu-click="handleMenuClick" 
        :plazaPage="true" 
        @toSet="toSet"
        :showPlazaPublishButton="false"
        :isShowSearch="true" 
        @clicksearch="handleSearchClick"
        @setshowBottom="setshowBottom" 
        :kaifaSrc="kaifaSrc" 
        :showGonggao="false" 
      />
    </view>

    <!-- 赛道弹窗 -->
    <view class="mask" @click="closeTitleSwitch" v-if="drawerVisible"></view>
    <view class="s_t_b" v-if="drawerVisible" @click.stop>
      <view class="saidao_popup_inner">
        <ScrollTitle 
          ref="titleSwitchRef" 
          @custom-event="changeSaidao" 
          :noMore="false" 
          :tagWrapShow="true"
          :informationLists="[]" 
          :informationList="categorySaidao" 
          :information="{}" 
          :aiData="{}"
          :showNews="false" 
          :showSub="true" 
          @sub-change="subChange"
        ></ScrollTitle>
        <Tab showAll paddingLeft="24rpx" @change="tabChange"></Tab>
      </view>
    </view>

    <!-- 主内容区 -->
    <view class="plaza_main">
      <view class="navbar-placeholder" :style="{ height: topBarHeight }"></view>
      <Loading v-if="loading"></Loading>

      <!-- 广场列表 -->
      <view v-if="!showSetPath">
        <Status @change="statusChange"></Status>
        <view class="search_body">
          <SearchInput 
            :isIos="isIos" 
            :statusBarHeight="statusBarHeight" 
            :titleBarHeight="titleBarHeight" 
            @change="searchChange" 
            style="flex: 1; margin-right: 0;"
          ></SearchInput>
        </view>

        <view class="empty f_c font_nomal" v-if="dataList.length == 0">
          <text>当前赛道</text>
          <text class="font_big">千万级空白市场</text>
          <text>不会开发？发布需求</text>
          <text>快来抢占市场<text class="font_icon">!</text></text>
          <image class="image" src="https://file.aizhs.top/sys-mini/xtk/empty.png" />
        </view>

        <scroll-view v-if="dataList.length > 0" class="scroll_body" scroll-y lower-threshold="50" @scrolltolower="scrolltolower">
          <view class="item_body">
            <view class="target float" style="margin-left: 20rpx;">
              <view class="scroll_item" :class="{ 'top_item': index < 2 }" v-for="(item, index) in leftList" :key="index">
                <CardContent :info="item" @showDialog="showDialog" :itemUserInfo="userInfo"></CardContent>
              </view>
            </view>
            <view class="target float" style="margin-left: 16rpx;">
              <view class="scroll_item" :class="{ 'top_item': index < 2 }" v-for="(item, index) in rightList" :key="index">
                <CardContent :info="item" @showDialog="showDialog" :itemUserInfo="userInfo"></CardContent>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 发布需求 -->
      <SetNeed v-if="showSetPath" :categorySaidao="categorySaidaoa" @reback="reback"></SetNeed>
    </view>

    <!-- 详情弹窗 -->
    <view class="mask mask-card f_c" v-if="showCenter" @click="closeTitleSwitcha">
      <view class="show_center" v-if="showCenter" @click.stop>
        <CardContent :info="centerInfo" :itemUserInfo="userInfo" @close="showCenter = false" :categorys="categorySaidao"></CardContent>
      </view>
    </view>

    <!-- 悬浮发布按钮 -->
    <view v-if="!showSetPath" class="floating-publish-btn" @click="toSet">
      <image src="/static/images/add/publish.svg" mode="aspectFit" class="publish-icon"></image>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import DrawerComponent from '@/components/DrawerComponentall.vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import Loading from '@/components/loading/index.vue'
import CardContent from './components/card_content.vue'
import SetNeed from './set_need.vue'
import Status from './components/status.vue'
import SearchInput from '@/components/SearchInput/index.vue'
import ScrollTitle from '@/components/ScrollTitle.vue'
import Tab from './components/category-tab.vue'
import { getPlazaList } from '@/service/plaza.js'

// 数据
const loading = ref(false)
const showSetPath = ref(false)
const showSearchBox = ref(true)
const drawerVisible = ref(false)
const showCenter = ref(false)
const showBottom = ref(false)
const isShowFenlei = ref(true)
const tagWrapShow = ref(false)
const statusBarHeight = ref(0)
const titleBarHeight = ref(0)
const topBarHeight = ref('100rpx')
const isIos = ref(false)

// 用户信息
const userinfo = ref({ avatar: '', nickname: '' })
const userInfo = ref<any>({})
const modelList = ref<any[]>([])

// 列表数据
const dataList = ref<any[]>([])
const leftList = ref<any[]>([])
const rightList = ref<any[]>([])
const centerInfo = ref<any>({})

// 分类数据
const categorySaidao = ref<any[]>([])
const categorySaidaoa = ref<any[]>([])

// 侧边栏相关
const groupedData = ref<any[]>([])
const active_date = ref('0')
const active_menu = ref(0)
const showTabbar = ref(true)
const kaifaSrc = ref('')

// 搜索
const searchKeyword = ref('')

// 分页与筛选
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const currentCategory = ref('')
const currentStatus = ref('')

onMounted(() => {
  loadData()
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await getPlazaList(pageNum.value, pageSize.value, currentCategory.value, searchKeyword.value)
    if (res && (res.code === 0 || res.code === 200 || res.code === undefined)) {
      const list = Array.isArray(res.data) ? res.data : (res.data && res.data.list) || []
      total.value = res.total || (res.data && res.data.total) || list.length
      if (pageNum.value === 1) {
        dataList.value = list
      } else {
        dataList.value = [...dataList.value, ...list]
      }
      // 双列瀑布流布局
      const left: any[] = []
      const right: any[] = []
      dataList.value.forEach((item: any, index: number) => {
        if (index % 2 === 0) {
          left.push(item)
        } else {
          right.push(item)
        }
      })
      leftList.value = left
      rightList.value = right
      // 按 category 分组（侧边栏 groupedData）
      const groupMap: Record<string, any[]> = {}
      dataList.value.forEach((item: any) => {
        const cat = item.category || '默认'
        if (!groupMap[cat]) groupMap[cat] = []
        groupMap[cat].push(item)
      })
      groupedData.value = Object.keys(groupMap).map((key) => ({ title: key, list: groupMap[key] }))
      // 赛道分类（发布需求 SetNeed 使用）
      categorySaidaoa.value = Object.keys(groupMap).map((key) => ({ name: key, value: key }))
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 滚动加载
function scrolltolower() {
  if (dataList.value.length < total.value) {
    pageNum.value++
    loadData()
  }
}

// 搜索
function searchChange(value: string) {
  searchKeyword.value = value
  pageNum.value = 1
  dataList.value = []
  loadData()
}

// 状态切换
function statusChange(status: string) {
  currentStatus.value = status
  pageNum.value = 1
  dataList.value = []
  loadData()
}

// 赛道切换
function changeSaidao(item: any) {
  currentCategory.value = (item && (item.value || item.name)) || ''
  pageNum.value = 1
  dataList.value = []
  loadData()
}

function subChange(item: any) {
  // 子分类切换
}

function tabChange(item: any) {
  // Tab 切换
}

// 显示详情
function showDialog(item: any) {
  centerInfo.value = item
  showCenter.value = true
}

// 发布需求
function toSet() {
  showSetPath.value = true
}

// 返回
function reback() {
  showSetPath.value = false
  loadData()
}

// 导航栏点击
function handleNavClick() {
  drawerVisible.value = !drawerVisible.value
}

function handleMenuClick() {
  showBottom.value = !showBottom.value
}

function handleSearchClick() {
  showSearchBox.value = !showSearchBox.value
}

// 关闭弹窗
function closeTitleSwitch() {
  drawerVisible.value = false
}

function closeTitleSwitcha() {
  showCenter.value = false
  showBottom.value = false
}

// 设置弹窗
function setshowBottom(value: boolean) {
  showBottom.value = value
}

// 侧边栏相关方法
function close_drawer() {
  tagWrapShow.value = false
}

function gopage(url: string) {
  tagWrapShow.value = false
  uni.navigateTo({ url })
}

function gotocompany() {
  tagWrapShow.value = false
  uni.navigateTo({ url: '/pages/distribution/index' })
}

function lingqu() {
  tagWrapShow.value = false
}

function addNewChat() {
  tagWrapShow.value = false
  uni.navigateTo({ url: '/pages/tools/ai_assistant' })
}

function handleShowFullList() {
  // 显示完整列表
}

function handleTouchStart() {}
function handleTouchMove() {}
function handleTouchEnd() {}

function removeChat(item: any) {
  // 删除对话
}

// 返回
function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.plaza_body {
  min-height: 100vh;
  background: #f5f5f5;
}

.navbar-fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.navbar-placeholder {
  width: 100%;
}

.mask {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  z-index: 99;
}

.mask-bottom {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.3);
  z-index: 98;
}

.s_t_b {
  position: fixed;
  top: 100rpx;
  left: 0;
  right: 0;
  background: #fff;
  z-index: 101;
  padding: 20rpx;
}

.saidao_popup_inner {
  background: #fff;
  border-radius: 16rpx;
}

.plaza_main {
  padding-top: 100rpx;
}

.search_body {
  padding: 20rpx;
  background: #fff;
}

.empty {
  padding: 100rpx 40rpx;
  text-align: center;

  text {
    display: block;
    font-size: 28rpx;
    color: #999;
    margin-bottom: 16rpx;
  }

  .font_big {
    font-size: 36rpx;
    color: #333;
    font-weight: bold;
  }

  .font_icon {
    color: #ff3b30;
  }

  .image {
    width: 400rpx;
    height: 300rpx;
    margin-top: 40rpx;
  }
}

.scroll_body {
  height: calc(100vh - 300rpx);
}

.item_body {
  display: flex;
  padding: 0 20rpx;
}

.target {
  flex: 1;
}

.float {
  float: left;
}

.scroll_item {
  margin-bottom: 20rpx;

  &.top_item {
    margin-top: 20rpx;
  }
}

.f_c {
  display: flex;
  align-items: center;
  justify-content: center;
}

.font_nomal {
  font-size: 28rpx;
  color: #666;
}

.mask-card {
  z-index: 200;
}

.show_center {
  width: 90%;
  max-height: 80vh;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.floating-publish-btn {
  position: fixed;
  right: 40rpx;
  bottom: 200rpx;
  width: 100rpx;
  height: 100rpx;
  background: #007aff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgb(0 122 255 / 0.4);
  z-index: 150;

  .publish-icon {
    width: 50rpx;
    height: 50rpx;
  }
}

.identity-modal {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.identity-card {
  width: 80%;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx;
}
</style>
