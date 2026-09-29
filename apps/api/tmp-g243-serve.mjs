// 手工证据用的最小 HTTP 壳：路由与真值解析全部走 apps/api/src/routes/app-version.ts 本体。
// 不连库：只注册路由并注入请求，min-cli-version 这一条不碰 db（db 仅 /latest 等端点用）。
import Fastify from 'fastify';
import appVersionRoutes from '../../../apps/api/src/routes/app-version.ts';

const app = Fastify({ logger: false });
await app.register(appVersionRoutes, { prefix: '/api/app-version' });
await app.listen({ host: '127.0.0.1', port: 59123 });
console.log('listening on 59123');
