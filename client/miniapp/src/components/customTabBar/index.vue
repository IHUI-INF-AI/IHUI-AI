<template>
  <view v-if="false">
    <view class="padding_bottom_safety" style="height: 100rpx;width: 100%;"></view>
    <view class="tabbar padding_bottom_safety">
      <view class="tabbarContent">
        <view class="barItem" :class="tabIndex === 1 ? 'barItemAct' : ''" @click="jump('/pages/table/tools/index', 1)">
          <view class="itemIcon">
            <image v-if="tabIndex !== 1" src="../../static/tabbar/tabbar_1.png" mode="heightFix"></image>
            <image v-if="tabIndex === 1" src="../../static/tabbar/tabbar_1_act.png" mode="heightFix"></image>
          </view>
          <view class="itemText">{{ '智能体' }}</view>
        </view>
        <view class="barItem" :class="tabIndex === 2 ? 'barItemAct' : ''" @click="jump('/pages/table/square/index', 2)">
          <view class="itemIcon">
            <image v-if="tabIndex !== 2" src="../../static/tabbar/tabbar_2.png" mode="heightFix"></image>
            <image v-if="tabIndex === 2" src="../../static/tabbar/tabbar_2_act.png" mode="heightFix"></image>
          </view>
          <view class="itemText">{{ '广场' }}</view>
        </view>
        <view class="barItem" :class="tabIndex === 3 ? 'barItemAct' : ''"
          @click="jump('/pages/table/aiIndex/ai_index', 3)">
          <view class="itemIcon">
            <image v-if="tabIndex !== 3" src="../../static/tabbar/tabbar_3.png" mode="heightFix"></image>
            <image v-if="tabIndex === 3" src="../../static/tabbar/tabbar_3_act.png" mode="heightFix"></image>
          </view>
          <view class="itemText">{{ '智汇AI' }}</view>
        </view>
        <view class="barItem" :class="tabIndex === 4 ? 'barItemAct' : ''" @click="jump('/pages/table/share/index', 4)">
          <view class="itemIcon">
            <image v-if="tabIndex !== 4" src="../../static/tabbar/tabbar_4.png" mode="heightFix"></image>
            <image v-if="tabIndex === 4" src="../../static/tabbar/tabbar_4_act.png" mode="heightFix"></image>
          </view>
          <view class="itemText">{{ '动态' }}</view>
        </view>
        <view class="barItem" :class="tabIndex === 5 ? 'barItemAct' : ''" @click="jump('/pages/table/user/index', 5)">
          <view class="itemIcon">
            <image v-if="tabIndex !== 5" src="../../static/tabbar/tabbar_5.png" mode="heightFix"></image>
            <image v-if="tabIndex === 5" src="../../static/tabbar/tabbar_5_act.png" mode="heightFix"></image>
          </view>
          <view class="itemText">{{ '我的' }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({
  name: 'customTabBar'
})

defineProps({
  tabIndex: {
    type: Number,
    default: 0,
  },
  showTabbar: {
    type: Boolean,
    default: false,
  }
})

const jump = (url, idx) => {
  uni.reLaunch({
    url: url
  })
}

const onShareAppMessage = () => {
}

defineExpose({
  onShareAppMessage
})
</script>

<style scoped lang="scss">
.tabbar {
  box-sizing: border-box;
  min-height: 100rpx;
  width: 100vw;
  position: fixed;
  bottom: 0;
  z-index: 2;
  padding: 10rpx 20rpx 5rpx;
  background-color: #FFF;
  border-top: 1rpx solid #f5f5f5;
}

.tabbarContent {
  background: rgb(255 255 255 / .5);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(8rpx);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0rpx 0 20rpx 0rpx rgb(255 255 255 / 0.8);
}

.tabbarLine {
  width: 100%;
  margin-bottom: -20rpx;
}

.tabbarLine image {
  display: block;
}

.tabbar_line {
  width: 35rpx;
  height: 35rpx;
  background: rgb(255 255 255 / .5);
  clip-path: inset(0 0 round 0 25%);
  border-radius: 4rpx 4rpx 0 0;
  backdrop-filter: blur(10rpx);
  margin: 0 auto;
  transform: rotate(135deg);
  margin-bottom: -18rpx;
}

.barItem {
  box-sizing: border-box;
  width: 18%;
  height: auto;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #000;
  font-size: 23rpx;
}

.barItemAct {
  color: #4a82ff !important;
  font-weight: 600 !important;
}

.itemIcon {
  box-sizing: border-box;
  width: 55rpx;
  height: 55rpx;

  image {
    width: 100%;
    height: 55rpx;
    display: block;
  }

  .image_svg {
    width: 180rpx;
    height: 180rpx;
    margin-top: -64rpx;
    margin-left: -64rpx;
  }
}
</style>