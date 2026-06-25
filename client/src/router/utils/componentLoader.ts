import type { Component } from 'vue'
import { logger } from '@/utils/logger'
import { useLoadingStore } from '@/stores/loading'

// 2026-06-25 修复: Vite dev server 启动期 optimizeDeps 还在扫描依赖, 浏览器已
// 加载 main.ts 触发了懒加载路径 (如 Agents.vue), 但 Vite 还没准备好处理该文件,
// fetch 返回 ERR_ABORTED → 'Failed to fetch dynamically imported module'.
// 解决: dev 模式加大重试次数到 8 次, 每次延迟 1500ms, 总共给 Vite 12s 准备时间;
// 生产模式保持 3 次 × 1s 即可, 因为 build 已预构建完所有依赖.
// 关键: 避免立即 fallback 渲染错误页, 否则首次访问 /agents 等路由会闪 ErrorBoundary.
const IS_DEV = import.meta.env.DEV
const DEFAULT_RETRIES = IS_DEV ? 8 : 3
const DEFAULT_DELAY_MS = IS_DEV ? 1500 : 1000

export const withRetry = <T>(
  loader: () => Promise<T>,
  retries = DEFAULT_RETRIES,
  delayMs = DEFAULT_DELAY_MS,
): Promise<T> => {
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
      .then((module: any) => {
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
