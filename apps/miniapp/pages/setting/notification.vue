<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="n in list" :key="n.key">
        <text class="title">{{ n.title }}</text>
        <switch :checked="form[n.key]" @change="onChange(n.key, $event)" color="#007aff" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getNotificationSettings, updateNotificationSettings } from '@/api'

const list = ref<Array<{ key: string; title: string; enabled: boolean }>>([])
const form = reactive<Record<string, boolean>>({})

async function load() {
  try {
    list.value = (await getNotificationSettings()).list || []
    list.value.forEach(n => { form[n.key] = n.enabled })
  } catch (e) {}
}
async function onChange(key: string, e: any) {
  form[key] = e.detail.value
  try { await updateNotificationSettings({ [key]: e.detail.value }) } catch (e) {}
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.item:last-child { border-bottom: none; }
.title { font-size: 28rpx; color: #333; }
</style>
