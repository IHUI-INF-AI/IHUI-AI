import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'
import path from 'path'

export default defineConfig(async (merge) => {
  const outputRoot = process.env.TARO_ENV === 'alipay' ? 'dist-alipay' : 'dist'
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
    compiler: process.env.TARO_ENV === 'h5' || process.env.TARO_ENV === 'alipay'
      // 对象形式禁用 prebundle:@tarojs/webpack5-prebundle@4.2.0 与 webpack 5.91.0 不兼容
      // (finalInputFileSystem._writeVirtualFile is not a function +
      //  enhanced-resolve options.roots.map is not a function)
      ? { type: 'webpack5', prebundle: { enable: false } }
      : 'vite',
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
              chain.module.rule('script').use('babelLoader').tap((options: any) => ({
                ...options,
                presets: [
                  ['taro', { framework: 'react', ts: true, compiler: 'webpack5' }],
                ],
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
        chain.module.rule('script').use('babelLoader').tap((options: any) => ({
          ...options,
          presets: [
            ['taro', { framework: 'react', ts: true, compiler: 'webpack5' }],
          ],
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
