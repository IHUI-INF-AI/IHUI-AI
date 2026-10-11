// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-doc-numbers.mjs
 *
 * 这个文件只做"判据之外"的四件事,不与门内自检重复:
 *  T1 装车证明 —— 注册表(HEAD 面)里真有一条指向本门脚本的条目,且 blocking + skipEnv 齐备;
 *  T2 反向锁 —— 同一段判据喂"没有这条注册"的注册表必须判"未装车"
 *     (否则 T1 只是把当前事实复读一遍,别人摘线后它跟着变绿 —— 守门 70/76/81 同型);
 *  T3 取材面形状锁 —— 门体必须走 scripts/lib/face-reader.mjs 的 catBatch,不得散写 git 取内容、
 *     不得用 process.cwd() 定根(§15);
 *  T4 端到端有牙证明 —— 在临时 git 仓里造"索引里的 README 写着旧数字",`--staged` 必须 exit 1
 *     并点名该取数键;改成现算值后必须 exit 0。**只判纯函数的测试证明不了门会红**。
 *  T5 取不到 ⇒ 判死,不记绿(无提交 / 空候选 / 两面旗同给)。
 *  T9 逗号分组只由 NUM 出一份 + 用**真历史文本**做阳性对照(G-1117442)——旧写法对 "4,415"
 *     从未匹配过,而"违规=0"的断言会替瞎掉的尺子发合格证,所以这一条同时钉"写法唯一"与"真能抓到";
 *     其 ③ 段是英文分支的正向断言(G-1104173:testFiles / wsEndpoints 的英文措辞必被抓点名)。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { BLOCK_BEGIN, BLOCK_END } from '../gen-doc-numbers.mjs'
import { CLAIMS, NUM, decide, findStaleClaims } from '../check-doc-numbers.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = resolve(HERE, '..', 'check-doc-numbers.mjs')
const REPO = resolve(HERE, '..', '..')
const GIT = process.env.GIT_BIN || 'git'
const git = (cwd, ...args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd,
    encoding: 'utf8',
  })
function run(cwd, args) {
  try {
    const stdout = execFileSync(process.execPath, [GATE, ...args], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 << 20,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? -1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

/** 从注册表文本里把本门那条注册块取出来(大括号配对,不跨进邻门 —— 守门 136 T2 那一课)。 */
function entryFor(registryText, scriptName) {
  const at = registryText.indexOf(`script: '${scriptName}'`)
  if (at < 0) return null
  const start = registryText.lastIndexOf('{', at)
  let depth = 0
  for (let i = start; i < registryText.length; i += 1) {
    if (registryText[i] === '{') depth += 1
    else if (registryText[i] === '}') {
      depth -= 1
      if (depth === 0) return registryText.slice(start, i + 1)
    }
  }
  return null
}

test('T1 装车证明:runner(HEAD 面)里有本门条目,blocking + skipEnv + stagedTriggers 齐备,且门体文件与注册同面在位', () => {
  const blobs = catBatch(REPO, ['HEAD:scripts/guardian-runner.mjs'])
  const text = blobs.get('HEAD:scripts/guardian-runner.mjs')
  if (typeof text !== 'string') throw new Error('取不到 runner 的 HEAD blob ⇒ 无法判定')
  const entry = entryFor(text, 'check-doc-numbers.mjs')
  if (!entry) throw new Error('runner 里没有 check-doc-numbers.mjs 的注册块 ⇒ 门未装车')
  if (!/mode:\s*'blocking'/.test(entry)) throw new Error(`条目不是 blocking:${entry.slice(0, 200)}`)
  if (!/skipEnv:\s*'HUSKY_SKIP_DOC_NUMBERS'/.test(entry)) throw new Error(`条目缺 skipEnv:${entry.slice(0, 200)}`)
  // stagedTriggers 必须点名两份被审文档 —— 没有它,本门会在**每一次**普通提交上追
  // trackedFiles 这类必漂的数字,当场长成恒红门(§12e;门体自身还有 S21 的第二道收窄)。
  if (!/stagedTriggers:\s*\[[^\]]*'README\.md'[^\]]*'README\.en\.md'/.test(entry))
    throw new Error(`注册条目缺 stagedTriggers=['README.md','README.en.md']:${entry.slice(0, 300)}`)
  // "注册在位而门体文件不在"(§12f):干净检出上 runner 会派生一个不存在的脚本并崩掉整批门。
  // 判据是**存在性**(ls-tree 枚举,不读内容,不算散写取材)。本门体不存在 ⇒ 本测试红 ⇒ 判死。
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const listed = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', REPO, 'ls-tree', 'HEAD', '--name-only', '--', 'scripts/check-doc-numbers.mjs', 'scripts/gen-doc-numbers.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const need of ['scripts/check-doc-numbers.mjs', 'scripts/gen-doc-numbers.mjs'])
    if (!listed.includes(need)) throw new Error(`注册在位而 HEAD 树里没有 ${need} ⇒ 注册与门体必须同枚提交(§12f R9 同型)`)
})

test('T2 反向锁:摘线必须被判成"未装车"(T1 不是恒真复读)', () => {
  const real = readFileSync(resolve(REPO, 'scripts/guardian-runner.mjs'), 'utf8')
  const entry = entryFor(real, 'check-doc-numbers.mjs')
  if (!entry) throw new Error('工作树的 runner 里没有该条目 ⇒ 反向锁无从构造(这是测试无效,不是通过)')
  if (entryFor(real.replace(entry, ''), 'check-doc-numbers.mjs') !== null)
    throw new Error('探针失效:删掉整块后仍能找到该脚本')
  // CLAIMS 也不可以是张死表:每条要真能命中自己的 sample(与门内 S18 同源,在镜像面再钉一次)。
  // 探针数字用该措辞自己的 `probe`(位数区间内的真数)—— 固定喂 '123456' 会踩中
  // `(\d{1,3})`/`(\d{1,2})` 这类位数下限,把反向锁做成**恒红误报**(与本仓"恒红断言与恒绿同样有害"同条禁令)。
  if (CLAIMS.length < 8) throw new Error(`CLAIMS 只剩 ${CLAIMS.length} 条 ⇒ 覆盖面退化`)
  for (const c of CLAIMS) {
    if (!c.probe) throw new Error(`措辞 ${c.key} 缺 probe ⇒ 反向锁退化为固定数字,必踩位数下限`)
    c.re.lastIndex = 0
    if (!c.re.exec(c.sample.replace('<N>', c.probe))) throw new Error(`措辞 ${c.key} 连自己的 sample(probe=${c.probe})都不命中 ⇒ 死条款`)
  }
})

test('T3 取材面形状锁:门体走 face-reader 的 catBatch,不散写 git、不 cwd 定根', () => {
  const src = readFileSync(resolve(REPO, 'scripts/check-doc-numbers.mjs'), 'utf8')
  if (!/from\s*['"]\.\/lib\/face-reader\.mjs['"]/.test(src)) throw new Error('未 import 统一取材层')
  if (!/\bcatBatch\s*\(/.test(src)) throw new Error('未用层的读取入口 catBatch ⇒ 半接线')
  if (/process\.cwd\(\)/.test(src)) throw new Error('不得用 process.cwd() 定仓库根(§15)')
  const gen = readFileSync(resolve(REPO, 'scripts/gen-doc-numbers.mjs'), 'utf8')
  if (!/catBatch/.test(gen)) throw new Error('生成侧未走统一取材层')
})

test('T4 端到端:索引里的旧数字必红,改对后必绿,裸标记不得放行', async () => {
  const s = mkScratch('doc-num-e2e')
  try {
    const files = {
      'package.json': JSON.stringify({ name: 'x', version: '0.0.0' }),
      'packages/database/src/schema/a.ts':
        'export const t1 = pgTable("t1", {})\nexport const t2 = pgTable("t2", {})\nexport const t3 = pgTable.schema("t3", {})\n',
      'apps/api/src/routes/a.ts': "server.get('/x', () => {})\nserver.post('/y', () => {})\n",
      'apps/ai-service/app/a.py': '@router.get("/z")\ndef z():\n    return 1\n',
      'apps/ai-service/app/data/default_models.json': JSON.stringify({ models: ['m1', 'm2'] }),
      'apps/web/src/lib/publish/platform-schemas.ts': "export const PLATFORM_SCHEMAS = [{ platformId: 'csdn' }]\n",
      'scripts/guardian-runner.mjs':
        "const CHECKS = [{ id: '1', script: 'a.mjs', mode: 'blocking', skipEnv: 'X' }]\n",
      'docker-compose.yml': 'services:\n  api:\n    image: x\n  web:\n    image: y\n',
      'packages/i18n/messages/web/zh-CN.json': '{}',
      'packages/i18n/messages/web/en.json': '{}',
      'a.test.ts': '// test file',
      '.github/workflows/ci.yml': 'on: push\n',
      'apps/x/package.json': '{"name":"@ihui/x"}',
    }
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(`${s}/${dirname(rel)}`, { recursive: true })
      writeFileSync(`${s}/${rel}`, body)
    }
    git(s, 'init', '-q', '-b', 'main')
    git(s, 'add', '-A')
    git(s, 'commit', '-q', '-m', 'seed')
    const gen = await import('../gen-doc-numbers.mjs')
    // ⚠ 生成块必须按"**README 已在被审面上**"的那次现算来生成 —— 按"还没有 README 的旧面"生成
    // 会让 trackedFiles 天生差 2,"改对后必绿"臂在结构上不可能绿(上一版 T4 正死在这里:
    // 块的数字与它所依附的面不同轮,尺子考的是自己的抄写)。
    const writeBoth = (zh, en) => {
      writeFileSync(`${s}/README.md`, zh)
      writeFileSync(`${s}/README.en.md`, en)
      git(s, 'add', '--', 'README.md', 'README.en.md')
    }
    writeBoth('placeholder\n', 'placeholder\n')
    const d = gen.collectNumbers({ root: s, face: 'staged' })
    const block = gen.toMarkdown(d)
    const tables = d.numbers.dbTables
    const write = writeBoth
    // ① 索引里是旧数字 ⇒ 必红且点名
    write(`本项目 ${tables + 416} 张表。\n\n${block}\n`, `This project has ${tables + 416} tables.\n\n${block}\n`)
    const bad = run(s, ['--staged', '--root', s])
    if (bad.code !== 1) throw new Error(`旧数字应 exit 1,实得 ${bad.code}\n${bad.stdout}${bad.stderr}`)
    if (!bad.stdout.includes('dbTables` 写着')) throw new Error(`未点名 dbTables:\n${bad.stdout}`)
    // ② 改对 ⇒ 必绿(同一面,证明那不是恒红门)
    write(`本项目 ${tables} 张表。\n\n${block}\n`, `This project has ${tables} tables.\n\n${block}\n`)
    const good = run(s, ['--staged', '--root', s])
    if (good.code !== 0) throw new Error(`改对后应 exit 0,实得 ${good.code}\n${good.stdout}${good.stderr}`)
    // ③ 豁免只在"带原因"那一行生效(端到端再钉一次,不靠构造面)
    write(`当年 ${tables + 416} 张表 <!-- doc-num-exempt: 历史叙述,非当前总量 -->\n\n${block}\n`, `x\n\n${block}\n`)
    if (run(s, ['--staged', '--root', s]).code !== 0) throw new Error('带原因的豁免应放行本行')
    write(`当年 ${tables + 416} 张表 <!-- doc-num-exempt -->\n\n${block}\n`, `x\n\n${block}\n`)
    const bare = run(s, ['--staged', '--root', s])
    if (bare.code !== 1) throw new Error(`裸标记不得放行,实得 ${bare.code}\n${bare.stdout}`)
  } finally {
    rmScratch(s)
  }
})

test('T5 取不到判死,不记绿', () => {
  // 纯函数面:0 候选 ⇒ exit 2(尺子失明不是通过)
  if (decide({ violations: [], blockProblems: [], descProblems: [], undetermined: [], strict: false, candidates: 0 }).code !== 2)
    throw new Error('0 候选未判死')
  const s = mkScratch('doc-num-nocommit')
  try {
    git(s, 'init', '-q', '-b', 'main')
    writeFileSync(`${s}/README.md`, 'x')
    // 端到端面:没有任何提交 ⇒ 不得 exit 0,且结论行必须写明为什么
    const r = run(s, ['--head', '--root', s])
    if (r.code === 0) throw new Error(`无提交却记绿:\n${r.stdout}`)
    if (!/无法判定|取不到|不记/.test(r.stdout + r.stderr))
      throw new Error(`结论行必须点名为什么不可判:\n${r.stdout}\n${r.stderr}`)
    // 两面旗同给 ⇒ exit 2(选面自相矛盾)
    const both = run(s, ['--staged', '--worktree', '--root', s])
    if (both.code !== 2) throw new Error(`两面旗同给应 exit 2,实得 ${both.code}`)
  } finally {
    rmScratch(s)
  }
})

test('T6 生成块与散文不得互相顶结论(块内过期由 DN1 管,块外旧数由 DN2 管)', () => {
  const n = { dbTables: 583 }
  const wrongBlock = `${BLOCK_BEGIN}\n| 数据库表 | 542 | \`dbTables\` |\n${BLOCK_END}\n正文没提数字`
  const r = findStaleClaims(wrongBlock, n)
  if (r.violations.length !== 0) throw new Error('块内数字不该走 DN2(会双重判红,措辞也说不清该改哪一处)')
})

test('T7 判责时机端到端:未触及 README 的轮次漂移只报数(exit 0),触及那枚当场全判', async () => {
  const gen = await import('../gen-doc-numbers.mjs')
  const s = mkScratch('doc-num-scope')
  try {
    const seed = {
      'package.json': JSON.stringify({ name: 'x', version: '0.0.0' }),
      'packages/database/src/schema/a.ts': 'export const t1 = pgTable("t1", {})\n',
      'apps/api/src/routes/a.ts': "server.get('/x', () => {})\n",
      'docker-compose.yml': 'services:\n  api:\n    image: x\n',
      'scripts/guardian-runner.mjs': "const C = [{ id: '1', script: 'a.mjs', mode: 'blocking', skipEnv: 'X' }]\n",
    }
    for (const [rel, body] of Object.entries(seed)) {
      mkdirSync(`${s}/${dirname(rel)}`, { recursive: true })
      writeFileSync(`${s}/${rel}`, body)
    }
    git(s, 'init', '-q', '-b', 'main')
    git(s, 'add', '-A')
    git(s, 'commit', '-q', '-m', 'seed (no README yet)')
    // 先落一版"当时自洽"的 README,再按落库后的面重算一次并翻勾到自洽 —— 模拟真实工作流:
    // 生成块必须在 README 已被跟踪的那枚面上生成,否则 trackedFiles 天生差 2,测试就在考古自己。
    const mkReadmes = (face) => {
      const d = gen.collectNumbers({ root: s, face })
      const block = gen.toMarkdown(d)
      writeFileSync(`${s}/README.md`, `本项目 ${d.numbers.dbTables} 张表。\n\n${block}\n`)
      writeFileSync(`${s}/README.en.md`, `This project has ${d.numbers.dbTables} tables.\n\n${block}\n`)
    }
    mkReadmes('head')
    git(s, 'add', '--', 'README.md', 'README.en.md')
    git(s, 'commit', '-q', '-m', 'docs: add READMEs')
    mkReadmes('head') // 重算使块与"README 已在面里"的状态一致
    git(s, 'add', '--', 'README.md', 'README.en.md')
    git(s, 'commit', '-q', '-m', 'docs: sync generated block')
    // ① 只往索引加一个无关新文件(README 分毫未动)⇒ --staged 必须 exit 0 且喊"不问责 + 漂移只报数"
    writeFileSync(`${s}/extra.ts`, 'export const x = 1\n')
    git(s, 'add', '--', 'extra.ts')
    const idle = run(s, ['--staged', '--root', s])
    if (idle.code !== 0) throw new Error(`未触及 README 的轮次不得判红(恒红门同罪):\n${idle.stdout}${idle.stderr}`)
    if (!/不问责/.test(idle.stdout)) throw new Error(`必须明说本轮为什么不判:\n${idle.stdout}`)
    if (!/漂移/.test(idle.stdout)) throw new Error(`trackedFiles 已漂 ⇒ 必须如实报漂移数,不得静默:\n${idle.stdout}`)
    // ② 现在改 README 并写旧数 ⇒ 同一轮必红且点名
    writeFileSync(`${s}/README.md`, `本项目 542 张表。\n\n${gen.toMarkdown(gen.collectNumbers({ root: s, face: 'head' }))}\n`)
    git(s, 'add', '--', 'README.md')
    const hit = run(s, ['--staged', '--root', s])
    if (hit.code !== 1) throw new Error(`触及 README + 旧数应 exit 1,实得 ${hit.code}\n${hit.stdout}`)
    if (!/dbTables` 写着 542/.test(hit.stdout)) throw new Error(`未点名 dbTables=542:\n${hit.stdout}`)
    // ③ --strict 在未触及轮次也必须全判(防"不问责"被读成"永久豁免")
    git(s, 'commit', '-q', '-m', 'chore: extra (README 旧数已被 ② 判红,先留着)')
    const strict = run(s, ['--strict', '--root', s])
    if (strict.code === 0) throw new Error(`strict 档 README 旧数还在却记绿 ⇒ 不问责成了后门:\n${strict.stdout}`)
  } finally {
    rmScratch(s)
  }
})

test('T8 stagedTriggers 变异探针:T1 的触发条件句不是恒真', () => {
  const real = readFileSync(resolve(REPO, 'scripts/guardian-runner.mjs'), 'utf8')
  const entry = entryFor(real, 'check-doc-numbers.mjs')
  if (!entry) return // 未注册的情形由 T1/T2 负责红,这里不重复判
  const stripped = entry.replace(/stagedTriggers:\s*\[[^\]]*\],?/g, '')
  if (/stagedTriggers:\s*\[[^\]]*'README\.md'/.test(stripped))
    throw new Error('探针失效:剥掉触发清单后仍匹配 ⇒ T1 那条断言没有牙')
})

/** 分组形态是否逐字由导出的 NUM 产出(判据吃进 RegExp 的那一串,不比对源码/注释)。 */
function usesNumFabric(src) {
  if (!src.includes(',\\d{3}')) return true // 不含分组形态 ⇒ 与本锁无关
  return [1, 2, 3, 4, 5, 6].some((max) => [1, 2, 3].some((min) => src.includes(NUM(min, max))))
}

test('T9 逗号分组只由 NUM 出一份 + 真历史文本阳性对照(G-1117442)', () => {
  // ① 写法唯一:手抄一份旧形态(首段仍要求 ≥2 位 ⇒ "4,415" 永不匹配)必须被这把锁认出来。
  const offenders = CLAIMS.filter((c) => !usesNumFabric(c.re.source))
  if (offenders.length > 0)
    throw new Error(
      `这些 claim 的分组形态不是 NUM 的产物(第二份写法必漂移):${offenders.map((c) => c.key).join(', ')}`,
    )
  if (usesNumFabric(new RegExp('(\\d{2,6}(?:,\\d{3})*)x', 'gi').source))
    throw new Error('阳性对照失效:旧的死写法被认成 NUM 的产物 ⇒ 这条锁没有牙')

  // ② 阳性对照钉**出处**不钉 HEAD:下面两行逐字取自枚 a1cc2b32d3833b009716b1646db4c2081aafc369 的
  //    父提交里的 README.en.md(那枚提交把两处带逗号数字按现值改对了,而"改对不等于门看得见")。
  const HIST =
    'Headline claims (same source as the table below, all live-computed): **590 tables · 4,386 API routes ·\n' +
    '25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 2,432 test files ·'
  if (!HIST.includes('4,386')) throw new Error('夹具已不含逗号形态,阳性对照无从谈起(形状锁)')
  const numbers = { dbTables: 595, apiRoutes: 4415, testFiles: 2778, wsEndpoints: 25 }
  const r = findStaleClaims(`${HIST}\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, numbers)
  const api = r.violations.filter((v) => v.key === 'apiRoutes')
  if (api.length !== 1 || api[0].found !== 4386)
    throw new Error(`带逗号的英文路由声明必须被点名 4386≠4415,实得 ${JSON.stringify(r.violations)}`)

  // ③ 英文分支已补(G-1104173,2026-10-11):testFiles / wsEndpoints 两支现在看得见英文措辞 ——
  //    同一段真历史文本里 "2,432 test files" 必须被点名(2432≠2778),"25 WebSocket endpoints"
  //    必须计入 checked(25==25 故不判违规,再喂错值 26 必须点名)。本条由"未覆盖"登记翻成正向断言:
  //    谁把英文分支摘掉,这两条立刻翻红 —— 登记比没有更危险的教训就钉在这里。
  const tf = r.violations.filter((v) => v.key === 'testFiles')
  if (tf.length !== 1 || tf[0].found !== 2432)
    throw new Error(`testFiles 英文分支必须点名 "2,432 test files"(2432≠2778),实得 ${JSON.stringify(r.violations)}`)
  // HIST 可判数字恰四处:dbTables 590 + apiRoutes 4386 + wsEndpoints 25 + testFiles 2432
  // (llmModels / publishPlatforms 两支在本夹具的 numbers 里无键 ⇒ 按守门判据跳过,不计 checked)。
  if (r.checked !== 4)
    throw new Error(`HIST 应命中 4 处可判数字,实得 checked=${r.checked}(英文分支漏了或多重匹配)`)
  const r2 = findStaleClaims(`${HIST}\n${BLOCK_BEGIN}\nx\n${BLOCK_END}`, { ...numbers, wsEndpoints: 26 })
  const ws = r2.violations.filter((v) => v.key === 'wsEndpoints')
  if (ws.length !== 1 || ws[0].found !== 25)
    throw new Error(`wsEndpoints 英文分支必须点名 "25 WebSocket endpoints"(25≠26),实得 ${JSON.stringify(r2.violations)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
