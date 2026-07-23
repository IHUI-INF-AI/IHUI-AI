const Module = require('module')
const { getDefaultConfig } = require('expo/metro-config')

// =============================================================================
// NativeWind monkey-patch 必要性说明(2026-07-24 审计)
// =============================================================================
//
// 1. 为什么不能移除 NativeWind:
//    - mobile-rn 端 27 个文件 + packages/ui-native 11 个文件深度使用 className
//      prop(<View className="...">),移除 NativeWind 将导致整个 RN 端样式系统崩溃。
//    - NativeWind 是 RN 端 className API 的唯一提供者,monorepo 中无等价替代。
//
// 2. 为什么不能升级到 5.x:
//    - NativeWind 5.0.0-preview.4(2026-07-24 npm 查询)仍为 preview,非 stable。
//    - 5.x 重构了 className 编译管线,preview 期间 API 可能 break,生产风险高。
//    - 等待 5.0.0 stable + 社区验证 1-2 个月后再评估升级。
//
// 3. 何时可移除本 monkey-patch:
//    - NativeWind 5.0 stable 发布后,5.x 原生支持 Tailwind v4,届时可移除本 patch。
//    - 验证步骤:升级 5.x → 移除本 patch → 删除 apps/mobile-rn 本地 tailwindcss@3
//      → monorepo hoisting 自然解析到顶层 v4 → 27+11 文件全链路冒烟测试。
//
// 4. 监控点(每月检查一次):
//    - `npm view nativewind version`(latest tag 是否变为 5.0.0 非 preview)
//    - https://github.com/mattkrick/nativewind/releases stable 标签
//    - 升级前先在独立分支验证 27 + 11 文件 className 全部正常工作。
//
// -----------------------------------------------------------------------------

// NativeWind 4.2.6 不兼容 Tailwind CSS v4(运行时抛 "NativeWind only supports Tailwind CSS v3")。
// monorepo hoisting 把 tailwindcss@4 提升到顶层,NativeWind 的 import "tailwindcss/package.json"
// 解析到 v4。apps/mobile-rn 本地装了 tailwindcss@3.4.19,这里拦截模块解析,
// 让 NativeWind 内部 require tailwindcss 时解析到本地 v3,不影响 web 端的 v4。
const tailwindV3PkgPath = require.resolve('tailwindcss/package.json', {
  paths: [__dirname],
})
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...args) {
  if (
    request === 'tailwindcss/package.json' &&
    parent &&
    parent.filename &&
    parent.filename.includes('nativewind')
  ) {
    return tailwindV3PkgPath
  }
  return originalResolveFilename.call(this, request, parent, ...args)
}

const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
