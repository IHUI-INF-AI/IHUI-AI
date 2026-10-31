// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据全部 import 生产实现(§22c),本文件不复制任何判据常量。
// 变异锁设计:成对夹具(rag=signaled / mcp=silent-degrade)+ 三枚"把判据改坏"的 mutant
// —— 只要生产判据被反转/掏空/换成吃任意键,下面这些精确断言必红(§0.10 失效方向)。
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as R } from '../check-retrieval-quality.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  EXITS,
  DEGRADE_KEY_SET,
  DEFAULT_FIXTURE,
  EVIDENCE_DOC,
  RAG_SAMPLE,
  MCP_SAMPLE,
  MCP_SAMPLE_WITH_KEY,
  SPEC_RAG,
  SPEC_MCP,
  PY_BRIDGE,
  readFileFace,
  extractFunctionBody,
  extractReturnDictKeys,
  classifyShape,
  judgeDegradeSignal,
  collectionDims,
  readRepoRrfConfig,
  readCounterpartParams,
  compareParams,
  runAll,
  decideExit,
  render,
  loadFixture,
  selfCheckNoFormula,
  pyBridgeIsCallOnly,
} = R

const SOURCE_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'check-retrieval-quality.mjs',
)

describe('J1 形态判定(生产判据,夹具档)', () => {
  it('rag 夹具 = 双腿并跑 + 融合(有 rrf_fuse 调用 + 两腿锚点)', () => {
    const s = classifyShape(RAG_SAMPLE, SPEC_RAG)
    assert.equal(s.shape, 'dual-leg-fused')
    assert.equal(s.concurrent, 2, '两条 create_task 才算并跑证据')
    assert.ok(
      s.evidence.some((e) => e.includes('rrf_fuse')),
      '融合调用必须进证据',
    )
  })

  it('mcp 夹具 = 串行回落(两腿都在但无融合调用)', () => {
    const s = classifyShape(MCP_SAMPLE, SPEC_MCP)
    assert.equal(s.shape, 'serial-fallback')
    assert.equal(s.fusion, null, '命中不到融合调用才算回落')
    assert.match(s.evidence.join('\n'), /腿次序=vector→text/)
  })

  it('两腿锚点都命不中 ⇒ undetermined(枚举到 0 不猜)', () => {
    assert.equal(classifyShape('def nothing():\n    return 1\n', SPEC_RAG).shape, 'undetermined')
  })

  it('多行签名必须整段算进体(第一版栽过的截断坑)', () => {
    const src =
      'async def f(\n    a: int,\n) -> dict:\n    x = rrf_fuse(a)\n    return {"ok": True}\n\n\ndef g():\n    pass\n'
    const fn = extractFunctionBody(src, 'f')
    assert.ok(fn, '定位得到')
    assert.match(fn.body, /rrf_fuse/, '体内必须含函数体内容而不是只有 def 行')
    assert.doesNotMatch(fn.body, /def g/, '不得吃进下一个函数')
  })
})

describe('J2 降级信号 · 成对夹具 + 变异锁', () => {
  it('正例:遥测出参写明 single-source ⇒ signaled', () => {
    const v = judgeDegradeSignal(RAG_SAMPLE, SPEC_RAG)
    assert.equal(v.verdict, 'signaled')
    assert.match(v.detail, /telemetry:stats\["mode"\]/)
  })

  it('正例:回落体无键 + carrier 恒 null + 只写 debug ⇒ silent-degrade', () => {
    const v = judgeDegradeSignal(MCP_SAMPLE, SPEC_MCP)
    assert.equal(v.verdict, 'silent-degrade')
    assert.match(v.detail, /carrier-only:semantic_index/)
    assert.match(v.detail, /log-only:debug/)
    assert.equal(v.signalKeys.length, 0, '出声键必须一枚都没有')
  })

  it('变异 M1(补键翻档):回落体加显式 degraded/fallback_reason ⇒ 必须变 signaled', () => {
    const v = judgeDegradeSignal(MCP_SAMPLE_WITH_KEY, SPEC_MCP)
    assert.equal(v.verdict, 'signaled')
    assert.deepEqual(v.signalKeys, ['degraded', 'fallback_reason'])
  })

  it('变异 M2(掏空判据翻档):关掉遥测维后 rag 不得仍报 signaled', () => {
    const v = judgeDegradeSignal(RAG_SAMPLE, SPEC_RAG, { telemetry: false })
    assert.notEqual(v.verdict, 'signaled')
  })

  it('变异 M3(判据吃任意键):把 message 塞进出声键集 ⇒ mcp 必须翻档', () => {
    const v = judgeDegradeSignal(MCP_SAMPLE, SPEC_MCP, { degradeKeys: ['message'] })
    assert.notEqual(v.verdict, 'silent-degrade')
  })

  it('变异 M4(反转生产判据必被抓住):反转 mutant 与生产判定在两枚夹具上不同档', () => {
    const invert = (body, spec) => {
      const v = judgeDegradeSignal(body, spec)
      return { ...v, verdict: v.verdict === 'silent-degrade' ? 'signaled' : 'silent-degrade' }
    }
    const pairs = [
      [RAG_SAMPLE, SPEC_RAG, 'signaled'],
      [MCP_SAMPLE, SPEC_MCP, 'silent-degrade'],
    ]
    for (const [body, spec, expected] of pairs) {
      assert.equal(judgeDegradeSignal(body, spec).verdict, expected, '生产判据精确值')
      assert.notEqual(invert(body, spec).verdict, expected, '反转后必须与精确值不符 ⇒ 谁反转谁翻红')
    }
  })

  it('返回体键不可枚举(** 展开)⇒ unjudged,不冒绿也不冒红', () => {
    const src =
      'def f():\n    try:\n        a = x\n    except Exception:\n        log.warning("fallback")\n    return {**payload, "ok": True}\n'
    const v = judgeDegradeSignal(src, SPEC_MCP, { carrierKeys: [] })
    assert.equal(v.verdict, 'unjudged')
    assert.match(v.detail, /枚举不全/)
  })

  it('既无降级痕迹也无 except ⇒ unjudged(谈不下降级)', () => {
    const v = judgeDegradeSignal('def f():\n    return {"ok": True}\n', SPEC_MCP, {
      carrierKeys: [],
    })
    assert.equal(v.verdict, 'unjudged')
  })
})

describe('返回体键枚举(段首注释 / ** 展开)', () => {
  it('字典字面量里的整行注释不得把键读丢(mcp 回落体的 V3 #75 注释实测踩过这一刀)', () => {
    const body =
      'def f():\n    return {\n        "ok": True,\n        # V3 #75:走到正则通道时语义通道的结论必须一起回去\n        "semantic_index": semantic_index_field,\n    }\n'
    const rs = extractReturnDictKeys(body)
    assert.equal(rs.length, 1)
    assert.equal(
      rs[0].opaque,
      false,
      '段首注释必须先剥掉,否则键集被读成"枚举不全"⇒ 整档退成 unjudged',
    )
    assert.deepEqual(rs[0].keys, ['ok', 'semantic_index'])
  })

  it('`**` 展开必须标 opaque(键集不全时判据不许冒充"已判无降级键")', () => {
    const rs = extractReturnDictKeys('def f():\n    return {**payload, "ok": True}\n')
    assert.equal(rs.length, 1)
    assert.equal(rs[0].opaque, true)
  })

  it('现场 mcp 回落体的键集必须枚举得全(全了才允许判 silent-degrade)', () => {
    const f = readFileFace('apps/ai-service/app/services/mcp_server.py')
    const fn = extractFunctionBody(f.text, '_tool_search_codebase')
    const rs = extractReturnDictKeys(fn.body)
    assert.ok(rs.length >= 4, `现读 return 体 ${rs.length} 枚`)
    assert.deepEqual(
      rs.filter((r) => r.opaque),
      [],
      '现场面不得有枚举不全的返回体',
    )
    assert.ok(
      rs.some(
        (r) => r.keys.includes('semantic_index') && !DEGRADE_KEY_SET.includes('semantic_index'),
      ),
    )
  })
})

describe('判据单源 · 零公式复制(门 191 反模式)', () => {
  it('本尺代码面(遮罩注释/字符串/正则后)没有 1/(k+rank) 形态', () => {
    const c = selfCheckNoFormula()
    assert.equal(c.clean, true, c.hit ? `命中 ${c.hit}` : 'clean')
  })

  it('python 桥只做 import + 调用(桥体内无算式)', () => {
    assert.equal(pyBridgeIsCallOnly(), true)
    assert.match(PY_BRIDGE, /from app\.services\.reranker import rrf_fuse/)
    assert.match(PY_BRIDGE, /_default_key/, '去重键也用真模块自己的,不另立一份')
  })

  it('加权档靠"同腿重复计入"表达,不引第二套算式', () => {
    const src = readFileSync(SOURCE_FILE, 'utf8')
    assert.match(src, /Array\(2\)\.fill\(toItems\(fx\.legs\.text\)\)/)
    assert.match(src, /labels: \['text', 'text', 'vector'\]/)
  })
})

describe('J3 融合差异(集合维不需公式;名次维必须派生真函数)', () => {
  it('集合维:并集/双命中/仅一腿 逐条量到', () => {
    const c = collectionDims(['a', 'b', 'c'], ['b', 'c', 'd'], 3)
    assert.equal(c.union, 4)
    assert.equal(c.inBoth, 2)
    assert.equal(c.onlyText, 1)
    assert.equal(c.onlyVector, 1)
    assert.equal(c.overlapTopK, 2, 'top3 交集 = {b,c}')
  })

  it('--no-python ⇒ 名次维 unjudged 且退出码 2(拒绝用复制的公式冒充同源)', () => {
    const r = runAll({ usePython: false })
    assert.equal(r.J3.status, 'unjudged')
    assert.ok(r.J3.missing.length > 0, '必须点名缺什么')
    assert.equal(r.exitCode, 2)
    assert.equal(r.J3.collection.inBoth, 2, '集合维不依赖公式,照样量得到')
  })

  it('python 可用时:名次来自真函数,且加权投影与无权确有分歧', (t) => {
    const r = runAll({})
    if (r.J3.status !== 'judged') {
      t.diagnostic(`本轮取不到 python 侧 rrf_fuse:${r.J3.reason} ⇒ 名次维未判定(已如实点名,不当绿)`)
      t.skip('python 不可用')
      return
    }
    assert.match(r.J3.provenance.implFile, /reranker\.py$/)
    assert.equal(
      r.J3.collection.textOnly,
      DEFAULT_FIXTURE.legs.text.length,
      '默认档必须真用内置夹具',
    )
    assert.equal(r.J3.rrfOrder[0], 'apps/ai-service/app/services/rag.py')
    const z = r.J3.ranks.find((x) => x.id === 'apps/ai-service/app/services/codebase_indexer.py')
    assert.ok(z.rrfRank < z.wrrfRank, '关键词腿加权 2:1 后,只在向量腿头名的片必须被挤后')
    assert.ok(r.J3.topKSets.firstDifference, '两种融合必须量出首个分歧位')
    assert.ok(
      r.J3.ranks.some((x) => x.dRrfVsBestSingle !== null && x.dRrfVsBestSingle !== 0),
      '至少一枚片的名次因融合而移动 ⇒ 否则"融合"这一维没被量到',
    )
  })

  it('--fixture 读的是夹具本身,不是内置档(否则前后对比凭据不可追责)', () => {
    const dir = mkScratch('rq-fixture-')
    try {
      const good = path.join(dir, 'f.json')
      // 故意写一枚与内置夹具**不同**的档:读数若不真吃夹具,这条断言会对着默认夹具过(假锁)。
      writeFileSync(
        good,
        JSON.stringify({
          query: '夹具覆盖',
          topK: 2,
          legs: {
            text: [{ id: 'p.ts' }, { id: 'q.ts' }, { id: 'r.ts' }],
            vector: [{ id: 's.ts' }, { id: 'p.ts' }],
          },
        }),
        'utf8',
      )
      assert.deepEqual(
        loadFixture(good).legs.text.map((x) => x.id),
        ['p.ts', 'q.ts', 'r.ts'],
      )
      const r = runAll({ fixturePath: good })
      assert.equal(r.J3.fixture.loadedFrom, good, '夹具落点必须被点名(读数可追责到那枚档)')
      assert.equal(r.J3.fixture.query, '夹具覆盖')
      assert.equal(r.J3.collection.textOnly, 3, '夹具腿长度必须来自夹具(内置档是 5)')
      assert.equal(r.J3.collection.union, 4, '并集 = p/q/r/s ⇒ 4')
      const bad = path.join(dir, 'bad.json')
      writeFileSync(bad, JSON.stringify({ query: 'x' }), 'utf8')
      assert.throws(() => loadFixture(bad), /legs/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })
})

describe('J4 对照侧口径(现读,不改本仓参数)', () => {
  it('取证册读数 = rrfK 60 / textWeight 2 / vectorWeight 1,并给出活引擎靶路径', () => {
    const cp = readCounterpartParams({ docFace: readFileFace(EVIDENCE_DOC) })
    assert.deepEqual([cp.rrfK, cp.textWeight, cp.vectorWeight], [60, 2, 1])
    assert.match(String(cp.bundlePath), /qoder-search\.bundle\.mjs$/)
    assert.match(cp.face, /evidence-doc/, '默认档必须自陈是二手读数')
  })

  it('取证册取不到 ⇒ face=undetermined(不把对方数字硬编进判据)', () => {
    assert.equal(
      readCounterpartParams({ docFace: { ok: false, reason: 'no doc' } }).face,
      'undetermined',
    )
  })

  it('本仓现场:rrfK 两处默认同档,腿权重一枚都没有 ⇒ textWeight 维判 different', () => {
    const ragFace = readFileFace('apps/ai-service/app/services/rag.py')
    const rerankerFace = readFileFace('apps/ai-service/app/services/reranker.py')
    assert.ok(ragFace.ok && rerankerFace.ok, ragFace.reason ?? rerankerFace.reason)
    const repo = readRepoRrfConfig({ ragFace, rerankerFace, env: {} })
    assert.equal(repo.ragDefaultK, 60)
    assert.equal(repo.rerankerDefaultK, 60)
    assert.equal(repo.kSourcesAgree, 'same')
    assert.deepEqual(repo.legWeights, [], '本仓 rrf_fuse 无权重参数 ⇒ 现读必须 0 命中')
    assert.ok(!repo.fuseParams.includes('weight'), '形参清单里不得出现 weight')
    const cmp = compareParams(repo, readCounterpartParams({ docFace: readFileFace(EVIDENCE_DOC) }))
    assert.equal(cmp.rows.find((r) => r.dim === 'rrfK').verdict, 'same')
    assert.equal(cmp.rows.find((r) => r.dim === 'textWeight').verdict, 'different')
    assert.equal(cmp.rows.find((r) => r.dim === 'vectorWeight').verdict, 'same')
  })

  it('对方某维读不到 ⇒ 该维 unjudged(不许拿本仓数字冒充对方)', () => {
    const cmp = compareParams(
      {
        ragDefaultK: 60,
        rerankerDefaultK: 60,
        kSourcesAgree: 'same',
        legWeights: [],
        weightsAbsence: 'absent(等价 1:1)',
        envName: null,
        envValue: null,
        fuseParams: ['rankings', 'k'],
      },
      { rrfK: null, textWeight: null, vectorWeight: null },
    )
    assert.deepEqual(
      cmp.rows.map((r) => r.verdict),
      ['unjudged', 'unjudged', 'unjudged'],
    )
  })
})

describe('现场判定 + 三态退出码 + 只读纪律', () => {
  it('现场两枚出口都必须判出(不因判据失灵而 unjudged),且档位与证据自洽', () => {
    const r = runAll({})
    assert.equal(r.J1.items.length, EXITS.length, '出口清单必须逐条判出')
    assert.equal(r.J1.unjudged.length, 0, JSON.stringify(r.J1.unjudged))
    for (const it of r.J1.items) {
      assert.ok(
        ['dual-leg-fused', 'serial-fallback', 'single-leg'].includes(it.shape),
        `未知档位 ${it.shape}`,
      )
      if (it.shape === 'dual-leg-fused') {
        assert.ok(
          it.fusion && it.legs.vector && it.legs.text,
          'dual-leg-fused 必须同时有融合调用与两腿证据',
        )
      }
      if (it.shape === 'serial-fallback') {
        assert.equal(it.fusion, null, 'serial-fallback 的成立前提就是体内没有融合调用')
        assert.ok(it.legs.vector && it.legs.text, '两腿都得在,否则不叫回落')
      }
    }
  })

  it('现场 rag 那条腿必须是已融合档(主席事实之一:knowledge-rag 已走 rrf_fuse)', () => {
    const rag = runAll({}).J1.items.find((i) => i.exit === 'rag._retrieve')
    assert.equal(rag.shape, 'dual-leg-fused', rag.shape)
    assert.match(rag.evidence.join('\n'), /rrf_fuse/)
  })

  it('现场 mcp 的 verdict 与证据自洽:判 signaled 就必须真拿得出出声键', () => {
    const r = runAll({})
    const mcp = r.J2.items.find((i) => i.exit === 'mcp.search_codebase')
    assert.ok(mcp, '出口必须在册')
    if (mcp.verdict === 'signaled') {
      assert.ok(
        mcp.signalKeys.length > 0 || mcp.telemetry.length > 0,
        'signaled 必须带得出键证据(下一票修好后此路即正路)',
      )
    } else {
      assert.equal(mcp.verdict, 'silent-degrade', '当前在册缺陷档')
      assert.equal(mcp.signalKeys.length, 0)
      assert.match(mcp.detail, /carrier-only|log-only|no-carrier/)
    }
  })

  it('rag 那条腿在现场必须是 signaled(遥测出声道原因)—— 否则尺子把"已融合"读成"已降级"', () => {
    const r = runAll({})
    const rag = r.J2.items.find((i) => i.exit === 'rag._retrieve')
    assert.equal(rag.verdict, 'signaled')
  })

  it('退出码优先级:未判定 > 缺陷 > 绿;枚举 0 枚 ⇒ 未判定', () => {
    assert.equal(
      decideExit({ unjudgedDims: ['x'], J1: { items: [{}] }, J2: { items: [{}], defects: [{}] } }),
      2,
    )
    assert.equal(
      decideExit({ unjudgedDims: [], J1: { items: [{}] }, J2: { items: [{}], defects: [{}] } }),
      1,
    )
    assert.equal(
      decideExit({ unjudgedDims: [], J1: { items: [{}] }, J2: { items: [{}], defects: [] } }),
      0,
    )
    assert.equal(
      decideExit({ unjudgedDims: [], J1: { items: [] }, J2: { items: [], defects: [] } }),
      2,
    )
  })

  it('只读纪律:派生 git/python 一律显式 stdio + windowsHide(§12g),取正文不得自派生(§0.4/门 118)', () => {
    const file = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'check-retrieval-quality.mjs',
    )
    const src = readFileSync(file, 'utf8')
    const calls = src.split('spawnSync(').slice(1)
    // 处数由 3 降到 2:HEAD 面正文改经 face-reader 的 catBatch,§12g 的 stdio 与重试归那一层单源。
    // 这里刻意不写死等值 —— 本例判据是「每处派生都显式 stdio + windowsHide」,
    // 写死数量只会把正当收敛变成假红(收紧靠下面新加的两道不变式锁,不靠计数)。
    assert.ok(calls.length >= 2, `现读 spawnSync 调用 ${calls.length} 处,少于 2 说明派生面被摘掉了`)
    for (const c of calls) {
      const head = c.slice(0, 700)
      assert.match(head, /stdio: \[[^\]]*\]/, '每处都必须显式 stdio')
      assert.match(head, /windowsHide: true/, '每处都必须 windowsHide')
    }
    // 收紧档(门 118 不变式):取 blob 正文必须走统一取材层,谁改回自派生就翻红。
    assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须 import 统一取材层')
    assert.match(src, /catBatch\(/, 'HEAD 面正文必须经 catBatch 取')
    assert.doesNotMatch(src, /['"]show['"]\s*,\s*[`'"]HEAD:/, '不得自派生 git show HEAD:<path> 取正文')
    assert.doesNotMatch(src, /os\.tmpdir\(\)/, '临时物不得落 os.tmpdir(§15b)')
  })

  it('刻意不进提交链:runner / pre-commit / 根 package.json / CI 里都不得出现本尺文件名', () => {
    for (const rel of [
      'scripts/guardian-runner.mjs',
      'scripts/lib/pre-commit-hook.js',
      'package.json',
      '.husky/pre-commit',
    ]) {
      const f = readFileFace(rel)
      if (!f.ok) continue
      assert.ok(
        !f.text.includes('check-retrieval-quality'),
        `${rel} 里出现了本尺 ⇒ 违反 §12e(判机器态的尺子挂提交链即恒红门)`,
      )
    }
  })

  it('出口清单在册(新增出口必须先登记,否则尺子静默漏量)', () => {
    assert.deepEqual(
      EXITS.map((e) => e.name),
      ['rag._retrieve', 'mcp.search_codebase'],
    )
    for (const spec of EXITS) {
      const f = readFileFace(spec.file)
      assert.ok(f.ok, `${spec.file} 面取不到:${f.reason}`)
      assert.ok(extractFunctionBody(f.text, spec.fn), `${spec.fn} 必须在 ${spec.file} 里定位得到`)
    }
    assert.ok(
      DEGRADE_KEY_SET.includes('degraded') && DEGRADE_KEY_SET.includes('fallback_reason'),
      '出声键集至少含这两枚',
    )
  })

  it('渲染不崩:现场报告出人读文本与 WARNING 协议行', () => {
    const text = render(runAll({}))
    assert.match(text, /\[WARNING\] silent_degrade exits=\d+ names=/)
    assert.match(text, /J4 对照侧口径/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
