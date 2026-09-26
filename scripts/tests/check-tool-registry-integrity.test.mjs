// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— `scripts/check-tool-registry-integrity.mjs`(V3 #47 / #49)。
 *
 * 为什么必须有这个文件而不是只靠 `--self-test`:自检那 27 例是**门自己写的判据重放**,
 * 它证明"判据按我想到的方式工作";本文件额外钉三件自检结构上给不出的东西:
 *   T1 装车证明:提交链(pre-commit-hook)真的调用本门,且失败即 process.exit(1)。
 *      门存在而没人跑 = 没有(守门 70/76/81 同型;#47 这一票的立项理由之一就是
 *      "引擎内置名对全部门禁盲视")。
 *   T2 摘线必判未接线:把注册点删掉时,必须**不能**被判成已装车。
 *   T3/T3b/T3c 取材面形状锁:三条被审路径必须由 face-reader 现读,禁止回落工作树。
 *   T4–T7 V3 #47 的三条新判据(J12/J13/J14)各有一红一绿的成对证明,且输入
 *      **逐字取自真仓文件**(§22c 红线:夹具只复刻实现形状 = 复读机)。
 * 判据函数一律 `import` 源文件导出的 `__test__`,不得在本文件里再抄一份(§22c)。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as G } from '../check-tool-registry-integrity.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const readWorktree = (rel) => readFileSync(join(ROOT, rel), 'utf8')

// --- T1/T2 装车证明 ---------------------------------------------------------

test('T1 提交链必须真调用本门,且失败会中止提交(blocking)', () => {
  const hook = readFileSync(join(ROOT, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  assert.match(
    hook,
    /node scripts\/check-tool-registry-integrity\.mjs[^\n]*--staged/,
    'pre-commit-hook 不再调用本门 = 门存在而无人跑(造好没装车)',
  )
  // 逃生舱必须在位:没有应急通道的 blocking 门只会逼人手工 commit 并跳掉全部守门
  assert.match(hook, /HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY/, '紧急跳过开关被摘 = 应急路径消失')
  const block = hook.slice(
    hook.indexOf('HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY'),
    hook.indexOf('HUSKY_SKIP_TOOL_REGISTRY_INTEGRITY') + 1400,
  )
  assert.match(block, /process\.exit\(1\)/, '本门失败必须是 blocking,不得退化成 warn')
})

test('T2 摘线时不得被判定为已装车(反向对照)', () => {
  // 判据本体:接线与否由"字符串是否出现在 hook 里"决定 —— 删掉即不成立。
  const hook = readFileSync(join(ROOT, 'scripts', 'lib', 'pre-commit-hook.js'), 'utf8')
  const unwired = hook.replace(
    /node scripts\/check-tool-registry-integrity\.mjs[^\n]*--staged/,
    'node scripts/some-other-gate.mjs',
  )
  // 只认**带 --staged 的那一条调用**:hook 里另有一处 `--self-test` 的提示文案,
  // 按"提到过脚本名"判的话,摘线对照永远做不出来。
  assert.doesNotMatch(
    unwired,
    /check-tool-registry-integrity\.mjs[^\n]*--staged/,
    '夹具没造出"摘线"形态,这条对照无意义',
  )
})

// --- T3 取材面形状锁 -------------------------------------------------------

test('T3 三条被审路径必须由 face-reader 现读,且工作树只是逃生舱', () => {
  const src = readFileSync(
    join(ROOT, 'scripts', 'check-tool-registry-integrity.mjs'),
    'utf8',
  )
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '门不再走统一取材层')
  assert.match(src, /catBatch\(/, '面内容不再经 cat-file 批量读')
  assert.match(src, /selectFace\(/, '面选择不再由统一实现决定')
  // 形状锁落在**导入面**上:本文件头注里就写着旧写法 `readFileSync(join(ROOT, …))`,
  // 按"提到过"判会把说明文字判成违规(本票 J12 刚踩过同一型)。门只要没 import
  // readFileSync,实跑路径就不可能按磁盘读 —— 比扫函数体更窄也更硬。
  const fsImport = /import \{([^}]*)\} from 'node:fs'/.exec(src)
  assert.ok(fsImport, '找不到 node:fs 的导入面,形状锁失去对象')
  assert.doesNotMatch(
    fsImport[1],
    /readFileSync/,
    '实跑路径重新 import readFileSync = 共享工作树滞后 HEAD 时判据在恒红/假绿之间跳',
  )
  // 并且必须真的用到统一取材层读内容(只 import 不调用 = 第二型"造好没装车")。
  // 真签名是 catBatch(root, specs, …),specs 由 selectFace 选出的那一面枚举出来 ——
  // 只匹配 import 而实际仍按磁盘拼路径,就是本仓反复踩过的半接线(守门 118 收紧的那一型)。
  assert.match(src, /catBatch\(root, specs/, 'catBatch 不再按面枚举的清单批量读 = 半接线')
})

test('T3b 判定面四态:默认 HEAD / --staged 索引 / 两面旗同给判死 / --worktree 人工', () => {
  assert.equal(G.pickFace([]).face, 'head')
  assert.equal(G.pickFace(['--staged']).face, 'staged')
  assert.equal(G.pickFace(['--worktree']).face, 'worktree')
  assert.match(
    String(G.pickFace(['--staged', '--worktree']).error),
    /不得同用/,
    '两面旗同给必须判死,不得静默选一个面',
  )
})

// --- T4 J12:唯一名单(内置名不得被再抄一遍) -------------------------------

test('T4 J12 命中被禁形态,而"解释自己的散文"不命中', () => {
  const { fixEngine } = G.fixtures
  const names = ['unified_exec', 'view_image', 'update_plan']
  const stripped = G.stripPyDocstrings(fixEngine(names, true))
  assert.match(
    stripped,
    /"unified_exec"\s*:\s*self\./,
    'J12 看不见 builders 形态 = 门对自己立项那一型全盲',
  )
  // 阳性对照:真仓当前面不得有该形态(判据在真内容上必须是绿的)
  const real = G.stripPyDocstrings(readWorktree(G.paths.PY_ENGINE))
  const builtins = [...G.engineBuiltins({ [G.paths.PY_ENGINE]: readWorktree(G.paths.PY_ENGINE) })]
  assert.ok(builtins.length >= 10, `内置名单读到 ${builtins.length} 条,判据已失明`)
  for (const n of builtins) {
    assert.ok(
      !new RegExp(`"${n}"\\s*:\\s*self\\.`).test(real),
      `真仓 HEAD/工作树面出现第二份清单: ${n}`,
    )
  }
  // docstring 里写出被禁形态不算违规(同一条判据的两个方向)
  const prose =
    fixEngine(names) +
    'def _doc():\n    """改前这里是 {"unified_exec": self._x} —— 已消除。"""\n    return None\n'
  assert.doesNotMatch(
    G.stripPyDocstrings(prose),
    /"unified_exec"\s*:\s*self\./,
    '散文里的被禁形态被判红 = 一道谁碰说明文字谁被拦的门',
  )
})

test('T4b J12 的模块级第二份清单判据:≥3 个内置名才判,1-2 个放过', () => {
  const texts = {
    [G.paths.PY_ENGINE]:
      'BUILTIN_ENGINE_TOOLS: tuple[str, ...] = (\n' +
      '    "unified_exec",\n    "view_image",\n    "update_plan",\n)\n' +
      '# 注释里再抄一遍不算:("unified_exec", "view_image", "update_plan")\n',
  }
  const builtins = G.engineBuiltins(texts)
  assert.deepEqual([...builtins].sort(), ['unified_exec', 'update_plan', 'view_image'])
  // 注释那一行若被读成成员,本调用会返回一条 stray —— 判"注释不算"的有牙证明
  assert.deepEqual(G.strayBuiltinLists(texts, builtins), [])
  const withStray = {
    [G.paths.PY_ENGINE]:
      texts[G.paths.PY_ENGINE] +
      '_ENGINE_UI_LABELS = {\n    "unified_exec": 1,\n    "view_image": 2,\n    "update_plan": 3,\n}\n',
  }
  const found = G.strayBuiltinLists(withStray, builtins)
  assert.equal(found.length, 1, '第二份模块级清单没有被认出来')
  assert.equal(found[0].name, '_ENGINE_UI_LABELS')
  assert.equal(found[0].hit.length, 3)
})

// --- T5 J13:解析出口必须真装车 --------------------------------------------

test('T5 J13 三型:未 import / 只 import 不调用 / 桥不现读注册表,各自必红', () => {
  const { fixPy, fixHandlers, fixTs, fixEngine, fixBridge, CLEAN_BRIDGE } = G.fixtures
  const clean = {
    [G.paths.PY_LLM]: fixPy(
      '    "read_file",\n    "apply_patch",',
      '    "apply_patch",',
      '    "apply_patch": "用 file_edit",',
    ),
    [G.paths.PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
    [G.paths.TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
    [G.paths.PY_ENGINE]: fixEngine(['unified_exec', 'view_image', 'update_plan']),
    [G.paths.PY_BRIDGE]: fixBridge(CLEAN_BRIDGE),
  }
  const failsOf = (over) => G.check(G.collect({ ...clean, ...over }), [{ path: 'x', count: 1 }])
  const j13 = (list) => list.filter((f) => f.startsWith('J13'))

  assert.equal(j13(failsOf({})).length, 0, '干净夹具不应有 J13 红')
  assert.equal(
    j13(failsOf({ [G.paths.PY_MCP]: fixHandlers(['read_file'], undefined, '') })).length,
    1,
    'call_tool 完全不接解析出口 → 必须红',
  )
  assert.equal(
    j13(
      failsOf({
        [G.paths.PY_MCP]: fixHandlers(
          ['read_file'],
          undefined,
          'from .engine_tool_bridge import resolve_engine_tool\n',
        ),
      }),
    ).length,
    1,
    '只 import 不调用 → 必须红(import 语句不构成接线)',
  )
  assert.equal(
    j13(
      failsOf({
        [G.paths.PY_BRIDGE]: fixBridge(CLEAN_BRIDGE).replace(
          'name in _TOOL_HANDLERS',
          'name in {"run_command"}',
        ),
      }),
    ).length,
    1,
    '桥里把注册表清单抄成字面量 → 必须红(第二份真相)',
  )
})

test('T5b 真仓面上 J13 必须是绿的(判据不是一台恒红门)', () => {
  const texts = Object.fromEntries(G.inputRels().map((r) => [r, readWorktree(r)]))
  const failures = G.check(G.collect(texts), []).filter((f) => /^J1[234]/.test(f))
  assert.deepEqual(failures, [], `真仓面(工作树)上 J12/J13/J14 判红:\n${failures.join('\n')}`)
})

// --- T6 J14:处置结论的纪律 ------------------------------------------------

test('T6 J14 封闭集现读自桥模块,且与"有没有等价物"双向咬合', () => {
  const src = readWorktree(G.paths.PY_BRIDGE)
  const modes = [...G.bridgeModeSet({ [G.paths.PY_BRIDGE]: src })].sort()
  assert.deepEqual(modes, ['local', 'map', 'port'], '处置结论封闭集与票面三种处置不对齐')
  // 真表逐条:mode 与等价物必须互证
  const entries = G.bridgeEntries({ [G.paths.PY_BRIDGE]: src })
  const builtins = G.engineBuiltins({ [G.paths.PY_ENGINE]: readWorktree(G.paths.PY_ENGINE) })
  assert.equal(entries.size, builtins.size, '桥表条数与内置名单条数不等(J8 已失明)')
  for (const [name, entry] of entries) {
    assert.ok(!entry.malformed, `${name} 的值不是三元组字面量`)
    assert.ok(modes.includes(entry.mode), `${name} 的处置结论 ${entry.mode} 不在封闭集`)
    assert.equal(
      entry.mode === 'local',
      entry.equivalent === null,
      `${name}: 处置为 ${entry.mode} 却与等价物字段互相推翻`,
    )
    if (entry.mode === 'local') assert.ok(entry.hasReason, `${name}: local 却没交代理由`)
  }
})

test('T6b 桥表解析器必须吃下真表里那些"带 ASCII 括号 + 多段隐式拼接"的理由', () => {
  // 旧实现是一条到闭括号为止的正则,而真表 request_permissions 的理由里写着
  // "scope(sandbox_full_access / network / elevated_exec)" —— 正则会在那里断掉,
  // 断掉的形态是**少读几条**,在门上表现为 0 处违规。这条把"读全"钉成判据。
  const src = readWorktree(G.paths.PY_BRIDGE)
  const entries = G.bridgeEntries({ [G.paths.PY_BRIDGE]: src })
  for (const needle of [
    'request_permissions',
    'clock_curr_time',
    'send_message_to_user_async',
    'new_context',
  ]) {
    assert.ok(entries.has(needle), `解析器漏读 '${needle}' —— 表读空了而账面看不出来`)
  }
  assert.equal(entries.get('clock_curr_time').mode, 'local')
  assert.equal(entries.get('request_permissions').equivalent, null)
  assert.ok(entries.get('request_permissions').hasReason)
})

// --- T7 回归锁:J8/J9/J10 的既有判据不得被本次改动削弱 ---------------------

test('T7 J8-J10 的旧判据在夹具变异上仍各自有牙(改判据不得只加不减)', () => {
  const { fixPy, fixHandlers, fixTs, fixEngine, fixBridge, CLEAN_BRIDGE } = G.fixtures
  const names = ['unified_exec', 'view_image', 'update_plan']
  const clean = {
    [G.paths.PY_LLM]: fixPy(
      '    "read_file",\n    "apply_patch",',
      '    "apply_patch",',
      '    "apply_patch": "用 file_edit",',
    ),
    [G.paths.PY_MCP]: fixHandlers(['read_file', 'write_file', 'run_command']),
    [G.paths.TS_EXEC]: fixTs(['read_file', 'write_file', 'apply_patch']),
    [G.paths.PY_ENGINE]: fixEngine(names),
    [G.paths.PY_BRIDGE]: fixBridge(CLEAN_BRIDGE),
  }
  const failsOf = (over) => G.check(G.collect({ ...clean, ...over }), [{ path: 'x', count: 1 }])
  assert.ok(
    failsOf({ [G.paths.PY_ENGINE]: fixEngine([...names, 'orphan_no_bridge']) }).some((f) =>
      f.startsWith('J8'),
    ),
    '新增内置名而不登记桥条目必须红 —— 这正是 #47 的立项型',
  )
  assert.ok(
    failsOf({ [G.paths.PY_BRIDGE]: fixBridge(CLEAN_BRIDGE + '    "retired": ("read_file", None, "map"),\n') }).some(
      (f) => f.startsWith('J8'),
    ),
    '桥表留旧条目(清单腐烂)必须红',
  )
  assert.ok(
    failsOf({
      [G.paths.PY_BRIDGE]: fixBridge(
        '    "unified_exec": ("no_such_tool", None, "map"),\n' +
          '    "view_image": ("read_file", None, "map"),\n' +
          '    "update_plan": (None, "协议对位件", "local"),\n',
      ),
    }).some((f) => f.startsWith('J9')),
    '等价物不在注册表必须红',
  )
  assert.ok(
    failsOf({
      [G.paths.PY_BRIDGE]: fixBridge(
        '    "unified_exec": ("run_command", None, "map"),\n' +
          '    "view_image": ("read_file", None, "map"),\n' +
          '    "update_plan": (None, None, "local"),\n',
      ),
    }).some((f) => f.startsWith('J10')),
    'local 却不带理由必须红',
  )
})

// --- T8 本门编号/夹具形态不得漂到判据之外 ----------------------------------

test('T8 夹具与真仓同形(否则自检测的是已不存在的旧形态)', () => {
  const { fixBridge, CLEAN_BRIDGE } = G.fixtures
  const fixtureSrc = fixBridge(CLEAN_BRIDGE)
  const real = readWorktree(G.paths.PY_BRIDGE)
  const fixtureModes = [...G.bridgeEntries({ [G.paths.PY_BRIDGE]: fixtureSrc }).values()].map((e) => e.mode)
  const realModes = [...G.bridgeEntries({ [G.paths.PY_BRIDGE]: real }).values()].map((e) => e.mode)
  assert.ok(
    fixtureModes.every((m) => m !== null) && realModes.every((m) => m !== null),
    '夹具或真仓有一侧还在二项形态',
  )
  assert.match(
    real,
    /BRIDGE_MODES:\s*(?:Final\[)?tuple\[str, str, str\]\]?\s*=\s*\("port", "map", "local"\)/,
    '真仓的封闭集形态变了 → 夹具必须跟着改,否则自检在假绿',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
