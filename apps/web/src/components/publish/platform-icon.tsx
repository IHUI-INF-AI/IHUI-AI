// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 平台图标 — 按 platformId 映射真实品牌图标(38 平台全覆盖)
 *
 * 图标来源:apps/web/public/publish-icons/*
 * 全部为各平台官方真实图标(官网 favicon / Google s2 favicon / favicon.im 拉取),
 * 严禁手绘或自造品牌图标(见 AGENTS.md §4 官方图标强制条款)。
 * 兜底:platformName 首字符(当前 38 平台已全覆盖,兜底保留以防新增平台未配图标)
 */

interface PngPlatformIcon {
  readonly src: string
  readonly alt: string
  /** 黑色系图标:深色模式下反色为白,避免不可见 */
  readonly invertInDark?: boolean
}

/** platformId → 图标文件(相对 /public 的路径,与 PLATFORM_SCHEMAS 38 平台一一对应)
 *  全部为官方真实 favicon,存放于 public/publish-icons/(与页脚 mono 剪影素材分离) */
const PNG_ICONS: Record<string, PngPlatformIcon> = {
  // 国际平台
  wordpress: { src: '/publish-icons/wordpress.png', alt: 'WordPress', invertInDark: true },
  medium: { src: '/publish-icons/medium.png', alt: 'Medium', invertInDark: true },
  youtube: { src: '/publish-icons/youtube.png', alt: 'YouTube' },
  // 视频平台
  bilibili: { src: '/publish-icons/bilibili.ico', alt: '哔哩哔哩' },
  douyin: { src: '/publish-icons/douyin.png', alt: '抖音', invertInDark: true },
  kuaishou: { src: '/publish-icons/kuaishou.png', alt: '快手' },
  xigua: { src: '/publish-icons/xigua.png', alt: '西瓜视频' },
  haokan: { src: '/publish-icons/baidu.png', alt: '好看视频' },
  shipinhao: { src: '/publish-icons/shipinhao.png', alt: '微信视频号' },
  // 图文社交
  wechat: { src: '/publish-icons/wechat.png', alt: '微信公众号' },
  toutiao: { src: '/publish-icons/toutiao.png', alt: '今日头条' },
  weibo: { src: '/publish-icons/weibo.png', alt: '微博' },
  xiaohongshu: { src: '/publish-icons/xiaohongshu.png', alt: '小红书' },
  // 技术社区
  zhihu: { src: '/publish-icons/zhihu.png', alt: '知乎' },
  csdn: { src: '/publish-icons/csdn.png', alt: 'CSDN' },
  juejin: { src: '/publish-icons/juejin.png', alt: '掘金' },
  cnblogs: { src: '/publish-icons/cnblogs.png', alt: '博客园' },
  segmentfault: { src: '/publish-icons/segmentfault.ico', alt: '思否' },
  oschina: { src: '/publish-icons/oschina.ico', alt: '开源中国' },
  jianshu: { src: '/publish-icons/jianshu.ico', alt: '简书' },
  // 六大号
  baijiahao: { src: '/publish-icons/baidu.png', alt: '百家号' },
  qq: { src: '/publish-icons/qq.png', alt: '企鹅号' },
  dayihao: { src: '/publish-icons/dayihao.png', alt: '大鱼号' },
  netease: { src: '/publish-icons/netease.png', alt: '网易号' },
  sohu: { src: '/publish-icons/sohu.png', alt: '搜狐号' },
  sina: { src: '/publish-icons/sina.png', alt: '新浪看点' },
  // SEO/GEO 第二批
  baidu_zhidao: { src: '/publish-icons/baidu.png', alt: '百度知道' },
  baidu_tieba: { src: '/publish-icons/baidu.png', alt: '百度贴吧' },
  douban: { src: '/publish-icons/douban.png', alt: '豆瓣' },
  '36kr': { src: '/publish-icons/36kr.ico', alt: '36氪' },
  huxiu: { src: '/publish-icons/huxiu.png', alt: '虎嗅网' },
  tmtmedia: { src: '/publish-icons/tmtmedia.ico', alt: '钛媒体' },
  acfun: { src: '/publish-icons/acfun.ico', alt: 'AcFun' },
  lofter: { src: '/publish-icons/lofter.ico', alt: 'LOFTER' },
  zhihu_daily: { src: '/publish-icons/zhihu_daily.png', alt: '知乎日报' },
  people: { src: '/publish-icons/people.ico', alt: '人民网' },
  china_news: { src: '/publish-icons/china_news.ico', alt: '中国新闻网' },
  hupu: { src: '/publish-icons/hupu.png', alt: '虎扑社区' },
}

export interface PlatformIconProps {
  /** platform id(如 'wechat'、'zhihu') */
  platform: string
  /** 平台显示名(兜底首字符用) */
  platformName?: string
  /** 容器像素尺寸,默认 28(与卡片头部 h-7 w-7 对齐) */
  size?: number
  className?: string
}

/**
 * 平台图标组件。
 *
 * 有 PNG 图标:渲染 PNG(单色剪影,深色背景下可见,带 bg-primary/10 圆角容器)
 * 无 PNG 图标:回落到 platformName 首字符(原有占位逻辑,行为不变)
 */
export function PlatformIcon({ platform, platformName, size = 28, className }: PlatformIconProps) {
  const [imgFailed, setImgFailed] = React.useState(false)
  const icon = PNG_ICONS[platform]
  const showImg = icon && !imgFailed

  if (showImg) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded bg-primary/10',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* 图标加载失败时回落首字符,避免出现空框 */}
        {/* eslint-disable-next-line @next/next/no-img-element -- 平台图标 URL 来自运行时配置,组件需支持 onError 回退 */}
        <img
          src={icon.src}
          alt=""
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          className={cn('object-contain', icon.invertInDark && 'dark:invert')}
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  // 兜底:platformName 首字符(与 accounts 页原有占位逻辑一致)
  const char = (platformName ?? platform ?? '?').charAt(0)
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {char}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
