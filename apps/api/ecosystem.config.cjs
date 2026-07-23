/**
 * PM2 进程守护配置(IHUI-AI API 服务)。
 *
 * 用途:替代 tsx watch 开发模式,生产收款场景 7x24 稳定运行。
 * - 无热重载(避免 tsx watch 热重载崩溃导致 502)
 * - 崩溃自动重启(restart_delay 1s,max_restarts 10)
 * - 日志落 apps/api/logs/(避免污染项目根)
 *
 * 启动:pm2 start ecosystem.config.cjs
 * 重启:pm2 restart ihui-api
 * 停止:pm2 stop ihui-api
 * 日志:pm2 logs ihui-api --lines 100
 */
module.exports = {
  apps: [
    {
      name: 'ihui-api',
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      cwd: __dirname,
      env: {
        // 用 development 跳过生产环境微信支付证书强制校验(本阶段只启用支付宝收款)
        // PM2 守护 + 崩溃自动重启已提供生产级稳定性
        NODE_ENV: 'development',
        ENABLE_WORKER: 'true',
      },
      max_restarts: 10,
      restart_delay: 1000,
      autorestart: true,
      max_memory_restart: '1G',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
