<template>
  <div class="study-tip">
    <div class="tip-content">
      <img class="icon-tip" src="https://file.aizhs.top/sys-mini/xtk/study_icon_tip.png" loading="lazy" />
      <div class="scroll-container">
        <div class="tip-text-wrapper">
          <span class="tip-text">{{ t('studyIndexStudyTip.studyTip') }}</span>
          <span class="tip-text">{{ t('studyIndexStudyTip.studyTip2') }}</span>
        </div>
      </div>
      <div class="my-model" @click="toMyModel">
        <span>{{ t('studyIndexStudyTip.myGroups') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  toMyModel: []
}>()

function toMyModel() {
  emit('toMyModel')
}
</script>

<style scoped>
.study-tip {
  background: var(--color-blue-d9e6fd);
  padding: 1px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  width: 100%;
  margin-bottom: 18px;
}

.tip-content {
  width: 100%;
  background-color: var(--color-gray-eee);
  border-radius: var(--global-border-radius);
  height: auto;
  box-sizing: border-box;
  padding: 2px 3px;
  display: flex;
  align-items: center;
}

.icon-tip {
  width: 24px;
  height: 24px;
  margin-right: 6px;
  flex-shrink: 0;
}

.scroll-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}

.tip-text-wrapper {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: scroll-left 8s linear infinite;
}

.tip-text {
  font-family: AlimamaFangYuanTi, sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: var(--color-gray-666);
  white-space: nowrap;
  padding-right: 10px;
}

@keyframes scroll-left {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

.my-model {
  width: 72px;
  box-sizing: border-box;
  color: var(--color-black);
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  background: var(--color-blue-d9e6fd);
  backdrop-filter: blur(10px);
  font-weight: bold;
  margin-right: 2px;
  padding: 4px 0;
  text-align: center;
  cursor: pointer;
  flex-shrink: 0;
}

.my-model span {
  font-size: 12px;
}
</style>
