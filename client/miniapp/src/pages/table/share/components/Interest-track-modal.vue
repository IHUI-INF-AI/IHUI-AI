//工具页面 弹窗 --- 选择兴趣赛道1
<template>
  <view class="modal-overlay" v-if="visible">
    <view class="modal-content">
      <view class="modal-close" @click="emit('close')">×</view>
      <view class="modal-body">
        <view class="modal-text-container">
          <text class="modal-text">请选择新闻分类</text>
          <view class="interest-grid">
            <view
              class="interest-row"
              v-for="(row, rowIndex) in interestTracks"
              :key="rowIndex"
            >
              <view
                class="interest-item"
                :class="{ active: selectedInterest === item }"
                v-for="(item, index) in row"
                :key="index"
                @click="selectInterest(item)"
              >
                <text>{{ item }}</text>
              </view>
            </view>
          </view>

          <view class="modal-footer">
            <view class="modal-button" @click="confirmSelection">确认</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

defineOptions({
  name: "InterestTrackModal"
})

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  interestTracks: {
    type: Array,
    default: () => [],
  },
  interestPages: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['close', 'confirm'])

const selectedInterest = ref("")

function selectInterest(interest) {
  selectedInterest.value = interest
}

function confirmSelection() {
  if (!selectedInterest.value) {
    uni.showToast({
      title: "请选择自己的兴趣赛道",
      icon: "none",
    })
    return
  }

  emit("confirm", selectedInterest.value)
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgb(0 0 0 / 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.modal-content {
  width: 720rpx;
  background-color: rgb(179 199 231 / 0.65);
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 0 30rpx rgb(0 0 0 / 0.1);
  position: relative;
}

.modal-close {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: white;
  z-index: 2;
}

.modal-body {
  padding: 60rpx 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-text-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.modal-text {
  font-size: 34rpx;
  color: white;
  text-align: center;
  margin-bottom: 30rpx;
  font-weight: bold;
}

.interest-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0 20rpx;
  border-bottom: none;
}

.interest-row {
  display: flex;
  width: 100%;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.interest-item {
  flex: 1;
  padding: 15rpx 0;
  background: rgb(179 199 231 / 0.65);
  border-radius: 20rpx;
  text-align: center;
  margin: 0 10rpx;
  font-size: 28rpx;
  color: #333;
  box-shadow: 0 0 5rpx rgb(0 0 0 / 0.05);

  // border: 1px solid #e8e8e8;
}

.interest-item.active {
  background: radial-gradient(circle,rgb(63 110 204 / 1) 0%, rgb(165 200 240 / 1) 100%);
  color:white;

  // border: 1px solid #e3eff7;
}

.modal-footer {
  padding: 20rpx 0;
  display: flex;
  justify-content: center;
  margin-top: 10rpx;
}

.modal-button {
  width: 170rpx;
  height: 70rpx;
  background-color: rgb(179 199 231 / 0.65);

  // border: 1px solid #e8e8e8;
  color: black;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  font-size: 30rpx;
}

.modal-button.active {
  color: black;
  border: 1px solid #eef4f8;
}
</style>