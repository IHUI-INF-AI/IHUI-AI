<template>
  <MemberLayout active="comment">
    <div class="member-comment-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberComment.myComments') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberComment.noComment')" />
      <div v-else class="comment-list">
        <div v-for="c in list" :key="c.id" class="comment-item">
          <div class="comment-head">
            <el-tag size="small">{{ c.refType }}</el-tag>
            <span class="ref-title">{{ c.refTitle || c.refId }}</span>
          </div>
          <div class="comment-content">{{ c.content }}</div>
          <div class="comment-meta">
            <span>{{ c.createTime }}</span>
            <span>♥ {{ c.likeNum || 0 }}</span>
            <span>{{ t('memberComment.reply') }} {{ c.replyNum || 0 }}</span>
          </div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/learn/member'

const { t } = useI18n()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.myComments()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-comment-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.comment-list) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:where(.comment-item) {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.comment-head) {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

:where(.ref-title) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:where(.comment-content) {
  font-size: 14px;
  margin-bottom: 8px;
}

:where(.comment-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
