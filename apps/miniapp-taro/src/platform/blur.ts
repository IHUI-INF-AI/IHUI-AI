// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `@/platform/blur` 的小程序腿。
 *
 * 立因(2026-11-12,构建实证):RN 壳 `apps/mobile-rn/src/components/TabBar.tsx` 与五个
 * `screens/*Screen.tsx` 都写 `import { BlurView } from '@/platform/blur'`。这些壳在小程序
 * 编译面里(mini 段把 `@` 指到本端 src、`@rn-shells` 指到 RN 壳目录),而本端此前**没有**
 * 这个文件 ⇒ `build:weapp` 在 resolve 阶段硬失败:
 *   resolve '@/platform/blur' in 'apps/mobile-rn/src/components' → 全扩展名均不存在
 * 受影响页面是已注册的 `pkg-mirror2/home/index`(以及任何引用 TabBar 的镜像页)。
 *
 * 为什么不各自在壳里判端:§3 共享层优先 + §0.6 单一真相源 —— 平台差异只该在一处收口。
 * 为什么不新写一份模糊实现:本端早就有 `src/rn-compat/expo-blur.tsx` 承接 expo-blur,
 * 这里只做**转出口**,视觉降级策略仍由那一份决定(它是全端唯一实现)。
 */
export { BlurView, BlurTargetView } from '../rn-compat/expo-blur'
export type { BlurViewProps, BlurTargetViewProps } from '../rn-compat/expo-blur'
