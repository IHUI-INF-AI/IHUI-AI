<template>
  <div class="demand-review-page" v-loading="loading">
    <div class="review-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <span class="review-header__title">需求审核</span>
    </div>

    <el-card class="review-card" v-if="detail">
      <template #header>
        <div class="review-card__head">
          <span class="review-card__title">{{ detail.title }}</span>
          <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="需求 ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{ detail.user_name || detail.user_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="关联 Agent">{{ detail.agent_name || detail.agent_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ detail.type || '-' }}</el-descriptions-item>
        <el-descriptions-item label="优先级">{{ priorityLabel }}</el-descriptions-item>
        <el-descriptions-item label="预算">{{ detail.budget != null ? `¥${(detail.budget / 100).toFixed(2)}` : '-' }}</el-descriptions-item>
        <el-descriptions-item label="截止时间">{{ formatTime(detail.deadline) }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ formatTime(detail.create_time) }}</el-descriptions-item>
        <el-descriptions-item label="认领开发者">{{ detail.developer_name || detail.developer_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="认领时间">{{ formatTime(detail.accept_time) }}</el-descriptions-item>
        <el-descriptions-item label="需求描述" :span="2">{{ detail.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="交付物" :span="2">{{ detail.deliverable || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="review-card" v-if="detail">
      <template #header>审核操作</template>
      <el-form :model="reviewForm" label-width="100px">
        <el-form-item label="审核备注">
          <el-input
            v-model="reviewForm.remark"
            type="textarea"
            :rows="4"
            placeholder="请输入审核备注（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item>
          <el-button type="success" :loading="submitting" @click="doReview(true)">审核通过</el-button>
          <el-button type="warning" :loading="submitting" @click="doReview(false)">审核拒绝</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-empty v-if="!loading && !detail" description="未找到需求" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { demandApi, type DemandItem } from '@/api/admin/admin-demand-square'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const submitting = ref(false)
const detail = ref<DemandItem | null>(null)
const reviewForm = ref({ remark: '' })

const STATUS_MAP: Record<number, { label: string; type: 'info' | 'warning' | 'primary' | 'success' | 'danger' }> = {
  0: { label: '待认领', type: 'warning' },
  1: { label: '已认领', type: 'primary' },
  2: { label: '开发中', type: 'primary' },
  3: { label: '已完成', type: 'success' },
  4: { label: '已取消', type: 'info' },
}

const statusLabel = computed(() => {
  if (!detail.value) return '-'
  return STATUS_MAP[Number(detail.value.status)]?.label || String(detail.value.status)
})

const statusTagType = computed(() => {
  if (!detail.value) return 'info' as const
  return STATUS_MAP[Number(detail.value.status)]?.type || 'info'
})

const priorityLabel = computed(() => {
  if (!detail.value) return '-'
  const map: Record<number, string> = { 1: '低', 2: '中', 3: '高' }
  return map[Number(detail.value.priority)] || String(detail.value.priority ?? '-')
})

const formatTime = (t: string | null | undefined) => {
  if (!t) return '-'
  return String(t).replace('T', ' ').slice(0, 19)
}

const loadDetail = async () => {
  const id = Number(route.query.id)
  if (!id) {
    ElMessage.error('缺少需求 ID')
    return
  }
  loading.value = true
  try {
    const res = await demandApi.demandDetail(id)
    detail.value = (res.data as DemandItem | null) || null
    if (detail.value?.remark) reviewForm.value.remark = detail.value.remark
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

const doReview = async (pass: boolean) => {
  if (!detail.value) return
  submitting.value = true
  try {
    await demandApi.demandReview({ tid: detail.value.id, pass, remark: reviewForm.value.remark || undefined })
    ElMessage.success(pass ? '审核通过' : '已拒绝')
    router.push('/admin/demandSquare')
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const goBack = () => router.push('/admin/demandSquare')

onMounted(loadDetail)
</script>

<style scoped>
.demand-review-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color);
}

.review-header__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.review-card {
  border: 1px solid var(--el-border-color);
}

.review-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
