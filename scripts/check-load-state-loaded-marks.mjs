#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:不安全 `_loaded` 载体的**提交链**守门(G-758 补票,2026-10-03 立)
//
// ── 为什么需要这道门(缺口是票面正文自己警告过的形态) ──────────────────────
// G-758 已把"读失败/未读到被记成已加载"的判定实现落地在
// `apps/ai-service/app/services/_load_lifecycle.py` 的 `find_unsafe_loaded_marks`,
// 形状锁 `apps/ai-service/tests/test_load_lifecycle_marks.py` 19 passed、存量实测 0 命中。
// 但落地当日现读的一条事实决定了它**当时不在提交链上**:
//   `git grep -n "find_unsafe_loaded_marks" HEAD -- scripts` = **0 命中**
//   ⇒ 那个判据只在 pytest 里跑。票面正文自己警告过这个形态:
//   「不在提交链 ⇒ 新模块再写一遍不会红」。
// ⇒ 现状是"尺子已经造好,但只在有人记得跑 pytest 时才举起来"。本门就是那道接线。
//
// ── 分工边界(与姊妹门 186 干净,不互相覆盖) ────────────────────────────────
//   守门 186 `check-load-state-projection-parity.mjs`:管**读出侧投影** ——
//     `get_status()` 的键集与状态词汇来源,从不 parse 加载函数的控制流。
//   本门 187:管**写入侧载体** —— `finally` / `except` / 尾随 / 集合 add 四形态。
//   一个看出口的键,一个看入口的赋值;两面都不越界。
//
// ── 单份实现纪律(本票最硬的一条) ─────────────────────────────────────────
// **判据本体住在 `_load_lifecycle.py`,门里绝对没有第二份。**
// 本门做的事只有三件:① 取材(走 `lib/face-reader`);② 子进程派生 Python;
// ③ 把 Python 的判定结果**原样传神**并按三态折成退出码。
// 门里**没有**任何"什么算 finally 置真"的正则、没有 AST 判据、没有形态表 ——
// 门里唯一与形态有关的字面量是四个 `kind` 名字符串,而它们连**列目录**都不是:
// 门从不自己产出 kind,只把 Python 回传的 kind 打出来。
// 为什么这条必须硬:两处算同一件事必漂移是本仓记过最多次的失效型(姊妹门头注同款)。
// 而这一维比"抄一份"更隐蔽 —— 抄的那份会随被审面演化,唯一实现不动,于是两边各自自洽。
// 所以本门**没有兜底路径**:判据符号一旦从 face 里消失,门只能报**未判定**(见下),
// 绝不"判据不在了就用正则接着判" —— 那正是本票要禁的形态自身。
//
// ── 三态不并桶 ────────────────────────────────────────────────────────────
// 面取不到 / Python 派生失败 / 被审面 `SyntaxError` / 判据符号缺失
// ⇒ **未判定 exit 2**(既不冒红也绝不记绿)。"看不见"绝不能记成通过 ——
// 一台永远喊未判定的门和一台瞎掉的门在账面上是一样的。
// 三态逐条独立判,不合并计数:一个文件语法错只让**那一格**未判定,其余照判。
//
// ── 覆盖边界(有意的缺口,不得当"全仓合规"读) ─────────────────────────────
// ⚠️ 扫描面是 `apps/ai-service/app/**/*.py`。**`tests/**` 下的注入刻意不在面内**
//   (测试为了构造场景会主动置真,把它们扫进来就是恒红)。所以本门绿**只**意味着
//   `app/**` 侧没有不安全载体,**不得**外推成"全仓 `_loaded` 载体合规"。
// ⚠️ 判据自身刻意不判的四处(有意的语义决策,**必须人裁**,本门不代劳):
//   `hook_engine.py:541-544` 的 `redis is None ⇒ 固化为已加载`(内存模式是权威语义);
//   `cost_ledger.py:448` / `routers/cost_ledger.py:111` 的置真(权威写入,
//   `_load_lifecycle.py:261-264` 已列为"刻意不判")。
// ⚠️ 十族(`agent_step_recorder` / `audit_log` / `agent_longterm_memory` /
//   `browser_trace` / `cloud_run_store` / `cost_ledger` / `hook_engine` /
//   `anti_risk` 四件)要不要补 `get_status` 投影,属 G-759 射程的独立设计决策,
//   与本门无关 —— 本门只管入口赋值,不管出口投影。
//
// ── 定级:**blocking**(与姊妹门 186 的 warn 不同档,理由如下) ──────────────
// 姊妹门 186 走 warn 的理由已写在它自己头注里:输入面 `services/**/*.py` 全域、
// 慢门、恒红风险 ⇒ 接 blocking 就是逼人 `--no-verify`,一次绕过等于全部守门作废。
// 本门可以接 blocking,是因为那条"恒红门"前提**已被实测排除**:
//   ① 存量面(HEAD 的 `app/**` 590 个 .py / 12.6MB)对判据实测 **0 命中**;
//   ② `--strict` 档实测 rc=0(不是靠放宽判据取绿 —— 判据在 `_load_lifecycle.py`,
//      本票一个字都没改它);
//   ③ 判定面取自 blob(HEAD/索引),不读工作树的半编辑态 ⇒ 并发会话不会误伤。
// 换句话说:186 那条"恒红风险"的前提在 187 这里不成立,而 187 一旦有红,是**真新增**
// (有人新写了不安全形态),正是提交链该拦的那一类。
//
// ── 取材面(与本仓其它守门同口径) ─────────────────────────────────────────
// 缺省判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱;
// 取材走 `lib/face-reader`(绝对路径 git / 显式 stdio / 字节分箱),与守门 70/77/83/98
// 同一份实现。**判据本体也从同一个面取**(不 import 工作树的那份)—— 清单、内容、
// 判据三者必须同面同轮:混面取数会产出自洽却错位的尺子。
//
// ── 大载荷通道(为什么落临时文件而不是 argv) ───────────────────────────────
// 真仓扫描面 12.6MB,而 Windows 命令行有 32KB 上限 ⇒ 语料既不能走 argv 也不能靠
// 逐文件派生(那是上千次进程创建)。而给子进程建 stdin 管道在本机会 EBUSY(病窗)。
// 故语料与判据面**各落一个临时文件**,只把**路径**走 argv;文件建在系统 temp
// (`os.tmpdir()`),不在仓内、不进版本控制,派生结束即删。
// ⚠️ 落地时必须写 Buffer/二进制:文本写盘在 Windows 会把 LF 转成 CRLF,
//   判据看到的是被换行改过的源码 —— 那是"取材层悄悄改了被审面"。
//
// ── 退出码纪律(本门是 blocking,默认档就判红 —— 与姊妹门 186 的 warn 不同) ──
// 姊妹门 186 定级 warn,所以它默认档只报数、`--strict` 才判红。本门定级 blocking,
// runner 以 `args:[]` 调用(至多追加 `--staged`),所以**默认档必须直接判红**:
//   exit 0 = 扫描面全部取到、判据跑通、零命中(真绿)
//   exit 1 = 检出违规(默认档即判红,blocking 的前提)
//   exit 2 = 未判定(面取不到 / Python 派生失败 / SyntaxError / 判据符号缺失)
// `--strict` 只动**未判定那一档**:把 exit 2 升成 exit 1(问责档:"看不见"也不放过)。
// 它**不改**违规那一档 —— 默认档已经判红。这样两个旗的差别只有一个语义,
// 不会出现"默认绿、--strict 红"那种记错账的组合。
// ⚠️ 因此"未判定 exit 2"在默认档仍然成立:它与"记绿"在账面上**仍然是两件事**
//   (2 ≠ 0),runner 也会因非零而拦住提交 —— 未判定从不等于通过。

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 本门在 runner 条目里注册的应急跳过名(现值以 scripts/guardian-runner.mjs 为准)。 */
export const SELF_SKIP = 'HUSKY_SKIP_LOAD_STATE_LOADED_MARKS'

/** 判据本体的**唯一**实现文件(单份实现纪律的锚;改名必须与本门同笔,否则判未判定)。 */
export const LIFECYCLE_FILE = 'apps/ai-service/app/services/_load_lifecycle.py'
/** 判据符号名(同上:硬命名,各模块可以别名,门只认这个)。 */
export const CRITERION_SYMBOL = 'find_unsafe_loaded_marks'

/** 扫描面:`app/**` 下全部 .py。刻意**不含** `tests/**`(见头注「覆盖边界」)。 */
export const SCAN_PREFIX = 'apps/ai-service/app'
export const SCAN_EXT = '.py'

/**
 * Python 侧的**驱动器**。它只做三件事:① 从给定路径 import 判据符号;② 逐个调它;
 * ③ 原样回传结果。它**不含任何判定逻辑** —— 这正是"门里没有第二份判据"的机器形态。
 *
 * ⚠️ 判据从**文件路径** import 而不是 `from app.services._load_lifecycle import ...`:
 *   那样 import 的是**工作树**的那份,而判定面是 blob ⇒ 混面。
 * ⚠️ 必须先 `sys.modules[name] = mod` 再 `exec_module`:`_load_lifecycle.py` 里有
 *   `@dataclass`,而 dataclasses 在处理时要求模块已注册进 `sys.modules`,否则抛
 *   `'NoneType' object has no attribute '__dict__'`(实测踩过)。
 */
const PY_DRIVER = `import importlib.util, json, sys

criterion_path, payload_path = sys.argv[1], sys.argv[2]
spec = importlib.util.spec_from_file_location('ihui_ll_criterion', criterion_path)
mod = importlib.util.module_from_spec(spec)
sys.modules['ihui_ll_criterion'] = mod
spec.loader.exec_module(mod)

fn = getattr(mod, '${CRITERION_SYMBOL}', None)
if not callable(fn):
    print(json.dumps({'results': [], 'undetermined': [
        {'path': criterion_path,
         'why': '判据符号 ${CRITERION_SYMBOL} 在面里不存在或不可调用(单份实现被改名/删除 ⇒ 本门不兜底,只报未判定)'}
    ]}, ensure_ascii=False))
    sys.exit(0)

with open(payload_path, encoding='utf-8') as fh:
    payload = json.load(fh)

results, undetermined = [], []
for item in payload:
    try:
        results.append({'path': item['path'], 'marks': fn(item['src'])})
    except SyntaxError as e:
        undetermined.append({'path': item['path'], 'why': 'SyntaxError: ' + str(e).split(chr(10))[0]})
    except Exception as e:
        undetermined.append({'path': item['path'], 'why': type(e).__name__ + ': ' + str(e)[:200]})

print(json.dumps({'results': results, 'undetermined': undetermined}, ensure_ascii=False))
`

/** 构造面夹具:四个形态各一,用来证明尺子**抓得住病**(零命中才不作数)。
 *  它们是**被审面的样本**,不是判据 —— 判据在 `_load_lifecycle.py`,这里一个字都不判。
 *  ⚠️ 刻意只覆盖四形态的**正例**;合法形态的反例由 pytest 那道形状锁负责
 *  (它与本门分工:pytest 证"不误伤",本门证"抓得住")。 */
export const FIX_FINALLY_SET = `class A:
    def _load(self):
        try:
            self._data = read()
        except Exception as e:
            logger.warning("x: %s", e)
        finally:
            self._loaded = True
`

export const FIX_TAIL_SET = `class B:
    def _load(self):
        try:
            self._data = read()
        except Exception as e:
            logger.warning("x: %s", e)
        self._loaded = True
`

export const FIX_EXCEPT_SET = `class C:
    def _load(self):
        try:
            self._data = read()
        except Exception:
            self._loaded = True
`

export const FIX_SET_ADD = `class D:
    def _mark(self, user_id):
        self._loaded_users.add(user_id)
`

/** 构造面:该形态刻意**不**命中(证明判据不是"见 loaded 就红")。 */
export const FIX_SUCCESS_PATH = `class E:
    def _load(self):
        try:
            self._data = read()
            self._loaded, self._failures, self._next_at = _state_after_success()
        except Exception as e:
            self._failures, self._next_at = _state_after_failure(self._failures, now)
            logger.warning("x: %s", e)
`

/** 判据符号缺席时的面(单份实现被删/改名的形态)—— 门必须报**未判定**,不得兜底判。 */
export const CRITERION_ABSENT_SRC = `# 判据本体被搬走了:本门没有第二份,只能未判定。
VALUE = 1
`

// ── Python 派生 ─────────────────────────────────────────────────────────

/** 找 ai-service 的 venv python(先例:守门 `check-egress-facts.mjs` 同一份形状)。 */
export function findPython(root = ROOT) {
  const candidates = [
    path.join(root, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'),
    path.join(root, 'apps', 'ai-service', '.venv', 'bin', 'python'),
  ]
  for (const p of candidates) if (existsSync(p)) return p
  return null
}

/**
 * 调判据本体(纯通道:取材已在调用方完成,这里只派生 + 传神)。
 *
 * 三态各自**独立**返回,不合并:
 *  - python 找不到 / spawn 失败 / 非零退出 / 输出不可解析 ⇒ `fatal`(调用方折未判定)
 *  - 判据符号缺失 ⇒ `undetermined`(单份实现没了,门**不兜底**)
 *  - 被审面 SyntaxError ⇒ 逐格 `undetermined`,其余文件照判
 *
 * @param {{root?:string, python?:string|null, criterionSrc:string, cases:Array<{path:string,src:string}>}} o
 * @returns {{fatal:string|null, results:Array<{path:string,marks:Array<object>}>, undetermined:Array<{path:string,why:string}>}}
 */
export function judgeSources({ root = ROOT, python, criterionSrc, cases }) {
  const py = python === undefined ? findPython(root) : python
  if (!py) return { fatal: 'ai-service 的 .venv python 找不到', results: [], undetermined: [] }
  if (typeof criterionSrc !== 'string' || criterionSrc.length === 0)
    return { fatal: `${LIFECYCLE_FILE} 的面取不到(判据本体读不出来)`, results: [], undetermined: [] }

  let tmp = null
  try {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'ihui-loaded-marks-'))
    const criterionPath = path.join(tmp, 'criterion.py')
    const payloadPath = path.join(tmp, 'payload.json')
    // ⚠️ 必须落 Buffer(二进制写盘):文本写盘会把 LF 转成 CRLF,判据看到的就是被
    //   换行改过的源码 —— 取材层悄悄改被审面是本仓最恨的那类事故(见头注末段)。
    writeFileSync(criterionPath, Buffer.from(criterionSrc, 'utf8'))
    writeFileSync(payloadPath, Buffer.from(JSON.stringify(cases), 'utf8'))

    const proc = spawnSync(py, ['-c', PY_DRIVER, criterionPath, payloadPath], {
      cwd: root,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 64 << 20,
      // 本门不消费子进程 stdin ⇒ 必须 ignore(Windows 病窗:不写 stdio 与 'pipe' 同病,
      // 后者仍是三通道全管道、stdin 照样建管道、照样 EBUSY)。
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    if (proc.error) return { fatal: `python 派生失败:${proc.error.message}`, results: [], undetermined: [] }
    if (proc.status !== 0)
      return {
        fatal: `python 判据侧非零退出(exit=${proc.status}):${String(proc.stderr || '').slice(-400)}`,
        results: [],
        undetermined: [],
      }
    let parsed
    try {
      parsed = JSON.parse(proc.stdout)
    } catch (e) {
      return { fatal: `python 侧输出不可解析:${e.message}`, results: [], undetermined: [] }
    }
    if (!Array.isArray(parsed?.results) || !Array.isArray(parsed?.undetermined))
      return { fatal: 'python 侧输出形状不符(results/undetermined 缺一)', results: [], undetermined: [] }
    return { fatal: null, results: parsed.results, undetermined: parsed.undetermined }
  } finally {
    // 派生结束即删:这些是系统 temp 下的中间件,不是仓内文件,不留残留。
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true })
      } catch {
        /* 删不掉不是判定问题;它下轮会被自己的 mktemp 绕开 */
      }
    }
  }
}

// ── 判定面枚举与取材 ────────────────────────────────────────────────────

/** 列出扫描面内全部 .py 的仓内相对路径(按面枚举;缺面 ⇒ 抛未判定)。 */
export function listScanPaths({ root = ROOT, face }) {
  let out
  if (face === 'worktree') return listWorktreePaths(root)
  try {
    out =
      face === 'staged'
        ? gitRaw(['ls-files', '-z', '--', SCAN_PREFIX], root)
        : gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SCAN_PREFIX], root)
  } catch (e) {
    throw new Undetermined(`扫描面枚举失败(${face} 面):${e.message}`)
  }
  return out
    .split('\0')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.startsWith(SCAN_PREFIX) && p.endsWith(SCAN_EXT))
    .sort()
}

function listWorktreePaths(root) {
  const base = path.join(root, SCAN_PREFIX)
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch (e) {
      throw new Undetermined(`扫描面枚举失败(worktree 面):${e.message}`)
    }
    for (const e of entries) {
      if (e.name === '__pycache__' || e.name === '.venv') continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name.endsWith(SCAN_EXT))
        out.push(path.relative(root, abs).split(path.sep).join('/'))
    }
  }
  walk(base)
  return out.sort()
}

/** 判据本体必须与被审清单**同面**取到 —— 混面取数会产出自洽却错位的尺子。 */
function readCriterion(root, face) {
  if (face === 'worktree') return readWorktreeFile(root, LIFECYCLE_FILE)
  const spec = (face === 'staged' ? ':' : 'HEAD:') + LIFECYCLE_FILE
  try {
    return catBatch(root, [spec]).get(spec) ?? null
  } catch (e) {
    throw new Undetermined(`判据本体取材失败(${face} 面):${e.message}`)
  }
}

function readContents(root, face, rels) {
  const out = {}
  if (face === 'worktree') {
    for (const rel of rels) {
      try {
        out[rel] = readWorktreeFile(root, rel)
      } catch {
        out[rel] = null
      }
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs)
  rels.forEach((rel, i) => {
    out[rel] = got.get(specs[i]) ?? null
  })
  return out
}

// ── 审计与结论 ──────────────────────────────────────────────────────────

/**
 * 把判据回传的 findings 折成违规条目(纯函数;**不新增任何判定** —— 门只排版)。
 * 一条 finding = 一处"没读到被记成已加载",逐条点名 `path:line` 与形态名。
 */
export function judgeFindings(findings) {
  const violations = []
  for (const f of findings)
    violations.push(
      `不安全加载标记:${f.path}:${f.line} ${f.kind}(载体 ${f.name})—— ` +
        `${KINDS[f.kind] ?? '未登记形态'}判据本体在 ${LIFECYCLE_FILE};`,
    )
  return violations
}

/** 四个形态的**说明文字**。⚠️ 这里只有"怎么改"的散文,没有"怎么判"的逻辑 ——
 *  判定完全来自 Python 侧回传的 `kind`;门从不自己产出 kind。 */
export const KINDS = {
  'finally-set': 'finally 块里无条件置真(读失败也被记成已加载)',
  'except-set': 'except 体内置真(异常分支被折成"已加载"哨兵,与成功路径不可判别)',
  'tail-set': 'try/except 同块尾随置真(异常兜底之后无条件固化)',
  'set-add': '集合 add 记"已加载"(集合表达不了"试过了但没读到")',
}

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face ? { face, error: null } : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) throw new Undetermined(sel.error)

  const criterionSrc = readCriterion(root, sel.face)
  const paths = listScanPaths({ root, face: sel.face })
  const contents = readContents(root, sel.face, paths)

  const cases = []
  const undetermined = []
  const notes = []
  for (const rel of paths) {
    const src = contents[rel]
    if (typeof src !== 'string' || src.length === 0) {
      undetermined.push({ path: rel, why: '面取不到内容(已跳过该文件,未判)' })
      continue
    }
    cases.push({ path: rel, src })
  }
  notes.push(
    `扫描面 ${SCAN_PREFIX}/**/*.py:枚举 ${paths.length} 个 .py,其中取到内容 ${cases.length} 个` +
      `(**刻意不含 tests/****:测试注入会主动置真,扫进来即恒红;故本门绿不得外推为"全仓合规")`,
  )

  const verdict = judgeSources({ root, criterionSrc, cases })
  if (verdict.fatal) {
    undetermined.push({ path: `${SCAN_PREFIX}(面=${sel.face})`, why: verdict.fatal })
    return { face: sel.face, violations: [], undetermined, notes, scanned: 0, byKind: {} }
  }

  for (const u of verdict.undetermined) undetermined.push(u)

  const findings = []
  const byKind = {}
  for (const r of verdict.results) {
    for (const m of r.marks || []) {
      findings.push({ path: r.path, line: m.line, kind: m.kind, name: m.name })
      byKind[m.kind] = (byKind[m.kind] || 0) + 1
    }
  }
  notes.push(
    `判据来源:${LIFECYCLE_FILE}(面=${sel.face},与被审清单同面);` +
      `本门零自行判定(形态分布由判据回传:${JSON.stringify(byKind)})`,
  )
  return {
    face: sel.face,
    violations: judgeFindings(findings),
    undetermined,
    notes,
    scanned: verdict.results.length,
    byKind,
  }
}

// ── --self-test(构造面证明尺子抓得住病;判据从**工作树**取,因为它不在提交链上) ──

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok: !!ok })
  const root = ROOT
  const criterionSrc = readWorktreeFile(root, LIFECYCLE_FILE)
  if (typeof criterionSrc !== 'string') {
    console.log(`--self-test:0/1 通过(判据本体 ${LIFECYCLE_FILE} 取不到)`)
    return 1
  }
  const forms = [
    ['finally-set', FIX_FINALLY_SET],
    ['tail-set', FIX_TAIL_SET],
    ['except-set', FIX_EXCEPT_SET],
    ['set-add', FIX_SET_ADD],
  ]
  const v = judgeSources({
    root,
    criterionSrc,
    cases: forms.map(([k, src]) => ({ path: `fix_${k}.py`, src })),
  })
  if (v.fatal) {
    console.log(`--self-test:0/1 通过(判据派生失败:${v.fatal})`)
    return 1
  }
  for (const [kind] of forms) {
    const r = v.results.find((x) => x.path === `fix_${kind}.py`)
    t(`正例 ${kind}:尺子点名该形态`, r && (r.marks || []).some((m) => m.kind === kind))
  }
  const clean = judgeSources({ root, criterionSrc, cases: [{ path: 'fix_ok.py', src: FIX_SUCCESS_PATH }] })
  t(
    '反向对照:成功路径形态不得误伤',
    !clean.fatal && (clean.results[0]?.marks || []).length === 0,
  )
  const absent = judgeSources({ root, criterionSrc: CRITERION_ABSENT_SRC, cases: [{ path: 'x.py', src: forms[0][1] }] })
  t(
    '单份实现纪律:判据符号缺席 ⇒ 未判定(门不兜底判)',
    !absent.fatal && absent.results.length === 0 && absent.undetermined.length === 1,
  )
  console.log(`--self-test:${cases.filter((c) => c.ok).length}/${cases.length} 通过`)
  for (const c of cases) if (!c.ok) console.log(`   ✗ ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

// ── CLI ──────────────────────────────────────────────────────────────────

function usage() {
  console.log(
    '用法: node scripts/check-load-state-loaded-marks.mjs [--staged|--worktree] [--root <dir>] [--strict] [--json] [--all] [--self-test]\n' +
      '缺省判 HEAD blob;--staged 判索引 blob;--worktree 仅人工逃生舱(--root 只在该档有效);两旗同给 exit 2。\n' +
      `判定 = 调用 ${LIFECYCLE_FILE} 的 ${CRITERION_SYMBOL}(门内零自行判定,无第二份判据)。\n` +
      '扫描面 app/**/*.py(不含 tests/**)。四形态:finally-set / except-set / tail-set / set-add。\n' +
      '面取不到 / Python 派生失败 / SyntaxError / 判据符号缺失 ⇒ 未判定 exit 2(既不冒红也不记绿)。\n' +
      `应急跳过 ${SELF_SKIP}=1。`,
  )
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const showAll = argv.includes('--all')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    process.exit(2)
  }
  let root = ROOT
  const ri = argv.indexOf('--root')
  if (ri >= 0) {
    const val = argv[ri + 1]
    if (!val || val.startsWith('--')) {
      console.error('❌ --root 需要一个目录参数')
      process.exit(2)
    }
    if (sel.face !== 'worktree') {
      console.error('❌ --root 只在 --worktree 档有效(换根却按 HEAD/索引读 = 双根分裂)')
      process.exit(2)
    }
    root = path.resolve(val)
  }
  let res
  try {
    res = runAudit({ root, face: sel.face })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定(取材层/面旗冲突):${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (json) {
    console.log(JSON.stringify({ face: res.face, ...res }, null, 2))
  } else {
    console.log(`   扫描面 ${SCAN_PREFIX}/**:判定 ${res.scanned} 个 .py(面=${res.face})`)
    console.log(
      `   形态分布:${Object.keys(res.byKind).length === 0 ? '零命中' : Object.entries(res.byKind).map(([k, v]) => `${k}=${v}`).join(' / ')}`,
    )
    for (const n of res.notes) console.log(`   · ${n}`)
    if (showAll)
      for (const v of res.violations) console.log(`      · ${v}`)
  }
  // 三态分流:未判定优先于违规 —— "看不见"绝不能被记成"通过",也不该被违规盖住。
  if (res.undetermined.length > 0) {
    console.error(
      `⚠️ 无法判定:${res.undetermined.length} 项 —— ` +
        res.undetermined.map((u) => `${u.path}: ${u.why}`).join(' | ') +
        `(面=${res.face};既不记绿也不冒红${strict ? ',--strict 档下不放行' : ''})`,
    )
    process.exit(strict ? 1 : 2)
  }
  if (res.violations.length === 0) {
    if (!json)
      console.log(
        `✅ 不安全加载载体扫描通过(面=${res.face}):${res.scanned} 个 .py 零命中` +
          `(判据 ${CRITERION_SYMBOL},本体在 ${LIFECYCLE_FILE})`,
      )
    process.exit(0)
  }
  if (!json) {
    console.log(
      `❌ 检出 ${res.violations.length} 处不安全加载标记(面=${res.face}):`,
    )
    for (const v of res.violations) console.log(`   · ${v}`)
    console.log(
      '改法:读失败/未读到**不得**记成已加载 —— 置真只许落在成功路径与权威写入上;\n' +
        '     失败计数走 _load_lifecycle 的共享出口(load_failures / 退避 / gave_up)。\n' +
        '     ⚠️ 不得为变绿放宽判据、不得写豁免清单消账 —— 判据只有一份，就在 ' +
        LIFECYCLE_FILE +
        '。\n' +
        `     应急跳过 ${SELF_SKIP}=1(会在提交正文留痕)。`,
    )
  }
  process.exit(1)
}

/** 导出给 §22c 镜像测试(测试不得重写判据,见 scripts/tests/ 同名 .test.mjs) */
export const __test__ = {
  SELF_SKIP,
  LIFECYCLE_FILE,
  CRITERION_SYMBOL,
  SCAN_PREFIX,
  SCAN_EXT,
  KINDS,
  FIX_FINALLY_SET,
  FIX_TAIL_SET,
  FIX_EXCEPT_SET,
  FIX_SET_ADD,
  FIX_SUCCESS_PATH,
  CRITERION_ABSENT_SRC,
  findPython,
  judgeSources,
  judgeFindings,
  listScanPaths,
  runAudit,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// // ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
