<template>
  <div class="my-appointments-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Calendar /></el-icon>
        {{ t('myAppointments.title') }}
      </h1>
      <p class="page-subtitle">{{ t('myAppointments.subtitle') }}</p>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-section radius-auto">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item :label="t('myAppointments.filter.serviceType')">
          <el-select
            v-model="filterForm.service_type"
            :placeholder="t('myAppointments.filter.allServices')"
            clearable
            style="width: 150px"
            @change="handleFilterChange"
          >
            <el-option
              :label="t('techService.services.consultation.title')"
              value="consultation"
            />
            <el-option
              :label="t('techService.services.training.title')"
              value="training"
            />
            <el-option
              :label="t('techService.services.custom.title')"
              value="custom"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('myAppointments.filter.status')">
          <el-select
            v-model="filterForm.status"
            :placeholder="t('myAppointments.filter.allStatus')"
            clearable
            style="width: 150px"
            @change="handleFilterChange"
          >
            <el-option
              :label="t('myAppointments.status.pending')"
              value="pending"
            />
            <el-option
              :label="t('myAppointments.status.confirmed')"
              value="confirmed"
            />
            <el-option
              :label="t('myAppointments.status.completed')"
              value="completed"
            />
            <el-option
              :label="t('myAppointments.status.cancelled')"
              value="cancelled"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleFilterChange">
            <SearchIcon />
            {{ t('common.search') }}
          </el-button>
          <el-button @click="handleResetFilter">
            <el-icon><Refresh /></el-icon>
            {{ t('common.reset') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 预约列表 -->
    <div class="appointments-section radius-auto">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="appointments.length === 0" class="empty-container">
        <el-empty :description="t('myAppointments.noAppointments')" />
      </div>

      <div v-else class="appointments-list">
        <el-card
          v-for="appointment in appointments"
          :key="appointment.id"
          class="appointment-card"
          shadow="hover"
          @click="handleViewDetail(appointment)"
        >
          <div class="appointment-header">
            <div class="appointment-info">
              <h3 class="appointment-title">
                {{ getServiceTypeName(appointment.service_type) }}
              </h3>
              <el-tag
                :type="getStatusType(appointment.status)"
                size="small"
                class="status-tag"
              >
                {{ getStatusName(appointment.status) }}
              </el-tag>
            </div>
            <div class="appointment-actions">
              <el-button
                v-if="appointment.status === 'pending'"
                type="danger"
                size="small"
                @click.stop="handleCancel(appointment)"
              >
                {{ t('myAppointments.cancel') }}
              </el-button>
              <el-button type="primary" size="small" @click.stop="handleViewDetail(appointment)">
                {{ t('myAppointments.viewDetail') }}
              </el-button>
            </div>
          </div>

          <div class="appointment-content">
            <div class="appointment-item">
              <el-icon><User /></el-icon>
              <span>{{ appointment.name }}</span>
            </div>
            <div class="appointment-item">
              <el-icon><Message /></el-icon>
              <span>{{ appointment.email }}</span>
            </div>
            <div class="appointment-item">
              <el-icon><Phone /></el-icon>
              <span>{{ appointment.phone }}</span>
            </div>
            <div v-if="appointment.preferred_date" class="appointment-item">
              <el-icon><Calendar /></el-icon>
              <span>
                {{ appointment.preferred_date }}
                <span v-if="appointment.preferred_time"> {{ appointment.preferred_time }}</span>
              </span>
            </div>
            <div class="appointment-item">
              <el-icon><Clock /></el-icon>
              <span>{{ formatTime(appointment.created_at) }}</span>
            </div>
          </div>

          <div v-if="appointment.description" class="appointment-description">
            <p>{{ appointment.description }}</p>
          </div>
        </el-card>
      </div>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 预约详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="t('myAppointments.detailTitle')"
      width="600px"
    >
      <div v-if="selectedAppointment" class="appointment-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('myAppointments.detail.serviceType')">
            {{ getServiceTypeName(selectedAppointment.service_type) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('myAppointments.detail.status')">
            <el-tag :type="getStatusType(selectedAppointment.status)" size="small">
              {{ getStatusName(selectedAppointment.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('myAppointments.detail.name')">
            {{ selectedAppointment.name }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('myAppointments.detail.email')">
            {{ selectedAppointment.email }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('myAppointments.detail.phone')">
            {{ selectedAppointment.phone }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.preferred_date"
            :label="t('myAppointments.detail.preferredDate')"
          >
            {{ selectedAppointment.preferred_date }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.preferred_time"
            :label="t('myAppointments.detail.preferredTime')"
          >
            {{ selectedAppointment.preferred_time }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('myAppointments.detail.createdAt')">
            {{ formatTime(selectedAppointment.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.confirmed_at"
            :label="t('myAppointments.detail.confirmedAt')"
          >
            {{ formatTime(selectedAppointment.confirmed_at) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.completed_at"
            :label="t('myAppointments.detail.completedAt')"
          >
            {{ formatTime(selectedAppointment.completed_at) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.cancelled_at"
            :label="t('myAppointments.detail.cancelledAt')"
          >
            {{ formatTime(selectedAppointment.cancelled_at) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.description"
            :label="t('myAppointments.detail.description')"
            :span="2"
          >
            {{ selectedAppointment.description }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="selectedAppointment.admin_notes"
            :label="t('myAppointments.detail.adminNotes')"
            :span="2"
          >
            {{ selectedAppointment.admin_notes }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button @click="detailDialogVisible = false">
          {{ t('common.close') }}
        </el-button>
        <el-button
          v-if="selectedAppointment?.status === 'pending'"
          type="danger"
          @click="handleCancel(selectedAppointment)"
        >
          {{ t('myAppointments.cancel') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import {
  Calendar,
  User,
  Message,
  Phone,
  Clock,
  Refresh,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import {
  getAppointments,
  cancelAppointment,
  type ServiceAppointment,
  type GetAppointmentsParams,
} from '@/api/service-appointment'
import { sendAppointmentCancelledNotification } from '@/api/notification'
import { formatTime } from '@/utils/format'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()
const { loading, execute: executeApi } = useApiError({ showMessage: false })

// 数据
const appointments = ref<ServiceAppointment[]>([])
const total = ref(0)
const pagination = reactive({
  page: 1,
  pageSize: 10,
})

// 筛选
const filterForm = reactive<GetAppointmentsParams>({
  service_type: undefined,
  status: undefined,
})

// 详情对话框
const detailDialogVisible = ref(false)
const selectedAppointment = ref<ServiceAppointment | null>(null)

// 加载预约列表
const loadAppointments = async () => {
  const params: GetAppointmentsParams = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...filterForm,
  }
  const response = await executeApi(() => getAppointments(params))
  if (response) {
    appointments.value = response.items || []
    total.value = response.pagination?.total || 0
  }
}

// 筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  loadAppointments()
}

// 重置筛选
const handleResetFilter = () => {
  filterForm.service_type = undefined
  filterForm.status = undefined
  pagination.page = 1
  loadAppointments()
}

// 分页变化
const handlePageChange = () => {
  loadAppointments()
}

// 查看详情
const handleViewDetail = (appointment: ServiceAppointment) => {
  selectedAppointment.value = appointment
  detailDialogVisible.value = true
}

// 取消预约
const handleCancel = async (appointment: ServiceAppointment) => {
  try {
    await ElMessageBox.confirm(
      t('myAppointments.confirmCancel'),
      t('myAppointments.confirmCancelTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    const response = await cancelAppointment(appointment.id)
    if (response.success) {
      showSuccess(t('myAppointments.cancelSuccess'))
      
      // 发送取消通知（异步，不阻塞主流程）
      if (response.data) {
        sendAppointmentCancelledNotification(response.data.email, {
          serviceType: response.data.service_type,
          serviceTypeName: getServiceTypeName(response.data.service_type),
        }).catch((error) => {
          logger.warn('Failed to send cancellation notification (does not affect main flow):', error)
        })
      }
      
      loadAppointments()
      if (detailDialogVisible.value) {
        detailDialogVisible.value = false
      }
    } else {
      showError(response.message || t('myAppointments.cancelFailed'))
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to cancel appointment:', error)
      showError(t('myAppointments.cancelFailed'))
    }
  }
}

// 获取服务类型名称
const getServiceTypeName = (type: string) => {
  const map: Record<string, string> = {
    consultation: t('techService.services.consultation.title'),
    training: t('techService.services.training.title'),
    custom: t('techService.services.custom.title'),
  }
  return map[type] || type
}

// 获取状态名称
const getStatusName = (status: ServiceAppointment['status']) => {
  const map: Record<string, string> = {
    pending: t('myAppointments.status.pending'),
    confirmed: t('myAppointments.status.confirmed'),
    completed: t('myAppointments.status.completed'),
    cancelled: t('myAppointments.status.cancelled'),
  }
  return map[status] || status
}

// 获取状态类型（用于标签颜色）
const getStatusType = (status: ServiceAppointment['status']) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
    pending: 'warning',
    confirmed: 'info',
    completed: 'success',
    cancelled: 'danger',
  }
  return map[status] || 'info'
}

onMounted(() => {
  loadAppointments()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.my-appointments-page {
  background-color: var(--el-bg-color-page);
  padding: $desktop-page-padding;
  max-width: 100%;
  margin: 0 auto;

  @media (width <= $desktop-breakpoint-xs) {
    padding: $desktop-page-padding-mobile;
  }
}

.page-header {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.page-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;

  @media (width <= $desktop-breakpoint-sm) {
    font-size: 20px;
  }

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 18px;
  }
}

.title-icon {
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;

  @media (width <= $desktop-breakpoint-xs) {
    font-size: 12px;
  }
}

.filter-section {
  margin-bottom: $desktop-section-gap;
  padding: 20px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.filter-form {
  margin: 0;
}

.appointments-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.loading-container,
.empty-container {
  padding: 40px 0;
  text-align: center;
}

.appointments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.appointment-card {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
  }
}

.appointment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.appointment-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.appointment-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.status-tag {
  margin-left: 8px;
}

.appointment-actions {
  display: flex;
  gap: 8px;
}

.appointment-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.appointment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);

  .el-icon {
    color: var(--el-text-color-secondary);
  }
}

.appointment-description {
  margin-top: 12px;
  padding-top: 12px;
  border-top: var(--unified-border);

  p {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
  }
}

.pagination-container {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.appointment-detail {
  :deep(.el-descriptions__label) {
    font-weight: 600;
  }
}
</style>
