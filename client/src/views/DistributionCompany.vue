<template>
  <div class="distribution-company-page page-container">
    <!-- 页面头部 -->
    <div class="page-header radius-auto">
      <h1 class="page-title">
        <el-icon class="title-icon"><Building /></el-icon>
        {{ t('distributionCompany.title') }}
      </h1>
      <p class="page-subtitle">{{ t('distributionCompany.subtitle') }}</p>
    </div>

    <GlobalLoading v-if="loading" />

    <!-- 个人信息卡片 -->
    <PersonalInformationCard
      v-if="!loading && companyData"
      :data="companyData"
      @withdrawal="showRealAuthModal = true"
    />

    <!-- 收益统计卡片 -->
    <EarningsStatisticsCard
      v-if="!loading && companyData"
      :day-statistics="companyData.dayStatistics"
      :month-statistics="companyData.monthStatistics"
      :sum-statistics="companyData.sumStatistics"
      :loading="loading"
      @tab-change="handleTabChange"
      @refresh="loadCompanyData"
    />

    <!-- 功能区块 -->
    <div class="function-section radius-auto">
      <FunctionBlockColumn @show-q-r-code="openInviteDialog" />
    </div>

    <!-- 邀请对话框（复用Distribution.vue的逻辑） -->
    <el-dialog
      v-model="showInviteDialog"
      :title="t('distributionCompany.shareInvite')"
      width="500px"
      class="invite-dialog"
    >
      <div class="invite-content">
        <div class="invite-info">
          <h3>{{ t('distributionCompany.shareInviteTitle') }}</h3>
          <p>{{ t('distributionCompany.shareInviteDesc') }}</p>
        </div>

        <div class="invite-link-section">
          <div class="link-input">
            <el-input
              v-model="inviteLink"
              readonly
              :placeholder="t('distributionCompany.inviteLinkPlaceholder')"
            >
              <template #append>
                <el-button @click="copyInviteLink">
                  <el-icon><CopyDocument /></el-icon>
                  {{ t('distributionCompany.copy') }}
                </el-button>
              </template>
            </el-input>
          </div>
        </div>

        <div class="invite-qr">
          <h4>{{ t('distributionCompany.inviteQRCode') }}</h4>
          <div class="qr-code">
            <img
              v-if="qrCodeImage"
              :src="qrCodeImage"
              :alt="t('distributionCompany.inviteQRCode')"
              class="qr-image"
            />
            <div v-else class="qr-placeholder">
              <el-icon class="qr-icon"><Picture /></el-icon>
              <p>{{ t('distributionCompany.loading') }}</p>
            </div>
          </div>
          <el-button @click="downloadQR" :loading="downloadingQR">
            {{
              downloadingQR
                ? t('distributionCompany.downloading')
                : t('distributionCompany.downloadQRCode')
            }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 实名认证弹窗 -->
    <RealAuthModal v-model="showRealAuthModal" @success="handleAuthSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Building, CopyDocument, Picture } from '@/lib/lucide-fallback'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useDistributionInvite } from '@/composables/distribution/useDistributionInvite'
import {
  getOperatorDataCardData,
  getWxCode,
  getInviteCode,
  type OperatorDataCardData,
} from '@/api/distribution/distribution'
import PersonalInformationCard from '@/components/distribution/PersonalInformationCard.vue'
import EarningsStatisticsCard from '@/components/distribution/EarningsStatisticsCard.vue'
import FunctionBlockColumn from '@/components/distribution/FunctionBlockColumn.vue'
import RealAuthModal from '@/components/distribution/RealAuthModal.vue'
import GlobalLoading from '@/components/common/GlobalLoading.vue'
import { logger } from '@/utils/logger'
import { useApiError } from '@/composables/useApiError'

const _router = useRouter()
const authStore = useAuthStore()
const { showSuccess, showError } = useOperationFeedback()
const { t } = useI18n()

// 公司数据
const companyData = ref<OperatorDataCardData | null>(null)
const { loading, execute: executeApi } = useApiError({ showMessage: true })

// 邀请相关
const inviteComposable = useDistributionInvite()
const {
  inviteLink,
  copyInviteLink: copyInviteLinkFromComposable,
  generateInviteLink,
} = inviteComposable
const showInviteDialog = ref(false)
const qrCodeImage = ref<string>('')
const downloadingQR = ref(false)

// 实名认证
const showRealAuthModal = ref(false)

// 加载公司数据
const loadCompanyData = async () => {
  const user = authStore.user
  const uuid = user && typeof user === 'object' && 'uuid' in user ? (user.uuid as string) : ''

  if (!uuid) {
    showError(t('distributionCompany.userIncomplete'))
    return
  }

  const data = await executeApi(() => getOperatorDataCardData(uuid))

  if (data !== null && typeof data === 'object') {
    companyData.value = data
  }
}

// 加载邀请链接和二维码
const loadInviteInfo = async () => {
  try {
    // 获取邀请码
    const inviteCodeRes = await getInviteCode()
    if (inviteCodeRes.success && inviteCodeRes.data) {
      const code = inviteCodeRes.data.invite_code
      generateInviteLink(code)

      // 获取二维码
      const qrRes = await getWxCode(code)
      if (qrRes.success && qrRes.data) {
        qrCodeImage.value = qrRes.data
      }
    }
  } catch (error) {
    logger.error('[DistributionCompany] Failed to load invitation info:', error)
  }
}

// 打开邀请对话框
const openInviteDialog = async () => {
  showInviteDialog.value = true
  if (!qrCodeImage.value) {
    await loadInviteInfo()
  }
}

// 复制邀请链接
const copyInviteLink = async () => {
  try {
    await copyInviteLinkFromComposable()
    showSuccess(t('distributionCompany.inviteLinkCopied'))
  } catch (_error) {
    showError(t('distributionCompany.copyFailed'))
  }
}

// 下载二维码
const downloadQR = async () => {
  if (!qrCodeImage.value) {
    showError(t('distributionCompany.qrCodeNotLoaded'))
    return
  }

  try {
    downloadingQR.value = true
    // 创建临时链接下载
    const link = document.createElement('a')
    link.href = qrCodeImage.value
    link.download = `邀请二维码-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showSuccess(t('distributionCompany.qrCodeDownloadSuccess'))
  } catch (error) {
    logger.error('[DistributionCompany] Failed to download QR code:', error)
    showError(t('distributionCompany.downloadFailed'))
  } finally {
    downloadingQR.value = false
  }
}

// 处理标签切换
const handleTabChange = (tab: 'today' | 'month' | 'total') => {
  // 标签切换时，EarningsStatisticsCard组件内部已经处理了数据切换
  // 这里可以添加额外的逻辑，如记录用户选择、触发分析等
  logger.debug('[DistributionCompany] Switching to tab:', tab)
}

// 处理实名认证成功
const handleAuthSuccess = () => {
  // 重新加载公司数据
  loadCompanyData()
}

// 页面加载
onMounted(() => {
  loadCompanyData()
  loadInviteInfo()
})
</script>

<style scoped lang="scss">
@use '@/styles/desktop-layout.scss' as *;

.distribution-company-page {
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

.function-section {
  margin-bottom: $desktop-section-gap;
  padding: 24px;
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);

  @media (width <= $desktop-breakpoint-xs) {
    padding: 16px;
  }
}

.invite-dialog {
  .invite-content {
    padding: 20px 0;
  }

  .invite-info {
    text-align: center;
    margin-bottom: 24px;

    h3 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px;
      color: var(--el-text-color-primary);
    }

    p {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      margin: 0;
    }
  }

  .invite-link-section {
    margin-bottom: 24px;
  }

  .invite-qr {
    text-align: center;

    h4 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 16px;
      color: var(--el-text-color-primary);
    }

    .qr-code {
      margin: 0 auto 16px;
      width: 200px;
      height: 200px;
      background-color: var(--el-fill-color-light);
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qr-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: var(--global-border-radius);
    }

    .qr-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--el-text-color-secondary);
    }

    .qr-icon {
      font-size: 48px;
    }
  }
}
</style>
