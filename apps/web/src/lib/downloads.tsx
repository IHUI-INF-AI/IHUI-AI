/**
 * 下载配置层(2026-07-19 抽取,2026-07-25 配置外置,2026-08-06 深度扩展)
 *
 * 历史:原本内联在 `apps/web/src/components/sidebar.tsx` 的模块级 `DOWNLOADS` 数组
 *  耦合了 React 组件的图标 import + i18n label key,导致:
 *  1) 测试覆盖困难(必须 mock 整个 React 渲染管线)
 *  2) 后端下载元数据 schema(后续可能对接 CDN + 真实 App Store ID + APK 路径)无法独立演进
 *  3) 8 端下载数据散落在 UI 组件里,缺少单一事实源
 *
 * 抽取后:
 *  - `DownloadPlatform` 联合类型覆盖全部 8 端,与 `apps/*` 目录一一对应(2026-08-06 移至 downloads.config.ts)
 *  - `DownloadEntry` 扩展接口预留 `version?` + `sha256?` + `assets?` 字段(为后续真实下载元数据接入)
 *  - `DOWNLOADS` 常量集中维护,sidebar.tsx 仅做 map 渲染
 *  - 纯数据 + 类型,无 React/JSX 依赖,可独立单测
 *
 * 2026-08-06 深度扩展:
 *  - DOWNLOADS 数组从 PLATFORM_META 读取 version + 主 assets[0] 的 sizeBytes
 *  - 新增 DownloadStatus 联合类型 + getDownloadStatus 函数
 *  - sidebar Popover 根据 status 渲染不同状态(available=可下载 / coming-soon=禁用+badge)
 */

import { Globe, Monitor, Puzzle, Smartphone, Terminal, type LucideIcon } from 'lucide-react'
import * as React from 'react'

import {
  DOWNLOADS_CONFIG,
  PLATFORM_META,
  type DownloadPlatform,
  resolveAndroidHref,
  resolveIosHref,
  resolveWechatHref,
} from '@/config/downloads.config'

// 向后兼容 re-export(原 downloads.tsx 直接 export DownloadPlatform,2026-08-06 移至 downloads.config.ts)
export type { DownloadPlatform } from '@/config/downloads.config'

/** 下载状态(2026-08-06 新增,配合 sidebar Popover 占位状态) */
export type DownloadStatus = 'available' | 'coming-soon'

/** 单个下载条目完整元数据(UI 渲染层用,从 DOWNLOADS 数组 map 渲染)
 * - `version` / `sizeBytes` 从 PLATFORM_META 同步(2026-08-06)
 * - `icon` 同时支持 lucide React 组件和内联 SVG 组件
 */
export interface DownloadEntry {
  platform: DownloadPlatform
  /** i18n label key(必填,所有 5 语言都需翻译) */
  labelKey: string
  /** i18n desc key(可选,i18n 文件可省略) */
  descKey?: string
  /** 下载链接(内部路径或外部 URL,http(s):// 开头视为外链新窗口打开)
   *  - 空字符串表示该端未接入,UI 显示"即将上线"占位
   *  - /download/[platform] 路由表示跳转到详情页
   *  - http(s):// 或 /downloads/... 表示直接下载文件 */
  href: string
  /** lucide 图标组件或自定义 React 组件 */
  icon: LucideIcon | React.FC<{ className?: string }>
  /** 真实下载版本号(从 PLATFORM_META 同步,未接入时为 undefined) */
  version?: string
  /** 文件大小字节(从 PLATFORM_META.assets[0].sizeBytes 同步,无 assets 时为 undefined) */
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
/* 8 端下载数据(单一事实源,UI 组件从本常量 map 渲染)                        */
/* -------------------------------------------------------------------------- */

/**
 * 从 PLATFORM_META 同步 version + 主 asset sizeBytes 到 DownloadEntry,
 * 保持 DOWNLOADS(渲染层数据) 与 PLATFORM_META(元数据) 单一事实源。
 */
function syncMeta(platform: DownloadPlatform): Pick<DownloadEntry, 'version' | 'sizeBytes'> {
  const meta = PLATFORM_META[platform]
  return {
    version: meta?.version,
    sizeBytes: meta?.assets[0]?.sizeBytes || undefined,
  }
}

/** 项目所有 8 端下载条目,UI 组件从本常量 map 渲染 */
export const DOWNLOADS: readonly DownloadEntry[] = [
  {
    platform: 'web',
    labelKey: 'downloadWeb',
    descKey: 'downloadWebDesc',
    href: '/',
    icon: Globe,
    ...syncMeta('web'),
  },
  {
    platform: 'desktop',
    labelKey: 'downloadDesktop',
    descKey: 'downloadDesktopDesc',
    href: DOWNLOADS_CONFIG.hrefs.desktop,
    icon: Monitor,
    ...syncMeta('desktop'),
  },
  {
    platform: 'ios',
    labelKey: 'downloadIOS',
    descKey: 'downloadIOSDesc',
    href: resolveIosHref(),
    icon: AppleIcon,
    ...syncMeta('ios'),
  },
  {
    platform: 'android-apk',
    labelKey: 'downloadAndroidApk',
    descKey: 'downloadAndroidDesc',
    href: resolveAndroidHref(),
    icon: AndroidIcon,
    ...syncMeta('android-apk'),
  },
  {
    platform: 'mobile',
    labelKey: 'downloadMobile',
    descKey: 'downloadMobileDesc',
    href: DOWNLOADS_CONFIG.hrefs.mobile,
    icon: Smartphone,
    ...syncMeta('mobile'),
  },
  {
    platform: 'wechat-miniapp',
    labelKey: 'downloadWechatMiniApp',
    descKey: 'downloadMiniDesc',
    href: resolveWechatHref(),
    icon: WechatMiniIcon,
    ...syncMeta('wechat-miniapp'),
  },
  {
    platform: 'extension',
    labelKey: 'downloadExtension',
    descKey: 'downloadExtensionDesc',
    href: DOWNLOADS_CONFIG.hrefs.extension,
    icon: Puzzle,
    ...syncMeta('extension'),
  },
  {
    platform: 'cli',
    labelKey: 'downloadCli',
    descKey: 'downloadCliDesc',
    href: DOWNLOADS_CONFIG.hrefs.cli,
    icon: Terminal,
    ...syncMeta('cli'),
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

/**
 * 判定指定端的下载是否已接入(配合配置外置)。
 *
 * 空字符串 href 表示该端尚未接入(运营待办),UI 应显示"即将上线"占位状态:
 * - 禁用点击 / 链接按钮置 disabled
 * - 角标显示 "soon" / "即将上线" Badge
 *
 * `web` 端始终可用(首页路由 /);其他端按 href 是否为空判断。
 */
export function isDownloadAvailable(platform: DownloadPlatform): boolean {
  if (platform === 'web') return true
  const entry = getDownloadEntry(platform)
  return Boolean(entry && entry.href.length > 0)
}

/**
 * 获取下载状态(2026-08-06 新增)。
 *
 * - 'available':已接入,可点击下载/跳转详情页
 * - 'coming-soon':未接入,UI 显示"即将上线"占位
 *
 * web 端始终 available;其他端按 href 是否为空判断。
 */
export function getDownloadStatus(platform: DownloadPlatform): DownloadStatus {
  return isDownloadAvailable(platform) ? 'available' : 'coming-soon'
}
