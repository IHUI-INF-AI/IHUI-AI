require('./polyfills')
// 2026-07-29 修复:RN 0.79 在 Metro bundle 中可能不自动执行 InitializeCore,
// 但原生代码在 bundle 加载后立即调用 HMRClient.setup() / AppRegistry.runApplication()。
// 必须显式 require InitializeCore.js,它会:
//   1. 调用 setUpBatchedBridge → 初始化 BatchedBridge(注册 callable module 的前提)
//   2. require AppRegistry → 让原生能调用 runApplication
//   3. 在 __DEV__ 下安装 LogBox / DeveloperTools / checkNativeVersion
// 顺序:polyfills → InitializeCore → 注册 HMRClient → 加载 App.tsx。
require('react-native/Libraries/Core/InitializeCore')

// 现在 BatchedBridge 已就绪,可以注册 callable module。
// registerCallableModule 在 bridge 模式下走 BatchedBridge.registerLazyCallableModule。
try {
  const registerCallableModule =
    require('react-native/Libraries/Core/registerCallableModule').default
  registerCallableModule(
    'HMRClient',
    () => require('react-native/Libraries/Utilities/HMRClient').default,
  )
} catch {
  // 即使失败也让应用继续跑(可能只是 __DEV__ 关闭时不需要 HMR)
}

// 2026-07-29 恢复完整业务逻辑:加载 App.tsx(包含 5 层 Provider + NavigationContainer +
// RootNavigator + OfflineBanner)。App.tsx 顶层第 62 行已调用
// AppRegistry.registerComponent('main', () => App),所以这里只需 require('./App')
// 触发其副作用,不需要再调用 registerRootComponent(否则会重复注册覆盖)。
module.exports = require('./App')
