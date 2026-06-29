<template>
    <view class="drawer_back" :class="{ 'drawer-open': tagWrapShow }">
      <view class="drawer_back" :class="{ 'drawer-open': tagWrapShow }" v-show="tagWrapShow" style="background-color: rgb(0 0 0 / 0.4);" @click="close_drawer"></view>
      <view class="drawer_border" :class="{ 'drawer-open': tagWrapShow }">
          <view class="drawer" :style="{paddingTop:statusBarHeight}">
          <!-- Drawer header with image -->
          <view class="drawer-header">
              <view class="logobox">
                <image class="logo" style="height: 66rpx;" src="/static/images/default/choutilogo_h.png" mode="heightFix" />
              </view>
              <image class="drawer-close" @click="close_drawer" src="/static/images/default/close_drawer.svg" mode="widthFix"></image>
          </view>
          <view class="drawer_menu">
              <view class="drawer_menu_item" @click="gopage('/pages/table/tools/index')">
                  <image class="drawer_menu_label" src="../static/tabbar/tabbar_1.png" mode="heightFix"></image>
                  <text class="drawer_menu_text">应用商店</text>
              </view>
              <view class="drawer_menu_item" @click="gopage('/pages/table/square/index')">
                  <image class="drawer_menu_label" src="/static/images/default/drawer_menu2.png" mode="heightFix"></image>
                  <text class="drawer_menu_text">需求广场</text>
              </view>
              <view class="drawer_menu_item" @click="gopage('/pages/tools/aigc/index')">
                  <image class="drawer_menu_label" src="/static/images/default/linggan.svg" mode="heightFix"></image>
                  <text class="drawer_menu_text">灵感</text>
              </view>
              <view class="drawer_menu_item" @click="gopage('/pages/table/share/index')">
                  <image class="drawer_menu_label" src="../static/tabbar/tabbar_4.png" mode="heightFix"></image>
                  <text class="drawer_menu_text">动态</text>
              </view>
              <!-- <image @click="gopage('/pages/tools/aigc/index')" class="drawer_menu_label" src="https://file.aizhs.top/sys-mini/default/drawer_menu4.png" mode="heightFix"></image> -->
              <view class="drawer_menu_item" @click="gopage('/pagesA/studyindex/index')">
                  <image class="drawer_menu_label" src="/static/images/default/kecheng.png" mode="heightFix"></image>
                  <text class="drawer_menu_text">课程</text>
              </view>
          </view>
          <view class="label_content">
              <view class="label_title" @click.stop="gotocompany"><image style="width: 56rpx;height: 56rpx;margin-right: 14rpx;" src="/static/images/default/gongsi.png" mode="widthFix"></image>我的一人公司</view>
              <view class="label_title" @click.stop="lingqu"><image style="width: 56rpx;height: 56rpx;margin-right: 14rpx;" src="/static/images/default/mian_label.png" mode="widthFix"></image>领取免费资料</view>
              <view class="label_title" @click.stop="addNewChat"><image style="width: 50rpx;height: 50rpx;margin-left: 4rpx;margin-right: 15rpx;margin-top: 4rpx;" src="/static/images/default/newchat.svg" mode="widthFix"></image>创建新对话</view>
          </view>
          <!-- Menu list -->
          <scroll-view class="drawer-menu" scroll-y :show-scrollbar="true">
              <view class="drawer_remove_chat">左滑删除对话</view>
              <view style="font-size: 28rpx;color: #000;font-weight: bold;padding-top: 12rpx;padding-bottom: 10rpx;">历史对话</view>
              <view v-for="(items, date) in sortedGroupedData" :key="date" class="date-group">
                <view class="date-title">{{ items.name }}</view>
                <view v-for="(item, index) in items.list" :key="index" class="menu-item" :class="date == sortedActiveIndices.sortedDateIndex && index == sortedActiveIndices.sortedItemIndex ? 'menu-item_active':''" @click="handleShowFullList(item, index,date)" @touchstart="handleTouchStart($event, index,date)" @touchmove="handleTouchMove($event, index,date)" @touchend="handleTouchEnd($event, index,date)">
                    <text class="menu-text" :class="date == sortedActiveIndices.sortedDateIndex && index == sortedActiveIndices.sortedItemIndex ? 'menu_text':''">{{ item.mark }}</text>
                    <image class="menu_remove" :style="{ transform: `translateX(${item.isShow ? '-101':'0'}rpx)` }" @click.stop="removeChat(item.id, index,date)" src="/static/images/default/close_chat.png" mode="widthFix" style="width: 48rpx;height: 48rpx;display: block;"></image>
                </view>
              </view>
          </scroll-view>
          <view v-if="showIndexBtn" class="back_index_btn_bor">
            <view class="back_index_btn" @click="gobackIndex">
              <image class="back_index_icon" src="/static/images/default/back_index.png" mode="widthFix"></image>
              回到主页
            </view>
          </view>
          <view class="bottom_userInfo">
            <view @click="gopage('/pages/table/user/index')">
                <image class="user_avatar" :src="userinfo && userinfo.avatar ? userinfo.avatar : '/static/images/daixaodiming.png'" mode="aspectFill"></image>
                <text class="user_nickname">{{ userinfo && userinfo.nickname ? userinfo.nickname : '' }}</text>
            </view>
            <view style="display: flex; align-items: center; gap: 20rpx;">
              <image @click="gopage('/pages/table/user/index')" class="set_btn" src="/static/images/default/setting_icon.png" mode="widthFix"></image>
              <image @click.stop="handleMessageClick" class="set_btn" src="/static/images/default/mesg.svg" mode="widthFix"></image>
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
  active_date: Number,
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
    default: false
  },
  showTabbar: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'close-drawer',
  'go-page',
  'lingqu',
  'add-new-chat',
  'show-full-list',
  'touch-start',
  'touch-move',
  'touch-end',
  'remove-chat'
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
  uni.navigateTo({ url: '/pages/table/user/index' })
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
  uni.reLaunch({
    url: '/pages/table/aiIndex/ai_index'
  })
}

function handleMessageClick() {
  uni.navigateTo({
    url: '/pagesA/message/index'
  })
}
</script>

<style scoped lang="scss">
/* 将原有的样式复制到这里 */
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

	// background: linear-gradient(214deg, #8B0BFF 3%, #FFF200 30%, #C0C6FF 55%, #FFF200 75%, #9014FF 96%);
	padding: 0;
	box-sizing: border-box;
	border-radius: 0 30rpx 30rpx 0;

	// box-shadow: 0px 0px 6rpx 0px rgba(0, 0, 0, 0.3);
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
	padding: 0;
	box-sizing: border-box;
	position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;

  // border: 4rpx solid #7d83fd;
}

.drawer-header {
	position: relative;
	height: auto;
  padding-top: 0;
	
	.drawer-image {
		width: 100rpx;
		height: 100rpx;
		margin: 54rpx auto 0;
		display: block;
	}

	.drawer-image1 {
		width: 100rpx;
		height: 100rpx;
		margin: 10rpx auto 0;
		display: block;
	}

	.drawer-image2 {
		width: 100rpx;
		height: 100rpx;
		margin: 10rpx auto 0;
		display: block;
	}
	
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
	margin-right: 0;
  padding-left: 14rpx;
  padding-bottom: 80rpx;
  flex: 1;
  min-height: 0;
  height: 0;
  position: relative;
  box-sizing: border-box;
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

.model-group {
	margin-bottom: 20rpx;
	padding-left: 0;
}

.model-title {
	font-size: 28rpx;
  font-weight: bold;
	color: #666;
	margin-bottom: 0;
	padding-left: 0;
	padding: 8rpx 15rpx 0 0;
	border-radius: 8rpx;
	display: inline-flex;
	align-items: center;
}

.model-logo {
	width: 32rpx;
	height: 32rpx;
	margin-right: 8rpx;
	border-radius: 4rpx;
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

.menu-icon {
	width: 40rpx;
	height: 40rpx;
	margin-right: 10rpx;
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

    // border-bottom: 1px solid #D8D8D8;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo {
    width: 316rpx;
    height: 88rpx;
    margin-right: 12rpx;
  }

  .input-wbox {
    width: 100%;
    display: flex;
    justify-content: center;
  }


  .titlebox {
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }

  .titlebox-image {
    margin-top: 0;
    width: 160rpx;
    height: 37rpx;
  }

  .titlebox-image1 {
    margin-top: 8rpx;
    width: 162rpx;
    height: 66rpx;
  }

  .top_box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 30%;
  }

}

.drawer_menu{
	padding: 15rpx 28rpx 25rpx;
	box-sizing: border-box;
	display: flex;
	justify-content: space-between;
	border-bottom: 1px solid rgb(239 239 239 / 0.35);
}

.drawer_menu_item{
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	cursor: pointer;
}

.drawer_menu_label{
	height: 60rpx;
	width: 60rpx;
	display: block;
}

.drawer_menu_text{
	font-size: 24rpx;
	color: #000;
	margin-top: 8rpx;
	text-align: center;
}

.label_title{
  font-size: 28rpx;
  flex: none;
  line-height: 56rpx;
  color: #000;
  padding: 4rpx 28rpx;
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
  background-color: rgb(239 239 239 / 0.35);
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

	// background: #000;
	z-index: 1001;
	border-left: 4rpx solid #CD96FF;
	border-top: 4rpx solid #CD96FF;
	border-top-left-radius: 20px;

	// border-image: linear-gradient(186deg, #D19EFF 0%, rgba(255, 242, 0, 0.3) 29%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 76%, #CD96FF 99%) ;
	// animation: drawLine 2s forwards;
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
	flex-shrink: 0;
	position: relative;
	z-index: 10;
	margin-bottom: 20rpx;
}

.back_index_btn_bor::after{
	content: "";
	clear: both;
	display: block;
}

.back_index_btn{
	margin: 0 auto;
	width: auto;
	border: 1px solid #c8e4ff;
	border-radius: 15rpx;
	padding: 10rpx 14rpx;
	display: flex;
	font-size: 32rpx;
	line-height: 33rpx;
	float: left;
	color: rgb(0 0 0 / 0.7);
	background: #ECF6FF;
	position: relative;
	z-index: 10;
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
  flex-shrink: 0;
  padding-left: 28rpx;
  padding-right: 28rpx;
  position: relative;
  z-index: 1;
  border-top: 1px solid rgb(239 239 239 / 0.35);
}

.user_avatar{
  margin-right: 10rpx;
  border-radius: 8rpx;
}
</style>
