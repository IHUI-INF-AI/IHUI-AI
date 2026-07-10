<template>
  <view class="page">
    <view class="loading" v-if="loading"><text>加载中...</text></view>
    <view class="content" v-else>
      <rich-text :nodes="content" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPrivacy } from '@/api'

const content = ref('')
const loading = ref(true)

onLoad(async () => {
  try { content.value = (await getPrivacy()).content } finally { loading.value = false }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fff; padding: 32rpx; }
.content { font-size: 28rpx; color: #333; line-height: 1.8; }
.loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
