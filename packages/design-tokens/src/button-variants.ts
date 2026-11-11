// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ButtonBaseSize, ButtonBaseVariant } from './component-props.js'

/**
 * 跨端 Button cva 共享配置唯一源(ui-react + ui-native 共用)
 *
 * 立因(跨端 UI 双份维护的直接来源之一):
 * `packages/ui-react/src/components/button.tsx` 与 `packages/ui-native/src/button.tsx`
 * 各自维护一份 cva 变体表 —— 共享档位(default/destructive/outline/ghost + sm/lg)的键名
 * 与 class string 在两处各写一遍。设计规范一变(如主 CTA 色档),就得两处同改;漏改一端
 * 不报错、只在某端渲染成旧样式 —— 正是 AGENTS §4「跨端样式同步铁律」要治的那一型。
 *
 * 用法(各端在自己那次 cva() 调用里 spread 本配置,平台修饰 hover/shadow/rounded **在基座之外追加**;
 * 共享键不得被任何一端整档另写成字面量 —— 那条不变量由 `scripts/tests/shared-button-tier-base.test.mjs`
 * 按 HEAD 面钉住,回潮即红):
 *   cva(base, {
 *     variants: {
 *       variant: { ...SHARED_BUTTON_VARIANT_CLASSES, <各端在基座外的追加 / 各端独占档> },
 *       size: { ...SHARED_BUTTON_SIZE_CLASSES, <各端在基座外的追加 / 各端独占档> },
 *     },
 *     defaultVariants: <各端自己的默认档>,
 *   })
 *
 * 为什么共享的是"配置对象"而非 cva 实例:cva 没有官方的 compose / merge API,各端对共享
 * 档位的平台修饰必须能追加 —— 只能以普通对象为共享单元,由各端展开后各自 build。
 * 追加的形态(而非"覆盖"的形态)才是这张表有意义的前提:整档覆盖会让共享值只约束没覆盖的那一端。
 *
 * 取值基准:主 CTA 档(default)统一为 `bg-cta` + `text-cta-foreground`(AGENTS §4「品牌 CTA /
 * 主按钮色同源」的唯一写法)。cta 与同主题 primary 取值全等、但语义独立 —— primary 在 web 端
 * 兼任墨色(text-primary 使用面极大),不是主按钮底档。此前 ui-native 误用
 * `bg-primary text-primary-foreground`(值全等、语义错位),由 2026-09-29 P0-② 一并修正为
 * `bg-cta text-cta-foreground`。
 */

/** 两端共享的 Button 基础布局原子(各端自行拼接 flex 前缀 / 圆角 / focus 修饰) */
export const SHARED_BUTTON_BASE_CLASS = 'items-center justify-center'

/**
 * 共享 variant 档(4 档)。
 *
 * 取值口径:**每一档放两端共同持有的那组原子**;各端在自己的 cva 调用里先展开本表、
 * 再在基座**之外**追加平台专属原子(hover / shadow 只有 web 有,RN 不存在这两个状态)。
 *
 * 2026-10-10 机主拍板「统一网页端和手机端按钮样式」后,`outline` 与 `ghost` 不再是空串:
 * 此前它们被记成"两端共同集合为空",实际是**用空串遮住一处真分叉** —— RN 无 CSS 继承,
 * 必须显式给底与字色,而 web 靠继承;两端各给各的,账面看"同源"而屏幕上不同形。
 * 现在以 **web 定稿为基准**把底与字色收进基座,且这一收编对 web 是**零观感变化**:
 *  - outline:web 原本就写 `bg-background`,RN 原写 `bg-transparent`(透出父容器)。RN 跟 web。
 *  - ghost:web 原本不写底(继承 = 透明)也不写字色(继承 = foreground),基座显式给出
 *    `bg-transparent text-foreground` 与 web 的继承结果同值;RN 原本就写这一串,逐字未变。
 */
export const SHARED_BUTTON_VARIANT_CLASSES: Record<ButtonBaseVariant, string> = {
  default: 'bg-cta text-cta-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-input bg-background text-foreground',
  ghost: 'bg-transparent text-foreground',
}

/**
 * 共享 size 档(2 档)。取值口径同上。
 * sm 两端同为 h-8 px-3(web 另追加 rounded-sm text-xs);
 * lg 于 2026-10-10 收编为 `h-10 px-8`(以 web 为基准 —— web 的 Button 高度档位定稿就是
 * xs 28 / sm 32 / default 36 / lg 40,RN 此前的 h-12=48 不在这套定稿上)。
 * **两处未随本档统一、如实登记**:① 圆角 —— web 在 lg 追加 `rounded-sm`(4px)而 RN 的基座是
 * `rounded-md`(6px),归"圆角角色档统一批"(守门 150/77 的地盘),不在本票顺手改;
 * ② 字号 —— RN 的文字尺寸由内部 <Text> 控制,size 档只作用在盒上,属平台结构差异。
 */
export const SHARED_BUTTON_SIZE_CLASSES: Record<ButtonBaseSize, string> = {
  sm: 'h-8 px-3',
  lg: 'h-10 px-8',
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
