<template>
  <MemberLayout active="follow">
    <div class="member-follow-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberFollow.title') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberFollow.empty')" />
      <div v-else class="user-grid">
        <div v-for="u in list" :key="u.id" class="user-card">
          <el-avatar :src="u.userAvatar" :size="48" />
          <div class="user-info">
            <div class="user-name">{{ u.userName }}</div>
            <div class="user-meta">
              <span>{{ u.followerNum || 0 }} {{ t('memberFollow.followers') }}</span>
              <span>{{ u.followNum || 0 }} {{ t('memberFollow.following') }}</span>
            </div>
          </div>
          <el-button
            :type="u.mutualFollow ? 'default' : 'primary'"
            size="small"
            @click="toggleFollow(u)"
          >
            {{ u.mutualFollow ? t('memberFollow.mutualFollow') : t('memberFollow.followed') }}
          </el-button>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
const { t } = useI18n()
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.followList()
    list.value = res.data?.items || res.data?.list || []
  } finally {
    loading.value = false
  }
}

async function toggleFollow(u: any) {
  try {
    await memberApi.followToggle(u.userId)
    load()
  } catch {
    ElMessage.error('操作失败，请重试')
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-follow-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.user-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

:where(.user-card) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.user-info) {
  flex: 1;
}

:where(.user-name) {
  font-size: 14px;
  font-weight: 500;
}

:where(.user-meta) {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
</style>
