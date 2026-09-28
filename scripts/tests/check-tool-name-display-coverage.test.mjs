// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * scripts/check-tool-name-display-coverage.mjs(守门 55)的镜像测试(§22c:直接 import 生产出口)。
 * 跑法:node --test scripts/tests/check-tool-name-display-coverage.test.mjs
 *
 * 2026-09-27 随"判红行点名 + 取材面收口"建票(此前本门没有任何镜像测试,AGENTS 已把该残余登记在案):
 *  - T1 faceFromArgv 四态(默认必须是 HEAD —— 本门旧版按磁盘直读,守门 118 把"本次改动动过而仍
 *    按磁盘判的门"判红,出路就是走取材层);
 *  - T2 形状锁:不得回到磁盘直读;判红行的 `⇒ 违规落点 <裸 rel>` 后缀不得被删;
 *  - T3 端到端点名有效性:临时仓注入真红后,用**铰链自己的导出判据**证明"本枚文件被点名 ⇒ mine、
 *    别人的文件不被牵连 ⇒ not-ours"(证明靠点名而非巧合);
 *  - T4 面分离:坏内容只在索引 ⇒ 默认(HEAD)绿、--staged 红;两面旗同给判死。
 * 夹具一律落 scripts/lib/scratch-dir.mjs(§26,不落 os.tmpdir 也不落仓库树内)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { faceFromArgv, readFaceInputs, INPUT_RELS } from '../check-tool-name-display-coverage.mjs'
// §22c:点名判据一律 import 生产出口,禁止在测试里再抄一份 findingLines / lineNamesFile。
import {
  findingLines,
  lineNamesFile,
  classifyHookFailure,
  __test__ as hingeTestExports,
} from '../lib/commit-gate-attribution.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(HERE, '..')

const MCP_REL = 'apps/ai-service/app/services/mcp_server.py'
const TD_REL = 'packages/shared/src/chat/tool-display.ts'
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

function git(cwd, ...args) {
  return execFileSync(
    gitBinary(),
    [
      '-c', 'safe.directory=*',
      '-c', 'core.quotepath=false',
      '-c', 'core.autocrlf=false',
      '-c', 'user.name=gate-fixture',
      '-c', 'user.email=gate-fixture@invalid',
      '-C', cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

/** 最小自洽语料:2 个注册工具 × 2 个映射 × 5 语言 taskStatus 全有值。 */
function writeCorpus(dir, { dropMapFor = null, dropLocaleValueFor = null } = {}) {
  const put = (rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }
  put(
    MCP_REL,
    '_TOOLS: list[MCPTool] = [\n    MCPTool(name="read_file"),\n    MCPTool(name="write_file"),\n]\n',
  )
  const mapLines = [
    ["read_file: 'toolReadFile',", dropMapFor !== 'read_file'],
    ["write_file: 'toolWriteFile',", dropMapFor !== 'write_file'],
  ]
    .filter(([, keep]) => keep)
    .map(([l]) => `  ${l}`)
    .join('\n')
  put(TD_REL, `const TOOL_DISPLAY_KEYS = {\n${mapLines}\n}\n`)
  for (const lang of LANGS) {
    const taskStatus = {}
    if (!(dropLocaleValueFor && dropLocaleValueFor.lang === lang)) taskStatus.toolReadFile = `r-${lang}`
    if (!(dropLocaleValueFor && dropLocaleValueFor.lang === lang)) taskStatus.toolWriteFile = `w-${lang}`
    put(`packages/i18n/messages/shared/${lang}.json`, JSON.stringify({ taskStatus }))
  }
}

function createRepoEnv(opts = {}) {
  const dir = mkScratch('tool-name-coverage')
  copyScriptWithClosure(SCRIPTS_DIR, 'check-tool-name-display-coverage.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
  ])
  writeCorpus(dir)
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'good baseline')
  if (opts.breakTree) {
    writeCorpus(dir, opts.breakTree)
    git(dir, 'add', '-A')
    if (opts.commitBreak) git(dir, 'commit', '-q', '-m', 'break')
  }
  return dir
}

function runScript(tempDir, args = []) {
  const r = spawnSync(
    process.execPath,
    [join(tempDir, 'scripts', 'check-tool-name-display-coverage.mjs'), ...args],
    { cwd: tempDir, encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return { rc: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

test('T1 faceFromArgv:默认必须是 head;--staged/--worktree 各选其面;两面旗同给判死', () => {
  assert.equal(faceFromArgv([]).face, 'head', '默认档回到磁盘 = 又在判滞后工作树')
  assert.equal(faceFromArgv(['--staged']).face, 'staged')
  assert.equal(faceFromArgv(['--worktree']).face, 'worktree')
  const both = faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(
    INPUT_RELS.includes(MCP_REL) &&
      INPUT_RELS.includes(TD_REL) &&
      LANGS.every((l) => INPUT_RELS.includes(`packages/i18n/messages/shared/${l}.json`)),
    '取材清单必须覆盖旧磁盘版读的全部 7 个文件',
  )
})

test('T2 形状锁:不得回到磁盘直读;判红行点名后缀不得被删', () => {
  const src = readFileSync(join(SCRIPTS_DIR, 'check-tool-name-display-coverage.mjs'), 'utf8')
  assert.doesNotMatch(src, /from 'node:fs'/, '磁盘直读回来了(门本体不得自带 fs 读取)')
  assert.doesNotMatch(src, /readFileSync\(\s*(resolve|join)\(\s*ROOT/)
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/)
  assert.match(
    src,
    /⇒ 违规落点 \$\{TOOL_DISPLAY_REL\} \/ \$\{MCP_SERVER_REL\}/,
    '未映射行的双落点点名被删 ⇒ 归因铰链第一态对本门重新失明',
  )
  assert.match(
    src,
    /⇒ 违规落点 \$\{sharedLocaleRel\(lang\)\}/,
    '缺 i18n 行的逐语言点名被删 ⇒ 同上',
  )
})

test('T3 端到端点名有效性:真红输出经铰链导出判据可命中本枚文件,别人的文件不被牵连', () => {
  const dir = createRepoEnv({
    breakTree: { dropMapFor: 'read_file', dropLocaleValueFor: { lang: 'zh-TW' } },
    commitBreak: true,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.rc, 1, `夹具必须让默认(HEAD)档红,否则下面全是空断言\n${r.out}`)
    assert.match(r.out, /未映射工具名\(1\):read_file/, '原有信息(未映射工具名)必须逐字保留')
    assert.match(r.out, /覆盖率 1\/2|覆盖率 \d+\/\d+/, '覆盖率数字必须保留')
    const oursMap = TD_REL
    const oursReg = MCP_REL
    const oursPack = 'packages/i18n/messages/shared/zh-TW.json'
    const other = 'packages/app/src/features/UnrelatedProbe.tsx'
    const lines = findingLines(r.out)
    assert.ok(lines.some((l) => lineNamesFile(l, oursMap)), '未映射行必须点名词表文件')
    assert.ok(lines.some((l) => lineNamesFile(l, oursReg)), '未映射行必须点名注册表文件')
    assert.ok(lines.some((l) => lineNamesFile(l, oursPack)), '缺 i18n 行必须逐语言点名语言包文件')
    assert.ok(!lines.some((l) => lineNamesFile(l, other)), '反向:不得把没点名的别人文件算成点名')
    const stock = () => ({ ran: true, status: 1, output: 'HEAD 面同样红', why: null })
    const mk = (stagedFiles) =>
      classifyHookFailure({
        text: hingeTestExports.SUMMARY + hingeTestExports.FAIL_29,
        stagedFiles,
        runGate: () => ({ status: 1, output: r.out }),
        runGateBaseline: stock,
      })
    // 基线同红 ⇒ 差分给不出 mine;这里出现 mine **只能**是点名第一态给的(排除巧合)。
    assert.equal(mk([oursMap]).kind, 'mine')
    assert.equal(mk([other]).kind, 'not-ours')
  } finally {
    rmScratch(dir)
  }
})

test('T4 面分离与判死:坏内容只在索引 ⇒ HEAD 绿 / --staged 红;两面旗同给 exit 2;必需输入缺失 exit 2', () => {
  const dir = createRepoEnv({
    breakTree: { dropMapFor: 'write_file' },
    commitBreak: false, // 只 add 不 commit:HEAD 好、索引坏(磁盘同样坏,但默认/staged 都不读磁盘)
  })
  try {
    const head = runScript(dir)
    assert.equal(head.rc, 0, `默认档判 HEAD(好的那一份)\n${head.out}`)
    const staged = runScript(dir, ['--staged'])
    assert.equal(staged.rc, 1, `索引里是坏的,--staged 必须红(盘上随后改对不算修好)\n${staged.out}`)
    assert.match(staged.out, /⇒ 违规落点 packages\/shared\/src\/chat\/tool-display\.ts/)
    assert.equal(runScript(dir, ['--staged', '--worktree']).rc, 2, '两面旗同给必须判死')
    // 必需输入在面上被摘掉 ⇒ exit 2「无法判定」,不回落另一个面(旧磁盘版同情形是 ENOENT→exit 2,退出码同)。
    git(dir, 'rm', '--cached', '-q', '-f', '--', TD_REL)
    assert.throws(
      () => readFaceInputs(dir, 'staged'),
      (e) => /无法判定/.test(e.message) && e.constructor.name === 'Undetermined',
    )
    assert.equal(runScript(dir, ['--staged']).rc, 2, '取不到 ⇒ exit 2,既不冒红也不记绿')
  } finally {
    rmScratch(dir)
  }
})
