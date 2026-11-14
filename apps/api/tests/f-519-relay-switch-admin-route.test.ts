// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-519 回归锁(2026-11-13)。
 *
 * 病灶:routes/admin/relay-switch-admin.ts 的三个 relay 切换端点从未被任何注册面 import,
 * 属死路由;而「切到指定快照」会直接改写本机客户端凭据,一旦误注册且漏 requireAdmin 后果严重。
 *
 * 处置:按票面建议删除该插件及其专属测试,切换引擎(src/services/relay-switch/core.ts)
 * 保留给 CLI 使用。本文件锁:
 *   ① 路由源文件与旧插件测试均已不存在;
 *   ② 全仓代码不再出现对该模块的 import/require;
 *   ③ 共享切换引擎未被误删。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SELF), '../../..')
const ROUTE_FILE = join(REPO_ROOT, 'apps/api/src/routes/admin/relay-switch-admin.ts')
const OLD_PLUGIN_TEST = join(REPO_ROOT, 'apps/api/src/routes/__tests__/relay-switch-admin.test.ts')

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  '.nuxt',
  '.output',
])
const CODE_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])

/** 收集仓库内全部代码文件(跳过隐藏目录、依赖与构建产物) */
function collectCodeFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (!ent.name.startsWith('.') && !SKIP_DIRS.has(ent.name)) {
        collectCodeFiles(join(dir, ent.name), out)
      }
    } else if (ent.isFile() && CODE_EXT.has(extname(ent.name))) {
      out.push(join(dir, ent.name))
    }
  }
  return out
}

describe('F-519 relay 切换管理面死路由已删除', () => {
  it('路由源文件与旧插件测试均不存在', () => {
    expect(existsSync(ROUTE_FILE)).toBe(false)
    expect(existsSync(OLD_PLUGIN_TEST)).toBe(false)
  })

  it('全仓代码不再 import/require 该模块', () => {
    const spec = /['"][^'"]*relay-switch-admin(?:\.js)?['"]/
    const hits = collectCodeFiles(REPO_ROOT)
      .filter((file) => file !== SELF && spec.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(REPO_ROOT.length + 1))
    expect(hits).toEqual([])
  })

  it('共享切换引擎仍在,CLI 能力未被误删', () => {
    expect(existsSync(join(REPO_ROOT, 'apps/api/src/services/relay-switch/core.ts'))).toBe(true)
  })
})
