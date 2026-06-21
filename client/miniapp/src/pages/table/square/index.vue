<template>
  <view class="">
    <Loading v-if="loading"></Loading>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import Loading from "@/components/loading/index.vue";

const loading = ref(true)

const onShareAppMessage = () => {
  const userData = uni.getStorageSync('data') || {};
  const inviteCode = userData.inviteCode || '';
  return {
    title: 'AI智汇社',
    path: `/pages/table/aiIndex/ai_index?source=share&inviteCode=${inviteCode}`,
    imageUrl: '/static/images/20250530152648.png',
    success: function (res) {
      uni.showToast({
        title: '分享成功',
        icon: 'success'
      });
    },
    fail: function (res) {
      uni.showToast({
        title: '分享失败',
        icon: 'none'
      });
    }
  };
}
</script>
