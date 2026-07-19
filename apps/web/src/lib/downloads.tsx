/**
 * 下载配置层(2026-07-19 抽取)
 *
 * 历史:原本内联在 `apps/web/src/components/sidebar.tsx` 的模块级 `DOWNLOADS` 数组
 *  耦合了 React 组件的图标 import + i18n label key,导致:
 *  1) 测试覆盖困难(必须 mock 整个 React 渲染管线)
 *  2) 后端下载元数据 schema(后续可能对接 CDN + 真实 App Store ID + APK 路径)无法独立演进
 *  3) 8 端下载数据散落在 UI 组件里,缺少单一事实源
 *
 * 抽取后:
 *  - `DownloadPlatform` 联合类型覆盖全部 8 端,与 `apps/*` 目录一一对应
 *  - `DownloadEntry` 扩展接口预留 `version?` + `sha256?` 字段(为后续真实下载元数据接入)
 *  - `DOWNLOADS` 常量集中维护,sidebar.tsx 仅做 map 渲染
 *  - 纯数据 + 类型,无 React/JSX 依赖,可独立单测
 *
 * 真实接入 TODO(本季度内,非本轮范围):
 *  - App Store ID:占位 `https://apps.apple.com/cn/app/ihui-ai` → 真实 ID
 *  - Desktop/Mobile/Extension/CLI 4 端 href 是占位路由,需对接 CDN 真实下载 URL
 *  - APK path:`/apk/ihui-ai-latest.apk` 需与 `apps/web/public/apk/` 实际文件名对齐
 *  - 微信小程序:`/minapp` 是占位,实际是 QR code 扫码入口
 */

import { Globe, Monitor, Puzzle, Smartphone, Terminal, type LucideIcon } from 'lucide-react'
import * as React from 'react'

/** 项目所有支持的下载端(8 端),与 apps/* 目录一一对应 */
export type DownloadPlatform =
  'web' | 'desktop' | 'ios' | 'android-apk' | 'mobile' | 'wechat-miniapp' | 'extension' | 'cli'

/** 单个下载条目完整元数据
 * - `version` / `sha256` 暂未填充(占位),为后续真实 CDN 接入预留
 * - `icon` 同时支持 lucide React 组件和内联 SVG 组件
 */
export interface DownloadEntry {
  platform: DownloadPlatform
  /** i18n label key(必填,所有 5 语言都需翻译) */
  labelKey: string
  /** i18n desc key(可选,i18n 文件可省略) */
  descKey?: string
  /** 下载链接(内部路径或外部 URL,http(s):// 开头视为外链新窗口打开) */
  href: string
  /** lucide 图标组件或自定义 React 组件 */
  icon: LucideIcon | React.FC<{ className?: string }>
  /** 真实下载版本号(占位为 undefined,接入 CDN 时填充,如 "1.2.3") */
  version?: string
  /** 文件 SHA256 校验值(占位为 undefined,接入后端 API 时填充) */
  sha256?: string
  /** 文件大小(字节,可选,UI 可展示 "12.4 MB") */
  sizeBytes?: number
}

/* -------------------------------------------------------------------------- */
/* 品牌图标(内联 SVG,确保 iOS / Android / 微信小程序用准确品牌图形)        */
/* -------------------------------------------------------------------------- */

/** Apple 品牌 logo */
export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.86-3.08.4-1.09-.47-2.09-.49-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

/** Android 机器人 logo(品牌色单色) */
export function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.523 15.341c-.572 0-1.04-.469-1.04-1.04s.468-1.04 1.04-1.04 1.04.469 1.04 1.04-.468 1.04-1.04 1.04m-11.045 0c-.572 0-1.04-.469-1.04-1.04s.468-1.04 1.04-1.04 1.04.469 1.04 1.04-.468 1.04-1.04 1.04m11.461-6.354 2.093-3.625a.479.479 0 0 0-.176-.652.477.477 0 0 0-.652.176l-2.114 3.662C15.683 7.964 13.954 7.5 12 7.5s-3.683.464-5.089 1.048L4.797 4.886a.477.477 0 0 0-.652-.176.479.479 0 0 0-.176.652L6.06 8.987C3.302 10.65 1.5 13.668 1.5 17h21c0-3.332-1.802-6.35-4.561-8.013" />
    </svg>
  )
}

/** 微信小程序 logo(对话气泡+放大镜) */
export function WechatMiniIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 0 0 .166-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .55-.012.822-.034-.17-.585-.26-1.204-.26-1.844 0-3.97 3.842-7.19 8.583-7.19.235 0 .466.013.696.035C17.917 4.084 13.604 2.188 8.691 2.188zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 10.435 7.17c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-3.94 0-7.135 2.7-7.135 6.027 0 3.328 3.195 6.027 7.135 6.027a8.34 8.34 0 0 0 2.018-.252.578.578 0 0 1 .476.066l1.27.737a.218.218 0 0 0 .11.036.195.195 0 0 0 .194-.197.218.218 0 0 0-.032-.108l-.26-.984a.39.39 0 0 1 .142-.443C21.78 19.39 23 17.78 23 15.885c0-3.328-3.196-6.027-7.062-6.027zm-2.378 3.594c.483 0 .875.395.875.882a.879.879 0 0 1-.875.882.879.879 0 0 1-.875-.882c0-.487.392-.882.875-.882zm4.756 0c.483 0 .875.395.875.882a.879.879 0 0 1-.875.882.879.879 0 0 1-.875-.882c0-.487.392-.882.875-.882z" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* 8 端下载数据(单一事实源)                                                  */
/* -------------------------------------------------------------------------- */

/** 项目所有 8 端下载条目,UI 组件从本常量 map 渲染 */
export const DOWNLOADS: readonly DownloadEntry[] = [
  {
    platform: 'web',
    labelKey: 'downloadWeb',
    descKey: 'downloadWebDesc',
    href: '/',
    icon: Globe,
  },
  {
    platform: 'desktop',
    labelKey: 'downloadDesktop',
    descKey: 'downloadDesktopDesc',
    href: '/download/desktop',
    icon: Monitor,
  },
  {
    platform: 'ios',
    labelKey: 'downloadIOS',
    descKey: 'downloadIOSDesc',
    // TODO: 上架后替换为真实 App Store ID
    href: 'https://apps.apple.com/cn/app/ihui-ai',
    icon: AppleIcon,
  },
  {
    platform: 'android-apk',
    labelKey: 'downloadAndroidApk',
    descKey: 'downloadAndroidDesc',
    // TODO: 与 apps/web/public/apk/ 实际文件名对齐,接入 CDN 后改为绝对 URL
    href: '/apk/ihui-ai-latest.apk',
    icon: AndroidIcon,
  },
  {
    platform: 'mobile',
    labelKey: 'downloadMobile',
    descKey: 'downloadMobileDesc',
    href: '/download/mobile',
    icon: Smartphone,
  },
  {
    platform: 'wechat-miniapp',
    labelKey: 'downloadWechatMiniApp',
    descKey: 'downloadMiniDesc',
    // TODO: 实际是 QR code 扫码入口,后续可改为 MiniProgram scheme 或扫码落地页
    href: '/minapp',
    icon: WechatMiniIcon,
  },
  {
    platform: 'extension',
    labelKey: 'downloadExtension',
    descKey: 'downloadExtensionDesc',
    href: '/download/extension',
    icon: Puzzle,
  },
  {
    platform: 'cli',
    labelKey: 'downloadCli',
    descKey: 'downloadCliDesc',
    href: '/download/cli',
    icon: Terminal,
  },
] as const

/** 根据 platform 查表,UI 组件用 `useTranslations` 翻译 labelKey/descKey 后展示 */
export function getDownloadEntry(platform: DownloadPlatform): DownloadEntry | undefined {
  return DOWNLOADS.find((d) => d.platform === platform)
}

/** 判定 href 是否为外部链接(http(s):// 开头) */
export function isExternalDownloadHref(href: string): boolean {
  return /^https?:/.test(href)
}
