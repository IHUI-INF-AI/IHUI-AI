// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 防回归门:全仓不许再出现对旧路径 `/api/history` 的调用残留(2026-10-04 改名票)。
 *
 * ## 为什么需要这道门(不是"改名顺手加一条")
 *
 * 改名 `/api/history` → `/api/browse-history` 之后,**旧路径在后端已不存在**。
 * 若有人把某一处调用改回去(抄旧路径、cherry-pick 旧提交、照着文档里的旧例子写),
 * 表现是 **404 静默失效**:Fastify 找不到路由 → 前端拿到 404 → 页面"清空历史"又变回死按钮,
 * 而**编译全绿、typecheck 全绿、绝大多数测试全绿**(没有一条用例会去访问那个不存在的路径)。
 * 也就是说"改回去"这个缺陷在别的门眼里是完全不可见的 —— 只有"旧路径零残留"这条判据能抓住它。
 *
 * ## 判据(精确匹配,不是子串包含)
 *
 * 只抓 `/api/history` 后面**不接连字符**的写法,即三类:
 *   `/api/history` · `/api/history/visit` · `/api/history?page=1`
 * 不抓(同前缀不同名,抓了就是假阳性):
 *   `/api/browse-history`(改名后的正主) · `/api/ai/history` · `/api/ai-image/history`
 *   `/api/chat/conversations/:id/history` —— 这些的 `/history` 前缀是别的段,压根不含 `/api/history` 子串。
 *
 * ## 取材面与刻意排除
 *
 * 扫:apps/ · packages/ · scripts/ · docs/ 下的 .ts/.tsx/.js/.jsx/.mjs/.cjs/.md/.sql/.json。
 * 不扫:node_modules/ · dist/ · .next/ · coverage/ · .git/ · .ihui-agent/ · .DevEnv/(构建产物与代理目录)。
 * 刻意排除 `packages/database/drizzle/`:**迁移文件是冻结的历史记录**,票面硬约束明写"全部禁改"。
 * 那份 `20261004120000_user_browse_history.sql` 的头注里写着 `/api/history`,
 * 那是**建表当时的事实陈述**(那时端点确实叫这名),改它等于篡改历史记录。
 * 故本门对 drizzle/ 目录整体开洞,并在 T6 把这条排除钉成断言 —— 免得日后有人
 * "顺手统一一下"把迁移改了(那是另一类缺陷),或反过来把排除范围悄悄扩大到全仓。
 *
 * ## 跑法
 *
 *   node --test scripts/tests/check-legacy-browse-history-path.test.mjs
 *   node scripts/run-script-tests.mjs -- legacy-browse-history   # 走全量入口
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 本门自己的文件名 —— 头注里必然写着 `/api/history`(那是在解释判据),不能自己抓自己。 */
const SELF_REL = 'scripts/tests/check-legacy-browse-history-path.test.mjs'

/** 取材文件后缀。只读文本源码,不读二进制与锁文件。 */
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.sql'])

/**
 * 取材面 = **git 跟踪的文件**(`git ls-files`),不是磁盘递归。
 *
 * 这不是省事的写法,是唯一正确的写法,两个理由都实测撞到过:
 *  ① 磁盘递归会踩构建产物:`apps/web/.next-static-r2/`、`apps/mobile-cap/www/`、
 *     `apps/mobile-cap/android/.../assets/public/` 里都有旧路径的**压缩副本**
 *     (静态导出与 Capacitor 把 Next 产物拷进去的)。它们每次构建都会变,
 *     盯着等于盯着移动靶。gitignore 掉它们不是放水 —— 判据面本来就该是源码。
 *  ② 磁盘递归会踩坏符号链接:仓里有 `tmp/quarantine/...` 的悬空链接,
 *     `statSync` 直接抛 ENOENT 打断整轮扫描(不是跳过,是崩)。
 * `git ls-files` 两个问题一次都没有,且它就是"源码"的精确定义。
 * 注意:它只列**已跟踪**文件,故本门在别处新增的未跟踪文件要等入索引才被扫到 ——
 * 这是有意的取舍(与门 118 的 loose-fs 定位一致),头注已如实登记。
 */
function trackedFiles() {
  const r = spawnSync('git', ['-c', 'safe.directory=*', 'ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0 || typeof r.stdout !== 'string') {
    throw new Error(`git ls-files 失败(status=${r.status}):${r.stderr ?? ''}`)
  }
  return r.stdout.split('\0').filter(Boolean)
}

/** 判据本体:旧路径 `/api/history` 且其后不接连字符。 */
const LEGACY_PATH_RE = /\/api\/history(?![-\w])/g

/** 取材面里筛出本门要读的文本源码文件(绝对路径)。 */
function collectFiles() {
  return trackedFiles()
    .filter((rel) => SCAN_EXT.has(extname(rel)))
    .map((rel) => join(REPO_ROOT, rel))
}

/**
 * 全仓扫一遍,返回 [{ file(相对根,正斜杠), line, text }]。
 * 取材面 = 仓库根递归(不再按域分片),排除项见 PRUNE_DIRS 与下面两条。
 */
function scanLegacyRefs() {
  const hits = []
  for (const f of collectFiles(REPO_ROOT)) {
    const rel = relative(REPO_ROOT, f).split(sep).join('/')
    // 迁移目录:冻结历史记录,票面硬约束禁改。头注里的旧路径是建表当时的事实陈述。
    if (rel.startsWith('packages/database/drizzle/')) continue
    // 本门自己:头注必然逐字引用 `/api/history` 来解释判据,自己抓自己 ⇒ 恒红。
    if (rel === SELF_REL) continue
    // 已跟踪但工作树里不存在(刚被删/改名,索引未更新)⇒ 跳过,不当残留报。
    if (!existsSync(f)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      LEGACY_PATH_RE.lastIndex = 0
      if (LEGACY_PATH_RE.test(lines[i])) {
        hits.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 160) })
      }
    }
  }
  return hits
}

const fmt = (hits) => hits.map((h) => `  ${h.file}:${h.line}  ${h.text}`).join('\n')

test('T1 真仓当前面:旧路径 /api/history 零调用残留', () => {
  const hits = scanLegacyRefs()
  assert.equal(
    hits.length,
    0,
    `发现 ${hits.length} 处对旧路径 /api/history 的残留(改回旧路径会静默 404):\n${fmt(hits)}`,
  )
})

test('T2 取材面非空且覆盖各域(扫描器没在扫零个文件 = 假绿)', () => {
  // 这一条不依赖"当前是否有残留",故在干净面与变异面都恒成立,是整条扫描能力的**恒真锚**。
  // 上一版的漏洞正是在这里:T1 用自制循环取扩展名,在 Windows 上切成 ".tsx\\x",
  // 一个文件都匹配不上 ⇒ 扫了零文件却报"零残留"全绿。变异验证时是 T5 翻的红、T1 没翻,
  // 暴露的正是这个洞。现在把取材面非空直接钉成断言。
  const rels = new Set(trackedFiles())
  for (const r of ['apps/', 'packages/', 'scripts/', 'docs/']) {
    const n = [...rels].filter((x) => x.startsWith(r)).length
    assert.ok(n > 0, `${r} 域一个跟踪文件都没有 ⇒ 取材面判据坏了(扫描器在扫零文件)`)
  }

  // 端点本体与三个调用点必须在取材面里 —— 它们是本门最该盯的四个文件。
  for (const must of [
    'apps/api/src/routes/other/history-routes.ts',
    'apps/web/app/(main)/member/history/page.tsx',
    'apps/web/app/(main)/articles/[id]/PageClient.tsx',
    'apps/mobile-rn/src/screens/HistoryScreen.tsx',
  ]) {
    assert.ok(rels.has(must), `${must} 不在取材面里 ⇒ 该文件没被扫`)
  }

  // 反向:构建产物**不该**在取材面里(gitignore 挡着)。它们含旧路径的压缩副本,
  // 若哪天进了索引,本门会立刻对一片每次构建都变的产物报红 —— 那就是噪声了。
  for (const artifact of ['apps/web/.next-static-r2/', 'apps/mobile-cap/www/']) {
    assert.ok(
      ![...rels].some((x) => x.startsWith(artifact)),
      `${artifact} 竟被 git 跟踪了 ⇒ 构建产物进了判据面`,
    )
  }
})

test('T2b 判据对三种旧写法都敏感、对新写法不误报', () => {
  const src = [
    "const a = fetchApi('/api/browse-history')", // 新路径 —— 不该抓
    "const b = fetchApi('/api/history')", // ← 必须抓
    "const c = fetchApi('/api/history/visit')", // ← 必须抓
    'const d = fetchApi(`/api/history?page=1`)', // ← 必须抓
  ].join('\n')
  const hits = []
  src.split('\n').forEach((line, i) => {
    LEGACY_PATH_RE.lastIndex = 0
    if (LEGACY_PATH_RE.test(line)) hits.push(i + 1)
  })
  assert.deepEqual(hits, [2, 3, 4], '三种旧写法都要被抓到')
})

test('T3 精确匹配:同前缀不同名不得被抓(抓了就是假阳性,门会被当噪声关掉)', () => {
  const clean = [
    "const a = fetchApi('/api/browse-history')", // 改名后的正主
    "const b = fetchApi('/api/browse-history/visit')",
    "const c = fetchApi('/api/ai/history')", // 同前缀不同名
    "const d = fetchApi('/api/ai-image/history')",
    "const e = fetchApi('/api/chat/conversations/1/history')",
    'const f = fetchApi(`/api/history-legacy`)', // 连字符续接 = 另一个端点名
  ].join('\n')
  const hits = []
  const lines = clean.split('\n')
  for (let i = 0; i < lines.length; i++) {
    LEGACY_PATH_RE.lastIndex = 0
    if (LEGACY_PATH_RE.test(lines[i])) hits.push(i + 1)
  }
  assert.deepEqual(hits, [], `这些行不该被判为残留:\n${fmt(hits.map((l) => ({ file: 'fixture', line: l, text: lines[l - 1] })))}`)
})

test('T4 后端三个端点确实挂在 /browse-history 上(改名本身没漏)', () => {
  const src = readFileSync(
    join(REPO_ROOT, 'apps/api/src/routes/other/history-routes.ts'),
    'utf8',
  )
  assert.match(src, /server\.get\('\/browse-history'/, 'GET 列表端点未改名')
  assert.match(src, /server\.delete\('\/browse-history'/, 'DELETE 清空端点未改名')
  assert.match(src, /server\.post\('\/browse-history\/visit'/, 'POST 上报端点未改名')
})

test('T5 三个写入/读取侧调用点都指向新路径(漏一处就是 404)', () => {
  // 只数**真实的调用表达式**(api(...)/fetchApi(...)),不数注释里提到路径的那几行 ——
  // 否则注释一改就假红,而注释改动恰恰是最频繁的。
  const sites = [
    ['apps/web/app/(main)/member/history/page.tsx', 2],
    ['apps/web/app/(main)/articles/[id]/PageClient.tsx', 1],
    ['apps/mobile-rn/src/screens/HistoryScreen.tsx', 1],
  ]
  for (const [rel, expected] of sites) {
    const src = readFileSync(join(REPO_ROOT, rel), 'utf8')
    const callRe = /(?:\bapi|\bfetchApi)(?:<[^>]*>)?\(\s*[`'"]\/api\/browse-history/g
    const n = (src.match(callRe) ?? []).length
    assert.equal(n, expected, `${rel}:期望 ${expected} 处 api()/fetchApi() 调用 /api/browse-history,实到 ${n}`)
    // 注释里也不许留旧路径(那会误导下一个照着注释改的人)
    assert.doesNotMatch(src, LEGACY_PATH_RE, `${rel}:仍残留旧路径 /api/history`)
  }
})

test('T6 三处排除都是刻意的,且都没扩大到全仓豁免', () => {
  // ① drizzle/ 迁移:冻结历史记录,票面硬约束禁改。头注里的旧路径是建表当时的事实陈述。
  const migration = readFileSync(
    join(REPO_ROOT, 'packages/database/drizzle/20261004120000_user_browse_history.sql'),
    'utf8',
  )
  assert.match(migration, /\/api\/history/, '迁移头注里的旧路径应当仍在(它是建表当时的事实陈述)')

  // ② 构建产物:CAPACitor/静态导出拷进去的压缩副本,重跑构建就变,盯它是盯移动靶。
  //    它们确实含旧路径 —— 用 gitignore 判据确认它们是产物而非源码,免得"剪枝"被当成藏污纳垢。
  const artifacts = [
    'apps/web/.next-static-r2/_next/static/chunks/299-xtpyth9dk.js',
    'apps/mobile-cap/www/_next/static/chunks/0wpefw_8z_ntr.js',
  ]
  for (const rel of artifacts) {
    const p = join(REPO_ROOT, rel)
    let ignored = false
    try {
      const r = spawnSync('git', ['-c', 'safe.directory=*', 'check-ignore', '-q', rel], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      ignored = r.status === 0
    } catch {
      ignored = false
    }
    assert.ok(ignored, `${rel} 未被 gitignore 判定为产物 ⇒ 不能用"构建产物"当理由剪掉(需另找判据或修产物)`)
  }

  // ③ 反向锚:排除是窄口径,不是全仓豁免。三个源码域一个都不许有残留。
  const hits = scanLegacyRefs()
  assert.deepEqual(
    hits.filter((h) => !h.file.startsWith('packages/database/drizzle/') && h.file !== SELF_REL),
    [],
    '源码域出现旧路径残留',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
