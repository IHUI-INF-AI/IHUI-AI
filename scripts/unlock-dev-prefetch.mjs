// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * dev-only:解除 Next.js 在 development 下对客户端预取的硬编码禁用。
 * 由 apps/web 的 dev 脚本链调用(dev / dev:clean / dev:stable),不参与 build/生产。
 *
 * 背景(2026-09-12 实测+源码复核)
 *   Next 在 dev 下整体禁用客户端预取,导致每次路由切换都必须等一次完整的服务端
 *   渲染(实测 warm 后 350~1200ms,与 RSC 响应体量成正比),无法"瞬间切换"。
 *   两处硬编码守卫:
 *     ① dist/client/components/app-router-utils.js —— createPrefetchURL() 返回 null
 *        ("Don't prefetch during development (improves compilation performance)")
 *        ★ 这是总闸:segment-cache/prefetch.js 拿到 null 后直接 return,
 *          故 `router.prefetch()` 与 <Link> 预取在 dev 下全为空操作。
 *     ② dist/client/app-dir/link.js —— <Link> onMouseEnter 预取直接 return。
 *
 * 为什么不能用运行时补丁
 *   Next dist 是 CJS,但用 `_export(exports, { name: function(){...} })` 定义导出
 *   (Object.defineProperty + getter,非 configurable),运行时**无法**覆盖这些导出
 *   (实测报错:Cannot set property createPrefetchURL of #<Object> which has only a getter)。
 *   而 `turbopack.rules` 无法稳定匹配到 node_modules 内的相对引用(segment-cache/prefetch.js
 *   用的是 `require("../app-router-utils")`),故只能在 dev 启动前改这两处 dist 源码。
 *
 * 安全性
 *   - 两处改动都是**只删 dev 守卫**:生产分支(NODE_ENV === 'production')行为完全不变。
 *   - 写入采用"临时文件 + rename 覆盖",不原地改写:避免触碰 pnpm 内容寻址存储里的硬链接副本。
 *   - 幂等:已打过补丁则跳过;Next 版本变化导致匹配不到时只告警、不影响启动。
 *   - `pnpm install` 覆盖恢复原状后,下次 dev 启动会自动重打。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const webPkgJson = path.join(repoRoot, 'apps', 'web', 'package.json')

const MARK = '[IHUI-AI dev prefetch unlock]'

/** 覆盖写:先写临时文件再 rename,绝不原地截断(pnpm 硬链接安全)。 */
function writeReplacing(file, content) {
  const tmp = `${file}.ihui-tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, file)
}

/**
 * ① 总闸:createPrefetchURL() 的 dev 早返回。
 * 删除后 dev 下的 router.prefetch / <Link> 预取将真实发出 RSC 预取请求。
 */
function patchCreatePrefetchURL(file) {
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARK)) return 'already'
  const re =
    /[ \t]*\/\/ Don't prefetch during development \(improves compilation performance\)\r?\n[ \t]*if \(process\.env\.NODE_ENV === 'development'\) \{\r?\n[ \t]*return null;\r?\n[ \t]*\}/
  if (!re.test(src)) return 'nomatch'
  writeReplacing(
    file,
    src.replace(re, `    // ${MARK} dev 预取守卫已解除(scripts/unlock-dev-prefetch.mjs)`),
  )
  return 'patched'
}

/** ② <Link> onMouseEnter 内联预取守卫。 */
function patchLinkHover(file) {
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(MARK)) return 'already'
  const from = "if (!prefetchEnabled || process.env.NODE_ENV === 'development') {"
  if (!src.includes(from)) return 'nomatch'
  writeReplacing(
    file,
    src.replace(
      from,
      `// ${MARK} dev 预取守卫已解除\n            if (!prefetchEnabled) {`,
    ),
  )
  return 'patched'
}

function main() {
  let nextDir
  try {
    const require = createRequire(webPkgJson)
    nextDir = path.dirname(require.resolve('next/package.json'))
  } catch (error) {
    console.warn(`[unlock-dev-prefetch] 定位 next 失败,跳过: ${error.message}`)
    return
  }

  const jobs = [
    { label: 'createPrefetchURL', file: path.join(nextDir, 'dist/client/components/app-router-utils.js'), run: patchCreatePrefetchURL },
    { label: '<Link> hover', file: path.join(nextDir, 'dist/client/app-dir/link.js'), run: patchLinkHover },
  ]

  for (const job of jobs) {
    if (!fs.existsSync(job.file)) {
      console.warn(`[unlock-dev-prefetch] 未找到 ${job.label} 目标文件,跳过: ${job.file}`)
      continue
    }
    let result
    try {
      result = job.run(job.file)
    } catch (error) {
      console.warn(`[unlock-dev-prefetch] ${job.label} 打补丁失败(不影响启动): ${error.message}`)
      continue
    }
    if (result === 'patched') {
      console.log(`[unlock-dev-prefetch] 已解除 dev 预取守卫: ${job.label}`)
    } else if (result === 'already') {
      console.log(`[unlock-dev-prefetch] 已是解锁状态: ${job.label}`)
    } else {
      console.warn(
        `[unlock-dev-prefetch] ${job.label} 未匹配到 dev 守卫(Next 版本可能已变更),dev 预取仍被禁用: ${job.file}`,
      )
    }
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
