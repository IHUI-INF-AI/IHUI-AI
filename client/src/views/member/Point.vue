<template>
  <MemberLayout active="point">
    <div class="member-point-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberPoint.myPoints') }}</h2>

      <div class="overview">
        <div class="overview-card">
          <div class="num">{{ account?.total || 0 }}</div>
          <div class="label">{{ t('memberPoint.totalPoints') }}</div>
        </div>
        <div class="overview-card">
          <div class="num">{{ account?.available || 0 }}</div>
          <div class="label">{{ t('memberPoint.available') }}</div>
        </div>
        <div class="overview-card">
          <div class="num">{{ account?.used || 0 }}</div>
          <div class="label">{{ t('memberPoint.used') }}</div>
        </div>
        <div class="overview-card">
          <div class="num">Lv.{{ account?.level || 0 }}</div>
          <div class="label">{{ t('memberPoint.level') }}</div>
        </div>
      </div>

      <div class="sign-section">
        <el-button
          type="primary"
          :disabled="signStatus.signed"
          @click="handleSign"
        >
          {{ signStatus.signed ? '今日已签到' : '每日签到' }}
        </el-button>
        <span class="sign-tip">{{ t('memberPoint.continuousSign') }} {{ signStatus.continuous || 0 }} {{ t('memberPoint.days') }}</span>
      </div>

      <h3 class="block-title">{{ t('memberPoint.pointDetails') }}</h3>
      <el-empty v-if="!list.length" :description="t('common.noData')" />
      <div v-else class="log-list">
        <div v-for="log in list" :key="log.id" class="log-item">
          <div class="log-info">
            <div class="log-action">{{ log.ruleName || log.action }}</div>
            <div class="log-time">{{ log.createTime }}</div>
          </div>
          <div class="log-point" :class="{ minus: log.point < 0 }">
            {{ log.point > 0 ? '+' : '' }}{{ log.point }}
          </div>
        </div>
      </div>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/learn/member'
import type { PointLog } from '@/api/learn/learn/member'

const { t } = useI18n()
const account = ref<Record<string, unknown>>({})
const list = ref<PointLog[]>([])
const signStatus = ref<{ signed: boolean; continuous: number }>({ signed: false, continuous: 0 })
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const [acc, log, ss] = await Promise.all([
      memberApi.pointAccount(),
      memberApi.pointLog(),
      memberApi.pointSignStatus(),
    ])
    account.value = acc.data?.data || {}
    list.value = (log.data?.data?.items || log.data?.data?.list) || []
    signStatus.value = ss.data?.data || { signed: false, continuous: 0 }
  } catch (e) { console.error(e) } finally {
    loading.value = false
  }
}

async function handleSign() {
  try {
    const res = await memberApi.pointTodaySign()
    ElMessage.success(`签到成功 +${res.data?.data?.point || 0} 积分`)
    load()
  } catch (e) {
    console.error(e)
    ElMessage.error(t('common.errors.signFailed'))
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-point-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.overview) {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

:where(.overview-card) {
  background: var(--el-fill-color-lighter);
  padding: 16px;
  border-radius: var(--global-border-radius);
  text-align: center;
}

:where(.num) {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-color-primary);
}

:where(.label) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

:where(.sign-section) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  margin-bottom: 24px;
}

:where(.sign-tip) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:where(.block-title) {
  margin: 24px 0 12px;
  font-size: 16px;
  font-weight: 600;
}

:where(.log-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:where(.log-item) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
}

:where(.log-info) {
  flex: 1;
}

:where(.log-action) {
  font-size: 14px;
}

:where(.log-time) {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

:where(.log-point) {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-color-success);
}

:where(.log-point.minus) {
  color: var(--el-color-danger);
}
</style>
