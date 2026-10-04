// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `plan-collide-renumber.mjs` 的镜像测试(§22c:直接 import 源模块的导出口,不在测试里重写判据)
 *
 * 它守的是三件事,而不是"函数会不会算":
 *  T1 出路**真挂在 union-converge 的 F9 判红那一段**上 —— 门红了却不给出路,结局就是所有人跳钩子(§12e);
 *  T2 本器**没有第二把尺子**:期望重数式子必须来自 union-converge 的那一份实现,编号判据必须来自台账层;
 *  T5 真仓内容上的**阳性对照**:把 HEAD 面那份真台账铺进临时 git 仓,注入一条同号异题的登记,
 *     本器必须点名并给出可构造方案;`--apply` 产出的 blob 必须从对象库回读得回同样字节。
 *
 * 分层口径(2026-09-29 拆体量债):原 CLI 里的「二、纯函数判据层」整节逐字搬进了
 * `lib/plan-collide-renumber-plan.mjs`,所以 T3 的形状锁**跟着判据改指那一层**(留在 CLI 面上它就
 * 变成一条永远绿却什么都没看的断言);三条"不得有第二把尺子"的反面判据现同时读 CLI 与 lib 两个面,
 * 覆盖面只宽不窄。T1/T2/T8 钉的是 union-converge 那一面,未随本次搬迁改动。
 *
 * 每条断言的变异自证(把判据中和掉该条必读红)写在各自注释里,数字见交付报告,不写进本文当恒定事实。
 *
 * 需要外部通道(缺省时**报名字并 skip,绝不静默记绿**):
 *  IHUI_RENUMBER_HEAD_UNION  HEAD 面 union-converge.mjs 的一份副本(特征标识符计数的基准)
 *  IHUI_RENUMBER_REALPLAN    HEAD 面 PROJECT_PLAN.md 的一份副本(真仓内容阳性对照的语料)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as R } from '../plan-collide-renumber.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = resolve(HERE, '..')
const TOOL = join(SCRIPTS, 'plan-collide-renumber.mjs')
const LIB = join(SCRIPTS, 'lib', 'plan-collide-renumber-plan.mjs')
const CONV = join(SCRIPTS, 'union-converge.mjs')
const GIT = gitBinary()
const headUnionEnv = process.env.IHUI_RENUMBER_HEAD_UNION || ''
const realPlanEnv = process.env.IHUI_RENUMBER_REALPLAN || ''

const read = (p) => readFileSync(p, 'utf8')
const masked = (p) => maskComments(read(p))

test('T1 装车锁:F9 判红那一段必须打印可执行出路(摘掉它本条必读红)', () => {
  const src = masked(CONV)
  assert.match(src, /F9 归并新增撞号组/, 'F9 的点名文案必须还在(出路要挂在同一段上)')
  assert.match(src, /plan-collide-renumber\.mjs/, '出路必须点名本器,不得只喊"需人工"')
  // 出路必须带**当次那枚远端 sha**,不是写死一个占位 —— 否则复制粘贴的命令是跑不通的出路(§12e 同型禁令)
  assert.match(src, /plan-collide-renumber\.mjs \$\{t\.theirs\}/, '出路必须插值当次远端 sha')
  // 变异自证:把上面三行里的任何一行从 union-converge 里删掉 ⇒ 本条红(实测数字见交付报告)
})

test('T2 出路不得声称已把自己接进提交链(守门 89 的 R1/R2 判的就是这一型)', () => {
  const src = masked(CONV)
  const i = src.indexOf('plan-collide-renumber.mjs')
  assert.ok(i >= 0, 'T1 已锁存在性;这里只取那一段')
  const block = src.slice(i, i + 2600)
  assert.doesNotMatch(
    block,
    /已接 pre-commit|guardian 第 \d+ 项/,
    '出路是**修复出口**不是新增守门,不得冒充已接线',
  )
})

// 判据层 2026-09-29 从 CLI 逐字搬到 lib/plan-collide-renumber-plan.mjs(收体量债)。
// 形状锁**必须跟着判据走**:还钉在 CLI 面上,它就退化成"永远绿却什么都没看"的断言(§22c 那一型)。
// 因此正面两条改指 lib 里的**真实说明符**,而三条反面判据读的是 **CLI ⊕ lib 两个面之和** ——
// 覆盖面比拆前宽而不是窄:只钉 CLI 会让"第二把尺子被搬进 lib"这一型整族隐身。
const MOVED_OUTLETS = [
  'rowsByKeyTitle',
  'keyedRowCount',
  'keyedRowsWith',
  'pointerRowsMentioning',
  'titleStable',
  'f9AddedGroups',
  'degenerateFaceNote',
  'familiesOfText',
  'occupancy',
  'templateFor',
  'pickId',
  'assertNoteAtTail',
  'countToken',
  'renumberLine',
  'planGroup',
  'verifyProduced',
  'proveArchiveExemption',
  'buildArchiveAppend',
]

test('T3 形状锁:判据层不写第二把尺子(期望重数式子与编号判据各只有一份)', async () => {
  if (!existsSync(LIB)) throw new Error(`找不到判据层 ${LIB} ⇒ 本条**未执行**,不得记为通过`)
  const cli = masked(TOOL)
  const lib = masked(LIB)
  const both = cli + '\n' + lib
  // 正面①:台账那一份必须由"真的用编号判据的那一层"导入。拆层后落点是 lib,它内部逐字写的是
  // './plan-task-index.mjs'(旧钉子 './lib/plan-task-index.mjs' 钉的是 CLI,而 CLI 已不再持有编号判据)。
  assert.match(lib, /from '\.\/plan-task-index\.mjs'/, '编号/标题/主键必须走台账那一份')
  // 正面①附:说明符**解析得到的必须就是那一个文件**。只比字面串的话,有人在别处另放一份同名副本
  // 也能过 —— 这一条比拆前更严,不是更松。
  assert.equal(
    resolve(dirname(LIB), './plan-task-index.mjs'),
    join(SCRIPTS, 'lib', 'plan-task-index.mjs'),
    '台账导入的说明符必须落在唯一那份 plan-task-index',
  )
  // 正面②:期望重数式子只在 union-converge 那一处,判据层是"喂回去问它",不是自己算。
  assert.match(lib, /liveDocExpectedCounts/, '期望重数必须来自 union-converge 那一份实现')
  // 反面三条:覆盖面从「CLI 一个面」扩成「CLI ⊕ lib」两个面(逐字保留原正则,未放宽)。
  assert.doesNotMatch(
    both,
    /Math\.max\(0,/,
    '式子被重写进本器就是第二把尺子(本仓"两处算同一件事必漂移"记过多次)',
  )
  assert.doesNotMatch(both, /const TASK_ID_PATTERN\s*=/, '不得在别处再定义编号族')
  assert.doesNotMatch(both, /\[A-Za-z\]\+\)\[-－\]\1/, '畸形号判据不得抄进本器(住在台账层)')
  // 搬移不得把判据搬丢。这一维**按模块命名空间判,不按源码字面判** —— 钉 "export function X"
  // 那种写法会把合法的 `function X` + 末尾 `export { X }` 也判红,而假阳的代价是下一个人为了过门
  // 去改本来正常的写法。命名空间是行为事实:写成什么形态都骗不过它。
  // (Windows 必须经 pathToFileURL —— 裸绝对路径 await import 恒抛,而抛错会被读成"这一格判过了"。)
  const ns = await import(pathToFileURL(LIB).href)
  for (const k of MOVED_OUTLETS) {
    assert.equal(
      typeof ns[k],
      'function',
      `判据 ${k} 不在 lib 那一份上(搬丢了 / 没导出 / 又被搬回 CLI ⇒ 两处各写一份)`,
    )
    // 并且必须**就是同一个函数对象**经 CLI 的 __test__ 递给自检模块:
    // 只比 typeof 的话,CLI 里另写一份同名本地实现也能过,而那就是第二条尺子。
    assert.equal(R[k], ns[k], `__test__.${k} 不是 lib 那一份(依赖注入断链或在 CLI 复制了一份)`)
  }
  assert.equal(typeof R.JUMP_ENV, 'string', '跳距 env 名必须在 __test__ 面上(自检 ⑥ 靠它)')
  assert.equal(typeof R.DEFAULT_JUMP, 'number', '默认跳距必须在 __test__ 面上(自检 ⑥ 靠它)')
  // CLI 那一侧仍须持有编排用的那两份引擎,不得顺手改成自拼 git / 自写整行替换。
  assert.match(
    cli,
    /from '\.\/union-converge\.mjs'/,
    '编排层的归并重建必须走 union-converge 那一份',
  )
  assert.match(cli, /applyReplacements/, '落地那一次的整行改写必须走 live-doc-edit 那一份引擎')
})

test('T4 登记侧必须真求值:自检打印的 N/N 必须是量出来的,不是对象真值', () => {
  // 断言体住在 lib/plan-collide-renumber-selftest.mjs(拆出去的理由是关注点分离,不是 11e ——
  // 见该文件头注:11e 的扩展名表不含 .mjs),所以这条源码锁要看**那一格**,只看主器会绿得毫无内容
  // (判据搬走而锁没跟着搬 = 恒绿断言)。
  const selftestLib = join(SCRIPTS, 'lib', 'plan-collide-renumber-selftest.mjs')
  assert.ok(existsSync(selftestLib), `找不到自检模块 ${selftestLib} ⇒ 本条无牙`)
  const src = masked(selftestLib)
  assert.match(
    src,
    /cond === true/,
    '登记侧必须比布尔;传函数进这一格会恒真(§22c 记过 8 条恒绿断言)',
  )
  assert.doesNotMatch(
    src,
    /t\(\s*['"`][^'"`]+['"`]\s*,\s*\(\)\s*=>/,
    '不得把箭头函数当 cond 传进登记器',
  )
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const run = spawnSync(process.execPath, [TOOL, '--self-test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
  })
  assert.equal(
    run.status,
    0,
    `自检必须全绿,实得 rc=${run.status}\n${run.stdout || ''}${run.stderr || ''}`,
  )
  const last = String(run.stdout || '')
    .trim()
    .split(/\r?\n/)
    .pop()
  assert.match(last, /失败 0$/, `自检末行必须写"失败 0",实得:${last}`)
})

const re = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('T5 真仓内容阳性对照 + --apply 的 blob 必须从对象库回读得回', () => {
  if (!realPlanEnv || !existsSync(realPlanEnv))
    throw new Error(
      '缺 IHUI_RENUMBER_REALPLAN(HEAD 面 PROJECT_PLAN.md 副本)⇒ 本条**未执行**,不得记为通过',
    )
  const plan = read(realPlanEnv)
  // 语料取**真台账**(§22c),撞号形态取今天真实发生的那一种:两侧各拿一枚**尚未被任何面占用**的新号
  // 登记了两件不同的事(并发取号撞的)。取号走本器自己的出口,不在测试里另算一遍号段。
  const K = R.pickId('G', R.occupancy([plan]), { texts: [plan], jump: 5, taken: new Set() })
  assert.ok(K.ok, `拿不到一枚未占用的号 ⇒ 语料不合用,本条不算跑过:${K.reason}`)
  const MINE = `- [ ] ${K.id} 本侧未推的新登记,标题甲与下面那条乙逐字不同,前缀够长够长够长够长。`
  const THEIRSROW = `- [ ] ${K.id} 对侧新登记的另一件事,标题乙与本侧那条甲逐字不同,前缀够长够长。`
  assert.notEqual(MINE, THEIRSROW)
  const dir = mkScratch('ihui-renumber-e2e-')
  try {
    // 注意签名:这里必须是**变参**收集成数组。写成 `(args) => [..., ...args]` 再把字符串
    // 传进来,展开的是**字符**('i','n','i','t'),报错却是 "git: 'i' is not a git command"
    // —— 夹具自己的塌法从来不像夹具的问题(§22c:症状落在被测物上)。
    const run = (...args) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300000,
      })
    mkdirSync(join(dir, '.ihui-agent/archive'), { recursive: true })
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), plan, 'utf8')
    // 留痕落点必须**已在面上**(门 71 的归档豁免只认已入库的锚点,G-183 那条纪律)
    writeFileSync(
      join(dir, '.ihui-agent/archive/PROJECT_PLAN_2099-01-01_fixture.md'),
      '# 夹具留痕档\n',
      'utf8',
    )
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 'f@f')
    run('config', 'user.name', 'f')
    run('add', '-A')
    run('commit', '-qm', 'base(取自 HEAD 面真台账)')
    // 两侧必须**真的分叉**:先开一个分支提交对侧那行,再回到 main 提交本侧那行。
    // (我第一版两次都提交在 main 上 ⇒ theirs 成了 HEAD 的祖先 ⇒ merge-base == theirs ⇒
    //  合并结果就是本侧,零撞号 —— 报"0 组"看上去像判据通了,实际是夹具根本没造出那一型。)
    run('checkout', '-q', '-b', 'remote')
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      plan.replace(/\n+$/, '\n') + THEIRSROW + '\n',
      'utf8',
    )
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD').trim()
    run('checkout', '-q', 'main')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), plan.replace(/\n+$/, '\n') + MINE + '\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours(未推的一侧)')
    assert.notEqual(
      run('merge-base', 'main', theirs).trim(),
      theirs,
      '夹具必须真分叉(否则本条测的是空气)',
    )

    const cli = (extra) =>
      spawnSync(process.execPath, [TOOL, '--root', dir, '--jump', '250', ...extra], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 900000,
        maxBuffer: 1 << 27,
      })
    const check = cli([theirs])
    assert.equal(
      check.status,
      0,
      `缺省档必须 rc 0,实得 ${check.status}\n${check.stdout}\n${check.stderr}`,
    )
    assert.match(
      check.stdout,
      /预测 F9 新增撞号组:[1-9]/,
      '真内容阳性对照:必须**量到至少一组**(0 组即本器失明)',
    )
    assert.match(
      check.stdout,
      new RegExp(`✅ ${re(K.id)} →`),
      '必须给出"本侧让到哪个号"的可执行方案',
    )
    assert.match(check.stdout, /未落地\(缺省档零副作用/, '缺省档必须零副作用')
    const blobFile = join(dir, '.ihui-agent/tmp/o81-resume/agentB/blobs-renumber.json')
    assert.ok(!existsSync(blobFile), '缺省档不得产出 blob')
    // `--json` 档的 stdout 必须是**一个可 parse 的 JSON 文档**。本器第一版在 JSON 之后照样打人读尾行
    // ("未落地(缺省档零副作用…"),JSON.parse 当场报 "Unexpected non-whitespace character after JSON" ——
    // 这一型读代码看不出来,只有把**真输出**喂给 parse 才现形(取证脚本第一次跑就撞上它)。
    const asJson = cli(['--json', theirs])
    assert.equal(
      asJson.status,
      0,
      `--json 档必须 rc 0,实得 ${asJson.status}\n${asJson.stdout}\n${asJson.stderr}`,
    )
    let planJson
    assert.doesNotThrow(() => {
      planJson = JSON.parse(asJson.stdout)
    }, '--json 档的 stdout 混进了人读行 ⇒ 机器消费者拿不到结论(尾行必须随 --json 关掉)')
    assert.ok(Array.isArray(planJson.plans) && planJson.plans.length >= 1, '--json 必须带方案数组')
    assert.equal(planJson.mergedGroups, planJson.groups.length, 'mergedGroups 与 groups 必须同数')
    assert.ok(
      !('newText' in planJson) && !('archiveNewText' in planJson),
      '两份产出正文不得进 JSON(十几 MB 会把读数淹掉)',
    )
    assert.equal(
      typeof planJson.degenerate,
      'boolean',
      '退化面标记必须进 JSON —— 否则"0 组"这个读数在机器面上没有自描述',
    )

    const applied = cli(['--apply', theirs])
    assert.equal(
      applied.status,
      0,
      `--apply 应成功,实得 ${applied.status}\n${applied.stdout}\n${applied.stderr}`,
    )
    assert.ok(existsSync(blobFile), '--apply 必须产出 blobs.json')
    const parsed = JSON.parse(read(blobFile))
    assert.ok(
      Array.isArray(parsed.files) && parsed.files.length === 2,
      'blobs 必须只有台账 + 归档件两项',
    )
    for (const f of parsed.files) {
      const back = execFileSync(
        GIT,
        ['-c', 'safe.directory=*', '-C', dir, 'cat-file', 'blob', f.blob],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          encoding: 'utf8',
          windowsHide: true,
          maxBuffer: 1 << 27,
        },
      )
      assert.ok(
        back.length > 1000,
        `${f.path} 的 blob 回读近乎为空(本仓提交过 0 字节台账而三条断言全绿)`,
      )
      if (f.path === 'PROJECT_PLAN.md') {
        assert.match(back, /让号@/, '产出面必须带上行尾让号注记')
        assert.ok(!back.includes(MINE), '被让号的原文不得再留在台账面')
        assert.ok(
          !R.keyedRowsWith(back, K.id).some((l) => l.includes('本侧未推的新登记')),
          '旧号不得仍挂在该登记行的键位上',
        )
      } else {
        assert.ok(back.includes(MINE), '归档件必须逐字带上改前整行原文(门 71 的豁免就认这个)')
      }
    }
  } finally {
    rmScratch(dir)
  }
})

test('T6 面取不到 ⇒ UNDETERMINED + rc 2,绝不"没判"写成"判过了"', () => {
  const dir = mkScratch('ihui-renumber-undet-')
  try {
    const run = spawnSync(
      process.execPath,
      [TOOL, '--root', dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300000,
      },
    )
    assert.equal(run.status, 2, `非 git 仓必须 rc 2,实得 ${run.status}\n${run.stdout}${run.stderr}`)
    assert.match(
      run.stdout + run.stderr,
      /UNDETERMINED|未判定/,
      '必须点名"未判定"而不是给一个 0 组结论',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T9 --json 档在 rc=2 那一支也只出一个 JSON 文档(未判定不得伪装成人读行)', () => {
  const dir = mkScratch('ihui-renumber-json-undet-')
  try {
    const run = spawnSync(
      process.execPath,
      [TOOL, '--json', '--root', dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 300000 },
    )
    assert.equal(run.status, 2, `面取不到必须 rc 2,实得 ${run.status}\n${run.stdout}${run.stderr}`)
    let parsed
    assert.doesNotThrow(() => {
      parsed = JSON.parse(run.stdout)
    }, '--json + rc=2 的 stdout 也必须可 parse(否则机器消费者只能靠猜)')
    assert.equal(parsed.rc, 2, 'rc 字段必须与退出码同形')
    assert.ok(
      typeof parsed.undetermined === 'string' && parsed.undetermined.length > 0,
      '未判定必须点名原因',
    )
    // 反向对照:同一档不带 --json 时走的仍是人读面(两者不得互替)
    const human = spawnSync(
      process.execPath,
      [TOOL, '--root', dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 300000 },
    )
    assert.match(human.stdout, /UNDETERMINED 未判定:/, '人读档的措辞不得被 JSON 档改造带跑')
  } finally {
    rmScratch(dir)
  }
})

test('T7 少参数 ⇒ rc 2 并给可执行用法(不得写跑不通的出路)', () => {
  const run = spawnSync(process.execPath, [TOOL], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  assert.equal(run.status, 2)
  assert.match(run.stdout, /--theirs|<远端sha>/, '用法行必须给出 sha 的位置')
})

test('T8 特征标识符计数不变:补丁只加出路,没顺手动别人的逻辑', () => {
  if (!headUnionEnv || !existsSync(headUnionEnv))
    throw new Error(
      '缺 IHUI_RENUMBER_HEAD_UNION(HEAD 面 union-converge.mjs 副本)⇒ 本条**未执行**,不得记为通过',
    )
  const before = read(headUnionEnv)
  const after = read(CONV)
  for (const id of ['theirsRewriteCaps', 'SIM_THRESHOLD', 'noteCredits', 'byPlaceholder']) {
    const c = (s) => s.split(id).length - 1
    assert.equal(
      c(after),
      c(before),
      `标识符 ${id} 的计数变了(${c(before)} → ${c(after)}):本补丁只许加出路打印`,
    )
  }
  // 旧版这里比"字节增量在出路打印量级内"。那条断言与它要守的东西无关,且**必然随 HEAD 漂移**:
  // 出路打印由另一路会话落地后,本地副本与当下 HEAD 的差值就不只是那段打印(本轮实测 −674 字节),
  // 于是这把锁把"别人正常落地了同一段出路"读成"本器动了别人的逻辑" —— 一台永远无法满足的锁,
  // 与 §12e 那型同罪。换成两条真不变量:① 被审面(HEAD)必须已含那段 F9 出路打印并点名本器
  // (否则本器的出路在提交链上没人喊 = 只判不修);② 本地这份不得把那段打印改没(方向锁)。
  assert.match(
    before,
    /plan-collide-renumber[.]mjs/,
    'HEAD 面 union-converge 的 F9 判红处必须打印本器这条出路 —— 只判不修 = 每台每次人肉重推机理',
  )
  assert.match(
    after,
    /plan-collide-renumber[.]mjs/,
    '本地这份必须保留那条出路打印(摘掉它就是替全链把 F9 退回"只喊需人工")',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
