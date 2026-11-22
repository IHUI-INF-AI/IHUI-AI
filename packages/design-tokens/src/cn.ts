// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * 自定义字号档必须在这里注册,否则 tailwind-merge 会把它们误归进"文字颜色"组 ——
 * 2026-11-11 实证:裸 twMerge 下 `cn('text-label font-medium text-foreground/80')` 里
 * `text-label` 与 `text-foreground/80` 被判同组冲突、后者胜出,`text-label` 被**静默吃掉**,
 * 提示词模板 chips 的字号从上线起就没生效过(真机 DOM 里没有 text-label)。
 * 名单与 tokens.css `@theme` 的 `--text-*` 逐一对应(15 档),新增字号档必须同步进这张表
 * (2026-11-13 补入 title-lg / heading-sm / headline / display-xl 四档)。
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // 条目是**完整类名**(tailwind-merge v3 语义),不是 `text-` 后的值 —— 裸值注册等于没注册。
      'font-size': [
        'text-badge',
        'text-caption',
        'text-label',
        'text-body-sm',
        'text-body',
        'text-strong',
        'text-title',
        'text-title-lg',
        'text-subtitle',
        'text-heading-sm',
        'text-heading',
        'text-headline',
        'text-display',
        'text-display-xl',
        'text-display-lg',
      ],
      /**
       * 具名 z-index 工具类必须注册(2026-11-15 实证):`z-popover`/`z-modal` 不在
       * tailwind-merge 的 z-index 判据里,`cn('... z-popover', 'z-[2300]')` 会两个都保留,
       * 最终由 globals.css `@layer utilities` 的源码顺序裁定(z-popover 胜) —— 于是所有
       * 「给嵌套 Tooltip/Dialog 追加更高层级」的 className 覆盖全部静默失效(真机实测
       * Tooltip 计算值仍是 2001)。名单与 globals.css 的 .z-* 定义逐一对应,新增必须同步。
       * 组键必须是 `z`(tailwind-merge 默认组的真名,`z-index` 只是文档叫法)。
       */
      z: [
        'z-base',
        'z-header',
        'z-sticky',
        'z-dropdown',
        'z-overlay',
        'z-modal',
        'z-popover',
        'z-notification',
        'z-loading',
        'z-max',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
