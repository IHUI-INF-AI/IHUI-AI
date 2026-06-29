<template>
  <view class="outContainer">
    <!-- 页面滚动锁定覆盖层 -->
    <!-- 侧边栏只受 drawerVisible 控制，不再跟随分类弹层 -->
    <DrawerComponent ref="drawerComponent" :showTabbar="showTabbar" :tagWrapShow="drawerVisible" :statusBarHeight="statusBarHeight" :groupedData="groupedData"
      :active_date="active_date" :active_menu="active_menu" :userinfo="userinfo" :modelList="modelList" @close-drawer="close_drawer"
      @go-page="gopage" @go-company="gotocompany" @lingqu="lingqu" @add-new-chat="addNewChat"
      @show-full-list="handleShowFullList" @touch-start="handleTouchStart" @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd" @remove-chat="removeChat" />
    <rankings :statusBarHeight="statusBarHeight" v-if="!activeNavbar" @active_nav="activeNav"></rankings>
    <view v-if="activeNavbar" class="main-container" :class="{ 'no-scroll': tagWrapShow }" style="min-height: 110vh; color: #333;">
      <float-box ref="floatBoxRef" />
      <!-- 分类按钮只控制 tagWrapShow（分类弹层），菜单按钮只控制 drawerVisible（侧边栏） -->
      <navigation-bars
        ref="navbar"
        :showFenLei="true"
        :showMenu="true"
        :viscosity="true"
        :tagWrapShow="tagWrapShow"
        :categoryActive="categoryActive"
        @nav-click="handleNavClick"
        @menu-click="handleMenuClick"
        title="AI资讯"
        :backgroundColor="'#ffffff'"
        @active_nav="activeNav"
        :statusBarHeight="statusBarHeight"
        :titleBarHeight="titleBarHeight"
        :topBarHeight="topBarHeight"
      />
      <view>
        <title-switch ref="titleSwitchRef" @custom-event="handleParentMethod" :noMore="noMore" :tagWrapShow="tagWrapShow"
                      :informationLists="informationLists" :informationList="informationList" :information="information"
                      :aiData="aiData"></title-switch>
      </view>
      <view v-if="pageScrollLocked" class="scroll-lock-overlay" @touchmove.stop="safePreventTouchMove" @click="closePopup"></view>

      <view v-if="showToodown" class="toodown-wrapper">
        <view class="toodown" @click="backToTop">
          <image class="toodownimg" src="/static/images/back.svg" mode="widthFix"></image>
        </view>
      </view>
    
      <!-- 遮罩层从页面顶部开始，但导航栏 z-index 更高，不会被遮挡 -->
      <view
        @click="closeTitleSwitch"
        @touchmove.stop="safePreventTouchMove"
        catchtouchmove
        v-if="tagWrapShow"
        class="mask-overlay"
        style="background-color: rgb(0 0 0 / 0.4);position: fixed;inset: 0;z-index: 899;"
      ></view>
    </view>
    
  </view>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { onShow, onLoad, onReachBottom, onPageScroll, onShareAppMessage } from '@dcloudio/uni-app'
import NavigationBars from "@/components/navigation-bars/indexa.vue"
import { information as informationApi, getinformationListnews } from "@/service/knowledgePlanet.js"
import TitleSwitch from "./components/title-switch/index.vue"
import rankings from "@/components/ranking/rankings.vue"
import DrawerComponent from '@/components/DrawerComponentall.vue'
import { getCozeApiList } from "@/service/aiModels.js"
import { getModelChat, removeModelChat } from "@/service/ai_index.js"
import { payceshi } from "@/service/businessCard.js"

const navbar = ref(null)
const floatBoxRef = ref(null)
const drawerComponent = ref(null)
const titleSwitchRef = ref(null)

const visible = ref(true)
const selectedIndex = ref(1)
const FirstList = ref([{ key: 1, name: '人工智能人工智能' }, { key: 2, name: '机器学习' }, { key: 3, name: '人工学习' }])
const index = ref(1)
const color = ref("#93D2F3")
const information = ref({})
const aiData = ref({})
const informationList = ref([])
const informationLists = ref([])
const lastDate = ref(null)
const loading = ref(false)
const noMore = ref(false)
const val = ref("")
const showBackTop = ref(false)
const list = ref([
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' },
  { name: '自然语言处理' }
])
const showModal = ref(false)
const interestTracks = ref([])
const tagWrapShow = ref(false)
const drawerVisible = ref(false)
const windowHeight = ref(0)
const activeNavbar = ref(true)
const showTabbar = ref(false)
const pageScrollLocked = ref(false)
const scrollPosition = ref(0)
const categoryActive = ref(false)
const showToodown = ref(false)
const active_date = ref("0")
const active_menu = ref(0)
const alldataarr = ref([])
const groupedData = ref([])
const userinfo = ref({
  avatar: '',
  nickname: ''
})
const modelList = ref([])

const twoRows = computed(() => {
  const rowLength = 5
  const arr = [[], []]
  list.value.forEach((item, idx) => {
    arr[idx < rowLength ? 0 : 1].push(item)
  })
  return arr
})

const statusBarHeight = computed(() => {
  const app = getApp()
  return app?.globalData?.statusBarHeight || 0
})

const titleBarHeight = computed(() => {
  const app = getApp()
  return app?.globalData?.titleBarHeight || 0
})

const topBarHeight = computed(() => {
  const app = getApp()
  return (app?.globalData?.statusBarHeight || 0) + (app?.globalData?.titleBarHeight || 0)
})

onShow(() => {
  const dataInfo = uni.getStorageSync('data')
  if (dataInfo) {
    userinfo.value = {
      avatar: dataInfo.avatar || '',
      nickname: dataInfo.nickname || ''
    }
  }
  getCozeApiList().then(res => {
    modelList.value = res.data || []
  }).catch(() => {
    modelList.value = []
  })
  loadHistoryChat()
})

onLoad(() => {
  uni.getSystemInfo({
    success: (res) => {
      windowHeight.value = res.windowHeight
    }
  })
})

onReachBottom(() => {
  getdatalist(lastDate.value)
})

onPageScroll((e) => {
  if (pageScrollLocked.value || tagWrapShow.value) {
    return
  }
  color.value = e.scrollTop > 20 ? "white" : "transparent"
  showBackTop.value = e.scrollTop > 300
  handleToodownVisibility(e.scrollTop)
  if (tagWrapShow.value && e.scrollTop > 5) {
    tagWrapShow.value = false
    categoryActive.value = false
    uni.$emit('trigger-nav-click')
  }
})

onMounted(() => {
  let data = {
    openId: uni.getStorageSync("data").openId,
  }
  informationApi().then((res) => {
    informationList.value = res.data
  })
  getdatalist()
})

onBeforeUnmount(() => {
  unlockPageScroll()
  // #ifdef H5
  document.removeEventListener('touchmove', preventTouchMove)
  document.removeEventListener('wheel', preventWheel)
  // #endif
})

onShareAppMessage(() => {
  const floatBoxComponent = floatBoxRef.value
  if (floatBoxComponent && typeof floatBoxComponent.getShareInfo === 'function') {
    const shareInfo = floatBoxComponent.getShareInfo()
    return {
      ...shareInfo,
      success: function (res) {
        uni.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: function (res) {
        uni.showToast({
          title: '分享失败',
          icon: 'none'
        })
      }
    }
  }
  const userData = uni.getStorageSync('data') || {}
  const inviteCode = userData.inviteCode || ''
  return {
    title: 'AI智汇社',
    path: `/pages/table/aiIndex/ai_index?source=share&inviteCode=${inviteCode}`,
    imageUrl: '/static/images/20250530152648.png',
    success: function (res) {
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      })
    },
    fail: function (res) {
      uni.showToast({
        title: '分享失败',
        icon: 'none'
      })
    }
  }
})

function closePopup() {
  tagWrapShow.value = false
  unlockPageScroll()
  categoryActive.value = false
}

function preventTouchMove(e) {
  if (e.cancelable !== false) {
    e.preventDefault()
  }
}

function safePreventTouchMove(e) {
  if (e.cancelable !== false) {
    e.preventDefault()
  }
}

function preventWheel(e) {
  if (e.cancelable !== false) {
    e.preventDefault()
  }
}

function lockPageScroll() {
  if (!pageScrollLocked.value) {
    pageScrollLocked.value = true
    // #ifdef H5
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${window.scrollY}px`
    document.body.style.width = '100%'
    document.addEventListener('touchmove', preventTouchMove, { passive: false })
    document.addEventListener('wheel', preventWheel, { passive: false })
    // #endif
    // #ifdef MP-WEIXIN
    uni.createSelectorQuery().selectViewport().scrollOffset((res) => {
      scrollPosition.value = res.scrollTop
    }).exec()
    // #endif
  }
}

function unlockPageScroll() {
  if (pageScrollLocked.value) {
    pageScrollLocked.value = false
    // #ifdef H5
    const scrollY = document.body.style.top
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    window.scrollTo(0, parseInt(scrollY || '0') * -1)
    document.removeEventListener('touchmove', preventTouchMove)
    document.removeEventListener('wheel', preventWheel)
    // #endif
    // #ifdef MP-WEIXIN
    nextTick(() => {
      uni.pageScrollTo({
        scrollTop: scrollPosition.value,
        duration: 0
      })
    })
    // #endif
  }
}

function activeNav(index) {
  if (index == 0) {
    activeNavbar.value = true
  } else {
    activeNavbar.value = false
  }
}

function closeTitleSwitch() {
  navbar.value.handleNavClick()
  categoryActive.value = false
  unlockPageScroll()
}

function handleNavClick(val) {
  tagWrapShow.value = !tagWrapShow.value
  if (tagWrapShow.value) {
    lockPageScroll()
  } else {
    unlockPageScroll()
    categoryActive.value = false
  }
}

function handleMenuClick() {
  drawerVisible.value = !drawerVisible.value
}

function close_drawer() {
  drawerVisible.value = false
}

function gopage(url) {
  drawerVisible.value = false
  tagWrapShow.value = false
  unlockPageScroll()
  if (url == '/pages/table/aiIndex/ai_index') {
    uni.navigateTo({ url })
    return
  }
  if (url == '/pages/tools/aigc/index' || url == '/pagesA/studyindex/index') {
    uni.navigateTo({ url })
    return
  }
  if (url == '/pages/table/user/index') {
    uni.reLaunch({ url })
    return
  }
  uni.navigateTo({ url })
}

function gotocompany() {
  uni.navigateTo({ url: '/pages/distribution/index' })
}

function lingqu() {
  uni.setClipboardData({
    data: "https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink",
    success: () => {
      uni.showToast({ title: '链接已复制，请在浏览器中打开', icon: 'none' })
    },
    fail: () => {
      uni.showToast({ title: '复制失败', icon: 'none' })
    }
  })
}

function addNewChat() {
  uni.navigateTo({ url: '/pages/table/aiIndex/ai_index' })
}

function handleShowFullList(item, index, modelIndex, dateGroupIndex) {
  drawerVisible.value = false
  tagWrapShow.value = false

  const modelName = (item && (item.source || item.model_name || item.modelName)) || ''
  const foundModel = (modelList.value || []).find(m => m && (m.name === modelName || m.source === modelName))
  const modelNameEN = (foundModel && foundModel.name) || ''
  const modelId = (foundModel && foundModel.id) || ''
  const remark = (foundModel && foundModel.remark) || ''
  const isSpecialModel = (foundModel && foundModel.source) === '智汇AI数字人' || modelName === '智汇AI数字人'
  const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'
  let dateStr = ''
  try {
    dateStr = drawerComponent.value?.sortedGroupedData?.[modelIndex]?.dateGroups?.[dateGroupIndex]?.date || ''
  } catch (e) {}
  if (!dateStr && item && item.create_time) dateStr = String(item.create_time).split(' ')[0]

  uni.navigateTo({
    url: `/pages/tools/${targetPage}?prompt=` +
      '' +
      '&remark=' + encodeURIComponent(remark || '') +
      '&modelName=' + encodeURIComponent((foundModel && foundModel.source) || modelName || '') +
      '&modelNameEN=' + encodeURIComponent(modelNameEN || '') +
      '&modelId=' + encodeURIComponent(modelId || '') +
      '&mccd=' + encodeURIComponent(JSON.stringify({})) +
      '&modelType=' + encodeURIComponent('') +
      '&pitch=' + ((foundModel && (modelList.value || []).indexOf(foundModel)) ?? 0) +
      '&imgUrl=' + encodeURIComponent(JSON.stringify([])) +
      '&noSend=' + true +
      '&isfulllist=' + true +
      '&item=' + encodeURIComponent(item && item.field1 ? item.field1 : '') +
      '&index=' + index +
      '&date=' + encodeURIComponent(dateStr || '') +
      '&chat_id=' + encodeURIComponent(item && item.id ? item.id : '')
  })
}

function handleTouchStart(event, index, modelIndex, dateGroupIndex) {
}

function handleTouchMove(event, index, modelIndex, dateGroupIndex) {
}

function handleTouchEnd(event, index, modelIndex, dateGroupIndex) {
}

function removeChat(id, index, modelIndex, dateGroupIndex) {
  let userData = uni.getStorageSync('data')
  if (!userData) userData = uni.getStorageSync('userInfo')
  removeModelChat(id).then(res => {
    if (userData && userData.uuid && userData.thirdPartyAccounts && userData.thirdPartyAccounts.accessToken) {
      getModelChat({ user_uuid: userData.uuid }).then(res => {
        alldataarr.value = res.data || []
        groupDataByDate()
      }).catch(() => {})
    }
    uni.showToast({ title: '删除成功', icon: 'success' })
  }).catch(() => {
    uni.showToast({ title: '删除失败', icon: 'error' })
  })
}

function loadHistoryChat() {
  let userData = uni.getStorageSync('data')
  if (!userData) userData = uni.getStorageSync('userInfo')
  if (!userData || !userData.uuid || !userData.thirdPartyAccounts || !userData.thirdPartyAccounts.accessToken) return
  getModelChat({ user_uuid: userData.uuid }).then(res => {
    alldataarr.value = res.data || []
    groupDataByDate()
  }).catch(() => {})
}

function groupDataByDate() {
  groupedData.value = []
  const dateMap = {}
  ;(alldataarr.value || []).forEach(item => {
    const date = formatDateHistory(item.create_time || '')
    if (!dateMap[date]) {
      dateMap[date] = { name: date, list: [] }
      groupedData.value.push(dateMap[date])
    }
    dateMap[date].list.push({ ...item, isShow: false })
  })
}

function formatDateHistory(date) {
  if (!date) return ''
  const parts = String(date).split('-')
  return parts.length >= 2 ? `${parts[0]}年${parts[1]}月` : date
}

function bindChange(e) {
  selectedIndex.value = e.detail.value[0]
}

function getdatalist(date) {
  if (loading.value || noMore.value) return
  loading.value = true

  const isSearch = !!val.value
  getinformationListnews(date ? date : "", isSearch ? 0 : 0, isSearch ? val.value : 'ARTF_INTG').then(res => {
    if (!res.data || res.data.length === 0) {
      noMore.value = true
      loading.value = false
      return
    }
    const grouped = groupByDate(res.data)
    nextTick(() => {
      informationLists.value = [...informationLists.value, ...grouped]
    })
    if (res.data.length > 0) {
      lastDate.value = res.data[res.data.length - 1].insertTime
    }
    loading.value = false
  }).catch(() => {
    loading.value = false
  })
}

function checkIfNeedMoreData() {
  const query = uni.createSelectorQuery()
  query.select('.main-container').boundingClientRect(data => {
    if (data) {
      const windowHeight = uni.getSystemInfoSync().windowHeight
      if (data.bottom < windowHeight + 250 && !noMore.value && !loading.value) {
        getdatalist(lastDate.value)
      }
    }
  }).exec()
}

function groupByDate(data) {
  const map = {}
  data.forEach(item => {
    if (!map[item.insertTimeStr]) {
      map[item.insertTimeStr] = []
    }
    map[item.insertTimeStr].push(item)
  })
  return Object.keys(map).map(date => ({
    date,
    list: map[date]
  }))
}

function handleParentMethod(v, show) {
  if (v.code) {
    loading.value = false
    noMore.value = false
    val.value = v.code
    informationLists.value = []
    getdatalist()
  }
  tagWrapShow.value = show
  if (show) {
    lockPageScroll()
  } else {
    unlockPageScroll()
  }
}

function scrollToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  })
}

function handleToodownVisibility(scrollTop) {
  if (scrollTop > 200) {
    showToodown.value = true
  } else {
    showToodown.value = false
  }
}

function backToTop() {
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300
  })
}

function navigateToInterestPage() {
}

function closeModal() {
  showModal.value = false
}
</script>

<style lang="scss" scoped>
.scroll-lock-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background-color: transparent;
  touch-action: none;
  overflow: hidden;
}

.mask-overlay {
  touch-action: none;
  overflow: hidden;
  -webkit-overflow-scrolling: none;
}

.main-container.no-scroll {
  overflow: hidden;
  height: 100vh;
  position: fixed;
  width: 100%;
}

.outContainer {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.back-to-top-icon {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 80rpx;
  padding: 20rpx;
}

.back-to-top-btn {
  position: fixed;
  right: 40rpx;
  bottom: 180rpx;
  width: 80rpx;
  height: 80rpx;
  background: rgb(147 210 243 / 0.9);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity 0.2s;
}

.back-to-top-icon {
  width: 48rpx;
  height: 48rpx;
}

.picker-view {
  width: 30%;
  height: 200rpx;
  text-align: center;
  margin-top: 20rpx;
  border: 1px solid;
  border-image: linear-gradient(228deg, #D19EFF 5%, rgb(255 242 0 / 0.3) 31%, rgb(146 146 146 / 0.3) 52%, rgb(255 242 0 / 0.3) 74%, #CD96FF 94%) 1;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
}

.item {
  color: #636363;
  font-size: 24rpx;
  line-height: 65rpx;
  opacity: 1;
  background: linear-gradient(107deg, rgb(217 219 255 / 0.6) 40%, rgb(253 255 220 / 0.6) 104%);
}

/* 选中项颜色 */
.item.active {
  color: #000;
  font-size: 24rpx;
  font-weight: bold;
}

.item.adjacent {
  color: #636363;
}

.horizontal-scroll {
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  margin-left: 20rpx;
}

.two-row-list {
  display: flex;
  flex-direction: column;
  width: max-content;
}

.row {
  display: flex;
  flex-direction: row;
  margin-bottom: 12rpx;
}

.card-item {
  width: 200rpx;
  height: 70rpx;
  margin-right: 18rpx;
  border-radius: 15rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #222;
  background: linear-gradient(107deg, rgb(217 219 255 / 0.6) 40%, rgb(253 255 220 / 0.6) 104%);
  box-sizing: border-box;
  border-image: radial-gradient(25% 50% at 50% 100%, #FFF 0%, rgb(255 255 255 / 0) 100%) 1.5;
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
}

.view-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20rpx;
}

::v-deep .tab-bar{
  z-index: 1001 !important;
}

::v-deep .tag-wrap{
  z-index: 1001 !important;
}

.toodown-wrapper {
  z-index: 2;
  transition: all 0.2s ease-in-out;
  padding-top: 60rpx;
  background: linear-gradient(to top, #fff 0%, rgb(255 255 255 / 0) 100%);
  left: 0 !important;
  right: 0 !important;
}

.toodown-wrapper:not(.toodown-fixed) {
  position: fixed;
  left: calc(50% - 34rpx);
  bottom: 88rpx;
}

.toodown-wrapper.toodown-fixed {
  position: relative;
  right: auto;
  bottom: auto;
  margin: 20rpx auto 0;
  display: flex;
  justify-content: center;
}

.toodown {
  width: 68rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 8rpx;
  margin: 0 auto;
}

.toodownimg {
  width: 32rpx;
  height: 32rpx;
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.toodown:active .toodownimg {
  transform: rotate(90deg) scale(0.9);
}

.drawer_menu {
  padding: 15rpx 14rpx 25rpx;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #D8D8D8;
}

.drawer_menu_label {
  height: 60rpx;
  width: 60rpx;
  display: block;
}

.back_index_btn_bor {
  display: flex;
}

.back_index_btn_bor::after {
  content: "";
  clear: both;
  display: block;
}

.back_index_btn {
  margin: 0 auto;
  width: auto;
  border: 1px solid #000;
  border-radius: 15rpx;
  padding: 10rpx 14rpx;
  display: flex;
  font-size: 32rpx;
  line-height: 33rpx;
  float: left;
  color: rgb(0 0 0 / 0.7);
  background: #D3E9FF;
}

.back_index_icon {
  display: block;
  float: left;
  width: 33rpx;
  height: 33rpx;
  margin-right: 10rpx;
}

.bottom_userInfo {
  display: flex;
  padding: 12rpx 13rpx;
  box-sizing: border-box;
  border-top: 1px solid rgb(239 239 239 / 0.18);
  font-size: 32rpx;
  line-height: 48rpx;
  color: #000;
  font-weight: bold;
  margin-top: 13rpx;
  position: absolute;
  bottom: 0;
  left: 14rpx;
  right: 14rpx;
  justify-content: space-between;
}

  .set_btn {
    width: 48rpx;
    height: 44rpx;
    float: right;
    flex: none;
  }

  .user_avatar {
    width: 48rpx;
    height: 48rpx;
    border-radius: 8rpx;
    margin-right: 6rpx;
    flex: none;
    float: left;
    display: block;
  }

  .switch-container {
    margin-top: -10rpx;
    overflow: hidden;
  }

  .user_nickname {
    display: block;
    white-space: nowrap;
  }

.drawer_remove_chat {
  font-size: 24rpx;
  color: #3D3D3D;
  position: absolute;
  right: 14rpx;
  padding: 12rpx 0;
}

.menu-item_active {
  background-color: #D3E9FF;
  border-radius: 15rpx 0 0 15rpx;
}
</style>
