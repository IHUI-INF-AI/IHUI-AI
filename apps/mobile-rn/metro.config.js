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
// 4. 监控点(每月检查一次,已机制化为 scripts/check-nativewind-status.mjs):
//    - `npm view nativewind version`(latest tag 是否变为 5.0.0 非 preview)
//    - https://github.com/mattkrick/nativewind/releases stable 标签
//    - 升级前先在独立分支验证 27 + 11 文件 className 全部正常工作。
//
// 5. 替代方案评估(2026-07-24,已评估 5 种 Metro/pnpm 原生方案均不适用):
//
//    根本性技术原因:版本检查 require("tailwindcss/package.json") 发生在 Node.js
//    加载 metro.config.js 阶段(withNativeWind() 调用 → dist/metro/tailwind/index.js:8
//    读取 package.json.version → 非 v3 则抛 "NativeWind only supports Tailwind CSS v3"),
//    这是 Node 的 require() 解析,发生在 Metro bundler 及其 resolver 配置生效之前。
//    Metro 的 resolver.* 选项只作用于 bundler 阶段的模块解析,无法拦截 config-load
//    阶段的 Node require()。因此 monkey-patch 是唯一能精确拦截 parent.filename 的方案。
//
//    逐项评估:
//    (1) resolver.resolverMainFields — 仅控制 bundler 读取 package.json "main" 字段
//        的优先级,不影响 Node require 在 config-load 阶段的解析。❌ 不适用。
//    (2) resolver.nodeModulesPaths — 仅控制 bundler 的 node_modules 搜索路径优先级,
//        作用域是整个 bundle,无法按请求者(parent)条件化;且不作用于 config-load。❌
//    (3) resolver.extraNodeModules — 将模块名映射到路径,但作用域是整个 bundle 且
//        无法按 parent 条件化(映射 tailwindcss→v3 会影响 bundle 内所有请求者);
//        且不作用于 config-load 阶段的 Node require。❌
//    (4) resolver.disableHierarchicalLookup — 仅关闭 bundler 的目录层级向上查找,
//        不影响 config-load 阶段的 Node require,也无法做版本选择。❌
//    (5) pnpm overrides / npm alias — 唯一能影响 Node require 解析的方案,但:
//        - pnpm overrides 配置在根 package.json(全局),会把整个 monorepo 的
//          tailwindcss 强制锁到 v3,破坏 web 端的 v4。❌ 精度不足。
//        - npm alias 创建新包名(tailwindcss-v3),无法让 nativewind 内部的
//          require("tailwindcss") 自动解析到别名。❌
//        - 修改 overrides 会改变 lockfile + 版本图,违反"禁止修改版本"约束。❌
//
//    结论:5 种方案均无法精确做到"仅 NativeWind 内部 require tailwindcss 时解析到 v3,
//    其他场景仍解析到 v4"。保留 Module._resolveFilename monkey-patch。
//
// 6. 防御深度说明(2026-07-24):
//    当前 .npmrc 配置 node-linker=isolated + shamefully-hoist=false,nativewind 的
//    peerDependency tailwindcss 由 apps/mobile-rn 提供的 v3.4.19 满足,pnpm 隔离链接
//    已使 NativeWind 内部 require("tailwindcss/package.json") 解析到 v3。monkey-patch
//    当前为防御性冗余(同版本重定向,无副作用),一旦未来 pnpm 配置/hoisting/peer 解析
//    变化导致 v4 渗入,monkey-patch 仍能兜底。属 belt-and-suspenders 防御层,非移除项。
//
// -----------------------------------------------------------------------------

// NativeWind 4.2.6 不兼容 Tailwind CSS v4(版本检查在 config-load 阶段抛
// "NativeWind only supports Tailwind CSS v3")。apps/mobile-rn 本地装了
// tailwindcss@3.4.19,这里拦截 Node 的 require 解析,让 NativeWind 内部
// require("tailwindcss/package.json") 解析到本地 v3,不影响 web 端的 v4。
// 详见上方第 5、6 点评估;monkey-patch 保留理由见第 5 点结论。
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
