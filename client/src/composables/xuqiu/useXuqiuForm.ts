/**
 * 需求广场表单管理 Composable
 *
 * 负责需求提交表单的验证、提交和重置
 *
 * @packageDocumentation
 */

import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { addXuqiuModel } from '@/services/api'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
import { useLang } from '@/composables/useLang'

/**
 * 需求表单接口
 */
export interface DemandForm {
  /** 需求标题 */
  title: string
  /** 需求描述 */
  description: string
  /** 需求标签 */
  tags: string[]
}

/**
 * useXuqiuForm 配置选项
 */
export interface UseXuqiuFormOptions {
  /** 提交成功后回调 */
  onSuccess?: () => void
}

/**
 * 需求广场表单管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回表单状态、验证规则和相关方法
 *
 * @example
 * ```vue
 * <script setup>
 * import { useXuqiuForm } from '@/composables/xuqiu/useXuqiuForm'
 *
 * const {
 *   showSetPath,
 *   submitLoading,
 *   demandFormRef,
 *   demandForm,
 *   demandRules,
 *   tagOptions,
 *   submitDemand,
 *   resetForm,
 * } = useXuqiuForm({
 *   onSuccess: () => {
 *     logger.info('[Xuqiu] Submission successful')
 *   },
 * })
 * </script>
 *
 * <template>
 *   <el-dialog v-model="showSetPath" title="发布需求">
 *     <el-form
 *       ref="demandFormRef"
 *       :model="demandForm"
 *       :rules="demandRules"
 *     >
 *       <el-form-item label="标题" prop="title">
 *         <el-input v-model="demandForm.title" />
 *       </el-form-item>
 *       <el-form-item label="描述" prop="description">
 *         <el-input v-model="demandForm.description" type="textarea" />
 *       </el-form-item>
 *       <el-form-item label="标签" prop="tags">
 *         <el-select v-model="demandForm.tags" multiple>
 *           <el-option
 *             v-for="tag in tagOptions"
 *             :key="tag.value"
 *             :label="tag.label"
 *             :value="tag.value"
 *           />
 *         </el-select>
 *       </el-form-item>
 *       <el-form-item>
 *         <el-button @click="submitDemand" :loading="submitLoading">
 *           提交
 *         </el-button>
 *         <el-button @click="resetForm">重置</el-button>
 *       </el-form-item>
 *     </el-form>
 *   </el-dialog>
 * </template>
 * ```
 */
export function useXuqiuForm(options: UseXuqiuFormOptions = {}) {
  const { onSuccess } = options
  const { t } = useLang()
  const { handleResult } = useOperationFeedback()

  const showSetPath = ref(false)
  const submitLoading = ref(false)
  const demandFormRef = ref<FormInstance | undefined>(undefined)

  const demandForm = reactive<DemandForm>({
    title: '',
    description: '',
    tags: [],
  })

  const demandRules = reactive<FormRules<DemandForm>>({
    title: [{ required: true, message: t('xuqiu.enterTitle'), trigger: 'blur' }],
    description: [{ required: true, message: t('xuqiu.enterDescription'), trigger: 'blur' }],
  })

  const tagOptions = [
    { label: t('xuqiu.tagAIPainting'), value: t('xuqiu.tagAIPainting') },
    { label: t('xuqiu.tagAIWriting'), value: t('xuqiu.tagAIWriting') },
    { label: t('xuqiu.tagAIVideo'), value: t('xuqiu.tagAIVideo') },
    { label: t('xuqiu.tagAIMusic'), value: t('xuqiu.tagAIMusic') },
    { label: t('xuqiu.tagAICoding'), value: t('xuqiu.tagAICoding') },
    { label: t('xuqiu.tagAITranslation'), value: t('xuqiu.tagAITranslation') },
  ]

  const submitDemand = async (): Promise<void> => {
    if (!demandFormRef.value) return

    await demandFormRef.value.validate(async (valid: boolean) => {
      if (valid) {
        submitLoading.value = true
        try {
          const response = await addXuqiuModel({
            title: demandForm.title,
            description: demandForm.description,
            tags: demandForm.tags,
            status: 0,
            createTime: new Date().toISOString(),
          })

          const apiResponse = {
            code: (response as { code?: number }).code || 200,
            success: (response as { success?: boolean }).success !== false,
            message: (response as { message?: string }).message || '',
            data: (response as { data?: any }).data,
            timestamp: Date.now(),
          }

          await handleResult(Promise.resolve(apiResponse), {
            successMessage: t('xuqiu.publishSuccess'),
            errorMessage: t('xuqiu.publishFailed'),
            onSuccess: () => {
              showSetPath.value = false
              demandForm.title = ''
              demandForm.description = ''
              demandForm.tags = []
              if (onSuccess) {
                onSuccess()
              }
            },
          })
        } catch (error: any) {
          logger.error(
            t('xuqiu.publishFailed'),
            error instanceof Error ? error : new Error(String(error))
          )
          ElMessage.error(t('xuqiu.publishFailed'))
        } finally {
          submitLoading.value = false
        }
      }
    })
  }

  const resetForm = (): void => {
    demandForm.title = ''
    demandForm.description = ''
    demandForm.tags = []
    demandFormRef.value?.resetFields()
  }

  return {
    showSetPath,
    submitLoading,
    demandFormRef,
    demandForm,
    demandRules,
    tagOptions,
    submitDemand,
    resetForm,
  }
}
