import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import compress from '@fastify/compress';

/**
 * Gzip/Brotli 压缩插件。
 * - 全局启用，对超过阈值（默认 1KB）的响应自动压缩
 * - 优先 Brotli（压缩率更高），回退 gzip/deflate
 * - 跳过已压缩内容类型（图片/视频/已压缩归档）
 * - 压缩可显著降低带宽，提升首字节后传输速度
 */
const compressionPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  await server.register(compress, {
    global: true,
    threshold: 1024, // 仅压缩 > 1KB 的响应
    encodings: ['br', 'gzip', 'deflate'],
  });
};

export default fp(compressionPlugin, {
  name: 'compression-plugin',
  fastify: '5.x',
});
