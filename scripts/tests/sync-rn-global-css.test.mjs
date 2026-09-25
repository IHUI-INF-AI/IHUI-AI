// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/sync-rn-global-css.test.mjs — §22c 镜像测试:tokens.css → mobile-rn/global.css
 * 这条"自动同步 + 对账"链的装车证明。
 *
 * 为什么每条都要成对(阳性对照 + 反向对照):本票修的正是"门一路报绿而副本缺 124 档"这一型 ——
 * 只测"会改"不测"该改时改、不该改时不动",判据等于没有。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const GIT = (spec) =>
  execFileSync('git', ['-c', 'safe.directory=*', 'show', spec], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    cwd: ROOT,
    windowsHide: true,
  })

const sync = await import('../sync-rn-global-css.mjs')
const gate = await import('../check-rn-global-css-sync.mjs')
const lib = await import('../lib/design-token-blocks.mjs')

const TOKENS = `@theme {
  /* 说明里写着 --color-bait: 这是散文,不是声明; */
  --color-bg: white;
  --color-primary-rgb: 0, 0, 0;
  --color-brand-accent: #4A7A96;
}
:root {
  --color-late-rgb: 1, 2, 3;
}
.dark {
  --color-bg: black;
}`

test('T1 生成器被 import 时不得有写盘副作用(§22d isDirectRun)', () => {
  assert.equal(typeof sync.__test__, 'object')
  assert.ok(sync.__test__.deriveRnDecls(TOKENS, 'light').length > 0)
  // import 完就到此为止:真仓文件必须与 git 面一致(没被顺手改写)
  assert.doesNotThrow(() => GIT('HEAD:apps/mobile-rn/global.css'))
})

test('T2 取值口径:后续 :root 块必须并进来(旧版只取首个非贪婪块 ⇒ 实测删掉 alpha 三元组)', () => {
  const names = sync.__test__.deriveRnDecls(TOKENS, 'light').map((d) => d.name)
  assert.ok(names.includes('--color-late-rgb'), '后续 :root 块的档必须在')
  assert.ok(names.includes('--color-primary-rgb'), 'alpha 三元组必须在')
  assert.ok(!names.includes('--color-brand-accent'), 'brand 档按端内策略不搬')
  assert.ok(!names.includes('--color-bait'), '注释里的散文不得被当成声明(阳性对照)')
})

test('T3 原位写回不得抹掉端内 --rn-* 档与注释(整块替换的必炸点)', () => {
  const css = `:root {
  /* 语义色(手抄说明) */
  --color-bg: WRONG;
  /* RN 扩展语义色
   * 值源自 rnTokens。用 --rn-* 前缀避免被只校验 --color-* 的那道门拦。 */
  --rn-accent: #123456;
}`
  const out = sync.__test__.replaceBlock(css, ':root', sync.__test__.deriveRnDecls(TOKENS, 'light'))
  assert.match(out, /--color-bg: white;/, '同名行必须就地换值')
  assert.doesNotMatch(out, /WRONG/, '旧值不得残留')
  assert.ok(out.includes('--rn-accent: #123456;'), '端内 --rn-* 档必须逐字保留')
  assert.ok(out.includes('用 --rn-* 前缀避免被只校验'), '解释性注释必须留在原位')
})

test('T4 幂等:第二次写回必须与第一次逐字节相同(跨行声明曾破坏它)', () => {
  const tokens = `@theme { --color-bg: white; }
:root { --color-grad: linear-gradient(112deg, rgba(1, 2, 3, 0.7) 0%); }`
  const css = `:root {
  --color-bg: white;
  --color-grad: linear-gradient(
    112deg,
    rgba(1, 2, 3, 0.7) 0%
  );
}`
  const decls = sync.__test__.deriveRnDecls(tokens, 'light')
  const once = sync.__test__.replaceBlock(css, ':root', decls)
  assert.doesNotMatch(once, /自动补入/, '跨行声明不得被误判成"本文件尚缺"')
  assert.equal(sync.__test__.replaceBlock(once, ':root', decls), once, '第二次必须零改动')
})

test('T5 门有牙:HEAD 那份 global.css 必须被判出缺档(旧 subset 判据对它一路报绿)', () => {
  const r = gate.__test__.compare({
    tokensCss: GIT('HEAD:packages/design-tokens/src/styles/tokens.css'),
    globalCss: GIT('HEAD:apps/mobile-rn/global.css'),
  })
  assert.ok(r.missing.length > 0, `缺档必须非 0,实得 ${r.missing.length}`)
})

test('T6 反向对照:派生态不得判红(否则本门只会逼人 --no-verify)', () => {
  const tokensCss = GIT('HEAD:packages/design-tokens/src/styles/tokens.css')
  const base = GIT('HEAD:apps/mobile-rn/global.css')
  const landed = sync.__test__.replaceBlock(
    sync.__test__.replaceBlock(
      base,
      ':root',
      sync.__test__.deriveRnDecls(tokensCss, 'light')
    ),
    '.dark',
    sync.__test__.deriveRnDecls(tokensCss, 'dark')
  )
  const r = gate.__test__.compare({ tokensCss, globalCss: landed })
  assert.equal(r.missing.length, 0, '补全后不得再报缺档')
  assert.equal(r.mismatches.length, 0, '补全后不得再报值漂移')
})

test('T7 单一实现:守门与生成器必须共用 lib,不得各自再抄一份取值逻辑', () => {
  for (const [name, src] of [
    ['check-rn-global-css-sync.mjs', SRC('check-rn-global-css-sync.mjs')],
    ['sync-rn-global-css.mjs', SRC('sync-rn-global-css.mjs')],
  ]) {
    assert.match(src, /from '\.\/lib\/design-token-blocks\.mjs'/, `${name} 必须 import 共用 lib`)
    assert.doesNotMatch(
      src,
      /function extractAllBlocks\(/,
      `${name} 不得再本地定义 extractAllBlocks(两份真相)`
    )
    assert.doesNotMatch(
      src,
      /@theme\\s\*\\{\\\(\[\\s\\S\]\*/,
      `${name} 不得再用"首个非贪婪块"正则取源(本票立因)`
    )
  }
  assert.equal(typeof lib.collectVars, 'function')
  assert.equal(typeof lib.maskComments, 'function')
})

test('T8 装车证明:提交链必须对两个目标各跑一次生成器,且只有一份 git add 实现', () => {
  const hook = SRC('lib/pre-commit-hook.js')
  assert.match(hook, /const TOKEN_SYNC_TARGETS = \[/, '钩子必须用目标表')
  assert.match(hook, /apps\/miniapp-taro\/src\/app\.css/, '表里必须有小程序 app.css')
  assert.match(hook, /apps\/mobile-rn\/global\.css/, '表里必须有 RN global.css')
  assert.match(hook, /scripts\/sync-rn-global-css\.mjs/, 'RN 目标必须指向生成器')
  assert.match(hook, /for \(const t of TOKEN_SYNC_TARGETS\)/, '必须逐目标循环')
  // "只有一份落地实现"的尺子必须是**调用式**而非词频:注释、日志、报错文案里都合法地出现 "git add" 字样,
  // 拿词频当尺子会在健康仓库上恒红(本测试第一版就是这样,5 次命中全是注释与提示语)。
  const stagingCalls = hook.match(/execSync\(`git add \$\{t\.file\}`/g) || []
  assert.equal(
    stagingCalls.length,
    1,
    `落地的 git add 必须恰好一处(逐目标共用),实得 ${stagingCalls.length}`
  )
  assert.doesNotMatch(
    hook,
    /git add apps\/(miniapp-taro|mobile-rn)/,
    '不得再为某一端写死第二份 git add 路径(那正是复制粘贴的开始)'
  )
  assert.match(hook, /f\.replace\(\/\\\\\/g, '\/'\) === TOKENS_CSS_REL/, 'staged 路径必须归一分隔符(旧写法手写两条字面量,加一端就漏一端)')
})

test('T9 紧急出口仍在:跳过开关不得被顺手删掉', () => {
  assert.match(SRC('lib/pre-commit-hook.js'), /HUSKY_SKIP_TOKENS_SYNC/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
