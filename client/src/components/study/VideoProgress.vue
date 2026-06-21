<template>
  <div>
    <div class="modal-overlay"></div>
    <div class="progress-dialog">
      <div class="progress-box">
        <div class="progress-back"></div>
        <div class="progress-content">
          <div class="progress-title">
            <div class="title-row">
              <img src="https://file.aizhs.top/sys-mini/default/sikao.png" class="title-icon" loading="lazy" />
              <span>{ t('studyVideoProgress.videoUploading') }</span>
              <div class="loader-container">
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
              </div>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: thinkingProgress + '%' }"></div>
              <div class="progress-text">{{ Math.floor(Number(thinkingProgress)) }}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'VideoProgress' })


const props = defineProps<{
  totalSize?: number
  overSize?: number
  totalCount?: number
  overCount?: number
  title?: string
}>()

const thinkingProgress = computed(() => {
  if (!props.totalSize || !props.overSize) return 0
  return (props.overSize * 100 / props.totalSize).toFixed(1)
})
</script>

<style scoped>
/* stylelint-disable color-no-hex */

/* 豁免原因：进度条彩虹动画属于装饰性艺术效果，颜色为结构性数据 */
.modal-overlay {
  position: fixed;
  z-index: var(--z-dropdown);
  inset: 0;
  background: var(--color-black-30);
}

.progress-dialog {
  position: fixed;
  z-index: var(--z-dropdown);
  top: calc((100vh - 250px) / 2);
  left: 40px;
  right: 40px;
  box-shadow: var(--global-box-shadow);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--el-bg-color);
}

.progress-box {
  position: relative;
  height: 100%;
  opacity: 0.4;
}

.progress-back {
  background: linear-gradient(to right, var(--color-purple-722ed1) 30%, var(--el-color-primary) 50%, var(--color-green-52c41a) 70%);
  position: absolute;
  inset: -150px;
  animation: rotate 5s linear infinite;
}

@keyframes rotate { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }

.progress-content {
  position: relative;
  inset: 2px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
  padding: 12px;
  opacity: 1;
}

.progress-title {
  display: flex;
  flex-direction: column;
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  padding: 12px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-icon {
  width: 15px;
  height: 15px;
}

.progress-bar-container {
  width: 100%;
  height: 18px;
  background-color: var(--color-gray-light);
  border-radius: var(--global-border-radius);
  margin: 10px 0;
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(214deg, var(--color-purple-722ed1) 3%, var(--color-amber-fbbf24) 30%, var(--color-red-f5222d) 55%, var(--color-amber-fbbf24) 75%, var(--color-purple-722ed1) 96%);
  background-size: 200% 100%;
  border-radius: var(--global-border-radius);
  transition: width 0.3s ease;
  animation: progressAnimation 2s infinite;
}

@keyframes progressAnimation {
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}

.progress-text {
  position: absolute;
  left: 50%;
  line-height: 18px;
  transform: translateX(-50%);
  color: var(--color-black);
  top: 0;
}

.loader-container {
  display: flex;
  align-items: center;
  gap: 3px;
}

.loader-dot {
  height: 10px;
  width: 15px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-purple-d7b3fc);
  animation: loaderpulse 1.5s infinite ease-in-out;
}

@keyframes loaderpulse {
  0%{transform:scale(0.8);background-color:var(--color-purple-d7b3fc);box-shadow:0 0 0 0 var(--color-purple-mix-7)}
  50%{transform:scale(1.2);background-color:var(--color-purple-ae44d1);box-shadow:0 0 0 10px var(--color-cyan-b2d4fc-fade)}
  100%{transform:scale(0.8);background-color:var(--color-purple-d7b3fc);box-shadow:0 0 0 0 var(--color-purple-mix-7)}
}
.loader-dot:nth-child(1){animation-delay:-0.1875s}
.loader-dot:nth-child(2){animation-delay:-0.0625s}
.loader-dot:nth-child(3){animation-delay:0.0625s}
.loader-dot:last-child{margin-right:0}
</style>
