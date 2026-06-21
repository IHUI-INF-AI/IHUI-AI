/**
 * AI 通用 Composable 函数
 * 提取 useAiBase 和 useAiIndex 中的公共代码
 */

import { computed, ref } from 'vue'

/**
 * 图片列表相关的通用函数
 */
export function useAiImageList() {
  // 计算属性
  const imgsListProp = computed(() => {
    return '_imgsList' // 或 'imgsList'
  })

  /**
   * 设置图片列表
   */
  const setImgsList = (
    value: Array<{ imgUrl?: string; [key: string]: any }>,
    context: Record<string, unknown>
  ): void => {
    if (context._imgsList !== undefined) {
      context._imgsList = value
    } else {
      context.imgsList = value
    }
  }

  /**
   * 获取图片列表
   * 统一实现：优先使用 _imgsList，其次使用 imgsList，确保返回数组类型
   */
  const getImgsList = (
    context: Record<string, unknown>
  ): Array<{ imgUrl?: string; [key: string]: any }> => {
    if (context._imgsList !== undefined) {
      const imgsList = context._imgsList
      if (Array.isArray(imgsList)) {
        return imgsList as Array<{ imgUrl?: string; [key: string]: any }>
      }
      return []
    }
    const imgsList = context.imgsList
    if (Array.isArray(imgsList)) {
      return imgsList as Array<{ imgUrl?: string; [key: string]: any }>
    }
    return []
  }

  return {
    imgsListProp,
    setImgsList,
    getImgsList,
  }
}

/**
 * AI 通用响应式状态
 */
export function useAiCommonState() {
  const requestTime = ref<ReturnType<typeof setTimeout> | null>(null)
  const JobId = ref<string>('')
  const talking = ref<boolean>(false)
  const socketTask = ref<{ close?: () => void; send?: (data: any) => void; [key: string]: any } | null>(null)
  const textIndex = ref<number>(0)
  const modelConfigChangeData = ref<Record<string, unknown>>({})
  const audioTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  return {
    requestTime,
    JobId,
    talking,
    socketTask,
    textIndex,
    modelConfigChangeData,
    audioTimer,
  }
}
