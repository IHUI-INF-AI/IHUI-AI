// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开面单一真相源的回归锁(BUG-4, 2026-11-06 立)。
 *
 * 缺陷形状:兜底鉴权闸 / 租户隔离绕过 / 网络分段三处各写一份"公开面"清单,
 * 且两种匹配语义并存 —— 两处用裸 `startsWith`(无段边界),一处用 `matchesPrefix`。
 * 后果:漏登记一处整链 401,多登记则相邻未注册路径被预留免鉴权。
 *
 * 本文件钉四件事:
 *   S1 三个维度的清单**同住一模块、共用一把尺**(单一真相源,不再三文件各漂各的);
 *   S2 段边界安全:`/api/agents` 绝不顺带放过 `/api/agentsXYZ`;
 *   S3 精确集合与前缀集合不混:`/` 只属精确集合,不得退化成"匹配一切";
 *   S4 三份清单语义**故意不合并**:`/api/settings` 可免租户但仍需登录。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTH_PUBLIC_EXACT_PATHS,
  AUTH_PUBLIC_PREFIX_PATHS,
  TENANT_BYPASS_PREFIX_PATHS,
  NETWORK_PUBLIC_PREFIX_PATHS,
  isAuthPublicPath,
  isTenantBypassPath,
  isNetworkPublicPath,
  matchesPrefix,
} from '../public-paths.js'

describe('BUG-4 公开面单一真相源', () => {
  describe('S1 三份清单同源共存、共用同一匹配原语', () => {
    it('三份清单都从本模块导出,且无一份为空(取不到清单即判绿是 BUG-20 的形状)', () => {
      expect(AUTH_PUBLIC_EXACT_PATHS.size).toBeGreaterThan(0)
      expect(AUTH_PUBLIC_PREFIX_PATHS.length).toBeGreaterThan(0)
      expect(TENANT_BYPASS_PREFIX_PATHS.length).toBeGreaterThan(0)
      expect(NETWORK_PUBLIC_PREFIX_PATHS.length).toBeGreaterThan(0)
    })

    it('再导出的 matchesPrefix 与消费方使用的语义一致(不存在第二把尺)', () => {
      expect(matchesPrefix('/api/agents', '/api/agents')).toBe(true)
      expect(matchesPrefix('/api/agents/abc', '/api/agents')).toBe(true)
      expect(matchesPrefix('/api/agentsXYZ', '/api/agents')).toBe(false)
      expect(matchesPrefix('/api/auth/login', '/api/auth/')).toBe(true)
    })

    it('三处判定函数都走段边界匹配,长度不同的兄弟路径不被误放行', () => {
      for (const fn of [isAuthPublicPath, isTenantBypassPath, isNetworkPublicPath]) {
        expect(fn('/api/authXYZ/login')).toBe(false)
        expect(fn('/api/healthXYZ')).toBe(false)
      }
    })
  })

  describe('S2 段边界安全(根除裸 startsWith)', () => {
    it('/api/agents 命中,但 /api/agentsXYZ 不命中', () => {
      expect(isAuthPublicPath('/api/agents')).toBe(true)
      expect(isAuthPublicPath('/api/agents/abc-123')).toBe(true)
      expect(isAuthPublicPath('/api/agentsXYZ')).toBe(false)
    })

    it('/api/docs 与 /api/docs/:slug 命中,但 /api/docsXYZ 与 /api/admin/docs 不命中', () => {
      expect(isAuthPublicPath('/api/docs')).toBe(true)
      expect(isAuthPublicPath('/api/docs/getting-started')).toBe(true)
      expect(isAuthPublicPath('/api/docsXYZ')).toBe(false)
      expect(isAuthPublicPath('/api/admin/docs')).toBe(false)
    })

    it('带尾斜杠的前缀只覆盖其子段,不覆盖同前缀兄弟', () => {
      expect(isAuthPublicPath('/api/news/top')).toBe(true)
      expect(isAuthPublicPath('/api/newsXYZ/top')).toBe(false)
    })
  })

  describe('S3 精确集合不退化成 catch-all', () => {
    it('"/" 只在精确集合中,任意业务路径都不会因此被判公开', () => {
      expect(AUTH_PUBLIC_EXACT_PATHS.has('/')).toBe(true)
      expect(AUTH_PUBLIC_PREFIX_PATHS).not.toContain('/')
      expect(isAuthPublicPath('/')).toBe(true)
      // 这两条是重构过程中真实踩过的坑:`/` 误入前缀集合 ⇒ 全部路径被判公开
      expect(isAuthPublicPath('/api/chat/conversations')).toBe(false)
      expect(isAuthPublicPath('/api/knowledge/docs')).toBe(false)
      expect(isAuthPublicPath('/api/admin/users')).toBe(false)
    })

    it('querystring 由消费方剥离后仍正确判定', () => {
      const path = '/api/health?probe=1'.split('?')[0] ?? ''
      expect(isAuthPublicPath(path)).toBe(true)
      const denied = '/api/admin/users?page=1'.split('?')[0] ?? ''
      expect(isAuthPublicPath(denied)).toBe(false)
    })
  })

  describe('S4 三个维度的公开性刻意分列,不盲目合并', () => {
    it('/api/settings 免租户但需登录(合并清单会打穿鉴权)', () => {
      expect(isTenantBypassPath('/api/settings')).toBe(true)
      expect(isAuthPublicPath('/api/settings')).toBe(false)
      expect(isAuthPublicPath('/api/settings/contact')).toBe(false)
    })

    it('/api/health 在三个维度都公开', () => {
      expect(isAuthPublicPath('/api/health')).toBe(true)
      expect(isTenantBypassPath('/api/health')).toBe(true)
      expect(isNetworkPublicPath('/api/health')).toBe(true)
    })

    // 2026-11-10:顶层 /health 是 dev-stack / 部署守护 / 监控的探针口,不带租户头。
    // TENANT_STRICT_MODE 缺省即严格后,它必须免租户,否则探针恒 401、启动门等满 240s。
    it('顶层 /health 必须免租户(探针口)', () => {
      expect(isAuthPublicPath('/health')).toBe(true)
      expect(isTenantBypassPath('/health')).toBe(true)
    })

    // 2026-11-11:OpenAI 兼容机器面凭 API Key 自证身份,调用方(含 ai-service 的模型连通性探测)
    // 不带租户头;TENANT_STRICT_MODE 缺省严格后不豁免即全线 401。
    it('/v1 与 /v1beta 必须免租户,且段边界不误放 /v1x', () => {
      expect(isTenantBypassPath('/v1/chat/completions')).toBe(true)
      expect(isTenantBypassPath('/v1beta/models/gemini-2.5-pro:generateContent')).toBe(true)
      expect(isTenantBypassPath('/v1x/foo')).toBe(false)
    })

    // 2026-11-11:客户端启动即调的版本检查,必须同时存在于鉴权清单和租户清单。
    // 事故回顾:另一会话把它只加进 AUTH_PUBLIC_PREFIX_PATHS,租户钩子仍返回 401,
    // 线上小程序冷启动卡死数小时,直到排查者用 grep 定位到"加错清单"才修复。
    // 本用例双面锁死,任何一侧漏登记都在 CI 阶段即红。
    it('/api/app-version/ 必须免登录且免租户(双清单回归锁)', () => {
      expect(isAuthPublicPath('/api/app-version/latest')).toBe(true)
      expect(isAuthPublicPath('/api/app-version/')).toBe(true)
      expect(isTenantBypassPath('/api/app-version/latest')).toBe(true)
      expect(isTenantBypassPath('/api/app-version/')).toBe(true)
    })

    // 2026-11-11:公开内容面(tools/news/articles/announcements)是免登录读接口、
    // 全局共享不按租户隔离,客户端未登录冷启动即拉取;严格模式下漏登记即启动 401。
    // 双清单锁死,防止重演 app-version "加错清单"同类事故。写端点仍挂 requireAdmin/
    // requireAuth(前缀豁免只免租户校验、不免鉴权),不打穿任何面。
    it('公开内容面(tools/news/articles/announcements)必须免登录且免租户', () => {
      // 这四个在鉴权清单是**精确条目**(裸前缀,无尾斜杠),故鉴权维度只精确匹配前缀本身;
      // 租户维度经 matchesPrefix 段边界匹配,前缀及其子段都豁免。两维度语义本就不同,分开断言。
      const prefixes = ['/api/tools', '/api/news', '/api/articles', '/api/announcements']
      for (const prefix of prefixes) {
        expect(isAuthPublicPath(prefix)).toBe(true)
        expect(isTenantBypassPath(prefix)).toBe(true)
        // 租户维度:前缀的子段也被豁免(段边界安全,兄弟路径除外)
        expect(isTenantBypassPath(`${prefix}/abc`)).toBe(true)
      }
      // 段边界:同前缀兄弟路径不得被前缀豁免误放行
      expect(isTenantBypassPath('/api/toolsXYZ')).toBe(false)
      expect(isTenantBypassPath('/api/newsfeed')).toBe(false)
    })

    it('/api/public/xxx 属鉴权与网络公开面,但不自动获得免租户待遇', () => {
      expect(isAuthPublicPath('/api/public/banner')).toBe(true)
      expect(isNetworkPublicPath('/api/public/banner')).toBe(true)
      expect(isTenantBypassPath('/api/public/banner')).toBe(false)
    })

    /**
     * 2026-11-12:个人号池面必须免租户(与 WS 全族同批实测暴露)。
     *
     * 事故形状(本机 8801 与 8802 双路实测,均带真实 admin 登录态 Bearer):
     * `GET /api/account-pool/models` → `{"code":401,"message":"多租户严格模式已启用…
     * path=/api/account-pool/models"}`。浏览器端**从不**携带 X-Tenant-Id(全仓零引用),
     * 后果是号池模型在选择器里根本拿不到 ⇒ 号池通道整条链路在浏览器里等于不存在。
     * 数据维度是 userId(两张号池表均无 tenant 列),免租户不损隔离。
     */
    describe('个人号池面免租户(2026-11-12)', () => {
      // 取自 apps/api/src/routes/account-pool.ts 的 server.<verb> 实读(8 条,含参数段形态)
      const POOL_ROUTES = [
        '/api/account-pool',
        '/api/account-pool/models',
        '/api/account-pool/summary',
        '/api/account-pool/credential',
        '/api/account-pool/abc-123',
        '/api/account-pool/abc-123/status',
        '/api/account-pool/abc-123/checkin',
      ]

      it('当前全部号池路由都免租户(逐条,不用前缀蒙过去)', () => {
        for (const route of POOL_ROUTES) {
          expect(isTenantBypassPath(route), `${route} 必须免租户`).toBe(true)
        }
      })

      it('免租户不免鉴权:号池面绝不能被列为鉴权公开面', () => {
        // 该面全部端点由 account-pool.ts 的插件作用域 preHandler 强制登录;
        // 若哪天有人把它也塞进 AUTH_PUBLIC_PREFIX_PATHS,兜底鉴权闸就整族放行。
        for (const route of POOL_ROUTES) {
          expect(isAuthPublicPath(route), `${route} 不得进鉴权公开面`).toBe(false)
        }
        expect(AUTH_PUBLIC_PREFIX_PATHS).not.toContain('/api/account-pool')
      })

      it('段边界:不放行 /api/account-poolXYZ 这类同级兄弟路径', () => {
        expect(isTenantBypassPath('/api/account-poolXYZ')).toBe(false)
        expect(isTenantBypassPath('/api/account-poolXYZ/models')).toBe(false)
      })

      // 自维护锁:account-pool.ts 里出现的每条路由字面量都必须被覆盖(新增端点自动纳入)
      it('account-pool 源码路由字面量全部被租户豁免覆盖(新增端点自动纳入)', () => {
        const here = dirname(fileURLToPath(import.meta.url))
        const src = readFileSync(join(here, '..', '..', 'routes', 'account-pool.ts'), 'utf8')
        const found = new Set<string>()
        for (const m of src.matchAll(/['"`](\/api\/account-pool[^'"`\s]*)['"`]/g)) {
          const route = (m[1] ?? '').split('?')[0] ?? ''
          if (route.length > 0) found.add(route)
        }
        // 兜底:扫描面为空说明读路径写错了(假绿五式之「取不到清单即判绿」)
        expect(found.size).toBeGreaterThanOrEqual(6)
        for (const route of found) {
          expect(isTenantBypassPath(route), `源码路由 ${route} 未被租户豁免覆盖`).toBe(true)
        }
      })
    })

    /**
     * 2026-11-12:WS 全族必须免租户。
     *
     * 事故形状(本机 8802 实测):`/ws/relay/chat?token=…`、`/ws/notifications?token=…` 在
     * TENANT_STRICT_MODE 缺省严格下返回 `{"code":401,"message":"多租户严格模式已启用…"}`。
     * 根因是传输层事实而非漏登记:浏览器 WebSocket 握手无法自定义 header,租户标识只剩
     * 「子域名」一条载体,而 `api.aizhs.top` 的 `api` 属 RESERVED_SUBDOMAINS ⇒ 恒无租户标识。
     * 后果是平台 16 条 WS 路由一律结构性不可达(不止号池通道)。
     */
    describe('WS 全族免租户(2026-11-12)', () => {
      // 显式列出当前全部 WS 路由(取自 apps/api/src/plugins/ws-*.ts 的 server.get 实读)。
      const WS_ROUTES = [
        '/ws/notifications',
        '/ws/relay/chat',
        '/ws/relay/ops',
        '/ws/messages',
        '/ws/broadcast',
        '/ws/customer-service',
        '/ws/agent/stream',
        '/ws/tts/stream',
        '/ws/realtime/pcm',
        '/ws/stock/stream',
        '/ws/timbre/generate',
        '/ws/coze/chat',
        '/ws/tasks/abc-123',
        '/ws/room/42',
        '/ws/payment/status/ORDER123',
        '/ws/terminal/sess-1',
      ]

      it('当前全部 WS 路由都免租户(逐条,不用前缀蒙过去)', () => {
        for (const route of WS_ROUTES) {
          expect(isTenantBypassPath(route), `${route} 必须免租户`).toBe(true)
        }
      })

      it('免租户不免鉴权:/ws/* 绝不能被列为鉴权公开面', () => {
        // 这是本次豁免的安全前提 —— 若哪天有人图省事把 /ws/ 也塞进 AUTH_PUBLIC_PREFIX_PATHS,
        // 兜底鉴权闸就整族放行 WS,而 WS 的凭据在 handler 内(query token),闸看不到。
        // 该断言在那一改落的瞬间变红,不让「免租户」悄悄升级成「免鉴权」。
        for (const route of WS_ROUTES) {
          expect(isAuthPublicPath(route), `${route} 不得进鉴权公开面`).toBe(false)
        }
        expect(AUTH_PUBLIC_PREFIX_PATHS).not.toContain('/ws/')
      })

      it('段边界:/ws 前缀不放行 /wsXYZ 这类同级兄弟路径', () => {
        expect(isTenantBypassPath('/wsXYZ/foo')).toBe(false)
        expect(isTenantBypassPath('/ws')).toBe(false)
        // 反向对照:相邻的 /v1 豁免也不该顺手放过 /ws2
        expect(isTenantBypassPath('/ws2/relay')).toBe(false)
      })

      // 自维护锁:今后新增 WS 路由时,若插件文件里出现 /ws/ 字面量而清单漏改,本用例即红。
      it('源码里出现的每个 /ws 路由字面量都被租户豁免覆盖(新增路由自动纳入)', () => {
        const here = dirname(fileURLToPath(import.meta.url))
        const pluginsDir = join(here, '..')
        const wsFiles = readdirSync(pluginsDir).filter(
          (f) => f.startsWith('ws-') && f.endsWith('.ts'),
        )
        expect(wsFiles.length).toBeGreaterThan(0)
        const found = new Set<string>()
        for (const file of wsFiles) {
          const src = readFileSync(join(pluginsDir, file), 'utf8')
          for (const m of src.matchAll(/['"`](\/ws\/[^'"`\s]*)['"`]/g)) {
            const route = (m[1] ?? '').split('?')[0] ?? ''
            if (route.length > 0) found.add(route)
          }
        }
        // 兜底:扫描面为空说明读路径写错了(假绿五式之「取不到清单即判绿」)
        expect(found.size).toBeGreaterThanOrEqual(WS_ROUTES.length - 1)
        for (const route of found) {
          expect(isTenantBypassPath(route), `源码路由 ${route} 未被租户豁免覆盖`).toBe(true)
        }
      })
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
