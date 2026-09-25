// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-tool-display-resolvable.mjs 的镜像逻辑自检(§22c 精神:直接 import 源函数,不复制实现)。
 * 跑法:node --test scripts/tests/check-tool-display-resolvable.test.mjs
 *
 * 2026-09-26 随本门取材面收口一并改的两处(都是"测试断言的是磁盘,而磁盘属于别人"那一型):
 *  - 末条「装车证明」原用 readFileSync 扫真仓工作树 ⇒ 并行会话在 packages/i18n/** 的半编辑语料
 *    会让它红,而红与本仓任何一次提交都无关(实测今日即红在 ja.toolMcpBrowserNavigateActivity)。
 *    现改判 **HEAD blob**:断言一条没删,只是不再拿别人的在途改动当本仓债务。
 *  - 新增 F1–F4:面选择的纯函数四态、临时 git 仓里"索引≠磁盘 ⇒ 结论不同形"的构造证明、
 *    必需输入缺失时 exit 2 不回落、以及禁止再出现 `readFileSync(resolve(ROOT` 的形状锁。
 *  夹具一律落 `scripts/lib/scratch-dir.mjs`(工作树同盘 DevEnv/Temp),不落 C 盘活 TEMP、不落仓库树内。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import {
  mergeMessages,
  extractDisplayKeys,
  extractMcpActivityKeys,
  remoteLocaleList,
  decodeTaroBundle,
  readFaceInputs,
  inputRels,
  analyzeInputs,
  faceFromArgv,
  __test__ as gate,
} from '../check-tool-display-resolvable.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS_DIR, '..')

test('mergeMessages 保留仅存在于 override 的顶层命名空间(CLI 踩过的坑)', () => {
  const base = { taskStatus: { toolReadFile: '读取文件内容' }, a11y: { x: 'y' } }
  const override = {
    cli: { errorFileNotFound: '文件不存在: {path}' },
    taskStatus: { toolReadFile: '端内改写' },
  }
  const merged = mergeMessages(base, override)
  assert.equal(
    merged.cli.errorFileNotFound,
    '文件不存在: {path}',
    '只遍历 base 键会把 cli.* 整块吞掉',
  )
  assert.equal(merged.taskStatus.toolReadFile, '端内改写', 'override 优先')
  assert.equal(merged.taskStatus.a11y, undefined)
  assert.deepEqual(Object.keys(merged).sort(), ['a11y', 'cli', 'taskStatus'])
})

test('extractDisplayKeys 只认词表对象字面量里的映射行', () => {
  const src = [
    'const TOOL_DISPLAY_KEYS = {',
    "  read_file: 'toolReadFile',",
    "  browser_click_element: 'toolBrowserClickElement',",
    '}',
    'export function toolDisplayKey(n) { return TOOL_DISPLAY_KEYS[n] ?? null }',
  ].join('\n')
  assert.deepEqual(extractDisplayKeys(src), ['toolBrowserClickElement', 'toolReadFile'])
})

test('remoteLocaleList 从生成器源码取远程语言(离线包不含 zh-CN)', () => {
  const gen =
    "const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']\nfor (const l of REMOTE_LOCALES) {}"
  assert.deepEqual(remoteLocaleList(gen), ['en', 'ja', 'ko', 'zh-TW'])
  assert.equal(remoteLocaleList('没有常量'), null, '解析不到时返回 null 由调用方兜底,不得静默放行')
})

test('decodeTaroBundle 认裸键与加引号键,并对坏载荷返回 null(不假装通过)', () => {
  const payload = (obj) => gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')).toString('base64')
  const gen = [
    'export const remoteLocales = {',
    `  en: '${payload({ taskStatus: { toolReadFile: 'Read file contents' } })}',`,
    `  'zh-TW': '${payload({ taskStatus: { toolReadFile: '讀取檔案內容' } })}',`,
    '}',
  ].join('\n')
  const out = decodeTaroBundle(gen, ['en', 'zh-TW'])
  assert.equal(out.en.taskStatus.toolReadFile, 'Read file contents')
  assert.equal(out['zh-TW'].taskStatus.toolReadFile, '讀取檔案內容')
  assert.equal(decodeTaroBundle(gen, ['ja']).ja, null, '匹配不到载荷必须是 null,让守门判失败')
  assert.equal(
    decodeTaroBundle("en: 'H4sIAAAAAAAA-not-base64!!'", ['en']).en,
    null,
    '坏载荷不得抛错,必须判 null',
  )
})

test('extractMcpActivityKeys 只认 toolMcp 前缀的登记键,并对结构变更显式抛错', () => {
  const src = [
    'const SERVER_TOOL_ACTIVITY_KEYS = {',
    "const A = { x: { base: 'toolMcpGithubCreateIssueActivity' } }",
    "const B = { y: 'toolMcpServerGithubActivity', z: 1 }",
    "const noise = 'toolReadFile' // 非 toolMcp 前缀不算本表取材",
    "export const EXPORTED = 'toolMcpToolGetFileActivity'",
  ].join('\n')
  assert.deepEqual(extractMcpActivityKeys(src), [
    'toolMcpGithubCreateIssueActivity',
    'toolMcpServerGithubActivity',
    'toolMcpToolGetFileActivity',
  ])
  assert.deepEqual(
    extractMcpActivityKeys('const SERVER_TOOL_ACTIVITY_KEYS = { x: 1 }'),
    [],
    '锚点在但一个键都没取到必须返回空数组,由调用方判失败(不得静默通过)',
  )
  assert.throws(
    () => extractMcpActivityKeys('没有锚点的源码'),
    /SERVER_TOOL_ACTIVITY_KEYS/,
    '锚点丢失必须抛错(格式变更不得静默放行),0 键由调用方判失败',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 装车证明:真仓 MCP 三层表的每个登记键都在 5 语言 shared taskStatus 取到值。
//
// 2026-09-26 改判 **HEAD blob**(原来用 readFileSync 扫工作树)。理由不是洁癖而是实测:
// 本仓共享工作树常年被并行会话的半编辑语料占据,原写法当日就红在
// `ja.toolMcpBrowserNavigateActivity 必须存在` —— 断言没错,尺子读错了东西:它把别人没写完的
// 语言包记成了本仓债务,而"与本次提交无关的恒红门"唯一结局是逼人 --no-verify、连带废掉全部守门
// (§12e 同型)。断言一条没删,只换了取材面。
// ─────────────────────────────────────────────────────────────────────────────
test('装车证明:真仓 MCP 三层表的每个登记键都在 5 语言 shared taskStatus 取到值', () => {
  const inputs = readFaceInputs(REPO_ROOT, 'head')
  const keys = extractMcpActivityKeys(inputs.get(gate.MCP_ACTIVITY_REL))
  assert.ok(keys.length >= 29, `取材不得为空表(实际 ${keys.length})`)
  for (const lang of gate.LANGS) {
    const pack =
      JSON.parse(inputs.get(`packages/i18n/messages/shared/${lang}.json`)).taskStatus ?? {}
    for (const key of keys) {
      const value = pack[key]
      assert.equal(typeof value, 'string', `${lang}.${key} 必须存在`)
      assert.notEqual(value, key, `${lang}.${key} 不得回显键名`)
      assert.match(value, /^\{\s*state,\s*select,/, `${lang}.${key} 必须是 state select 形态`)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 判定面(F1–F4)。口径与守门 36/124/93/rn-global-css-sync 同形:默认判 HEAD blob、
// --staged 判索引 blob、--worktree 仅人工逃生舱、两面旗同给判死、取不到不回落。
// ─────────────────────────────────────────────────────────────────────────────

/** 演练仓里的 git:绝对路径来自取材层(不赌 PATH,§5b);autocrlf 关掉 —— 否则索引 blob 与盘上
 *  字节不等,三面比对的夹具会假红(守门 36/rn-global-css-sync 镜像测试同口径)。 */
function git(cwd, ...args) {
  return execFileSync(
    gitBinary(),
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-c',
      'core.autocrlf=false',
      '-c',
      'user.name=gate-fixture',
      '-c',
      'user.email=gate-fixture@invalid',
      '-C',
      cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** 一份**自洽**的最小语料:词表 1 键 + MCP 1 键 + 5 语言 ×(shared + 5 端)全齐 + 离线包 4 远程语言。 */
function corpusTexts() {
  const b64 = (obj) => gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')).toString('base64')
  const word = 'toolReadFile'
  const mcp = 'toolMcpDemoActivity'
  const texts = new Map()
  texts.set(
    gate.TOOL_DISPLAY_REL,
    `const TOOL_DISPLAY_KEYS = {\n  read_file: '${word}',\n}\nexport { TOOL_DISPLAY_KEYS }\n`,
  )
  texts.set(
    gate.MCP_ACTIVITY_REL,
    `const SERVER_TOOL_ACTIVITY_KEYS = {\n  demo: { base: '${mcp}' },\n}\nexport { SERVER_TOOL_ACTIVITY_KEYS }\n`,
  )
  texts.set(
    gate.TARO_GEN_SCRIPT_REL,
    "const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']\nexport default REMOTE_LOCALES\n",
  )
  const payload = (v) => b64({ taskStatus: { [word]: v } })
  texts.set(
    gate.TARO_BUNDLE_REL,
    [
      'export const remoteLocales = {',
      `  en: '${payload('Read file')}',`,
      `  'ja': '${payload('ファイルを読む')}',`,
      `  ko: '${payload('파일 읽기')}',`,
      `  'zh-TW': '${payload('讀取檔案')}',`,
      '}',
    ].join('\n'),
  )
  const value = (lang, tag) => `${tag}-${lang}`
  for (const lang of gate.LANGS) {
    texts.set(
      `packages/i18n/messages/shared/${lang}.json`,
      JSON.stringify({ taskStatus: { [word]: value(lang, 'shared'), [mcp]: value(lang, 'mcp') } }),
    )
    for (const dir of gate.END_DIRS) {
      texts.set(
        `packages/i18n/messages/${dir}/${lang}.json`,
        JSON.stringify({ taskStatus: { [word]: value(lang, dir) } }),
      )
    }
  }
  return { texts, word, mcp }
}

/** 把一个临时仓写到某一面该有的样子:全部候选路径落成文本(可剔除若干路径模拟缺输入)。 */
function writeCorpus(dir, texts, drop = []) {
  for (const rel of inputRels()) {
    if (drop.includes(rel)) continue
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, texts.get(rel), 'utf8')
  }
}

/**
 * 临时 git 仓:脚本连同它的相对 import 闭包拷进 <dir>/scripts(门按自身位置推 ROOT,
 * 不拷就会 ERR_MODULE_NOT_FOUND),好语料写到 dir 根,init + add + commit 成一个**好的**基线。
 *
 * `breakIndex: true` 复现本票立项那一刻的真实形态 —— 并行会话把坏语料 `git add` 了又继续改磁盘:
 *   HEAD 好 · 索引坏 · 磁盘好。
 * 三个面必须给出**互不相同**的答案,否则"面"这个字只是报告里的装饰。
 */
function createRepoEnv({ breakIndex = false } = {}) {
  const dir = mkScratch('tool-display-resolvable')
  copyScriptWithClosure(SCRIPTS_DIR, 'check-tool-display-resolvable.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
  ])
  const { texts } = corpusTexts()
  writeCorpus(dir, texts)
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'good baseline')
  if (breakIndex) {
    const broken = new Map(texts)
    for (const lang of ['ja', 'zh-TW'])
      broken.set(`packages/i18n/messages/shared/${lang}.json`, JSON.stringify({ taskStatus: {} }))
    writeCorpus(dir, broken)
    git(dir, 'add', '-A') // 索引 = 坏
    writeCorpus(dir, texts) // 磁盘回到好(HEAD 一直是好)
  }
  return dir
}

function runScript(tempDir, args = []) {
  return spawnSync(
    process.execPath,
    [join(tempDir, 'scripts', 'check-tool-display-resolvable.mjs'), ...args],
    {
      cwd: tempDir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

test('F1 faceFromArgv 默认必须是 head,四态齐全(把默认面改回磁盘的那一刻本条必红)', () => {
  assert.equal(faceFromArgv([]).face, 'head', '默认档回到磁盘 = 本门又在判滞后工作树')
  assert.equal(faceFromArgv(['--staged']).face, 'staged')
  assert.equal(faceFromArgv(['--worktree']).face, 'worktree')
  const both = faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree)
})

test('F2 readFaceInputs 三面各读各的:索引坏 / 磁盘好 / HEAD 好 ⇒ 三份内容互异', () => {
  const dir = createRepoEnv({ breakIndex: true })
  try {
    const rel = 'packages/i18n/messages/shared/ja.json'
    const staged = readFaceInputs(dir, 'staged')
    const wt = readFaceInputs(dir, 'worktree')
    const head = readFaceInputs(dir, 'head')
    assert.notEqual(
      staged.get(rel),
      wt.get(rel),
      '夹具本身必须让索引与磁盘互异,否则下面的差异可以是巧合',
    )
    assert.equal(staged.get(rel), JSON.stringify({ taskStatus: {} }))
    assert.equal(wt.get(rel), head.get(rel), '本夹具里磁盘与 HEAD 都是好语料(差异只在索引这一面)')
    assert.ok(
      analyzeInputs(staged).failures.some((f) => f.startsWith('shared/ja →')),
      '--staged 必须看见索引里那份坏语料(盘上随后改对不算修好)',
    )
    assert.equal(
      analyzeInputs(wt).failures.filter((f) => f.startsWith('shared/ja →')).length,
      0,
      '逃生舱面读磁盘,必须是另一份结论',
    )
    assert.equal(
      analyzeInputs(head).failures.length,
      0,
      'HEAD 面必须绿 —— 与本次提交无关的在途改动不得被记成债务',
    )
    // 必需输入被从索引摘走 ⇒ 抛 Undetermined,**不回落**到磁盘或 HEAD
    git(dir, 'rm', '--cached', '-q', '-f', '--', gate.TOOL_DISPLAY_REL)
    assert.throws(
      () => readFaceInputs(dir, 'staged'),
      (e) => /无法判定/.test(e.message) && e.constructor.name === 'Undetermined',
      '取不到必需输入时回落另一个面 = 把"没判"写成"判过了"',
    )
    // 同一瞬间 HEAD 面照常可判 ⇒ 判死精确绑定在缺失的那一面,不是整机罢工
    assert.ok(readFaceInputs(dir, 'head').get(gate.TOOL_DISPLAY_REL))
  } finally {
    rmScratch(dir)
  }
})

test('F3 CLI 三面各判各的:索引漂而磁盘好 ⇒ 默认绿、--staged 红、--worktree 绿;两面旗同给 ⇒ exit 2', () => {
  const dir = createRepoEnv({ breakIndex: true })
  try {
    const head = runScript(dir)
    assert.equal(head.status, 0, `默认档判 HEAD(好的那一份)\n${head.stdout}${head.stderr}`)
    assert.match(head.stdout, /取材面:HEAD blob/, '绿灯结论行必须写明判的是 HEAD')
    assert.match(head.stdout, /共比对 \d+ 项/, '结论行必须带计数(扫到 0 项却报绿要被看得见)')

    const staged = runScript(dir, ['--staged'])
    assert.equal(
      staged.status,
      1,
      `索引里是坏语料,--staged 必须红\n${staged.stdout}${staged.stderr}`,
    )
    assert.match(staged.stderr, /shared\/ja/, '必须点名索引里缺值的那一面/那语言')
    assert.match(staged.stderr, /Found \d+ 处取不到值\(取材面:索引 blob/, '红灯末行也必须写明面')

    const wt = runScript(dir, ['--worktree'])
    assert.equal(
      wt.status,
      0,
      `磁盘是好的,逃生舱档必须绿(与 staged 异形才证明两面各读各的)\n${wt.stdout}${wt.stderr}`,
    )

    const both = runScript(dir, ['--staged', '--worktree'])
    assert.equal(both.status, 2, '两面旗同给必须判死,不得任选一面冒充另一面')
    assert.match(both.stderr, /互斥/)

    const json = runScript(dir, ['--json'])
    assert.equal(JSON.parse(json.stdout).face, 'head', '--json 必须把面写进机读结果')
  } finally {
    rmScratch(dir)
  }
})

test('F4 形状锁:门本体不得再按磁盘读仓库内容,取材必须走共用层', () => {
  const src = readFileSync(join(SCRIPTS_DIR, 'check-tool-display-resolvable.mjs'), 'utf8')
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*resolve\(\s*ROOT/,
    '磁盘直读又回来了(resolve(ROOT,…) 那一型)',
  )
  assert.doesNotMatch(
    src,
    /readFileSync\(\s*join\(\s*ROOT/,
    '磁盘直读又回来了(join(ROOT,…) 那一型)',
  )
  assert.doesNotMatch(
    src,
    /from 'node:fs'/,
    '门本体不得自带磁盘读取 —— 磁盘面只走层的 readWorktreeFile',
  )
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '取材必须走共用层(绝对路径 git/超时/截断都由层兜)',
  )
  assert.match(src, /catBatch\(/, '内容必须经层的批量读取(一次派生,同面同轮)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
