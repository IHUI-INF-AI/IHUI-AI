<!-- 标题 -->
<template>
  <view style="position: relative;" @click="closeTag">
    <!-- 赛道选择 -->
    <view v-if="tagWrapShow" class="tag-wrap" style="padding:0">
      <view class="fenlei_btn_list">
        <view class="fenlei_btn" :class="idx == item_active ? 'active':''" v-for="(item, idx) in informationList" :key="idx" @click="handleItemClicks(idx, item)">
          {{ item.name.replace('赛道', '') }}
        </view>
      </view>
    </view>
    <view class="view-wrap" v-if="showViewWrap">
      <view></view>
      <view class="view-box">
        <view></view>
      </view>
    </view>
    <view style="padding: 0 20rpx;" v-if="showNews">
      <view style="display: flex; align-items: center;justify-content: space-between;">
      </view>
      <!-- 新闻 -->
      <new-title v-if="switchs === 1" :centerTitle="information.hot_data" @new="newclick"></new-title>
      <new-title v-if="switchs === 2" :centerTitle="aiData.hot_data" @new="newclick"></new-title>
      <!-- 盒子 -->
      <center-item v-if="switchs === 1" :center="information.all_data" @new="newclick"></center-item>
      <center-item v-if="switchs === 2" :center="aiData.all_data" @new="newclick"></center-item>
      <information-item :noMore="noMore" :informationLists="informationLists"></information-item>
      <!-- 分类弹窗 -->
      <view v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed, watch, onBeforeMount } from 'vue'
import NewTitle from "../new-title/index.vue"
import CenterItem from "../center-item/index.vue"
import InformationItem from "../information-item/index.vue"

const emit = defineEmits(['custom-event', 'state-synced', 'state-restored', 'sub-change'])

const props = defineProps({
  tagWrapShow: {
    type: Boolean,
    default: false,
  },
  information: {
    type: Object,
    default() {
      return {
        hot_data: [],
        all_data: [],
      }
    },
  },
  aiData: {
    type: Object,
    default() {
      return {
        hot_data: [],
        all_data: [],
      }
    },
  },
  informationList: {
    type: Array,
    default() {
      return []
    },
  },
  informationLists: {
    type: Array,
    default() {
      return []
    },
  },
  noMore: {
    type: Boolean,
    default: false
  },
  newtagWrapShow: {
    type: Boolean,
    default: false
  },
  showNews: {
    type: Boolean,
    default: true
  },
  showSub: {
    type: Boolean,
    default: false
  },
  showViewWrap: {
    type: Boolean,
    default: true
  },
  externalState: {
    type: Object,
    default() {
      return {}
    }
  },
  pageId: {
    type: String,
    default: 'default'
  }
})

const selectedIndex = ref(4)
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
const visible = ref(true)
const switchs = ref(1)
const isServicePopupVisible = ref(false)
const activeIndex = ref(-1)
const classificationdata = ref({})
const tagList = ref([
  { name: '自然语言处理' },
  { name: '人工智能芯片' },
  { name: '计算机视觉' },
  { name: '智能推荐系统' },
  { name: '自然语言处理' }
])
const item_active = ref(0)
const subInformationList = ref([])
const showSubList = ref(false)
const sub_active = ref(-1)
const storageKey = ref('')
const isStateLoaded = ref(false)

const twoRows = computed(() => {
  const rowLength = 5
  const arr = [[], []]
  list.value.forEach((item, idx) => {
    arr[idx < rowLength ? 0 : 1].push(item)
  })
  return arr
})

const title = computed(() => {
  return switchs.value === 1
    ? {
        name: "每日AI资讯",
        images: "/static/images/top.png",
      }
    : {
        name: "AI热门",
        images: "/static/images/top.png",
      }
})

watch(() => props.informationList, (newVal) => {
  if (newVal && newVal.length > 0 && !isStateLoaded.value) {
    loadSelectionState()
    isStateLoaded.value = true
  }
}, { immediate: true, deep: true })

watch(() => props.externalState, (newVal) => {
  if (newVal && Object.keys(newVal).length > 0) {
    syncExternalState(newVal)
  }
}, { immediate: true, deep: true })

onBeforeMount(() => {
  storageKey.value = `title-switch-selection-state-${props.pageId}`
})

function saveSelectionState() {
  try {
    if (!validateCurrentState()) {
      return false
    }
    const state = {
      item_active: item_active.value,
      sub_active: sub_active.value,
      classificationdata: classificationdata.value,
      showSubList: showSubList.value,
      timestamp: Date.now()
    }
    uni.setStorageSync(storageKey.value, JSON.stringify(state))
    emit('state-synced', {
      item_active: item_active.value,
      sub_active: sub_active.value,
      classificationdata: classificationdata.value
    })
    return true
  } catch (error) {
    return false
  }
}

function validateCurrentState() {
  if (typeof item_active.value !== 'number' || item_active.value < 0) {
    return false
  }
  if (typeof sub_active.value !== 'number' || sub_active.value < -1) {
    return false
  }
  if (classificationdata.value && typeof classificationdata.value !== 'object') {
    return false
  }
  return true
}

function loadSelectionState() {
  try {
    const savedState = uni.getStorageSync(storageKey.value)
    if (!savedState) {
      return false
    }
    let state
    try {
      state = JSON.parse(savedState)
    } catch (parseError) {
      clearSavedState()
      return false
    }
    if (!validateLoadedState(state)) {
      clearSavedState()
      return false
    }
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    if (now - state.timestamp > sevenDays) {
      clearSavedState()
      return false
    }
    item_active.value = state.item_active || 0
    sub_active.value = state.sub_active || -1
    classificationdata.value = state.classificationdata || {}
    showSubList.value = state.showSubList || false
    if (classificationdata.value && classificationdata.value.children) {
      subInformationList.value = classificationdata.value.children
      if (props.showSub && sub_active.value >= 0) {
        showSubList.value = true
      }
    }
    emit('state-restored', {
      item_active: item_active.value,
      sub_active: sub_active.value,
      classificationdata: classificationdata.value
    })
    return true
  } catch (error) {
    return false
  }
}

function validateLoadedState(state) {
  if (!state || typeof state !== 'object') {
    return false
  }
  if (state.item_active !== undefined && typeof state.item_active !== 'number') {
    return false
  }
  if (state.sub_active !== undefined && typeof state.sub_active !== 'number') {
    return false
  }
  if (state.classificationdata && typeof state.classificationdata !== 'object') {
    return false
  }
  if (state.classificationdata && (!state.classificationdata.id || !state.classificationdata.name)) {
    return false
  }
  return true
}

function clearSavedState() {
  try {
    uni.removeStorageSync(storageKey.value)
  } catch (error) {
  }
}

function syncExternalState(externalState) {
  try {
    if (!validateExternalState(externalState)) {
      return false
    }
    if (externalState.item_active !== undefined) {
      item_active.value = externalState.item_active
    }
    if (externalState.sub_active !== undefined) {
      sub_active.value = externalState.sub_active
    }
    if (externalState.classificationdata) {
      classificationdata.value = externalState.classificationdata
      if (props.showSub && classificationdata.value.children) {
        subInformationList.value = classificationdata.value.children
        showSubList.value = sub_active.value >= 0
      }
    }
    emit('state-synced', {
      item_active: item_active.value,
      sub_active: sub_active.value,
      classificationdata: classificationdata.value
    })
    saveSelectionState()
    return true
  } catch (error) {
    return false
  }
}

function validateExternalState(state) {
  try {
    if (!state || typeof state !== 'object') {
      return false
    }
    if (state.item_active !== undefined && (typeof state.item_active !== 'number' || state.item_active < 0)) {
      return false
    }
    if (state.sub_active !== undefined && (typeof state.sub_active !== 'number' || state.sub_active < -1)) {
      return false
    }
    if (state.classificationdata && typeof state.classificationdata !== 'object') {
      return false
    }
    if (state.classificationdata && (!state.classificationdata.id || !state.classificationdata.name)) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

function closeTag() {
  if (!props.showSub) {
    handleItemClicks()
  }
}

function handleNavClick() {
}

function bindChange(e) {
  const val = e.detail.value
  selectedIndex.value = e.detail.value[0]
  classificationdata.value = props.informationList[val[0]]
  emit('custom-event', classificationdata.value.code)
}

function officialClick() {
  isServicePopupVisible.value = true
}

function aiClick() {
  switchs.value = 2
}

function newclick(item) {
  uni.navigateTo({
    url: `/pagesA/coursePlanet/Official-information/index?id=${item.id}`,
  })
}

function hideServicePopup() {
  isServicePopupVisible.value = false
}

function handleItemClicks(index, item) {
  try {
    if (!item || typeof index !== 'number' || index < 0) {
      return
    }
    if (item.id === undefined || item.id === null || !item.name) {
      return
    }
    classificationdata.value = item
    item_active.value = index
    sub_active.value = -1

    emit('custom-event', item, props.newtagWrapShow)

    if (props.showSub) {
      const children = classificationdata.value.children
      if (children && Array.isArray(children) && children.length > 0) {
        subInformationList.value = children
        showSubList.value = true
      } else {
        subInformationList.value = []
        showSubList.value = false
      }
    } else {
      uni.$emit('trigger-nav-click')
    }

    saveSelectionState()
  } catch (error) {
  }
}

function handleSubClicks(index, item) {
  try {
    if (!item || typeof index !== 'number' || index < 0) {
      return
    }
    if (item.id === undefined || item.id === null || !item.name) {
      return
    }
    sub_active.value = index
    emit('sub-change', item)
    uni.$emit('trigger-nav-click')
    saveSelectionState()
  } catch (error) {
  }
}

function confirmClick() {
  emit('custom-event', classificationdata.value.code)
  isServicePopupVisible.value = false
}
</script>

<style scoped>
.type-title {
  margin-top: 20rpx;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.type-title-left {
  padding: 0 20rpx;
  width: 50%;
  color: #1985fc;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 30rpx 0 0 30rpx;
  background-color: white;
  height: 80rpx;
  line-height: 80rpx;
}

.type-title-right {
  padding: 0 20rpx;
  width: 50%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 0 30rpx 30rpx 0;
  background-color: white;
  color: #1985fc;
  height: 80rpx;
  line-height: 80rpx;
}

.service-mask {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.service-popup-content {
  position: relative;
  width: 98%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.service-popup-title {
  width: 100%;
  height: 102rpx;
  opacity: 1;
  background: rgb(177 207 255 / 0.81);
  border-color: rgb(187 187 187);
  border-style: solid;
  border-width: 0;
  border-radius: 10px 10px 0 0;
  display: flex;
  align-items: center;
}

.service-popup-title-text {
  margin-left: 20rpx;
  color: rgb(75 153 254);
  font-size: 28rpx;
  font-family: AlimamaFangYuanTi;
  font-weight: 700;
}

.service-popup-list {
  width: 100%;
  height: 500rpx;
  overflow-y: auto;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  opacity: 1;
  background: rgb(207 223 247 / 0.81);
  border-color: rgb(187 187 187);
  border-style: solid;
  border-width: 0;
  display: flex;
  flex-wrap: wrap;
  row-gap: 30rpx;
  gap: 20rpx;
  padding: 20rpx;
  box-sizing: border-box;
}

.list-item {
  width: 30%;
  height: 70rpx;
  border-radius: 8rpx;
  text-align: center;
  line-height: 70rpx;
  color: rgb(255 255 255 / 1);
  font-size: 28rpx;
  font-weight: 400;
  position: relative;
  background: linear-gradient(145deg,
      rgb(40 100 200 / 1),
      rgb(100 150 255 / 0.8));
  box-shadow: 0 0 12rpx rgb(0 50 100 / 0.2);
  border: 2rpx solid rgb(255 255 255 / 0.3);
}

.list-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8rpx;
  background: linear-gradient(to bottom right,
      rgb(255 255 255 / 0.1) 0%,
      rgb(0 0 0 / 0.1) 100%);
}

/* 选中状态样式 */
.list-item-active {
  background: linear-gradient(145deg,
      rgb(30 90 180 / 1),
      rgb(80 140 255 / 0.9));
  border: 3rpx solid rgb(255 255 255 / 0.8);
  box-shadow:
    0 0 16rpx rgb(0 50 100 / 0.3),
    inset 0 0 20rpx rgb(255 255 255 / 0.2);
}

.service-popup-lists {
  width: 100%;
  height: 120rpx;
  overflow-y: auto;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
  opacity: 1;
  background: rgb(207 223 247 / 0.81);
  border-color: rgb(187 187 187);
  border-style: solid;
  border-width: 0;
  display: flex;
  row-gap: 30rpx;
  justify-content: center;
  padding: 20rpx;
  box-sizing: border-box;
}

.picker-view {
  width: 30%;
  height: 200rpx;
  text-align: center;
  margin-top: 20rpx;
  border: 1px solid;
  border-image: linear-gradient(228deg, #D19EFF 5%, rgb(255 242 0 / 0.3) 31%, rgb(146 146 146 / 0.3) 52%, rgb(255 242 0 / 0.3) 74%, #CD96FF 94%) 1;
  box-shadow: 0 0 20px 1px rgb(0 0 0 / 0.25);
}

.item {
  color: #636363;
  font-size: 24rpx;
  line-height: 65rpx;
  background: transparent;
  opacity: 1;
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
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
}

picker-view-column {
  background: linear-gradient(107deg, rgb(217 219 255 / 0.6) 40%, rgb(253 255 220 / 0.6) 104%);
}

/* 赛道选择 start */
.tag-wrap {
  position: relative;
  border-width: 0;
  border-style: none;
  border-color: transparent;
  backdrop-filter: blur(8px);
  z-index: 1001;
  background-color: #fff;
  width: 100%;
}

.tag-head {
  color: #865EFF;
  font-size: 36rpx;
  margin: 0 20rpx;
  text-align: center;
  font-weight: bold;
}

.fenlei_btn_list{
	display: flex;
	flex-wrap: nowrap;
	width: calc(100% - 20rpx);
	padding: 10rpx 20rpx;
    padding-top: 0;
	margin: 0 20rpx 0 0;
	overflow-x: auto;
	box-sizing: border-box;
}

.fenlei_btn_list .fenlei_btn{
	flex: none;
	color: rgb(0 0 0 / 0.6);
	margin-right: 6rpx;
	height: 44rpx;
	padding: 0 8rpx;
	line-height: 44rpx;
	border-radius: 8rpx;
	border: 1px solid #fff;
}

.fenlei_btn_list .fenlei_btn.active{
	color: #000;
	border-bottom: none;
	font-weight: bold;
	backdrop-filter: blur(10rpx);
	background: rgb(248 249 252 / 0.65) !important;
	border: 1px solid #e0e8ff !important;
	box-shadow: 0 1px 3px rgb(0 0 0 / 0.06) !important;
}

.fenlei_btn_list .fenlei_btn:last-child{
	margin-right: 0;
}

/* 赛道选择 end */
</style>
