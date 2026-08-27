/**
 * 远程图标 CDN 前缀(运行时可配置)
 *
 * 优先使用环境变量,无则回退到硬编码默认值:
 *   - Taro 编译期可通过 APP_ENV.IMAGE_CDN_BASE 注入
 *   - 真机/云函数可通过 process.env.IMAGE_CDN_BASE 注入
 *   - 默认指向新 CDN img.aizhs.top(内网穿透部署)
 */

function _env(name: string, fallback: string): string {
  const g = globalThis as unknown as Record<string, string | undefined>
  const globalValue = typeof g[name] === 'string' ? g[name] : undefined
  const envValue = typeof process !== 'undefined' ? process.env?.[name] : undefined
  const v = globalValue ?? envValue
  return v && v.trim() ? v : fallback
}

/** 新 CDN 基础 URL(替换已失效的 file.aizhs.top / bspapp.com) */
export const AIZHS_BASE: string = _env('IMAGE_CDN_BASE', 'https://img.aizhs.top')
/** 第二 CDN 基础 URL(保留兼容,默认与新 CDN 相同) */
export const BSPAPP_BASE: string = _env('IMAGE_CDN_BASE_2', AIZHS_BASE)

export function bspappUrl(path: string): string {
  return `${BSPAPP_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
export function aizhsUrl(path: string): string {
  return `${AIZHS_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
