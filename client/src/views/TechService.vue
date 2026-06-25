<template>
  <div class="tech-service-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Setting /></el-icon>
        {{ t('techService.title') }}
      </h1>
      <p class="page-subtitle">{{ t('techService.subtitle') }}</p>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-actions radius-auto">
      <el-button type="primary" @click="router.push('/my-appointments')">
        <el-icon><Calendar /></el-icon>
        {{ t('myAppointments.title') }}
      </el-button>
    </div>

    <!-- 服务列表 -->
    <div class="services-section radius-auto">
      <div class="services-grid">
        <div
          v-for="service in servicesList"
          :key="service.id"
          class="service-card"
          @click="handleServiceClick(service)"
        >
          <div class="service-icon">
            <el-icon :size="48"><component :is="service.icon" /></el-icon>
          </div>
          <div class="service-info">
            <h3 class="service-title">{{ service.title }}</h3>
            <p class="service-desc">{{ service.desc }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 服务预约对话框 -->
    <el-dialog
      v-model="appointmentDialogVisible"
      :title="t('techService.appointmentTitle')"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedService" class="appointment-service-info">
        <h3>{{ selectedService.title }}</h3>
        <p>{{ selectedService.desc }}</p>
      </div>

      <el-form :model="appointmentForm" label-width="120px" style="margin-top: 20px;">
        <el-form-item :label="t('techService.form.name')" required>
          <el-input v-model="appointmentForm.name" :placeholder="t('techService.form.namePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('techService.form.email')" required>
          <el-input v-model="appointmentForm.email" type="email" :placeholder="t('techService.form.emailPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('techService.form.phone')" required>
          <el-input v-model="appointmentForm.phone" :placeholder="t('techService.form.phonePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('techService.form.preferredDate') || ' preferredDate'">
          <el-date-picker
            v-model="appointmentForm.preferredDate"
            type="date"
            :placeholder="t('techService.form.datePlaceholder')"
            style="width: 100%"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item :label="t('techService.form.preferredTime') || ' preferredTime'">
          <el-time-picker
            v-model="appointmentForm.preferredTime"
            :placeholder="t('techService.form.timePlaceholder')"
            style="width: 100%"
            format="HH:mm"
            value-format="HH:mm"
          />
        </el-form-item>
        <el-form-item :label="t('techService.form.description')">
          <el-input
            v-model="appointmentForm.description"
            type="textarea"
            :rows="4"
            :placeholder="t('techService.form.descriptionPlaceholder')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="appointmentDialogVisible = false" :disabled="submitting">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" @click="handleAppointmentSubmit" :loading="submitting">
          {{ t('techService.submitAppointment') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Setting, Phone, Reading, ChatLineRound, Calendar } from '@element-plus/icons-vue'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { createAppointment, type CreateAppointmentRequest } from '@/api/service-appointment'
import { sendAppointmentCreatedNotification } from '@/api/system/notification'
import { logger } from '@/utils/logger'
import { openCustomerServiceChat } from '@/composables/useOpenCustomerServiceChat'

const router = useRouter()
const { t } = useI18n()
const { showInfo, showSuccess, showError } = useOperationFeedback()

const servicesList = [
  {
    id: 'support',
    title: t('techService.services.support.title'),
    desc: t('techService.services.support.desc'),
    icon: Phone,
    url: '/custom-service',
    type: 'link',
  },
  {
    id: 'docs',
    title: t('techService.services.docs.title'),
    desc: t('techService.services.docs.desc'),
    icon: Reading,
    url: '/docs',
    type: 'link',
  },
  {
    id: 'consultation',
    title: t('techService.services.consultation.title'),
    desc: t('techService.services.consultation.desc'),
    icon: ChatLineRound,
    type: 'appointment',
  },
  {
    id: 'training',
    title: t('techService.services.training.title'),
    desc: t('techService.services.training.desc'),
    icon: Setting,
    type: 'appointment',
  },
  {
    id: 'custom',
    title: t('techService.services.custom.title'),
    desc: t('techService.services.custom.desc'),
    icon: Setting,
    type: 'appointment',
  },
  {
    id: 'feedback',
    title: t('techService.services.feedback.title'),
    desc: t('techService.services.feedback.desc'),
    icon: ChatLineRound,
    url: '/feedback',
    type: 'link',
  },
]

const appointmentDialogVisible = ref(false)
const selectedService = ref<{ id: string; title: string; desc: string } | null>(null)
const appointmentForm = ref({
  name: '',
  email: '',
  phone: '',
  serviceType: '',
  preferredDate: '',
  preferredTime: '',
  description: '',
})

const handleServiceClick = (service: { url?: string; title: string; type?: string; id: string; desc: string }) => {
  if (service.type === 'link' && service.url) {
    if (service.url === '/custom-service') {
      openCustomerServiceChat()
      return
    }
    router.push(service.url)
  } else if (service.type === 'appointment') {
    selectedService.value = { id: service.id, title: service.title, desc: service.desc }
    appointmentForm.value.serviceType = service.id
    appointmentDialogVisible.value = true
  } else {
    showInfo(`${service.title}${t('techService.underDevelopment')}`)
  }
}

const submitting = ref(false)

const handleAppointmentSubmit = async () => {
  // 表单验证
  if (!appointmentForm.value.name || !appointmentForm.value.email || !appointmentForm.value.phone) {
    ElMessage.warning(t('techService.form.validationRequired'))
    return
  }

  // 邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(appointmentForm.value.email)) {
    ElMessage.warning(t('techService.form.invalidEmail'))
    return
  }

  // 电话格式验证（简单验证）
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(appointmentForm.value.phone)) {
    ElMessage.warning(t('techService.form.invalidPhone'))
    return
  }

  submitting.value = true
  try {
    const requestData: CreateAppointmentRequest = {
      service_type: appointmentForm.value.serviceType,
      name: appointmentForm.value.name,
      email: appointmentForm.value.email,
      phone: appointmentForm.value.phone,
      preferred_date: appointmentForm.value.preferredDate || undefined,
      preferred_time: appointmentForm.value.preferredTime || undefined,
      description: appointmentForm.value.description || undefined,
    }

    const response = await createAppointment(requestData)
    if (response.success) {
      showSuccess(t('techService.appointmentSubmitted'))

      // 发送通知（异步，不阻塞主流程）
      if (selectedService.value) {
        sendAppointmentCreatedNotification(requestData.email, {
          serviceType: requestData.service_type,
          serviceTypeName: selectedService.value.title,
          preferredDate: requestData.preferred_date,
          preferredTime: requestData.preferred_time,
        }).catch((error) => {
          logger.warn('Failed to send appointment notification (does not affect main flow):', error)
        })
      }

      appointmentDialogVisible.value = false
      // 重置表单
      appointmentForm.value = {
        name: '',
        email: '',
        phone: '',
        serviceType: '',
        preferredDate: '',
        preferredTime: '',
        description: '',
      }
    } else {
      showError(response.message || t('techService.appointmentFailed'))
    }
  } catch (error) {
    logger.error('Failed to submit appointment:', error)
    showError(t('techService.appointmentFailed'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.tech-service-page {
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
  border-radius: var(--global-border-radius); // 使用项目标准圆角
  // 扁平化设计：无阴影
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

.quick-actions {
  margin-bottom: $desktop-section-gap;
  padding: 20px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  display: flex;
  justify-content: flex-end;
}

.services-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.service-card {
  border-radius: var(--global-border-radius);
  padding: 24px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  background: transparent;
}

.service-icon {
  margin-bottom: 16px;
  color: var(--el-color-primary);
}

.service-info {
  text-align: center;
}

.service-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px;
}

.service-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin: 0;
}
</style>
