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
 * 图标来源:apps/web/public/footer/tuiguangpingtai/*(png/svg/ico)
 *  - png:原有单色剪影(facebook/github/google 等推广位资源)
 *  - svg:Iconify(logos/fa-brands/simple-icons/thesvg)与博客园官方 favicon
 *  - ico:官网 favicon(无现成矢量资源的平台)
 * 兜底:platformName 首字符(当前 38 平台已全覆盖,兜底保留以防新增平台未配图标)
 */

interface PngPlatformIcon {
  readonly src: string
  readonly alt: string
  /** 黑色系图标:深色模式下反色为白,避免不可见 */
  readonly invertInDark?: boolean
}

/** platformId → 图标文件(相对 /public 的路径,与 PLATFORM_SCHEMAS 38 平台一一对应) */
const PNG_ICONS: Record<string, PngPlatformIcon> = {
  // 国际平台
  wordpress: { src: '/footer/tuiguangpingtai/wordpress.svg', alt: 'WordPress' },
  medium: { src: '/footer/tuiguangpingtai/medium.svg', alt: 'Medium', invertInDark: true },
  youtube: { src: '/footer/tuiguangpingtai/youtube.svg', alt: 'YouTube' },
  // 视频平台
  bilibili: { src: '/footer/tuiguangpingtai/bilibili.svg', alt: '哔哩哔哩' },
  douyin: { src: '/footer/tuiguangpingtai/douyin.svg', alt: '抖音', invertInDark: true },
  kuaishou: { src: '/footer/tuiguangpingtai/kuaishou.svg', alt: '快手' },
  xigua: { src: '/footer/tuiguangpingtai/xigua.svg', alt: '西瓜视频' },
  haokan: { src: '/footer/tuiguangpingtai/baidu.svg', alt: '好看视频' },
  shipinhao: { src: '/footer/tuiguangpingtai/shipinhao.svg', alt: '微信视频号' },
  // 图文社交
  wechat: { src: '/footer/tuiguangpingtai/wechat.svg', alt: '微信公众号' },
  toutiao: { src: '/footer/tuiguangpingtai/toutiao.svg', alt: '今日头条' },
  weibo: { src: '/footer/tuiguangpingtai/weibo.svg', alt: '微博' },
  xiaohongshu: { src: '/footer/tuiguangpingtai/xiaohongshu.svg', alt: '小红书' },
  // 技术社区
  zhihu: { src: '/footer/tuiguangpingtai/zhihu.svg', alt: '知乎' },
  csdn: { src: '/footer/tuiguangpingtai/csdn.svg', alt: 'CSDN' },
  juejin: { src: '/footer/tuiguangpingtai/juejin.svg', alt: '掘金' },
  cnblogs: { src: '/footer/tuiguangpingtai/cnblogs.svg', alt: '博客园' },
  segmentfault: { src: '/footer/tuiguangpingtai/segmentfault.ico', alt: '思否' },
  oschina: { src: '/footer/tuiguangpingtai/oschina.ico', alt: '开源中国' },
  jianshu: { src: '/footer/tuiguangpingtai/jianshu.ico', alt: '简书' },
  // 六大号
  baijiahao: { src: '/footer/tuiguangpingtai/baidu.svg', alt: '百家号' },
  qq: { src: '/footer/tuiguangpingtai/qq.svg', alt: '企鹅号' },
  dayihao: { src: '/footer/tuiguangpingtai/dayihao.svg', alt: '大鱼号' },
  netease: { src: '/footer/tuiguangpingtai/netease.svg', alt: '网易号' },
  sohu: { src: '/footer/tuiguangpingtai/sohu.svg', alt: '搜狐号' },
  sina: { src: '/footer/tuiguangpingtai/sina.svg', alt: '新浪看点' },
  // SEO/GEO 第二批
  baidu_zhidao: { src: '/footer/tuiguangpingtai/baidu.svg', alt: '百度知道' },
  baidu_tieba: { src: '/footer/tuiguangpingtai/baidu.svg', alt: '百度贴吧' },
  douban: { src: '/footer/tuiguangpingtai/douban.svg', alt: '豆瓣' },
  '36kr': { src: '/footer/tuiguangpingtai/36kr.ico', alt: '36氪' },
  huxiu: { src: '/footer/tuiguangpingtai/huxiu.png', alt: '虎嗅网' },
  tmtmedia: { src: '/footer/tuiguangpingtai/tmtmedia.ico', alt: '钛媒体' },
  acfun: { src: '/footer/tuiguangpingtai/acfun.ico', alt: 'AcFun' },
  lofter: { src: '/footer/tuiguangpingtai/lofter.svg', alt: 'LOFTER' },
  zhihu_daily: { src: '/footer/tuiguangpingtai/zhihu_daily.svg', alt: '知乎日报' },
  people: { src: '/footer/tuiguangpingtai/people.ico', alt: '人民网' },
  china_news: { src: '/footer/tuiguangpingtai/china_news.ico', alt: '中国新闻网' },
  hupu: { src: '/footer/tuiguangpingtai/hupu.png', alt: '虎扑社区' },
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
