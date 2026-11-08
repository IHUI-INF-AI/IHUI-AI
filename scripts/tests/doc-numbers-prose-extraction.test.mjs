// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 173 / DN2 的结构性反回潮夹具(2026-11-08 票:
 * 「新增一个测试文件 ⇒ README 十几处派生数字全部变旧 ⇒ push 恒红」)。
 *
 * 结构解(只抽正文、不动判据):
 *   · README.md / README.en.md 的**活性正文不再写派生数字**,派生数字只存在于唯一生成块;
 *   · 生成块仍由唯一写入口 `sync-readme-numbers.mjs`(固定 staged 面 + 锁 + CAS)重算;
 *   · 门的全部牙齿(DN1 生成块逐键对账 / DN2 散文错数 / DN5 清单不变式)一条不拆。
 *
 * 本夹具钉住四件事:
 *   A. 活性正文的派生数字命中数 = 0(抽干净;有人再写回去,下面 C 会红);
 *   B. 新增测试文件 ⇒ 门照旧红(块必须刷新)—— 牙在;
 *   C. 跑一次唯一写入口(不需要任何人手改文档)⇒ 门转绿,且正文一字未动;
 *   D. 手写错数 / 手改块 ⇒ 仍红(抽取不等于放行);post-commit 不再有后台数字写手。
 *
 * 全部走生产入口(门 / 写手)真跑,不做内部复算。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts', 'check-doc-numbers.mjs')
const SYNC = join(ROOT, 'scripts', 'sync-readme-numbers.mjs')

const BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
const END = '<!-- END GENERATED NUMBERS -->'
const UPDATES_END = '<!-- END RECENT UPDATES -->'

function git(repo, args) {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr}`)
  return r.stdout.trim()
}

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function writeAll(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, body, 'utf8')
  }
}

/** 最小但**全取材源可达**的夹具仓:所有派生键都 >0,避免 undetermined 把结论变成 exit 2。 */
function makeRepo(tag) {
  const dir = mkScratch(tag)
  git(dir, ['init', '-q'])
  writeAll(dir, {
    'packages/database/src/schema/a.ts':
      'export const a1 = pgTable("a1", {})\nexport const a2 = pgTable("a2", {})\n',
    'packages/database/package.json': '{"name":"@ihui/database"}\n',
    'packages/shared/package.json': '{"name":"@ihui/shared"}\n',
    'packages/shared/src/base.test.ts': 'export const t = 1\n',
    'packages/i18n/messages/common/en.json': '{"hello":"hi"}\n',
    'apps/api/src/routes/r.ts':
      "export default async function (fastify) {\n  fastify.get('/ping', async () => ({ ok: true }))\n  fastify.get('/ws-live', async () => ({ ok: true }))\n}\n",
    'apps/ai-service/app/main.py': '@router.get("/ping")\ndef ping():\n    return {"ok": True}\n',
    'apps/ai-service/app/data/default_models.json': '{"models":[{"id":"m1"}]}\n',
    'apps/web/package.json': '{"name":"@ihui/web"}\n',
    'apps/web/src/lib/publish/platform-schemas.ts': "export const PLATFORM_SCHEMAS = [\n  {\n    platformId: 'x',\n  },\n]\n",
    'apps/cli/src/commands/c.ts': 'export const c = 1\n',
    'apps/cli/src/tools/t.ts': 'export const t = 1\n',
    'scripts/guardian-runner.mjs': "export const GATES = [\n  {\n    id: 'g1',\n    mode: 'blocking',\n  },\n]\n",
    '.github/workflows/ci.yml': 'name: ci\non: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n',
    'docker-compose.yml': 'services:\n  web:\n    image: nginx\n',
    'README.md': `# fixture\n\n正文不再写派生数字。\n\n${BEGIN}\n${END}\n`,
    'README.en.md': `# fixture en\n\n${BEGIN}\n${END}\n`,
  })
  git(dir, ['add', '-A'])
  const synced = runNode(SYNC, ['--root', dir], dir)
  assert.equal(synced.rc, 0, `base 写块失败:\n${synced.out}`)
  git(dir, ['commit', '-q', '-m', 'base'])
  return dir
}

const readmeOf = (dir) => readFileSync(join(dir, 'README.md'), 'utf8')
const commitAll = (dir, msg) => {
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', msg])
}
const outsideBlock = (text) => {
  const b = text.indexOf(BEGIN)
  const e = text.indexOf(END)
  if (b < 0 || e < b) return text
  return `${text.slice(0, b)}${text.slice(e + END.length)}`
}

test('A 活性正文的派生数字命中数 = 0(两个受审文档都抽干净)', async () => {
  const mod = await import(pathToFileURL(GATE).href)
  const gen = await import(pathToFileURL(join(ROOT, 'scripts', 'gen-doc-numbers.mjs')).href)
  for (const rel of ['README.md', 'README.en.md']) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    const lines = text.split(/\r?\n/)
    let lastEnd = -1
    lines.forEach((l, i) => {
      if (l.includes(UPDATES_END)) lastEnd = i
    })
    assert.ok(lastEnd > 0, `${rel} 找不到 ${UPDATES_END}`)
    const r = mod.findStaleClaims(text, gen.collectNumbers({ root: ROOT, face: 'head' }).numbers)
    const activeViolations = r.violations.filter((v) => v.line - 1 <= lastEnd)
    assert.equal(activeViolations.length, 0, `活性正文仍有派生数字:${JSON.stringify(activeViolations.slice(0, 3))}`)
    assert.ok(text.includes(BEGIN) && text.includes(END), `${rel} 生成块被摘 ⇒ 数字将无人对账`)
    // 块里的数字仍会被逐键判:块非空且至少有 testFiles/trackedFiles 两行。
    const block = text.slice(text.indexOf(BEGIN), text.indexOf(END))
    assert.match(block, /`testFiles`/, `${rel} 生成块缺 testFiles 行`)
    assert.match(block, /`trackedFiles`/, `${rel} 生成块缺 trackedFiles 行`)
  }
})

test('B 新增测试文件 ⇒ 门照旧红(块必须刷新,判据没被放宽)', () => {
  const dir = makeRepo('docnum-extract-red')
  try {
    writeFileSync(join(dir, 'packages/shared/src/extra.test.ts'), 'export const t2 = 1\n', 'utf8')
    git(dir, ['add', '--', 'packages/shared/src/extra.test.ts'])
    const r = runNode(GATE, ['--staged', '--root', dir], dir)
    assert.equal(r.rc, 1, `新增测试文件而块未刷新必须红:\n${r.out}`)
    assert.match(r.out, /trackedFiles/, r.out)
  } finally {
    rmScratch(dir)
  }
})

test('C 跑一次唯一写入口 ⇒ 门转绿,且正文一字未动(不需要任何人手改文档)', () => {
  const dir = makeRepo('docnum-extract-green')
  try {
    writeFileSync(join(dir, 'packages/shared/src/extra.test.ts'), 'export const t2 = 1\n', 'utf8')
    git(dir, ['add', '--', 'packages/shared/src/extra.test.ts'])
    const before = readmeOf(dir)
    const synced = runNode(SYNC, ['--root', dir], dir)
    assert.equal(synced.rc, 0, `唯一写入口失败:\n${synced.out}`)
    const after = readmeOf(dir)
    assert.equal(outsideBlock(after), outsideBlock(before), '正文(生成块之外)不得被写手改动')
    assert.notEqual(after, before, '生成块必须真的被重算')
    const r = runNode(GATE, ['--staged', '--root', dir], dir)
    assert.equal(r.rc, 0, `块同步后必须绿:\n${r.out}`)
    commitAll(dir, 'add a test file + sync block')
    const push = runNode(GATE, ['--push', '--root', dir], dir)
    assert.equal(push.rc, 0, `提交后 push 面也必须绿:\n${push.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('D 手写错数 / 手改块 ⇒ 仍红(抽取不等于放行手写)', () => {
  const dir = makeRepo('docnum-extract-tamper')
  try {
    const wrong = readmeOf(dir).replace('# fixture\n', '# fixture\n\n9999 测试文件\n')
    writeFileSync(join(dir, 'README.md'), wrong, 'utf8')
    git(dir, ['add', '--', 'README.md'])
    const prose = runNode(GATE, ['--staged', '--root', dir], dir)
    assert.equal(prose.rc, 1, `正文手写错数必须红:\n${prose.out}`)
    assert.match(prose.out, /9999/, prose.out)
  } finally {
    rmScratch(dir)
  }

  const dir2 = makeRepo('docnum-extract-block-tamper')
  try {
    const before = readmeOf(dir2)
    const tampered = before.replace(/(\| 测试文件 \| )\d+( \| `testFiles` \|)/, '$1999$2')
    assert.notEqual(tampered, before, '夹具必须先真的改到块里的 testFiles')
    writeFileSync(join(dir2, 'README.md'), tampered, 'utf8')
    git(dir2, ['add', '--', 'README.md'])
    const block = runNode(GATE, ['--staged', '--root', dir2], dir2)
    assert.equal(block.rc, 1, `手改生成块必须红:\n${block.out}`)
    assert.match(block.out, /testFiles/, block.out)
    // 再跑唯一写入口 ⇒ 自动纠正回真值 ⇒ 转绿(人不用算)。
    const synced = runNode(SYNC, ['--root', dir2], dir2)
    assert.equal(synced.rc, 0, `写手失败:\n${synced.out}`)
    const green = runNode(GATE, ['--staged', '--root', dir2], dir2)
    assert.equal(green.rc, 0, `写手纠正后必须绿:\n${green.out}`)
  } finally {
    rmScratch(dir2)
  }
})

test('E 写入口收口:post-commit 不再有后台数字写手(点 4)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'lib', 'post-commit-hook.js'), 'utf8')
  assert.ok(!src.includes("'node scripts/sync-readme-numbers.mjs'"), 'post-commit 不得再调用数字块写手')
  assert.ok(/post-commit-readme-recent/.test(src), '最近更新块属于另一段功能,应保留')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
