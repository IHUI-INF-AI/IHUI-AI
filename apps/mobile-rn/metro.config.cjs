// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// 显式设置 projectRoot,避免 expo export:embed 时被覆盖为 monorepo 根
config.projectRoot = __dirname
// 2026-08-15 修复 "Unable to resolve module ./index from G:\IHUI-AI/.":
// @expo/metro-config ExpoMetroConfig.js:306 会把 server.unstable_serverRoot
// 设为 monorepo workspace 根(源码注释原话 "Moves the server root down to the
// monorepo root",为 expo web 支持)。Metro 0.84 Server._getServerRootDir() 优先
// 读 unstable_serverRoot 而非 projectRoot,导致相对入口 /index.bundle → ./index
// 被解析成 G:\IHUI-AI\index(不存在)→ bundle 404。本项目为纯 native RN(无
// expo web),覆盖回 apps/mobile-rn 与 projectRoot 一致,相对入口恢复可解析。
config.server.unstable_serverRoot = __dirname
// 2026-08-15 修复 app 二进制固化的带前缀 bundle URL 404:
// 现存模拟器/真机 app 构建时 serverRoot 为 monorepo 根,bundle URL 固化为
// /apps/mobile-rn/App.bundle。serverRoot 改为 apps/mobile-rn 后该 URL 会被
// 双重拼接为 apps/mobile-rn/apps/mobile-rn/App → 404 红屏
// (logcat 实证:UnableToResolveError ./apps/mobile-rn/App)。这里剥掉历史
// 前缀,让新旧两种 URL(/apps/mobile-rn/App.bundle 与 /App.bundle、
// /index.bundle)在 serverRoot=apps/mobile-rn 下都正确解析。
const originalRewriteRequestUrl = config.server.rewriteRequestUrl
config.server.rewriteRequestUrl = (url) => {
  const rewritten = originalRewriteRequestUrl ? originalRewriteRequestUrl(url) : url
  return rewritten.replace(/^\/apps\/mobile-rn\//, '/')
}
// resolver.worker = undefined 必要时设置

// pnpm isolated linker 兼容(2026-07-25 修复 Metro bundle 失败)
// 问题:pnpm node-linker=isolated 下,react-native 等包是 junction 指向
// .pnpm/<pkg>/node_modules/<pkg>,其传递依赖(ansi-regex, invariant 等)只在
// .pnpm/<pkg>/node_modules/ 隔离目录下。Metro 默认不 follow junction realpath,
// hierarchical lookup 从 apps/mobile-rn/node_modules/react-native/.. 查找,找不到。
// 修复:自定义 resolveRequest,Metro 默认解析失败时,fallback 到 Node 原生
// require.resolve(基于 originModulePath 的 realpath),Node 能正确处理 pnpm junction。
config.resolver.unstable_enablePackageExports = false
config.resolver.unstable_enableSymlinks = true
// 2026-09-22 修复 Metro 冷启动 bundle 500 "Failed to get the SHA-1 for D:\nm\.pnpm\...":
// node_modules 是 junction → D:\nm(pnpm 隔离存储),依赖真实路径在 watchFolders 之外。
// @expo/metro-file-map fork 的 on-demand filesystem 可对 roots 外文件按需加载;
// 但 scopeFallback 的 isDirectoryIn(metro-file-map包目录, serverRoot) 检查在本机
// junction 结构下恒为 false(metro-file-map 也在 D:\nm),fallback 会被 scope 拦掉,
// 必须显式 UNSTABLE_ALLOW_ALL 才能对 D:\nm 下文件按需计算 SHA-1。
config.resolver.unstable_onDemandFilesystem = 'UNSTABLE_ALLOW_ALL'
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  require('path').resolve(__dirname, '../../node_modules/.pnpm/node_modules'),
]

config.resolver.blockList = [
  /.*\/ai-service\/.*/,
  /.*\/\.venv\/.*/,
]

// pnpm isolated linker 兼容:watchFolders 添加 mobile-rn 必需的目录
// 不直接 watch 整个 monorepo 根(G:\IHUI-AI),否则会扫描 apps/web/test-results 等
// 不存在的子目录(FallbackWatcher 报 ENOENT),只 watch packages/ 共享代码目录。
// .pnpm 虚拟存储通过 nodeModulesPaths + unstable_enableSymlinks 已可访问,无需 watch。
//
// 2026-08-15 修复 "Unable to resolve module ./index from G:\IHUI-AI/.":
// Metro 0.84 Server._resolveRelativePath 用 watchFolders[0](或 process.cwd())
// 作为相对 entry 路径的解析基准(/index.bundle → ./index)。expo/metro-config 的
// getDefaultConfig 在 monorepo 中会自动把 workspace 根(G:\IHUI-AI)放进
// watchFolders[0],若用 ...(config.watchFolders || []) 保留它,entry 会被解析成
// G:\IHUI-AI\index(不存在)→ bundle 404。因此必须重置 watchFolders,
// __dirname(apps/mobile-rn)放第一位作为 entry 解析基准。
config.watchFolders = [
  __dirname, // apps/mobile-rn 自身(必须第一位:相对 entry 路径解析基准)
  require('path').resolve(__dirname, '../../packages'), // 共享 packages
  // 2026-09-22 修复 Metro 冷启动 bundle 500 "Failed to get the SHA-1 for D:\nm\.pnpm\...":
  // node_modules 是 junction → D:\nm(pnpm 隔离存储),依赖文件真实位置在
  // node_modules/.pnpm/<pkg>@ver/node_modules/<dep>。旧 metro 实例靠 junction 创建前
  // (2026-09-22 10:06)的旧 file-map 磁盘缓存掩盖;冷启动后 crawl roots 不覆盖 .pnpm,
  // resolver 解析出的隔离路径在 file-map 无记录 → getOrComputeSha1 抛 500。
  // 修复(续):crawler 以 junction 的 realpath 记录文件(跟随 symlink),而 resolver
  // fallback(fs.realpathSync)输出的也是 D:\nm realpath 形式——两边必须同形式。
  // 实测:crawl 是后台异步的(metro 先 listen 再慢慢 crawl),冷启动后需等 crawl
  // 完成首个 bundle 才能出,期间请求会报 getOrComputeSha1 500,等待重试即可。
  (function () {
    try {
      return require('fs').realpathSync(require('path').resolve(__dirname, 'node_modules'))
    } catch (_e) {
      return require('path').resolve(__dirname, 'node_modules')
    }
  })(),
]

// pnpm isolated linker 兼容:Metro 默认解析失败时,fallback 到 Node 原生 require.resolve
// Node 能正确处理 pnpm junction,且支持 sourceExts(.ts/.tsx)解析
const upstreamResolveRequest = config.resolver.resolveRequest
const fs = require('fs')
const path = require('path')

function tryResolveWithExts(basePath, originDir, platform) {
  // 0. 如果是目录,先尝试读 package.json 的 main/browser/react-native 字段
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    const pkgPath = path.join(basePath, 'package.json')
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        // 按 Metro resolverMainFields 优先级:react-native > browser > main
        const mainField =
          (pkg['react-native'] && typeof pkg['react-native'] === 'string'
            ? pkg['react-native']
            : null) ||
          (pkg['browser'] && typeof pkg['browser'] === 'string' ? pkg['browser'] : null) ||
          pkg['main'] ||
          'index'
        const mainPath = path.resolve(basePath, mainField)
        const resolved = tryResolveWithExts(mainPath, originDir, platform)
        if (resolved) return resolved
      } catch {}
    }
  }
  // 1. 原路径直接存在
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath
  }
  const exts = ['ts', 'tsx', 'js', 'jsx', 'json', 'mjs', 'cjs']
  // 2. 优先尝试平台扩展(.native/.ios/.android/.web)— 与 Metro 默认解析器行为对齐
  //    2026-07-29 修复:原顺序是先 .js 后 .native.js,导致 doctor.js(web 版)被
  //    错误加载而非 doctor.native.js。平台扩展必须在普通扩展之前,确保 .native.js 优先。
  const platformOrder = []
  if (platform) {
    platformOrder.push(platform) // 精确平台优先(android/ios)
  }
  if (!platformOrder.includes('native')) platformOrder.push('native') // 再 native
  if (!platformOrder.includes('web')) platformOrder.push('web') // 最后 web
  for (const plat of platformOrder) {
    for (const ext of exts) {
      if (fs.existsSync(`${basePath}.${plat}.${ext}`)) return `${basePath}.${plat}.${ext}`
    }
  }
  // 3. 再尝试普通扩展(.ts/.tsx/.js/.jsx/.json/.mjs/.cjs)
  for (const ext of exts) {
    if (fs.existsSync(`${basePath}.${ext}`)) return `${basePath}.${ext}`
  }
  // 4. 尝试 /index.<ext>(含平台扩展优先)
  for (const plat of platformOrder) {
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, `index.${plat}.${ext}`))) {
        return path.join(basePath, `index.${plat}.${ext}`)
      }
    }
  }
  for (const ext of exts) {
    if (fs.existsSync(path.join(basePath, `index.${ext}`))) {
      return path.join(basePath, `index.${ext}`)
    }
  }
  return null
}

// 2026-08-15 修复 Expo 虚拟入口双拼(模拟器红屏根因):
// app 请求 /.expo/.virtual-metro-entry.bundle,Expo withMetroResolvers 生成的
// 虚拟入口模块内部 require('./apps/mobile-rn/App'),该相对路径是按
// serverRoot=monorepo 根(G:\IHUI-AI)计算的。本项目 serverRoot 已改为
// apps/mobile-rn(见上 unstable_serverRoot 注释),相对路径被双重拼接为
// apps/mobile-rn/apps/mobile-rn/App → UnableToResolveError 红屏
// (logcat 实证:originModulePath="G:\IHUI-AI\apps\mobile-rn/." +
//  targetModuleName="./apps/mobile-rn/App")。
// rewriteRequestUrl 只作用于请求 URL,无法拦截虚拟入口内部 import,
// 必须在 resolver 层归一化:origin 为 serverRoot 目录本身时,剥掉
// ./apps/mobile-rn/ 前缀再走默认解析链;归一化失败则回退原 moduleName。
const APP_DIR_NAME = 'apps/mobile-rn'
function normalizeDirKey(p) {
  return String(p).replace(/[\\/]+/g, '/').replace(/\/\.?$/, '').toLowerCase()
}
const serverRootKey = normalizeDirKey(__dirname)

// =============================================================================
// 2026-09-22 修复 pnpm 隔离包依赖解析到 monorepo 根错误版本 → 启动红屏
// "undefined is not a function"(rnet not ready)
// =============================================================================
// 病理:RN 0.86 的 setUpReactDevTools.js(位于 pnpm 隔离目录
// D:\nm\.pnpm\react-native@0.86.2_*\node_modules\react-native\...)require
// "react-devtools-core",需要 6.1.5(其隔离目录里有 symlink,提供 initialize/
// connectWithCustomMessagingProtocol 新 API)。但 Metro 默认链沿 junction 形式
// origin(apps/mobile-rn/node_modules/react-native/...)向上层级查找,在
// monorepo 根 d:/IHUI-AI/node_modules 命中 react-devtools-core@5.3.2
// (main=dist/backend.js,无 initialize 导出)→ 默认链"成功"返回,根本轮不到
// 下方 fallback → bundle 打进 5.3.2 → 初始化 initialize(...) undefined → 红屏。
// Node require.resolve 双对照实证:paths=[RN 隔离目录]→6.1.5;
// paths=[apps/mobile-rn]→5.3.2。
// 这是通用病理:任何 .pnpm 隔离目录内包的裸包名依赖,Metro 默认链用错误起点
// (junction 形式向上)查找,可能命中 monorepo 根同名不同版包。
// 修复:origin 目录 realpath 含 .pnpm 时(= 请求来自隔离包内部),先把 origin
// realpath 化(D:\nm\... 形式),再优先走 resolveManual 的 Node 层级语义查找——
// 从隔离目录向上必然命中该包自己的 node_modules(正确版本),并按
// react-native > browser > main 选入口。失败返回 null 落回原链,零风险。
// realpath 结果按 originDir 缓存,避免每请求 syscall。
const pnpmOriginRealDirCache = new Map()
function pnpmIsolatedOriginRealDir(originDir) {
  if (pnpmOriginRealDirCache.has(originDir)) {
    return pnpmOriginRealDirCache.get(originDir)
  }
  let result = null
  try {
    const real = fs.realpathSync(originDir)
    if (String(real).split(path.sep).includes('.pnpm')) {
      result = real
    }
  } catch (_e) {
    result = null
  }
  pnpmOriginRealDirCache.set(originDir, result)
  return result
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Expo 虚拟入口双拼归一化(详见上方注释)
  if (
    (moduleName === `./${APP_DIR_NAME}` ||
      moduleName.startsWith(`./${APP_DIR_NAME}/`)) &&
    normalizeDirKey(context.originModulePath) === serverRootKey
  ) {
    const normalized = `./${moduleName.slice(`./${APP_DIR_NAME}/`.length)}`
    try {
      if (upstreamResolveRequest) {
        const r = upstreamResolveRequest(context, normalized, platform)
        if (r) return r
      }
      return context.resolveRequest(context, normalized, platform)
    } catch (_e) {
      // 归一化路径不可解析时,继续走默认链(下方会抛出原始错误)
    }
  }
  // 调试日志
  if (process.env.METRO_DEBUG_RESOLVE) {
    console.error(
      `[resolveRequest] moduleName=${moduleName} origin=${context.originModulePath} platform=${platform}`,
    )
  }
  // web 平台原生模块 stub(2026-09-04):expo-media-library 为纯原生模块,
  // web 端 import 即抛 "Cannot find native module 'ExpoMediaLibraryNext'" → 整页白屏。
  // alias 到本地 stub,native 平台不受影响。
  if (platform === 'web' && moduleName === 'expo-media-library') {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'stubs', 'expo-media-library.web.js') }
  }
  // React 单实例去重(2026-07-28 修复 NativeWind useContext null 错误)
  // 问题:pnpm isolated linker 下,bundle 中出现两个 react 实例:
  //   (1) .pnpm/react@19.0.0/node_modules/react/  (react-native 隔离目录引用)
  //   (2) node_modules/react/  (顶层 hoisted,apps/mobile-rn 引用)
  // 两个实例 → 两个 ReactSharedInternals → react-native renderer 设置 dispatcher
  // 在实例 A,react-native-css-interop 从实例 B 读取 dispatcher = null →
  // "Cannot read property 'useContext' of null"。
  // 修复:所有 react/react-jsx-runtime 子路径统一解析到 apps/mobile-rn 本地的 react。
  if (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName.startsWith('react/')
  ) {
    const localReactPath = require.resolve(moduleName, {
      paths: [__dirname],
    })
    return { type: 'sourceFile', filePath: realpathOrNull(localReactPath) }
  }
  // react-native 单实例去重(2026-09-22 修复 pnpm-isolated 优先分支引入的双实例):
  // D:\nm\.pnpm 下存在两个 react-native@0.86.2 隔离目录(_@babel+_c6deaeca... 与
  // _@babel+_efa7c6e...,peer 组合不同)。上面的 pnpm-isolated 分支让隔离包各自
  // 解析到自己隔离目录的 react-native symlink → 指向不同物理目录 → metro 按路径
  // 视为不同模块 → RN 源码(setUpFuseboxReactDevToolsDispatcher 等)双份打包,
  // 第二份 Object.defineProperty(global, '__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__',
  // {writable:false}) → 红屏 "TypeError: property is not writable"。
  // 修复:所有 react-native 裸包名/子路径请求统一解析到 apps/mobile-rn 本地实体
  // (c6deaeca,与原生侧对齐)。模式与上面 react 去重一致。
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    const localRNPath = require.resolve(moduleName, {
      paths: [__dirname],
    })
    return { type: 'sourceFile', filePath: realpathOrNull(localRNPath) }
  }
  // pnpm 隔离目录内包的裸包名依赖(详见上方 react-devtools-core 红屏修复注释):
  // 两级解析——
  // ① app 本地 node_modules 优先:react-native-svg 等共享包存在多个 peer 组合的
  //    隔离目录,若各隔离包各自解析到自己目录的 symlink → metro 按路径视为不同
  //    模块 → 双实例 → AppRegistry "Tried to register two views with the same
  //    name RNSVGCircle" 红屏。app 依赖闭包内的包统一解析到 apps/mobile-rn 一份
  //    (单实例化,RN 生态标准实践)。
  //    必须 maxHops=1 严格只看 apps/mobile-rn/node_modules 第一级:不限级向上会
  //    一路爬到 monorepo 根,再次命中 hoisted 的旧版包(react-devtools-core
  //    5.3.2 教训——monorepo 根是工具依赖,版本任意),把本分支的修复成果抵消。
  // ② 本地没有的传递依赖:从 origin realpath 的隔离目录向上层级查找(pnpm 精确
  //    版本语义)。
  // 仅拦裸包名,相对路径仍走 Metro 默认链(保留 asset 等特殊处理)。
  if (!moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
    const pnpmRealDir = pnpmIsolatedOriginRealDir(path.dirname(context.originModulePath))
    if (pnpmRealDir) {
      const localFirst = resolveManual(moduleName, __dirname, platform, { maxHops: 1 })
      if (localFirst) {
        return { type: 'sourceFile', filePath: realpathOrNull(localFirst) }
      }
      const isolated = resolveManual(moduleName, pnpmRealDir, platform)
      if (isolated) {
        if (process.env.METRO_DEBUG_RESOLVE) {
          console.error(
            `[resolveRequest pnpm-isolated] ${moduleName} origin=${context.originModulePath} -> ${isolated}`,
          )
        }
        return { type: 'sourceFile', filePath: realpathOrNull(isolated) }
      }
    }
  }
  // 1. 先尝试 upstream(nativewind/expo),抛错不阻断 Metro 默认链:
  // 2026-09-22 修复 'stream' 内置模块 500:upstream 对内置模块抛错时,旧结构
  // try{upstream; context.resolveRequest}catch{fallback} 会连默认链一起跳过,
  // 直接进 fallback,require.resolve('stream') 返回内置模块名(非路径)传给
  // metro → getOrComputeSha1('stream') 500。内置模块应由 Metro 默认链返回
  // empty 模块,upstream 失败必须继续走默认链。
  if (upstreamResolveRequest) {
    try {
      const result = upstreamResolveRequest(context, moduleName, platform)
      if (result) return result
    } catch (_e1) {
      // upstream 不可解析 → 落到 Metro 默认链(内置模块 empty stub 等)
    }
  }
  try {
    return context.resolveRequest(context, moduleName, platform)
  } catch (_e) {
    // 2. fallback:手动解析包名 + 子路径 + 扩展名
    // 不用 require.resolve(不支持 ESM exports 的 conditions 参数)
    // 2026-09-22 修复:origin 不做 realpathSync。node_modules 是 junction → D:\nm,
    // realpath 会把 origin 变成 D:\nm\... 形式,解析产物(fileMap 查 SHA-1 的 key)
    // 与 crawler 沿 junction 收录的 D:\IHUI-AI\... 形式不一致 → getOrComputeSha1 报
    // "Failed to get the SHA-1"(bundle 500)。junction 路径对 fs 遍历完全透明,
    // 保留原形式即可让解析产物与 file-map 收录路径同形式。
    const originDir = path.dirname(context.originModulePath)
    const resolved = resolveManual(moduleName, originDir, platform)
    if (resolved) {
      if (process.env.METRO_DEBUG_RESOLVE) {
        console.error(`[resolveRequest fallback] resolved=${resolved}`)
      }
      return { type: 'sourceFile', filePath: realpathOrNull(resolved) }
    }
    // 3. 最终 fallback:Node 原生 require.resolve(仅适用于 CJS 包)
    try {
      const resolved2 = require.resolve(moduleName, {
        paths: [originDir],
      })
      // Node 内置模块(stream/fs/node:* 等)的 require.resolve 返回模块名本身
      // 而非文件路径,返回给 metro 会 getOrComputeSha1 500;重抛原始错误,
      // 让默认链的内置模块 empty stub 机制处理(正常情况下到不了这里)。
      if (
        typeof resolved2 !== 'string' ||
        resolved2.startsWith('node:') ||
        !resolved2.includes(path.sep)
      ) {
        throw _e
      }
      return { type: 'sourceFile', filePath: realpathOrNull(resolved2) }
    } catch (_e2) {
      throw _e
    }
  }
}

// 2026-09-22 修复 fallback 产物与 file-map 收录形式不一致导致 bundle 500:
// "Failed to get the SHA-1 for: D:\nm\.pnpm\pretty-format@29.7.0\node_modules\ansi-styles\index.js"。
// 根因:pnpm isolated 结构下 <pkg>@v/node_modules/<dep> 多为 symlink(@expo/metro-file-map
// enableSymlinks 模式收录的是 target 真实路径),而 resolveManual/require.resolve 基于
// fs 语义(透明跟随 symlink),会返回 symlink 形式路径(如
// pretty-format@29.7.0\node_modules\ansi-styles\index.js)。该形式在 file-map 中
// 无记录 → getOrComputeSha1 抛 500。修复:所有 fallback 产物统一 realpathSync,
// 与 crawler 收录形式(D:\nm realpath)对齐;node_modules junction 同理 realpath。
function realpathOrNull(p) {
  try {
    return fs.realpathSync(p)
  } catch (_e) {
    return p
  }
}

// 2026-09-22 修复解析 qrcode 时 "The paths[1] argument must be of type string":
// qrcode 的 exports['.'] 是嵌套条件对象({import:{node,default},require:...}),
// 旧代码 entry.import 直接取到对象传给 path.resolve → ERR_INVALID_ARG_TYPE。
// 修复:递归下钻条件对象,按 Metro 默认 conditions 优先级(react-native >
// require > import > default > node > browser)取第一个 string 叶子值。
const EXPORT_CONDITION_ORDER = ['react-native', 'require', 'import', 'default', 'node', 'browser']
function resolveExportEntry(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    for (const cond of EXPORT_CONDITION_ORDER) {
      if (cond in entry) {
        const resolved = resolveExportEntry(entry[cond])
        if (resolved) return resolved
      }
    }
  }
  return null
}

/**
 * 手动解析模块名:支持 npm 包名(含 scoped 子路径如 @ihui/shared/auth) + 相对路径 + 扩展名
 * 用于 Metro 默认解析 + require.resolve 都失败时的最终 fallback。
 */
function resolveManual(moduleName, originDir, platform, opts) {
  // maxHops:node_modules 层级查找的级数上限。默认 10(向上多级);传 1 表示
  // 仅查 originDir 自己的 node_modules 一级——pnpm-isolated 分支用它做"app 本地
  // 单实例"解析,防止向上命中 monorepo 根的 hoisted 旧版包(react-devtools-core
  // 5.3.2 教训:monorepo 根是工具依赖,不是 RN 运行时依赖,版本任意)。
  const maxHops = (opts && opts.maxHops) || 10
  let basePath
  if (path.isAbsolute(moduleName)) {
    basePath = moduleName
    return tryResolveWithExts(basePath, originDir, platform)
  } else if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
    basePath = path.resolve(originDir, moduleName)
    return tryResolveWithExts(basePath, originDir, platform)
  } else {
    // npm 包名,可能在 node_modules 层级查找
    // 分割包名和子路径:@ihui/shared/auth → pkg=@ihui/shared, subPath=auth
    // 非 scoped:lodash/foo → pkg=lodash, subPath=foo
    let pkg, subPath
    if (moduleName.startsWith('@')) {
      const parts = moduleName.split('/')
      pkg = parts.slice(0, 2).join('/')
      subPath = parts.slice(2).join('/')
    } else {
      const idx = moduleName.indexOf('/')
      if (idx > 0) {
        pkg = moduleName.substring(0, idx)
        subPath = moduleName.substring(idx + 1)
      } else {
        pkg = moduleName
        subPath = ''
      }
    }
    // 在 originDir 的 node_modules 层级查找包(级数受 maxHops 限制)
    let pkgDir = null
    let dir = originDir
    for (let i = 0; i < maxHops && dir; i++) {
      const candidate = path.join(dir, 'node_modules', pkg)
      if (fs.existsSync(candidate)) {
        pkgDir = candidate
        break
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    // 也尝试 .pnpm/node_modules 虚拟存储。仅在允许向上多级查找时参与:
    // 该目录是 pnpm 全量去重存储(每个包名只留一个任意版本),与 monorepo 根
    // hoisted 属同一类版本任意风险,会抵消 maxHops=1 的"严格本地单实例"语义。
    if (!pkgDir && maxHops > 1) {
      const pnpmCandidate = path.resolve(originDir, '../../node_modules/.pnpm/node_modules', pkg)
      if (fs.existsSync(pnpmCandidate)) pkgDir = pnpmCandidate
    }
    if (!pkgDir) return null
    // 读 package.json 的 exports / main 字段解析子路径
    const pkgJsonPath = path.join(pkgDir, 'package.json')
    if (!fs.existsSync(pkgJsonPath)) return null
    let pkgJson
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    } catch {
      return null
    }
    // 优先用 exports 解析子路径(支持通配符 ./xxx/*)
    if (pkgJson.exports) {
      const exportKey = subPath ? `./${subPath}` : '.'
      // 1. 精确匹配
      let entry = pkgJson.exports[exportKey]
      // 2. 通配符匹配(./notifications/* 匹配 ./notifications/use-notification-websocket)
      if (!entry) {
        for (const key of Object.keys(pkgJson.exports)) {
          if (key.includes('*')) {
            const pattern = key.split('*')
            const prefix = pattern[0]
            const suffix = pattern[1] || ''
            if (
              exportKey.startsWith(prefix) &&
              exportKey.endsWith(suffix) &&
              exportKey.length >= prefix.length + suffix.length
            ) {
              const wildcardMatch = exportKey.substring(
                prefix.length,
                exportKey.length - suffix.length,
              )
              entry = pkgJson.exports[key]
              // 如果 entry 是字符串或对象,替换 * 为 wildcardMatch
              if (typeof entry === 'string') {
                entry = entry.replace('*', wildcardMatch)
              } else if (entry && typeof entry === 'object') {
                entry = { ...entry }
                for (const cond of Object.keys(entry)) {
                  if (typeof entry[cond] === 'string') {
                    entry[cond] = entry[cond].replace('*', wildcardMatch)
                  }
                }
              }
              break
            }
          }
        }
      }
      if (entry) {
        // 2026-09-22:entry 可能是嵌套条件对象(如 qrcode import:{node,default}),
        // resolveExportEntry 按 conditions 优先级递归取 string 叶子,严禁把对象
        // 传给 path.resolve(会抛 ERR_INVALID_ARG_TYPE paths[1])。
        const target = resolveExportEntry(entry)
        if (target) {
          const targetPath = path.resolve(pkgDir, target)
          const resolved = tryResolveWithExts(targetPath, originDir, platform)
          if (resolved) return resolved
        }
      }
    }
    // 用 main 字段
    if (!subPath) {
      // 2026-09-22 修复 "The paths[1] argument must be of type string"(qrcode 实证):
      // browser 字段可能是映射对象({"./lib/index.js":"./lib/browser.js",fs:false},
      // 非 string 入口),|| 短路会把对象传给 path.resolve 抛 ERR_INVALID_ARG_TYPE。
      // 修复:仅接受 string 类型的字段;browser 映射对象跳过(由 Metro 默认链的
      // browser-mapping 处理,fallback 不复制该语义),落到 main。
      let mainField =
        [pkgJson['react-native'], pkgJson['browser'], pkgJson['main']].find(
          (v) => typeof v === 'string' && v,
        ) || 'index'
      // 2026-09-22 补齐 browser 映射重定向(qrcode 实证):browser 为映射对象时,
      // Metro 默认链会把 main 入口重定向到映射目标(qrcode lib/index.js →
      // lib/browser.js)。fallback 不复制该语义会让包走 node 版入口,连带拉进
      // pngjs → require('stream') 等 Node 专属依赖 → RN 平台 UnableToResolve 500。
      const browserMap = pkgJson['browser']
      if (browserMap && typeof browserMap === 'object' && !path.isAbsolute(mainField)) {
        const relMain = './' + String(mainField).replace(/^\.?\//, '')
        const redirected = browserMap[relMain]
        if (typeof redirected === 'string' && redirected) {
          mainField = redirected
        }
      }
      const mainPath = path.resolve(pkgDir, mainField)
      return tryResolveWithExts(mainPath, originDir, platform)
    }
    // 子路径直接解析
    basePath = path.resolve(pkgDir, subPath)
    return tryResolveWithExts(basePath, originDir, platform)
  }
}

// 2026-07-28 修复 Metro watch 模式启动崩溃
// 根因:react-native-css-interop@0.2.6 调用 graph._fileSystem.getSha1(),
// 但 metro 0.81.5 已移除 DependencyGraph._fileSystem 属性,导致 fs 为 undefined。
// forceWriteFileSystem=true 跳过虚拟模块 monkey-patch,改用磁盘写入。
// 仅在 watch 模式(CI=false)下启用;CI 模式下 forceWriteFileSystem 会导致打包超时。
// 副作用:CSS 变更不触发 Fast Refresh,需手动 reload;JS Fast Refresh 不受影响。
// 长期方案:升级到 nativewind 5.0 stable(已重写不依赖 _fileSystem)。
const isWatchMode = process.env.CI !== 'true'

// SVG transformer(2026-09-03 复位,补回 metro.config.cjs;reset-cache 暴露 wx.svg 等 SVG 资源
// "unsupported file type" 红屏。react-native-svg-transformer 已安装在 devDependencies,需在
// withNativeWind 包装之前注入 assetExts/sourceExts/babelTransformerPath 三件套,
// 否则 metro 把 .svg 当 asset 处理,image-size 包拿不到 png/jpg 头部字节报错。
// 对齐 skill:mobile-rn-android-emulator §坑 1。)
const { assetExts, sourceExts } = config.resolver
config.resolver.assetExts = assetExts.filter((ext) => ext !== 'svg')
config.resolver.sourceExts = [...sourceExts, 'svg']
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer')

// 2026-09-22 诊断 bundle 行号偏移:记录 dev client 的真实 bundle 请求 URL,
// 用于复现 app 侧 bundle(其行号与本地 curl 的 URL 不一致,导致红屏堆栈对不上行)。
config.server.enhanceMiddleware = (middleware, server) => {
  return (req, res, next) => {
    if (req && req.url && req.url.includes('.bundle')) {
      console.error('[IHUI-REQ] ' + String(req.url).slice(0, 600))
    }
    return middleware(req, res, next)
  }
}

module.exports = withNativeWind(config, {
  input: './global.css',
  ...(isWatchMode ? { forceWriteFileSystem: true } : {}),
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
