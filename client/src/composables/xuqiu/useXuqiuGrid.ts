/**
 * 需求广场网格布局管理 Composable
 *
 * 负责根据容器大小动态计算网格行列数，并处理响应式布局
 *
 * @packageDocumentation
 */

import { ref, nextTick, onUnmounted } from 'vue'

/**
 * useXuqiuGrid 配置选项
 */
export interface UseXuqiuGridOptions {
  /** 需求列表容器引用 */
  demandListRef: { value: HTMLElement | null }
  /** 页面大小变化回调 */
  onPageSizeChange?: (newSize: number) => void
}

/**
 * 需求广场网格布局管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回网格行列数、容器引用和相关方法
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useXuqiuGrid } from '@/composables/xuqiu/useXuqiuGrid'
 *
 * const demandListRef = ref<HTMLElement | null>(null)
 * const { gridRows, gridColumns, contentSectionRef } = useXuqiuGrid({
 *   demandListRef,
 * })
 * </script>
 *
 * <template>
 *   <div ref="contentSectionRef" class="content-section">
 *     <div ref="demandListRef" class="demand-list">
 *       <div
 *         class="demand-grid"
 *         :style="{
 *           gridTemplateRows: `repeat(${gridRows}, 1fr)`,
 *           gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
 *         }"
 *       >
 *         <!-- 需求卡片 -->
 *       </div>
 *     </div>
 *   </div>
 * </template>
 * ```
 */
export function useXuqiuGrid(options: UseXuqiuGridOptions) {
  const { demandListRef, onPageSizeChange } = options

  const gridRows = ref(3)
  const gridColumns = ref(3)
  let contentSectionRef: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let handleWindowResize: (() => void) | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  let isUpdatingPageSize = false

  const calculateGridRows = (
    pageSizeRef?: { value: number },
    loadingRef?: { value: boolean },
    dataListRef?: { value: unknown[] },
    getDataFn?: () => Promise<void>
  ): void => {
    if (!demandListRef.value) return

    const contentSection =
      contentSectionRef || (demandListRef.value.closest('.content-section') as HTMLElement)
    if (!contentSection) return

    if (!contentSectionRef) {
      contentSectionRef = contentSection
    }

    const computedStyle = window.getComputedStyle(contentSection)
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
    const availableHeight = contentSection.clientHeight - paddingTop - paddingBottom

    if (availableHeight <= 0) return

    const allCards = Array.from(
      demandListRef.value.querySelectorAll('.demand-item')
    ) as HTMLElement[]

    if (allCards.length === 0) {
      if (gridRows.value !== 3) {
        gridRows.value = 3
      }
      return
    }

    const firstRowCards = allCards.slice(0, 3)
    let cardHeight = 0

    if (firstRowCards.length > 0) {
      const heights = firstRowCards.map(card => {
        const height = card.offsetHeight || card.getBoundingClientRect().height
        return height
      })
      cardHeight = Math.max(...heights)

      if (cardHeight === 0 || cardHeight < 200) {
        cardHeight = 350
      }
    } else {
      cardHeight = 350
    }

    let buttonBottomOffset = 0
    if (firstRowCards.length > 0) {
      const firstCard = firstRowCards[0]
      const buttonElement = firstCard.querySelector('.demand-actions .el-button') as HTMLElement
      if (buttonElement) {
        const cardRect = firstCard.getBoundingClientRect()
        const buttonRect = buttonElement.getBoundingClientRect()
        buttonBottomOffset = buttonRect.bottom - cardRect.top
      } else {
        buttonBottomOffset = cardHeight - 20
      }
    } else {
      buttonBottomOffset = cardHeight - 20
    }

    const gap = 12

    const listComputedStyle = window.getComputedStyle(demandListRef.value)
    const listPaddingTop = parseFloat(listComputedStyle.paddingTop) || 0
    const listPaddingBottom = parseFloat(listComputedStyle.paddingBottom) || 0

    const actualAvailableHeight = availableHeight - listPaddingTop - listPaddingBottom

    let calculatedRows = 0

    for (let rows = 3; rows >= 1; rows--) {
      const totalNeededHeight = rows * cardHeight + (rows - 1) * gap
      const lastRowButtonBottom = (rows - 1) * cardHeight + (rows - 1) * gap + buttonBottomOffset

      if (
        totalNeededHeight <= actualAvailableHeight + 2 &&
        lastRowButtonBottom <= actualAvailableHeight + 2
      ) {
        calculatedRows = rows
        break
      }
    }

    calculatedRows = Math.max(1, calculatedRows)
    calculatedRows = Math.min(3, calculatedRows)

    let calculatedColumns = 3
    if (demandListRef.value) {
      const computedStyle = window.getComputedStyle(demandListRef.value)
      const gridTemplateColumns = computedStyle.gridTemplateColumns
      if (gridTemplateColumns) {
        const columns = gridTemplateColumns.split(' ').filter(col => col.trim() !== '').length
        if (columns > 0) {
          calculatedColumns = columns
        }
      }

      const allCards = Array.from(
        demandListRef.value.querySelectorAll('.demand-item')
      ) as HTMLElement[]
      if (allCards.length > 0) {
        const firstCard = allCards[0]
        if (firstCard) {
          const firstCardTop = firstCard.getBoundingClientRect().top
          const firstRowCards = allCards.filter(card => {
            const cardTop = card.getBoundingClientRect().top
            return Math.abs(cardTop - firstCardTop) < 5
          })
          calculatedColumns = firstRowCards.length || calculatedColumns
        }
      }
    }

    if (gridRows.value !== calculatedRows) {
      gridRows.value = calculatedRows
    }

    if (gridColumns.value !== calculatedColumns) {
      gridColumns.value = calculatedColumns
    }

    const calculatedPageSize = calculatedRows * calculatedColumns
    if (calculatedPageSize > 0 && !isUpdatingPageSize) {
      if (pageSizeRef && pageSizeRef.value !== calculatedPageSize) {
        isUpdatingPageSize = true
        const oldPageSize = pageSizeRef.value
        pageSizeRef.value = calculatedPageSize

        if (onPageSizeChange) {
          onPageSizeChange(calculatedPageSize)
        }

        if (
          loadingRef &&
          dataListRef &&
          getDataFn &&
          !loadingRef.value &&
          oldPageSize > 0 &&
          dataListRef.value.length > 0
        ) {
          void nextTick(() => {
            void getDataFn().finally(() => {
              isUpdatingPageSize = false
            })
          })
        } else {
          isUpdatingPageSize = false
        }
      }
    }
  }

  const optimizePaginationDisplay = (): void => {
    void nextTick(() => {
      const totalElement = document.querySelector('.el-pagination__total')
      if (totalElement) {
        const text = totalElement.textContent || ''
        const match = text.match(/\d+/)
        if (match && text !== match[0]) {
          totalElement.textContent = match[0]
        }
      }
    })
  }

  const initGridObserver = (): void => {
    if (typeof ResizeObserver !== 'undefined') {
      void nextTick(() => {
        const contentSection = demandListRef.value?.closest('.content-section') as HTMLElement
        if (contentSection) {
          contentSectionRef = contentSection
          resizeObserver = new ResizeObserver(() => {
            calculateGridRows()
          })
          resizeObserver.observe(contentSection)
        }
      })
    }

    if (!handleWindowResize) {
      handleWindowResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          calculateGridRows()
        }, 16)
      }
    }
    window.addEventListener('resize', handleWindowResize)
  }

  const cleanup = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    if (handleWindowResize) {
      window.removeEventListener('resize', handleWindowResize)
      handleWindowResize = null
    }
    contentSectionRef = null
  }

  onUnmounted(() => {
    cleanup()
  })

  const calculateGridRowsWithData = (
    pageSizeRef: { value: number },
    loadingRef: { value: boolean },
    dataListRef: { value: unknown[] },
    getDataFn: () => Promise<void>
  ): void => {
    calculateGridRows(pageSizeRef, loadingRef, dataListRef, getDataFn)
  }

  return {
    gridRows,
    gridColumns,
    calculateGridRows: calculateGridRowsWithData,
    optimizePaginationDisplay,
    initGridObserver,
    cleanup,
  }
}
