<template>
  <!-- 盒子 -->
  <view style="padding-bottom: 20rpx">
    <view @click="newclick(item)" v-for="item in center" :key="item.id" style="
        padding: 20rpx;
        background-color: #c4e0f4;
        border-radius: 20rpx;
        margin-bottom: 20rpx;
      ">
      <view class="center-items">
        <view class="center-items-left">
          <view class="center-items-left-top">
            <view style="display: flex; align-items: center">
              <image style="width: 60rpx; height: 60rpx" :src="item.businessesImage" mode="scaleToFill" />
              <view style="margin-left: 20rpx; color: black; font-weight: bold">{{ item.businesses }}</view>
            </view>
            <view style="
                margin-top: 20rpx;
                word-break: break-all;
                padding-right: 30rpx;
                color: black;
                font-weight: bold;
              ">{{ item.title }}</view>
          </view>
          <view style="color: #9a9a9a">{{ item.updated_at }}</view>
        </view>
        <view>
          <image style="width: 200rpx; height: 200rpx; border-radius: 20rpx" :src="item.img" mode="scaleToFill" />
        </view>
      </view>
      <view class="center-items-button">
        <view class="center-items-button-title">
          {{ item.classification }}
        </view>
        <view style="margin-left: 20rpx; color: #9a9a9a">{{ item.NumberOfForwarding }}人浏览</view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineOptions({
  name: "CenterItem"
})

defineProps({
  center: {
    type: Array,
    default() {
      return []
    },
  },
})

const emit = defineEmits(['new'])

function newclick(item) {
  emit("new", item)
}
</script>

<style scoped>
.center-items {
  display: flex;
  justify-content: space-between;
}

.center-items-left {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.center-items-button {
  padding: 10rpx 0 0 0;
  display: flex;
  align-items: center;
  height: 50rpx;
  border-top: 1rpx solid #9f9f9f;
}

.center-items-button-title {
  font-size: 24rpx;
  padding: 4rpx 20rpx;
  text-align: center;
  border-radius: 30rpx;
  background-color: #feb980;
}
</style>