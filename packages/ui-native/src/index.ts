// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// `className` 的增强来自 `nativewind/types`(本包 `src/nativewind-env.d.ts` 引的就是它),
// 而那份 env 是个**没人 import 的旁挂 .d.ts**:包内 `tsc --noEmit`(include 覆盖 src/**)
// 能扫到它,但作为依赖被别的包消费时(如 apps/web 经 @ihui/app 拉进本包的 .tsx)它不进
// 程序 ⇒ className 全灭(CI `Build web (production)` 51 条 TS2322/TS2769/TS2339 即此型)。
// 入口直接引类型包 = 同一份增强、且与 env 文件是否进程序无关。
// 2026-11-01 部署实测:`/// <reference types="nativewind/types" />` 在 Next build 消费面
// **不生效**(clean 检出到 88d43f8c1d 仍报 vip-badge.tsx TS2769);side-effect import 才会
// 随 index.ts 的 import 链进入消费方类型图(本地 apps/web `tsc --noEmit` 0 错误)。
// 本包自述由本包负责:删掉本行 = 让每个消费方自己记得挂增强,必然再漂移。
// ⚠️ 但这一行**不能是 import**:盘上 `node_modules/nativewind/` 里该子路径只有
// `types.d.ts`(无 `types.js`、无 `types/` 目录、包内也没有 exports 映射)⇒ TypeScript
// 按 .d.ts 解析得到,而 webpack/Metro 按 JS 产物解析必然落空。上一版写成 side-effect
// import 后类型检查过了、`next build` 改报 module-not-found(导入链正是本入口 +
// apps/web 的 react-native-web 试点页),等于把类型问题换成了打包问题;
// `import type {}` 也不行(TS2306:那份 types.d.ts 不是模块)。
// 三斜杠 reference 是**注释指令**:类型图照样加载增强,打包器根本看不见它。
// 消费方若要自己的确定性,照 apps/web/nativewind-env.d.ts 在各自类型程序里挂一份。
/// <reference types="nativewind/types" />

// 按压反馈唯一口:pressed 态**必须**由组件内部持有 —— cssInterop 会把注册表组件(含 Pressable)的
// 函数形态 style 换成 `{}`(守门 131 真机定案),所以 `style={fn}` 这一路连原样式一起丢。
// 旧出口 pressFeedback 已整仓撤除并删除:它返回函数,属那一型;不要加回来。
export { Tappable } from './tappable'

export { Button, buttonVariants, type ButtonProps } from './button'
export { Input, type InputProps } from './input'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
  type CardTitleProps,
  type CardDescriptionProps,
} from './card'
export { Loading, type LoadingProps } from './loading'
export { VipBadge } from './vip-badge'
export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type DialogProps,
  type DialogHeaderProps,
  type DialogTitleProps,
} from './dialog'
export { Avatar, type AvatarProps } from './avatar'
export { Badge, badgeVariants, type BadgeProps } from './badge'
export { Tabs, type TabsProps, type TabItem } from './tabs'
export { Switch, type SwitchProps } from './switch'
export { Tooltip, type TooltipProps } from './tooltip'
export { Sheet, type SheetProps } from './sheet'
export { Collapsible, type CollapsibleProps } from './collapsible'

// 跨端同名组件共享 props 类型(mobile-rn + miniapp-taro 14 对组件去重)
export * from './business/types'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
