// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { GlobalErrorBanner } from '@/components/common/GlobalErrorBanner'
import { ConnectivityBanner } from '@/components/layout/ConnectivityBanner'

/**
 * MainShell — (main) 路由组的工作区卡片容器(2026-07-30 第十四次修订:精简)
 *
 * 历史沿革(2026-07-30 修订):
 * - 原 MainShell 内含顶栏(拖拽 + 窗口控制 + TagsView + Globe 入口)
 * - 现顶栏逻辑已迁移至 GlobalTopBar(GlobalShell 全局挂载,所有路由组共享)
 * - MainShell 仅保留"工作区卡片"容器:bg-shell-panel 圆角卡片 + main 内容槽
 *
 * 布局:
 *   <div pb-2 pr-2 min-h-0 flex-1>           ← 外层 wrapper(底部 8px + 右侧 8px,与 GlobalTopBar 的 pt-2/px-2 互补)
 *     <div bg-shell-panel rounded-xl flex-1>   ← 工作区卡片
 *       <main p-3>{children}</main>
 *     </div>
 *   </div>
 *
 * 显式订阅 useAuthStore 触发 (main) 路由组认证态变化重渲染(原顶栏副作用保留)。
 * 桌面端(Tauri)逻辑(8 方向 resize + 窗口控制 + 拖拽 + 主题跟随 + 托盘状态)
 * 全部迁移到 GlobalTopBar,本组件仅承担工作区卡片容器职责。
 *
 * 平台独占:仅 web 端,desktop Tauri 桌面端特殊行为由 GlobalTopBar 接管。
 */
export function MainShell({ children }: { children: React.ReactNode }) {
  // 显式订阅以触发 (main) 路由组的认证态变化(2026-07-30:从原顶栏副作用保留)
  useAuthStore((s) => s.isAuthenticated)

  return (
    // 外层 wrapper:底部 + 右侧各 8px 间距(与 GlobalTopBar 顶部 8px + 左右 8px 互补,
    // 共同构成 work-area 周围的 8px 视觉缓冲)。
    // 顶部间距由 GlobalTopBar 内部 pt-2 提供(统一管理,与 8 方向 resize 区域避让对齐)。
    // 左侧间距由 AISidePanel 容器 mr-1.5 (6px) 提供(打开态=面板右边缘到卡片左边缘 6px;
    // 关闭态=width=0 + mr-1.5 = 6px 占位),此处不再加 pl-2 避免叠加导致 14px 错乱。
    //
    // pl-[var(--topbar-content-left)](2026-08-01 立,根治移动端错位):
    // 移动端(<640px)顶栏第 0 个元素是汉堡按钮(mobileMenu),占 ml-1.5(6)+w-9(36)+gap-1(4)=46px,
    // 把搜索按钮挤到 left=46px。本 pl 让工作区卡片对齐搜索按钮 left,消除 46px 错位。
    // 桌面端(≥640px,2026-09-07 从 1024 下调、2026-10-11 再下调 768→640)汉堡按钮 hidden,--topbar-content-left=0px,pl 不生效。
    //
    // ⚠️ 变量值来源(2026-08-01 根治方案):
    // - SSR 首屏:globals.css :root + @media (min-width:640px) 硬编码 fallback(46px/0px)
    // - JS 执行后:GlobalTopBar 的 ResizeObserver 动态测量搜索按钮实际 left,用 inline style
    //   覆盖(优先级 > stylesheet)。工作区卡片自动跟随 mobileMenu 样式变化,无需手动同步。
    //   详见 GlobalTopBar.tsx useEffect 注释。
    // - 历史根因:旧方案纯硬编码,依赖 mobileMenu 的 ml-1.5/w-9/gap-1,样式变化即失效
    //   → "反反复复修不好"。新方案动态测量根治。
    <div className="flex min-h-0 flex-1 flex-col pb-2 pr-2 pl-[var(--topbar-content-left)] cursor-default">
      {/* 工作区卡片:仅包含 main 内容
          - bg-shell-panel rounded-xl 保持卡片视觉
          - flex-1 + min-h-0 填充剩余高度
          - overflow-hidden 裁剪子元素溢出 + 保持圆角不被覆盖
          - cursor-default:覆盖外层(工作区内是默认光标) */}
      <div
        className="bg-shell-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl cursor-default"
        data-workspace-card
      >
        <main
          id="main"
          tabIndex={-1}
          // 2026-08-01 用户要求"完全去掉 padding,内容占满工作内容展示区":
          // 原 p-3 → laptop:p-8(桌面 32px 四边留白)导致编辑器等所有页面四边有留白,
          // 用户反馈"为啥不占满啊"。现改为无 padding,内容完全贴工作区卡片边缘。
          // 各页面如需内部留白应自行在页面组件内设置(统一为 px-4 py-4)。
          // 2026-08-05 性能优化:content-visibility:auto + contain-intrinsic-size:1000px
          // 让浏览器跳过副屏外内容的渲染,显著提升首帧渲染速度。
          // 2026-08-11 移除 content-visibility + contain-intrinsic-size:
          // 根因:content-visibility:auto 是已知浏览器渲染 bug 来源,
          // 部分浏览器会错误跳过应当可见的内容渲染,导致页面空白/不显示。
          // 用户反馈"点击页面按钮后右侧工作展示区显示错误,没有页面,程序崩溃"。
          //
          // 2026-10-23 G-828 代裁:不得恢复 content-visibility。移除根因是浏览器渲染 bug
          // (06bbd6b486),且本容器是全局工作区、无法圈定只给消息列表用;长会话渲染成本
          // 已由消息列表窗口化挂载承接(chat/windowing.ts:阈值 60 + 挂载上限 120,窗口外
          // 的行根本不挂载,浏览器无屏外内容可跳,两案收益重叠)。
          //
          // 2026-10-22 立 flex 列:main 只有 flex-1(computed height 仍是 auto),
          // 子页面的 h-full 百分比会解析成 auto ⇒ 想要"填满工作区 + 内部滚动"的页面
          // 实际被内容撑高、改由 main 整页滚动(监控大屏左侧导航与工具栏就是这样被滚走的)。
          // 改成 flex 列后,页面根用 `flex-1 min-h-0` 即可拿到确定高度;其余页面作为
          // flex item 仍按内容高度伸展,不受影响。
          className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {/* 2026-08-01 全局错误通知条:从顶部滑下,常驻直到用户关闭
              (用户需求:internet server error 这种错误提示应该从页面上面滑下来,常驻直到错误解决) */}
          <GlobalErrorBanner />
          {/* 2026-10-18 票85③ 连通性横幅:四态各画各的格,在线/没结论时不出现 */}
          <ConnectivityBanner />
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainShell
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
