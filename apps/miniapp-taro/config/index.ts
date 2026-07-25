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
    // H5 切 webpack5 编译器规避 Taro 4.2.0 Vite runner 缺陷 (GitHub #17978/#18415)
    // weapp 等其他端继续用 Vite (已验证 100+ 页面正常)
    compiler: process.env.TARO_ENV === 'h5' ? 'webpack5' : 'vite',
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
      webpackChain: (chain: any) => {
        chain.module.rule('script').use('babelLoader').tap((options: any) => ({
          ...options,
          presets: [
            ['taro', { framework: 'react', ts: true, compiler: 'webpack5' }],
          ],
        }))
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
