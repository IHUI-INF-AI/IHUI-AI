// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * XUI-011 / XUI-012 回归:小程序垫片的**导出形状**必须与消费方写法一致。
 *
 * 两处都是同一型缺陷 —— 垫片"实现有了但导出没对齐",ESM 命名导入拿到 `undefined`,
 * 失败发生在模块初始化期(React 渲染之前),表现为整块共享屏白屏 / 启动即崩,
 * 运行日志里只剩一句 "is not a function" / "Element type is invalid"。
 * 所以这里钉的是契约面:**消费方写了哪种导入,垫片就必须有哪种导出**。
 *
 * 为什么不 import native-webview 做运行时断言:该文件经 `@tarojs/components` 间接引入
 * hammerjs,需要 DOM;为一条导出形状断言把整个 suite 的运行时换成 jsdom,风险大于收益。
 * 那里改用"源码形状 + 消费方写法"两侧对账,判据与缺陷同源。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentPages: vi.fn(() => [{}]),
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    switchTab: vi.fn(),
    navigateBack: vi.fn(),
    showToast: vi.fn(),
    getCurrentInstance: vi.fn(() => ({ page: null, router: { path: '', params: {} } })),
  },
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
  useUnload: vi.fn(),
}))

import * as navigationShim from './navigation'

const COMPAT_DIR = path.resolve(__dirname)

describe('XUI-011 navigation 垫片导出 createNavigationContainerRef', () => {
  it('模块面存在该导出(修前缺失 ⇒ 消费方 import 到 undefined)', () => {
    expect(typeof navigationShim.createNavigationContainerRef).toBe('function')
  })

  it('返回容器的五个方法齐备', () => {
    const ref = navigationShim.createNavigationContainerRef()
    expect(typeof ref.isReady).toBe('function')
    expect(typeof ref.navigate).toBe('function')
    expect(typeof ref.goBack).toBe('function')
    expect(typeof ref.getCurrentRoute).toBe('function')
    expect(typeof ref.getRootState).toBe('function')
  })

  it('isReady 按页面栈就绪判定(不是恒真常量)', () => {
    expect(navigationShim.createNavigationContainerRef().isReady()).toBe(true)
  })

  it('getRootState 复用 getNavigationState,不另造一份读数', () => {
    expect(navigationShim.createNavigationContainerRef().getRootState()).toEqual(
      navigationShim.getNavigationState(),
    )
  })

  it('未登记的路由名走失败出口,不静默 no-op', () => {
    const seen: string[] = []
    const off = navigationShim.onNavigationFailure((failure) => seen.push(String(failure.reason)))
    navigationShim.createNavigationContainerRef().navigate('__no_such_route__')
    off()
    expect(seen).toContain('unmapped')
  })
})

describe('XUI-012 react-native-webview 垫片导出形状', () => {
  const src = readFileSync(path.join(COMPAT_DIR, 'native-webview.tsx'), 'utf8')

  it('有默认导出', () => {
    expect(src).toMatch(/export default function WebView\b/)
  })

  it('也有命名导出(消费方三处写的是 import { WebView })', () => {
    expect(src).toMatch(/export \{ WebView \}/)
  })

  it('命名导出指向同一个实现,不得另写第二份组件', () => {
    // 只允许一处 `function WebView(` —— 多一份就是两套行为
    expect(src.match(/function WebView\(/g)?.length ?? 0).toBe(1)
  })

  it('RN 侧三处消费方确实用命名导入(缺陷的真实触发面)', () => {
    const rnRoot = path.resolve(COMPAT_DIR, '../../../mobile-rn')
    const consumers = [
      'src/screens/LoginScreen.tsx',
      'src/screens/WebViewScreen.tsx',
      'src/screens/ArtifactPreviewScreen.tsx',
    ]
    const nameImports = consumers.filter((rel) =>
      /import\s*\{[^}]*\bWebView\b[^}]*\}\s*from\s*['"]react-native-webview['"]/.test(
        readFileSync(path.join(rnRoot, rel), 'utf8'),
      ),
    )
    expect(nameImports.length).toBe(3)
  })
})
