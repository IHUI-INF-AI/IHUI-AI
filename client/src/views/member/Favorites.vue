<template>
  <MemberLayout active="favorites">
    <div class="member-favorites-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberFavorites.title') }}</h2>
      <el-tabs v-model="type" @tab-change="load">
        <el-tab-pane :label="t('memberFavorites.lesson')" name="lesson" />
        <el-tab-pane :label="t('memberFavorites.ask')" name="ask" />
        <el-tab-pane :label="t('memberFavorites.circle')" name="circle" />
        <el-tab-pane :label="t('memberFavorites.article')" name="article" />
        <el-tab-pane :label="t('memberFavorites.live')" name="live" />
      </el-tabs>
      <el-empty v-if="!list.length" :description="t('memberFavorites.noFavorites')" />
      <div v-else class="fav-grid">
        <div v-for="item in list" :key="item.id" class="fav-card">
          <div class="fav-name">{{ item.name || item.title || item.id }}</div>
          <div class="fav-time">{{ item.createTime }}</div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/learn/member'

const list = ref<any[]>([])
const loading = ref(false)
const type = ref('lesson')

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.myFavorites({ type: type.value } as any)
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-favorites-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

:where(.fav-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

:where(.fav-card) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.fav-name) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

:where(.fav-time) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
