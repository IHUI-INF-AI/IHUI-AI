import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user'
import { uploadAgentAndCreateExamine } from '@/api/file-upload'
import { useOperationFeedback } from '@/composables/useOperationFeedback'

/**
 * 用户上传智能体相关功能的 Composable
 * 提供智能体上传和审核创建功能
 *
 * @returns {Object} 返回上传相关的状态和方法
 * @returns {Ref<boolean>} returns.uploading - 上传状态
 * @returns {Reactive<Object>} returns.uploadForm - 上传表单数据
 * @returns {Computed<boolean>} returns.canSubmitUpload - 是否可以提交上传
 * @returns {Function} returns.onFileChange - 文件选择处理函数
 * @returns {Function} returns.handleUpload - 处理上传
 */
export function useUserUpload() {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const { handleResult: handleOperationResult, showError: showErrorMsg } = useOperationFeedback()

  const uploading = ref(false)
  const uploadForm = reactive({
    agent_name: '',
    category_id: '',
    description: '',
    file: null as File | null,
  })

  const canSubmitUpload = computed(() => {
    const user = authStore.user as UserInfoData | null
    return (
      !!uploadForm.agent_name &&
      !!uploadForm.category_id &&
      !!uploadForm.file &&
      !!user?.uuid &&
      !!(user?.username || user?.nickname)
    )
  })

  const onFileChange = (e: Event): void => {
    const input = e.target as HTMLInputElement
    const f = input.files && input.files[0]
    uploadForm.file = f || null
  }

  const handleUpload = async (): Promise<void> => {
    if (!canSubmitUpload.value || !uploadForm.file) {
      showErrorMsg(t('user.messages.uploadIncomplete'))
      return
    }
    uploading.value = true
    try {
      if (!uploadForm.file) return
      await handleOperationResult(
        uploadAgentAndCreateExamine(
          uploadForm.file,
          {
            name: uploadForm.agent_name,
            description: uploadForm.description,
          }
        ),
        {
          successMessage: t('user.messages.uploadSuccess'),
          onSuccess: () => {
            uploadForm.agent_name = ''
            uploadForm.category_id = ''
            uploadForm.description = ''
            uploadForm.file = null
          },
        }
      )
    } finally {
      uploading.value = false
    }
  }

  return {
    uploading,
    uploadForm,
    canSubmitUpload,
    onFileChange,
    handleUpload,
  }
}
