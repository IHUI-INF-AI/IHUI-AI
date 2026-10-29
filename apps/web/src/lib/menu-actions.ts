// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  type MenuActionId,
  openAdminWindow,
  quitApp,
  toggleAlwaysOnTop,
  toggleDevtools,
  toggleFullscreen,
} from './tauri-bridge'

/**
 * 应用菜单 dispatcher(2026-07-25 立,深度对标 Codex / Claude Desktop 菜单架构)
 *
 * 设计背景:
 * - 2026-07-25 前:Rust 端 build_app_menu 构建原生菜单,点击时通过
 *   `emit_to("main","menu:click",id)` 通知前端 dispatcher
 * - 2026-07-25 后:Rust 端原生菜单已删除(避免原生菜单 + HTML 顶栏两层菜单割裂),
 *   菜单 UI 由 NativeTopBar 自绘;菜单点击事件统一通过本 dispatcher 派发
 *
 * 调用源:
 * - NativeTopBar 文件/视图/帮助 dropdown 点击(2026-07-25 后)
 * - useNativeShortcuts 监听 Ctrl+R/F12/Ctrl+Q(2026-07-25 后,
 *   替代原 Rust MenuItemBuilder.accelerator)
 *
 * 派发逻辑:
 * - 需要 Rust 能力的(view.devtools / file.quit / file.open_admin):
 *   走 tauri-bridge 的 invoke 命令
 * - 不需要 Rust 能力的(view.reload):web 端用 location.reload() 直接处理
 * - help.about:弹 toast(后续可换 Modal)
 *
 * 单点出口:未来若需统一埋点(菜单点击事件 analytics)只改这一处。
 *
 * 非 Tauri 环境:所有需要 Rust 能力的函数已在 tauri-bridge 内部静默 noop,
 * 帮助菜单的 toast 用 sonner 直接弹。Web 端菜单按钮依然可点,只是"唤起 admin"
 * 等能力失效,符合 tauri-bridge 的"非 Tauri 静默"约定。
 */
export async function dispatchMenuAction(id: MenuActionId): Promise<void> {
  switch (id) {
    case 'file.open_admin':
      await openAdminWindow()
      return
    case 'file.quit':
      // 退出=立即(2026-09-27 用户明确要求,取代旧"退出前检查更新"链):
      // 更新能力由启动静默检查与托盘/菜单独立的「检查更新」项承担,此处不再 await 任何网络操作
      await quitApp()
      return
    case 'view.reload':
      // Tauri WebView 内 Ctrl+R 可能被 webview 拦截,显式 reload 兜底;
      // 浏览器端 location.reload() 也安全
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
      return
    case 'view.devtools':
      await toggleDevtools()
      return
    case 'view.fullscreen':
      await toggleFullscreen()
      return
    case 'view.always_on_top':
      await toggleAlwaysOnTop()
      return
    case 'help.about': {
      // 简单 toast 占位(后续可换 Modal 显示版本号/版权/快捷键 cheat sheet)
      const { toast } = await import('sonner')
      toast('智汇AI Desktop', {
        description: '© 2026 IHUI-AI · 工作空间权限 + 8 端协同 + 176 模型',
        duration: 4000,
      })
      return
    }
    default: {
      // 穷举保护:未来新增 MenuActionId 漏改此 switch 时 TS 编译期就会报错
      const _exhaustive: never = id
      void _exhaustive
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
