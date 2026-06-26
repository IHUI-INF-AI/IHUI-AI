<template>
  <div class="become-supplier-page">
    <div class="container">
      <!-- 头部 -->
      <header class="portal-hero ihui-ai-fade-in-top-animation">
        <div class="hero-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">Supplier</span>
        </div>
        <h1>{{ t('becomeSupplier.title') }}</h1>
        <p class="subtitle">{{ t('becomeSupplier.subtitle') }}</p>
      </header>

      <!-- 核心优势 -->
      <section class="benefits ihui-ai-fade-in-top-animation">
        <div class="benefits-grid">
          <div v-for="b in benefits" :key="b.id" class="benefit-card group ihui-ai-card-hover">
            <div class="benefit-icon">
              <el-icon><component :is="b.icon" /></el-icon>
            </div>
            <h3>{{ b.title }}</h3>
            <p>{{ b.desc }}</p>
          </div>
        </div>
      </section>

      <!-- 合作流程 - 模块化步骤 -->
      <section class="onboarding-process">
        <div class="section-label">ONBOARDING PIPELINE</div>
        <div class="process-steps">
          <div v-for="(step, index) in processSteps" :key="index" class="step-card group ihui-ai-card-hover">
            <div class="step-header">
              <span class="step-num">{{ String(Number(index) + 1).padStart(2, '0') }}</span>
              <div class="step-line"></div>
            </div>
            <div class="step-body">
              <h3>{{ step.title }}</h3>
              <p>{{ step.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 提交申请按钮区域 -->
      <section class="apply-section">
        <button class="btn-apply-large" @click="dialogVisible = true">
          <el-icon><FileEdit /></el-icon>
          {{ t('becomeSupplier.form.submit') }}
        </button>
      </section>

      <!-- 申请表单对话框 -->
      <el-dialog
        v-model="dialogVisible"
        :title="t('becomeSupplier.form.submit')"
        width="800px"
        class="supplier-dialog"
        destroy-on-close
      >
        <el-form
          :model="applicationForm"
          :rules="formRules"
          ref="formRef"
          label-position="top"
          class="tech-form"
        >
          <div class="form-grid">
            <el-form-item :label="t('becomeSupplier.form.companyName')" prop="companyName">
              <el-input v-model="applicationForm.companyName" :placeholder="t('becomeSupplier.form.companyNamePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('becomeSupplier.form.contactName')" prop="contactName">
              <el-input v-model="applicationForm.contactName" :placeholder="t('becomeSupplier.form.contactNamePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('becomeSupplier.form.phone')" prop="phone">
              <el-input v-model="applicationForm.phone" :placeholder="t('becomeSupplier.form.phonePlaceholder')" />
            </el-form-item>
            <el-form-item :label="t('becomeSupplier.form.email')" prop="email">
              <el-input v-model="applicationForm.email" :placeholder="t('becomeSupplier.form.emailPlaceholder')" />
            </el-form-item>
          </div>

          <el-form-item :label="t('becomeSupplier.form.address')" prop="address">
            <el-input v-model="applicationForm.address" :placeholder="t('becomeSupplier.form.addressPlaceholder')" />
          </el-form-item>

          <el-form-item :label="t('becomeSupplier.form.business')" prop="business">
            <el-input
              v-model="applicationForm.business"
              type="textarea"
              :rows="3"
              :placeholder="t('becomeSupplier.form.businessPlaceholder')"
            />
          </el-form-item>

          <el-form-item :label="t('becomeSupplier.form.intention')" prop="intention">
            <el-input
              v-model="applicationForm.intention"
              type="textarea"
              :rows="4"
              :placeholder="t('becomeSupplier.form.intentionPlaceholder')"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <div class="dialog-actions">
            <button type="button" @click="handleReset" class="btn-reset">{{ t('becomeSupplier.form.reset') }}</button>
            <button class="btn-submit" :disabled="isSubmitting" @click.prevent="handleSubmit">
              {{ isSubmitting ? t('becomeSupplier.form.processing') : t('becomeSupplier.form.submitProposal') }}
            </button>
          </div>
        </template>
      </el-dialog>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  FileEdit,
} from '@/lib/lucide-fallback'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useCleanup } from '@/composables/useCleanup'

const { t } = useI18n()
const router = useRouter()
const formRef = ref<FormInstance>()
const isSubmitting = ref(false)
const dialogVisible = ref(false)

const cleanup = useCleanup()

const _goToRoute = (path: string) => router.push(path)

const applicationForm = ref({
  companyName: '', contactName: '', phone: '', email: '', address: '', business: '', intention: ''
})

const benefits = [
  { id: 1, title: t('becomeSupplier.benefits.market.title'), desc: t('becomeSupplier.benefits.market.description'), icon: TrendingUp },
  { id: 2, title: t('becomeSupplier.benefits.support.title'), desc: t('becomeSupplier.benefits.support.description'), icon: Users },
  { id: 3, title: t('becomeSupplier.benefits.settlement.title'), desc: t('becomeSupplier.benefits.settlement.description'), icon: DollarSign },
  { id: 4, title: t('becomeSupplier.benefits.security.title'), desc: t('becomeSupplier.benefits.security.description'), icon: Shield },
]

const formRules: FormRules = {
  companyName: [{ required: true, message: t('validate.become_supplier.请输入公司名称'), trigger: 'blur' }],
  contactName: [{ required: true, message: t('validate.become_supplier.请输入联系人姓名1'), trigger: 'blur' }],
  phone: [{ required: true, message: t('validate.become_supplier.请输入联系电话2'), trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: t('validate.become_supplier.请输入有效邮箱3'), trigger: 'blur' }],
}

const processSteps = computed(() => [
  { title: t('becomeSupplier.processSteps.submitApplication.title'), description: t('becomeSupplier.processSteps.submitApplication.description') },
  { title: t('becomeSupplier.processSteps.qualificationReview.title'), description: t('becomeSupplier.processSteps.qualificationReview.description') },
  { title: t('becomeSupplier.processSteps.businessNegotiation.title'), description: t('becomeSupplier.processSteps.businessNegotiation.description') },
  { title: t('becomeSupplier.processSteps.signAgreement.title'), description: t('becomeSupplier.processSteps.signAgreement.description') },
  { title: t('becomeSupplier.processSteps.onlineDocking.title'), description: t('becomeSupplier.processSteps.onlineDocking.description') },
])

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate((valid: boolean) => {
      if (valid) {
        isSubmitting.value = true
        cleanup.addTimer(() => {
          isSubmitting.value = false
          dialogVisible.value = false
          ElMessage.success(t('msg.become_supplier.申请提交成功我们'))
          handleReset()
        }, 1500)
      }
    })
  } catch (e) {
    console.error('[BecomeSupplier] 提交失败', e)
    ElMessage.error(t('common.errors.submitFailedRetry'))
  }
}

const handleReset = () => formRef.value?.resetFields()
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

/* ---------- 明亮模式（默认） ---------- */
.become-supplier-page {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  min-height: calc(100vh - 60px);
}



.container {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 40px 40px;

  @include bp.tablet-down { padding: 16px 24px 32px; }
}

.portal-hero {
  padding: 16px 0 32px;
  text-align: left;

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 16px;

    .status-dot {
      width: 6px;
      height: 6px;
      background: var(--el-color-primary);
      border-radius: var(--global-border-radius);
    }
  }
  h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; margin-bottom: 8px; letter-spacing: -1px; color: var(--el-text-color-primary); text-align: left; }
  .subtitle { color: var(--el-text-color-secondary); font-size: 16px; max-width: 600px; line-height: 1.5; text-align: left; margin: 0; }
}

.benefits-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;

  @include bp.tablet-down { grid-template-columns: repeat(2, 1fr); gap: 12px; }

  @include bp.phone-down { grid-template-columns: 1fr; }
}

.benefit-card {
  background: var(--app-surface-2);
  border: var(--unified-border);
  padding: 24px;
  border-radius: var(--global-border-radius);
  &:hover { border: 2px solid var(--border-unified-color-hover); background: var(--el-bg-color-hover); }
  .benefit-icon { color: var(--el-color-primary); margin-bottom: 16px; font-size: 28px; }
  h3 { font-size: 16px; font-weight: 800; margin-bottom: 8px; color: var(--el-text-color-primary); }
  p { font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.5; }
}

.section-label {
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 800;
  letter-spacing: 3px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  &::after { content: ''; flex: 1; height: 1px; background: var(--el-border-color); margin-left: 16px; }
}

.process-steps {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 40px;

  @include bp.tablet-down { grid-template-columns: 1fr; gap: 24px; }
}

.step-card {
  background: var(--app-surface-2);
  border: var(--unified-border);
  padding: 24px;
  border-radius: var(--global-border-radius);
  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border: 2px solid var(--border-unified-color-hover);
    background: var(--el-bg-color-hover);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    .step-num { font-family: var(--font-family-mono); font-size: 24px; font-weight: 800; color: var(--el-border-color); line-height: 1; }

    .step-line { flex: 1; height: 1px; background: var(--el-border-color);

 @include bp.tablet-down { display: none; } }
  }

  .step-body {
    h3 { font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--el-text-color-primary); }
    p { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }
  }
  &:hover .step-num { color: var(--el-color-primary); transition: color 0.3s; }
}

/* 提交申请按钮区域 - 使用 hero-cta-btn 同款样式 */
.apply-section {
  display: flex;
  justify-content: center;
  padding: 24px 0 32px;

  .btn-apply-large {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 140px;
    height: 44px;
    padding: 0 24px;
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    box-sizing: border-box;

    /* 亮色模式：黑底白字 */
    background: var(--el-text-color-primary);
    border: var(--unified-border);
    color: var(--el-color-white);

    &:hover {
      background: var(--el-text-color-regular);
      border-color: var(--el-text-color-regular);
      
    }

    &:active {
      background: var(--el-text-color-secondary);
      border-color: var(--el-text-color-secondary);
    }

    .el-icon {
      font-size: 16px;
      color: inherit;
    }
  }
}

/* 对话框样式 */
.supplier-dialog {
  :deep(.el-dialog__header) {
    border-bottom: var(--unified-border-bottom);
    margin-right: 0;
    padding: 24px 32px;

    .el-dialog__title {
      font-size: 20px;
      font-weight: 800;
      color: var(--el-text-color-primary);
    }
  }

  :deep(.el-dialog__body) {
    padding: 32px;
  }

  :deep(.el-dialog__footer) {
    border-top: var(--unified-border);
    padding: 20px 32px;
  }
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;

  .btn-submit {
    background: var(--el-color-primary);
    color: var(--el-bg-color-page);
    border: none;
    padding: 12px 32px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 15px;
    font-weight: 900;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.3s, opacity 0.3s;

    &:hover {
      background: var(--el-color-primary-light-3);
      
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .btn-reset {
    font-family: var(--font-family-mono);
    font-size: 15px;
    color: var(--el-text-color-secondary);
    font-weight: 800;
    background: var(--el-bg-color-page);
    border: var(--unified-border);
    padding: 12px 32px;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: color 0.3s, border-color 0.3s;

    &:hover {
      color: var(--el-text-color-primary);
      border-color: var(--el-border-color-hover);
    }
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;

  @include bp.tablet-down { grid-template-columns: 1fr; }
}

:deep(.tech-form) {
  .el-form-item__label { font-family: var(--font-family-mono); font-size: 12px; font-weight: 800; color: var(--el-text-color-secondary); text-transform: uppercase; }

  .el-input .el-input__wrapper,
  .el-input__wrapper {
    border: var(--unified-border);
    box-shadow: none;
  }

  .el-textarea .el-textarea__inner,
  .el-textarea__inner {
    border: var(--unified-border);
    box-shadow: none;
  }
  .el-input__inner, .el-textarea__inner { color: var(--el-text-color-primary); font-family: var(--font-family-mono); }
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 32px;
  margin-top: 30px;

  .btn-submit {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color-page);
    border: none;
    padding: 18px 48px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    transition: background-color 0.3s, color 0.3s;
    &:hover { background: var(--el-color-primary); color: var(--el-bg-color-page); }
  }
  .btn-reset { font-family: var(--font-family-mono); font-size: 12px; color: var(--el-text-color-secondary); font-weight: 800; }
}

/* ---------- 暗色模式覆盖 ---------- */
:where(html.dark) .become-supplier-page {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}



:where(html.dark) .become-supplier-page .portal-hero {
  h1 { color: var(--el-text-color-primary); }
  .subtitle { color: var(--el-text-color-regular); }
}

:where(html.dark) .become-supplier-page .benefit-card {
  background: var(--app-surface-2);
  border-color: var(--border-unified-color);
  &:hover { border: 2px solid var(--border-unified-color-hover); background: var(--el-bg-color-hover); }
  h3 { color: var(--el-text-color-primary); }
  p { color: var(--el-text-color-regular); }
}

:where(html.dark) :where(.become-supplier-page) :where(.section-label::after) {
  background: var(--el-border-color);
}

:where(html.dark) .become-supplier-page .step-card {
  background: var(--app-surface-2);
  border-color: var(--border-unified-color);

  &:hover {
    border: 2px solid var(--border-unified-color-hover);
    background: var(--el-bg-color-hover);
  }
  .step-num { color: var(--el-border-color); }
  .step-line { background: var(--el-border-color); }
  .step-body h3 { color: var(--el-text-color-primary); }
  .step-body p { color: var(--el-text-color-regular); }
}

:where(html.dark) :where(.become-supplier-page) .apply-section {
  .btn-apply-large {
    /* 暗色模式：白底黑字 */
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
    color: var(--el-text-color-primary);

    &:hover {
      background: var(--el-fill-color-light);
      border-color: var(--el-border-color-hover);
    }

    &:active {
      background: var(--el-fill-color);
      border-color: var(--el-border-color);
    }

    .el-icon {
      color: inherit;
    }
  }
}

:where(html.dark) :where(.become-supplier-page) .supplier-dialog {
  :deep(.el-dialog) {
    background: var(--el-bg-color);
    border: var(--unified-border);
  }

  :deep(.el-dialog__header) {
    border-bottom-color: var(--border-unified-color);

    .el-dialog__title {
      color: var(--el-text-color-primary);
    }
  }

  :deep(.el-dialog__footer) {
    border-top-color: var(--border-unified-color);
  }
}

:where(html.dark) .become-supplier-page :deep(.tech-form) {
  .el-form-item__label { color: var(--el-text-color-secondary); }

  .el-input .el-input__wrapper,
  .el-input__wrapper,
  .el-textarea .el-textarea__inner,
  .el-textarea__inner { border-color: var(--border-unified-color); }
  .el-input__inner, .el-textarea__inner { color: var(--el-text-color-primary); }
}

:where(html.dark) .become-supplier-page .form-actions {
  .btn-submit { background: var(--el-bg-color); color: var(--el-text-color-primary); &:hover { background: var(--el-color-primary); color: var(--el-bg-color-page); } }
  .btn-reset { color: var(--el-text-color-secondary); }
}

:where(html.dark) .become-supplier-page .dialog-actions {
  .btn-submit { background: var(--el-bg-color); color: var(--el-text-color-primary); &:hover { background: var(--el-fill-color-light); } }
  .btn-reset { background: var(--el-color-primary); color: var(--el-text-color-regular); border-color: var(--el-border-color); &:hover { color: var(--el-text-color-primary); border-color: var(--el-border-color-hover); } }
}
</style>
