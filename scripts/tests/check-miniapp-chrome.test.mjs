// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门 `scripts/check-miniapp-chrome.mjs` + 生成器 `scripts/sync-miniapp-chrome.mjs`
// §22c:判据函数**直接 import 源符号**,不在测试里复制第二份实现(复制的那份最先腐烂)。
//
// 本文件钉的是 self-test 钉不到的三类东西:
//   · 装车 —— 生成器真挂进 TOKEN_SYNC_TARGETS、门真注册进 guardian-runner(blocking + skipEnv + 编号唯一);
//   · CLI 端到端 —— 演练仓里真改 tokens.css 看两份副本跟不跟、真手改副本看门红不红点不点名;
//   · 判据方向 —— 登记表被静默摘除必须红(反向锁),取不到输入必须"未判定"而不是绿。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { __test__ as gate } from '../check-miniapp-chrome.mjs'
import { __test__ as gen } from '../sync-miniapp-chrome.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPTS_DIR = resolve(REPO, 'scripts')

const TOKENS = readFileSync(join(REPO, gen.TOKENS_SOURCE_REL), 'utf8')
const THEME_JSON = readFileSync(join(REPO, gen.THEME_JSON_REL), 'utf8')
const THEME_TS = readFileSync(join(REPO, gen.THEME_TS_REL), 'utf8')

/** 在演练仓里造一份"三件套齐全"的仓库骨架(scripts/ 闭包 + 两份副本 + tokens.css)。 */
function buildScratch({ tokensCss = TOKENS, themeJson = THEME_JSON, themeTs = THEME_TS } = {}) {
  const dir = mkScratch('miniapp-chrome')
  // 闭包入口取**门**:门的相对 import 链含生成器与两份共用层 ⇒ 一次拷贝 CLI 三面齐备
  // (上一版只拷生成器,T4/T5/T8 的 `node scripts/check-miniapp-chrome.mjs` 全部 MODULE_NOT_FOUND ——
  // 而"夹具跑不通"绝不等于"判据通过")。
  copyScriptWithClosure(SCRIPTS_DIR, 'check-miniapp-chrome.mjs', join(dir, 'scripts'), [
    'sync-miniapp-chrome.mjs',
    'lib/design-token-blocks.mjs',
    'check-cross-end-tokens.mjs',
    'lib/face-reader.mjs',
  ])
  const tokDir = join(dir, 'packages', 'design-tokens', 'src', 'styles')
  mkdirSync(tokDir, { recursive: true })
  writeFileSync(join(tokDir, 'tokens.css'), tokensCss)
  const srcDir = join(dir, 'apps', 'miniapp-taro', 'src', 'lib')
  mkdirSync(srcDir, { recursive: true })
  writeFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'theme.json'), themeJson)
  writeFileSync(join(srcDir, 'theme.ts'), themeTs)
  return dir
}

function runCli(dir, script, args = []) {
  const r = spawnSync(process.execPath, [join(dir, 'scripts', script), ...args], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

// ─── T1 装车:生成器挂进 TOKEN_SYNC_TARGETS(触发面 tokens、两份副本同进同退) ───
test('T1 pre-commit-hook 的 TOKEN_SYNC_TARGETS 真有 miniapp-chrome 这一行且形状正确', () => {
  const hook = readFileSync(join(SCRIPTS_DIR, 'lib', 'pre-commit-hook.js'), 'utf8')
  const m = /label: '[^']*chrome[^']*',\s*\n\s*file: '([^']+)',\s*\n\s*cmd: 'node scripts\/sync-miniapp-chrome\.mjs --quiet',\s*\n\s*trigger: 'tokens',\s*\n\s*failMode: '(block|warn)',/.exec(hook)
  assert.ok(m, 'TOKEN_SYNC_TARGETS 里找不到 sync-miniapp-chrome 的注册块(或字段顺序漂了)')
  const files = m[1].split(' ')
  assert.deepEqual(
    files.sort(),
    [gen.THEME_JSON_REL, gen.THEME_TS_REL].sort(),
    'file 必须同时含 theme.json 与 lib/theme.ts —— 漏一份 = 那份永不自动入库'
  )
  assert.equal(m[2], 'block', '本门立项当日已证 --check exit 0 且连跑两次 0 字节;若改成 warn 必须补新的不阻塞依据')
})

// ─── T2 装车:守门注册进 guardian-runner,编号唯一 ───
test('T2 guardian-runner 里 check-miniapp-chrome 已注册为 blocking + skipEnv,且 id 不撞号', () => {
  const runner = readFileSync(join(SCRIPTS_DIR, 'guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf("script: 'check-miniapp-chrome.mjs'")
  assert.ok(at > 0, 'guardian-runner 没有注册 check-miniapp-chrome.mjs(门存在但无人跑 = 门不存在)')
  // 注册块 = 从该 script 行向前找本条目的 `id:`、向后找下一条 `id:`(onFailHint 很长,不能按窗口截)
  const head = runner.lastIndexOf('id:', at)
  const nextId = runner.indexOf("\n    id: '", at)
  const block = runner.slice(head, nextId === -1 ? runner.length : nextId)
  const m = /^id: '(\d+)',/.exec(block.trimStart())
  assert.ok(m, `注册块里读不到 id(前 80 字符:${block.slice(0, 80)})`)
  const id = m[1]
  assert.equal((runner.match(new RegExp(`id: '${id}',`, 'g')) || []).length, 1, `id ${id} 撞号`)
  assert.match(block, /mode: 'blocking'/, '必须 blocking')
  assert.match(block, /skipEnv: 'HUSKY_SKIP_MINIAPP_CHROME'/, '必须有应急跳过 env')
})

// ─── T3 阳性对照(端到端):改 tokens.css 一处 → 两份副本必须都跟着变,其余逐行原位 ───
test('T3 演练仓里改 --color-brand-accent 跑生成器 ⇒ theme.json 与 theme.ts 同步且不动旁', () => {
  const moved = TOKENS.replace('--color-brand-accent: #8fb8cc;', '--color-brand-accent: #135799;')
  assert.notEqual(moved, TOKENS, '夹具失效:改不动源 token')
  const dir = buildScratch({ tokensCss: moved })
  try {
    const run = runCli(dir, 'sync-miniapp-chrome.mjs')
    assert.equal(run.code, 0, run.out)
    const json = readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'theme.json'), 'utf8')
    const ts = readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'lib', 'theme.ts'), 'utf8')
    assert.ok(json.includes('"tabSelectedColor": "#135799"'), 'theme.json 没跟上源 token')
    assert.ok(ts.includes("tabSelected: '#135799'"), 'theme.ts 没跟上源 token')
    // 原位写回:除这两行外其余行必须与原件逐字节相同(行数也不许变)
    const diffLines = (a, b) => a.split('\n').filter((l, i) => l !== b.split('\n')[i]).length
    assert.equal(json.split('\n').length, THEME_JSON.split('\n').length, 'theme.json 行数变了(整块替换回潮)')
    assert.equal(diffLines(json, THEME_JSON), 1, 'theme.json 被多改了行')
    assert.equal(diffLines(ts, THEME_TS), 1, 'theme.ts 被多改了行(注释/横幅/业务色必须逐字留在原位)')
  } finally {
    rmScratch(dir)
  }
})

// ─── T4 幂等:第二次跑必须 0 字节 ───
test('T4 写回后重跑生成器 ⇒ exit 0 且两份副本 0 字节变化', () => {
  const moved = TOKENS.replace('--color-brand-accent: #8fb8cc;', '--color-brand-accent: #135799;')
  const dir = buildScratch({ tokensCss: moved })
  try {
    assert.equal(runCli(dir, 'sync-miniapp-chrome.mjs').code, 0)
    const j1 = readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'theme.json'))
    const t1 = readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'lib', 'theme.ts'))
    const again = runCli(dir, 'sync-miniapp-chrome.mjs')
    assert.equal(again.code, 0, again.out)
    assert.deepEqual([...readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'theme.json'))], [...j1])
    assert.deepEqual([...readFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'lib', 'theme.ts'))], [...t1])
    const chk = runCli(dir, 'check-miniapp-chrome.mjs', ['--check'])
    assert.equal(chk.code, 0, `写回后守门仍判漂移:${chk.out}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── T5 阴性对照:手改副本 ⇒ 守门红且点名文件 ───
test('T5 手改两份副本各一处 ⇒ 门 exit 1 且逐一点名文件与字段', () => {
  const badJson = THEME_JSON.replace('"tabSelectedColor": "#8fb8cc"', '"tabSelectedColor": "#ff0000"')
  const badTs = THEME_TS.replace("windowBg: '#f5f5f5',", "windowBg: '#00ff00',")
  assert.notEqual(badJson, THEME_JSON)
  assert.notEqual(badTs, THEME_TS)
  const dir = buildScratch({ themeJson: badJson, themeTs: badTs })
  try {
    const r = runCli(dir, 'check-miniapp-chrome.mjs')
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /drifted .*theme\.json light\.tabSelectedColor/, r.out)
    assert.match(r.out, /drifted .*theme\.ts light\.windowBg/, r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T6 登记表不可被静默摘除(反向锁):删一条登记 ⇒ unregistered 红 ───
test('T6 摘掉一条 CHROME_DECLARED_DIVERGENCE ⇒ 两份副本都判 unregistered(门 import 的是活表)', () => {
  const saved = gen.CHROME_DECLARED_DIVERGENCE.dark.navBg
  try {
    delete gen.CHROME_DECLARED_DIVERGENCE.dark.navBg
    const v = gen.checkChrome({ tokensCss: TOKENS, themeJson: THEME_JSON, themeTs: THEME_TS })
    const un = v.failures.filter((f) => f.kind === 'unregistered')
    assert.equal(un.length, 2, JSON.stringify(v.failures.map((f) => f.kind + ':' + f.where)))
    assert.deepEqual(
      un.map((f) => f.target).sort(),
      [gen.THEME_JSON_REL, gen.THEME_TS_REL].sort(),
      '两份副本必须都被点名(只盯一份 = 另一份可被静默摘表)'
    )
  } finally {
    gen.CHROME_DECLARED_DIVERGENCE.dark.navBg = saved
  }
  const back = gen.checkChrome({ tokensCss: TOKENS, themeJson: THEME_JSON, themeTs: THEME_TS })
  assert.equal(back.failures.length, 0, '放回登记后必须归绿(夹具自洁)')
})

// ─── T7 腐烂判据端到端:登记值与 nearToken 重新同值 ⇒ 红(且 classifyFailures 记作红,不是未判定) ───
test('T7 源头 .dark background 落到 #262626 ⇒ 登记表腐烂判红', () => {
  const convergedDark = TOKENS.replace('--color-background: hsl(0 0% 14%);', '--color-background: #262626;')
  assert.notEqual(convergedDark, TOKENS, '夹具失效:.dark background 改不动')
  const v = gen.checkChrome({ tokensCss: convergedDark, themeJson: THEME_JSON, themeTs: THEME_TS })
  const { red, undetermined } = gate.verdictOf(v)
  assert.equal(undetermined.length, 0, '腐烂是"不再成立的分歧",必须判红而不是未判定')
  assert.equal(red.length, 4, JSON.stringify(red.map((f) => f.kind + ':' + f.where)))
  assert.ok(red.every((f) => f.kind === 'rot'))
})

// ─── T8 取不到输入 ⇒ 未判定(exit 2),绝不记绿 ───
test('T8 副本文件缺失 ⇒ 门 exit 2 且喊「无法判定」', () => {
  const dir = buildScratch()
  try {
    writeFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'theme.json'), '')
    const r = runCli(dir, 'check-miniapp-chrome.mjs')
    assert.equal(r.code, 2, r.out)
    assert.match(r.out, /无法判定|结构不认识/, r.out)
  } finally {
    rmScratch(dir)
  }
})

// ─── T9 反恒红:真仓此刻三面全绿 ───
test('T9 真仓默认(磁盘)/ --staged(索引)/ 生成器 --check 三面均 exit 0', () => {
  const faces = [
    ['check-miniapp-chrome.mjs', []],
    ['check-miniapp-chrome.mjs', ['--staged']],
    ['sync-miniapp-chrome.mjs', ['--check']],
  ]
  for (const [script, a] of faces) {
    const r = runCli(REPO, script, a)
    assert.equal(r.code, 0, `${script} ${a.join(' ')} ⇒ ${r.code}\n${r.out}`)
  }
})

// ─── T10 §22d:本文件 import 两份实现时不得触碰真仓副本(顶部的 import 已经跑过) ───
test('T10 import 门/生成器无写盘副作用(真仓副本此刻仍与磁盘对账一致)', () => {
  const j = readFileSync(join(REPO, gen.THEME_JSON_REL), 'utf8')
  const t = readFileSync(join(REPO, gen.THEME_TS_REL), 'utf8')
  assert.equal(j, THEME_JSON)
  assert.equal(t, THEME_TS)
  const v = gen.checkChrome({ tokensCss: TOKENS, themeJson: j, themeTs: t })
  assert.equal(v.failures.length, 0, JSON.stringify(v.failures))
})

// ─── T11 单实现哨兵:转换器与取源都不许长出第二份 ───
test('T11 新文件不得自带 hsl 转换器或首个非贪婪取块正则(必须走两份共用实现)', () => {
  for (const rel of ['sync-miniapp-chrome.mjs', 'check-miniapp-chrome.mjs']) {
    const src = readFileSync(join(SCRIPTS_DIR, rel), 'utf8')
    assert.equal(/function hslToHex|function normalizeColor\b/.test(src), false, `${rel} 长出了第二份转换器`)
    // 旧取法的字面量就是 `/@theme\s*\{([\s\S]*?)\}/` —— 用字符串包含探,别再用正则嵌正则
    assert.equal(src.includes('@theme\\s*\\{([\\s\\S]*?)\\}'), false, `${rel} 用回"首个非贪婪块"的旧取法`)
    assert.match(src, /design-token-blocks|check-miniapp-chrome\.mjs|sync-miniapp-chrome\.mjs/, `${rel} 必须经共用层/生成器取源`)
  }
  assert.match(readFileSync(join(SCRIPTS_DIR, 'sync-miniapp-chrome.mjs'), 'utf8'), /from '\.\/check-cross-end-tokens\.mjs'/)
})

// ─── T12 大小写不是色值:真仓 #A3A3A3 若被判"该改写",首跑就不是 0 字节(本票验收线) ───
test('T12 syncCopies 对真仓现状 0 改写(首跑不产伪 diff,#A3A3A3 原字节保留)', () => {
  const s = gen.syncCopies({ tokensCss: TOKENS, themeJson: THEME_JSON, themeTs: THEME_TS })
  assert.equal(s.nextJson, THEME_JSON, 'theme.json 被首跑改写(检查大小写保留逻辑)')
  assert.equal(s.nextTs, THEME_TS, 'theme.ts 被首跑改写')
  assert.equal(s.jsonRewrites.length + s.tsRewrites.length + s.blocking.length + s.undetermined.length, 0)
})

// ─── T13 本文件必须是测试本体,不是守门脚本的整文件副本(§门 36 T13 同型) ───
test('T13 本路径是测试,不是被误写进来的门本体', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(self, /^import \{ test \} from 'node:test'$/m)
  const gateSrc = readFileSync(join(SCRIPTS_DIR, 'check-miniapp-chrome.mjs'), 'utf8')
  assert.notEqual(self, gateSrc, '门被误写进测试路径(整文件错位)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
