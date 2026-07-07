/**
 * 统一 AI 能力 Composable
 * 管理能力列表、选择、调用、自动匹配的全状态
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  listCapabilities,
  invokeCapability,
  invokeCapabilityStream,
  autoMatchCapability,
  getCapabilityCategories,
  CapabilityWebSocketClient,
  type CapabilityItem,
  type CapabilityCategory,
  type InvokeCapabilityRequest,
  type InvokeCapabilityResult,
  type AutoMatchResult,
  type CapabilityType,
} from '@/api/capabilities'
import { logger } from '@/utils/logger'

export function useCapabilities() {
  // ── 状态 ──
  const categories = ref<CapabilityCategory[]>([])
  const allItems = ref<CapabilityItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 当前选中的能力
  const selectedCapability = ref<CapabilityItem | null>(null)
  const selectedCategoryId = ref<string>('')

  // 搜索
  const searchKeyword = ref('')
  const filteredItems = computed(() => {
    if (!searchKeyword.value) return allItems.value
    const kw = searchKeyword.value.toLowerCase()
    return allItems.value.filter(
      (item) =>
        item.name.toLowerCase().includes(kw) ||
        item.description.toLowerCase().includes(kw) ||
        item.tags.some((t) => t.toLowerCase().includes(kw))
    )
  })

  // 自动匹配
  const autoMatchEnabled = ref(true)
  const lastMatchResult = ref<AutoMatchResult | null>(null)

  // 调用状态
  const invoking = ref(false)
  const invokeResult = ref<InvokeCapabilityResult | null>(null)

  // WebSocket 客户端
  let wsClient: CapabilityWebSocketClient | null = null

  // ── 计算属性 ──
  const categoryList = computed(() => categories.value)

  const itemsByCategory = computed(() => {
    const map: Record<string, CapabilityItem[]> = {}
    for (const cat of categories.value) {
      map[cat.id] = cat.items
    }
    return map
  })

  const hasItems = computed(() => allItems.value.length > 0)

  // ── 方法 ──

  /** 加载能力列表 */
  async function loadCapabilities() {
    loading.value = true
    error.value = null
    try {
      const resp = await listCapabilities()
      categories.value = resp.categories || []
      allItems.value = categories.value.flatMap((c) => c.items || [])
      logger.info(`[useCapabilities] loaded ${allItems.value.length} capabilities in ${categories.value.length} categories`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      logger.error('[useCapabilities] load failed', e)
    } finally {
      loading.value = false
    }
  }

  /** 按分类过滤 */
  function getItemsByCategory(categoryId: string): CapabilityItem[] {
    return itemsByCategory.value[categoryId] || []
  }

  /** 选择能力 */
  function selectCapability(item: CapabilityItem | null) {
    selectedCapability.value = item
    if (item) {
      selectedCategoryId.value = item.category
    }
  }

  /** 按类型筛选 */
  function getItemsByType(type: CapabilityType): CapabilityItem[] {
    return allItems.value.filter((item) => item.type === type)
  }

  /** 调用能力 (同步) */
  async function invoke(input: string, options?: Record<string, unknown>): Promise<InvokeCapabilityResult> {
    if (!selectedCapability.value) {
      // 自动匹配
      if (autoMatchEnabled.value) {
        const match = await autoMatch(input)
        if (match && match.capability_id !== 'auto_match') {
          const cap = allItems.value.find((c) => c.id === match.capability_id)
          if (cap) {
            selectedCapability.value = cap
          }
        }
      }
    }

    if (!selectedCapability.value) {
      return { success: false, error: 'No capability selected' }
    }

    invoking.value = true
    try {
      const req: InvokeCapabilityRequest = {
        capability_id: selectedCapability.value.id,
        capability_type: selectedCapability.value.type,
        input,
        options: options || {},
      }
      const result = await invokeCapability(req)
      invokeResult.value = result
      return result
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e)
      invokeResult.value = { success: false, error: err }
      return invokeResult.value
    } finally {
      invoking.value = false
    }
  }

  /** 调用能力 (流式) */
  async function* invokeStream(
    input: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<{ event: string; data?: unknown }> {
    if (!selectedCapability.value) {
      if (autoMatchEnabled.value) {
        await autoMatch(input)
      }
    }
    if (!selectedCapability.value) return

    const req: InvokeCapabilityRequest = {
      capability_id: selectedCapability.value.id,
      capability_type: selectedCapability.value.type,
      input,
      stream: true,
      options: options || {},
    }

    yield* invokeCapabilityStream(req)
  }

  /** 自动匹配能力 */
  async function autoMatch(input: string): Promise<AutoMatchResult | null> {
    try {
      const result = await autoMatchCapability(input)
      lastMatchResult.value = result
      logger.info(`[useCapabilities] auto-match: ${result.capability_name} (${result.confidence})`)
      return result
    } catch (e) {
      logger.error('[useCapabilities] auto-match failed', e)
      return null
    }
  }

  /** 初始化 WebSocket */
  async function initWebSocket() {
    if (wsClient) return
    wsClient = new CapabilityWebSocketClient()
    try {
      await wsClient.connect()
    } catch (e) {
      logger.warn('[useCapabilities] WS connect failed, falling back to HTTP', e)
    }
  }

  /** 通过 WebSocket 调用 */
  function invokeViaWS(
    capabilityId: string,
    input: string,
    onResult: (data: unknown) => void,
    options?: Record<string, unknown>
  ) {
    if (!wsClient?.isConnected) {
      logger.warn('[useCapabilities] WS not connected')
      return false
    }
    const unsub = wsClient.on('result', onResult)
    wsClient.sendInvoke(capabilityId, input, options)
    return unsub
  }

  /** 清理 */
  function cleanup() {
    if (wsClient) {
      wsClient.disconnect()
      wsClient = null
    }
  }

  // ── 生命周期 ──
  onMounted(() => {
    loadCapabilities()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    // 状态
    categories: categoryList,
    allItems,
    filteredItems,
    loading,
    error,
    selectedCapability,
    selectedCategoryId,
    searchKeyword,
    autoMatchEnabled,
    lastMatchResult,
    invoking,
    invokeResult,
    hasItems,
    itemsByCategory,

    // 方法
    loadCapabilities,
    getItemsByCategory,
    getItemsByType,
    selectCapability,
    invoke,
    invokeStream,
    autoMatch,
    initWebSocket,
    invokeViaWS,
    cleanup,
  }
}
