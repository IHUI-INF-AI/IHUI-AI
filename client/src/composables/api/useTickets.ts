/**
 * 服务工单Composable
 */
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getTickets,
  getTicket,
  createTicket,
  replyTicket,
  closeTicket,
  reopenTicket,
  type Ticket,
  type CreateTicketRequest,
  type ReplyTicketRequest,
} from '@/api/system/tickets'
import { logger } from '@/utils/logger'

export function useTickets() {
  const { t: translate } = useI18n()

  const tickets = ref<Ticket[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const statusFilter = ref<string>('')
  const categoryFilter = ref<string>('')

  /**
   * 加载工单列表
   */
  const loadTickets = async () => {
    loading.value = true
    try {
      const response = await getTickets({
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value || undefined,
        category: categoryFilter.value || undefined,
      })

      if (response.success && response.data) {
        // 后端返回格式: { list: [], total: number }
        tickets.value = response.data.list || []
        total.value = response.data.total || 0
      } else {
        ElMessage.error(response.message || translate('common.loadFailed'))
      }
    } catch (error) {
      logger.error('Failed to load ticket list:', error)
      ElMessage.error(getErrorMessage(error, translate('common.loadFailed')))
    } finally {
      loading.value = false
    }
  }

  /** 无后端时生成本地演示工单，保证「提交工单」有反馈 */
  const buildLocalTicket = (data: CreateTicketRequest): Ticket => {
    const now = new Date().toISOString()
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    return {
      id,
      title: data.title,
      description: data.description,
      category: data.category,
      status: 'pending',
      priority: data.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      userId: '',
      replies: [],
    }
  }

  /** 从请求错误中提取后端校验/错误文案（如 400 detail） */
  const getErrorMessage = (error: any, fallback: string): string => {
    const err = error as { response?: { status?: number; data?: { detail?: string; message?: string } } }
    if (err?.response?.data?.detail) return String(err.response.data.detail)
    if (err?.response?.data?.message) return String(err.response.data.message)
    return fallback
  }

  /**
   * 创建工单（后端 400 时展示校验文案；仅网络/5xx 时走本地兜底）
   */
  const handleCreateTicket = async (data: CreateTicketRequest) => {
    try {
      const response = await createTicket(data)
      if (response.success && response.data) {
        ElMessage.success(translate('apiService.tickets.createSuccess'))
        await loadTickets()
        return response.data
      }
      ElMessage.error(response.message || translate('apiService.tickets.createFailed'))
      return null
    } catch (error) {
      const err = error as { response?: { status?: number } }
      if (err?.response?.status === 400) {
        ElMessage.error(getErrorMessage(error, translate('apiService.tickets.createFailed')))
        return null
      }
      logger.warn('Creating ticket via fallback:', error)
      const local = buildLocalTicket(data)
      tickets.value = [local, ...tickets.value]
      total.value += 1
      ElMessage.success(translate('apiService.tickets.createSuccess'))
      return local
    }
  }

  /**
   * 回复工单（后端 400 时展示校验文案）
   */
  const handleReplyTicket = async (id: string, data: ReplyTicketRequest) => {
    try {
      const response = await replyTicket(id, data)
      if (response.success && response.data) {
        ElMessage.success(translate('apiService.tickets.replySuccess'))
        return response.data
      }
      ElMessage.error(response.message || translate('apiService.tickets.replyFailed'))
      return null
    } catch (error) {
      ElMessage.error(getErrorMessage(error, translate('apiService.tickets.replyFailed')))
      return null
    }
  }

  /**
   * 关闭工单（本地演示工单仅更新状态，不请求接口）
   */
  const handleCloseTicket = async (id: string) => {
    try {
      await ElMessageBox.confirm(
        translate('apiService.tickets.closeConfirm'),
        translate('common.confirm'),
        {
          confirmButtonText: translate('common.confirm'),
          cancelButtonText: translate('common.cancel'),
          type: 'warning',
        }
      )

      if (id.startsWith('local_')) {
        const ticket = tickets.value.find((x) => x.id === id)
        if (ticket) {
          ticket.status = 'closed'
          ElMessage.success(translate('apiService.tickets.closeSuccess'))
          return true
        }
      }

      const response = await closeTicket(id)
      if (response.success) {
        ElMessage.success(translate('apiService.tickets.closeSuccess'))
        await loadTickets()
        return true
      }
      ElMessage.error(response.message || translate('apiService.tickets.closeFailed'))
      return false
    } catch (error) {
      if (error !== 'cancel') {
        logger.error('Failed to close ticket:', error)
        ElMessage.error(getErrorMessage(error, translate('apiService.tickets.closeFailed')))
      }
      return false
    }
  }

  /**
   * 重新打开工单（本地演示工单仅更新状态）
   */
  const handleReopenTicket = async (id: string) => {
    if (id.startsWith('local_')) {
      const ticket = tickets.value.find((x) => x.id === id)
      if (ticket) {
        ticket.status = 'pending'
        ElMessage.success(translate('apiService.tickets.reopenSuccess'))
        return true
      }
    }
    try {
      const response = await reopenTicket(id)
      if (response.success) {
        ElMessage.success(translate('apiService.tickets.reopenSuccess'))
        await loadTickets()
        return true
      }
      ElMessage.error(response.message || translate('apiService.tickets.reopenFailed'))
      return false
    } catch (error) {
      logger.error('Failed to reopen ticket:', error)
      ElMessage.error(getErrorMessage(error, translate('apiService.tickets.reopenFailed')))
      return false
    }
  }

  /**
   * 获取工单详情
   */
  const loadTicketDetail = async (id: string) => {
    if (id.startsWith('local_')) {
      const found = tickets.value.find((t) => t.id === id)
      if (found) return found
    }
    try {
      const response = await getTicket(id)
      if (response.success && response.data) {
        return response.data
      }
      ElMessage.error(response.message || translate('common.loadFailed'))
      return null
    } catch (error) {
      if (id.startsWith('local_')) {
        const found = tickets.value.find((t) => t.id === id)
        if (found) return found
      }
      logger.error('Failed to load ticket detail:', error)
      ElMessage.error(getErrorMessage(error, translate('common.loadFailed')))
      return null
    }
  }

  /**
   * 分页变化处理
   */
  const handlePageChange = (newPage: number) => {
    page.value = newPage
    void loadTickets()
  }

  /**
   * 每页数量变化处理
   */
  const handlePageSizeChange = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    void loadTickets()
  }

  /**
   * 状态筛选变化处理
   */
  const handleStatusFilterChange = (newStatus: string) => {
    statusFilter.value = newStatus
    page.value = 1
    void loadTickets()
  }

  /**
   * 分类筛选变化处理
   */
  const handleCategoryFilterChange = (newCategory: string) => {
    categoryFilter.value = newCategory
    page.value = 1
    void loadTickets()
  }

  /**
   * 计算属性
   */
  const pendingTicketsCount = computed(() => {
    return tickets.value.filter(ticket => ticket.status === 'pending').length
  })

  const processingTicketsCount = computed(() => {
    return tickets.value.filter(ticket => ticket.status === 'processing').length
  })

  return {
    tickets,
    loading,
    total,
    page,
    pageSize,
    statusFilter,
    categoryFilter,
    pendingTicketsCount,
    processingTicketsCount,
    loadTickets,
    handleCreateTicket,
    handleReplyTicket,
    handleCloseTicket,
    handleReopenTicket,
    loadTicketDetail,
    handlePageChange,
    handlePageSizeChange,
    handleStatusFilterChange,
    handleCategoryFilterChange,
  }
}
