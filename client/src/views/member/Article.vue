<template>
  <MemberLayout active="article">
    <div class="member-article-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberArticle.myArticles') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberArticle.noArticle')" />
      <div v-else class="article-list">
        <div v-for="a in list" :key="a.id" class="article-item">
          <div class="article-title">{{ a.title }}</div>
          <div class="article-meta">
            <span>{{ a.createTime }}</span>
            <span>{{ t('memberArticle.read') }} {{ a.viewNum || 0 }}</span>
            <span>♥ {{ a.likeNum || 0 }}</span>
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
import { memberApi } from '@/api/member'

const { t } = useI18n()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.myArticleList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-article-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.article-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.article-item) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.article-title) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

:where(.article-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
