/**
 * ElMessage 进度条增强(新增功能)
 *
 * 原理:
 *   1. patch ElMessage 的静态方法(success/error/warning/info/primary),
 *      在调用时给 options.customClass 追加唯一 marker 类,
 *      调用后在下一帧通过 marker 找到 DOM,设置 --msg-duration CSS 变量
 *      并添加 is-with-progress 类,触发 CSS 进度条动画
 *   2. duration=0(永久显示)不添加进度条,但仍标记 data-mp 属性
 *   3. hover 暂停由 CSS animation-play-state: paused 实现,
 *      与 element-plus 自带的 clearTimer(hover 暂停关闭)行为同步
 *
 * 不使用 MutationObserver 兜底的原因:
 *   主函数 ElMessage(options) 调用无法 patch(ES module default export 只读),
 *   且 MutationObserver 无法从 DOM 获取 duration 属性,会给 duration=0 的永久消息
 *   错误注入进度条。因此只支持静态方法调用(覆盖 99% 使用场景)。
 *
 * 用法:
 *   在 main.ts 中导入本文件即可启用(import './utils/messageProgress')
 *   无需修改任何现有 ElMessage 调用
 *
 * 规范遵守:
 *   - 不修改 element-plus 源码
 *   - 不要求调用方迁移到新 API
 *   - SSR 安全(typeof window 检查)
 *   - 幂等 patch(_patched 标记防止重复)
 */

import { ElMessage } from 'element-plus'

import { logger } from './logger'

/** ElMessage 静态方法类型 */
type MessageStaticMethod = (options?: unknown, appContext?: unknown) => unknown

/** ElMessage 函数对象类型(主函数 + 静态方法) */
interface ElMessageFn {
  (options?: unknown, context?: unknown): unknown
  success: MessageStaticMethod
  warning: MessageStaticMethod
  info: MessageStaticMethod
  error: MessageStaticMethod
  primary: MessageStaticMethod
  closeAll: (type?: string) => void
  closeAllByPlacement: (placement: string) => void
  _context: unknown
}

/** element-plus 默认 duration */
const DEFAULT_DURATION = 3000

/** patch 幂等标记 */
let _patched = false

/** marker 唯一种子 */
let _seed = 0

/** 已处理的 DOM 标记,避免 MutationObserver 重复处理 */
const MP_ATTR = 'data-mp'

/**
 * 标准化 options:与 element-plus 的 normalizeOptions 一致
 * 支持 string / object / function / vnode 参数
 */
function normalizeOptions(options: unknown): Record<string, unknown> {
  if (!options || typeof options === 'string') {
    return { message: options }
  }
  if (typeof options === 'function') {
    return { message: options }
  }
  if (typeof options === 'object' && options !== null) {
    return { ...(options as Record<string, unknown>) }
  }
  return { message: options }
}

/**
 * 给 DOM 元素注入进度条
 * 设置 --msg-duration CSS 变量 + is-with-progress 类 + 标记 data-mp 属性
 *
 * 注意:本函数不检查 data-mp 属性(由调用方 markWithMarker 确保只调用一次)
 */
function injectProgress(el: HTMLElement, duration: number): void {
  el.style.setProperty('--msg-duration', `${duration}ms`)
  el.classList.add('is-with-progress')
  el.setAttribute(MP_ATTR, '1')
}

/**
 * 通过 marker 类找到对应的 .el-message DOM
 * - 标记 data-mp 属性(防止 MutationObserver 重复处理)
 * - duration>0 时注入进度条
 * - duration<=0 时只标记,不注入进度条(永久显示的消息不需要进度条)
 * 用 requestAnimationFrame 确保 DOM 已插入
 */
function markWithMarker(marker: string, duration: number): void {
  // 双重 rAF:第一帧 DOM 刚插入,第二帧样式已计算,确保动画正确启动
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.el-message.${marker}`) as HTMLElement | null
      if (!el) return
      // 移除 marker 类(避免长期残留影响样式查询)
      el.classList.remove(marker)
      // duration>0 才注入进度条(injectProgress 内部会标记 data-mp)
      // duration=0 永久显示,只标记 data-mp,不注入进度条
      if (duration > 0) {
        injectProgress(el, duration)
      } else {
        el.setAttribute(MP_ATTR, '1')
      }
    })
  })
}

/**
 * patch 单个静态方法
 * 返回 patch 后的函数
 *
 * 关键:无论 duration 是否为 0,都追加 marker 并在 rAF 中标记 data-mp 属性,
 * 这样 MutationObserver 兜底不会重复处理 patch 已处理的消息。
 * duration>0 时额外注入进度条;duration=0 时只标记不注入。
 */
function patchStaticMethod(
  original: MessageStaticMethod,
  type: string,
): MessageStaticMethod {
  return function patched(this: unknown, options?: unknown, appContext?: unknown) {
    const opts = normalizeOptions(options)

    // 读取 duration(未设置则用 element-plus 默认 3000)
    const duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION

    // 追加唯一 marker 到 customClass(无论 duration 是否为 0,都标记以避免 MutationObserver 重复处理)
    const marker = `mp-${type}-${++_seed}`
    const userCustomClass = (opts.customClass as string) || ''
    opts.customClass = userCustomClass ? `${userCustomClass} ${marker}` : marker

    // 调用原静态方法
    const handler = original.call(this, opts, appContext)

    // 下一帧找到 DOM 标记 + (duration>0 时)注入进度条
    markWithMarker(marker, duration)

    return handler
  }
}

/**
 * 主入口:patch ElMessage 静态方法
 * 幂等:多次调用只 patch 一次
 */
export function setupMessageProgress(): void {
  if (_patched) return
  if (typeof window === 'undefined') return // SSR 安全

  const msg = ElMessage as unknown as ElMessageFn

  // patch 所有静态方法
  const staticMethods = ['success', 'warning', 'info', 'error', 'primary'] as const
  for (const type of staticMethods) {
    const original = msg[type]
    if (typeof original === 'function') {
      msg[type] = patchStaticMethod(original as MessageStaticMethod, type)
    }
  }

  _patched = true
  logger.info('[messageProgress] ElMessage 进度条增强已启用')
}
