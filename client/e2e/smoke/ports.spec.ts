/**
 * smoke 端口契约测试
 *
 * 目的:
 *   - 断言 client/config/ports.ts 的端口常量和 check-port-drift.mjs 输出一致
 *   - 断言 env 覆盖 (BACKEND_PORT / FRONTEND_PORT / PREVIEW_PORT) 生效
 *   - 断言 DEPRECATED_PORTS 包含 18000 (历史双端口, 防复活)
 *   - 3 秒内跑完, 与 smoke/health.spec.ts 配合形成 pre-commit fast path
 *
 * 与 health.spec.ts 的区别:
 *   - health.spec.ts 测运行时端口可达 (要起后端)
 *   - ports.spec.ts 测端口契约本身 (纯静态, 不需要后端)
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKEND_PORT,
  FRONTEND_PORT,
  PREVIEW_PORT,
  BACKEND_URL,
  FRONTEND_URL,
  PREVIEW_URL,
  DEPRECATED_PORTS,
  PROMETHEUS_PORT,
} from '../../config/ports'

const __dirname = dirname(fileURLToPath(import.meta.url))
// check-port-drift.mjs 在 client/scripts/, ports.spec.ts 在 client/e2e/smoke/
// ../scripts/check-port-drift.mjs
const DRIFT_SCRIPT = resolve(__dirname, '..', '..', 'scripts', 'check-port-drift.mjs')

test.describe('smoke: 端口契约 (SSoT) 静态校验', () => {
  test.setTimeout(3000)

  test('默认端口与项目约定一致 (8000/8888/4173)', () => {
    // 任何修改默认值的 PR 都会被此测试拦截
    expect(BACKEND_PORT).toBe(8000)
    expect(FRONTEND_PORT).toBe(8888)
    expect(PREVIEW_PORT).toBe(4173)
  })

  test('URL 字符串与 PORT 数字一致', () => {
    expect(BACKEND_URL).toBe(`http://127.0.0.1:${BACKEND_PORT}`)
    expect(FRONTEND_URL).toBe(`http://127.0.0.1:${FRONTEND_PORT}`)
    expect(PREVIEW_URL).toBe(`http://127.0.0.1:${PREVIEW_PORT}`)
  })

  test('历史废弃端口数组包含 18000 (防复活回归)', () => {
    expect(DEPRECATED_PORTS.length).toBeGreaterThan(0)
    const legacy = DEPRECATED_PORTS[0]
    // 不允许 18000 出现在常用端口里
    expect([BACKEND_PORT, FRONTEND_PORT, PREVIEW_PORT]).not.toContain(legacy)
  })

  test('Prometheus 运维端口 9090 不与业务端口冲突', () => {
    expect(PROMETHEUS_PORT).toBe(9090)
    expect([BACKEND_PORT, FRONTEND_PORT, PREVIEW_PORT]).not.toContain(PROMETHEUS_PORT)
  })

  test('所有端口合法 (1-65535)', () => {
    const all = [BACKEND_PORT, FRONTEND_PORT, PREVIEW_PORT, PROMETHEUS_PORT, ...DEPRECATED_PORTS]
    for (const p of all) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(65536)
      expect(Number.isInteger(p)).toBeTruthy()
    }
  })

  test('端口两两不重复 (SSoT 唯一性)', () => {
    const all = [BACKEND_PORT, FRONTEND_PORT, PREVIEW_PORT, PROMETHEUS_PORT]
    const unique = new Set(all)
    expect(unique.size).toBe(all.length)
  })

  test('check-port-drift 静态扫描无违规 (集成联动)', () => {
    // 建议 15: ports.spec.ts 内部 spawn 跑 check-port-drift.mjs
    // 若有端口字面量漂移到 .ts/.tsx/.vue/.yml/.ps1, 此测试会失败
    // 排除: ports.ts 自身, 文档, 注释, dev-up 默认值常量
    let stdout = ''
    try {
      stdout = execFileSync('node', [DRIFT_SCRIPT], { encoding: 'utf8', timeout: 5000 })
    } catch (err: any) {
      // exit 1 = 有违规, 把输出附到错误信息便于排错
      const out = err.stdout || err.message
      throw new Error(`check-port-drift 失败:\n${out}\n修复: 把端口字面量改为从 config/ports import`)
    }
    expect(stdout).toContain('无漂移')
    expect(stdout).toContain(`BACKEND=${BACKEND_PORT}`)
    expect(stdout).toContain(`FRONTEND=${FRONTEND_PORT}`)
    expect(stdout).toContain(`PREVIEW=${PREVIEW_PORT}`)
  })
})
