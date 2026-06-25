/**
 * Distribution 邀请链接管理Composable
 *
 * 负责邀请链接的生成、复制和对话框管理
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'

/**
 * useDistributionInvite 配置选项
 */
export interface UseDistributionInviteOptions {
  /** 初始邀请链接*/
  initialInviteLink?: string
}

/**
 * Distribution 邀请链接管理Composable
 *
 * @param options - 配置选项
 * @returns 返回邀请链接状态和方法
 */
export function useDistributionInvite(options: UseDistributionInviteOptions = {}) {
  const { initialInviteLink = '' } = options
  const { t } = useI18n()
  const { showSuccess, showError } = useOperationFeedback()

  // 邀请对话框显示状态
  const showInviteDialog = ref(false)

  // 邀请链接
  const inviteLink = ref(initialInviteLink)

  /**
   * 生成邀请链接
   */
  const generateInviteLink = (code: string): void => {
    inviteLink.value = `https://ihui-agi-inf.com/invite?code=${code}`
  }

  /**
   * 复制邀请链接
   */
  const copyInviteLink = async (): Promise<void> => {
    try {
      if (!inviteLink.value) {
        showError(t('distribution.inviteLinkEmpty'))
        return
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink.value)
        showSuccess(t('distribution.inviteLinkCopied'))
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea')
        textArea.value = inviteLink.value
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          showSuccess(t('distribution.inviteLinkCopied'))
        } catch (err) {
          logger.error('[DistributionInvite] Copy failed:', err)
          showError(t('distribution.copyFailed'))
        }
        document.body.removeChild(textArea)
      }
    } catch (error) {
      logger.error('[DistributionInvite] Failed to copy invitation link:', error)
      showError(t('distribution.copyFailed'))
    }
  }

  /**
   * 打开邀请对话框
   */
  const openInviteDialog = (): void => {
    showInviteDialog.value = true
  }

  /**
   * 关闭邀请对话框
   */
  const closeInviteDialog = (): void => {
    showInviteDialog.value = false
  }

  return {
    // 状态
    showInviteDialog,
    inviteLink,

    // 方法
    generateInviteLink,
    copyInviteLink,
    openInviteDialog,
    closeInviteDialog,
  }
}
