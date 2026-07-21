'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { IMG_EAGER, MARQUEE_BRANDS, SCHOOL_BRANDS } from './footer-data'

/**
 * 品牌跑马灯 — 复用 SiteFooter 已配置的 logo 图片
 *
 * 数据来源:footer-data.ts 的 MARQUEE_BRANDS(= MODELS + PROMOTIONS) + SCHOOL_BRANDS
 * 确保 SiteFooter + BrandMarquee logo 单一来源,不重复造图。
 * 布局:双行跑马灯
 *   - 第 1 行:MARQUEE_BRANDS(24 张,模型 + 推广平台)
 *   - 第 2 行:SCHOOL_BRANDS(14 张,原未改架构前的完整 15 槽位跑马灯,brand4.svg 已丢失 → 14 张)
 * i18n key 复用 footer.modelItems.* + footer.promos.* + footer.marquee.{kouzi,bbxLogo,zhipu,brand8,ali,baidu,dbsfdx,gork,huawei,jldx,openai,tencent,yuanbaoxiang,yushu}。
 *
 * 2026-07-21 v4(用户反馈 3 点同时修):
 * 1. 跑马灯速度 28s → 12s(改 animations.css @keyframes marquee-scroll duration)
 * 2. 暗色模式下图片背景容器 dark:bg-white(GPT/Claude/Gemini 等深色 logo 在深色 bg-card 上看不清)
 * 3. 图片跟容器四周加呼吸感:square h-12→h-14 / wide h-14 h-16 w-40→w-44 + 图片缩小
 */

// 单行跑马灯 row — 抽出避免两行重复
// namespace: 默认 'footer'(modelItems/promos 在此),school row 显式传 'home.marquee'
// 2026-07-20 v3:school row(SCHOOL_BRANDS)图片是横长方形 logo(高 200px,宽 200~3000px+),
//   原 h-10 × w-24 (40×96) 容器太小图片看不清 → 放大到 h-14 × w-40 (56×160) 横长方形,
//   配 object-contain 让所有比例 logo 完整显示。
//   总宽 = 14×160 + 13×8(gap) = 2344px,视口 1440px 减 sidebar 240px ≈ 可见 7/14。
// main row (MARQUEE_BRANDS) 保持 h-12 × w-12 方形(模型 logo + 推广平台方形图标)。
// 2026-07-21 v4:用户反馈 2 点同时修:
//   1) 暗色模式下图片背景容器需要白色,否则深色 logo(GPT/Claude/Gemini 等)
//      在深色 bg-card 上看不清 → 加 dark:bg-white 让 box 在 dark mode 显白色
//   2) 图片跟容器四周需要"呼吸感间距",原 square h-9/box h-12 仅 1.5px 内边距,
//      视觉上贴边 → square: 容器 h-14 w-14 (56×56) + 图片 h-9 w-9 (36×36) = 10px 内边距
//      wide: 容器 h-16 w-44 (64×176) + 图片 h-10 w-36 (40×144) = 12/16px 内边距
function MarqueeRow({
  brands,
  loopKey,
  containerLabel,
  shape = 'square',
  namespace = 'footer',
}: {
  brands: readonly { nameKey: string; src: string; mono?: boolean }[]
  loopKey: string
  containerLabel: string
  /** 容器形状: square(14×14 方形,适合方形 logo)/ wide(h-16 × w-44 横长方形,适合品牌横长 logo) */
  shape?: 'square' | 'wide'
  namespace?: 'footer' | 'home.marquee'
}) {
  const t = useTranslations(namespace)
  const loop = [...brands, ...brands]
  const box =
    shape === 'wide'
      ? // wide (横长方形): h-16 w-44 (64×176) + dark:bg-white
        // 2026-07-21 v4:加 dark:bg-white + mx-3 (与主行间距统一)
        'mx-3 inline-flex h-16 w-44 shrink-0 items-center justify-center rounded-md border bg-card dark:bg-white transition-colors hover:border-primary/40'
      : // square (方形): h-14 w-14 (56×56) + dark:bg-white
        // 2026-07-21 v4:容器 h-12→h-14(48→56),图片保留 h-9 w-9 (36×36),
        //   上下左右各 10px 内边距,给 logo 明显呼吸感
        'mx-3 inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-card dark:bg-white transition-colors hover:border-primary/40'
  const img = shape === 'wide' ? 'h-10 w-36 object-contain' : 'h-9 w-9 object-contain'
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card px-3 py-3">
      <span className="sr-only">{containerLabel}</span>
      <div className="flex whitespace-nowrap will-change-transform animate-marquee">
        {loop.map((brand, idx) => {
          const label = t(brand.nameKey)
          return (
            <div
              key={`${loopKey}-${brand.nameKey}-${idx}`}
              className={box}
              title={label}
            >
              <img
                src={brand.src}
                alt={label}
                width={shape === 'wide' ? 144 : 36}
                height={shape === 'wide' ? 40 : 36}
                // 2026-07-21 v5:用户反馈"暗色模式下图片背景容器需要加一个白色背景,不然看不清"。
                //   mono=true 的 logo 是白色单色图,必须在任何底色下 invert 成深色才能看清:
                //   - light mode: box=bg-card(浅色)→ 白图 invert 变深色 → 在浅底上可见 ✅
                //   - dark mode:  box=white(用户要求)→ 白图 invert 变深色 → 在白底上可见 ✅
                //   原 `invert dark:invert-0` 在 dark mode 下撤销 invert,白图+白底=同色不可见 ❌
                className={`${img}${brand.mono ? ' invert' : ''}`}
                {...IMG_EAGER}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BrandMarquee() {
  return (
    // 2026-07-20 改:加 min-w-0。
    // 父级 (app/(marketing)/page.tsx line 188) 是 grid-cols-[1fr_auto],
    // 1fr 默认 = minmax(auto, 1fr),auto 解析为轨道内容 min-content。
    // 内层 marquee 是 [...brands, ...brands] 2 份复制 + shrink-0 子项,min-content 极宽(~4000+px),
    // 会把 1fr 轨道撑爆,整个 grid 总宽超过父容器,导致 marquee 容器右侧超出工作展示区右侧。
    // min-w-0 让 section 在 grid item 里能缩到 min-content 以下,
    // 外层 MarqueeRow 的 overflow-hidden 才能真正把 marquee 限在轨道宽度内。
    <section className="w-full min-w-0 space-y-2" aria-label="Brand marquee">
      <header className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>TRUSTED BY 24+ BRANDS · 14 LEGACY</span>
      </header>
      {/* 第一行:原模型 + 推广平台 */}
      <MarqueeRow
        brands={MARQUEE_BRANDS}
        loopKey="brand"
        containerLabel="Brand marquee — main row"
      />
      {/* 第二行:原版 14 槽位品牌(从 home.marquee namespace 取名) — 横长方形容器 */}
      <MarqueeRow
        brands={SCHOOL_BRANDS}
        loopKey="school"
        containerLabel="Brand marquee — legacy row"
        shape="wide"
        namespace="home.marquee"
      />
    </section>
  )
}
