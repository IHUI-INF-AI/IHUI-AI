const Module = require('module')
const fs = require('fs')
const path = require('path')

// =============================================================================
// Windows pnpm junction monkey-patch(2026-07-29 修复)
// =============================================================================
// 根因:pnpm isolated linker 在 Windows 上用 junction(ReparsePoint)链接 node_modules
// 中的包到 .pnpm 虚拟存储。metro-file-map@0.81.5 的 node crawler(被 Metro 0.81.5
// DependencyGraph.createFileMap 通过 enableSymlinks:true 调用)使用异步 fs.readdir
// (crawlers/node/index.js:52,withFileTypes:true)获取 Dirent。Node.js 把 Windows
// junction 视为 symlink,Dirent.isDirectory() 对 junction 返回 false,导致 crawler
// 不递归进入 junction 目标目录,FileMap 不知道 react-native/index.js 等文件的存在,
// 最终报 "Failed to get the SHA-1 for: .../react-native/index.js" 错误。
//
// 修复:patch fs.readdir 和 fs.readdirSync 的 withFileTypes 模式,对 symlink 类型
// 的 entry,用 fs.statSync(follow symlink)检查目标是否为目录,如果是,把 entry 的
// isDirectory 方法 patch 为返回 true,让 crawler 递归进入 junction 目标目录。
// 异步 fs.readdir 是 metro-file-map 的实际调用路径,readdirSync 保留为防御性补丁。
function patchDirentEntries(entries, dirPath) {
  if (!entries) return entries
  for (const entry of entries) {
    if (entry && entry.isSymbolicLink && entry.isSymbolicLink()) {
      try {
        const fullPath = path.join(
          typeof dirPath === 'string' ? dirPath : dirPath.toString(),
          entry.name.toString(),
        )
        const stat = fs.statSync(fullPath) // follow symlink/junction
        if (stat.isDirectory()) {
          // Patch: 让 crawler 把 junction-to-directory 当作普通目录递归进入
          entry.isDirectory = () => true
          entry.isSymbolicLink = () => false
        }
      } catch {
        // junction 目标不存在,跳过
      }
    }
  }
  return entries
}

if (!fs.__junction_patched) {
  // 异步 fs.readdir(callback 风格)— metro-file-map node crawler 实际调用
  const origReaddir = fs.readdir
  fs.readdir = function (dirPath, options, callback) {
    // 兼容两种签名:(path, callback) 和 (path, options, callback)
    if (typeof options === 'function') {
      callback = options
      options = undefined
    }
    const withFileTypes =
      options && (options.withFileTypes === true || options === 'withFileTypes')
    if (!withFileTypes) {
      return origReaddir.call(this, dirPath, options, callback)
    }
    // 包装 callback,在返回 entries 前修补 Dirent
    return origReaddir.call(this, dirPath, options, (err, entries) => {
      if (err || !entries) return callback(err, entries)
      patchDirentEntries(entries, dirPath)
      return callback(null, entries)
    })
  }

  // 同步 fs.readdirSync — 防御性补丁(其他工具可能调用)
  const origReaddirSync = fs.readdirSync
  fs.readdirSync = function (dirPath, options) {
    const entries = origReaddirSync.call(this, dirPath, options)
    if (
      options &&
      (options.withFileTypes === true || options === 'withFileTypes')
    ) {
      patchDirentEntries(entries, dirPath)
    }
    return entries
  }

  fs.__junction_patched = true
}

// 2026-07-29 修复:metro-file-map Watcher MAX_WAIT_TIME 240s 不够爬取 .pnpm(300k 文件)
// Monkey-patch 为 600s(10 分钟)。首次 crawl 慢,有缓存后快。
try {
  const watcherPath = require.resolve(
    'metro-file-map/src/Watcher.js',
    { paths: [__dirname] },
  )
  const watcherSrc = fs.readFileSync(watcherPath, 'utf8')
  if (watcherSrc.includes('MAX_WAIT_TIME = 240000')) {
    const patched = watcherSrc.replace(
      'MAX_WAIT_TIME = 240000',
      'MAX_WAIT_TIME = 600000',
    )
    fs.writeFileSync(watcherPath, patched)
  }
} catch (_e) {
  // 静默失败,不阻塞 Metro 启动
}

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
// resolver.worker = undefined 必要时设置

// 2026-07-29 修复:Expo Go 客户端硬编码发送 lazy=true URL 参数,优先级高于
// serializer.lazy 配置,导致 HMRClient 延迟加载未注册为 callable module,
// 原生代码调用 HMRClient.setup() 时报 "Module has not been registered as callable"。
// 重写 URL 把 lazy=true 改成 lazy=false,强制所有模块立即加载。
// 同时把 transform.bytecode=1 改成 0,禁用 Hermes 字节码编译(APK Hermes 运行时版本
// 与 Metro 0.81 编译器版本不匹配导致 "bad application bundle" 错误)。
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    let rewritten = url
    // lazy=true → lazy=false:解决 HMRClient 未注册
    if (rewritten.includes('lazy=true')) {
      rewritten = rewritten.replace(/([?&])lazy=true/g, '$1lazy=false')
    }
    // bytecode=1 → bytecode=0:禁用 Hermes 字节码,返回 JS 文本
    if (rewritten.includes('bytecode=1')) {
      rewritten = rewritten.replace(/([?&])bytecode=1/g, '$1bytecode=0')
    }
    if (rewritten !== url) {
      console.error(`[rewriteRequestUrl] ${url} → ${rewritten}`)
    }
    return rewritten
  },
}

// 2026-07-29 修复:lazy=true 导致 InitializeCore 延迟加载,HMRClient 未注册为 callable module
// 原生代码在 bundle 初始化时立即调用 HMRClient.setup(),但此时 InitializeCore 尚未执行
// 注意:serializer.lazy 不是有效 Metro 配置项(Metro 0.81 会报 Unknown option 警告),
// lazy 只能通过 URL 参数控制。已在上方 rewriteRequestUrl 中把 lazy=true 重写为 lazy=false。

// pnpm isolated linker 兼容(2026-07-25 修复 Metro bundle 失败)
// 问题:pnpm node-linker=isolated 下,react-native 等包是 junction 指向
// .pnpm/<pkg>/node_modules/<pkg>,其传递依赖(ansi-regex, invariant 等)只在
// .pnpm/<pkg>/node_modules/ 隔离目录下。Metro 默认不 follow junction realpath,
// hierarchical lookup 从 apps/mobile-rn/node_modules/react-native/.. 查找,找不到。
// 修复:自定义 resolveRequest,Metro 默认解析失败时,fallback 到 Node 原生
// require.resolve(基于 originModulePath 的 realpath),Node 能正确处理 pnpm junction。
config.resolver.unstable_enablePackageExports = false
// 2026-07-29:unstable_enableSymlinks: false — Metro 不 follow junction symlink,返回 junction path。
// junction monkey-patch(顶部)让 FileMap crawler 通过 junction 递归扫描(把 junction 伪装为普通目录),
// 所以 FileMap 索引的是 junction path(如 apps/mobile-rn/node_modules/react/index.js)。
// resolver 也返回 junction path,两者匹配,无 SHA-1 错误。
// 不需要 watch .pnpm(300k 文件 crawl 超时),也不需要 require.resolve fallback(返回 realpath 导致不匹配)。
config.resolver.unstable_enableSymlinks = false
config.resolver.nodeModulesPaths = [
  ...config.resolver.nodeModulesPaths,
  require('path').resolve(__dirname, '../../node_modules/.pnpm/node_modules'),
]

// pnpm isolated linker + Windows junction 兼容(2026-07-29 修复)
// junction monkey-patch(顶部)让 FileMap crawler 递归进入 junction 目标目录,
// FileMap 用 junction path 索引文件(如 apps/mobile-rn/node_modules/react/index.js)。
// resolver 需返回 junction path(不是 realpath),否则 FileMap 找不到文件。
// .pnpm/node_modules 是 pnpm hoisted fallback(仅 0.5MB),覆盖部分 transitive deps。
// 不 watch 整个 .pnpm(8.8GB/30万文件, crawl 过慢)。
// Windows 无 watchman,useWatchman: false 避免 FallbackWatcher 240s 超时。
let cssInteropPkgDir = path.dirname(
  require.resolve('react-native-css-interop/package.json', { paths: [__dirname] }),
)
// 2026-07-29 修复:require.resolve 在 Windows pnpm isolated 下返回 .pnpm realpath
// (如 .pnpm/react-native-css-interop@0.2.6_.../node_modules/react-native-css-interop/),
// 导致后续构造的 nativeEntryPath 是 .pnpm realpath,不在 watchFolders → SHA-1 错误。
// 转换为 junction path(apps/mobile-rn/node_modules/react-native-css-interop/),
// 与 FileMap 索引路径一致(junction monkey-patch 让 crawler 通过 junction 递归索引)。
const cssInteropJunctionDir = path.join(__dirname, 'node_modules', 'react-native-css-interop')
if (fs.existsSync(cssInteropJunctionDir)) {
  cssInteropPkgDir = cssInteropJunctionDir
}
const cssInteropCacheDir = path.join(cssInteropPkgDir, '.cache')
try {
  fs.mkdirSync(cssInteropCacheDir, { recursive: true })
} catch {}
// 2026-07-29 修复:withCssInterop 内部 outputDirectory 用 __dirname(realpath)计算 .cache 目录,
// 返回 platformPath = .pnpm/.../react-native-css-interop/.cache/android.js(realpath)。
// FileMap 索引的是 junction path(apps/mobile-rn/.../.cache),两者不匹配 → SHA-1 错误。
// 把 realpath .cache 目录加入 watchFolders,让 FileMap 也索引 realpath 路径。
let cssInteropRealpathCacheDir = null
try {
  const cssInteropPkgRealpath = fs.realpathSync(
    require.resolve('react-native-css-interop/package.json', { paths: [__dirname] }),
  )
  cssInteropRealpathCacheDir = path.join(path.dirname(cssInteropPkgRealpath), '.cache')
  fs.mkdirSync(cssInteropRealpathCacheDir, { recursive: true })
} catch {}

// 2026-07-29:Metro/React-Native 内部 require.resolve(polyfills)返回 .pnpm realpath,绕过 resolveRequest。
// 把所有 metro-* 和 @react-native/* 包的 realpath 目录加入 watchFolders,让 FileMap 索引 realpath。
// 这些包体积小(每个几 KB-MB),总数约 30 个,不影响 crawl 性能。
function getMetroInternalDepRealpaths() {
  const pnpmDir = path.resolve(__dirname, '../../node_modules/.pnpm')
  let pnpmEntries = []
  try {
    pnpmEntries = fs.readdirSync(pnpmDir)
  } catch {
    return []
  }
  const realpaths = []
  for (const entry of pnpmEntries) {
    // 匹配 metro-*@<ver> 或 @react-native+*@<ver>
    if (entry.startsWith('metro-') || entry.startsWith('@react-native+')) {
      // 提取包名:metro-runtime@0.81.5 → metro-runtime;@react-native+js-polyfills@0.79.6 → @react-native/js-polyfills
      const atIdx = entry.lastIndexOf('@')
      if (atIdx <= 0) continue
      const pkgFullName = entry.substring(0, atIdx)
      const pkgName = pkgFullName.replace(/\+/g, '/')
      const realpathDir = path.join(pnpmDir, entry, 'node_modules', pkgName)
      if (fs.existsSync(realpathDir)) {
        realpaths.push(realpathDir)
      }
    }
  }
  return realpaths
}

config.watchFolders = [
  __dirname, // apps/mobile-rn 自身(含 node_modules junctions)
  path.resolve(__dirname, '../../packages'), // 共享 packages 源码
  // 2026-07-29:.pnpm/node_modules(hoisted fallback)解决 resolveRequest 返回的间接依赖路径。
  // junction monkey-patch 让 crawler 通过 junction 递归,索引 junction path(.pnpm/node_modules/<pkg>/...)。
  // resolveRequest 把 .pnpm realpath 转换为 hoistedPath(.pnpm/node_modules/<pkg>/...),两者匹配。
  path.resolve(__dirname, '../../node_modules/.pnpm/node_modules'),
  cssInteropCacheDir, // NativeWind CSS 缓存(forceWriteFileSystem 模式需要)
  ...(cssInteropRealpathCacheDir ? [cssInteropRealpathCacheDir] : []),
  // 2026-07-29:Metro 内部 require.resolve(polyfills require.js 等)返回 .pnpm realpath,
  // 绕过 resolveRequest,FileMap 未索引 realpath → SHA-1 错误。
  // 把 Metro 内部依赖的 realpath 目录加入 watchFolders,FileMap 直接索引 realpath。
  // 这些包很小(每个几 KB-MB),不影响 crawl 性能。
  ...getMetroInternalDepRealpaths(),
]

// pnpm isolated linker 兼容:Metro 默认解析失败时,fallback 到 Node 原生 require.resolve
// Node 能正确处理 pnpm junction,且支持 sourceExts(.ts/.tsx)解析
const upstreamResolveRequest = config.resolver.resolveRequest

// 2026-07-29 修复 RN 环境加载 web 版本文件导致 "Property 'window' doesn't exist" 崩溃
// 根因:原 tryResolveWithExts 扩展名解析顺序为 .js 优先于 .native.js,导致 fallback
// 解析时加载了 react-native-css-interop/dist/runtime/api.js(web 版本)而非
// api.native.js(native 版本),web 版本的 color-scheme.js 顶层访问 globalThis.window.document
// 在 Hermes 引擎下崩溃。
// 修复:扩展名解析顺序改为 Metro 标准:特定平台 → .native → 通用 → .web(仅 web 平台)
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

  // 2. 优先尝试特定平台扩展(.android.js / .ios.js)— RN 环境下最高优先级
  if (platform && platform !== 'web') {
    for (const ext of exts) {
      if (fs.existsSync(`${basePath}.${platform}.${ext}`)) {
        return `${basePath}.${platform}.${ext}`
      }
    }
  }

  // 3. 尝试 .native.{ext}(通用原生平台,RN 环境下优先于 .js)
  //    这是修复的关键:.native.js 必须在 .js 之前尝试
  if (platform !== 'web') {
    for (const ext of exts) {
      if (fs.existsSync(`${basePath}.native.${ext}`)) {
        return `${basePath}.native.${ext}`
      }
    }
  }

  // 4. 尝试普通扩展 .{ext}
  for (const ext of exts) {
    if (fs.existsSync(`${basePath}.${ext}`)) return `${basePath}.${ext}`
  }

  // 5. 尝试 /index.{platform}.{ext} 和 /index.native.{ext}(目录入口的平台扩展)
  if (platform && platform !== 'web') {
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, `index.${platform}.${ext}`))) {
        return path.join(basePath, `index.${platform}.${ext}`)
      }
    }
  }
  if (platform !== 'web') {
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, `index.native.${ext}`))) {
        return path.join(basePath, `index.native.${ext}`)
      }
    }
  }

  // 6. 尝试 /index.{ext}(目录入口的通用扩展)
  for (const ext of exts) {
    if (fs.existsSync(path.join(basePath, `index.${ext}`))) {
      return path.join(basePath, `index.${ext}`)
    }
  }

  // 7. 最后尝试 .web.{ext}(仅 web 平台时才尝试,RN 环境下不解析 web 扩展)
  if (platform === 'web') {
    for (const ext of exts) {
      if (fs.existsSync(`${basePath}.web.${ext}`)) return `${basePath}.web.${ext}`
    }
    for (const ext of exts) {
      if (fs.existsSync(path.join(basePath, `index.web.${ext}`))) {
        return path.join(basePath, `index.web.${ext}`)
      }
    }
  }

  return null
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 2026-07-29 修复:Expo CLI 把 Metro projectRoot 设为 monorepo 根(G:\IHUI-AI),
  // 导致入口文件 ./App 或 ./index 从 monorepo 根解析(找不到)。
  // 修复:当 originModulePath 是 monorepo 根(以 /. 结尾或 === monorepo 根)且
  // moduleName 是相对路径(./xxx)时,从 __dirname(apps/mobile-rn)解析。
  if (
    moduleName.startsWith('./') &&
    context.originModulePath &&
    (context.originModulePath.replace(/\\/g, '/').endsWith('/.') ||
      context.originModulePath.replace(/\\/g, '/') ===
        path.resolve(__dirname, '../..').replace(/\\/g, '/'))
  ) {
    // 2026-07-29 修复:Expo 开发版 APK 的入口是 ./.expo/.virtual-metro-entry,
    // 但 --reset-cache 后 .expo 目录可能不存在。重定向到 index.js(含 polyfills)。
    if (moduleName === './.expo/.virtual-metro-entry') {
      const indexPath = path.join(__dirname, 'index.js')
      if (fs.existsSync(indexPath)) {
        return { type: 'sourceFile', filePath: indexPath }
      }
    }
    const appEntryPath = path.resolve(__dirname, moduleName)
    const resolved = tryResolveWithExts(appEntryPath, __dirname, platform)
    if (resolved) {
      return { type: 'sourceFile', filePath: resolved }
    }
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
    // 2026-07-29 修复:不用 require.resolve(在 Windows pnpm junction 下返回 realpath
    // .pnpm/react@19.0.0/node_modules/react/index.js),FileMap 用 junction path 索引
    // (apps/mobile-rn/node_modules/react/index.js),两者不匹配导致 SHA-1 错误。
    // 手动构造 junction path,与 FileMap 索引路径一致。
    const reactJunctionDir = path.join(__dirname, 'node_modules', 'react')
    let subPath = ''
    if (moduleName === 'react') {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(reactJunctionDir, 'package.json'), 'utf8'),
        )
        subPath = pkg.main || 'index.js'
      } catch {
        subPath = 'index.js'
      }
    } else {
      // react/jsx-runtime / react/xxx
      subPath = moduleName.substring(6)
    }
    let filePath = path.join(reactJunctionDir, subPath)
    if (!fs.existsSync(filePath)) {
      for (const ext of ['js', 'json']) {
        if (fs.existsSync(`${filePath}.${ext}`)) {
          filePath = `${filePath}.${ext}`
          break
        }
      }
    }
    if (fs.existsSync(filePath)) {
      return { type: 'sourceFile', filePath }
    }
  }
  // 2026-07-29 修复: react-native-css-interop 主入口重定向到 native 版本
  // 根因: package.json main=dist/index.js (web 版本),其 require 链:
  //   index.js → ./runtime/wrap-jsx → ./api (Metro 选了 api.js web 版本)
  //   → ./web/api → 顶层访问 globalThis.window.document 在 Hermes 崩溃。
  // dist/index.native.js 不存在,下方的 .js→.native.js 拦截重定向失败。
  // 修复: 拦截主入口(无子路径),重定向到 dist/runtime/index.native.js
  //   (native 完整入口,导出 StyleSheet/cssInterop/colorScheme 等所有 native API)。
  // NativeWind 运行时只需 StyleSheet/cssInterop 等(都在 native/api),
  // verifyJSX/verifyData/verifyFlag 只在 verifyInstallation() 开发时调用,
  // wrapJSX/createElement 不被 NativeWind 运行时导入(nativewind/src/index.tsx 确认)。
  if (moduleName === 'react-native-css-interop' && platform !== 'web') {
    const nativeEntryPath = path.join(
      cssInteropPkgDir,
      'dist',
      'runtime',
      'index.native.js',
    )
    if (fs.existsSync(nativeEntryPath)) {
      return { type: 'sourceFile', filePath: nativeEntryPath }
    }
  }
  // 1. 先尝试 Metro 默认解析(upstreamResolveRequest 或 context.resolveRequest)
  try {
    let result = null
    if (upstreamResolveRequest) {
      result = upstreamResolveRequest(context, moduleName, platform)
    }
    if (!result) {
      result = context.resolveRequest(context, moduleName, platform)
    }

    // 2026-07-29 修复:.pnpm realpath → junction path 转换
    // 根因:unstable_enableSymlinks: false 下,Metro 默认 resolver(或 Expo CLI resolver)
    // 仍可能返回 .pnpm realpath(如 .pnpm/invariant@2.2.4/node_modules/invariant/invariant.js)。
    // FileMap 只索引 junction path(apps/mobile-rn/node_modules/...),不匹配 → SHA-1 错误。
    // 修复:把 .pnpm realpath 转换为 junction path。
    // .pnpm/<pkg>@<ver>_.../node_modules/<pkg>/rest → apps/mobile-rn/node_modules/<pkg>/rest
    // (如果 apps/mobile-rn/node_modules/<pkg>/rest 存在,即 <pkg> 是直接依赖)
    // 或 → .pnpm/node_modules/<pkg>/rest (hoisted fallback,如果 <pkg> 是间接依赖)
    if (result && result.filePath && result.filePath.includes(path.sep + '.pnpm' + path.sep)) {
      console.error(`[pnpm-realpath] input: ${result.filePath}`)
      const fp = result.filePath.replace(/\\/g, '/')
      // 匹配 .pnpm/<pkg>@<ver>_.../node_modules/<pkg-name>/rest
      const match = fp.match(/\/\.pnpm\/[^/]+\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/)
      if (match) {
        const pkgName = match[1]
        const restPath = match[2]
        // 优先:apps/mobile-rn/node_modules/<pkg>/rest (直接依赖 junction)
        const junctionPath = path.join(__dirname, 'node_modules', pkgName, restPath)
        if (fs.existsSync(junctionPath)) {
          console.error(`[pnpm-realpath] → junction: ${junctionPath}`)
          result = { ...result, filePath: junctionPath }
        } else {
          // 备选:.pnpm/node_modules/<pkg>/rest (hoisted fallback junction)
          const hoistedPath = path.resolve(__dirname, '../../node_modules/.pnpm/node_modules', pkgName, restPath)
          if (fs.existsSync(hoistedPath)) {
            console.error(`[pnpm-realpath] → hoisted: ${hoistedPath}`)
            result = { ...result, filePath: hoistedPath }
          } else {
            console.error(`[pnpm-realpath] NOT FOUND: ${pkgName}/${restPath}`)
          }
          // 如果都不存在,保留原 .pnpm realpath(让 Metro 报明确错误)
        }
      } else {
        console.error(`[pnpm-realpath] regex NO MATCH: ${fp}`)
      }
    }

    // 2026-07-29 主动拦截:react-native-css-interop 的 web 版本文件重定向到 native 版本
    // 根因:react-native-css-interop@0.2.6 的 dist/ 下有两套入口:
    //   - *.js(web 版本,如 index.js/doctor.js/api.js)顶层访问 globalThis.window.document
    //   - *.native.js(native 版本,如 index.native.js/doctor.native.js/api.native.js)
    // package.json main=dist/index 但无 react-native 字段,Metro 默认 resolver 在 pnpm
    // isolated linker + Windows junction 下平台扩展名优先级失效,解析到 dist/index.js(web),
    // 它 require ./doctor,doctor.js 顶层访问 globalThis.window 在 Hermes 引擎下崩溃。
    // 修复:对 react-native-css-interop/dist/ 下的所有 .js 文件(非 .native.js),
    // 强制重定向到同名 .native.js 版本。同时拦截 dist/runtime/web/ 子目录的文件
    // 重定向到 dist/runtime/native/ 对应文件(native 目录无 color-scheme,跳过)。
    if (
      result &&
      result.filePath &&
      platform !== 'web'
    ) {
      const fp = result.filePath.replace(/\\/g, '/') // 统一为正斜杠便于匹配
      const isCssInterop = fp.includes('react-native-css-interop/dist/')
      const isWebSubdir = fp.includes('/runtime/web/')
      const isWebExt =
        isCssInterop &&
        /\.js$/.test(fp) &&
        !/\.native\.js$/.test(fp) &&
        !/\.web\.js$/.test(fp)
      // 2026-07-29 调试:无条件日志,确认拦截是否触发
      if (isCssInterop) {
        console.error(`[css-interop resolve] ${result.filePath} | isWebSubdir=${isWebSubdir} isWebExt=${isWebExt}`)
      }
      if (isCssInterop && (isWebSubdir || isWebExt)) {
        // 构造 native 版本路径:
        // - dist/X.js → dist/X.native.js(如 index.js→index.native.js, doctor.js→doctor.native.js)
        // - dist/runtime/X.js → dist/runtime/X.native.js
        // - dist/runtime/web/X.js → dist/runtime/native/X.js
        let nativePath = null
        if (isWebSubdir) {
          // /runtime/web/X.js → /runtime/native/X.js
          nativePath = fp
            .replace('/runtime/web/', '/runtime/native/')
            .replace(/\//g, path.sep)
        } else {
          // 任意 dist/.../X.js → dist/.../X.native.js
          nativePath = fp.replace(/\.js$/, '.native.js').replace(/\//g, path.sep)
        }
        const exists = nativePath ? fs.existsSync(nativePath) : false
        // 无条件日志,确认 existsSync 结果
        console.error(`[css-interop redirect?] nativePath=${nativePath} exists=${exists}`)
        if (nativePath && exists) {
          console.error(`[resolveRequest web→native] ${result.filePath} → ${nativePath}`)
          return { type: 'sourceFile', filePath: nativePath }
        }
      }
    }

    if (result) return result
  } catch (_e) {
    // 2. fallback:手动解析包名 + 子路径 + 扩展名
    // 2026-07-29:不用 fs.realpathSync(返回 .pnpm realpath,FileMap 无索引导致 SHA-1 错误)。
    // 用 context.originModulePath 原值(junction path),resolveManual 从 junction path 解析,
    // 返回 junction path,与 FileMap 索引一致。
    const originDir = path.dirname(context.originModulePath)
    const resolved = resolveManual(moduleName, originDir, platform)
    if (resolved) {
      if (process.env.METRO_DEBUG_RESOLVE) {
        console.error(`[resolveRequest fallback] resolved=${resolved}`)
      }
      return { type: 'sourceFile', filePath: resolved }
    }
    // 3. 最终 fallback:Node 原生 require.resolve(返回 realpath,仅作最后手段)
    try {
      const resolved2 = require.resolve(moduleName, {
        paths: [originDir],
      })
      return { type: 'sourceFile', filePath: resolved2 }
    } catch (_e2) {
      throw _e
    }
  }
}

/**
 * 手动解析模块名:支持 npm 包名(含 scoped 子路径如 @ihui/shared/auth) + 相对路径 + 扩展名
 * 用于 Metro 默认解析 + require.resolve 都失败时的最终 fallback。
 * platform 参数用于扩展名平台优先级(.native.js 优先于 .js)。
 */
function resolveManual(moduleName, originDir, platform) {
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
    // 在 originDir 的 node_modules 层级查找包
    let pkgDir = null
    let dir = originDir
    for (let i = 0; i < 10 && dir; i++) {
      const candidate = path.join(dir, 'node_modules', pkg)
      if (fs.existsSync(candidate)) {
        pkgDir = candidate
        break
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    // 也尝试 .pnpm/node_modules
    if (!pkgDir) {
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
        // entry 可能是字符串或对象 { import: '...', require: '...' }
        const target =
          typeof entry === 'string' ? entry : entry.import || entry.require || entry.default
        if (target) {
          const targetPath = path.resolve(pkgDir, target)
          const resolved = tryResolveWithExts(targetPath, originDir, platform)
          if (resolved) return resolved
        }
      }
    }
    // 用 main 字段
    if (!subPath) {
      const mainField = pkgJson['react-native'] || pkgJson['browser'] || pkgJson['main'] || 'index'
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
const DISABLE_NATIVEWIND = process.env.DISABLE_NATIVEWIND === '1' // 临时调试开关
module.exports = DISABLE_NATIVEWIND
  ? config
  : withNativeWind(config, {
      input: './global.css',
      ...(isWatchMode ? { forceWriteFileSystem: true } : {}),
    })
