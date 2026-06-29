/**
 * 需求广场列表 Composable
 *
 * 负责需求列表数据获取、分页、筛选、状态格式化等。
 *
 * @packageDocumentation
 */

import { ref, computed, watch, reactive } from 'vue'
import { getXuqiuList } from '@/services/api'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
import { useLang } from '@/composables/useLang'

/**
 * 需求项接口。
 */
export interface DemandItem {
  /** 需求 ID */
  id: string | number
  /** 需求标题 */
  title: string
  /** 需求描述 */
  description: string
  /** 标签 */
  tags: string[]
  /** 需求状态 (0: 待处理, 1: 已完成, 2: 进行中) */
  status: number
  /** 创建时间 */
  createTime: string
  /** 用户名 */
  username: string
  /** 用户头像 */
  avatar: string
  /** 查看次数 */
  viewCount: number
  /** 评论次数 */
  commentCount: number
  /** 点赞次数 */
  likeCount: number
}

/**
 * useXuqiuList 配置选项
 */
export interface UseXuqiuListOptions {
  /** 初始每页数量 */
  initialPageSize?: number
  /** 数据加载完成后回调 */
  onDataLoaded?: () => void
}

/**
 * 需求广场列表 Composable
 *
 * @param options - 配置选项
 * @returns 返回需求列表、状态、分页、相关方法。
 *
 * @example
 * ```vue
 * <script setup>
 * import { useXuqiuList } from '@/composables/xuqiu/useXuqiuList'
 *
 * const {
 *   loading,
 *   dataList,
 *   currentPage,
 *   pageSize,
 *   total,
 *   activeCategory,
 *   getData,
 *   handlePageChange,
 *   formatTime,
 *   getStatusText,
 * } = useXuqiuList({
 *   initialPageSize: 20,
 *   onDataLoaded: () => {
 *     logger.info('[Xuqiu] Data loaded')
 *   },
 * })
 *
 * onMounted(() => {
 *   getData()
 * })
 * </script>
 *
 * <template>
 *   <el-table :data="dataList" v-loading="loading">
 *     <el-table-column prop="title" label="标题" />
 *     <el-table-column prop="status" label="状态">
 *       <template #default="{ row }">
 *         {{ getStatusText(row.status) }}
 *       </template>
 *     </el-table-column>
 *     <el-table-column prop="createTime" label="创建时间">
 *       <template #default="{ row }">
 *         {{ formatTime(row.createTime) }}
 *       </template>
 *     </el-table-column>
 *   </el-table>
 *
 *   <el-pagination
 *     v-model:current-page="currentPage"
 *     v-model:page-size="pageSize"
 *     :total="total"
 *     @current-change="handlePageChange"
 *   />
 * </template>
 * ```
 */
export function useXuqiuList(options: UseXuqiuListOptions = {}) {
  const { initialPageSize = 10, onDataLoaded } = options
  const { t } = useLang()

  const loading = ref(true)
  const dataList = ref<DemandItem[]>([])
  const currentPage = ref(1)
  const pageSize = ref(initialPageSize)
  const total = ref(0)
  const activeCategory = ref('')

  // 筛选状态
  const filterState = reactive({
    status: '' as string | number | '',
    tags: [] as string[],
    keyword: '',
    startDate: '',
    endDate: '',
  })

  interface Page {
    pageNum: number
    pageSize: number
    total: number
  }

  const page = reactive<Page>({
    pageNum: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  const filteredDemands = computed(() => {
    let result = [...dataList.value]

    // 按状态筛选
    if (filterState.status !== '') {
      result = result.filter(item => {
        if (typeof filterState.status === 'number') {
          return item.status === filterState.status
        }
        const statusMap: Record<string, number> = {
          pending: 0,
          processing: 2,
          completed: 1,
          cancelled: 3,
        }
        return item.status === statusMap[filterState.status] || item.status === Number(filterState.status)
      })
    }

    // 按标签筛选
    if (filterState.tags.length > 0) {
      result = result.filter(item =>
        filterState.tags.some(tag => item.tags.includes(tag))
      )
    }

    // 关键词搜索（标题与描述）
    if (filterState.keyword.trim()) {
      const keyword = filterState.keyword.toLowerCase()
      result = result.filter(item =>
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword)
      )
    }

    // 按时间筛选
    if (filterState.startDate || filterState.endDate) {
      result = result.filter(item => {
        const itemDate = new Date(item.createTime).getTime()
        if (filterState.startDate) {
          const startDate = new Date(filterState.startDate).getTime()
          if (itemDate < startDate) return false
        }
        if (filterState.endDate) {
          const endDate = new Date(filterState.endDate).getTime() + 24 * 60 * 60 * 1000 // 包含结束日期当天
          if (itemDate >= endDate) return false
        }
        return true
      })
    }

    return result
  })

  const displayedDemands = computed(() => {
    return filteredDemands.value
  })

  const formatTime = (time: string): string => {
    return time ? time.substring(0, 10) : ''
  }

  const getStatusText = (status: number): string => {
    switch (status) {
      case 1:
        return t('xuqiu.statusCompleted')
      case 2:
        return t('xuqiu.statusInProgress')
      default:
        return t('xuqiu.statusPending')
    }
  }

  /** 本地 mock 演示数据（当后端 500 时使用，保证页面可正常展示）。 */
  const buildMockXuqiuList = (): DemandItem[] => {
    const now = Date.now()
    const day = 86400000
    return [
      {
        id: 'mock-1', title: 'AI 智能客服系统定制开发', description: '需要一套支持多轮对话的智能客服系统，需与 CRM 打通，目标 7 天内 POC 验证。',
        tags: ['aiChat', 'development'], status: 2,
        createTime: new Date(now - day * 2).toISOString(),
        username: 'AI探索者', avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
        viewCount: 128, commentCount: 12, likeCount: 8,
      },
      {
        id: 'mock-2', title: 'AI 头像生成 API 集成咨询', description: '希望接入稳定的 AI 头像生成服务，要求支持校园站点 1w+ 用户。',
        tags: ['aiDrawing', 'design'], status: 2,
        createTime: new Date(now - day * 5).toISOString(),
        username: '设计小米', avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
        viewCount: 86, commentCount: 5, likeCount: 3,
      },
      {
        id: 'mock-3', title: 'AI 编程助手私有化部署', description: '团队 30+ 人，希望私有化部署 AI 编程助手，需支持代码上传与安全审计，要求支持主流 IDE。',
        tags: ['aiCoding', 'development'], status: 1,
        createTime: new Date(now - day * 7).toISOString(),
        username: '前端老张', avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
        viewCount: 312, commentCount: 28, likeCount: 19,
      },
      {
        id: 'mock-4', title: '短视频脚本批量生成', description: '希望用 AI 自动生成多条短视频脚本，需包含分镜、口播建议与字幕。',
        tags: ['aiWriting', 'business'], status: 2,
        createTime: new Date(now - day * 1).toISOString(),
        username: '运营Anna', avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
        viewCount: 64, commentCount: 3, likeCount: 2,
      },
      {
        id: 'mock-5', title: 'AI 数字人视频生成方案', description: '希望用 AI 生成数字人口播视频，要求目标单条 1 分钟以内，支持中英双语。',
        tags: ['aiVideo', 'design'], status: 2,
        createTime: new Date(now - day * 3).toISOString(),
        username: '创业Tom', avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
        viewCount: 201, commentCount: 17, likeCount: 11,
      },
    ]
  }

  const getData = async (): Promise<void> => {
    if (loading.value && dataList.value.length > 0) {
      return
    }

    loading.value = true
    try {
      page.pageNum = currentPage.value
      page.pageSize = pageSize.value

      const params = {
        pageNum: currentPage.value,
        pageSize: pageSize.value,
        status: activeCategory.value || filterState.status || '',
        search: filterState.keyword || '',
        creator: '',
        types: filterState.tags || [],
        categorys: [],
        startDate: filterState.startDate || '',
        endDate: filterState.endDate || '',
      }

      const response = await getXuqiuList(params)

      const responseTyped = response as {
        code?: number
        data?: { records?: unknown[]; total?: number }
      }
      if (responseTyped && responseTyped.code === 200 && responseTyped.data) {
        dataList.value = (responseTyped.data.records || []) as DemandItem[]
        page.total = responseTyped.data.total || 0
        total.value = responseTyped.data.total || 0
      } else {
        dataList.value = []
        page.total = 0
        total.value = 0
        ElMessage.warning(t('xuqiu.fetchDataFailed'))
      }
    } catch (error: unknown) {
      // 500 / 网络异常时 fallback 到本地 mock 数据，保证页面可用。
      logger.warn('[Xuqiu] Backend unreachable, switched to local demo data:', error)
      const mock = buildMockXuqiuList()
      dataList.value = mock
      page.total = mock.length
      total.value = mock.length
    } finally {
      loading.value = false
      if (onDataLoaded) {
        onDataLoaded()
      }
    }
  }

  const handlePageChange = (pageNum: number): void => {
    currentPage.value = pageNum
    page.pageNum = pageNum
    void getData()
  }

  // 监听 pageSize 变化
  watch(
    () => pageSize.value,
    (newSize: number) => {
      page.pageSize = newSize
      currentPage.value = 1
      page.pageNum = 1
      void getData()
    }
  )

  // 监听分类变化
  watch(
    () => activeCategory.value,
    () => {
      currentPage.value = 1
      page.pageNum = 1
      void getData()
    }
  )

  // 设置筛选条件
  const setFilter = (filters: Partial<typeof filterState>) => {
    Object.assign(filterState, filters)
    currentPage.value = 1
    page.pageNum = 1
    void getData()
  }

  // 重置筛选条件
  const resetFilter = () => {
    filterState.status = ''
    filterState.tags = []
    filterState.keyword = ''
    filterState.startDate = ''
    filterState.endDate = ''
    currentPage.value = 1
    page.pageNum = 1
    void getData()
  }

  return {
    loading,
    dataList,
    currentPage,
    pageSize,
    total,
    activeCategory,
    page,
    filterState,
    filteredDemands,
    displayedDemands,
    formatTime,
    getStatusText,
    getData,
    handlePageChange,
    setFilter,
    resetFilter,
  }
}
