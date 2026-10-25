// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'
import path from 'path'
// 2026-07-26 修复 WXSS 不支持 Tailwind 任意值语法 [xxx] 的编译错误
// (541 个规则如 .-bottom-[2px]{bottom:-2rpx} 被 WXSS parser 当作属性选择器报错)
// weapp-tailwindcss 同时处理 WXSS 选择器转义和 wxml class 匹配,保留全部样式
// 2026-09-10 编译器统一切 webpack5,vite 版插件换 webpack 版(见 mini.webpackChain)
import type { UserConfig } from 'vite'
import { WeappTailwindcss } from 'weapp-tailwindcss/webpack'
// RN 壳复用腿:把壳里的两个相对请求按"发起方是 RN 侧目录"这一条件换到端内真相源。
import { RnShellReplacePlugin } from './rn-shell-replace-plugin'

export default defineConfig(async (merge) => {
  // Taro CLI 在调用 config 前会用 --type 覆盖 process.env.TARO_ENV(见
  // node_modules/@tarojs/cli/src/cli.ts:66),此处读到的值即真实平台。
  // 显式 fallback 到 'weapp' 防御 shell 注入 TARO_ENV 但 --type 缺失的边界场景。
  const taroEnv = process.env.TARO_ENV || 'weapp'
  // 隔离构建落点(2026-09-26 立):共享 `dist/` 被 .gitignore 忽略、被多会话**共读**,一次"只为量产物"
  // 的取证构建把它换成另一形态(h5 覆盖 weapp 是既发事故,见 check-miniapp-css-landing 的 C1 头注),
  // 别人的读数就失真。设 IHUI_MINIAPP_OUTPUT_ROOT 即把整条产物链(含下方 copy.patterns)改道到私有目录;
  // **未设该变量时本行与改前逐字等值**。取值必须是 `.tmp-*` 形态(根 .gitignore:239 已忽略),
  // 不得让取证构建在端目录里长出新的未跟踪目录。
  const outputRoot =
    process.env.IHUI_MINIAPP_OUTPUT_ROOT || (taroEnv === 'alipay' ? 'dist-alipay' : 'dist')
  // 显式日志,排查"alipay 编译到 wechat dist"类问题(用户常因 WeChat IDE
  // 仍指向 ./dist 看到陈旧产物,误判本次编译走错目录)
  // eslint-disable-next-line no-console -- Taro 构建配置允许 console 输出诊断
  console.log(`\n[Taro Config] platform=${taroEnv} → outputRoot=${outputRoot}/\n`)

  const base = {
    projectName: 'ihui-miniapp',
    date: '2026-7-10',
    designWidth: 750,
    deviceRatio: { 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
    sourceRoot: 'src',
    outputRoot,
    plugins: [],
    defineConstants: {},
    // 2026-09-11 主包体积治理:关闭 Terser 的 ascii_only。
    // Taro webpack5-runner 在 MiniBaseConfig.js 里硬编码了 `output.ascii_only: true`
    // (见 @tarojs/webpack5-runner/dist/webpack/MiniBaseConfig.js:44),它会把所有
    // 非 ASCII 字符转义成 \uXXXX —— 中文因此按 6 字节/字 计费,而非 UTF-8 的 3 字节。
    // 实测 dist/common.js 里虚增了 194,424 个转义序列 ≈ 570KB。
    // 小程序 JS 文件本身就是 UTF-8,微信开发者工具与运行时都能正常处理原生中文,
    // 故设为 false:功能与视觉零变化,主包显著变小。
    // (Taro 支持用顶层 terser.config 覆盖其默认值,见 BaseConfig.setMinimizer 的 recursiveMerge)
    terser: {
      enable: true,
      config: {
        output: { ascii_only: false },
      },
    },
    copy: {
      patterns: [
        // 2026-09-26 主包余量治理(第四十三批):record_back.png(36,542 B)整目录随 `src/static/`
        // 进主包,而它**全部**引用点都在子包里(`pages/study/index.tsx`、`pkg-ai/ai/chat.tsx`)。
        // 主包 2 MB 是硬上限(改前实测余量 2,457 B),子包 20 MB 只用了 2.26 MB ⇒ 把它从主包
        // 的整目录拷贝里排除,改由下面两条"单一源 → 两份产物"派生到各自子包目录。
        // 源文件只有一份(`src/static/images/record_back.png`),不构成第二真相;
        // 两条 ignore/派生必须同批改:只排不派 = 端上图片 404 且不报错。
        {
          from: 'src/static/',
          to: `${outputRoot}/static/`,
          ignore: ['**/images/record_back.png'],
        },
        {
          from: 'src/static/images/record_back.png',
          to: `${outputRoot}/pages/study/assets/record_back.png`,
        },
        {
          from: 'src/static/images/record_back.png',
          to: `${outputRoot}/pkg-ai/assets/record_back.png`,
        },
        // 2026-09-26 同一票:排除 8 张**守门 105 自己判定"没有任何静态引用"**的 tabbar 图标
        // (`--worktree` 面 R2 逐条点名 agent/ai/share/square 的 normal+active 共 8 个,合计 15,022 B)。
        // 为什么是"打包侧排除"而不是删文件:本机 `git-guardian` 的"工作区存续自愈"每 2 分钟把
        // **未暂存的删除**按设计恢复(实测日志 11:56:08「恢复 9 个被外部删除的跟踪文件」),
        // 删除只有 `git rm` 才落得住;而本票不得做 git 写操作。源文件因此留在树里(不丢历史),
        // 只是不再占用主包。持有 `custom-tab-bar` 的人若要把它们清干净,`git rm` 后本条 ignore 即冗余无害。
        // 注意:`community/home/course/live/user` 那五对**不在**本清单里 —— 它们被停放中的
        // `src/custom-tab-bar/index.tsx` 引用,归该组件持有人一起处置(上一轮同类排查已记过这条边界)。
        {
          from: 'src/assets/tabbar/',
          to: `${outputRoot}/assets/tabbar/`,
          ignore: [
            '**/agent.png',
            '**/agent-active.png',
            '**/ai.png',
            '**/ai-active.png',
            '**/share.png',
            '**/share-active.png',
            '**/square.png',
            '**/square-active.png',
          ],
        },
        // 2026-09-12 主包体积治理:以下静态图只被对应分包页面用字符串路径引用,
        // 整目录下沉进分包避免占主包(约减 640KB)。default-avatar/default-agent/share
        // 因主包分包混用保留主包。
        { from: 'src/pages/member/assets/', to: `${outputRoot}/pages/member/assets/` },
        { from: 'src/pkg-learn/assets/', to: `${outputRoot}/pkg-learn/assets/` },
        { from: 'src/pkg-about/assets/', to: `${outputRoot}/pkg-about/assets/` },
        // 社群宣传卡(carte)两张图:与 RN 端 assets/images/carousel/ 同一副本(字节等值),
        // 只被 pkg-content/carte 一页引用 ⇒ 停放包 assets 目录并整目录派生,不占主包 2MB 硬上限。
        { from: 'src/pkg-content/assets/', to: `${outputRoot}/pkg-content/assets/` },
        { from: 'src/mini.project.json', to: `${outputRoot}/mini.project.json` },
        // 微信原生 darkmode:Taro vite-runner 从 src/theme.json 读取,copy 保证与 dist/app.json 同级(themeLocation 引用)
        { from: 'src/theme.json', to: `${outputRoot}/theme.json` },
        // 2026-09-10 字体仅 H5 使用(weapp 端 loadFontFace 已于 2026-07-27 移除,
        // 全仓零 url 引用),防止 7.4MB TTF 被默认 static 拷贝打进小程序主包。
        // H5 仍以 /static/fonts/ 路径提供,app.tsx 的 @font-face 无需改动。
        ...(taroEnv === 'h5'
          ? [{ from: 'src/assets/h5-fonts/', to: `${outputRoot}/static/fonts/` }]
          : []),
      ],
      options: {},
    },
    framework: 'react',
    // 2026-09-10 全平台统一 webpack5 编译器:
    // - H5: GitHub #17978/#18415 (custom-tab-bar 不输出)
    // - alipay: vite-runner `taro:vite-mini-emit-post` 的 Proxy.set 未防御
    //   chunk=undefined,而 @tarojs/plugin-platform-alipay 的
    //   generateBrowserslistConfig 会向 assets proxy 写入 bundle 中不存在的
    //   `.browserslistrc` key,触发 `Cannot read properties of undefined
    //   (reading 'type')`。webpack5 runner 的 modifyBuildAssets 实现支持
    //   新增 asset,故 alipay 走 webpack5 绕过此 bug。
    // - weapp:2026-09-10 从 Vite 切换。Vite runner 把公共 chunk(common.js
    //   2.5MB)全部打进主包且无法下沉,而微信主包 2MB 是硬上限;webpack5 配合
    //   mini.optimizeMainPackage 可把仅被分包引用的公共代码自动下沉分包。
    //   (2026-07-26 起 weapp 曾用 Vite 并注册 weapp-tailwindcss vite 插件处理
    //   Tailwind 任意值语法,切换后由 mini.webpackChain 注入 webpack 版插件,
    //   见下方 mini.webpackChain)
    // 对象形式禁用 prebundle:@tarojs/webpack5-prebundle@4.2.0 与 webpack 5.91.0 不兼容
    // (finalInputFileSystem._writeVirtualFile is not a function +
    //  enhanced-resolve options.roots.map is not a function)
    compiler: { type: 'webpack5', prebundle: { enable: false } },
    // 主包体积硬上限的成因,别开回 true(2026-09-26 实测,取证 .ihui-agent/tmp/mode3/samples.jsonl):
    // weapp-tailwindcss 每轮编译从 loader 运行态取"本轮 CSS 模块集"来决定 app 级整包注入还是逐页复制;
    // webpack 的文件系统缓存恢复 CSS 模块时**不重跑 loader 链** ⇒ 采集面为空。
    // 同一份配置三组对照:cache:true 热构建 12/12 落到"42 个页面 wxss 各复制一份整包"的漂移构型
    // (主包 +1,033,700 B ⇒ 直接越过微信 2,097,152 B 上限,且 app-origin.wxss 退回未加工副本);
    // 冷构建 1/1 与 cache:false 5/5 全部落在正常构型。
    // 注意:**把 app.css/tailwind.config 加进 buildDependencies 不解决问题** —— 漂移发生在
    // 零文件变更的连续构建之间,任何文件指纹都不会失效(实测否证,勿再试这条路)。
    cache: { enable: false },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
      // 与 mini 段同三条(h5 段不覆盖顶层 alias,但为防"平台段整体替换"的坑在此也备齐)
      'react-native$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'index.ts'),
      'lucide-react-native$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'icons-generated.tsx',
      ),
      '@ihui/rn-app': path.resolve(__dirname, '..', '..', '..', 'packages', 'app', 'src'),
      'react-native-safe-area-context$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'platform.tsx',
      ),
      '@react-navigation/native$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'navigation.tsx',
      ),
      '@react-navigation/native-stack$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'navigation.tsx',
      ),
      '@react-native-async-storage/async-storage$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'storage.ts',
      ),
      '@react-native-clipboard/clipboard$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'platform.tsx',
      ),
      'expo-image-picker$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'platform.tsx'),
      'expo-media-library$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'platform.tsx'),
      'expo-linking$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      'expo-web-browser$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      'expo-device$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      'react-native-restart$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      'expo-file-system$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      nativewind$: path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
      'react-native-svg$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-svg.tsx'),
      'react-native-webview$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'native-webview.tsx',
      ),
      'react-native-wechat-lib$': path.resolve(
        __dirname,
        '..',
        'src',
        'rn-compat',
        'native-wechat.ts',
      ),
      'expo-secure-store$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-secure.ts'),
    },
    mini: {
      es5: true,
      // ⚠️ 这一项刻意保持 false:设为 true 会把 mini-css-extract 的 "Conflicting order"
      // 整族吞掉,而它是跨 chunk group 的 CSS 相对次序不可满足 —— 掩住它等于让构建报绿而
      // 产物顺序仍是未定义(票 G-948)。真因已修:各入口对 `@/components` 桶文件(带出
      // PayPopup.css / LessonListItem.css)与 SkillsPopup(带出 CategoryBar.css)的 import
      // 次序已统一为「桶文件在前」,入口侧次序相反才是冲突源,不是选择器碰撞
      // (实测三份 CSS 彼此选择器零碰撞,插件只比 module 次序、不看声明内容)。
      // ⇒ 想再动这一项,先 `pnpm run build` 复跑并留证 Conflicting order 命中 0。
      miniCssExtractPluginOption: { ignoreOrder: false },
      // 2026-10-01 react 双实例白屏修复:workspace 同时存在 react@18.3.1(miniapp)与
      // react@19.2.8(shared 自带依赖)。@ihui/shared 的 TS 源码经 compile.include 编入
      // 小程序包,其 `import 'react'` 从 packages/shared 目录解析到 react@19,而 Taro
      // 小程序渲染器是 react@18 —— 18 的渲染器不会向 19 的 internals 注入 hooks
      // dispatcher ⇒ 所有 import @ihui/shared/hooks 的页面(login/register)渲染即抛
      // "Cannot read properties of null (reading 'useState')" ⇒ 整页白屏(index/about
      // 等不用 shared 的页面正常,故此前未暴露)。此处把 mini 端全部 react/react-dom
      // 解析强制收敛到 app 自己的 react@18;h5 端走 vite 自己的 dedupe(222 行),不受影响。
      alias: {
        // 注意:Taro 的平台段 alias 是整体替换、不与顶层 alias 合并 —— mini 段一旦
        // 声明 alias,必须把顶层 '@' 一并带齐(2026-10-01 实测:漏带时 '@/i18n' 会被
        // 当成 scoped 包 '@i18n' 解析而编译失败)。
        // react-dom 不能 alias:Taro 渲染器内部把 react-dom 指到 @tarojs/runtime-dom,
        // 强 alias 到物理包会打断这条链(2026-10-01 实测:含 react-dom 时全页白屏)。
        // 2026-10-26 跨端复用腿(AGENTS §4「一份平台无关组件源 + 平台 adapter」):
        // 共享屏源 packages/app 是 RN 形态(243 个文件 import react-native),此前小程序端
        // 0 处真实复用 ⇒ 每一枚要对齐的屏都得手写一份。把 react-native / lucide-react-native
        // 指到端内 rn-compat 兼容层,小程序页面即可直接 import 共享屏 —— 样式与功能随源头同步。
        // 端内自有代码不 import 这两个包(现读 0 处),alias 只作用于共享层的解析。
        '@': path.resolve(__dirname, '..', 'src'),
        react: path.resolve(__dirname, '..', 'node_modules', 'react'),
        'react-native$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'index.ts'),
        'lucide-react-native$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'icons-generated.tsx',
        ),
        '@ihui/rn-app': path.resolve(__dirname, '..', '..', '..', 'packages', 'app', 'src'),
        // RN 壳/共享层会引用的第三方原生包:一律指到端内 rn-compat 的等价实现(剪贴板/相册/
        // 选图/安全区共用一个文件,导航与存储各一个)。缺任何一条 = 该屏在 mini 端编译失败。
        '@react-navigation/native$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'navigation.tsx',
        ),
        '@react-navigation/native-stack$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'navigation.tsx',
        ),
        '@react-native-async-storage/async-storage$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'storage.ts',
        ),
        '@react-native-clipboard/clipboard$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'platform.tsx',
        ),
        'expo-image-picker$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'platform.tsx'),
        'expo-media-library$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'platform.tsx'),
        'expo-linking$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        'expo-web-browser$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        'expo-device$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        'react-native-restart$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        'expo-file-system$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        nativewind$: path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-extras'),
        'react-native-svg$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-svg.tsx'),
        'react-native-webview$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'native-webview.tsx',
        ),
        'react-native-wechat-lib$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'native-wechat.ts',
        ),
        'expo-secure-store$': path.resolve(__dirname, '..', 'src', 'rn-compat', 'native-secure.ts'),
        'react-native-safe-area-context$': path.resolve(
          __dirname,
          '..',
          'src',
          'rn-compat',
          'platform.tsx',
        ),
        // RN 壳目录:小程序页面以 `@rn-shells/<Name>` 直接承载 RN 壳 —— 现读 98 枚跨端缺口里
        // 96 枚的必填 props 是数据/状态(error/item/loading),那段胶水 RN 壳已经写好;
        // 端内只包一层 ThemeRoot。取词与主题由下面 rnShellReplacements 接回端内真相源。
        '@rn-shells': path.resolve(
          __dirname,
          '..',
          '..',
          '..',
          'apps',
          'mobile-rn',
          'src',
          'screens',
        ),
      },
      // 2026-09-10 主包 2MB 硬上限治理:把仅被分包引用的公共 chunk 自动
      // 下沉到分包,避免 common.js 整体压在主包(webpack5 编译器专属能力)
      // 2026-10-16 关掉:开着它 `build:weapp` 整轮出不了产物 —— Taro 4.2 的 MiniCombination
      // 自带 cacheGroups.common(name:'common'),与 optimizeMainPackage 造出的同名 chunk 相撞,
      // webpack 判 `Cache group "common" conflicts with existing chunk` 直接中止(dev/prod 两档同红)。
      // 关掉后用本仓自己的门量过:`node scripts/check-artifact-budget.mjs --target miniapp` ⇒ ✅ 预算内
      // (主包 1,524,667 B / 上限 2,097,152 B,余量 572,485 B)。要翻回 true 必须先解掉那条同名相撞,
      // 且重跑预算门取现值,不得拿本行旧数当依据。
      optimizeMainPackage: { enable: true },
      postcss: {
        pxtransform: { enable: true, config: {} },
        tailwindcss: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      // (weapp + alipay)webpack5 编译器,需让 babel-loader 处理 @ihui/* workspace 包 TS 源码
      // (这些包 main 字段直接指向 src/*.ts,未预编译,默认 babel-loader exclude 会跳过)
      // 项目无 babel.config.js,需在 babel-loader 程序化注入 babel-preset-taro
      // (与 H5 同模式,但 mini 端不配置 splitChunks/runtimeChunk: 小程序对
      // 异步 chunk 数量与 import() 加载有限制,保留 Taro 默认打包策略)
      ...(process.env.TARO_ENV !== 'h5'
        ? {
            compile: {
              // worktree/代理作业环境(2026-10-14):node_modules 经 junction 复用主仓,
              // @ihui/* 的 workspace symlink 被 webpack realpath 到主仓物理路径,字面
              // packages 路径盖不住 ⇒ TS 源落入"无 loader"解析错(ModuleParseError:
              // interface JWTPayload)。此处取 @ihui/shared 的 realpath 作第二包根,
              // 两根一并入列;主仓单仓时 realpath 即字面同值,Set 去重后逐字等价。
              include: (() => {
                const pkgs = ['api-client', 'design-tokens', 'i18n', 'shared', 'types', 'app']
                const literalRoot = path.resolve(__dirname, '..', '..', '..', 'packages')
                let realRoot = literalRoot
                try {
                  realRoot = path.dirname(
                    require('fs').realpathSync(
                      path.resolve(__dirname, '..', 'node_modules', '@ihui', 'shared'),
                    ),
                  )
                } catch {
                  // 解析失败(无 junction 的非常规布局)只保留字面根,与改前一致
                }
                return [
                  ...new Set(
                    pkgs.flatMap((p) => [
                      path.join(literalRoot, p, 'src'),
                      path.join(realRoot, p, 'src'),
                    ]),
                  ),
                  // 壳复用腿:RN 壳目录也在 mini 编译面里(未预编译的 TS 源,默认 exclude 会
                  // 让它落进"无 loader"而 ModuleParseError;与 @ihui/* 同一条处理法)
                  path.resolve(__dirname, '..', '..', '..', 'apps', 'mobile-rn', 'src'),
                ]
              })(),
            },
            webpackChain: (chain: any) => {
              chain.module
                .rule('script')
                .use('babelLoader')
                .tap((options: any) => ({
                  ...options,
                  presets: [['taro', { framework: 'react', ts: true, compiler: 'webpack5' }]],
                }))
              // packages/shared 里存在 `.js` 后缀的相对导入(ESM 写法,如
              // `../chat/projection-watermark.js` 指向同名 .ts 源)。webpack 默认按字面后缀找文件,
              // 不加 extensionAlias 时 build:weapp 直接解析失败(2026-10-18 实测:缺这条时
              // `resolve '../chat/projection-watermark.js'` 报 no extension / .js / .ts 全不存在)。
              chain.resolve.set('extensionAlias', {
                '.js': ['.ts', '.tsx', '.js'],
                '.mjs': ['.mts', '.mjs'],
              })
              // 2026-10-26 RN 壳复用腿的注入点。判据按"发起方在 apps/mobile-rn/src/ 里"生效,
              // 端内自己那条 `../i18n`(src/api/index.ts)不受影响;落点是端内已有真相源,
              // 不建第二套取词/主题(§0.6)。RN 侧 ThemeContext 自带 NativeWind 与 AsyncStorage
              // transport,小程序无对应物 ⇒ 必须换而不是硬编(机制与理由见 config/rn-shell-replace-plugin.ts)。
              chain.plugin('rnShellReplacements').use(RnShellReplacePlugin, [
                [
                  // base = RN 侧真相源模块的绝对路径(不含扩展名)。判"解析到哪模块",不判请求写法 ——
                  // 词包与主题是端内单一真相源,RN 那份内联 10 个 JSON catalog,漏一条就把整包拖进页面分块。
                  {
                    base: path.resolve(
                      __dirname,
                      '..',
                      '..',
                      '..',
                      'apps',
                      'mobile-rn',
                      'src',
                      'i18n',
                    ),
                    to: path.resolve(__dirname, '..', 'src', 'rn-compat', 'i18n.ts'),
                  },
                  {
                    base: path.resolve(
                      __dirname,
                      '..',
                      '..',
                      '..',
                      'apps',
                      'mobile-rn',
                      'src',
                      'context',
                      'ThemeContext',
                    ),
                    to: path.resolve(__dirname, '..', 'src', 'rn-compat', 'theme.tsx'),
                  },
                ],
                'apps/mobile-rn/src/',
              ])
              // weapp 端注入 weapp-tailwindcss webpack 版插件(2026-09-10 自 vite
              // 版迁移):处理 Tailwind 任意值语法 [xxx] 的 WXSS 选择器转义 +
              // wxml class 匹配 + rem2rpx。v5.2.9 webpack 入口导出同名类,
              // .use(类, [参数]) 由 webpack-chain 负责 new。alipay 不注入(保持原状)。
              // cssEntries:入口 CSS 除了"被项目 import"之外还必须**显式告诉插件** —— 包自己的 README 原话是
              // "Tailwind CSS 4 项目中,入口 CSS 需要同时满足两点:在项目里被实际引入,并通过 cssEntries
              // 显式传给插件用于稳定识别"。不传的实测后果(2026-09-26,同一份仓库配置三次构建):
              // 插件的 class set 采集靠在本轮编译里"发现"那个 CSS 模块,发现不到时 **CSS 选择器照转写、
              // JS/WXML 侧一个名都不改** ⇒ 485 条 utility 变成谁也挂不上的死规则,而构建仍然 exit 0。
              // 由守门 check-miniapp-css-landing 的 C5(转写腿活性)结构性接住,不再靠人眼看覆盖率。
              if (process.env.TARO_ENV === 'weapp') {
                // 让道(2026-10-26 实测:`Cache group "common" conflicts with existing chunk`):
                // Taro 的 MiniCombination 内置一个 cacheGroups.common(产物 dist/common.js),
                // 而 optimizeMainPackage 也要造名为 common 的下沉 chunk ⇒ 同名相撞,webpack 直接中止。
                // 只改这枚内置组的 **name**(不动 test/priority/minChunks)⇒ 产物改名,
                // 把 'common' 这个名字让给 optimizeMainPackage 去做"只被分包引用则下沉"这件事。
                const sc: any = chain.optimization.get('splitChunks')
                if (sc && sc.cacheGroups && sc.cacheGroups.common) {
                  // 只删 name,不替换成新名字:实测改成 'taro-base-common' 会撞上
                  // 「existing chunk is not a parent of the selected modules」—— 那个同名 chunk
                  // 是 Taro 自己按 entry 造出来的。webpack5 明确 HINT「You can omit name to
                  // automatically create a name」⇒ 交给 webpack 自动命名,把 'common' 让给下沉组。
                  delete sc.cacheGroups.common.name
                  chain.optimization.splitChunks(sc)
                  console.info(
                    '[miniapp] cacheGroups.common 的固定名已摘除(交给 webpack 自动命名,给 optimizeMainPackage 让道)',
                  )
                } else {
                  console.info(
                    `[miniapp] 未见 cacheGroups.common(现读键:${Object.keys(sc?.cacheGroups ?? {}).join(',') || '无 splitChunks'})`,
                  )
                }
                chain.plugin('weappTailwindcss').use(WeappTailwindcss, [
                  {
                    rem2rpx: true,
                    injectAdditionalCssVarScope: true,
                    cssEntries: [path.resolve(__dirname, '..', 'src/app.css')],
                  },
                ])
              }
            },
          }
        : {}),
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: { filename: 'js/[name].[hash:8].js', chunkFilename: 'js/[name].[chunkhash:8].js' },
      miniCssExtractPluginOption: {
        // 同 mini 段:保持 false,理由见 mini 段那组注释(票 G-948)。
        ignoreOrder: false,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      vite: {
        resolve: {
          dedupe: ['react', 'react-dom', '@tarojs/runtime', '@tarojs/runtime-dom'],
        },
      },
      // webpack5 编译器需让 babel-loader 处理 @ihui/* workspace 包的 TS 源码
      // (这些包 main 字段直接指向 src/*.ts,未预编译)
      compile: {
        include: [
          path.resolve(__dirname, '..', '..', '..', 'packages', 'api-client', 'src'),
          path.resolve(__dirname, '..', '..', '..', 'packages', 'design-tokens', 'src'),
          path.resolve(__dirname, '..', '..', '..', 'packages', 'i18n', 'src'),
          path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src'),
          path.resolve(__dirname, '..', '..', '..', 'packages', 'types', 'src'),
          path.resolve(__dirname, '..', '..', '..', 'packages', 'app', 'src'),
        ],
      },
      // 项目无 babel.config.js，webpack5 编译器需在 babel-loader 程序化注入 babel-preset-taro
      // (程序化选项对所有文件生效，含 packages/* 的 TS 源码)
      // 同时配置 splitChunks + runtimeChunk 拆分主 bundle（2026-07-26 体积优化）:
      // - vendors: 初始入口依赖的 node_modules（react/react-dom/@tarojs/* 等），chunks:'initial'
      //   仅抽取初始包 vendor，避免把异步页面专属 vendor 拖入首屏
      // - ihui-packages: 初始入口依赖的 monorepo workspace 包（@ihui/* TS 源码）
      // - common: 跨≥2 个异步 chunk 共享的业务代码，仅作用于 async 包，不影响首屏
      // - runtime: webpack 运行时单独抽出，利于长缓存
      // 优化前 app.js 单文件 823 KiB（含全部 vendor + runtime），优化后主 bundle 显著下降
      webpackChain: (chain: any) => {
        chain.module
          .rule('script')
          .use('babelLoader')
          .tap((options: Record<string, unknown>) => ({
            ...options,
            presets: [['taro', { framework: 'react', ts: true, compiler: 'webpack5' }]],
          }))
        chain.optimization.runtimeChunk('single')
        chain.optimization.splitChunks({
          chunks: 'async',
          maxAsyncRequests: 10,
          maxInitialRequests: 5,
          automaticNameDelimiter: '~',
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'initial',
              priority: 20,
              reuseExistingChunk: true,
            },
            ihuiPackages: {
              test: /[\\/]packages[\\/][^/]+[\\/]src[\\/]/,
              name: 'ihui-packages',
              chunks: 'initial',
              priority: 15,
              reuseExistingChunk: true,
            },
            common: {
              name: 'common',
              chunks: 'async',
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        })
        // 彻底删除 react-refresh-webpack-plugin 插件（H5 模式下远程图片加载
        // 失败会触发 unhandledrejection 被 react-refresh overlay 捕获遮挡页面）
        // 注意: 单纯 tap([options]) => [{...options, overlay:false}] 在该版本
        // plugin(0.5+) 不生效——overlay 由 ErrorOverlay 子模块独立注入,需直接删除
        // 整个插件才能彻底关闭。HMR 热更新对开发体验提升有限,代价是遮挡页面
        // 不可接受。
        if (chain.plugins.has('ReactRefreshPlugin')) {
          chain.plugins.delete('ReactRefreshPlugin')
        }
      },
      postcss: {
        autoprefixer: { enable: true, config: {} },
        tailwindcss: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    rn: { appName: 'ihui-miniapp', postcss: { cssModules: { enable: false } } },
  }
  return merge(
    {},
    base,
    process.env.NODE_ENV === 'development' ? devConfig : prodConfig,
  ) as unknown as UserConfig & Record<string, unknown>
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
