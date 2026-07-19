import * as React from 'react'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'

/**
 * (auth) 路由组布局 — 登录/注册/忘记密码/OAuth 回调等
 *
 * 重构(2026-07-19):
 * - 原 min-h-screen 依赖 body 滚动填满视口;现 GlobalShell 用 h-screen overflow-hidden 锁定视口,
 *   改为 flex-1 min-h-0 在 GlobalShell 内容槽(flex 容器)中正确填充。
 * - Sidebar + AISidePanel 由根 layout.tsx 的 GlobalShell 全局提供,登录页也会显示侧栏
 *   (Sidebar 在未登录态显示登录入口,符合"所有内容都包含在工作区"的全局设定)。
 * - overflow-y-auto 让长表单(如注册页)可滚动。
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-gradient-to-b from-background to-muted px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* 欢迎图:浅色 welcome.svg,深色 baiwelcome.svg,与 next-themes attribute="class" 配合 */}
          <Image
            src="/images/welcome.svg"
            alt="Welcome to IHUI AI"
            width={447}
            height={67}
            className="welcome-img mb-4 h-auto w-[280px] max-w-full md:w-[340px]"
            loading="eager"
            unoptimized
          />
          <Image
            src="/images/baiwelcome.svg"
            alt=""
            aria-hidden="true"
            width={447}
            height={67}
            className="welcome-img-dark mb-4 h-auto w-[280px] max-w-full md:w-[340px]"
            loading="eager"
            unoptimized
          />
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">IHUI AI</h1>
          <p className="mt-1 text-xs text-muted-foreground">AI SaaS Platform</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">{children}</div>
      </div>
    </div>
  )
}
