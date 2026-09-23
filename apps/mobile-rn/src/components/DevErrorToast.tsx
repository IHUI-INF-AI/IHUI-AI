// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DevErrorToast — dev 专用报错悬浮条(替换 RN 内核 LogBox,2026-09-22 用户定稿)
 *
 * 背景:RN 内核 LogBox 折叠态只有红色计数徽标——无文字、无投影、左右贴满屏幕,
 * 与项目统一悬浮条风格不符且无样式 API → 自研替换。
 * 样式对齐 web 端 Toaster(web/src/components/common/Toaster.tsx,sonner):
 * - position top-center:顶部中央(StatusBar 下方),左右内收 16
 * - richColors:error 语义红底(danger token)白字,无装饰边条
 * - 圆角 8(rounded-lg)、投影、右上 closeButton、4s 自动消失
 * - 点击展开完整 message + 堆栈(可选中复制);展开态暂停自动消失
 * - 包装 console.error 收集报错:未处理错误/未处理 promise 拒绝经
 *   ExceptionsManager 最终都走 console.error,统一在此捕获
 * 仅 __DEV__ 生效:release 包 LogBox 本就不渲染,本组件同样不挂载。
 * 堆栈面板为简版(纯文本可选中),完整符号化堆栈仍看 metro 终端输出。
 */
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { tokens } from '../theme/active-tokens'
import { X } from 'lucide-react-native'

import { rnRadius } from '@ihui/design-tokens'

interface DevErrorEntry {
  id: number
  message: string
  stack: string | null
}

/** 模块级错误环形缓冲 + 订阅者(hook console.error 的安装早于组件挂载,不丢错) */
const errorLog: DevErrorEntry[] = []
const listeners = new Set<(snapshot: DevErrorEntry[]) => void>()
let nextId = 1

const MAX_ERRORS = 10
const MESSAGE_MAX_CHARS = 500
const SIDE_INSET = 16
/** 顶部中央对齐 web position="top-center":StatusBar 下方 12dp */
const TOP_INSET = 12
const AUTO_DISMISS_MS = 4000
const Z_INDEX = 9999
/** 圆角 8 对齐 web toastOptions borderRadius 8px(rounded-lg) */
const BAR_PADDING_H = 12
const BAR_PADDING_V = 10
const FONT_SIZE = 13
const LINE_HEIGHT = 18
const STACK_FONT_SIZE = 11
const STACK_MAX_HEIGHT = 220
const ICON_SIZE = 16
const BADGE_SIZE = 18
/** richColors:error 语义红底白字(danger token 对齐 web --color-danger #dc2626) */
const BG_COLOR = tokens.danger.DEFAULT
const TEXT_COLOR = tokens.surface.light

function notifyListeners(): void {
  const snapshot = [...errorLog]
  for (const listener of listeners) listener(snapshot)
}

function pushError(message: string, stack: string | null): void {
  errorLog.unshift({ id: nextId++, message, stack })
  if (errorLog.length > MAX_ERRORS) errorLog.pop()
  notifyListeners()
}

function clearErrors(): void {
  errorLog.length = 0
  notifyListeners()
}

/** 全局只安装一次(热重载/多 import 安全),标记挂 globalThis 防重复包装 */
const HOOK_FLAG = '__IHUI_DEV_ERROR_HOOKED__'
if (__DEV__ && !(globalThis as Record<string, unknown>)[HOOK_FLAG]) {
  ;(globalThis as Record<string, unknown>)[HOOK_FLAG] = true
  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      const message = args
        .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : ''))
        .filter((s) => s.length > 0)
        .join(' ')
        .slice(0, MESSAGE_MAX_CHARS)
      const err = args.find((a): a is Error => a instanceof Error)
      pushError(message.length > 0 ? message : 'Unknown console.error', err?.stack ?? null)
    } catch {
      // 收集器自身异常绝不影响原 console.error 链路
    }
    origError(...args)
  }
}

export function DevErrorToast() {
  const [errors, setErrors] = useState<DevErrorEntry[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!__DEV__) return
    const listener = (snapshot: DevErrorEntry[]): void => setErrors(snapshot)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  // 自动消失对齐 web duration=4000:折叠态 4s 清屏;展开态(用户在看堆栈)暂停
  useEffect(() => {
    if (errors.length === 0 || expanded) return
    const timer = setTimeout(clearErrors, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [errors, expanded])

  if (!__DEV__ || errors.length === 0) return null

  const latest = errors[0]
  if (!latest) return null
  const count = errors.length

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Pressable
        style={styles.bar}
        accessibilityRole="alert"
        accessibilityLabel={`开发报错 ${count} 条: ${latest.message}`}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={expanded ? undefined : 3}>
            {latest.message}
          </Text>
          {expanded && latest.stack ? (
            <ScrollView style={styles.stackBox} nestedScrollEnabled>
              <Text style={styles.stackText} selectable>
                {latest.stack}
              </Text>
            </ScrollView>
          ) : null}
        </View>
        {count > 1 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
        <Pressable hitSlop={8} onPress={clearErrors} style={styles.closeBtn}>
          <X size={ICON_SIZE} color={TEXT_COLOR} />
        </Pressable>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: SIDE_INSET,
    right: SIDE_INSET,
    top: (StatusBar.currentHeight ?? 0) + TOP_INSET,
    zIndex: Z_INDEX,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BG_COLOR,
    borderRadius: rnRadius.lg,
    paddingHorizontal: BAR_PADDING_H,
    paddingVertical: BAR_PADDING_V,
    // 投影(Android elevation / iOS shadow)
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    color: TEXT_COLOR,
  },
  stackBox: {
    maxHeight: STACK_MAX_HEIGHT,
    marginTop: 8,
    padding: 8,
    borderRadius: rnRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stackText: {
    fontSize: STACK_FONT_SIZE,
    lineHeight: 15,
    color: TEXT_COLOR,
  },
  badge: {
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2, // radius-exempt: 计数徽章胶囊端=BADGE_SIZE 高度一半(几何圆表达式)
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 13,
    color: TEXT_COLOR,
  },
  closeBtn: {
    width: ICON_SIZE + 8,
    height: ICON_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default DevErrorToast
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
