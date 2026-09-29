// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 `check-inbound-schema-strict.mjs`(G-674)的 §22c 镜像测试。
//
// 每例为什么存在:本门判的是"入站契约有没有对未知字段表态"。它没有编译期症状 ——
// 少一个 `.strict()` 时 typecheck/build/其余门全绿,表现是"客户端多塞的字段被静默收下
// 或静默丢掉"。而门自身有四种"看起来正常其实失明"的方式,每一种都只会表现为一路报绿:
//   ① 注册块没插上(门存在、判据对、无人调度);
//   ② 取材面退回磁盘或散写 `git show`(共享工作树滞后 HEAD ⇒ 恒红/假绿来回跳);
//   ③ 方向判据被放宽成"默认算入站"(出站契约也被要求拒未知字段 = 噪声机,人学会跳过钩子);
//   ④ 未判定被读成通过(把"没看清"写成"没问题")。
// 所以这里既有源码形状锁,也有**构造面 + 私有索引**的行为锁(§22c:镜像只复读实现就是复读机)。

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = join(REPO, 'scripts', 'check-inbound-schema-strict.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const GATE_NAME = 'check-inbound-schema-strict.mjs'

function runNode(file, args, opts = {}) {
  return execFileSync(process.execPath, [file, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout: 600000,
    ...opts,
  })
}
function runGate(args, opts = {}) {
  try {
    const out = runNode(SRC, args, opts)
    return { out, rc: 0 }
  } catch (e) {
    return { out: `${e.stdout || ''}${e.stderr || ''}`, rc: e.status ?? -1 }
  }
}
function gitEnv(env) {
  return env ? { ...process.env, GIT_INDEX_FILE: env } : process.env
}
function git(args, env) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    env: gitEnv(env),
  })
}
/** 走 stdin 喂内容给 `git hash-object -w --stdin`(不经 shell,免码页/引号坑)。 */
function gitStdin(args, env, input) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd: REPO,
    encoding: 'utf8',
    input,
    maxBuffer: 1 << 28,
    windowsHide: true,
    env: gitEnv(env),
  })
}

test('T1 装车方向锁:注册块若在则成套(blocking+skipEnv+stagedTriggers),若缺则头注不得自称已接线', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const src = readFileSync(SRC, 'utf8')
  const wired = runner.includes(GATE_NAME)
  if (wired) {
    const at = runner.indexOf(GATE_NAME)
    const block = runner.slice(Math.max(0, at - 1200), at + 1800)
    assert.match(block, /id:\s*'?\d+'?/, '注册块没有 id —— 撞号会串 skipEnv 与失败归属(守门 89 R5)')
    assert.match(
      block,
      /mode:\s*'blocking'/,
      '已接线就必须是 blocking(存量由该文件 HEAD 棘轮兜住,不会恒红)',
    )
    assert.match(
      block,
      /skipEnv:\s*'HUSKY_SKIP_INBOUND_SCHEMA_STRICT'/,
      '缺 skipEnv 就没有应急出口',
    )
    assert.match(
      block,
      /stagedTriggers:[\s\S]*apps\/api/,
      '缺 stagedTriggers 时本门在提交链上根本不唤起',
    )
    assert.ok(
      !/尚未接进提交链/.test(src),
      '头注仍写"尚未接进提交链"而注册块已在 —— 文档与账面分叉,后人会按谎报的那句找门',
    )
  } else {
    // 未注册时不得被读成已装车:门体自称"已接 pre-commit/第 N 项"就是给守门 89 埋 R1/R2
    assert.match(src, /尚未接进提交链/, '未注册 ⇒ 头注必须如实写明,不得含糊')
    assert.ok(
      !/已接\s*pre-commit|已注册进\s*guardian|guardian\s*第\s*\d+\s*项/.test(src),
      '门未接进提交链,却自称已接线 —— 判据存在而永不调用 = 没有(守门 70/76/81 同型)',
    )
  }
})

test('T2 取材面形状锁:内容必须经 face-reader 的 catBatch,不得散写 git / 按磁盘读被审内容', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走统一取材层')
  assert.match(src, /catBatch\(/, '引了层却没用它读内容 = 半接线(守门 118 那一型)')
  assert.match(src, /selectFace\(/, '面必须由 selectFace 判,两面旗同给即 exit 2')
  assert.ok(!/readFileSync\(\s*join\(\s*ROOT/.test(src), '不得用 ROOT 拼磁盘路径读被审内容')
  assert.ok(!/gitRaw\(\[[^\]]*'show'/.test(src), '不得散写 git show 取内容(应走 catBatch 同面同轮)')
  assert.ok(!/process\.cwd\(\)/.test(src), 'ROOT 不得由 cwd 推(守门 70 的镜像 13/14 恒红那一型)')
})

test('T3 遮噪器只许一份实现:必须引 lib/code-mask,不得自带第二台分词器', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '注释/字符串剥离必须共用那一份实现')
  assert.ok(
    !/function\s+maskCommentsAndStrings/.test(src),
    '门内不得再抄一台遮噪器(两处算同一件事必漂移)',
  )
})

test('T4 构造面行为锁(判据有牙,不在测试里复读实现)', async () => {
  const { __test__ } = await import(pathToFileURL(SRC).href)
  const { judgeFile, FIXTURES, classifyDirection } = __test__
  const bare = judgeFile(FIXTURES.bareInbound).counts
  const strict = judgeFile(FIXTURES.strictInbound).counts
  assert.equal(bare.bareInbound, 1, '裸 z.object 被当请求体校验必须计违规')
  assert.equal(
    strict.bareInbound,
    0,
    '同一位置补上 .strict() 必须归零(否则判据只是"看见 z.object 就红")',
  )
  assert.equal(
    judgeFile(FIXTURES.passthroughInbound).counts.looseDeclared,
    1,
    '.passthrough() 必须是"待偿点名"而不是放过',
  )
  assert.equal(
    judgeFile(FIXTURES.inComment).occurrences,
    0,
    '注释里的同一形状不得计入(门给自己发合格证的经典形态)',
  )
  assert.equal(judgeFile(FIXTURES.inString).occurrences, 0, '字符串里的同一形状不得计入')
  assert.equal(
    judgeFile(FIXTURES.outboundLiteral).counts.bareInbound,
    0,
    '出站当场构造的字面量必须排除(否则门变成噪声机)',
  )
  assert.equal(
    judgeFile(FIXTURES.thirdPartyResponse).counts.bareInbound,
    0,
    '第三方响应不属"客户端自报"这一 mandate',
  )
  assert.equal(
    judgeFile(FIXTURES.unknownDirection).counts.undirected,
    1,
    '方向判不出必须落未判定并报名,不得默认算入站',
  )
  assert.equal(
    judgeFile(FIXTURES.importedReceiver).unresolvedSites.length,
    1,
    '解析不到链的接收者必须点名,不得静默',
  )
  assert.equal(judgeFile(FIXTURES.bareMarker).counts.bareInbound, 1, '裸豁免标记(无原因)不得放行')
  assert.equal(judgeFile(FIXTURES.exempted).counts.bareInbound, 0, '带原因豁免放行且单独计一档')
  assert.equal(
    judgeFile(FIXTURES.notZodReceivers).sites,
    0,
    'JSON.parse / Date.parse 不得被读成校验点',
  )
  assert.equal(
    judgeFile(FIXTURES.bareTwoConsumers).counts.bareSites -
      judgeFile(FIXTURES.bareOneConsumer).counts.bareSites,
    1,
    '第二消费点必须移动读数(只按契约份数棘轮就会让"复用裸 schema 再加一条路由"净零逃逸)',
  )
  assert.equal(
    judgeFile(FIXTURES.outboundLiteral2).counts.bareSites,
    0,
    '出站重复 parse 不得计入站敞口',
  )
  // 方向判据单独钉:同一实参位上 inbound / outbound / thirdParty / config / unknown 五答互不串门
  assert.equal(classifyDirection('request.body'), 'inbound')
  assert.equal(classifyDirection('wsMessage'), 'inbound')
  assert.equal(classifyDirection('{ model: m }'), 'outbound')
  assert.equal(classifyDirection('res.body'), 'thirdParty')
  assert.equal(classifyDirection('process.env'), 'config')
  assert.equal(classifyDirection('someOpaqueValue'), 'unknown')
})

test('T5 真仓 HEAD 阳性对照:看不见存量不算通过,而全量档不得因存量判红', () => {
  const { out, rc } = runGate(['--json'])
  assert.equal(rc, 0, `HEAD 全量档必须 exit 0(实得 ${rc};非 0 说明有东西与任何提交都无关地红了)`)
  const j = JSON.parse(
    out
      .split('\n')
      .filter((l) => !l.startsWith('#EVIDENCE'))
      .join('\n'),
  )
  assert.equal(j.face, 'head')
  assert.ok(j.scannedFiles > 500, `扫描面异常小(${j.scannedFiles})⇒ 枚举或过滤坏了`)
  assert.ok(j.occurrences.total > 1000, `看不见票面量级(实得 ${j.occurrences.total})⇒ 判据失明`)
  assert.ok(
    j.totals.bareInbound > 100,
    `裸入站存量实得 ${j.totals.bareInbound}(票面现读 2187 处 z.object)`,
  )
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.equal(j.red.length, 0, '默认档(面=HEAD)不得因存量判红 —— 那是恒红门')
  assert.ok(
    j.totals.undirected + j.unresolvedSites.length > 0,
    '未判定必须有条目被点名(0 条读起来像"全都判得出")',
  )
})

test('T6 棘轮锚点写法:锚点是该文件 HEAD 自身存量,不是静态清单也不是常量 0', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /readFace\(\[f\],\s*'head'\)/, '暂存档的锚点必须现取 HEAD 面该文件的正文')
  assert.match(src, /bareInbound > cap/, '锚点比较必须是"多于该文件自身存量才红"')
  assert.ok(
    !/-batch-write|-baseline\.json/.test(src),
    '本门刻意不落基线清单文件:清单必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 的教训)',
  )
})

test('T7 退出码判序用构造面证明:空扫/取不到/未判定都不得被写成"通过"', async () => {
  const { __test__ } = await import(pathToFileURL(SRC).href)
  const { decideExit } = __test__
  assert.equal(
    decideExit({
      unreadableCount: 2,
      emptyScan: false,
      redCount: 9,
      strict: false,
      strictHits: 0,
      undeterminedCount: 0,
    }),
    2,
  )
  assert.equal(
    decideExit({
      unreadableCount: 0,
      emptyScan: true,
      redCount: 9,
      strict: false,
      strictHits: 0,
      undeterminedCount: 0,
    }),
    2,
  )
  assert.equal(
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 9,
      strict: false,
      strictHits: 9,
      undeterminedCount: 0,
    }),
    1,
  )
  assert.equal(
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 0,
      strict: true,
      strictHits: 3,
      undeterminedCount: 3,
    }),
    2,
  )
  assert.equal(
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 0,
      strict: true,
      strictHits: 3,
      undeterminedCount: 0,
    }),
    1,
  )
  assert.equal(
    decideExit({
      unreadableCount: 0,
      emptyScan: false,
      redCount: 0,
      strict: false,
      strictHits: 0,
      undeterminedCount: 99,
    }),
    0,
  )
})

test('T8 未知字段必拒:拿仓里那份 zod 真跑一次语义(量不到就明写未判定,不得静默通过)', async (t) => {
  const tried = []
  let z = null
  for (const root of [REPO, ...mainWorktreeCandidates()]) {
    tried.push(root)
    try {
      const req = createRequire(join(root, 'noop.js'))
      z = req('zod')
      break
    } catch {
      /* 该根没有 node_modules:继续试下一个,最后如实报未判定 */
    }
  }
  if (!z || typeof z.object !== 'function') {
    t.skip(
      `未判定:解析不到 zod(已试 ${tried.join(' , ')})⇒ "未知字段必拒"这一语义本轮未取到运行时证明`,
    )
    return
  }
  const loose = z.object({ name: z.string() })
  const strict = z.object({ name: z.string() }).strict()
  const payload = { name: 'x', role: 'admin' }
  assert.equal(
    loose.safeParse(payload).success,
    true,
    '不表态时未知字段被静默剥掉 —— 这正是本门要拦的默认',
  )
  assert.equal(
    strict.safeParse(payload).success,
    false,
    '表态 .strict() 后未知字段必拒(本门验收的语义)',
  )
  assert.equal(
    loose.safeParse(payload).data.role,
    undefined,
    '被剥掉的字段在响应面上不留痕(所以只能靠契约本身表态)',
  )
})

test('T9 暂存档端到端(私有索引):空暂存退全量并如实点名;注入新违规必红;补 .strict() 后不越锚点', () => {
  const dir = mkScratch('b674-')
  const emptyIdx = join(dir, 'empty.index')
  const injectIdx = join(dir, 'inject.index')
  const strictIdx = join(dir, 'strict.index')
  const target = 'apps/api/src/plugins/ws-chat.ts'
  try {
    // 臂 A:空索引 ⇒ 射程内 0 个 ⇒ 必须回退 HEAD 面并大声写明,而不是判"无法判定"挡路
    const a = runGate(['--staged', '--json'], { env: { ...process.env, GIT_INDEX_FILE: emptyIdx } })
    assert.equal(a.rc, 0, `空暂存回退档应 exit 0(实得 ${a.rc}:${a.out.slice(-400)})`)
    const ja = JSON.parse(
      a.out
        .split('\n')
        .filter((l) => !l.startsWith('#EVIDENCE'))
        .join('\n'),
    )
    assert.equal(ja.requestedFace, 'staged')
    assert.equal(ja.face, 'head', '暂存档退化成 HEAD 全量面时必须在面上写明')
    assert.ok(
      ja.retreatReason && /回退/.test(ja.retreatReason),
      '回退必须留下可读原因(否则读成"这一面判过了")',
    )

    // 臂 B:私有索引里给该文件追加一处**新的**裸入站契约 ⇒ --staged 必须判红并点名
    const headBlob = git(['show', `HEAD:${target}`])
    const addedBare = `\nconst b674ProbeSchema = z.object({ probe: z.string() })\nconst b674ProbeParsed = b674ProbeSchema.safeParse(request.body)\n`
    const addedStrict = `\nconst b674ProbeSchema = z.object({ probe: z.string() }).strict()\nconst b674ProbeParsed = b674ProbeSchema.safeParse(request.body)\n`
    for (const [idx, patch] of [
      [injectIdx, addedBare],
      [strictIdx, addedStrict],
    ]) {
      git(['read-tree', 'HEAD'], idx)
      const oid = gitStdin(['hash-object', '-w', '--stdin'], idx, headBlob + patch)
      assert.match(
        oid.trim(),
        /^[0-9a-f]{40}/,
        'hash-object 没给 oid ⇒ 注入根本没命中,B 臂的红就无从谈起',
      )
      git(['update-index', '--add', '--cacheinfo', `100644,${oid.trim()},${target}`], idx)
      // 注入自证:索引里那份必须真含补丁那句(否则"两臂都绿"是夹具坏了,不是判据对)
      const staged = git(['show', `:${target}`], idx)
      assert.ok(
        staged.includes(patch.trim().split('\n')[0]),
        '索引里没出现注入的声明 ⇒ 私有索引臂空转',
      )
    }
    const b = runGate(['--staged', '--json'], {
      env: { ...process.env, GIT_INDEX_FILE: injectIdx },
    })
    const jb = JSON.parse(
      b.out
        .split('\n')
        .filter((l) => !l.startsWith('#EVIDENCE'))
        .join('\n'),
    )
    assert.equal(b.rc, 1, `注入一处新的裸入站契约必须判红(实得 rc=${b.rc})`)
    assert.equal(jb.face, 'staged', '这一臂必须真判索引面,不得借 HEAD 内容凑数')
    assert.ok(
      jb.red.some((x) => x.file === target),
      '红点必须点名被注入的文件',
    )

    // 臂 C:同一处补上 .strict() ⇒ 存量不升反降 ⇒ 不得判红(证明 B 的红来自"新增",不是恒红)
    const c = runGate(['--staged', '--json'], {
      env: { ...process.env, GIT_INDEX_FILE: strictIdx },
    })
    const jc = JSON.parse(
      c.out
        .split('\n')
        .filter((l) => !l.startsWith('#EVIDENCE'))
        .join('\n'),
    )
    assert.equal(c.rc, 0, `补 strict 后不得判红(实得 ${c.rc})`)
    assert.ok(!jc.red.some((x) => x.file === target), '补了 .strict() 仍被点名 ⇒ 锚点没跟着面走')

    // 臂 D:只给**已有的裸契约**多接一个入站消费点 ⇒ 契约份数不变、敞口 +1 ⇒ 必须仍判红
    //   (只按份数立棘轮时,这一型正是"换个写法就净零逃逸"的那一格 —— 守门 134 同一课)
    const reuseIdx = join(dir, 'reuse.index')
    git(['read-tree', 'HEAD'], reuseIdx)
    const reusePatch = `\nconst b674ReuseParsed = createRoomSchema.safeParse(request.query)\n`
    const oid2 = gitStdin(['hash-object', '-w', '--stdin'], reuseIdx, headBlob + reusePatch)
    git(['update-index', '--add', '--cacheinfo', `100644,${oid2.trim()},${target}`], reuseIdx)
    const d = runGate(['--staged', '--json'], { env: { ...process.env, GIT_INDEX_FILE: reuseIdx } })
    const jd = JSON.parse(
      d.out
        .split('\n')
        .filter((l) => !l.startsWith('#EVIDENCE'))
        .join('\n'),
    )
    const redD = jd.red.find((x) => x.file === target)
    assert.ok(redD, `复用裸契约加第二个入站点必须判红(实得 rc=${d.rc})`)
    assert.equal(
      redD.bare,
      redD.cap,
      '这一臂的契约份数必须**没变**(否则红来自第一维,第二维就没被证明)',
    )
    assert.ok(redD.bareSites > redD.capSites, '第二维读数必须上升才算抓到这一型')
  } finally {
    rmScratch(dir)
  }
})

test('T10 溯源横幅在位(水印层的 L1 是判据可读性的前提,漂了不会自己喊)', () => {
  for (const f of [SRC, join(HERE, 'check-inbound-schema-strict.test.mjs')]) {
    const head = readFileSync(f, 'utf8').split('\n').slice(0, 4).join('\n')
    assert.match(head, /Provenance-watermarked\./, `${f} 缺 L1 横幅`)
  }
})

/** 主 worktree 候选(§26 junction 与 §5b 盘符一律现读,不得写死)。 */
function mainWorktreeCandidates() {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
    })
    return out
      .split('\n')
      .filter((l) => l.startsWith('worktree '))
      .map((l) => l.slice('worktree '.length).replace(/\\/g, '/'))
      .filter((p) => resolve(p) !== resolve(REPO))
  } catch {
    return []
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
