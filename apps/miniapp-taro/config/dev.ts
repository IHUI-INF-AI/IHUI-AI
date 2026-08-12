export default {
  logger: { quiet: false, stats: true },
  mini: {},
  h5: {
    devServer: {
      port: 8804,
      host: '0.0.0.0',
      // 完全关闭 webpack-dev-server 的 error overlay
      // (H5 模式下网络请求/图片加载等异步错误由业务层自行 toast 提示)
      client: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8802',
          changeOrigin: true,
          secure: false,
        },
        '/crash-reports': {
          target: 'http://localhost:8802',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
}
