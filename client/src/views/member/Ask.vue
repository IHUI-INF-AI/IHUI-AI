<template>
  <MemberLayout active="ask">
    <div class="member-ask-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberAsk.title') }}</h2>

      <h3 class="block-title">{{ t('memberAsk.myQuestions') }}</h3>
      <el-empty v-if="!askList.length" :description="t('memberAsk.emptyQuestion')" />
      <div v-else class="qa-list">
        <div v-for="q in askList" :key="q.id" class="qa-item">
          <div class="qa-title">{{ t('memberAsk.askPrefix') }}{{ q.title }}</div>
          <div class="qa-meta">
            <span>{{ q.createTime }}</span>
            <span>{{ q.answerNum || 0 }} {{ t('memberAsk.answers') }}</span>
          </div>
        </div>
      </div>

      <h3 class="block-title">{{ t('memberAsk.myAnswers') }}</h3>
      <el-empty v-if="!answerList.length" :description="t('memberAsk.emptyAnswer')" />
      <div v-else class="qa-list">
        <div v-for="a in answerList" :key="a.id" class="qa-item">
          <div class="qa-title">{{ t('memberAsk.answerPrefix') }}{{ a.content?.slice(0, 80) }}</div>
          <div class="qa-meta">
            <span>{{ a.createTime }}</span>
            <span>♥ {{ a.likeNum || 0 }}</span>
          </div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/learn/member'

const { t } = useI18n()
const askList = ref<any[]>([])
const answerList = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [a, b] = await Promise.all([
      memberApi.myAskList(),
      memberApi.myAnswerList(),
    ])
    askList.value = (a as any).data?.items || (a as any).data?.list || []
    answerList.value = (b as any).data?.items || (b as any).data?.list || []
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-ask-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

:where(.block-title) {
  margin: 16px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

:where(.qa-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.qa-item) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.qa-title) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:where(.qa-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
