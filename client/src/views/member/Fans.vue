<template>
  <MemberLayout active="fans">
    <div class="member-fans-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberFans.myFans') }}</h2>
      <el-empty v-if="!list.length" :description="t('memberFans.noFans')" />
      <div v-else class="user-grid">
        <div v-for="u in list" :key="u.id" class="user-card">
          <el-avatar :src="u.userAvatar" :size="48" />
          <div class="user-info">
            <div class="user-name">{{ u.userName }}</div>
            <div class="user-bio">{{ u.bio || t('memberFans.lazyPerson') }}</div>
          </div>
          <el-button
            :type="u.mutualFollow ? 'default' : 'primary'"
            size="small"
            @click="toggleFollow(u)"
          >
            {{ u.mutualFollow ? '已互关' : '+ 关注' }}
          </el-button>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const { t } = useI18n()
const list = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.fansList()
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
:where(.member-fans-page) {
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

:where(.user-bio) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
