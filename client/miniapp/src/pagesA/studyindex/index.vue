<template>
    <view class="study_index">
        <DrawerComponent ref="drawerComponentRef" :showTabbar="showTabbar" :tagWrapShow="showStudyDrawer" :statusBarHeight="statusBarHeight" :groupedData="groupedData"
            :active_date="active_date" :active_menu="active_menu" :userinfo="userinfo" :modelList="modelList" @close-drawer="close_drawer"
            @go-page="gopage" @go-company="gotocompany" @lingqu="lingqu" @add-new-chat="addNewChat"
            @show-full-list="handleShowFullList" @touch-start="handleTouchStart" @touch-move="handleTouchMove"
            @touch-end="handleTouchEnd" @remove-chat="removeChat" />
        <navigationBars :showFenLei="true" :showMenu="true" :aigc="false" :viscosity="true" :study="false" @nav-click="handleFenLeiClick" @menu-click="handleMenuClick" title="AI视频"
            @pack="backPage" :showBack="false" :isShowSearch="true" @clicksearch="handleSearchClick"
            :image="pageType != 'index' ? 'https://file.aizhs.top/sys-mini/default/back.svg' : ''" />
        <view class="s_t_b" v-if="showTypes">
            <ScrollTitle ref="titleSwitchRef" @custom-event="changeSaidao" :noMore="false" :tagWrapShow="true"
                :informationLists="[]" :informationList="mainList" :information="{}" :aiData="{}" :showNews="false"
                :showSub="true" @sub-change="subChange">
            </ScrollTitle>
        </view>
        <view class="mask" v-if="showTypes" @click="() => { showTypes = false }"></view>
        <Tab paddingLeft="0rpx" @change="changeTab" :isSingleSelect="true"></Tab>
        <view class="search_body" v-if="showSearchBox" :class="'search-fade'">
            <SearchInput fromPath="nomal" @change="searchChange" :isIos="isIos" :textarea_int="false"
                :statusBarHeight="Number(statusBarHeight) || 0" :titleBarHeight="Number(titleBarHeight) || 0"></SearchInput>
        </view>
        <view class="content" :class="{ 'content-with-search': showSearchBox }">
            <Tip @toMyModel="toMyModel()"></Tip>
            <ModelList ref="ModelListRef" v-if="pageType == 'index' || pageType == 'model'" :pageType="pageType"
                :modelCategroys="modelCategroys" :modelSearch="modelSearch" :types="modelTypes"
                @showMore="() => { pageType = 'model' }" @modelClick="modelClick">
            </ModelList>
            <StudyList ref="StudyListRef" v-if="pageType == 'index' || pageType == 'study'" :pageType="pageType"
                :studyCategroys="studyCategroys" :studySearch="studySearch" :types="studyTypes"
                @showMore="() => { pageType = 'study' }" @videoClick="videoClick">
            </StudyList>
        </view>
        <!-- 悬浮发布按钮（与灵感页一致） -->
        <view class="floating-publish-btn" @click="goToPublish">
            <image src="/static/images/add/publish.svg" mode="aspectFit" class="publish-icon"></image>
        </view>
    </view>
</template>
<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import NavigationBars from "@/components/navigation-bars/index.vue";
import SearchInput from '@/components/SearchInput/index.vue'
import ModelList from './components/model_list.vue'
import StudyList from './components/study_list.vue'
import Tip from './components/tip.vue'
import Tab from '@/components/type-bar/tab.vue'
import ScrollTitle from '@/pages/table/share/components/title-switch/index.vue'
import DrawerComponent from '@/components/DrawerComponentall.vue';
import { categoryDictionary, getCozeApiList } from '@/service/aiModels.js'
import { getModelChat, removeModelChat } from '@/service/ai_index.js'

const isIos = ref(false)
const pageType = ref('index')
const showTypes = ref(false)
const showTabbar = ref(false)
const modelTypes = ref('')
const studyTypes = ref('')
const modelCategroys = ref('')
const studyCategroys = ref('')
const modelSearch = ref('')
const studySearch = ref('')
const mainList = ref([])
const textarea_int = ref(true)
const showStudyDrawer = ref(false)
const active_date = ref("0")
const active_menu = ref(0)
const alldataarr = ref([])
const groupedData = ref([])
const userinfo = ref({
    avatar: '',
    nickname: ''
})
const modelList = ref([])
const showSearchBox = ref(false)

const drawerComponentRef = ref(null)
const ModelListRef = ref(null)
const StudyListRef = ref(null)
const titleSwitchRef = ref(null)

const statusBarHeight = computed(() => {
    return uni.getStorageSync('statusBarHeight')
})
const titleBarHeight = computed(() => {
    return uni.getStorageSync('titleBarHeight')
})

watch(pageType, (n) => {
    if (n) {
        nextTick(() => {
            if (ModelListRef.value) {
                ModelListRef.value.getData()
            }
            if (StudyListRef.value) {
                StudyListRef.value.getData()
            }
        })
    }
})

onLoad((options) => {
})

onShow(() => {
    const systemInfo = uni.getSystemInfoSync()
    isIos.value = systemInfo.platform === 'ios'
    
    if (!uni.getStorageSync('statusBarHeight')) {
        uni.setStorageSync('statusBarHeight', systemInfo.statusBarHeight)
    }
    if (!uni.getStorageSync('titleBarHeight')) {
        uni.setStorageSync('titleBarHeight', systemInfo.statusBarHeight + 44)
    }
    
    setTimeout(() => {
        textarea_int.value = false
    }, 500)
    
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
    
    if (pageType.value == 'model') {
        if (ModelListRef.value) {
            ModelListRef.value.getData()
        }
    } else if (pageType.value == 'study') {
        if (StudyListRef.value) {
            StudyListRef.value.getData()
        }
    } else {
        if (ModelListRef.value) {
            ModelListRef.value.getData()
        }
        if (StudyListRef.value) {
            StudyListRef.value.getData()
        }
    }
    
    uni.hideTabBar({
        success: function() {},
        fail: function(err) {}
    })
})

onMounted(() => {
    categoryDictionary().then(res => {
        mainList.value = res.data
    })
})

function handleSearchClick() {
    showSearchBox.value = !showSearchBox.value
}

function toAdd() {
    uni.navigateTo({
        url: '/pagesA/study/publish',
    })
}

function goToPublish() {
    uni.navigateTo({
        url: '/pagesA/study/publish',
    })
}

function toMyModel() {
    uni.navigateTo({
        url: '/pagesA/study/my_study',
    })
}

function modelClick(obj) {
    uni.navigateTo({
        url: `/pagesA/study/video_detail?courseId=${obj.id}`,
    })
}

function videoClick(obj) {
    uni.navigateTo({
        url: `/pagesA/study/video_detail?courseId=${obj.courseId}&id=${obj.id}`,
    })
}

function changeTab(val) {
    const arr = val.map(item => {
        return item.id
    })
    const str = arr.join()
    if (pageType.value == 'model') {
        modelTypes.value = str
    } else if (pageType.value == 'study') {
        studyTypes.value = str
    } else {
        modelTypes.value = str
        studyTypes.value = str
    }
}

function searchChange(str) {
    if (pageType.value == 'model') {
        modelSearch.value = str
    } else if (pageType.value == 'study') {
        studySearch.value = str
    } else {
        modelSearch.value = str
        studySearch.value = str
    }
}

function subChange(obj) {
    if (obj) {
        const str = obj.id
        if (pageType.value == 'model') {
            modelCategroys.value = str
        } else if (pageType.value == 'study') {
            studyCategroys.value = str
        } else {
            modelCategroys.value = str
            studyCategroys.value = str
        }
    }
}

function changeSaidao(obj) {
}

function handleFenLeiClick() {
    showTypes.value = !showTypes.value
}

function handleMenuClick() {
    showStudyDrawer.value = !showStudyDrawer.value
}

function close_drawer() {
    showStudyDrawer.value = !showStudyDrawer.value
}

function gopage(url) {
    showStudyDrawer.value = false
    uni.navigateTo({
        url: url,
        fail: () => {
            uni.reLaunch({
                url: url
            })
        }
    })
}

function gotocompany() {
    uni.navigateTo({
        url: '/pages/distribution/index',
    })
}

function lingqu() {
    uni.setClipboardData({
        data: "https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink",
        success: () => {
            uni.showToast({
                title: '链接已复制，请在浏览器中打开',
                icon: 'none'
            })
        },
        fail: () => {
            uni.showToast({
                title: '复制失败',
                icon: 'none'
            })
        }
    })
}

function addNewChat() {
    uni.navigateTo({
        url: '/pages/table/aiIndex/ai_index'
    })
}

function handleShowFullList(item, index, modelIndex, dateGroupIndex) {
    showStudyDrawer.value = false

    const modelName = (item && (item.source || item.model_name || item.modelName)) || ''
    const foundModel = (modelList.value || []).find(m => m && (m.name === modelName || m.source === modelName))
    const modelNameEN = (foundModel && foundModel.name) || ''
    const modelId = (foundModel && foundModel.id) || ''
    const remark = (foundModel && foundModel.remark) || ''
    const isSpecialModel = (foundModel && foundModel.source) === '智汇AI数字人' || modelName === '智汇AI数字人'
    const targetPage = isSpecialModel ? 'ai_index3' : 'ai_index2'

    let dateStr = ''
    try {
        dateStr = drawerComponentRef.value?.sortedGroupedData?.[modelIndex]?.dateGroups?.[dateGroupIndex]?.date || ''
    } catch (e) { }
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

function backPage() {
    if (showTypes.value) {
        showTypes.value = false
        return
    }
    if (pageType.value == 'model') {
        pageType.value = 'index'
    } else if (pageType.value == 'study') {
        pageType.value = 'index'
    }
}

function onShareAppMessage() {
    const userData = uni.getStorageSync('data') || {}
    const inviteCode = userData.inviteCode || ''
    return {
        title: 'AI智汇社',
        path: `/pages/table/tools/index?source=share&inviteCode=${inviteCode}`,
        imageUrl: 'https://file.aizhs.top/sys-mini/20250530152648.png',
        success: function (res) {
            uni.$emit('fenxiangchenggong')
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
</script>
<style lang="scss" scoped>
.study_index {
    box-sizing: border-box;
    width: 100vw;
    height: 100vh;
    overflow-y: scroll;
    position: relative;

    .content {
        width: 100vw;

        /* 底部留白：不再为自定义 tabbar 预留，仅保留适当间距 */
        padding: 0 20rpx 24rpx;
        padding-top: calc(var(--app-top-bar-height) + 20rpx);
        box-sizing: border-box;
        transition: padding-top 0.3s ease;
    }
    
    /* 当搜索框显示时，增加内容区域的顶部 padding */
    .content.content-with-search {
        padding-top: calc(var(--app-top-bar-height) + 120rpx);
    }
}

.s_t_b {
    position: fixed;
    top: var(--app-top-bar-height);
    left: 0;
    right: 0;
    z-index: 998;
}

.mask {
    position: fixed;
    inset: 0;
    z-index: 991;
    background-color: rgb(0 0 0 / 0.3);
}

.f_n {
    display: flex;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.m_b18 {
    margin-bottom: 18rpx;
}

.input_body {
    margin: 0 !important;
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

// 悬浮发布按钮（不再为 tabbar 预留，贴近底部）
.floating-publish-btn {
  position: fixed;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  bottom: calc(24rpx + constant(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  width: 100rpx;
  height: 100rpx;
  z-index: 998;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15rpx;
  transition: all 0.3s ease;
  backdrop-filter: blur(8px) saturate(180%);
  -webkit-backdrop-filter: blur(8px) saturate(180%);
  background: rgb(255 255 255 / 0.55);
  border: 1rpx solid rgb(0 0 0 / 0.06);

  &:active {
    transform: translateX(-50%) scale(0.95);
  }

  .publish-icon {
    width: 60rpx;
    height: 60rpx;
  }
}

// 搜索框容器样式和动画
.search_body {
  position: fixed;
  top: var(--app-top-bar-height);
  left: 0;
  right: 0;
  z-index: 997;
  padding: 20rpx;
  box-sizing: border-box;
  background-color: #fff;
  box-shadow: 0 2rpx 8rpx rgb(0 0 0 / 0.1);
}

/* 搜索框渐入动画 */
.search-fade {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  animation: search-fade-in 0.3s ease forwards;
}

@keyframes search-fade-in {
  0% {
    opacity: 0;
    max-height: 0;
    transform: translateY(-20rpx);
  }

  100% {
    opacity: 1;
    max-height: 300rpx;
    transform: translateY(0);
  }
}
</style>