<template>
  <view class="scroll-title">
    <scroll-view scroll-x class="scroll-view">
      <view class="scroll-content">
        <view 
          v-for="(item, index) in informationList" 
          :key="index"
          class="scroll-item"
          :class="{ 'active': activeIndex === index }"
          @click="handleClick(index, item)"
        >
          <text>{{ item.name || item.title || '' }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  informationList: {
    type: Array,
    default: () => []
  },
  tagWrapShow: {
    type: Boolean,
    default: false
  },
  noMore: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['sub-change', 'custom-event'])

const activeIndex = ref(0)

function handleClick(index, item) {
  activeIndex.value = index
  emit('sub-change', item)
  emit('custom-event', item)
}
</script>

<style scoped>
.scroll-title {
  width: 100%;
}

.scroll-view {
  white-space: nowrap;
}

.scroll-content {
  display: inline-flex;
  padding: 16rpx 0;
}

.scroll-item {
  display: inline-block;
  padding: 12rpx 24rpx;
  margin-right: 16rpx;
  font-size: 26rpx;
  color: #666;
  background: #f5f5f5;
  border-radius: 30rpx;
}

.scroll-item.active {
  color: #fff;
  background: #007aff;
}
</style>
