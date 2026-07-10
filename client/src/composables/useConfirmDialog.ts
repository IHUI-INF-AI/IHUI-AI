import { ref } from 'vue'
import type { Ref } from 'vue'
import { ElMessageBox } from '@/utils/message'

export function useConfirmDialog() {
  const visible: Ref<boolean> = ref(false)

  const confirm = async (message: string, title?: string): Promise<boolean> => {
    try {
      await ElMessageBox.confirm(message, title || '提示')
      return true
    } catch {
      return false
    }
  }

  const confirmDelete = async (message: string, title?: string): Promise<boolean> => {
    return confirm(message, title || '确认删除')
  }

  return { visible, confirm, confirmDelete }
}
