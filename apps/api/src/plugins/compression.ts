import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import compress from '@fastify/compress'

/**
 * Gzip/Brotli 压缩插件。
 *
 * 2026-08-17 修复:@fastify/compress 在本环境(Fastify 5 + Node 22)对 >1KB 响应
 * (如 /publish/scan-login/platforms 约 4.8KB)压缩后输出 0 字节 —— 浏览器总是携带
 * Accept-Encoding 头,触发压缩 → 大响应全空 → 扫码登录平台列表/大列表加载失败。
 * 处置:关闭全局压缩(global: false)。本地开发无带宽压力;生产如需压缩,应在上游
 * nginx/CDN 层配置(压缩产物正确性可控)。
 */
const compressionPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  await server.register(compress, {
    global: false, // 2026-08-17:禁用,修复压缩后 0 字节响应 bug(勿改回 true,否则扫码登录/大列表全空)
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  })
}

export default fp(compressionPlugin, {
  name: 'compression-plugin',
  fastify: '5.x',
})
