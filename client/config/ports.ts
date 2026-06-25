/**
 * 开发环境端口常量 - 项目级唯一来源 (Single Source of Truth)
 *
 * 用途: 消除端口值散布在 vite.config.ts / playwright.config.ts / dev-up.ps1 /
 *       e2e 测试脚本 / CI 脚本 等多处配置文件中的"端口漂移"问题.
 *
 * 历史教训 (2026-06-18):
 *   - vite.config.ts 之前硬编码 target: 'http://127.0.0.1:18000' 指向一个无服务端口,
 *     Vite 代理转发全部 500. 当时 restart_backend.py 默认端口是 8000, 但 Vite 写死 18000.
 *   - 修法: 把 12 处 18000 全部替换为 8000, 抽取 BACKEND_TARGET 常量.
 *   - 进一步改进: 提升为 client/config/ports.ts, 让 vite/playwright/e2e/CI 都从这里读.
 *   - 再次改进 (2026-06-18): 顶部支持 process.env 覆盖, 团队/CI/容器化场景下无需改代码.
 *
 * 修改流程:
 *   1. 改本文件 BACKEND_PORT / FRONTEND_PORT / PREVIEW_PORT 的默认值 (默认 8000/8888/4173)
 *   2. 或运行时设置环境变量 BACKEND_PORT=9000 FRONTEND_PORT=9999 PREVIEW_PORT=4096
 *   3. 跑 npm run dev (或 dev-up.ps1) 验证前后端启动正常
 *   4. 跑 npm run test:e2e -- infra-vite-proxy 验证代理链路通
 *   5. 跑 ./scripts/dev-up.ps1 -Stop 清理旧进程
 *
 * 环境变量覆盖优先级 (从高到低):
 *   - 命令行参数 (dev-up.ps1 -BackendPort 9000)
 *   - 进程环境变量 (BACKEND_PORT=9000 ./dev-up.ps1)
 *   - 本文件中的默认值 (8000/8888/4173)
 *
 * 被以下位置 import (用 grep -rn "config/ports" 可快速验证覆盖度):
 *   - client/vite.config.ts                     (BACKEND_TARGET / FRONTEND_URL / FRONTEND_PORT)
 *   - client/playwright.config.ts                (PW_BASE_URL / PW_BACKEND_URL)
 *   - client/e2e/infra-vite-proxy.spec.ts        (BACKEND / FRONTEND)
 *   - client/scripts/*  (端口探活脚本)           (探活)
 */

/** 安全读取环境变量作为端口号, 失败回退到默认值 */
const envPort = (key: string, fallback: number): number => {
  try {
    // globalThis.process 在 Node 环境 (vite/playwright/e2e) 都有, 浏览器端为 undefined
    const proc: any = (globalThis as any).process
    const raw = proc?.env?.[key]
    if (raw == null || raw === '') return fallback
    const n = parseInt(String(raw), 10)
    if (!Number.isFinite(n) || n <= 0 || n >= 65536) {
       
      console.warn(`[ports] env ${key}=${raw} 不是合法端口, 使用 fallback ${fallback}`)
      return fallback
    }
    return n
  } catch {
    return fallback
  }
}

/** 单一后端源: FastAPI / uvicorn 监听端口. 严禁随意修改, 修改前必看 DEV_PORTS.md
 *
 * ⚠️ 运行时启动规范 (2026-06-25 强化):
 *   后端必须监听 8000 端口, 不得以任何理由临时改为其他端口.
 *   AI 助手/开发者启动 uvicorn 时必须用 --port 8000 或不带 --port (由 .env 的 API_PORT=8000 控制).
 *   8000 被占用时必须先释放 8000, 不得改端口绕过.
 *   详见 client/docs/DEV_PORTS.md "运行时启动规范" 章节.
 *
 *  运行时可用 $env:BACKEND_PORT 覆盖 (仅用于 CI/容器化, 本地开发不得使用) */
export const BACKEND_PORT = envPort('BACKEND_PORT', 8000)
/** 后端完整 URL (含协议), 供 Vite proxy target 与 e2e 直连使用 */
export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`
/** Vite dev server 监听端口 (本地 dev 调试)
 *  运行时可用 $env:FRONTEND_PORT 覆盖 */
export const FRONTEND_PORT = envPort('FRONTEND_PORT', 8888)
/** Vite dev server 完整 URL */
export const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`
/** Vite preview server 端口 (CI 集成测试用)
 *  运行时可用 $env:PREVIEW_PORT 覆盖 */
export const PREVIEW_PORT = envPort('PREVIEW_PORT', 4173)
/** Vite preview 完整 URL */
export const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`
/** 历史双端口 18000 已废弃 2026-06-18, 任何 e2e / 脚本发现此端口存活都视为回归
 *  数组形式便于未来新增废弃端口 (例如 25000) */
export const DEPRECATED_PORTS: number[] = [18000]
/** Prometheus 运维侧端口, 业务禁止监听 */
export const PROMETHEUS_PORT = 9090
