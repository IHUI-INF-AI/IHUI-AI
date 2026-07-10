<template>
  <view class="page">
    <view class="header">
      <text class="timer">{{ formatTime(remain) }}</text>
      <text class="progress">{{ currentIdx + 1 }}/{{ questions.length }}</text>
    </view>
    <view class="question" v-if="current">
      <text class="q-title">{{ currentIdx + 1 }}. {{ current.title }}</text>
      <view class="options">
        <view class="option" v-for="(opt, i) in current.options" :key="i" :class="{ active: answers[current.id] === i }" @tap="select(i)">
          <view class="opt-radio">{{ ['A', 'B', 'C', 'D'][i] }}</view>
          <text class="opt-text">{{ opt }}</text>
        </view>
      </view>
    </view>
    <view class="footer">
      <button class="btn" v-if="currentIdx > 0" @tap="prev">上一题</button>
      <button class="btn primary" v-if="currentIdx < questions.length - 1" @tap="next">下一题</button>
      <button class="btn primary" v-else @tap="onSubmit">交卷</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getExamDetail, submitExam } from '@/api'

const questions = ref<Array<{ id: string; title: string; options: string[] }>>([])
const currentIdx = ref(0)
const answers = ref<Record<string, number>>({})
const remain = ref(0)
const examId = ref('')
let timer: any = null

const current = computed(() => questions.value[currentIdx.value])

onLoad(async (q: any) => {
  examId.value = q.id
  try {
    const exam = await getExamDetail(q.id)
    questions.value = exam.questions || []
    remain.value = exam.duration * 60
    timer = setInterval(() => {
      remain.value--
      if (remain.value <= 0) onSubmit()
    }, 1000)
  } catch (e) {}
})
onUnmounted(() => clearInterval(timer))

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
function select(i: number) { answers.value[current.value.id] = i }
function prev() { if (currentIdx.value > 0) currentIdx.value-- }
function next() { if (currentIdx.value < questions.value.length - 1) currentIdx.value++ }

async function onSubmit() {
  clearInterval(timer)
  try {
    const res = await submitExam({ examId: examId.value, answers: answers.value })
    uni.redirectTo({ url: `/pages/exam/result?id=${examId.value}&score=${res.score}&pass=${res.pass}` })
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.header { display: flex; justify-content: space-between; padding: 24rpx 32rpx; background: #fff; }
.timer { font-size: 32rpx; color: #dd524d; font-weight: 700; }
.progress { font-size: 26rpx; color: #666; }
.question { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.q-title { font-size: 32rpx; color: #333; font-weight: 600; line-height: 1.6; }
.options { margin-top: 32rpx; }
.option { display: flex; align-items: center; padding: 24rpx; border: 2rpx solid #eee; border-radius: 12rpx; margin-bottom: 16rpx; }
.option.active { border-color: #007aff; background: #e6f0ff; }
.opt-radio { width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center; border: 2rpx solid #ccc; border-radius: 50%; font-size: 26rpx; color: #666; }
.option.active .opt-radio { border-color: #007aff; background: #007aff; color: #fff; }
.opt-text { flex: 1; margin-left: 24rpx; font-size: 28rpx; color: #333; }
.footer { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; display: flex; gap: 24rpx; }
.btn { flex: 1; background: #fff; color: #333; border-radius: 40rpx; font-size: 30rpx; }
.btn.primary { background: #007aff; color: #fff; }
</style>
