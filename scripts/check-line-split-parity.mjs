#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-line-split-parity.mjs —— 「行统计」跨语言口径对账(G-415 A9 的常驻尺子)
 *
 * 立因(不是假想,是现读量到的):
 *   `apps/web/src/components/ai/progress-sections/tool-call-summary-card.tsx` 里抄了一份
 *   Python `str.splitlines()` 口径,注释自称「复刻后端 ai-service/app/routers/llm.py
 *   calculate_added_lines 的口径」,而**没有任何东西校验这句话**。把同一份语料分别喂给两侧
 *   (Python 侧真求值)量到:`\x1c` `\x1d` `\x1e` 三枚行边界码位在 JS 侧漏抄 ⇒ `a\x1cb`
 *   Python 得 2 行、JS 得 1 行。症状路径:后端没发 tool-summary、前端本地降级聚合 ——
 *   用户看到的「改了多少行」比后端算的少,而 typecheck / lint / 其余门全都不响。
 *
 * 判据(两侧都**执行**,不比文本 —— 比文本只能证明字面量相似,证不了行为相同):
 *   P1 行切分:逐例对同一串,`pySplitLines(text).length` 必须等于 `len(text.splitlines())`。
 *   P2 改动行计数:逐例对同一份 tool_call args,TS 的 `calculateAddedLines` /
 *      `calculateDeletedLines` 必须等于 llm.py 里**那两个函数本体**的结果 —— 函数体用 ast
 *   从被审面的 llm.py 现取再 exec,所以测的是仓库里真写着的那段代码,不是本文件的转述。
 *   三态绝不并桶:**同值 / 漂移 / 未判定**。Python 取不到、TS 实现取不到、对照函数抽不出来、
 *   子进程没产出结论 —— 一律落「未判定」并点名原因,exit 2,拒绝出具"口径一致"的合格证
 *   (把"没判"写成"判过了"是本仓最高频的失效型)。一例都没判到 ⇒ 判死,不记绿。
 *
 * 定级与落点(不要写一个跑不通的出路):
 *   本门**刻意没有接进提交链**:它需要一个 Python 解释器,而解释器在不在是**机器状态**,
 *   提交者结构上满足不了 —— 挂 blocking 就是每台每次被逼 `--no-verify`,一次绕过等于该枚
 *   提交上全部守门作废(AGENTS §12e 同型)。接线归 `guardian-runner.mjs` 的持有人裁决。
 *   问责入口(手动 / CI):`node scripts/check-line-split-parity.mjs --strict`
 *   默认档与 `--strict` 退出码同语义(它不在提交链上,所以不需要"存量只报数"那一档)。
 *   取证:`--self-test`(构造面成对正反例 + 一条"少一种换行码位必须翻红"的变异对照 +
 *   真仓 worktree 面端到端)与 §22c 镜像
 *   `node --test scripts/tests/check-line-split-parity.test.mjs`。
 *   **没有紧急跳过变量** —— 它不在钩子链上,不存在"被跳过"这件事。
 *
 * 取材面:同 70/77/83/98/101/103/118 —— 缺省判 **HEAD blob**、`--staged` 判**索引 blob**、
 *   `--worktree` 仅人工取证、两面旗同给 exit 2、取不到不回落另一个面。两份内容**同面同轮**
 *   (一次 catBatch 读满),否则并行会话推进的那一瞬间会产出自洽却错位的尺子。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 被审的两份文件:一侧是 TS 实现,一侧是被复刻的 Python 函数本体。 */
const TS_REL = 'apps/web/src/lib/py-line-count.ts'
const PY_REL = 'apps/ai-service/app/routers/llm.py'

/** TS 侧必须导出的名字。少一个 ⇒ 那一维没有可比对象,判"未判定"而不是通过。 */
const REQUIRED_TS_EXPORTS = Object.freeze([
  'pySplitLines',
  'pyLineCount',
  'calculateAddedLines',
  'calculateDeletedLines',
])

/** Python 侧必须抽得出来的函数;抽不出来 ⇒ 未判定。 */
const REQUIRED_PY_FUNCS = Object.freeze(['calculate_added_lines', 'calculate_deleted_lines'])

/**
 * 行切分语料。每一例对应 CPython 的一个真实边界或一处边界**组合** —— 语料漏一族,
 * 门就在那一族上永久失明(所以头注下面有一条自检专门数覆盖)。
 */
function splitCorpus() {
  return [
    ['LF', 'a\nb'],
    ['CRLF', 'a\r\nb'],
    ['CR', 'a\rb'],
    ['VT U+000B', 'a\x0bb'],
    ['FF U+000C', 'a\x0cb'],
    ['FS U+001C', 'a\x1cb'],
    ['GS U+001D', 'a\x1db'],
    ['RS U+001E', 'a\x1eb'],
    ['NEL U+0085', 'a\x85b'],
    ['LSP U+2028', 'a\u2028b'],
    ['PSP U+2029', 'a\u2029b'],
    ['末尾有换行', 'a\n'],
    ['末尾无换行', 'a'],
    ['空串', ''],
    ['只有一个换行', '\n'],
    ['单独 FS', '\x1c'],
    ['FS 收尾', 'a\x1c'],
    ['两枚 FS', 'a\x1cb\x1cc'],
    ['CRLF 与 LF 混排', 'a\r\nb\nc'],
    ['LF 紧跟 CR(非 CRLF 组合)', 'a\n\rb'],
    ['空行保留', 'a\n\nb'],
    ['多字节 + 边界', '行1\n行2\x1c行3\r\n行4'],
  ]
}

/**
 * args 语料。`value` 是喂给两侧的 args;`missing:true` 表示压根没有 args。
 * 分支**次序**也是口径的一部分(llm.py 是 diff → content → new_string),
 * 所以特意放了"同时带多个键"的例子 —— 没有它,有人调换次序也不会被量出来。
 */
function argsCorpus() {
  return [
    { name: 'diff 常规', value: { diff: '@@ -1 +1 @@\n-old\n+new\n+new2\n' } },
    { name: 'diff 含 +++/--- 头(不得计入)', value: { diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n+keep\n-kill\n' } },
    { name: 'diff 里有裸 + 与裸 -', value: { diff: '+\n-\n++\n--\n' } },
    { name: 'content 整文件写入', value: { content: 'a\nb\nc\n' } },
    { name: 'content 含 FS(漂移就活在这一类)', value: { content: 'a\x1cb\x1dc' } },
    { name: 'new_string 含 CRLF', value: { new_string: 'a\r\nb' } },
    { name: 'old_string 含 NEL', value: { old_string: 'a\x85b' } },
    { name: '次序:diff 优先于 content', value: { diff: '+x\n', content: 'a\nb\nc\n' } },
    { name: '次序:content 优先于 new_string', value: { content: 'a\nb', new_string: 'x\ny\nz\nw' } },
    { name: '空 dict', value: {} },
    { name: '无 args', missing: true },
    { name: 'args 非 dict(数字)', value: 42 },
    { name: 'args 是字符串', value: 'a\nb' },
    { name: 'diff 非字符串', value: { diff: 7 } },
    { name: 'diff 空串 ⇒ 走下一分支', value: { diff: '', content: 'a\nb' } },
    { name: 'old_string 与 content 并存(deleted 只认 old_string)', value: { content: 'a\nb\nc', old_string: 'x\ny' } },
  ]
}

/**
 * 交给 Python 的那把尺子。**只跑被审面上的那份 llm.py 文本**,不 import 整个 app ——
 * import 会拉起 FastAPI / DB 依赖,既慢,又会因无关依赖缺失把结论折成"未判定"。
 */
function pythonProgram() {
  return [
    'import ast, base64, json, sys, io, typing',
    '',
    'payload = json.load(io.open(sys.argv[1], encoding="utf-8"))',
    '',
    'def b64s(x):',
    '    return base64.b64decode(x).decode("utf-16-le")',
    '',
    'out = {"ok": True, "splits": [], "added": [], "deleted": [], "errors": []}',
    'llm_src = b64s(payload["llm_b64"])',
    '',
    '# 抽出两个函数本体,单独 exec(不 import app,免得拖进 FastAPI/DB 依赖)',
    '# 注:Python 3.12 里函数签名的 `dict[str, Any]` 是**定义期求值**的,所以 exec 的命名空间',
    '# 必须先备齐 typing 名字 —— 少这一步会得到 NameError,而 NameError 会被下面折成',
    '# "抽不出函数",读起来像 llm.py 变了写法,实际是本程序自己缺前置(假阴性)。',
    'wanted = dict((n, None) for n in __REQ_FUNCS__)',
    'try:',
    '    tree = ast.parse(llm_src)',
    '    for node in tree.body:',
    '        if isinstance(node, ast.FunctionDef) and node.name in wanted:',
    '            seg = ast.get_source_segment(llm_src, node)',
    '            if seg:',
    '                wanted[node.name] = seg',
    'except SyntaxError as e:',
    '    out["errors"].append("llm.py 解析失败: " + repr(e))',
    '',
    'ns = dict(vars(typing))',
    'for fname, seg in wanted.items():',
    '    if seg is None:',
    '        out["errors"].append("llm.py 里抽不出函数 " + fname)',
    '        continue',
    '    try:',
    '        exec(compile(seg, "<extracted " + fname + ">", "exec"), ns)',
    '    except Exception as e:',
    '        out["errors"].append("函数 " + fname + " exec 失败: " + repr(e))',
    '',
    'have_added = "calculate_added_lines" in ns',
    'have_deleted = "calculate_deleted_lines" in ns',
    'out["extracted"] = {"calculate_added_lines": have_added,',
    '                    "calculate_deleted_lines": have_deleted}',
    '',
    '# P1 行切分:直接跑内建 str.splitlines()',
    'for item in payload["splits"]:',
    '    s = b64s(item["b64"])',
    '    out["splits"].append({"name": item["name"], "py": len(s.splitlines())})',
    '',
    '# P2 改动行:llm.py 的签名收的是 tool_call(不是 args),所以在这里包一层',
    'for item in payload["args"]:',
    '    value = None if item.get("missing") else json.loads(base64.b64decode(item["v64"]).decode("utf-8"))',
    '    tc = {"args": value}',
    '    row = {"name": item["name"]}',
    '    row["added"] = ns["calculate_added_lines"](tc) if have_added else None',
    '    row["deleted"] = ns["calculate_deleted_lines"](tc) if have_deleted else None',
    '    out["added"].append(row)',
    '    out["deleted"].append(row)',
    '',
    '# 出参必须是纯 ASCII:Windows 下子进程 stdout 走控制台码页(本机 GBK),',
    '# 语料名带中文时 ensure_ascii=False 会当场 UnicodeEncodeError ⇒ 整门折成"未判定",',
    '# 而原因读起来像 Python 侧坏了(AGENTS §26 那条"中文出参会被码页吃掉"在此复现)。',
    '# JSON 的 \\uXXXX 转义由 JSON.parse 原样还原,不影响判据输入。',
    'sys.stdout.write(json.dumps(out))',
    '',
  ]
    .join('\n')
    .replace('__REQ_FUNCS__', JSON.stringify(Array.from(REQUIRED_PY_FUNCS)))
}

/** 候选解释器序:显式 env 覆盖 → 仓内 venv 两种平台形态。**不猜 PATH 上的 `python`**。 */
function pythonCandidates(root, env, exists) {
  const out = []
  if (env && env.IHUI_LINE_PARITY_PYTHON) out.push(env.IHUI_LINE_PARITY_PYTHON)
  out.push(path.join(root, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'))
  out.push(path.join(root, 'apps', 'ai-service', '.venv', 'bin', 'python'))
  return out.filter((p) => exists(p))
}

const encUtf16 = (s) => Buffer.from(s, 'utf16le').toString('base64')

/**
 * 跑 Python 侧。返回 `{json}` 或 `{undetermined:原因}` —— 绝不把"没跑到"折成"结论是绿的"。
 * 失败形状各有文案:派生失败 / 非零退出 / 输出不可解析,三种不许混成一句。
 */
function runPythonSide(pythonPath, llmText, scratch) {
  const payload = {
    llm_b64: encUtf16(llmText),
    splits: splitCorpus().map(([name, text]) => ({ name, b64: encUtf16(text) })),
    args: argsCorpus().map((c) => ({
      name: c.name,
      missing: !!c.missing,
      v64: c.missing
        ? ''
        : Buffer.from(JSON.stringify(c.value === undefined ? null : c.value), 'utf8').toString('base64'),
    })),
  }
  const payloadFile = path.join(scratch, 'payload.json')
  const progFile = path.join(scratch, 'py_side.py')
  writeFileSync(payloadFile, JSON.stringify(payload), 'utf8')
  writeFileSync(progFile, pythonProgram(), 'utf8')
  let res
  try {
    res = spawnSync(pythonPath, [progFile, payloadFile], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 8 << 20,
    })
  } catch (e) {
    return { undetermined: `派生 Python 抛错:${(e && e.message) || e}` }
  }
  if (res.error) {
    const code = res.error.code || ''
    return {
      undetermined: `派生 Python 失败(${code || res.error.message}):解释器 ${pythonPath} 跑不起来`,
    }
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || res.stdout || '')
      .trim()
      .split(/\r?\n/)
      .slice(-3)
      .join(' | ')
    return { undetermined: `Python 侧非零退出(rc=${res.status}):${tail || '(无输出)'}` }
  }
  if (!res.stdout || !res.stdout.trim()) {
    return { undetermined: 'Python 侧零输出 ⇒ 没跑到,不是跑过且一致' }
  }
  try {
    return { json: JSON.parse(res.stdout) }
  } catch (e) {
    return {
      undetermined: `Python 侧输出不是可解析 JSON(${e.message});前 160 字:${String(res.stdout).slice(0, 160)}`,
    }
  }
}

/**
 * 两侧结论并排对账。**纯函数** ⇒ 可用构造面证明,不依赖仓库瞬时状态。
 * @returns {{drifts:Array,undetermined:string[],checkedSplits:number,checkedArgs:number}}
 */
function evaluate({ tsModule, py, tsLoadError, pyFuncFlags }) {
  const drifts = []
  const undetermined = []
  let checkedSplits = 0
  let checkedArgs = 0

  if (tsLoadError) undetermined.push(`TS 侧实现装载失败:${tsLoadError}`)
  if (py && Array.isArray(py.errors) && py.errors.length) {
    for (const e of py.errors) undetermined.push(`Python 侧:${e}`)
  }
  if (!py) undetermined.push('Python 侧没有产出结论 ⇒ 无对照')

  const missingExports = REQUIRED_TS_EXPORTS.filter(
    (n) => !tsModule || typeof tsModule[n] !== 'function',
  )
  if (missingExports.length) {
    undetermined.push(`TS 侧缺导出:${missingExports.join(', ')} ⇒ 相应维度没有可比对象`)
  }

  // —— P1 行切分 ——
  if (tsModule && typeof tsModule.pySplitLines === 'function' && py && Array.isArray(py.splits)) {
    const byName = new Map(py.splits.map((r) => [r.name, r.py]))
    for (const [name, text] of splitCorpus()) {
      const pyV = byName.get(name)
      if (pyV === undefined) {
        undetermined.push(`语例「${name}」Python 侧没给出数`)
        continue
      }
      const tsV = tsModule.pySplitLines(text).length
      checkedSplits++
      if (tsV !== pyV) drifts.push({ dim: 'P1 行切分', name, ts: tsV, py: pyV })
    }
  }

  // —— P2 改动行计数 ——
  const mapOf = (rows) => (Array.isArray(rows) ? new Map(rows.map((r) => [r.name, r])) : null)
  const addedRows = py ? mapOf(py.added) : null
  const deletedRows = py ? mapOf(py.deleted) : null

  if (tsModule && typeof tsModule.calculateAddedLines === 'function' && addedRows) {
    for (const c of argsCorpus()) {
      const row = addedRows.get(c.name)
      if (!row || row.added === null || row.added === undefined) {
        undetermined.push(`语例「${c.name}」的 added 侧 Python 没算出来`)
        continue
      }
      const tsV = tsModule.calculateAddedLines(c.missing ? undefined : c.value)
      checkedArgs++
      if (tsV !== row.added) drifts.push({ dim: 'P2 added', name: c.name, ts: tsV, py: row.added })
    }
  }
  if (tsModule && typeof tsModule.calculateDeletedLines === 'function' && deletedRows) {
    for (const c of argsCorpus()) {
      const row = deletedRows.get(c.name)
      if (!row || row.deleted === null || row.deleted === undefined) {
        undetermined.push(`语例「${c.name}」的 deleted 侧 Python 没算出来`)
        continue
      }
      const tsV = tsModule.calculateDeletedLines(c.missing ? undefined : c.value)
      checkedArgs++
      if (tsV !== row.deleted) drifts.push({ dim: 'P2 deleted', name: c.name, ts: tsV, py: row.deleted })
    }
  }

  if (pyFuncFlags) {
    for (const fn of REQUIRED_PY_FUNCS) {
      if (pyFuncFlags[fn] === false) undetermined.push(`llm.py 里抽不出 ${fn} ⇒ 该维无对照本体`)
    }
  }

  return { drifts, undetermined, checkedSplits, checkedArgs }
}

/**
 * 退出码:未判定优先于漂移(2,拒绝出合格证);一例都没判到也判死(2);
 * 判到而漂 ⇒ 1;判到且逐例同值 ⇒ 0。
 */
function decide({ drifts, undetermined, checkedSplits, checkedArgs }) {
  if (undetermined.length) return { rc: 2, verdict: 'undetermined' }
  if (checkedSplits === 0 && checkedArgs === 0) return { rc: 2, verdict: 'empty-enumeration' }
  if (drifts.length) return { rc: 1, verdict: 'drift' }
  return { rc: 0, verdict: 'ok' }
}

/** 同面同轮读两份内容;返回 rel → text|null。 */
function readBothContents(face, root) {
  if (face === 'worktree') {
    // 磁盘面**不套 try**:一个编码/权限错误不得伪装成"该文件不存在"(§13/门 97 那一型)
    return new Map([
      [TS_REL, readWorktreeFile(root, TS_REL)],
      [PY_REL, readWorktreeFile(root, PY_REL)],
    ])
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = [prefix + TS_REL, prefix + PY_REL]
  const got = catBatch(root, specs, { maxBuffer: 1 << 26 })
  return new Map(specs.map((s) => [s.slice(prefix.length), got.get(s) ?? null]))
}

/** 把**被审面**那份 TS 实现落进临时目录再 import(直接 import 磁盘文件 = 审的是 HEAD、说的是假话)。 */
function loadTsModuleFromFace(tsText, scratch) {
  const dir = path.join(scratch, 'tsface')
  mkdirSync(dir, { recursive: true })
  // 同目录放一个 type:module,免掉 Node 的 MODULE_TYPELESS_PACKAGE_JSON 警告(噪音会淹掉结论)
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8')
  const modFile = path.join(dir, 'py-line-count.ts')
  writeFileSync(modFile, tsText, 'utf8')
  return import(pathToFileURL(modFile).href)
}

function usage() {
  console.log(
    '用法:node scripts/check-line-split-parity.mjs [--staged|--worktree] [--strict] [--json] [--self-test]\n' +
      '  缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工取证;两面旗同给 exit 2。\n' +
      '  它不在提交链上(判据需要本机 Python 解释器 ⇒ 挂 blocking 就是恒红门,AGENTS §12e),\n' +
      '  所以默认档与 --strict 同语义,也**没有**紧急跳过变量。\n' +
      '  取证:--self-test。',
  )
}

async function runOnce({ face, json }) {
  const contents = readBothContents(face, ROOT)
  const tsText = contents.get(TS_REL)
  const pyText = contents.get(PY_REL)

  const preUndetermined = []
  if (typeof tsText !== 'string') preUndetermined.push(`${TS_REL} 在 ${face} 面取不到 ⇒ 没有可比实现`)
  if (typeof pyText !== 'string') preUndetermined.push(`${PY_REL} 在 ${face} 面取不到 ⇒ 没有对照本体`)
  if (preUndetermined.length) {
    const r = { drifts: [], undetermined: preUndetermined, checkedSplits: 0, checkedArgs: 0 }
    return { face, result: r, decision: decide(r) }
  }

  const cands = pythonCandidates(ROOT, process.env, (p) => {
    try {
      return existsSync(p)
    } catch {
      return false
    }
  })
  if (!cands.length) {
    const r = {
      drifts: [],
      undetermined: [
        '取不到 Python 解释器(env 覆盖 + 仓内 venv 两种形态都不存在)⇒ 无法跑对照;这**不是**"口径一致"',
      ],
      checkedSplits: 0,
      checkedArgs: 0,
    }
    return { face, result: r, decision: decide(r) }
  }

  const scratch = mkScratch('linesplitparity')
  try {
    let mod = null
    let tsLoadError = null
    try {
      mod = await loadTsModuleFromFace(tsText, scratch)
    } catch (e) {
      tsLoadError = (e && e.message) || String(e)
    }
    const pyRun = runPythonSide(cands[0], pyText, scratch)
    const result = pyRun.undetermined
      ? {
          drifts: [],
          undetermined: [pyRun.undetermined],
          checkedSplits: 0,
          checkedArgs: 0,
        }
      : evaluate({
          tsModule: mod,
          py: pyRun.json,
          tsLoadError,
          pyFuncFlags: pyRun.json && pyRun.json.extracted,
        })
    return { face, result, decision: decide(result), python: cands[0] }
  } finally {
    rmScratch(scratch)
  }
}

function report({ face, result, decision, python }) {
  const line = `判定面 = ${face}`
  const summary = `P1 行切分 ${result.checkedSplits} 例 / P2 改动行 ${result.checkedArgs} 例 | 漂移 ${result.drifts.length} / 未判定 ${result.undetermined.length}`
  return [line, `  ${summary}`, ...result.drifts.map((x) => `  ❌ [${x.dim}]「${x.name}」JS=${x.ts} vs Python=${x.py}`), ...result.undetermined.map((u) => `  ⚠️ 未判定:${u}`)]
    .concat(
      decision.verdict === 'ok'
        ? ['  ✅ 两侧逐例同值 —— "复刻 llm.py 口径"这句现在是量出来的,不是散文写的']
        : [],
    )
    .concat(decision.verdict === 'empty-enumeration' ? ['  ❌ 一例都没判到 ⇒ 判死,不记通过'] : [])
    .concat(python ? [`  对照解释器 = ${python}`] : [])
    .join('\n')
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(await selfTest())

  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  const out = await runOnce({ face: sel.face })
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: out.face, verdict: out.decision.verdict, rc: out.decision.rc, ...out.result }, null, 2))
  } else {
    console.log(report(out))
  }
  process.exit(out.decision.rc)
}

async function selfTest() {
  const cases = []
  // cond 一律传**已求值的布尔**:本仓的 t(name, cond) 普遍用 !!cond,而函数对象恒 truthy
  // —— 传函数等于这条断言从写下起从未求值,账面却记成 ✅(AGENTS 门 156 那一型)。
  const t = (name, cond) => cases.push({ name, ok: cond === true, got: cond })

  const correctSplit = (s) => {
    const parts = s.split(/\r\n|\r|\n|\u000B|\u000C|\u001C|\u001D|\u001E|\u0085|\u2028|\u2029/)
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
    return parts
  }
  // A9 的那个 bug:少抄 \x1c \x1d \x1e 三枚码位
  const mutatedSplit = (s) => {
    const parts = s.split(/\r\n|\r|\n|\u000B|\u000C|\u0085|\u2028|\u2029/)
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop()
    return parts
  }
  const fakeArgsRows = (which, val) => argsCorpus().map((c) => ({ name: c.name, [which]: val }))
  const fakePy = (splitImpl, extra) => ({
    errors: [],
    extracted: { calculate_added_lines: true, calculate_deleted_lines: true },
    splits: splitCorpus().map(([name, text]) => ({ name, py: splitImpl(text).length })),
    added: fakeArgsRows('added', 0),
    deleted: fakeArgsRows('deleted', 0),
    ...(extra || {}),
  })
  const modOf = (splitImpl, add = 0, del = 0) => ({
    pySplitLines: splitImpl,
    pyLineCount: (s) => splitImpl(s).length,
    calculateAddedLines: () => add,
    calculateDeletedLines: () => del,
  })

  // T1 两侧同值 ⇒ 绿(而且必须真的判到了例)
  {
    const r = evaluate({ tsModule: modOf(correctSplit), py: fakePy(correctSplit), tsLoadError: null, pyFuncFlags: fakePy(correctSplit).extracted })
    const d = decide(r)
    t('T1 两侧逐例同值 ⇒ rc 0,且判到的例数不为 0', d.rc === 0 && d.verdict === 'ok' && r.checkedSplits > 0 && r.checkedArgs > 0)
  }

  // T2 【本门的牙】变异:JS 少抄三枚换行码位 ⇒ 必须翻红并点名
  {
    const r = evaluate({ tsModule: modOf(mutatedSplit), py: fakePy(correctSplit), tsLoadError: null, pyFuncFlags: { calculate_added_lines: true, calculate_deleted_lines: true } })
    const d = decide(r)
    const namedBoundary = r.drifts.filter((x) => /FS|GS|RS|多字节/.test(x.name)).length
    t('T2 变异:JS 少抄 \\x1c\\x1d\\x1e ⇒ rc 1 且逐例点名(少一种换行形态必须红)', d.rc === 1 && namedBoundary >= 5)
  }

  // T3 TS 取不到 ⇒ 未判定,绝不记绿
  {
    const r = evaluate({ tsModule: null, py: null, tsLoadError: 'no file', pyFuncFlags: null })
    const d = decide(r)
    t('T3 TS 实现取不到 ⇒ rc 2「未判定」(既不是 0 也不是 1)', d.rc === 2 && d.verdict === 'undetermined')
  }

  // T4 Python 没产出结论 ⇒ 未判定
  {
    const r = evaluate({ tsModule: modOf(correctSplit), py: null, tsLoadError: null, pyFuncFlags: null })
    const d = decide(r)
    t('T4 Python 侧没结论 ⇒ rc 2,不冒绿', d.rc === 2 && r.undetermined.length > 0)
  }

  // T5 对照函数抽不出来 ⇒ P2 无对照,不得读成"这两维已过"
  {
    const r = evaluate({
      tsModule: modOf(correctSplit),
      py: fakePy(correctSplit, {
        errors: ['llm.py 里抽不出函数 calculate_added_lines'],
        extracted: { calculate_added_lines: false, calculate_deleted_lines: false },
        added: fakeArgsRows('added', null),
        deleted: fakeArgsRows('deleted', null),
      }),
      tsLoadError: null,
      pyFuncFlags: { calculate_added_lines: false, calculate_deleted_lines: false },
    })
    const d = decide(r)
    t('T5 抽不出对照函数 ⇒ 未判定点名,P2 不得静默放过', d.rc === 2 && r.undetermined.length >= 3)
  }

  // T6 一例都没判到 ⇒ 判死(空扫不得冒充通过)
  {
    const d = decide({ drifts: [], undetermined: [], checkedSplits: 0, checkedArgs: 0 })
    t('T6 一例都没判到 ⇒ rc 2 判死', d.rc === 2 && d.verdict === 'empty-enumeration')
  }

  // T7 TS 模块缺 calculate* 导出 ⇒ 未判定(缺对照对象 ≠ 通过)
  {
    const partial = { pySplitLines: correctSplit, pyLineCount: (s) => correctSplit(s).length }
    const r = evaluate({ tsModule: partial, py: fakePy(correctSplit), tsLoadError: null, pyFuncFlags: { calculate_added_lines: true, calculate_deleted_lines: true } })
    const d = decide(r)
    t('T7 TS 缺 calculate* 导出 ⇒ rc 2 且点名缺哪几个', d.rc === 2 && r.undetermined.some((x) => x.includes('缺导出')))
  }

  // T8 P2 真的在算:added 侧故意不同值 ⇒ 必须红(证明 P1 的绿不代表 P2 也被看过)
  {
    const r = evaluate({
      tsModule: modOf(correctSplit, 9, 0),
      py: fakePy(correctSplit, { added: fakeArgsRows('added', 3) }),
      tsLoadError: null,
      pyFuncFlags: { calculate_added_lines: true, calculate_deleted_lines: true },
    })
    const d = decide(r)
    t('T8 P1 全同值而 P2 added 漂 ⇒ 仍红(P1 的绿不替 P2 顶账)', d.rc === 1 && r.drifts.every((x) => x.dim === 'P2 added'))
  }

  // T9 成对:CRLF 与 LF 在"数行"口径下同值
  {
    const a = correctSplit('a\r\nb').length
    const b = correctSplit('a\nb').length
    t('T9 同内容 CRLF 与 LF ⇒ 同值(各 2 行)', a === b && a === 2)
  }

  // T10 成对:末尾有/无换行同值
  {
    const a = correctSplit('a\n').length
    const b = correctSplit('a').length
    t('T10 末尾有换行与无换行 ⇒ 同值(都不产出"多一行空行")', a === b && a === 1)
  }

  // T11 解释器候选:两种平台形态各认一个;都不在 ⇒ 空清单(不退化成猜 PATH)
  {
    const win = path.join('R', 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe')
    const nix = path.join('R', 'apps', 'ai-service', '.venv', 'bin', 'python')
    const onlyWin = pythonCandidates('R', {}, (p) => p === win)
    const onlyNix = pythonCandidates('R', {}, (p) => p === nix)
    const none = pythonCandidates('R', {}, () => false)
    const overridden = pythonCandidates('R', { IHUI_LINE_PARITY_PYTHON: 'Z:/mine.exe' }, (p) => p === 'Z:/mine.exe')
    t(
      'T11 解释器候选两平台形态各命中;全不在 ⇒ 空清单(不猜 PATH);env 覆盖优先',
      onlyWin.length === 1 && onlyNix.length === 1 && none.length === 0 && overridden[0] === 'Z:/mine.exe',
    )
  }

  // T12 语料覆盖度:CPython 的 11 族边界各有一例,漏一族就等于那族永久无人看守
  {
    const names = splitCorpus().map((x) => x[0]).join('|')
    const needed = ['LF', 'CRLF', 'CR', 'VT', 'FF', 'FS', 'GS', 'RS', 'NEL', 'LSP', 'PSP']
    const missing = needed.filter((k) => !names.includes(k))
    t('T12 语料覆盖 CPython 全部 11 个行边界族(缺族即红)', missing.length === 0 && splitCorpus().length >= 20)
  }

  // T13 args 语料含"同时多键"的次序例 —— 没有它,调换分支次序不会被量出来
  {
    const orderCases = argsCorpus().filter((c) => c.name.includes('次序'))
    t('T13 args 语料含分支次序例(diff 优先 content / content 优先 new_string)', orderCases.length >= 2)
  }

  // T14 真仓端到端(worktree 面):两侧真跑得通且当前零漂移 —— 证明不止构造面自洽
  {
    let ok = false
    let note = ''
    try {
      const out = await runOnce({ face: 'worktree' })
      const r = out.result
      const d = out.decision
      note = `rc=${d.rc} verdict=${d.verdict} P1=${r.checkedSplits} P2=${r.checkedArgs} drift=${r.drifts.length} und=${r.undetermined.length}${r.undetermined.length ? ' :: ' + r.undetermined.join(' / ') : ''}`
      ok = d.rc === 0 && r.checkedSplits === splitCorpus().length && r.checkedArgs === argsCorpus().length * 2
    } catch (e) {
      note = (e && e.message) || String(e)
    }
    t(`T14 真仓 worktree 面端到端:两侧都跑到且零漂移(${note})`, ok === true)
  }

  // T15 取材面形状:两旗同给必须判死,不得回落成某个面
  {
    const sel = selectFace({ staged: true, worktree: true })
    t('T15 --staged 与 --worktree 同给 ⇒ error(不冒红也不记绿)', !!sel.error && sel.face === null)
  }

  let failed = 0
  for (const c of cases) {
    if (!c.ok) failed++
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : `  实得:${JSON.stringify(c.got)}`}`)
  }
  console.log(`--self-test: ${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

export const __test__ = {
  TS_REL,
  PY_REL,
  REQUIRED_TS_EXPORTS,
  REQUIRED_PY_FUNCS,
  splitCorpus,
  argsCorpus,
  pythonProgram,
  pythonCandidates,
  runPythonSide,
  evaluate,
  decide,
  readBothContents,
  report,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
