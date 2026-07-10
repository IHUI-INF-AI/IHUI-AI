<template>
  <view class="page">
    <view class="header">
      <view class="month-switcher">
        <text class="arrow" @tap="prevMonth">‹</text>
        <text class="month">{{ currentMonth }}</text>
        <text class="arrow" @tap="nextMonth">›</text>
      </view>
    </view>
    <view class="calendar">
      <view class="weekdays">
        <text class="weekday" v-for="w in weekdays" :key="w">{{ w }}</text>
      </view>
      <view class="days">
        <view class="day" v-for="(d, i) in days" :key="i" :class="{ has: d.has, empty: !d.day }" @tap="onDay(d)">
          <text class="day-num">{{ d.day || '' }}</text>
          <view class="dot" v-if="d.has"></view>
        </view>
      </view>
    </view>
    <view class="lives" v-if="selectedLives.length">
      <view class="lives-title">{{ selectedDate }}的直播</view>
      <view class="live-item" v-for="l in selectedLives" :key="l.id" @tap="goDetail(l.id)">
        <image class="cover" :src="l.coverUrl" mode="aspectFill" />
        <view class="body">
          <text class="title">{{ l.title }}</text>
          <text class="time">{{ l.startTime }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getLiveCalendar, type Live } from '@/api'

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const date = ref(new Date())
const calendar = ref<Array<{ date: string; lives: Live[] }>>([])
const selectedDate = ref('')

const currentMonth = computed(() => `${date.value.getFullYear()}年${date.value.getMonth() + 1}月`)

const days = computed(() => {
  const y = date.value.getFullYear()
  const m = date.value.getMonth()
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const arr: Array<{ day: number | null; has: boolean; date: string; lives: Live[] }> = []
  for (let i = 0; i < firstDay; i++) arr.push({ day: null, has: false, date: '', lives: [] })
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const found = calendar.value.find(c => c.date === dStr)
    arr.push({ day: i, has: !!found?.lives?.length, date: dStr, lives: found?.lives || [] })
  }
  return arr
})

const selectedLives = computed(() => days.value.find(d => d.date === selectedDate.value)?.lives || [])

async function load() {
  const month = `${date.value.getFullYear()}-${String(date.value.getMonth() + 1).padStart(2, '0')}`
  try { calendar.value = (await getLiveCalendar({ month })).list || [] } catch (e) {}
}
function prevMonth() { date.value = new Date(date.value.getFullYear(), date.value.getMonth() - 1, 1); load() }
function nextMonth() { date.value = new Date(date.value.getFullYear(), date.value.getMonth() + 1, 1); load() }
function onDay(d: any) { if (d.day) selectedDate.value = d.date }
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/live/detail?id=${id}` }) }
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.header { padding: 32rpx; background: #fff; }
.month-switcher { display: flex; justify-content: center; align-items: center; gap: 32rpx; }
.month { font-size: 32rpx; color: #333; font-weight: 600; }
.arrow { font-size: 40rpx; color: #007aff; padding: 0 16rpx; }
.calendar { margin: 24rpx; padding: 24rpx; background: #fff; border-radius: 16rpx; }
.weekdays { display: flex; }
.weekday { flex: 1; text-align: center; font-size: 24rpx; color: #999; padding: 16rpx 0; }
.days { display: flex; flex-wrap: wrap; }
.day { width: 14.28%; height: 90rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
.day.empty { visibility: hidden; }
.day-num { font-size: 26rpx; color: #333; }
.dot { width: 8rpx; height: 8rpx; background: #007aff; border-radius: 50%; margin-top: 4rpx; }
.lives { margin: 0 24rpx; }
.lives-title { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 16rpx; }
.live-item { display: flex; background: #fff; border-radius: 12rpx; padding: 16rpx; margin-bottom: 16rpx; }
.cover { width: 160rpx; height: 100rpx; border-radius: 8rpx; background: #f5f5f5; }
.body { margin-left: 16rpx; flex: 1; }
.title { font-size: 26rpx; color: #333; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
</style>
