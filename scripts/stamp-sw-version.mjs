// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * stamp-sw-version.mjs — 给 web 的 Service Worker 注入本次部署唯一版本号。
 *
 * 为什么必须有这个脚本(2026-10-16 事故根因,生产实测):
 *   `apps/web/public/sw.js` 的 `CACHE_VERSION` 原是写死常量 'v2'。部署构建后 sw.js
 *   字节与上一版**逐字节相同** ⇒ 浏览器比对脚本内容判定"未变化" ⇒ **不触发 install/activate**
 *   ⇒ 新 SW 的全部逻辑(含 activate 里清理旧 cache 那段)**一次都不跑** ⇒ 用户端长期停在旧缓存。
 *
 *   生产实测:线上 `https://aizhs.top/sw.js` 的 last-modified 停在 **10 月 13 日**,
 *   此后每一次部署都没能更新它 —— 也就是说 10 月 13 日之后上线的**所有**前端改动,
 *   对已装过 SW 的老客户端(含桌面端 WebView2)都可能不生效。
 *   症状极隐蔽:HTML 是 network-first 因此是最新的、chunk hash 也是最新的,
 *   但整站行为仍是旧的;用户刷新、清浏览器缓存、甚至重启桌面端都可能无效。
 *
 * 做法:把 `const SW_BUILD_ID = '<占位符>'` 这一行的值替换为本次构建唯一的值。
 *   构建期注入是唯一稳妥的位置 —— 运行期注入需要 sw.js 自身先被加载,而它正是被缓存的那个东西。
 *
 * 唯一性来源:优先 CI/发布环境注入的 git sha 或显式 BUILD_ID;否则用"时间戳 + 随机后缀"。
 *   不依赖 git 命令成功(某些构建环境没有 git 或沙箱拦截),取不到就退化为时间戳,仍保证每次不同。
 *
 * 幂等与安全(三条硬约束,少一条就会自伤):
 *   ① **只替换声明行的值**,用锚定到 `const SW_BUILD_ID = '...'` 的正则;
 *      绝不用全文 split/join —— sw.js 里还有一处 `SW_BUILD_ID === '<占位符>'` 的兜底判断,
 *      全文替换会把它一并改掉,使"未注入时退化为时间戳"的保护失效(实测踩过)。
 *   ② **每次都重新生成**,不因"已注入过"而跳过。构建中断会留下"已注入但未部署"的状态,
 *      若跳过就复用旧 id ⇒ 字节再次不变 ⇒ 本脚本存在的意义被自己抹掉。
 *   ③ 写前自证行数不变(等量替换),不成立就拒绝写出,不产出半成品。
 *
 * 用法:
 *   node scripts/stamp-sw-version.mjs            # 就地替换 apps/web/public/sw.js
 *   node scripts/stamp-sw-version.mjs --check    # 只校验(CI 用):仍为占位符 ⇒ exit 1
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SW_PATH = path.join(REPO_ROOT, 'apps', 'web', 'public', 'sw.js')

/**
 * 占位符字面量(引号内的值)。
 * sw.js 里出现两处:声明行 + 兜底判断的比较值。**只替换声明行**,见上面约束 ①。
 */
const PLACEHOLDER = 'SW_BUILD_ID_PLACEHOLDER'

/** 锚定到声明行的正则:捕获引号内任意值。m 组 1 = 前缀,m 组 2 = 当前值。 */
const DECL_RE = /(const SW_BUILD_ID = ')([^']*)(')/

const argv = process.argv.slice(2)
const CHECK_ONLY = argv.includes('--check')

/** 生成本次构建唯一标识。多路回退,确保"每次调用必然与上次不同"这一性质不被环境破坏。 */
function makeBuildId() {
  const explicit = process.env.SW_BUILD_ID || process.env.BUILD_ID
  if (explicit) return String(explicit).slice(0, 64)

  const ciSha =
    process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA
  if (ciSha) return String(ciSha).slice(0, 12)

  // 本地:不引入 child_process(git 可能不存在或被沙箱拦截),只用时间戳 + 随机后缀。
  // 毫秒级时间戳 + 6 位随机,两次构建碰撞概率可忽略。
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function main() {
  let source
  try {
    source = readFileSync(SW_PATH, 'utf8')
  } catch (e) {
    console.error(`❌ 读不到 sw.js: ${SW_PATH}`)
    console.error(`   ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }

  const m = DECL_RE.exec(source)
  if (!m) {
    console.error('❌ sw.js 里找不到 `const SW_BUILD_ID = \'...\'` 声明行 ⇒ 结构被改过,拒绝盲写')
    console.error(`   期望出现: const SW_BUILD_ID = '${PLACEHOLDER}'`)
    process.exit(1)
  }
  const currentId = m[2]
  const isPlaceholder = currentId === PLACEHOLDER

  if (CHECK_ONLY) {
    if (isPlaceholder) {
      console.error(`❌ sw.js 的 SW_BUILD_ID 仍是占位符 '${PLACEHOLDER}'`)
      console.error('   未注入 ⇒ sw.js 每次构建字节相同 ⇒ SW 永不更新 ⇒ 老客户端看不到新功能。')
      console.error('   修法:构建流程里必须跑 `node scripts/stamp-sw-version.mjs`。')
      process.exit(1)
    }
    console.log(`✅ sw.js 版本号已注入: ${currentId}`)
    return
  }

  const nextId = makeBuildId()
  const replaced = source.replace(DECL_RE, `$1${nextId}$3`)

  // 自证 ①:声明行确实换成了新值
  const after = DECL_RE.exec(replaced)
  if (!after || after[2] !== nextId) {
    console.error('❌ 替换后声明行不是预期的新值 ⇒ 拒绝写出')
    process.exit(1)
  }
  // 自证 ②:兜底判断那处**必须原样保留**(它比的是 PLACEHOLDER,不是新 id)
  if (!replaced.includes(`=== '${PLACEHOLDER}'`)) {
    console.error('❌ 兜底判断(SW_BUILD_ID === PLACEHOLDER)被误改 ⇒ 拒绝写出')
    console.error('   这说明替换没锚定在声明行上,继续下去会让"未注入时退化为时间戳"的保护失效。')
    process.exit(1)
  }
  // 自证 ③:等量替换,行数不变
  if (replaced.split('\n').length !== source.split('\n').length) {
    console.error('❌ 替换前后行数不一致 ⇒ 拒绝写出(等量替换被破坏)')
    process.exit(1)
  }

  writeFileSync(SW_PATH, replaced, 'utf8')
  console.log(`✅ sw.js 版本号: ${currentId} → ${nextId}`)
  console.log(`   路径: ${path.relative(REPO_ROOT, SW_PATH)}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
