/**
 * 字体加载 Composable
 * 抽离自 App.vue 的字体加载链路
 *
 * 流程:
 *  1. 注入全局字体 CSS 变量
 *  2. 预加载 HarmonyOS Sans SC 中文字体(从 assets)
 *  3. 预加载英文字体
 *  4. 应用到 documentElement.style.fontFamily
 *  5. 失败时回退到系统字体
 *
 * 所有错误都被捕获并使用 logger.debug 输出(非阻塞)。
 */

import { onMounted, ref } from 'vue'
import { fontCSS } from '@/styles/font-loader'
import { loadFontStyles, applyGlobalFont } from '@/styles/fonts-import'
import { applyFontToDocument, forceRefreshFont } from '@/utils/font-loader'
import { loadFontFromAssets } from '@/utils/font-assets'
import { loadEnglishFont } from '@/utils/font-assets-english'
import { logger } from '@/utils/logger'

const FALLBACK_FONT = "'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

export interface FontLoaderState {
  /** 是否已加载完成(含回退) */
  loaded: import('vue').Ref<boolean>
  /** 加载过程中是否发生错误 */
  failed: import('vue').Ref<boolean>
  /** 显式触发重新加载 */
  reload: () => Promise<void>
}

/**
 * 在挂载后异步加载字体(不阻塞首屏)。
 * 默认在调用方 onMounted 内部执行。
 */
export function useFontLoader(): FontLoaderState {
  const loaded = ref(false)
  const failed = ref(false)

  const applyFallback = () => {
    applyFontToDocument(FALLBACK_FONT)
  }

  const run = async () => {
    if (typeof document === 'undefined') return

    // 1) 注入全局 CSS 变量
    if (!document.getElementById('font-css')) {
      try {
        const style = document.createElement('style')
        style.id = 'font-css'
        style.textContent = fontCSS
        document.head.appendChild(style)
      } catch {
        // CSS 注入失败可忽略
      }
    }

    // 2) 静默预热字体样式
    try {
      forceRefreshFont(true)
    } catch {
      // ignore
    }

    // 3) 加载样式
    try {
      loadFontStyles()
      applyGlobalFont()
    } catch {
      // 静默
    }

    // 4) 通过 FontFace API 加载字体
    try {
      await loadFontFromAssets(fontCSS)
      await loadEnglishFont()
      applyFontToDocument(FALLBACK_FONT)
      forceRefreshFont(false)
      loaded.value = true
      logger.debug('[useFontLoader] Font loading complete')
    } catch (error) {
      failed.value = true
      logger.debug('[useFontLoader] Font loading failed, using system font fallback', error)
      applyFallback()
      forceRefreshFont(true)
    }
  }

  const reload = async () => {
    loaded.value = false
    failed.value = false
    await run()
  }

  onMounted(() => {
    // 不阻塞页面渲染:setTimeout 让出主线程
    setTimeout(() => {
      void run()
    }, 100)
  })

  return { loaded, failed, reload }
}
