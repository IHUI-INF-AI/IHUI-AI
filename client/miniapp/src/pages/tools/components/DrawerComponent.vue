<template>
    <view class="drawer_back" :class="{ 'drawer-open': tagWrapShow }">
      <view class="drawer_back" :class="{ 'drawer-open': tagWrapShow }" v-show="tagWrapShow" style="background-color: rgba(0, 0, 0, 0.4);" @click="close_drawer"></view>
      <view class="drawer_border" :class="{ 'drawer-open': tagWrapShow }">
          <view class="drawer" :style="{paddingTop:statusBarHeight}">
          <view class="drawer-header">
              <view class="logobox">
                <image class="logo" style="height: 66rpx;" src="/static/images/choutilogo_h.png" mode="heightFix" />
              </view>
              <image class="drawer-close" @click="close_drawer" src="/static/images/close_drawer.svg" mode="widthFix"></image>
          </view>
          <view class="drawer_menu">
              <image @click="gopage('/pages/table/tools/index')" class="drawer_menu_label" src="/static/images/drawer_menu1.png" mode="heightFix"></image>
              <image @click="gopage('/pages/table/square/index')" class="drawer_menu_label" src="/static/images/drawer_menu2.png" mode="heightFix"></image>
              <image @click="gopage('/pages/table/share/index')" class="drawer_menu_label" src="../static/tabbar/tabbar_4.png" mode="heightFix"></image>
              <image @click="gopage('/pages/table/user/index')" class="drawer_menu_label" src="/static/images/drawer_menu5.png" mode="heightFix"></image>
          </view>
          <view class="label_content">
              <view class="label_title" @click.stop="gotocompany"><image style="width: 56rpx;height: 56rpx;margin-right: 14rpx;" src="/static/images/gongsi.png" mode="widthFix"></image>我的一人公司</view>
              <view class="label_title" @click.stop="lingqu"><image style="width: 56rpx;height: 56rpx;margin-right: 14rpx;" src="/static/images/mian_label.png" mode="widthFix"></image>领取免费资料</view>
              <view class="label_title" @click.stop="addNewChat"><image style="width: 50rpx;height: 50rpx;margin-left: 4rpx;margin-right: 15rpx;margin-top: 4rpx;" src="/static/images/newchat.svg" mode="widthFix"></image>创建新对话</view>
          </view>
          <view class="drawer-menu">
              <view class="drawer_remove_chat">左滑删除对话</view>
              <view style="font-size: 28rpx;color: #000;font-weight: bold;padding-top: 12rpx;">历史对话</view>
              <view v-for="(items, date) in sortedGroupedData" :key="date" class="date-group">
                <view class="date-title">{{ items.name }}</view>
                <view v-for="(item, index) in items.list" :key="index" class="menu-item" :class="date == sortedActiveIndices.sortedDateIndex && index == sortedActiveIndices.sortedItemIndex ? 'menu-item_active':''" @click="handleShowFullList(item, index,date)" @touchstart="handleTouchStart($event, index,date)" @touchmove="handleTouchMove($event, index,date)" @touchend="handleTouchEnd($event, index,date)">
                    <text class="menu-text" :class="date == sortedActiveIndices.sortedDateIndex && index == sortedActiveIndices.sortedItemIndex ? 'menu_text':''">{{ item.mark }}</text>
                    <image class="menu_remove" :style="{ transform: `translateX(${item.isShow ? '-101':'0'}rpx)` }" @click.stop="removeChat(item.id, index,date)" src="/static/images/close_chat.png" mode="widthFix" style="width: 48rpx;height: 48rpx;display: block;"></image>
                </view>
              </view>
          </view>
          <view v-if="showIndexBtn" class="back_index_btn_bor">
            <view class="back_index_btn" @click="gobackIndex">
              <image class="back_index_icon" src="/static/images/back_index.png" mode="widthFix"></image>
              回到主页
            </view>
          </view>
          <view class="bottom_userInfo">
            <view @click="gopage('/pages/table/user/index')">
                <image class="user_avatar" :src="userinfo && userinfo.avatar ? userinfo.avatar : ''" mode="aspectFill"></image>
                <text class="user_nickname">{{ userinfo && userinfo.nickname ? userinfo.nickname : '' }}</text>
            </view>
            <view>
              <image @click="gopage('/pages/table/user/index')" class="set_btn" src="/static/images/setting_icon.png" mode="widthFix"></image>
            </view>
          </view>
        </view>
      </view>
    </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tagWrapShow: Boolean,
  statusBarHeight: String,
  groupedData: Array,
  active_date: String,
  active_menu: Number,
  userinfo: {
    type: Object,
    default: () => ({
      avatar: '',
      nickname: ''
    })
  },
  showIndexBtn: {
    type: Boolean,
    default: false,
  },
  showTabbar: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'close-drawer', 'go-page', 'go-company', 'lingqu', 'add-new-chat',
  'show-full-list', 'touch-start', 'touch-move', 'touch-end', 'remove-chat'
])

const sortedGroupedData = computed(() => {
  const sortedData = JSON.parse(JSON.stringify(props.groupedData))
  sortedData.forEach(group => {
    if (group.list && Array.isArray(group.list)) {
      group.list.reverse()
    }
  })
  return sortedData.reverse()
})

const sortedActiveIndices = computed(() => {
  if (!props.groupedData || props.groupedData.length === 0) {
    return { sortedDateIndex: -1, sortedItemIndex: -1 }
  }
  if (props.active_date < 0 || props.active_date >= props.groupedData.length) {
    return { sortedDateIndex: -1, sortedItemIndex: -1 }
  }
  if (!props.groupedData[props.active_date]) {
    return { sortedDateIndex: -1, sortedItemIndex: -1 }
  }
  if (!props.groupedData[props.active_date].list) {
    return { sortedDateIndex: -1, sortedItemIndex: -1 }
  }
  if (props.active_menu < 0 || props.active_menu >= props.groupedData[props.active_date].list.length) {
    return { sortedDateIndex: -1, sortedItemIndex: -1 }
  }
  const sortedDateIndex = props.groupedData.length - 1 - props.active_date
  const sortedItemIndex = props.groupedData[props.active_date].list.length - 1 - props.active_menu
  return { sortedDateIndex, sortedItemIndex }
})

function close_drawer() {
  emit('close-drawer')
}

function gopage(path) {
  emit('go-page', path)
}

function gotocompany() {
  emit('go-company')
}

function lingqu() {
  emit('lingqu')
}

function addNewChat() {
  emit('add-new-chat')
}

function handleShowFullList(item, index, date) {
  const originalDateIndex = props.groupedData.length - 1 - date
  emit('show-full-list', item, index, originalDateIndex)
}

function handleTouchStart(event, index, date) {
  const originalDateIndex = props.groupedData.length - 1 - date
  emit('touch-start', event, index, originalDateIndex)
}

function handleTouchMove(event, index, date) {
  const originalDateIndex = props.groupedData.length - 1 - date
  emit('touch-move', event, index, originalDateIndex)
}

function handleTouchEnd(event, index, date) {
  const originalDateIndex = props.groupedData.length - 1 - date
  emit('touch-end', event, index, originalDateIndex)
}

function removeChat(field1, index, date) {
  const originalDateIndex = props.groupedData.length - 1 - date
  emit('remove-chat', field1, index, originalDateIndex)
}

function gobackIndex() {
  uni.reLaunch({ url: '/pages/table/aiIndex/ai_index' })
}
</script>

<style scoped lang="scss">
.drawer_back{
	position: fixed;
	left: -100%;
  width: 100%;
	top: 0;
	bottom: 0;
	z-index: 1005;
}

.drawer-open {
  left: 0;
}

.drawer_border{
	position: fixed;
	top: 0;
	bottom: 0;
	left: -500rpx;
	width: 500rpx;
	z-index: 1006;
	padding: 0;
	box-sizing: border-box;
	border-radius: 0 30rpx 30rpx 0;
	transition: all 0.3s ease;

  &.drawer-open {
    left: 0;
  }

}

.drawer {
	background-color: #fff;
	border-radius: 0 30rpx 30rpx 0;
	height: calc(100%);
	width: calc(100%);
	padding: 0 0;
	box-sizing: border-box;
	position: relative;
  display: flex;
  flex-direction: column;
  padding-bottom: 85rpx;
}

.drawer-header {
	position: relative;
	height: auto;
  padding-top: 0;
	
	.drawer-close {
		position: absolute;
		top: 20rpx;
		right: 20rpx;
		width: 40rpx;
		height: 40rpx;
		cursor: pointer;
		z-index: 1007;
		opacity: 0.8;
	}
}

.drawer-menu {
	margin-top: 0;
	padding: 0;
	overflow-y: scroll;
	overflow-x: hidden;
	margin-right: 0;
  padding-left: 14rpx;
  flex: 1;
}

.date-group {
	margin-bottom: 15rpx;
	margin-left: 15rpx;
}

.date-title {
	font-size: 22rpx;
	padding: 0 15rpx 8rpx 0;
	color: #888;
	border-radius: 6rpx;
	display: inline-block;
	margin-bottom: 10rpx;
}

.menu-item {
	display: flex;
	align-items: center;
	padding: 20rpx 23rpx;
	justify-content: space-between;
	position: relative;
	box-sizing: border-box;
	overflow: hidden;
}

.menu_remove {
	position: absolute;
	right: -60rpx;
	transition: transform 0.3s ease;
}

.menu-text {
	font-size: 30rpx;
	color: #000;
	width: calc(100% - 60rpx);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	display: block;
	vertical-align: top;
	line-height: 40rpx;
	height: 40rpx;
	word-break: keep-all;
}

.menu_text{
	color: #0d11fc;
	font-weight: bold;
}
.drawer-header{
  .logobox {
    padding: 9rpx 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo {
    width: 316rpx;
    height: 88rpx;
    margin-right: 12rpx;
  }
}
.drawer_menu{
	padding: 15rpx 28rpx 25rpx;
	box-sizing: border-box;
	display: flex;
	justify-content: space-between;
	border-bottom: 1px solid rgb(239 239 239 / 18%);
}
.drawer_menu_label{
	height: 60rpx;
	width: 60rpx;
	display: block;
}

.label_title{
  font-size: 28rpx;
  flex: none;
  line-height: 56rpx;
  color: #000;
  padding: 4rpx 28rpx 4rpx;
  position: relative;
}
.label_title:first-child{
  padding-top: 9rpx;
}
.label_title::after{
  content: "";
  left: 23rpx;
  right: 23rpx;
  height: 1px;
  bottom: 0;
  background-color: #D8D8D8;
  position: absolute;
  display: none;
}
.label_content{
  position: relative;
}
.label_content::after{
  content: "";
  left: 0;
  right: 0;
  height: 1px;
  bottom: 0;
  background-color: rgb(239 239 239 / 18%);
  position: absolute;
}
.label_title image{
  display: block;
  float: left;
  margin-right: 22rpx;
}
.agent-content_line {
	position: fixed;
	bottom: 315rpx;
	left:20rpx;
	width: 80px;
	height: 608rpx;
	z-index: 1001;
	border-left: 4rpx solid #CD96FF;
	border-top: 4rpx solid #CD96FF;
	border-top-left-radius: 20px;
}
.agent_content_topLine{
	position: absolute;
	width: 16rpx;
	height: 16rpx;
	background: #fff;
	border-radius: 50%;
	bottom: 0;
	left: -10rpx;
	animation: moveBall 2s infinite linear;
	z-index: 1001;
}

@keyframes moveBall {
	0% {
		transform: translate(0, 0);
	}
	70% {
		transform: translate(0, -584rpx);
	}
	75% {
		transform: translate(20rpx, -602rpx);
	}
	100% {
		transform: translate(80px, -602rpx);
	}
}
.back_index_btn_bor{
	display: flex;
}
.back_index_btn_bor::after{
	content: "";
	clear: both;
	display: block;
}
.back_index_btn{
	margin: 0 auto;
	width: auto;
	border: 1px solid #b2d9ff;
	border-radius: 15rpx;
	padding: 10rpx 14rpx;
	display: flex;
	font-size: 32rpx;
	line-height: 33rpx;
	float: left;
	color: rgba(0,0,0,0.7);
	background: #D3E9FF;
}
.back_index_icon{
	display: block;
	float: left;
	width: 33rpx;
	height: 33rpx;
	margin-right: 10rpx;
}
.drawer_remove_chat{
  right: 20rpx;
  font-size: 28rpx;
}
.bottom_userInfo{
  left: 0;
  right: 0;
  padding-left: 28rpx;
  padding-right: 28rpx;
}
.user_avatar{
  margin-right: 10rpx;
  border-radius: 8rpx;
}
</style>
