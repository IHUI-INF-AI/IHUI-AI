// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `@/platform/fs` 的小程序腿 —— **只做转出口**,不实现任何行为。
 *
 * 立因(2026-11-12,构建实证):RN 壳 `apps/mobile-rn/src/{components,screens,hooks}/**`
 * 写 `import … from '@/platform/fs'`。这些壳在小程序编译面里(mini 段 `@` → 本端 src),
 * 而本端此前只有 auth/pay 两个同名文件 ⇒ `build:weapp` 在 resolve 阶段硬失败
 * (实测 `resolve '@/platform/audio' in .../src/components` 直接 ✖ Errors)。
 *
 * 为什么是"转出口"而不是"再写一份":§0.6 单一真相源。每个真正的能力承接体早已存在
 * (`src/rn-compat/*` + expo-* 别名表),这里再写一份就是第二套实现,必然漂移。
 */

export { File, Paths, FileMode, UploadType } from '../rn-compat/native-extras'
export * as FileSystem from '../rn-compat/native-extras'
