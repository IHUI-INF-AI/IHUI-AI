<template>
  <div class="agents-create-container page-container">
    <!-- 深度背景系统 -->
    <div class="industrial-bg">
      <div class="glow-orb glow-orb--primary"></div>
      <div class="glow-orb glow-orb--secondary"></div>
    </div>

    <!-- 主内容区域 -->
    <div class="create-content">
      <!-- 头部区域 -->
      <div class="create-header scroll-fade-in">
        <div class="header-content">
          <div class="header-badge">
            <span class="badge-dot"></span>
            <span class="badge-text font-edix">Agent Factory</span>
          </div>
          <h1 class="page-title">{{ t('agents.createAgent') }}</h1>
          <p class="page-subtitle">{{ t('agents.createAgentDesc') }}</p>
          <p class="page-subtitle">{{ t('agents.createAgentDesc') }}</p>
        </div>
        <div class="header-decoration">
          <div class="decoration-line"></div>
          <div class="decoration-circuit">
            <span v-for="n in 5" :key="n" class="circuit-node"></span>
          </div>
        </div>
      </div>

      <!-- 表单卡片 - 玻璃态 -->
      <div class="glass-card scroll-fade-in scroll-fade-in--delay-1">
        <div class="card-glow"></div>
        <div class="card-border"></div>
        <div class="card-content">
          <el-form ref="formRef" :model="formData" :rules="formRules" label-width="120px" label-position="left"
            class="industrial-form">
            <div class="form-section">
              <div class="section-header">
                <span class="section-icon">📝</span>
                <span class="section-title">{{ t('hardcoded.agents.create.基础信息') }}</span>
              </div>

              <el-form-item :label="t('agents.agentName')" prop="name" class="glass-input-wrapper">
                <el-input v-model="formData.name" :placeholder="t('agents.agentNamePlaceholder')"
                  maxlength="50" show-word-limit class="industrial-input" />
              </el-form-item>

              <el-form-item :label="t('agents.description')" prop="description" class="glass-input-wrapper">
                <el-input v-model="formData.description" type="textarea" :rows="4"
                  :placeholder="t('agents.descriptionPlaceholder')" maxlength="500" show-word-limit
                  class="industrial-input" />
              </el-form-item>
            </div>

            <div class="form-section">
              <div class="section-header">
                <span class="section-icon">⚙️</span>
                <span class="section-title">{{ t('hardcoded.agents.create.配置选项') }}</span>
              </div>

              <el-form-item :label="t('agents.category')" prop="category" class="glass-input-wrapper">
                <el-select v-model="formData.category" :placeholder="t('agents.selectCategory')"
                  style="width: 100%" class="industrial-select">
                  <el-option v-for="category in categories" :key="category.id" :label="category.name"
                    :value="category.id" />
                </el-select>
              </el-form-item>

              <el-form-item :label="t('agents.platform')" prop="platform" class="glass-input-wrapper">
                <el-select v-model="formData.platform" :placeholder="t('agents.selectPlatform')"
                  style="width: 100%" class="industrial-select">
                  <el-option :label="t('agents.platformInternal')" value="internal" />
                  <el-option :label="t('agents.platformCoze')" value="coze" />
                  <el-option :label="t('agents.platformN8n')" value="n8n" />
                  <el-option :label="t('agents.platformDify')" value="dify" />
                </el-select>
              </el-form-item>

              <el-form-item :label="t('agents.tags')" class="glass-input-wrapper">
                <el-select
                  v-model="formData.tags"
                  multiple
                  filterable
                  allow-create
                  :placeholder="t('agents.tagsPlaceholder')"
                  style="width: 100%"
                  class="industrial-select"
                >
                  <el-option v-for="tag in commonTags" :key="tag" :label="tag" :value="tag" />
                </el-select>
              </el-form-item>
            </div>

            <div class="form-actions">
              <button type="button" class="industrial-btn industrial-btn--primary ripple-btn" :disabled="submitting"
                @click="handleSubmit">
                <span v-if="submitting" class="btn-loader"></span>
                <span class="btn-text">{{ t('common.submit') }}</span>
                <span class="btn-glow"></span>
              </button>
              <button type="button" class="industrial-btn industrial-btn--secondary ripple-btn" @click="handleCancel">
                <span class="btn-text">{{ t('common.cancel') }}</span>
              </button>
            </div>
          </el-form>
        </div>
      </div>

      <!-- 底部装饰 -->
      <div class="footer-decoration scroll-fade-in scroll-fade-in--delay-2">
        <div class="footer-line"></div>
        <span class="footer-text">POWERED BY IHUI AI</span>
        <div class="footer-line"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import { ref, onMounted } from 'vue'
import { logger } from '../utils/logger'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { type FormInstance, type FormRules } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getAgentCategories, type AgentCategory } from '@/api/agents'
import AISDK from '@/utils/ai-sdk'

const { t } = useI18n()
const router = useRouter()
const { handleResult, showSuccess: _showSuccess, showError: showErrorMsg } = useOperationFeedback()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const categories = ref<AgentCategory[]>([])
const commonTags = ref([t('data.agents_create.AI助手'), '对话', '创作', '分析', '工具', '自动化', '工作流'])

const formData = ref({
  name: '',
  description: '',
  category: '',
  platform: 'internal',
  tags: [] as string[],
})

const formRules: FormRules = {
  name: [
    { required: true, message: t('agents.nameRequired'), trigger: 'blur' },
    { min: 2, max: 50, message: t('agents.nameLength'), trigger: 'blur' },
  ],
  description: [{ max: 500, message: t('agents.descriptionLength'), trigger: 'blur' }],
  category: [{ required: true, message: t('agents.categoryRequired'), trigger: 'change' }],
  platform: [{ required: true, message: t('agents.platformRequired'), trigger: 'change' }],
}

const loadCategories = async () => {
  try {
    const response = await getAgentCategories()
    if (response.code === 200 || response.success) {
      categories.value = response.data || []
      // 过滤掉"全部"选项
      categories.value = categories.value.filter(c => c.id !== 'all')
    }
  } catch (error) {
    logger.warn('Failed to load categories:', error)
    // 使用默认分类
    categories.value = [
      { id: 'assistant', name: t('agents.categoryAssistant') },
      { id: 'creative', name: t('agents.categoryCreative') },
      { id: 'business', name: t('agents.categoryBusiness') },
      { id: 'education', name: t('agents.categoryEducation') },
      { id: 'entertainment', name: t('agents.categoryEntertainment') },
    ]
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    if (submitting.value) return // 防止重复提交
    submitting.value = true

    try {
      await handleResult(
        AISDK.createAgent({
          name: formData.value.name,
          type: 'general',
          prompt: {
            system: formData.value.description,
          },
        }),
        {
          successMessage: t('agents.createSuccess'),
          errorMessage: t('agents.createFailed'),
          onSuccess: async data => {
            // 跳转到智能体列表或详情页
            try {
              const path = (data as { agentId?: string })?.agentId
                ? `/agents/${(data as { agentId?: string }).agentId}`
                : '/agents'
              // 如果已经在目标路由，不执行跳转
              if ((router as any).currentRoute.value.path !== path) {
                await router.push(path).catch(error => {
                  // 忽略导航重复错误
                  if (
                    error.name !== 'NavigationDuplicated' &&
                    error.name !== 'NavigationRedirected'
                  ) {
                    import('@/utils/logger')
                      .then(({ logger }) => {
                        logger.error('[AgentsCreate] Navigation failed:', error, { path })
                      })
                      .catch(() => { /* logger 加载失败，静默处理 */ })
                  }
                })
              }
            } catch (error) {
              import('@/utils/logger')
                .then(({ logger }) => {
                  logger.error('[AgentsCreate] Route jump exception:', error)
                })
                .catch(() => { /* logger 加载失败，静默处理 */ })
            }
          },
        }
      )
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : t('agents.createFailed')
      showErrorMsg(message)
    } finally {
      submitting.value = false
    }
  } catch {
    // 表单验证失败
  }
}

const handleCancel = () => {
  ; (router as any).back()
}

onMounted(async () => {
  try { await loadCategories() } catch (e) { console.error(e) }
})
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风格变量
// ============================================
$brand-primary: var(--el-text-color-primary);
$brand-accent: var(--el-bg-color);
$brand-glow: var(--color-white-15);
$brand-glow-strong: var(--color-white-25);
$industrial-bg: var(--color-dark-bg-1);
$industrial-surface: var(--color-gray-111);
$industrial-border: var(--border-unified-color);
$industrial-border-hover: var(--border-unified-color-hover);
$industrial-text: var(--color-gray-ededed);
$industrial-text-muted: var(--color-gray-888888);
$industrial-text-dim: var(--color-gray-555555);
$glass-bg: color-mix(in srgb, var(--el-color-primary) 70%, transparent);
$glass-border: var(--border-unified-color);
$glass-border-hover: var(--border-unified-color-hover);

// ============================================
// 容器基础
// ============================================
.agents-create-container {
  position: relative;
  width: 100%;
  min-height: 100vh;
  padding: 0;
  margin: 0;
  background: $industrial-bg;
  overflow-x: hidden;
}

// ============================================
// 深度背景系统
// ============================================
.industrial-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-0);
  overflow: hidden;
}

// 光晕球体
.glow-orb {
  position: absolute;
  border-radius: var(--global-border-radius);
  filter: blur(100px);
  opacity: 0.3;

  &--primary {
    width: 600px;
    height: 600px;
    top: -200px;
    left: -100px;
    background: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
    animation: orb-float 12s ease-in-out infinite;
  }

  &--secondary {
    width: 400px;
    height: 400px;
    bottom: -100px;
    right: -50px;
    background: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
    animation: orb-float 15s ease-in-out infinite reverse;
  }
}

@keyframes orb-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  33% {
    transform: translate(30px, -20px) scale(1.05);
  }

  66% {
    transform: translate(-20px, 15px) scale(0.95);
  }
}

// ============================================
// 主内容区域
// ============================================
.create-content {
  position: relative;
  z-index: var(--z-base);
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

// ============================================
// 头部区域
// ============================================
.create-header {
  margin-bottom: 40px;
}

.header-content {
  text-align: center;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--color-white-5);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  margin-bottom: 20px;

  .badge-dot {
    width: 6px;
    height: 6px;
    background: $brand-accent;
    border-radius: var(--global-border-radius);
    animation: dot-pulse 2s ease-in-out infinite;
  }

  .badge-text {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: $industrial-text-muted;
    font-family: EDIX, sans-serif;
    text-transform: uppercase;
  }
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.page-title {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 800;
  color: $industrial-text;
  margin: 0 0 12px;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.page-subtitle {
  font-size: 16px;
  color: $industrial-text-muted;
  margin: 0;
  line-height: 1.6;
  letter-spacing: 0.01em;
}

.header-decoration {
  margin-top: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;

  .decoration-line {
    flex: 1;
    max-width: 100px;
    height: 1px;
    background: $industrial-border;
  }

  .decoration-circuit {
    display: flex;
    gap: 8px;

    .circuit-node {
      width: 4px;
      height: 4px;
      background: $industrial-text-dim;
      border-radius: var(--global-border-radius);
      animation: circuit-blink 3s ease-in-out infinite;

      @for $i from 1 through 5 {
        &:nth-child(#{$i}) {
          animation-delay: #{$i * 0.2}s;
        }
      }
    }
  }
}

@keyframes circuit-blink {
  0%,
  100% {
    opacity: 0.3;
  }

  50% {
    opacity: 1;
  }
}

// ============================================
// 玻璃态卡片
// ============================================
.glass-card {
  position: relative;
  border-radius: var(--global-border-radius);
  overflow: hidden;

  .card-border {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: var(--unified-border);
    pointer-events: none;
    transition: border-color 0.3s ease;
  }

  .card-content {
    position: relative;
    background: $glass-bg;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    padding: 40px;
    border-radius: inherit;
  }

  &:hover {
    .card-border {
      border-color: $glass-border-hover;
    }
  }
}

// ============================================
// 表单样式
// ============================================
.industrial-form {
  :deep(.el-form-item) {
    margin-bottom: 24px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: $industrial-text-muted;
    font-size: 13px;
    letter-spacing: 0.02em;
  }
}

.form-section {
  margin-bottom: 36px;

  &:last-of-type {
    margin-bottom: 40px;
  }
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: var(--unified-border-bottom);

  .section-icon {
    font-size: 14px;
    color: $industrial-text-dim;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: $industrial-text-muted;
    text-transform: uppercase;
  }
}

// 输入框包装器
.glass-input-wrapper {
  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner),
  :deep(.el-select__wrapper) {
    background: var(--color-black-30);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: none;
    transition: all 0.25s ease;

    &:hover {
      border-color: $industrial-border-hover ;
      background: var(--color-black-40);
    }

    &:focus,
    &.is-focus {
      border-color: var(--border-unified-color-hover);
      background: var(--color-black-50);
      box-shadow: var(--global-box-shadow);
    }
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    color: $industrial-text ;
    font-size: 14px;

    &::placeholder {
      color: $industrial-text-dim ;
    }
  }

  :deep(.el-input__count) {
    background: transparent;
    color: $industrial-text-dim ;
  }

  :deep(.el-select__placeholder) {
    color: $industrial-text-dim ;
  }

  :deep(.el-select__selected-item) {
    color: $industrial-text ;
  }

  :deep(.el-tag) {
    background: var(--color-white-10);
    border-color: $industrial-border ;
    color: $industrial-text ;
    border-radius: var(--global-border-radius);
  }
}

// ============================================
// 按钮样式
// ============================================
.form-actions {
  display: flex;
  gap: 16px;
  padding-top: 8px;
}

.industrial-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-radius: var(--global-border-radius);
  border: none;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  .btn-text {
    position: relative;
    z-index: var(--z-base);
  }

  // 扫光效果已移至全局样式 (styles/index.scss)

  &--primary {
    background: $brand-accent;
    color: $brand-primary;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: var(--global-box-shadow);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &--secondary {
    background: transparent;
    color: $industrial-text-muted;
    border: var(--unified-border);

    &:hover {
      border-color: $industrial-border-hover;
      color: $industrial-text;
      background: var(--color-white-3);
    }
  }

  // 加载动画
  .btn-loader {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentcolor;
    border-radius: var(--global-border-radius);
    animation: btn-spin 0.8s linear infinite;
  }
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}

// ============================================
// 涟漪点击效果
// ============================================
.ripple-btn {
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: var(--color-white-20);
    border-radius: var(--global-border-radius);
    transform: translate(-50%, -50%);
    opacity: 0;
  }

  &:active::after {
    width: 200px;
    height: 200px;
    opacity: 0;
    transition: width 0.4s ease-out, height 0.4s ease-out, opacity 0.4s ease-out;
  }
}

// ============================================
// 底部装饰
// ============================================
.footer-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 48px;
  padding-top: 32px;

  .footer-line {
    flex: 1;
    max-width: 80px;
    height: 1px;
    background: $industrial-border;
  }

  .footer-text {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.2em;
    color: $industrial-text-dim;
    font-family: var(--font-family-mono);
  }
}

// ============================================
// 滚动动画
// ============================================
.scroll-fade-in {
  opacity: 0;
  transform: translateY(30px);
  animation: scroll-fade-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;

  &--delay-1 {
    animation-delay: 0.15s;
  }

  &--delay-2 {
    animation-delay: 0.3s;
  }
}

@keyframes scroll-fade-up {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============================================
// 响应式适配
// ============================================
@media (width <= 768px) {
  .create-content {
    padding: 32px 16px 60px;
  }

  .glass-card .card-content {
    padding: 24px 20px;
  }

  .page-title {
    font-size: clamp(28px, 7vw, 36px);
  }

  .form-actions {
    flex-direction: column;

    .industrial-btn {
      width: 100%;
    }
  }

  .glow-orb--primary {
    width: 300px;
    height: 300px;
  }

  .glow-orb--secondary {
    width: 200px;
    height: 200px;
  }
}

// ============================================
// Element Plus 下拉菜单覆盖（使用全局样式 _element-plus.scss）
// ============================================
</style>

