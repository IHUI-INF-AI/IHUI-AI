/**
 * P21.2: Admin CRUD 通用 composable
 * 管理编辑/新增弹窗状态、表单数据、提交逻辑、删除确认
 *
 * 用法:
 *   const { dialogVisible, dialogMode, formData, submitting, onAdd, onEdit, onDelete, onSubmit } = useAdminCrud({
 *     fields: [{ prop: 'name', label: '名称', required: true }],
 *     createFn: (data) => adminApi.xxxCreate(data),
 *     updateFn: (id, data) => adminApi.xxxUpdate(id, data),
 *     deleteFn: (id) => adminApi.xxxDelete(id),
 *     onSuccess: () => reload(),
 *   })
 *
 * 本 composable 是通用 CRUD 抽象, createFn/updateFn/deleteFn 必须接受任意数据 (any)
 * 才能适配不同业务 (用户/订单/课程等). 改用泛型会显著复杂化 API 且收益有限.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import type { FormField } from '@/components/admin/AdminEditDialog.vue'

export interface UseAdminCrudOptions {
  /** 表单字段定义 */
  fields: FormField[]
  /** 创建函数 */
  createFn?: (data: any) => Promise<any>
  /** 更新函数 */
  updateFn?: (id: string | number, data: any) => Promise<any>
  /** 删除函数 */
  deleteFn?: (id: string | number) => Promise<any>
  /** P23.4: 批量删除函数（单次请求，优先于 deleteFn 循环） */
  batchDeleteFn?: (ids: (string | number)[]) => Promise<any>
  /** P24.1: 批量更新函数（单次请求，优先于 updateFn 循环） */
  batchUpdateFn?: (ids: (string | number)[], data: any) => Promise<any>
  /** 操作成功回调（通常传 reload） */
  onSuccess?: () => void
  /** 行数据 ID 字段名，默认 'id' */
  idField?: string
}

export function useAdminCrud(options: UseAdminCrudOptions) {
  const { fields, createFn, updateFn, deleteFn, batchDeleteFn, batchUpdateFn, onSuccess, idField = 'id' } = options
  const { t } = useI18n()

  const dialogVisible = ref(false)
  const dialogMode = ref<'add' | 'edit'>('add')
  const submitting = ref(false)
  const formData = reactive<Record<string, any>>({})
  const currentId = ref<string | number | null>(null)

  // P24.1: 批量编辑状态
  const batchEditVisible = ref(false)
  const batchEditRows = ref<any[]>([])
  // P24.2: 批量编辑进度（含失败 ID 列表，用于重试）
  const batchEditProgress = ref({ current: 0, total: 0, visible: false, failedIds: [] as (string | number)[] })

  /** 初始化表单数据为字段默认值 */
  const initFormData = () => {
    for (const f of fields) {
      formData[f.prop] = f.type === 'switch' ? false : f.type === 'number' ? 0 : ''
    }
  }

  /** 重置表单数据 */
  const resetFormData = () => {
    initFormData()
    currentId.value = null
  }

  /** 打开新增弹窗 */
  const onAdd = () => {
    resetFormData()
    dialogMode.value = 'add'
    dialogVisible.value = true
  }

  /** 打开编辑弹窗 */
  const onEdit = (row: any) => {
    resetFormData()
    dialogMode.value = 'edit'
    currentId.value = row[idField]
    // 将行数据填入表单
    for (const f of fields) {
      if (row[f.prop] !== undefined) {
        formData[f.prop] = row[f.prop]
      }
    }
    dialogVisible.value = true
  }

  /** 提交表单（新增或编辑） */
  const onSubmit = async (data: Record<string, any>) => {
    submitting.value = true
    try {
      if (dialogMode.value === 'add' && createFn) {
        await createFn(data)
        ElMessage.success(t('common.messages.createSuccess'))
      } else if (dialogMode.value === 'edit' && updateFn && currentId.value !== null) {
        await updateFn(currentId.value, data)
        ElMessage.success(t('common.messages.updateSuccess'))
      }
      dialogVisible.value = false
      onSuccess?.()
    } catch (e) {
      logger.error('Admin CRUD submit failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    } finally {
      submitting.value = false
    }
  }

  /** 保存并继续编辑：保存后不关闭弹窗 */
  const onSubmitContinue = async (data: Record<string, any>) => {
    submitting.value = true
    try {
      if (dialogMode.value === 'add' && createFn) {
        const res = await createFn(data)
        ElMessage.success(t('common.messages.createSuccess'))
        // 新增成功后切换为编辑模式，用返回的 id 继续编辑
        if (res?.data?.id) {
          currentId.value = res.data.id
          dialogMode.value = 'edit'
        }
      } else if (dialogMode.value === 'edit' && updateFn && currentId.value !== null) {
        await updateFn(currentId.value, data)
        ElMessage.success(t('common.messages.updateSuccess'))
      }
      onSuccess?.()
    } catch (e) {
      logger.error('Admin CRUD submit-continue failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    } finally {
      submitting.value = false
    }
  }

  /** P24.1: 打开批量编辑弹窗 */
  const onBatchEdit = (rows: any[]) => {
    if (!rows.length) return
    batchEditRows.value = rows
    batchEditVisible.value = true
  }

  /** P24.1: 提交批量编辑（接收组件传来的更新数据） */
  const onBatchEditSubmit = async (updateData: Record<string, any>) => {
    if (!Object.keys(updateData).length) {
      ElMessage.warning('请至少选择一个要修改的字段')
      return
    }
    submitting.value = true
    const ids = batchEditRows.value.map((r) => r[idField])
    try {
      if (batchUpdateFn) {
        await batchUpdateFn(ids, updateData)
        ElMessage.success(`批量更新成功 (${ids.length})`)
        batchEditVisible.value = false
      } else if (updateFn) {
        // P24.2: 循环更新并显示进度，记录失败 ID
        batchEditProgress.value = { current: 0, total: ids.length, visible: true, failedIds: [] }
        const failedIds: (string | number)[] = []
        for (let i = 0; i < ids.length; i++) {
          try {
            await updateFn(ids[i], updateData)
          } catch {
            failedIds.push(ids[i])
          }
          batchEditProgress.value.current = i + 1
        }
        batchEditProgress.value.failedIds = failedIds
        const success = ids.length - failedIds.length
        if (failedIds.length === 0) {
          batchEditProgress.value.visible = false
          ElMessage.success(`批量更新成功 (${ids.length})`)
          batchEditVisible.value = false
        } else {
          // 有失败项，保留弹窗和进度，等待用户选择重试或关闭
          ElMessage.warning(`成功 ${success} 条，失败 ${failedIds.length} 条，可点击"重试失败项"重新更新`)
        }
      }
      onSuccess?.()
    } catch (e) {
      logger.error('Admin CRUD batch edit failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    } finally {
      submitting.value = false
    }
  }

  /** P24.3: 重试失败的批量编辑项 */
  const onBatchEditRetry = async (updateData: Record<string, any>) => {
    const failedIds = batchEditProgress.value.failedIds
    if (!failedIds.length) return
    if (!updateFn) return
    submitting.value = true
    try {
      batchEditProgress.value = { current: 0, total: failedIds.length, visible: true, failedIds: [] }
      const stillFailed: (string | number)[] = []
      for (let i = 0; i < failedIds.length; i++) {
        try {
          await updateFn(failedIds[i], updateData)
        } catch {
          stillFailed.push(failedIds[i])
        }
        batchEditProgress.value.current = i + 1
      }
      batchEditProgress.value.failedIds = stillFailed
      const success = failedIds.length - stillFailed.length
      if (stillFailed.length === 0) {
        batchEditProgress.value.visible = false
        ElMessage.success(`重试成功 (${success} 条)`)
        batchEditVisible.value = false
      } else {
        ElMessage.warning(`重试成功 ${success} 条，仍失败 ${stillFailed.length} 条`)
      }
      onSuccess?.()
    } catch (e) {
      logger.error('Admin CRUD batch edit retry failed:', e)
      ElMessage.error(t('common.errors.saveFailed'))
    } finally {
      submitting.value = false
    }
  }

  /** 删除行 */
  const onDelete = async (row: any) => {
    const id = row[idField]
    try {
      await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
      if (deleteFn) {
        await deleteFn(id)
        ElMessage.success(t('common.messages.deleteSuccess'))
      }
      onSuccess?.()
    } catch (e) {
      // 用户取消或删除失败
      if (e !== 'cancel' && e !== 'close') {
        logger.error('Admin CRUD delete failed:', e)
        ElMessage.error(t('common.errors.deleteFailed'))
      }
    }
  }

  /** P23.4: 批量删除（优先使用 batchDeleteFn 单次请求，降级为 deleteFn 循环） */
  const onBatchDelete = async (ids: (string | number)[]) => {
    if (!ids.length) return
    try {
      await ElMessageBox.confirm(
        `${t('common.confirmBatchDelete')} (${ids.length})`,
        t('common.tip'),
        { type: 'warning' }
      )
      if (batchDeleteFn) {
        // P23.4: 优先使用批量删除 API（单次请求）
        const res = await batchDeleteFn(ids)
        const success = res?.data?.success ?? ids.length
        const failed = res?.data?.failed ?? 0
        if (failed === 0) {
          ElMessage.success(`${t('common.messages.deleteSuccess')} (${success})`)
        } else {
          ElMessage.warning(`${t('common.messages.deleteSuccess')} ${success}, ${t('common.failed')} ${failed}`)
        }
      } else if (deleteFn) {
        // 降级方案：循环调用单条 deleteFn
        let success = 0
        let failed = 0
        for (const id of ids) {
          try {
            await deleteFn(id)
            success++
          } catch {
            failed++
          }
        }
        if (failed === 0) {
          ElMessage.success(`${t('common.messages.deleteSuccess')} (${success})`)
        } else {
          ElMessage.warning(`${t('common.messages.deleteSuccess')} ${success}, ${t('common.failed')} ${failed}`)
        }
      }
      onSuccess?.()
    } catch (e) {
      // 用户取消
      if (e !== 'cancel' && e !== 'close') {
        logger.error('Admin CRUD batch delete failed:', e)
        ElMessage.error(t('common.errors.deleteFailed'))
      }
    }
  }

  // 初始化表单数据
  initFormData()

  return {
    dialogVisible,
    dialogMode,
    formData,
    submitting,
    onAdd,
    onEdit,
    onDelete,
    onBatchDelete,
    onSubmit,
    onSubmitContinue,
    batchEditVisible,
    batchEditRows,
    batchEditProgress,
    onBatchEdit,
    onBatchEditSubmit,
    onBatchEditRetry,
  }
}
