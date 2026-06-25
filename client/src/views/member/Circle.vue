<template>
  <MemberLayout active="circle">
    <div class="member-circle-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberCircle.title') }}</h2>

      <h3 class="block-title">{{ t('memberCircle.joinedCircles') }}</h3>
      <el-empty v-if="!circleList.length" :description="t('memberCircle.emptyCircle')" />
      <div v-else class="grid">
        <div v-for="c in circleList" :key="c.id" class="card">
          <div class="name">{{ c.name }}</div>
          <div class="desc">{{ c.description }}</div>
        </div>
      </div>

      <h3 class="block-title">{{ t('memberCircle.publishedPosts') }}</h3>
      <el-empty v-if="!postList.length" :description="t('memberCircle.emptyPost')" />
      <div v-else class="post-list">
        <div v-for="p in postList" :key="p.id" class="post-item">
          <div class="post-content">{{ p.content || p.title }}</div>
          <div class="post-meta">
            <span>{{ p.createTime }}</span>
            <span>♥ {{ p.likeNum || 0 }}</span>
          </div>
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

const circleList = ref<any[]>([])
const postList = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [c, p] = await Promise.all([
      memberApi.myCircleList(),
      memberApi.myCirclePost(),
    ])
    circleList.value = (c as any).data?.items || (c as any).data?.list || []
    postList.value = (p as any).data?.items || (p as any).data?.list || []
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-circle-page) {
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

:where(.grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

:where(.card) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.name) {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

:where(.desc) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.post-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.post-item) {
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.post-content) {
  font-size: 14px;
  margin-bottom: 8px;
}

:where(.post-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
