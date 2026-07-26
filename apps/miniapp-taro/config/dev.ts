export default {
  logger: { quiet: false, stats: true },
  mini: {},
  h5: {
    devServer: {
      port: 8804,
      host: '0.0.0.0',
      // H5 dev 代理:浏览器从 localhost:8804 发请求,转发到后端 8802
      // 规避 Windows IPv6 ::1 解析问题(浏览器 fetch localhost 走 IPv6,后端监听 IPv4)
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8802',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
}
