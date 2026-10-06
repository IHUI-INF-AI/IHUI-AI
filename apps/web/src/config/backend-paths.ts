// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后端路径常量 — 等价自旧架构 client/src/config/backend-paths.ts
 *
 * 2026-10-06 瘦身（G-1058623 档 B）：全仓消费取证走**四通道**
 * （HEAD 面 + 暂存区 + 未跟踪 + 工作树当前内容），
 * 证明本文件 18 个 export 里只有 `OPENCLAW_PATHS` 被真实消费
 * （唯一消费方 `apps/web/src/lib/openclaw-api.ts`，29 处）。
 * 其余 14 组路径常量与 `ROUTE_MAP` / `BackendRouteKey` / `getPathsByRoute`
 * 零调用方、零测试钉子，且三者构成的整张路由映射表自身也是死的 ⇒ 已整体删除。
 *
 * 保留 `OPENCLAW_PATHS` 全部 8 个子对象（含当前零调用的 `sessions` / `stats`）：
 * 活着的路径表按域完整列出是它的**契约语义**；按"当前调用点"裁剪会把契约表
 * 降级成调用点快照，那是真坏味道。死常量是"整组无人碰"，与此不同类。
 *
 * 全仓 grep 同名命中需甄别（都与本文件无关，不是漏删）：
 *   - `AGENTS_PATHS` → `apps/ai-service/tests/test_privileged_surface_auth_59.py`（Python 局部元组）
 *   - `ROUTE_MAP`    → `apps/miniapp-taro/src/pkg-user/favorites/index.tsx`（该端自己的路由映射）
 */

// ==================== OpenClaw（8802） ====================
const OPENCLAW = '/api/openclaw'
export const OPENCLAW_PATHS = {
  gateway: {
    status: `${OPENCLAW}/gateway/status`,
    health: `${OPENCLAW}/gateway/health`,
    config: `${OPENCLAW}/gateway/config`,
    restart: `${OPENCLAW}/gateway/restart`,
  },
  channels: {
    supported: `${OPENCLAW}/channels/supported`,
    list: `${OPENCLAW}/channels`,
    byId: (id: string) => `${OPENCLAW}/channels/${id}`,
    connect: (id: string) => `${OPENCLAW}/channels/${id}/connect`,
    disconnect: (id: string) => `${OPENCLAW}/channels/${id}/disconnect`,
    send: (id: string) => `${OPENCLAW}/channels/${id}/send`,
    status: (id: string) => `${OPENCLAW}/channels/${id}/status`,
  },
  tools: {
    list: `${OPENCLAW}/tools`,
    byName: (name: string) => `${OPENCLAW}/tools/${name}`,
    execute: (name: string) => `${OPENCLAW}/tools/${name}/execute`,
    register: `${OPENCLAW}/tools/register`,
  },
  skills: {
    list: `${OPENCLAW}/skills`,
    byId: (id: string) => `${OPENCLAW}/skills/${id}`,
    install: (id: string) => `${OPENCLAW}/skills/${id}/install`,
    uninstall: (id: string) => `${OPENCLAW}/skills/${id}/uninstall`,
    installed: `${OPENCLAW}/skills/installed`,
    publish: `${OPENCLAW}/skills/publish`,
  },
  tasks: {
    list: `${OPENCLAW}/tasks`,
    byId: (id: string) => `${OPENCLAW}/tasks/${id}`,
    cancel: (id: string) => `${OPENCLAW}/tasks/${id}/cancel`,
    retry: (id: string) => `${OPENCLAW}/tasks/${id}/retry`,
    execute: (id: string) => `${OPENCLAW}/tasks/${id}/execute`,
  },
  sessions: {
    list: `${OPENCLAW}/sessions`,
    byId: (id: string) => `${OPENCLAW}/sessions/${id}`,
    messages: (id: string) => `${OPENCLAW}/sessions/${id}/messages`,
    end: (id: string) => `${OPENCLAW}/sessions/${id}/end`,
  },
  memory: {
    create: `${OPENCLAW}/memory`,
    search: `${OPENCLAW}/memory/search`,
    context: `${OPENCLAW}/memory/context`,
    delete: `${OPENCLAW}/memory`,
  },
  stats: {
    usage: `${OPENCLAW}/stats/usage`,
    tokens: `${OPENCLAW}/stats/tokens`,
  },
} as const

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
