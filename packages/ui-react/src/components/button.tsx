// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  ICON_BUTTON_SIZE,
  SHARED_BUTTON_BASE_CLASS,
  SHARED_BUTTON_SIZE_CLASSES,
  SHARED_BUTTON_VARIANT_CLASSES,
} from '@ihui/design-tokens'
import { cn } from '../lib/utils'

// 共享 variant/size 档位唯一源:@ihui/design-tokens 的 button-variants.ts(ui-native 同源)。
// 本端形态 = 共享基座 + web 追加平台修饰(shadow / hover / rounded),**不得整档重写共享键**
// (那会让共享值只约束没重写的那一端,已由 scripts/tests/shared-button-tier-base.test.mjs 按 HEAD 面钉死)。
// 逐档如实说明,免得"改一处两端都跟"读过头:
//   default / destructive —— 基座即两端共同原子,改它两端同步;
//   outline / ghost —— 2026-10-10 机主拍板统一后,底与字色已进基座,本端只追加 shadow / hover;
//   size lg —— 基座给 h-10 px-8,本端只追加 rounded-sm;
//     **仍未跨端绑定的只有圆角**(web lg=rounded-sm 4px,RN 基座=rounded-md 6px)与字号,
//     前者归"圆角角色档统一批"(守门 150/77),不在本票顺手改。
// 故不继承 ButtonBaseProps(限制为共同子集会丢失 web 侧类型支持)。

// 图标尺寸档(2026-09-17 用户指令:全项目图标按钮唯一尺寸 32×32,单一来源 @ihui/design-tokens icon-button.ts)
// icon-xs/icon-sm/icon 三档全部同值,仅保留名称兼容既有调用
const buttonVariants = cva(
  `inline-flex ${SHARED_BUTTON_BASE_CLASS} gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        // 共享档位(唯一源)先展开;下面只在基座之外追加 web 平台修饰
        ...SHARED_BUTTON_VARIANT_CLASSES,
        default: `${SHARED_BUTTON_VARIANT_CLASSES.default} shadow hover:bg-cta/90`,
        destructive: `${SHARED_BUTTON_VARIANT_CLASSES.destructive} shadow-sm hover:bg-destructive/90`,
        outline: `${SHARED_BUTTON_VARIANT_CLASSES.outline} shadow-sm hover:bg-accent hover:text-accent-foreground`,
        ghost: `${SHARED_BUTTON_VARIANT_CLASSES.ghost} hover:bg-accent hover:text-accent-foreground`,
        // web 独占档位
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        link: 'text-primary underline-offset-4 hover:underline',

        primary: 'bg-cta text-cta-foreground shadow-sm hover:bg-cta/90',
        'hero-cta':
          'bg-gradient-to-r from-cta to-cta/70 text-cta-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all px-8 py-3 text-base font-semibold rounded-sm',
        login: 'w-full bg-cta text-cta-foreground hover:bg-cta/90 h-11 rounded-sm font-medium',
        send: 'bg-cta text-cta-foreground hover:bg-cta/90 rounded-sm px-4 py-2',
        'card-action':
          'text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm px-2 py-1',
        'mobile-login':
          'w-full bg-cta text-cta-foreground hover:bg-cta/90 h-12 rounded-sm text-base font-semibold',
        'btn-luxe':
          'bg-gradient-to-r from-vip-gold-start to-vip-gold-end text-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all px-6 py-2.5 rounded-sm font-semibold',
        'agreement-agree':
          'w-full bg-cta text-cta-foreground hover:bg-cta/90 h-12 rounded-sm font-medium',
        'switch-project':
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-sm px-3 py-1.5 text-sm',
      },
      size: {
        // 共享档位(唯一源)先展开;下面只在基座之外追加
        ...SHARED_BUTTON_SIZE_CLASSES,
        sm: `${SHARED_BUTTON_SIZE_CLASSES.sm} rounded-sm text-xs`,
        lg: `${SHARED_BUTTON_SIZE_CLASSES.lg} rounded-sm`,
        // web 独占档位
        xs: 'h-7 rounded-sm px-3 text-xs',
        default: 'h-9 px-4 py-2',
        // 2026-09-21 立档:28px 紧凑图标档(表格行内操作钮 / 密集工具条)。
        // 背景:此前 28px 需求只能靠 className="h-7 w-7" 覆盖既有档位满足 —— 这既违反
        // AGENTS.md §4「禁止 className 覆盖高度」,又因 check-button-height 是全仓扫描,
        // 使全仓存在此类违规时**所有会话都提交不了**(实测 UnifiedTaskDashboard 3 处)。
        // 按 §4「需要新高度先在 size 表立档」立档,禁止继续逐处打补丁。
        'icon-2xs': 'h-7 w-7',
        // 注意:icon-xs/icon-sm/icon 三档当前同值(ICON_BUTTON_SIZE = 'h-8 w-8'),
        // 仅保留名称以兼容既有调用。AGENTS.md §4 曾把它们描述成 h-7/h-8/h-9 三个
        // 不同高度,属文档与实现的漂移,已于同日一并修正(误按文档用 icon-xs 期望
        // 28px 是上述「覆盖补丁」的成因之一)。
        'icon-xs': ICON_BUTTON_SIZE,
        'icon-sm': ICON_BUTTON_SIZE,
        icon: ICON_BUTTON_SIZE,
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * 2026-09-15 根治:自动为裸文本 children 包裹 <span>。
 *
 * 背景:design-tokens/tokens.css 的 icon-text 垂直居中补偿规则
 * `:where(button,...):has(>span) > span { translate: 0 var(--text-vcenter-offset) }`
 * 只能命中直接子 <span> 元素;<Button><Icon/>{text}</Button> 中裸文本节点
 * 永远命中不了规则,导致全项目按钮图标与中文文字轻微不居中(复发 3 次以上)。
 * 在组件层统一包装后,所有 Button 自动获得补偿,开发者无需手写 <span>。
 * 手写原生 <button> 时仍须按 AGENTS.md §4 自行包裹(守门:e2e icon-text-alignment)。
 */
function wrapRawTextChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <span>{child}</span>
    }
    return child
  })
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (process.env.NODE_ENV !== 'production' && 'title' in props) {
      console.warn(
        '[Button] 不要使用 title 属性作为 hover 提示,请改用 <Tooltip content="..."><Button>...</Button></Tooltip> 包裹。详见 AGENTS.md 第 4 节前端 UI 约束 + pre-commit 第 18 项守门。',
      )
    }
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {asChild ? children : wrapRawTextChildren(children)}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
