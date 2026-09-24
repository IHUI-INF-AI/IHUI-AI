// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// workspace 依赖链接对账回归测试(守门 78)
//
// 成因:2026-09-23 生产停摆 —— apps/extension 声明 `@ihui/design-tokens: workspace:*`
// 而 node_modules 里没有该链接(§12e 的 `pnpm install --filter` 后遗症)。部署环
// `pnpm -r build` 在 rollup 阶段 failed to resolve → 连续构建失败 → 冷却循环,线上停在旧提交;
// 而 typecheck/lint/单测全绿(TS 走 tsconfig paths,不看 node_modules)。
// 本测试钉住:①真仓当前不变量;②夹具正/反对照(缺链接必红、补上必绿);
// ③**装车证明** —— guardian-runner 必须真的注册了这道门(§22c「造好没装车」教训)。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-workspace-dep-links.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('__test__ 出口齐备(§22c 锚点)', () => {
  for (const fn of [
    'parseWorkspacePatterns',
    'expandPatterns',
    'workspaceDepsOf',
    'findMissingLinks',
    'findGuttedLinks',
    'lintStagedCommands',
    'findUnresolvableHookCommands',
  ]) {
    assert.equal(typeof gate[fn], 'function', `缺少导出 ${fn}`)
  }
})

test('第四型(2026-09-24 全机停摆的直接指纹)**双向**:包体在而 shim 没了必须判红', () => {
  // 这台尺子必须在"故障现场"报红:`node_modules/eslint` 内容完好、能直接 node 跑出 v10.8.1,
  // 但 `node_modules/.bin/eslint(.CMD)` 没了 ⇒ lint-staged 按 PATH 找 eslint 报
  // 「不是内部或外部命令」。若把"`node_modules/<cmd>` 目录存在"当作通过,这条红就永远测不出来。
  const root = mkdtempSync(join(tmpdir(), 'ihui-hookcmd-test-'))
  try {
    mkdirSync(join(root, 'node_modules', 'eslint', 'node_modules'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'eslint', 'package.json'), JSON.stringify({ name: 'eslint' }))
    assert.deepEqual(
      gate.findUnresolvableHookCommands(root, ['eslint']).map((x) => x.cmd),
      ['eslint'],
      '包体在、shim 没了必须判红',
    )
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true })
    writeFileSync(join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.CMD' : 'eslint'), '@ECHO off\n')
    assert.deepEqual(gate.findUnresolvableHookCommands(root, ['eslint']), [], '补上 shim 后必须归零')
    // 命令集来源:lint-staged 配置三种形态都要能提出命令名,node/pnpm 前缀不参与
    const cmds = gate.lintStagedCommands({ 'lint-staged': { '*.ts': 'eslint --fix', '*.js': ['node a.mjs'] } })
    assert.ok(cmds.includes('eslint') && !cmds.includes('node'), `命令名提取不对: ${cmds.join(',')}`)
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 })
  }
})

test('链接完整性判据(掏空/悬空)夹具**双向**:空目标必红、完好目标必绿', () => {
  // 2026-09-24 全机门禁停摆的第二型:链接在、目标被掏空。existsSync 对这一型返回 true,
  // 所以旧判据(findMissingLinks)恒绿 —— 本用例钉住"新判据真的在看内容"。
  const root = mkdtempSync(join(tmpdir(), 'ihui-gutted-test-'))
  try {
    mkdirSync(join(root, 'store', 'good', 'node_modules', 'good'), { recursive: true })
    writeFileSync(join(root, 'store', 'good', 'node_modules', 'good', 'package.json'), JSON.stringify({ name: 'good' }))
    mkdirSync(join(root, 'store', 'hollow', 'node_modules', 'hollow'), { recursive: true }) // 空目录
    mkdirSync(join(root, 'node_modules', '@sc'), { recursive: true })
    const link = (target, name) => symlinkSync(join(root, 'store', target), join(root, 'node_modules', name), 'dir')
    link('good/node_modules/good', 'good')
    link('hollow/node_modules/hollow', 'hollow')
    link('ghost/node_modules/ghost', 'ghost') // 悬空
    link('good/node_modules/good', '@sc/good')
    link('hollow/node_modules/hollow', '@sc/hollow')

    const { gutted, scanned } = gate.findGuttedLinks(root, [])
    assert.equal(scanned, 5, `应扫到 5 条链接, got ${scanned}`)
    assert.deepEqual(
      gutted.map((x) => x.link).sort(),
      ['node_modules/@sc/hollow', 'node_modules/ghost', 'node_modules/hollow'],
      `红点清单不对: ${JSON.stringify(gutted)}`,
    )
    assert.equal(gutted.find((x) => x.link === 'node_modules/ghost').kind, '悬空')
    assert.equal(gutted.find((x) => x.link === 'node_modules/hollow').kind, '掏空')
    // 反向对照:existsSync 对"掏空"仍为 true ⇒ 钉住旧判据看不见这一型的前提
    assert.ok(existsSync(join(root, 'node_modules', 'hollow')), 'existsSync 对空目标应为 true,否则本用例前提不成立')
    // 全部补齐 → 必绿(可反复检出)
    rmSync(join(root, 'node_modules', 'hollow'), { force: true })
    rmSync(join(root, 'node_modules', 'ghost'), { force: true })
    rmSync(join(root, 'node_modules', '@sc', 'hollow'), { force: true })
    assert.deepEqual(gate.findGuttedLinks(root, []).gutted, [], '补齐后仍报红 = 判据不成立')
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 })
  }
})

test('真仓:workspace patterns 与包目录展开均非空', () => {
  const pats = gate.parseWorkspacePatterns(readFileSync(join(REPO, 'pnpm-workspace.yaml'), 'utf8'))
  assert.ok(pats.length >= 2, `patterns 只有 ${pats.length} 条,解析疑似失效`)
  assert.ok(
    pats.every((p) => !p.startsWith('!')),
    '取反项不得参与展开',
  )
  const dirs = gate.expandPatterns(REPO, pats)
  assert.ok(dirs.length >= 20, `只展开出 ${dirs.length} 个包,判据在空集上会假绿`)
})

test('真仓不变量:所有 workspace:* 声明均已链接', () => {
  const dirs = gate.expandPatterns(REPO, gate.parseWorkspacePatterns(readFileSync(join(REPO, 'pnpm-workspace.yaml'), 'utf8')))
  const missing = gate.findMissingLinks(REPO, dirs)
  assert.notEqual(missing, null, '根 node_modules 不存在 —— 本机未安装依赖,先跑 pnpm install 再跑本测试')
  assert.deepEqual(missing, [], `声明未链接:${JSON.stringify(missing)}`)
})

test('夹具反向对照:声明未链接必红,补上链接必绿', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-deplink-test-'))
  try {
    mkdirSync(join(root, 'packages', 'aa'), { recursive: true })
    mkdirSync(join(root, 'apps', 'bb'), { recursive: true })
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n")
    writeFileSync(join(root, 'packages', 'aa', 'package.json'), JSON.stringify({ name: '@ihui/aa' }))
    writeFileSync(
      join(root, 'apps', 'bb', 'package.json'),
      JSON.stringify({ name: '@ihui/bb', devDependencies: { '@ihui/aa': 'workspace:^' } }),
    )
    const dirs = gate.expandPatterns(root, ['apps/*', 'packages/*'])
    assert.equal(dirs.length, 2, '夹具必须真生成 2 个包,否则断言是空转')

    const red = gate.findMissingLinks(root, dirs)
    assert.equal(red.length, 1, `缺链接时应判红 1 处, got ${red.length}`)
    assert.equal(red[0].pkg, '@ihui/bb')
    assert.equal(red[0].dep, '@ihui/aa', 'devDependencies 里的 workspace: 声明同样要判')

    mkdirSync(join(root, 'apps', 'bb', 'node_modules', '@ihui', 'aa'), { recursive: true })
    assert.deepEqual(gate.findMissingLinks(root, dirs), [], '补上链接后应归零')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('夹具:根 node_modules 缺失时返回 null(未安装 ≠ 装歪,不得混作绿灯结论)', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-deplink-none-'))
  try {
    mkdirSync(join(root, 'apps', 'bb'), { recursive: true })
    writeFileSync(join(root, 'apps', 'bb', 'package.json'), JSON.stringify({ name: '@ihui/bb' }))
    assert.equal(gate.findMissingLinks(root, gate.expandPatterns(root, ['apps/*'])), null)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('装车证明:guardian-runner 已注册守门 78 且为 blocking', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  // 注册块含 onFailHint 多行提示,窗口要给够(曾因 400 太窄把在位的闸判成"没装车")
  const block = runner.match(/id:\s*'78',[\s\S]{0,2500}?\n {2}\},/)
  assert.ok(block, '未找到守门 78 注册块 —— 脚本存在但没接上守门链等于没有闸')
  assert.match(block[0], /script:\s*'check-workspace-dep-links\.mjs'/)
  assert.match(block[0], /mode:\s*'blocking'/)
  assert.match(block[0], /skipEnv:\s*'HUSKY_SKIP_WORKSPACE_DEP_LINKS'/)
})

test('自检入口可用(--self-test 退出码 0)', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-workspace-dep-links.mjs'), '--self-test'],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000 },
  )
  assert.match(out, /--self-test \d+\/\d+ 通过/)
  assert.doesNotMatch(out, /❌ .*— /, '自检存在失败用例')
  assert.ok(existsSync(join(REPO, 'scripts', 'check-workspace-dep-links.mjs')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
