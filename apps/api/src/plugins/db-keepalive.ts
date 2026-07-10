import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

const KEEPALIVE_INTERVAL_MS = 30_000;

/**
 * 数据库连接保活插件。
 * 每 30 秒执行一次 SELECT 1,检测连接可用性。
 * 连接失败时记录 error 日志,恢复时记录 info 日志。
 */
const dbKeepalivePlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  let isAlive = true;
  let consecutiveFailures = 0;

  const timer = setInterval(async () => {
    try {
      await db.execute(sql`SELECT 1`);
      if (!isAlive || consecutiveFailures > 0) {
        server.log.info('database connection restored');
      }
      isAlive = true;
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      isAlive = false;
      server.log.error({ err, consecutiveFailures }, 'database keepalive failed');
    }
  }, KEEPALIVE_INTERVAL_MS);

  timer.unref();

  server.decorate('dbKeepalive', {
    get isAlive() {
      return isAlive;
    },
    get failures() {
      return consecutiveFailures;
    },
  });

  server.addHook('onClose', async () => {
    clearInterval(timer);
  });
};

export const dbKeepalive = fp(dbKeepalivePlugin, {
  name: 'db-keepalive',
  fastify: '5.x',
});

declare module 'fastify' {
  interface FastifyInstance {
    dbKeepalive: {
      readonly isAlive: boolean;
      readonly failures: number;
    };
  }
}
