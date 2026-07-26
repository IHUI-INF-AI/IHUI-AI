import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'
import path from 'path'
// 2026-07-26 修复 WXSS 不支持 Tailwind 任意值语法 [xxx] 的编译错误
// (541 个规则如 .-bottom-[2px]{bottom:-2rpx} 被 WXSS parser 当作属性选择器报错)
// weapp-tailwindcss 同时处理 WXSS 选择器转义和 wxml class 匹配,保留全部样式
import type { Plugin } from 'vite'
import tailwindcss from 'tailwindcss'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'

export default defineConfig(async (merge) => {
  // Taro CLI 在调用 config 前会用 --type 覆盖 process.env.TARO_ENV(见
  // node_modules/@tarojs/cli/src/cli.ts:66),此处读到的值即真实平台。
  // 显式 fallback 到 'weapp' 防御 shell 注入 TARO_ENV 但 --type 缺失的边界场景。
  const taroEnv = process.env.TARO_ENV || 'weapp'
  const outputRoot = taroEnv === 'alipay' ? 'dist-alipay' : 'dist'
  // 显式日志,排查"alipay 编译到 wechat dist"类问题(用户常因 WeChat IDE
  // 仍指向 ./dist 看到陈旧产物,误判本次编译走错目录)
  // eslint-disable-next-line no-console
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
    copy: {
      patterns: [
        { from: 'src/static/', to: `${outputRoot}/static/` },
        { from: 'src/assets/tabbar/', to: `${outputRoot}/assets/tabbar/` },
        { from: 'src/mini.project.json', to: `${outputRoot}/mini.project.json` },
      ],
      options: {},
    },
    framework: 'react',
    // H5 + alipay 切 webpack5 编译器规避 Taro 4.2.0 Vite runner 缺陷:
    // - H5: GitHub #17978/#18415 (custom-tab-bar 不输出)
    // - alipay: vite-runner `taro:vite-mini-emit-post` 的 Proxy.set 未防御
    //   chunk=undefined,而 @tarojs/plugin-platform-alipay 的
    //   generateBrowserslistConfig 会向 assets proxy 写入 bundle 中不存在的
    //   `.browserslistrc` key,触发 `Cannot read properties of undefined
    //   (reading 'type')`。webpack5 runner 的 modifyBuildAssets 实现支持
    //   新增 asset,故 alipay 走 webpack5 绕过此 bug。
    // weapp 等其他端继续用 Vite (已验证 100+ 页面正常)
    // 2026-07-26 weapp 端 vite 注册 weapp-tailwindcss 插件,处理 Tailwind 任意值
    // 语法 [xxx] 在 WXSS 中的转义问题(WXSS parser 把 [2px] 当属性选择器报错)
    compiler:
      process.env.TARO_ENV === 'h5' || process.env.TARO_ENV === 'alipay'
        ? // 对象形式禁用 prebundle:@tarojs/webpack5-prebundle@4.2.0 与 webpack 5.91.0 不兼容
          // (finalInputFileSystem._writeVirtualFile is not a function +
          //  enhanced-resolve options.roots.map is not a function)
          { type: 'webpack5', prebundle: { enable: false } }
        : {
            type: 'vite',
            vitePlugins: [
              // Taro 4 vite 不读 postcss.config.js,需程序化注入 tailwindcss postcss 插件
              {
                name: 'postcss-config-loader-plugin',
                config(config: any) {
                  if (typeof config.css?.postcss === 'object') {
                    config.css?.postcss?.plugins?.unshift(tailwindcss())
                  }
                },
              },
              // weapp-tailwindcss:同时处理 WXSS 选择器转义和 wxml class 匹配
              // 让 .-bottom-[2px] 在 WXSS 中编译通过且 wxml class 匹配生效
              // 返回值为 WeappTailwindcssVitePlugin[],用展开运算符注入
              ...(WeappTailwindcss({
                rem2rpx: true,
                // 仅 weapp 端启用,其他端(h5/rn/harmony)禁用
                disabled: ['h5', 'rn', 'harmony'].includes(process.env.TARO_ENV || ''),
                // Taro vite 默认移除 tailwindcss CSS 变量,需重新注入
                injectAdditionalCssVarScope: true,
              }) as unknown as Plugin[]),
            ],
          },
    cache: { enable: true },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    mini: {
      es5: true,
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
      // alipay 切 webpack5 后,需让 babel-loader 处理 @ihui/* workspace 包 TS 源码
      // (这些包 main 字段直接指向 src/*.ts,未预编译,默认 babel-loader exclude 会跳过)
      // 项目无 babel.config.js,需在 babel-loader 程序化注入 babel-preset-taro
      // (与 H5 同模式,但 mini 端不配置 splitChunks/runtimeChunk: 小程序对
      // 异步 chunk 数量与 import() 加载有限制,保留 Taro 默认打包策略)
      ...(process.env.TARO_ENV === 'alipay'
        ? {
            compile: {
              include: [
                path.resolve(__dirname, '..', '..', '..', 'packages', 'api-client', 'src'),
                path.resolve(__dirname, '..', '..', '..', 'packages', 'design-tokens', 'src'),
                path.resolve(__dirname, '..', '..', '..', 'packages', 'i18n', 'src'),
                path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src'),
                path.resolve(__dirname, '..', '..', '..', 'packages', 'types', 'src'),
              ],
            },
            webpackChain: (chain: any) => {
              chain.module
                .rule('script')
                .use('babelLoader')
                .tap((options: any) => ({
                  ...options,
                  presets: [['taro', { framework: 'react', ts: true, compiler: 'webpack5' }]],
                }))
            },
          }
        : {}),
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: { filename: 'js/[name].[hash:8].js', chunkFilename: 'js/[name].[chunkhash:8].js' },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
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
          .tap((options: any) => ({
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
  return merge({}, base, process.env.NODE_ENV === 'development' ? devConfig : prodConfig)
})
