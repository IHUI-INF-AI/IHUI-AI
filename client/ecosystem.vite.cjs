module.exports = {
  apps: [
    {
      name: 'vite-client',
      cwd: 'G:/IHUI-AI/client',
      script: 'G:/IHUI-AI/client/node_modules/.bin/vite.cmd',
      args: '--port 8888 --strictPort --host 127.0.0.1',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        BUILD_PLATFORM: 'web',
      },
      autorestart: true,
      max_restarts: 5,
      min_uptime: '20s',
      out_file: 'G:/IHUI-AI/client/dev-server.log',
      error_file: 'G:/IHUI-AI/client/dev-server-err.log',
    },
  ],
}
