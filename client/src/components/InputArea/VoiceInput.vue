<template>
  <div class="voice-input-container" v-if="isVoiceAnimationActive">
    <div class="voice-bar-animation">
      <div
        class="line"
        :class="isVoiceAnimationActiveStart ? 'line' + (n + 1) : ''"
        v-for="n in 30"
        :key="n"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isVoiceAnimationActive, isVoiceAnimationActiveStart } = defineProps<{
  isVoiceAnimationActive: boolean
  isVoiceAnimationActiveStart: boolean
}>()

// 注意：VoiceInput 组件不再触发停止事件
// 停止录音只能通过用户明确点击 VoiceRecordingAnimation 组件中的停止按钮来实现
// 这样可以防止鼠标离开或触摸取消等意外事件导致录音停止
// emit 已移除，因为不再需要触发停止事件
</script>

<style lang="scss" scoped>
.voice-bar-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 150px;
  height: 20px;
  flex: none;
  margin: 0 auto;
}

.line {
  height: 3px;
  width: 3px;
  background-color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
  transition: all 1s;
}

@keyframes move {
  0% {
    top: 0;
    height: 32.5px;
  }

  100% {
    top: 7.5px;
    height: 12.5px;
  }
}

.line1 {
  left: 4px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.25s;
}

.line2 {
  left: 8px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.5s;
}

.line3 {
  left: 12px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.75s;
}

.line4 {
  left: 16px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1s;
}

.line5 {
  left: 20px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.25s;
}

.line6 {
  left: 24px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.5s;
}

.line7 {
  left: 28px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.75s;
}

.line8 {
  left: 32px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2s;
}

.line9 {
  left: 36px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.25s;
}

.line10 {
  left: 40px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.5s;
}

.line11 {
  left: 44px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.75s;
}

.line12 {
  left: 48px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3s;
}

.line13 {
  left: 52px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.25s;
}

.line14 {
  left: 56px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.5s;
}

.line15 {
  left: 60px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.75s;
}

.line16 {
  left: 64px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4s;
}

.line17 {
  left: 68px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.25s;
}

.line18 {
  left: 72px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.5s;
}

.line19 {
  left: 76px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.75s;
}

.line20 {
  left: 80px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5s;
}

.line21 {
  left: 84px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.25s;
}

.line22 {
  left: 88px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.5s;
}

.line23 {
  left: 92px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.75s;
}

.line24 {
  left: 96px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6s;
}

.line25 {
  left: 100px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.25s;
}

.line26 {
  left: 104px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.5s;
}

.line27 {
  left: 108px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.75s;
}

.line28 {
  left: 112px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7s;
}

.line29 {
  left: 116px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7.25s;
}

.line30 {
  left: 120px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7.5s;
}
</style>
