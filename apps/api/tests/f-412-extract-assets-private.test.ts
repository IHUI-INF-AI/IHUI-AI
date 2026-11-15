// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-412 回归锁:extract-assets 不得把私有文档内嵌资产写入匿名公开目录。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-412):
 *   对 uploads/private 的私有文件 POST /api/files/:id/extract-assets 时,
 *   资产一律以随机 UUID 写入 UPLOAD_DIR(=uploads/public),返回 /uploads/<uuid>,
 *   而 server.ts 静态挂载 root 即 public 且无 preHandler ⇒ 持 URL 即可读私有合同/证件扫描图。
 *
 * 修复:按源文件可见性分流 —— 公开源文件仍写 public / 返回 /uploads/<uuid>;
 *   私有源文件资产写 uploads/private/assets/<ownerId>/,并返回需鉴权的端点 URL;
 *   新增 GET /files/assets/:owner/:filename 受鉴权读取端点(属主/管理员 + 文件名形态 + 路径边界)。
 *
 * 本锁为源码接线锁(与仓库 f-162 同型):钉住分流、私有目录、鉴权端点与「不得回退」。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const filesSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/routes/files.ts'), 'utf8')
const serverSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/server.ts'), 'utf8')

describe('F-412:私有文档内嵌资产不得落入匿名公开目录', () => {
  it('接线锁:extract-assets 按源文件可见性分流落盘目录', () => {
    expect(filesSrc).toMatch(/const sourceIsPublic\s*=/)
    expect(filesSrc).toMatch(
      /const assetDir = sourceIsPublic \? UPLOAD_DIR : join\(PRIVATE_ASSETS_DIR, userId\)/,
    )
    // 不得回退成「无条件把 UPLOAD_DIR(public) 当 writeToDir」
    expect(filesSrc).not.toMatch(/extractDocumentAssets\(filePath, file\.name, UPLOAD_DIR\)/)
    expect(filesSrc).toMatch(/extractDocumentAssets\(filePath, file\.name, assetDir\)/)
  })

  it('缺陷锁:私有资产目录在 uploads/private 下,不再复用公开 UPLOAD_DIR', () => {
    expect(filesSrc).toMatch(
      /const PRIVATE_ASSETS_DIR = join\(process\.cwd\(\), 'uploads', 'private', 'assets'\)/,
    )
  })

  it('缺陷锁:私有资产返回受鉴权端点 URL,不再无条件返回 /uploads/<uuid>', () => {
    expect(filesSrc).toMatch(/`\/api\/files\/assets\/\$\{userId\}\/\$\{a\.filename\}`/)
    expect(filesSrc).not.toMatch(/url: resolvePublicUrl\(a\.filename\)/)
  })

  it('接线锁:新增的资产读取端点带鉴权、属主校验与路径边界', () => {
    const start = filesSrc.indexOf("server.get('/files/assets/:owner/:filename'")
    expect(start).toBeGreaterThan(-1)
    const body = filesSrc.slice(start, filesSrc.indexOf('// POST /files/:id/tags', start))
    expect(body).toMatch(/requireAuth\(request, reply\)/)
    expect(body).toMatch(/owner !== request\.userId/)
    expect(body).toMatch(/target\.startsWith\(resolve\(PRIVATE_ASSETS_DIR\) \+ sep\)/)
    expect(body).toMatch(/filename: z\.string\(\)\.regex\(/)
  })

  it('对照锁:server.ts 静态服务仍只暴露 uploads/public(未放宽鉴权面)', () => {
    expect(serverSrc).toMatch(/root: join\(process\.cwd\(\), 'uploads', 'public'\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
