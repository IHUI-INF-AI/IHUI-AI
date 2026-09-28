// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 桌面端偏好的跨设备漫游存储(需登录)。前缀 /api(注册方见 routes/index.ts),路径 /desktop/prefs。
//
// 定位:桌面端那份 Rust 侧本地文件才是偏好的**权威值**;本表只在用户显式开启漫游时
// 存一份账号级副本。端上离线或未登录时一律回落本地值,所以服务端**不解释** prefs 的
// 语义 —— 形状、档位、校验全部来自 `packages/types/src/desktop-prefs.ts` 那一份定义。
//
// 鉴权面纪律(AGENTS §5):整棵子树走 preHandler authenticate 强制登录,不进任何公开名单,
// 也不使用 `/api/desktop/[^/]+` 这类会把静态子路由一起放行的参数正则。
//
// 认证 ≠ 授权(AGENTS §5「"已登录"不等于"可以动这条数据"」):读写两侧的归属条件都落在
// **被发出的那条 SQL 上** —— 读是 `where(eq(userId, request.userId!))`,写是"以 userId 为
// 冲突键的 upsert"。调用方**没有**传 userId 的入口:请求体里那个键位不存在(见下方 schema),
// 所以别人的行既读不到也写不动。回报的状态取自 `.returning()` 的库侧确认行,不是请求侧常量。
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { desktopPrefs } from '@ihui/database'
import { checkDesktopPrefs, projectDesktopPrefsPayload } from '@ihui/types'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { buildResponseSchema } from '../utils/api-schemas.js'

/**
 * 请求体信封。
 *
 * `prefs` 刻意用 `z.unknown()`:档位与字段名由 `checkDesktopPrefs` 那一份判据管,
 * 这里再写一遍 zod 对象就是第二个真相源。`z.object` 默认剥掉未声明的键,所以
 * 客户端塞 `userId` / `id` 之类的把手进 body 也进不了 SQL —— 身份只从令牌主体来。
 */
const bodySchema = z.object({
  enabled: z.boolean(),
  prefs: z.unknown().optional(),
})

type DesktopPrefsRow = { enabled: boolean; prefs: unknown }

/** 以 userId 为唯一键的幂等 upsert,回库侧确认后的那一行。 */
async function writeDesktopPrefs(
  userId: string,
  enabled: boolean,
  prefs: DesktopPrefsRow['prefs'],
): Promise<DesktopPrefsRow> {
  const rows = await db
    .insert(desktopPrefs)
    .values({ userId, enabled, prefs })
    .onConflictDoUpdate({
      target: desktopPrefs.userId,
      set: { enabled, prefs, updatedAt: new Date() },
    })
    .returning({ enabled: desktopPrefs.enabled, prefs: desktopPrefs.prefs })
  // 库里回不来行就不是"写成功了":宁可抛给全局错误处理,也不拿请求侧常量冒充落库结论。
  const confirmed = rows[0]
  if (!confirmed) throw new Error('desktop_prefs upsert 未确认落库')
  return confirmed
}

export const desktopPrefsRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权:两个端点都要登录态。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // GET /desktop/prefs - 当前用户的漫游配置。没开过漫游(库里无行)也回 200,
  // 形态与"开了又关掉"一致:{ enabled:false, prefs:null },端上据此回落本地值。
  server.get(
    '/desktop/prefs',
    {
      schema: {
        summary: '读取桌面端偏好漫游配置',
        tags: ['desktop'],
        response: buildResponseSchema(401),
      },
    },
    async (request, reply) => {
      const rows = await db
        .select({ enabled: desktopPrefs.enabled, prefs: desktopPrefs.prefs })
        .from(desktopPrefs)
        .where(eq(desktopPrefs.userId, request.userId!))
      return reply.send(success(projectDesktopPrefsPayload(rows[0])))
    },
  )

  // PUT /desktop/prefs - 幂等 upsert(一人一行)。
  //   enabled:true  ⇒ prefs 必须是合法对象,落库存下来。
  //   enabled:false ⇒ 关掉漫游并把 prefs 一并清掉:留着旧载荷会变成"开关是关的、
  //                   数据还是活的"那种半状态,下次误开就把过期值当现值推下去了。
  //                   回报的是库侧确认行的状态,不谎报"删了行"(这一趟不删行)。
  server.put(
    '/desktop/prefs',
    {
      schema: {
        summary: '写入桌面端偏好漫游配置',
        tags: ['desktop'],
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const userId = request.userId!

      if (!parsed.data.enabled) {
        const confirmed = await writeDesktopPrefs(userId, false, null)
        return reply.send(success(projectDesktopPrefsPayload(confirmed)))
      }

      const check = checkDesktopPrefs(parsed.data.prefs)
      if (!check.ok) {
        return reply.status(400).send(error(400, check.reason))
      }
      const confirmed = await writeDesktopPrefs(userId, true, check.value)
      return reply.send(success(projectDesktopPrefsPayload(confirmed)))
    },
  )
}
