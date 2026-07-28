// 最小测试配置 — 排查 Metro 卡死根因
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.projectRoot = __dirname

// Windows 无 watchman,禁用避免 240s 超时卡死(Metro 0.81.5 useWatchman 在 resolver 层级)
config.resolver.useWatchman = false

// pnpm isolated linker 兼容
config.resolver.unstable_enableSymlinks = true
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  require('path').resolve(__dirname, '../../node_modules/.pnpm/node_modules'),
]

// watchFolders 只加 packages 共享代码
config.watchFolders = [
  ...(config.watchFolders || []),
  require('path').resolve(__dirname, '../../packages'),
]

// 不启用 NativeWind,不添加自定义 resolveRequest
module.exports = config
