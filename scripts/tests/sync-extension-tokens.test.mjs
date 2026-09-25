// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/sync-extension-tokens.test.mjs — §22c 镜像测试。
 *
 * 装的是三件事:
 *  1. **判据有牙**:拿真仓 HEAD 那份**已知落后**的副本喂判据必须报红(否则"0 处"只是探针没响);
 *  2. **判据不恒红**:拿派生态喂同一条判据必须零红(恒红门 = 逼人 --no-verify = 全部守门作废);
 *  3. **写回不吞内容**:相对 HEAD 逐位比受管键的**名字序列**,少一个 / 多一个 / 改序都判失败。
 *
 * 另外钉两条"这票到底做了什么"的反向回归锁:
 *  - 取值只能有一份实现(源码里不得出现自建的 @theme/:root 块正则);
 *  - 门 93 未被本票顺手改动(可选项选择了"不做"就必须能被机器复核)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = (spec) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'show', spec], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    cwd: ROOT,
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const SELF_REL = 'scripts/sync-extension-tokens.mjs'
const SOURCE_REL = 'packages/design-tokens/src/styles/tokens.css'
// T1 的前提:先抓磁盘快照,再 import,证明 import 不写盘(§22d)
const pre = {
  'apps/extension/entrypoints/content.ts': readFileSync(join(ROOT, 'apps/extension/entrypoints/content.ts'), 'utf8'),
  'apps/extension/entrypoints/content/content-toolbar.tsx': readFileSync(
    join(ROOT, 'apps/extension/entrypoints/content/content-toolbar.tsx'),
    'utf8'
  ),
  [SOURCE_REL]: readFileSync(join(ROOT, SOURCE_REL), 'utf8'),
}
const S = (await import('../sync-extension-tokens.mjs')).__test__
const post = Object.fromEntries(Object.keys(pre).map((rel) => [rel, readFileSync(join(ROOT, rel), 'utf8')]))

test('T1 import 本脚本不得有写盘副作用(§22d isDirectRun)', () => {
  assert.equal(typeof S, 'object', '__test__ 必须是对象')
  for (const rel of Object.keys(pre))
    assert.equal(post[rel], pre[rel], `import 后 ${rel} 必须逐字节不变`)
})

test('T2 §22c 锚点:核心判据与三张登记表必须全部导出', () => {
  for (const k of [
    'sourceTables',
    'colorDecls',
    'derivableDecls',
    'checkCopies',
    'checkShadow',
    'assertSafeRewrite',
    'planRewrites',
    'runCheck',
    'EXTENSION_ONLY_KEYS',
    'DECLARED_DIVERGENCE',
    'SHADOW_DIVERGENCE',
    'COPY_FILES',
    'SHADOW_BLOCKS',
  ])
    assert.ok(k in S, `__test__ 缺键 ${k}`)
})

test('T3 单一实现:取值只能走 scripts/lib/design-token-blocks.mjs', () => {
  const src = readFileSync(join(ROOT, SELF_REL), 'utf8')
  assert.ok(/from '\.\/lib\/design-token-blocks\.mjs'/.test(src), '必须 import 唯一那份取块实现')
  assert.ok(/collectVars\(/.test(src), 'tokens.css 取值必须走 collectVars')
  // 反向回归锁:自建块正则(/@theme\s*\{/ 这类)一旦回来,就是"生成器与守门各写一遍、
  // 两遍不同形"那一类缺陷的复发 —— 门 84 的"整轮豁免那句写法不得回来"是同一个手法。
  assert.ok(!/\/@theme/.test(src), '不得出现自写的 @theme 取块正则(取值只能有一份实现)')
  assert.ok(!/extractAllBlocks\s*\(\s*[^,]+,\s*'@theme/.test(src), '@theme 块只能由 lib 解析')
  // 尺子自己要有牙:上面两条若写成恒真,留着的只是安慰剂。用构造文本各证一次"这种写法会被抓到"。
  const forbidden = "const re = /@theme\\s*\\{([\\s\\S]*?)\\}/\ncall(extractAllBlocks(css, '@theme'))"
  assert.ok(/\/@theme/.test(forbidden), 'T3 第 1 条尺子失效(样例没被抓到)')
  assert.ok(/extractAllBlocks\s*\(\s*[^,]+,\s*'@theme/.test(forbidden), 'T3 第 2 条尺子失效(样例没被抓到)')
})

test('T4 阳性对照:真仓 HEAD 那份落后的副本必须被判出漂移', () => {
  const head = S.planRewrites
  assert.ok(typeof head === 'function')
  const tables = S.sourceTables(pre[SOURCE_REL])
  const texts = S.COPY_FILES.map((rel) => [rel, GIT(`HEAD:${rel}`)])
  const r = S.checkCopies({ texts, tables })
  const d1 = r.failures.filter((f) => f.tag.startsWith('D1'))
  assert.ok(d1.length >= 1, `HEAD 副本已知落后(4 档未对齐),判据必须报红,实得 ${d1.length} 条`)
  assert.ok(d1.every((f) => f.detail.includes('sync-extension-tokens')), '每条漂移必须给出可执行的修复出口')
})

test('T5 反向对照:同一份判据吃派生态必须零红(证明它不是恒红门)', () => {
  const tables = S.sourceTables(post[SOURCE_REL])
  const r = S.checkCopies({ texts: Object.entries(post).filter(([rel]) => S.COPY_FILES.includes(rel)), tables })
  assert.deepEqual(
    r.failures.map((f) => f.tag),
    [],
    '工作树(已派生)必须零红,否则接线当天所有人的提交都会被拦'
  )
  assert.ok(r.counts.derived > 0, '至少要真的比对了派生档(0 = 判据没跑起来)')
})

test('T6 不吞内容:相对 HEAD,受管键的名字序列与条数必须逐位不变', () => {
  for (const rel of S.COPY_FILES) {
    const before = S.colorDecls(GIT(`HEAD:${rel}`))
    const after = S.colorDecls(post[rel])
    assert.equal(after.length, before.length, `${rel}: --color-* 声明条数变了`)
    const lost = before.map((d) => d.name).filter((n, i) => after[i]?.name !== n)
    assert.deepEqual(lost, [], `${rel}: 有键被删除/改序 ⇒ 首个失配 ${lost[0]}`)
    assert.equal(
      S.otherCustomProps(post[rel]).length,
      S.otherCustomProps(GIT(`HEAD:${rel}`)).length,
      `${rel}: 非 --color- 自定义属性(如 --shadow-*)条数变了`
    )
  }
})

test('T7 幂等:对当前工作树再跑一次写回计划必须零改动', () => {
  const tables = S.sourceTables(post[SOURCE_REL])
  const plan = S.planRewrites({
    copyTexts: S.COPY_FILES.map((rel) => [rel, post[rel]]),
    tables,
  })
  for (const step of plan) {
    assert.equal(step.changes.length, 0, `${step.rel} 仍判需改 ${step.changes.length} 档 ⇒ 不幂等`)
    assert.equal(step.after, step.before, `${step.rel} 目标文本与磁盘不一致 ⇒ 不幂等`)
    assert.deepEqual(S.assertSafeRewrite(step.before, step.after), [], `${step.rel} 安全断言失败`)
  }
})

test('T8 影子面:登记表逐条命中真文件,且 deriveFrom 指向的源头档真取得到', () => {
  const tables = S.sourceTables(post[SOURCE_REL])
  const rels = [...new Set(S.SHADOW_BLOCKS.map((b) => b.rel))]
  const texts = new Map(rels.map((rel) => [rel, post[rel] ?? GIT(`HEAD:${rel}`)]))
  const r = S.checkShadow({ texts, tables })
  assert.deepEqual(r.failures.map((f) => f.tag), [], `影子面必须零红,实得 ${JSON.stringify(r.failures.map((f) => f.tag))}`)
  assert.equal(r.counts.hit, Object.keys(S.SHADOW_DIVERGENCE).length, '每条登记都必须在这两个块里被找到(防腐烂)')
  for (const [id, e] of Object.entries(S.SHADOW_DIVERGENCE)) {
    assert.ok(typeof e.reason === 'string' && e.reason.length > 20, `${id}: 登记必须写依据,不得空口径`)
    if (e.deriveFrom) {
      const prof = id.startsWith('.dark') ? 'dark' : 'light'
      assert.ok(tables[prof].has(e.deriveFrom), `${id} 的 deriveFrom 指向 ${e.deriveFrom},源头取不到 = 空头依据`)
    }
  }
  for (const [k, e] of Object.entries(S.DECLARED_DIVERGENCE))
    assert.ok(typeof e.reason === 'string' && e.reason.length > 20, `${k}: 分歧登记必须写依据`)
})

test('T9 可选项未做必须可复核:门 93 没被本票顺手改动', () => {
  const g93Rel = 'scripts/check-cross-end-tokens.mjs'
  const now = readFileSync(join(ROOT, g93Rel), 'utf8')
  assert.ok(!/sync-extension-tokens/.test(now), `本票未把判据塞进 ${g93Rel}(若将来塞了,请删掉这条并改判方向)`)
})

test('T10 取不到判定面一律"无法判定",不冒红也不记绿', () => {
  assert.throws(
    () => S.checkShadow({ texts: new Map(), tables: S.sourceTables(pre[SOURCE_REL]) }),
    (e) => e instanceof S.Undetermined,
    '影子文件缺失必须抛 Undetermined(exit 2 路径),不得当成"无需判定"'
  )
})

test('T11 副本的 CSS 在 JS 模板字符串里:反引号必须成对(本票自己踩过)', () => {
  // 我给 content-toolbar.tsx 补注释时在模板字面量内部写了两个反引号 ⇒ 直接关掉模板,
  // `pnpm --filter @ihui/extension typecheck` 报 TS1005,而派生判据/幂等/self-test 全绿
  // —— 因为它们都把这文件当**文本**看。这条尺子弱(只数奇偶),但它恰好抓得住那次事故。
  for (const rel of S.COPY_FILES) {
    const n = (post[rel].match(/`/g) || []).length
    assert.equal(n % 2, 0, `${rel}: 反引号 ${n} 个(奇数 ⇒ 模板字面量被注释里的反引号截断)`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
