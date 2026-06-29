# CSS 设计 Token 文档

> 本文档原由 `npm run tokens:docs` 自动生成（该脚本已移除），现已改为手动维护
> 生成时间: 2026-06-19
> 源文件: `src/styles/_global-tokens.scss`

## 目录

1. [全局 token](#1-全局 token)
2. [Element Plus 主题色](#2-Element Plus 主题色)
3. [Element Plus 边框色](#3-Element Plus 边框色)
4. [Element Plus 字体](#4-Element Plus 字体)
5. [Element Plus 输入框](#5-Element Plus 输入框)
6. [Element Plus Tooltip](#6-Element Plus Tooltip)
7. [Element Plus 背景色](#7-Element Plus 背景色)
8. [Element Plus 文本色](#8-Element Plus 文本色)
9. [业务别名色](#9-业务别名色)
10. [Element Plus 填充色](#10-Element Plus 填充色)
11. [语义化抽象层](#11-语义化抽象层)
12. [Element Plus 阴影](#12-Element Plus 阴影)
13. [白色透明度阶梯](#13-白色透明度阶梯)
14. [黑色透明度阶梯](#14-黑色透明度阶梯)
15. [品牌色](#15-品牌色)
16. [VIP 权益色](#16-VIP 权益色)
17. [视频专用色](#17-视频专用色)
18. [微信小程序品牌色](#18-微信小程序品牌色)
19. [排行榜色](#19-排行榜色)
20. [VIP 会员色](#20-VIP 会员色)
21. [支付页品牌色](#21-支付页品牌色)
22. [装饰性渐变](#22-装饰性渐变)
23. [z-index 层级](#23-z-index 层级)

## 1. 全局 token

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--global-font-family` | `var(--font-family-chinese)` | - | 6 | ✓ 使用中 |
| `--global-header-height` | `60px` | 顶部菜单栏高度 | 13 | ✓ 使用中 |
| `--global-box-shadow` | `0 2px 8px var(--color-black-6)` | - | 384 | ✓ 使用中 |

## 2. Element Plus 主题色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-color-primary` | `var(--el-text-color-primary)` | - | 1102 | ✓ 使用中 |
| `--el-color-primary-light-3` | `var(--el-text-color-primary)` | - | 82 | ✓ 使用中 |
| `--el-color-primary-light-5` | `var(--el-text-color-secondary)` | - | 56 | ✓ 使用中 |
| `--el-color-primary-light-7` | `var(--el-text-color-placeholder)` | - | 18 | ✓ 使用中 |

## 3. Element Plus 边框色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-border-color` | `var(--border-unified-color)` | - | 354 | ✓ 使用中 |
| `--el-border-width-primary` | `2px` | - | 173 | ✓ 使用中 |
| `--el-border-radius-base` | `var(--global-border-radius)` | - | 0 | ⚠ 未使用 |
| `--el-border-radius-round` | `var(--global-border-radius)` | - | 0 | ⚠ 未使用 |
| `--el-border-radius-circle` | `var(--global-border-radius)` | - | 0 | ⚠ 未使用 |

## 4. Element Plus 字体

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-font-family` | `var(--font-family-chinese)` | - | 1 | ✓ 使用中 |

## 5. Element Plus 输入框

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-input-border-radius` | `var(--global-border-radius)` | - | 13 | ✓ 使用中 |
| `--el-input-focus-border-color` | `var(--border-unified-color-hover)` | - | 0 | ⚠ 未使用 |
| `--el-input-hover-border-color` | `var(--border-unified-color-hover)` | - | 0 | ⚠ 未使用 |

## 6. Element Plus Tooltip

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-tooltip-bg-color` | `var(--el-bg-color)` | - | 0 | ⚠ 未使用 |
| `--el-tooltip-border-color` | `var(--border-unified-color)` | - | 0 | ⚠ 未使用 |
| `--el-tooltip-font-color` | `var(--el-text-color-primary)` | - | 0 | ⚠ 未使用 |

## 7. Element Plus 背景色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-bg-color` | `var(--color-neutral-f7f8fa)` | 容器浅灰 | 1353 | ✓ 使用中 |
| `--el-bg-color-page` | `var(--el-bg-color)` | 页面主背景 | 464 | ✓ 使用中 |
| `--el-bg-color-hover` | `var(--el-bg-color)` | hover背景 | 54 | ✓ 使用中 |

## 8. Element Plus 文本色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-text-color-primary` | `#000` | - | 2168 | ✓ 使用中 |
| `--el-text-color-regular` | `var(--el-text-color-primary)` | - | 395 | ✓ 使用中 |
| `--el-text-color-secondary` | `var(--el-text-color-primary)` | - | 974 | ✓ 使用中 |

## 9. 业务别名色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-gray-fafafa` | `#fafafa` | - | 21 | ✓ 使用中 |
| `--color-blue-1890ff` | `#1890ff` | - | 19 | ✓ 使用中 |
| `--color-green-52c41a` | `#52c41a` | - | 1 | ✓ 使用中 |
| `--color-red-f5222d` | `#f5222d` | - | 2 | ✓ 使用中 |
| `--color-orange-fa8c16` | `#fa8c16` | - | 3 | ✓ 使用中 |
| `--color-purple-722ed1` | `#722ed1` | - | 1 | ✓ 使用中 |
| `--color-blue-1890ff-04` | `rgba(24, 144, 255, 0.04)` | - | 1 | ✓ 使用中 |
| `--color-gray-light` | `#f0f0f0` | - | 34 | ✓ 使用中 |
| `--color-gray-222` | `#222` | - | 12 | ✓ 使用中 |
| `--color-gray-333` | `#333` | - | 55 | ✓ 使用中 |
| `--color-gray-555555` | `#555` | - | 3 | ✓ 使用中 |
| `--color-indigo-600` | `#4f46e5` | - | 3 | ✓ 使用中 |
| `--color-cyan-06b6d4` | `#06b6d4` | - | 2 | ✓ 使用中 |
| `--color-emerald-500` | `#10b981` | - | 15 | ✓ 使用中 |
| `--color-amber-500` | `#f59e0b` | - | 8 | ✓ 使用中 |
| `--color-red-ef4444` | `#ef4444` | - | 7 | ✓ 使用中 |

## 10. Element Plus 填充色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-fill-color-lighter` | `#f5f5f5` | - | 165 | ✓ 使用中 |
| `--el-fill-color-light` | `#f0f0f0` | - | 439 | ✓ 使用中 |

## 11. 语义化抽象层

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--app-surface-1` | `var(--el-bg-color-page)` | - | 6 | ✓ 使用中 |
| `--app-surface-2` | `var(--el-bg-color)` | - | 7 | ✓ 使用中 |
| `--app-overlay` | `var(--el-bg-color)` | - | 0 | ⚠ 未使用 |
| `--app-text-primary` | `var(--el-text-color-primary)` | - | 9 | ✓ 使用中 |
| `--app-text-secondary` | `var(--el-text-color-regular)` | - | 1 | ✓ 使用中 |
| `--app-text-muted` | `var(--el-text-color-secondary)` | - | 0 | ⚠ 未使用 |
| `--app-divider` | `var(--el-border-color)` | - | 4 | ✓ 使用中 |

## 12. Element Plus 阴影

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--el-box-shadow` | `var(--global-box-shadow)` | - | 2 | ✓ 使用中 |
| `--el-box-shadow-light` | `var(--global-box-shadow)` | - | 4 | ✓ 使用中 |
| `--el-box-shadow-dark` | `var(--global-box-shadow)` | - | 2 | ✓ 使用中 |

## 13. 白色透明度阶梯

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-white-2` | `rgba(255, 255, 255, 0.02)` | - | 20 | ✓ 使用中 |
| `--color-white-3` | `rgba(255, 255, 255, 0.03)` | - | 28 | ✓ 使用中 |
| `--color-white-4` | `rgba(255, 255, 255, 0.04)` | - | 29 | ✓ 使用中 |
| `--color-white-5` | `rgba(255, 255, 255, 0.05)` | - | 58 | ✓ 使用中 |
| `--color-white-6` | `rgba(255, 255, 255, 0.06)` | - | 28 | ✓ 使用中 |
| `--color-white-8` | `rgba(255, 255, 255, 0.08)` | - | 45 | ✓ 使用中 |
| `--color-white-10` | `rgba(255, 255, 255, 0.1)` | - | 49 | ✓ 使用中 |
| `--color-white-12` | `rgba(255, 255, 255, 0.12)` | - | 13 | ✓ 使用中 |
| `--color-white-14` | `rgba(255, 255, 255, 0.14)` | - | 6 | ✓ 使用中 |
| `--color-white-15` | `rgba(255, 255, 255, 0.15)` | - | 28 | ✓ 使用中 |
| `--color-white-18` | `rgba(255, 255, 255, 0.18)` | - | 9 | ✓ 使用中 |
| `--color-white-20` | `rgba(255, 255, 255, 0.2)` | - | 25 | ✓ 使用中 |
| `--color-white-30` | `rgba(255, 255, 255, 0.3)` | - | 16 | ✓ 使用中 |
| `--color-white-35` | `rgba(255, 255, 255, 0.35)` | - | 2 | ✓ 使用中 |
| `--color-white-40` | `rgba(255, 255, 255, 0.4)` | - | 6 | ✓ 使用中 |
| `--color-white-45` | `rgba(255, 255, 255, 0.45)` | - | 6 | ✓ 使用中 |
| `--color-white-50` | `rgba(255, 255, 255, 0.5)` | - | 25 | ✓ 使用中 |
| `--color-white-60` | `rgba(255, 255, 255, 0.6)` | - | 12 | ✓ 使用中 |
| `--color-white-70` | `rgba(255, 255, 255, 0.7)` | - | 20 | ✓ 使用中 |
| `--color-white-72` | `rgba(255, 255, 255, 0.72)` | - | 2 | ✓ 使用中 |
| `--color-white-75` | `rgba(255, 255, 255, 0.75)` | - | 6 | ✓ 使用中 |
| `--color-white-80` | `rgba(255, 255, 255, 0.8)` | - | 17 | ✓ 使用中 |
| `--color-white-85` | `rgba(255, 255, 255, 0.85)` | - | 7 | ✓ 使用中 |
| `--color-white-90` | `rgba(255, 255, 255, 0.9)` | - | 25 | ✓ 使用中 |
| `--color-white-95` | `rgba(255, 255, 255, 0.95)` | - | 11 | ✓ 使用中 |
| `--color-white-98` | `rgba(255, 255, 255, 0.98)` | - | 8 | ✓ 使用中 |

## 14. 黑色透明度阶梯

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-black-2` | `rgba(0, 0, 0, 0.02)` | - | 14 | ✓ 使用中 |
| `--color-black-3` | `rgba(0, 0, 0, 0.03)` | - | 12 | ✓ 使用中 |
| `--color-black-04` | `rgba(0, 0, 0, 0.04)` | - | 22 | ✓ 使用中 |
| `--color-black-4` | `rgba(0, 0, 0, 0.04)` | - | 5 | ✓ 使用中 |
| `--color-black-5` | `rgba(0, 0, 0, 0.05)` | - | 22 | ✓ 使用中 |
| `--color-black-6` | `rgba(0, 0, 0, 0.06)` | - | 38 | ✓ 使用中 |
| `--color-black-8` | `rgba(0, 0, 0, 0.08)` | - | 25 | ✓ 使用中 |
| `--color-black-10` | `rgba(0, 0, 0, 0.1)` | - | 43 | ✓ 使用中 |
| `--color-black-12` | `rgba(0, 0, 0, 0.12)` | - | 8 | ✓ 使用中 |
| `--color-black-15` | `rgba(0, 0, 0, 0.15)` | - | 23 | ✓ 使用中 |
| `--color-black-20` | `rgba(0, 0, 0, 0.2)` | - | 23 | ✓ 使用中 |
| `--color-black-25` | `rgba(0, 0, 0, 0.25)` | - | 11 | ✓ 使用中 |
| `--color-black-30` | `rgba(0, 0, 0, 0.3)` | - | 40 | ✓ 使用中 |
| `--color-black-40` | `rgba(0, 0, 0, 0.4)` | - | 16 | ✓ 使用中 |
| `--color-black-45` | `rgba(0, 0, 0, 0.45)` | - | 6 | ✓ 使用中 |
| `--color-black-50` | `rgba(0, 0, 0, 0.5)` | - | 33 | ✓ 使用中 |
| `--color-black-60` | `rgba(0, 0, 0, 0.6)` | - | 19 | ✓ 使用中 |
| `--color-black-70` | `rgba(0, 0, 0, 0.7)` | - | 9 | ✓ 使用中 |
| `--color-black-75` | `rgba(0, 0, 0, 0.75)` | - | 4 | ✓ 使用中 |
| `--color-black-80` | `rgba(0, 0, 0, 0.8)` | - | 16 | ✓ 使用中 |
| `--color-black-85` | `rgba(0, 0, 0, 0.85)` | - | 4 | ✓ 使用中 |
| `--color-black-87` | `rgba(0, 0, 0, 0.87)` | - | 6 | ✓ 使用中 |
| `--color-black-90` | `rgba(0, 0, 0, 0.9)` | - | 8 | ✓ 使用中 |
| `--color-black-95` | `rgba(0, 0, 0, 0.95)` | - | 4 | ✓ 使用中 |

## 15. 品牌色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-brand-blue` | `#1677ff` | - | 5 | ✓ 使用中 |
| `--color-brand-blue-06` | `rgba(22, 119, 255, 0.06)` | - | 1 | ✓ 使用中 |

## 16. VIP 权益色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-rgba-255--79--79-0-6-` | `rgba(255, 79, 79, 0.6)` | - | 1 | ✓ 使用中 |
| `--color-rgba-255--79--79-0-7-` | `rgba(255, 79, 79, 0.7)` | - | 1 | ✓ 使用中 |
| `--color-rgba-255--79--79-0-8-` | `rgba(255, 79, 79, 0.8)` | - | 1 | ✓ 使用中 |
| `--color-rgba-255--79--79-0-9-` | `rgba(255, 79, 79, 0.9)` | - | 1 | ✓ 使用中 |
| `--color-rgba-255--79--79-1-` | `rgba(255, 79, 79, 1)` | - | 1 | ✓ 使用中 |

## 17. 视频专用色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-video-bg` | `#000` | - | 5 | ✓ 使用中 |

## 18. 微信小程序品牌色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-miniapp-green` | `linear-gradient(135deg, #07c160, #06ad56)` | - | 2 | ✓ 使用中 |
| `--color-miniapp-green-dark` | `#06ad56` | - | 4 | ✓ 使用中 |
| `--color-miniapp-green-darker` | `#059a4c` | - | 4 | ✓ 使用中 |
| `--color-miniapp-green-darkest` | `#048040` | - | 2 | ✓ 使用中 |

## 19. 排行榜色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-rank-gold` | `#f59e0b` | - | 5 | ✓ 使用中 |
| `--color-rank-silver` | `#94a3b8` | - | 2 | ✓ 使用中 |
| `--color-rank-bronze` | `#b45309` | - | 2 | ✓ 使用中 |
| `--color-rank-avatar-start` | `#6366f1` | - | 4 | ✓ 使用中 |
| `--color-rank-avatar-end` | `#8b5cf6` | - | 4 | ✓ 使用中 |
| `--color-rank-top1-bg` | `rgba(245, 158, 11, 0.04)` | - | 2 | ✓ 使用中 |

## 20. VIP 会员色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-vip-gold-start` | `#ffd700` | - | 1 | ✓ 使用中 |
| `--color-vip-gold-end` | `#ffa500` | - | 1 | ✓ 使用中 |

## 21. 支付页品牌色

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-payment-purple-start` | `#667eea` | - | 1 | ✓ 使用中 |
| `--color-payment-purple-end` | `#764ba2` | - | 1 | ✓ 使用中 |

## 22. 装饰性渐变

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--color-gradient-purple-yellow` | `linear-gradient(112deg, rgba(205, 208, 255, 0.7) 0%, rgba...` | - | 3 | ✓ 使用中 |
| `--color-gradient-purple-deep` | `linear-gradient(269deg, rgba(217, 219, 254, 0.8) 219%, rg...` | - | 1 | ✓ 使用中 |
| `--color-gradient-white-blue` | `linear-gradient(0deg, rgba(255, 255, 255, 1) 1%, rgba(77,...` | - | 1 | ✓ 使用中 |
| `--color-gradient-card-left` | `linear-gradient(116deg, rgba(217, 219, 255, 0.8) 3%, rgba...` | - | 1 | ✓ 使用中 |
| `--color-gradient-card-right` | `linear-gradient(116deg, rgba(0, 0, 0, 0.8) 3%, rgba(0, 10...` | - | 1 | ✓ 使用中 |
| `--color-gradient-group` | `linear-gradient(106deg, rgba(228, 229, 255, 0.25) 4%, rgb...` | - | 1 | ✓ 使用中 |

## 23. z-index 层级

| 名称 | 值 | 描述 | 使用次数 | 状态 |
| --- | --- | --- | --- | --- |
| `--z-base` | `1` | 基础内容层 | 268 | ✓ 使用中 |
| `--z-header` | `100` | 头部导航栏 | 33 | ✓ 使用中 |
| `--z-sticky` | `990` | 粘性定位元素 | 9 | ✓ 使用中 |
| `--z-dropdown` | `1000` | 下拉菜单 | 39 | ✓ 使用中 |
| `--z-overlay` | `1000` | 遮罩层 | 2 | ✓ 使用中 |
| `--z-modal` | `2000` | 弹窗/对话框 | 20 | ✓ 使用中 |
| `--z-popover` | `2001` | 弹出层（高于 modal） | 7 | ✓ 使用中 |
| `--z-notification` | `9999` | 通知/提示 | 21 | ✓ 使用中 |
| `--z-loading` | `10000` | 全屏加载 | 13 | ✓ 使用中 |
| `--z-max` | `10003` | 最大层级（全屏覆盖） | 19 | ✓ 使用中 |

## 汇总统计

- 已定义 token: **141**
- 已使用 token: **131**
- 未使用 token: **10**
- 总使用次数: **19995**
