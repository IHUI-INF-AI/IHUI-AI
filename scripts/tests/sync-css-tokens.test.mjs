// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/sync-css-tokens.test.mjs — `scripts/sync-css-tokens.mjs` 的镜像测试。
 *
 * 判的是「生成器在真夹具上的行为」,不是「判据的形状」:
 *  T1 幂等 —— 连跑两次 --write,第二次零字节;--check 读到的是一致
 *  T2 差异检出 —— 手改受管块一个值,--check 必须 exit 1 并点名那一档
 *  T3 受管块缺失 —— --check 判 1(缺),--write 把它插进 @theme 内、标记成对、块外字节逐字不变
 *  T4 未判定 —— 源文件缺失 / 表里有表达式 / 受管块被挪出 @theme,三种都必须 exit 2(绝不记绿)
 *  T5 纯函数面 —— parseObjectLiteral 只认字面量、diffManaged 三方向、renderManagedBlock 稳定
 *
 * 为什么用「拷脚本 + 夹具树」而不是直接在真仓跑:本脚本的 REPO_ROOT 由 import.meta.url 推出,
 * 拷进 <scratch>/scripts/ 后整棵树就归夹具管 —— 真仓的 tokens.css 一个字节都不会被测试碰到
 * (形状与 scripts/tests/check-design-tokens-sync.test.mjs 同)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  MANAGED_BEGIN,
  MANAGED_END,
  diffManaged,
  parseObjectLiteral,
  readManagedVars,
  renderManagedBlock,
  UndeterminedSource,
} from '../sync-css-tokens.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'sync-css-tokens.mjs')

const SPACING_TS = `export const SPACING_STEPS = {
  none: 0,
  /** 注释里带冒号与花括号也不能骗到解析器:{a:1} */
  xs: 4,
  md: 12,
  '2xl': 24,
} as const
`
const TYPO_TS = `export const TYPE_STEPS = {
  body: { size: 14, lineHeight: 20, weight: 400 },
  displayLg: { size: 30, lineHeight: 38, weight: 700 },
} as const satisfies Record<string, TypeStep>
export const FONT_WEIGHTS = {
  regular: 400,
  semibold: 600,
} as const
`
const ELEV_TS = `export const ELEVATION_CSS: Record<string, string> = {
  none: 'none',
  md: '0 2px 8px rgba(0,0,0,0.08)',
}
`
const TOKENS_CSS = `/* 夹具:头部注释(改动必须逐字保留) */
@theme {
  --color-primary: hsl(0 0% 0%);
}

:root {
  --color-foreground-rgb: 10, 10, 10;
}
`

/** 建一个完整的夹具仓(脚本副本 + 三份 TS 源 + tokens.css),返回 { dir, tokensPath, srcFiles }。 */
function makeFixture({ tokensCss = TOKENS_CSS, dropSource = null, override = {} } = {}) {
  const dir = mkScratch('ihui-sync-css-tokens-')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SCRIPT, join(dir, 'scripts', 'sync-css-tokens.mjs'))
  const srcDir = join(dir, 'packages', 'design-tokens', 'src')
  mkdirSync(join(srcDir, 'styles'), { recursive: true })
  const files = {
    spacing: join(srcDir, 'spacing.ts'),
    typography: join(srcDir, 'typography.ts'),
    elevation: join(srcDir, 'elevation.ts'),
  }
  const body = { spacing: SPACING_TS, typography: TYPO_TS, elevation: ELEV_TS, ...override }
  for (const [key, rel] of Object.entries(files))
    if (key !== dropSource) writeFileSync(rel, body[key])
  const tokensPath = join(srcDir, 'styles', 'tokens.css')
  writeFileSync(tokensPath, tokensCss)
  return { dir, tokensPath }
}

/** 跑夹具里的脚本副本;返回 { code, out }。 */
function run(dir, args = []) {
  try {
    const out = execFileSync(
      process.execPath,
      [join(dir, 'scripts', 'sync-css-tokens.mjs'), ...args],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
        // 不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return { code: 0, out }
  } catch (e) {
    return {
      code: e.status === undefined ? -1 : e.status,
      out: `${e.stdout ?? ''}${e.stderr ?? ''}`,
    }
  }
}

/** @theme 的配对右括号下标(夹具里只有一个 `@theme {`)。 */
function themeCloseIndex(css) {
  let depth = 0
  for (let i = css.indexOf('{', css.indexOf('@theme')); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  throw new Error('夹具 tokens.css 的 @theme 块不闭合')
}

test('T1 幂等:连跑两次 --write,第二次零字节;--check 一致 exit 0', () => {
  const { dir, tokensPath } = makeFixture()
  try {
    const first = run(dir, ['--write'])
    assert.equal(first.code, 0, `首次 --write 应 exit 0,实得 ${first.code}:${first.out}`)
    const afterFirst = readFileSync(tokensPath, 'utf8')
    assert.ok(afterFirst.includes(MANAGED_BEGIN), '首次 --write 必须落下受管块')
    assert.ok(afterFirst.includes(MANAGED_END), '受管块标记必须成对')

    // 落值正确性:三族的样例档各查一条(值来自夹具源,不是硬编码期望表)
    assert.match(afterFirst, /--spacing-md: 12px;/)
    assert.match(afterFirst, /--text-display-lg: 30px;/)
    assert.match(afterFirst, /--text-display-lg--line-height: 38px;/)
    assert.match(afterFirst, /--font-weight-semibold: 600;/)
    assert.match(afterFirst, /--shadow-elevation-md: 0 2px 8px rgba\(0, 0, 0, 0\.08\);/)

    const second = run(dir, ['--write'])
    assert.equal(second.code, 0)
    assert.match(second.out, /零字节写回/, '等值必须不重写字节(幂等的可观测形式)')
    assert.equal(readFileSync(tokensPath, 'utf8'), afterFirst, '二次 --write 后字节必须完全一致')

    const check = run(dir, ['--check'])
    assert.equal(check.code, 0, `--check 应 exit 0:${check.out}`)
    assert.match(check.out, /一致/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T2 差异检出:手改受管块一个值 ⇒ --check exit 1 且点名那一档', () => {
  const { dir, tokensPath } = makeFixture()
  try {
    assert.equal(run(dir, ['--write']).code, 0)
    const synced = readFileSync(tokensPath, 'utf8')
    writeFileSync(tokensPath, synced.replace('--spacing-md: 12px;', '--spacing-md: 13px;'))

    const check = run(dir, ['--check'])
    assert.equal(check.code, 1, `手改后 --check 必须 exit 1,实得 ${check.code}:${check.out}`)
    assert.match(check.out, /--spacing-md/)
    assert.match(check.out, /13px/)
    assert.match(check.out, /12px/)
    // --check 只读:不许动文件
    assert.match(readFileSync(tokensPath, 'utf8'), /--spacing-md: 13px;/)

    // 源删档而 CSS 还留着(反方向漂移)repo 里是 --write 收敛、--check 判差异
    const reverted = run(dir, ['--write'])
    assert.equal(reverted.code, 0)
    assert.match(readFileSync(tokensPath, 'utf8'), /--spacing-md: 12px;/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T3 受管块缺失:--check 判 1;--write 插在 @theme 内,块外字节逐字不变', () => {
  const { dir, tokensPath } = makeFixture()
  try {
    const before = readFileSync(tokensPath, 'utf8')
    const check = run(dir, ['--check'])
    assert.equal(check.code, 1, `缺块时 --check 必须 exit 1(有差异),实得 ${check.code}`)
    assert.match(check.out, /受管块缺失/)
    assert.equal(readFileSync(tokensPath, 'utf8'), before, '--check 不得写盘')

    assert.equal(run(dir, ['--write']).code, 0)
    const after = readFileSync(tokensPath, 'utf8')
    const begin = after.indexOf(MANAGED_BEGIN)
    const end = after.indexOf(MANAGED_END)
    assert.ok(begin > 0 && end > begin, '标记必须成对且顺序正确')
    assert.ok(
      begin < themeCloseIndex(after),
      '受管块必须在 @theme 内 —— 落在 @theme 外等于自废工具类(v4 只认 @theme 里的 theme 键)',
    )
    // 块外逐字不变:把块整段摘掉,应与原文逐字相等
    const lineStart = after.lastIndexOf('\n', begin) + 1
    const lineStop = after.indexOf('\n', end) + 1
    const withoutBlock = `${after.slice(0, lineStart).replace(/\n$/, '\n')}${after.slice(lineStop)}`
    assert.equal(
      withoutBlock.replace(/\n{2,}/g, '\n'),
      before.replace(/\n{2,}/g, '\n'),
      '插入受管块不得改动块外任何字节(允许新增一个分隔空行)',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T4 未判定 exit 2:源缺失 / 表里有表达式 / 受管块被移出 @theme', () => {
  // (a) 源文件缺失
  {
    const { dir } = makeFixture({ dropSource: 'spacing' })
    try {
      const r = run(dir, ['--check'])
      assert.equal(r.code, 2, `源缺失必须 exit 2(未判定),实得 ${r.code}:${r.out}`)
      assert.match(r.out, /未判定/)
      assert.match(r.out, /spacing\.ts/)
      assert.equal(run(dir, ['--write']).code, 2, '--write 在未判定时也不得写盘')
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  }
  // (b) 表里有解析不了的表达式(只认字面量,不猜值)
  {
    const broken = `export const SPACING_STEPS = { xs: 4, md: BASE * 3 } as const\n`
    const { dir } = makeFixture({ override: { spacing: broken } })
    try {
      const r = run(dir, ['--check'])
      assert.equal(r.code, 2, `表达式必须判未判定,实得 ${r.code}:${r.out}`)
      assert.match(r.out, /解析不了的字面量/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  }
  // (c) 受管块被挪出 @theme:不静默重写,判未判定
  {
    const moved = `@theme {\n  --color-primary: hsl(0 0% 0%);\n}\n\n${renderManagedBlock([
      { family: 'spacing', name: '--spacing-md', value: '12px' },
    ])}`
    const { dir } = makeFixture({ tokensCss: moved })
    try {
      const r = run(dir, ['--check'])
      assert.equal(r.code, 2, `受管块在 @theme 外必须判未判定,实得 ${r.code}:${r.out}`)
      assert.match(r.out, /@theme/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  }
  // (d) 标记不成对:同样不猜
  {
    const half = `@theme {\n${MANAGED_BEGIN}\n  --spacing-md: 12px;\n}\n`
    const { dir } = makeFixture({ tokensCss: half })
    try {
      const r = run(dir, ['--check'])
      assert.equal(r.code, 2, `标记不成对必须判未判定,实得 ${r.code}:${r.out}`)
      assert.match(r.out, /不成对/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  }
})

test('T5 纯函数面:解析只认字面量 / diff 三方向 / 渲染字节稳定', () => {
  // 解析:嵌套 + 注释 + 引号键 + 尾逗号
  assert.deepEqual(
    parseObjectLiteral(`{
      // 行注释
      /** 块注释 {not:a object} */
      'a-b': 1,
      2xl: 24,
      nested: { size: 14, s: 'rgba(0,0,0,.08)' },
    }`).value,
    { 'a-b': 1, '2xl': 24, nested: { size: 14, s: 'rgba(0,0,0,.08)' } },
  )
  assert.throws(() => parseObjectLiteral('{ a: someVar }'), UndeterminedSource)
  assert.throws(() => parseObjectLiteral('{ a: `x${1}` }'), UndeterminedSource)

  const entries = [
    { family: 'spacing', name: '--spacing-md', value: '12px' },
    { family: 'shadow', name: '--shadow-elevation-md', value: 'none' },
  ]
  const vars = new Map([
    ['--spacing-md', '13px'],
    ['--hand-written', 'x'],
  ])
  const diff = diffManaged(vars, entries)
  assert.equal(diff.ok, false)
  assert.deepEqual(
    diff.mismatched.map((m) => [m.name, m.actual, m.value]),
    [['--spacing-md', '13px', '12px']],
  )
  assert.deepEqual(
    diff.missing.map((m) => m.name),
    ['--shadow-elevation-md'],
  )
  assert.deepEqual(diff.extra, ['--hand-written'])
  assert.equal(diffManaged(new Map(entries.map((e) => [e.name, e.value])), entries).ok, true)

  // 渲染:同入参两次调用必须逐字节相同(幂等的地基),且标记首尾成对
  const a = renderManagedBlock(entries)
  assert.equal(a, renderManagedBlock(entries))
  assert.equal(a.trim().startsWith(MANAGED_BEGIN), true)
  assert.equal(a.trim().endsWith(MANAGED_END), true)
  // 读回:渲染出来的块自己必须能被 readManagedVars 读成等值
  const read = readManagedVars(`@theme {\n${a}}\n`)
  assert.equal(read.present, true)
  assert.equal(read.vars.get('--spacing-md'), '12px')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
