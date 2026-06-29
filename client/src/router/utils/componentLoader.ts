import type { Component } from 'vue'
import { logger } from '@/utils/logger'
import { useLoadingStore } from '@/stores/loading'

export const withRetry = <T>(loader: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
  return loader().catch(err => {
    if (retries <= 0) {
      logger.error('[Router] Component load failed after multiple retries:', err)
      return Promise.reject(err)
    }
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        withRetry(loader, retries - 1, delayMs)
          .then(resolve)
          .catch(reject)
      }, delayMs)
    })
  })
}

const createComponentLoader = (
  importFn: () => Promise<unknown>,
  fallbackTemplate?: string
): (() => Promise<unknown>) => {
  return () => {
    return withRetry(importFn, 3, 1000)
      .then((module: unknown) => {
        if (module && typeof module === 'object') {
          const mod = module as Record<string, unknown>
          if ('default' in mod && mod.default) {
            const component = mod.default
            if (component && (typeof component === 'function' || typeof component === 'object')) {
              return component
            }
          }
          if ('__esModule' in mod && mod.__esModule) {
            const keys = Object.keys(mod).filter(k => k !== '__esModule')
            if (keys.length === 1) {
              const component = mod[keys[0]]
              if (component && (typeof component === 'function' || typeof component === 'object')) {
                return component
              }
            }
          }
          if (
            typeof module === 'function' ||
            (typeof module === 'object' && ('setup' in mod || 'render' in mod || 'template' in mod))
          ) {
            return module
          }
        }
        return module
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error('[Router] Component load final failed, using fallback:', error)
        logger.error('[Router] Component load error details:', { message: errorMessage, stack: errorStack })

        // 清除全局加载状态，避免加载状态卡住
        try {
          const loadingStore = useLoadingStore()
          loadingStore.stopGlobalLoading()
        } catch (e) {
          logger.error('[Router] Failed to clear loading state:', e)
        }

        // 供 fallback 展示的具体错误信息（便于排查用户中心等页面加载失败）
        const fallbackErrorDisplay = errorMessage ? String(errorMessage).slice(0, 500) : ''

        const createErrorFallback = () => ({
          name: 'ComponentError',
          template: `
            <div style="padding:40px; text-align:center; background:var(--color-neutral-100); color:var(--el-text-color-primary); min-height:400px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
              <h2 style="margin:0 0 16px 0; font-size:20px; color:var(--el-text-color-primary);">页面加载出错</h2>
              <p style="margin:0 0 24px 0; color:var(--el-text-color-secondary); font-size:14px;">组件加载失败，请刷新页面重试</p>
              <p v-if="errorDetail" style="margin:0 0 16px 0; color:var(--el-text-color-placeholder); font-size:12px; word-break:break-all; max-width:90%;">{{ errorDetail }}</p>
              <div>
                <button type="button" @click="handleReload" style="padding:10px 20px; background:var(--color-primary); color:var(--el-bg-color); border:none; border-radius:var(--global-border-radius); cursor:pointer; font-size:14px; margin-right:12px;">重新加载</button>
                <button type="button" @click="handleGoHome" style="padding:10px 20px; background:var(--color-gray-light); color:var(--el-text-color-primary); border:1px solid var(--border-unified-color); border-radius:var(--global-border-radius); cursor:pointer; font-size:14px;">返回首页</button>
              </div>
            </div>
          `,
          setup() {
            const handleReload = () => window.location.reload()
            const handleGoHome = () => {
              window.location.href = '/'
            }
            return { handleReload, handleGoHome, errorDetail: fallbackErrorDisplay }
          },
        })

        if (fallbackTemplate) {
          return Promise.resolve({
            name: 'ComponentFallback',
            template: fallbackTemplate,
            setup() {
              const handleReload = () => window.location.reload()
              const handleGoHome = () => {
                window.location.href = '/'
              }
              return { handleReload, handleGoHome }
            },
          })
        }

        return Promise.resolve(createErrorFallback())
      })
  }
}

export const safeImport = (
  importFn: () => Promise<unknown>,
  _componentName?: string
): (() => Promise<Component>) => {
  return createComponentLoader(importFn) as () => Promise<Component>
}
