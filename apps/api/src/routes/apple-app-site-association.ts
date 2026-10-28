// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /.well-known/apple-app-site-association —— iOS / 微信 Universal Link 校验端点。
 *
 * **这个文件曾经不存在,但 routes/index.ts:519 已经在 import 它。**
 * 成因(2026-10-28 查实):cd348dc320c「chore(auto): 收编停留≥3分钟的未提交改动」
 * 把 index.ts 里的 `appleAppSiteAssociationRoutes` 引用收进了版本库,而实现文件
 * 当时只是工作树里的未跟踪文件,没有被一起收编,随后又被清理掉 ⇒
 * 版本库进入"引用存在、模块不存在"状态。这与 6fb5624be51 修过的
 * relay-switch-admin 是同一个故障模式,只是那次是挂载、这次是 import。
 *
 * 影响面:api 用 ESM 静态 import 加载 routes/index.ts,模块缺失会让 **整个 API
 * 启动崩溃**(不只是这个端点 404),而 prod 目录当时停在旧 HEAD 才没暴露。
 *
 * 实现与 web 侧 apps/web/app/.well-known/apple-app-site-association/route.ts 同源,
 * 共同读 @ihui/shared/constants 的 buildAppleAppSiteAssociation —— 两端吐同一份 AASA。
 *
 * Apple 硬性要求:路径不能带扩展名,Content-Type 必须 application/json。
 */
import type { FastifyPluginAsync } from 'fastify'
import {
  APPLE_APP_SITE_ASSOCIATION_CACHE_CONTROL,
  buildAppleAppSiteAssociation,
} from '@ihui/shared/constants'

export const appleAppSiteAssociationRoutes: FastifyPluginAsync = async (server) => {
  server.get('/.well-known/apple-app-site-association', async (_request, reply) => {
    // 每次请求现算而不在模块顶层求值:env 可能由 dotenv 在插件注册之后才注入,
    // 顶层求值会永久钉住首次读到的空 Team ID(fail-visible 占位符)。
    const aasa = buildAppleAppSiteAssociation(process.env)

    return reply
      .header('content-type', 'application/json; charset=utf-8')
      .header('cache-control', APPLE_APP_SITE_ASSOCIATION_CACHE_CONTROL)
      .send(aasa)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
