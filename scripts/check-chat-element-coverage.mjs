#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对话流元素覆盖守门(PROJECT_PLAN.md D51 / 验收门 H13)
//
// 单一事实源 = scripts/data/chat-flow-elements.json(已实现锚点 + 声明事件 + 基线)
//            + PROJECT_PLAN.md 第四轮 `- [ ] **Dnn …(G-xx)**` 任务行(planned 元素,实时解析)。
// 五类违规即阻塞:
//   ① 期望元素锚点漂移(已实现元素的文件或关键标识不见 → 说明渲染位被删/改名)
//   ② 元素声明依赖的契约事件在两端契约里找不到(ai-service 与 packages/shared 必须同时有)
//   ③ 清单条目数倒退(低于 entryCountBaseline = 有人删了任务行或删了已实现元素而未说明)
//   ④ 锚点存续性倒退(④a 单条目锚点数 < anchorCountBaseline.perElement / ④b 全清单锚点总数 < total)
//      —— 只按**条目**判不按**文件**判:锚点在同条目内从一端搬到另一端是合法重构,总数不变即绿。
//   ⑤ 注释式摘线(锚点的关键标识在**代码面**上已不见,只在注释里存续 = anchor-commented-out)
//      原实现是 `text.includes(mustMatch)`,把宿主那行 `import QueueBar from '../components/QueueBar'`
//      **改成注释**仍然"含该子串"→ 门报绿。现改为在**剥掉注释后的文本**上匹配。
// 设计取向:planned 元素**不**要求锚点(否则入库即恒红),增长只抬基线不拦人。
//
// 单调性(本票的自证核心):⑤ 只会让判红集合**变大**,不可能让原本红的变绿 —— 剥注释只删字符,
// `includes` 命中面单调收缩。交付时以「改前红 ⊇ 改后红」的差集对照证明(要求 改前红而改后绿 = 0)。
// 剩余盲区如实登记(不得当作已全解决):
//   · 状态机收尾处于「未闭合块注释 / 未闭合三引号串」⇒ 该文件判"不可信",**回退原文**(与改前等强),
//     计数打进输出的 undetermined 里,不静默;
//   · 除零/异或等歧义形态下的正则字面量按普通字符处理(只在「前一个有效字符 ∈ ( , = : [ ! & | ? { ;
//     或行首」且同一行内闭合)时才当正则跳过),因此形如 `a /= /re/` 这类极端写法仍可能被当成注释起点;
//   · 判据⑤认的是"代码面上不存续",不认"运行时是否真被调用"(摘线到一段死代码里仍算存续)。
//
// 用法:node scripts/check-chat-element-coverage.mjs [--self-test] [--json]
//   runner 下发的 --staged 不参与收窄:锚点/契约/清单条目都是"整仓属性",
//   按暂存集收范围恰好会放过"删掉别处锚点"这一类(与守门 78 同取向)。

import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'scripts', 'data', 'chat-flow-elements.json')
const CONTRACT_PY = join(ROOT, 'apps', 'ai-service', 'app', 'core', 'sse_contract.py')
const CONTRACT_TS = join(ROOT, 'packages', 'shared', 'src', 'sse', 'contract.ts')
const SKIP_ENV = 'HUSKY_SKIP_CHAT_ELEMENT_COVERAGE'

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * 判的是**仓库内容**,不是共享工作区里某个人未提交的缓冲区(与守门 77 同一取向,2026-09-24 补)。
 *
 * 原实现一律 `readFileSync`,于是并行会话的半截草稿会把无关提交钉红:2026-09-24 实测
 * `AiAssistantN8nScreen.tsx` 的 5 个锚点在 HEAD 里全在、在别人的未提交重写里全没了 →
 * [57] 恒红,而本会话只改了守门脚本。恒红的唯一结局是人人 --no-verify,连带把真正防回归的
 * 判据一起关掉(见 AGENTS §12)。
 *
 * 取内容规则:
 *   该路径已在暂存区(≠ HEAD)→ 取**索引 blob** = 这次提交会带走什么;
 *   该路径只有工作树改动(未暂存)→ 取 **HEAD blob** = 别人没提交的东西不算本仓状态;
 *   与 HEAD 一致 → 直读磁盘(三者等价,免为 66 个锚定文件逐个开进程)。
 */
const GIT_BIN = process.env.GIT_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/git.exe' : 'git')
let repoUsable = true
function gitAt(args) {
  if (!repoUsable) return null
  try {
    return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return null
  }
}
const nameSet = (args) => {
  const out = gitAt(args)
  if (out === null) {
    repoUsable = false
    return null
  }
  return new Set(out.split('\n').filter(Boolean).map((l) => l.replaceAll('\\', '/')))
}
const STAGED = nameSet(['diff', '--name-only', '--cached'])
const WORKTREE_DIRTY = nameSet(['diff', '--name-only'])

/**
 * 纯决策(自检直接复用):给一个路径的三种"是否偏离"布尔,返回该读哪一份内容。
 *   staged            → 'index'(= 这次提交会带走的内容)
 *   仅工作树脏        → 'head'(别人没提交的缓冲区不算本仓状态)
 *   干净              → 'disk'(与 index/HEAD 等价,免开进程)
 */
export function pickSource({ staged, worktreeDirty }) {
  if (staged) return 'index'
  if (worktreeDirty) return 'head'
  return 'disk'
}

export function contentAt(rel, repoRoot = ROOT) {
  const norm = rel.replaceAll('\\', '/')
  const abs = join(repoRoot, norm)
  const readDisk = () => (existsSync(abs) ? readFileSync(abs, 'utf8') : '')
  if (resolve(repoRoot) !== resolve(ROOT) || !repoUsable) return readDisk()
  const src = pickSource({ staged: !!STAGED?.has(norm), worktreeDirty: !!WORKTREE_DIRTY?.has(norm) })
  if (src === 'disk') return readDisk()
  const blob = gitAt(['show', src === 'index' ? `:${norm}` : `HEAD:${norm}`])
  return blob !== null ? blob : readDisk()
}

// ─── 判据⑤ 剥注释(2026-09-25 立,堵"把宿主那行 import 改成注释"仍算存续的假绿)──────
//
// 为什么必须**字符串感知**:本仓已两次栽在"剥注释状态机被串内 /* 骗进块注释状态 ⇒ 假绿"
// (守门 70 的同类缺陷),而 `'https://x'` 里的 `//` 若被当注释起点,会把整行真代码吃掉 →
// 反方向的**假红**(本门 blocking 且每轮都跑,假红 = 恒红门 = 逼人 --no-verify)。
// 因此这里不是"能省则省"的近似:引号/反引号/三引号一律先进字符串态,注释判定只在 code 态发生。
const JS_LIKE = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'])
const PY_LIKE = new Set(['py'])
/** 正则字面量的"前置即合法"集合:刻意不含 `< > + - * % ~ ^`(那些位置后面的 `/` 更可能是除法/JSX 闭合) */
const REGEX_OPENERS = '(,=:[!&|?{};'

function regexLiteralEnd(text, from) {
  for (let j = from; j < text.length; j++) {
    const ch = text[j]
    if (ch === '\\') {
      j += 1
      continue
    }
    if (ch === '\n') return -1 // 不在同一行闭合 ⇒ 不是正则字面量
    if (ch === '/') return j + 1
  }
  return -1
}

/**
 * 剥掉注释,返回 `{ text, trusted, reason }`。
 * 覆盖:行注释(`'//' + 后续`)、块注释(`'/*' … '*' + '/'`)、JSX 花括号块注释、Python 井号注释、
 * 以及单引/双引/反引号/三引号串内的伪注释符(一律不剥)。
 * `trusted:false` 只出现在**收尾仍处于块注释或三引号串**(文件形态可疑,继续剥会造成大面积假红),
 * 调用方必须回退原文 —— 回退=与改前等强,绝不比改前更宽。
 */
export function stripCodeComments(input, ext = '') {
  const text = typeof input === 'string' ? input : ''
  const isJs = JS_LIKE.has(ext)
  const isPy = PY_LIKE.has(ext)
  const n = text.length
  let out = ''
  let i = 0
  let state = 'code' // code | line | block | str
  let quote = ''
  let triple = false
  let lastSig = ''
  while (i < n) {
    const c = text[i]
    const d = text[i + 1]
    if (state === 'code') {
      if (c === '/' && d === '/') {
        state = 'line'
        i += 2
        continue
      }
      if (c === '/' && d === '*') {
        state = 'block'
        i += 2
        continue
      }
      if (isPy && c === '#') {
        state = 'line'
        i += 1
        continue
      }
      // 正则字面量:/…/ 里可以有 //,不当注释起点(故须在字符串分支之前、注释分支之后判)
      if (isJs && c === '/' && (lastSig === '' || lastSig === '\n' || REGEX_OPENERS.includes(lastSig))) {
        const end = regexLiteralEnd(text, i + 1)
        if (end > 0) {
          out += text.slice(i, end)
          i = end
          lastSig = '/'
          continue
        }
      }
      if (c === "'" || c === '"' || (isJs && c === '`')) {
        triple = text[i + 1] === c && text[i + 2] === c
        quote = c
        out += triple ? c + c + c : c
        i += triple ? 3 : 1
        state = 'str'
        lastSig = c
        continue
      }
      out += c
      if (c === '\n') lastSig = '\n'
      else if (!/\s/.test(c)) lastSig = c
      i += 1
      continue
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out += c
      }
      i += 1
      continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') {
        state = 'code'
        i += 2
        lastSig = ''
        continue
      }
      if (c === '\n') out += c // 保行号,便于人工对照
      i += 1
      continue
    }
    // state === 'str'
    if (c === '\\') {
      out += c + (d ?? '')
      i += 2
      continue
    }
    if (!triple && c === '\n') {
      // 单/双引号串不得跨行 ⇒ 这个引号其实是除号/异或之类的歧义字符,退回 code 继续判
      state = 'code'
      out += c
      i += 1
      continue
    }
    if (c === quote && (!triple || (text[i + 1] === quote && text[i + 2] === quote))) {
      out += triple ? quote + quote + quote : quote
      i += triple ? 3 : 1
      state = 'code'
      lastSig = quote
      continue
    }
    out += c
    i += 1
  }
  const reason =
    state === 'block' ? '块注释未闭合' : state === 'str' && triple ? '三引号串未闭合' : state === 'str' ? '字符串未闭合' : ''
  // 单行串未闭合已在循环里就地退回 code(不影响收尾);只有块状结构未闭合才判不可信
  return { text: out, trusted: state !== 'block' && !(state === 'str' && triple), reason }
}

const extOf = (file) => (String(file).split('.').pop() || '').toLowerCase()

/** 从 PROJECT_PLAN.md 解析第四轮任务行 → planned 元素与其 G-ID */
export function parsePlanned(planText, taskLinePattern, gapIdPattern) {
  const planned = []
  const lineRe = new RegExp(taskLinePattern, 'mu')
  const gapRe = new RegExp(gapIdPattern, 'gu')
  for (const line of planText.split('\n')) {
    const hit = lineRe.exec(line)
    if (!hit) continue
    const gaps = [...new Set(line.match(gapRe) ?? [])]
    planned.push({ task: hit[2], done: hit[1] === 'x', title: line.slice(hit.index).slice(0, 90), gaps })
  }
  return planned
}

export function checkAnchors(implemented, repoRoot = ROOT, opts = {}) {
  const baselineEntries = Array.isArray(opts.commentOnlyBaseline) ? opts.commentOnlyBaseline : []
  const keyOf = (v) => `${v.id} :: ${v.file} :: ${v.mustMatch}`
  const known = new Set(baselineEntries.map(keyOf))
  const stillDebt = new Set()
  const violations = []
  const notices = []
  let undetermined = 0
  for (const el of implemented) {
    for (const anchor of el.anchors ?? []) {
      const text = contentAt(anchor.file, repoRoot)
      if (!text) {
        violations.push({ kind: 'anchor-missing-file', id: el.id, detail: anchor.file })
        continue
      }
      if (!anchor.mustMatch) continue
      if (!text.includes(anchor.mustMatch)) {
        violations.push({
          kind: 'anchor-missing-marker',
          id: el.id,
          detail: `${anchor.file} 内找不到「${anchor.mustMatch}」`,
        })
        continue
      }
      // 原文含该子串 ≠ 代码面上存续:判据⑤在**剥注释后**再匹配一次。
      const { text: codeSurface, trusted, reason } = stripCodeComments(text, extOf(anchor.file))
      if (!trusted) {
        undetermined += 1
        notices.push({
          kind: 'anchor-strip-undetermined',
          id: el.id,
          detail: `${anchor.file} 剥注释不可信(${reason}),本条按原文判 = 与改前等强,未放宽`,
        })
        continue
      }
      if (codeSurface.includes(anchor.mustMatch)) continue
      // 键必须含**元素 id**(不是 anchor.id —— 锚点对象上没有 id,写错会让存量清单永不命中,
      // 把 3 处存量当场判红 = 恒红门)。上面 notices 的 cleared 计数就是这条缺陷的显形处。
      const k = `${el.id} :: ${anchor.file} :: ${anchor.mustMatch}`
      if (known.has(k)) {
        stillDebt.add(k)
        notices.push({ kind: 'anchor-commented-out-known', id: el.id, detail: k })
        continue
      }
      violations.push({
        kind: 'anchor-commented-out',
        id: el.id,
        detail:
          `${anchor.file} 内「${anchor.mustMatch}」**只存在于注释里**(代码面上已不存续)—— ` +
          `宿主那行被摘线成注释,或锚点本来就指错了对象。清账:把 mustMatch 改指代码面上的真实标识`,
      })
    }
  }
  // 登记项没命中 = 要么已清偿(好事),要么该行的 id/file/mustMatch 与任何锚点都对不上(登记错位,
  // 效果等同"基线失效")。两种都只提示不判红 —— 但它必须被打印,否则错位会静默成恒红。
  for (const k of known) if (!stillDebt.has(k)) notices.push({ kind: 'anchor-commented-out-cleared', detail: k })
  return { violations, notices, undetermined }
}

/**
 * 判据④ 锚点存续性(棘轮,只减即红)。
 * 关键取舍:额度按**条目**登记而不是按文件,所以"把某端锚点搬到同条目的另一端"总数不变 ⇒ 绿。
 * 恒红是本仓记过最多次的反面教训(逼人以 --no-verify → 连带废掉全部守门),故新增一律放行,
 * 只有低于登记额度才判红;确属撤销须在同 PR 里调额度并说明理由。
 */
export function checkAnchorPersistence(implemented, persistence) {
  const list = Array.isArray(implemented) ? implemented : []
  const perElement =
    persistence && typeof persistence === 'object' && persistence.perElement && typeof persistence.perElement === 'object'
      ? persistence.perElement
      : null
  const total = persistence && typeof persistence === 'object' ? persistence.total : null
  if (perElement === null || typeof total !== 'number' || !Number.isFinite(total)) {
    return {
      violations: [
        {
          kind: 'anchor-baseline-missing',
          id: '(persistence)',
          detail:
            '台账缺 anchorCountBaseline.total / .perElement —— 整份登记表被按旧基线回写的指纹' +
            '(AGENTS §12:多会话共写的登记表正是最易被回写的一类)。恢复该字段,或在同 PR 说明理由后重建',
        },
      ],
      danglingBaseline: [],
    }
  }
  const violations = []
  const seen = new Set()
  let sum = 0
  for (const el of list) {
    const n = (el.anchors ?? []).length
    sum += n
    const floor = perElement[el.id]
    if (typeof floor !== 'number') continue
    seen.add(el.id)
    if (n < floor) {
      violations.push({
        kind: 'anchor-count-regression',
        id: el.id,
        detail: `锚点数 ${n} < 基线 ${floor}(少 ${floor - n} 条)—— 搬到同条目另一端可以(总数不变即绿),整批删不行`,
      })
    }
  }
  if (sum < total) {
    violations.push({
      kind: 'anchor-total-regression',
      id: '(persistence)',
      detail: `全清单锚点总数 ${sum} < 基线 ${total} —— 有人删了锚点行而未调 anchorCountBaseline`,
    })
  }
  const danglingBaseline = Object.keys(perElement).filter((k) => !seen.has(k))
  return { violations, danglingBaseline }
}

export function checkEvents(implemented, contractPyText, contractTsText) {
  const violations = []
  for (const el of implemented) {
    for (const ev of el.events ?? []) {
      const inPy = contractPyText.includes(`"${ev}"`) || contractPyText.includes(`'${ev}'`)
      const inTs = contractTsText.includes(`"${ev}"`) || contractTsText.includes(`'${ev}'`)
      if (!inPy || !inTs) {
        violations.push({
          kind: 'event-contract-drift',
          id: el.id,
          detail: `${ev}: ai-service=${inPy ? '有' : '无'} shared=${inTs ? '有' : '无'}(两端必须同时声明)`,
        })
      }
    }
  }
  return violations
}

export function checkBaseline(entryCount, baseline) {
  return entryCount < baseline
    ? [
        {
          kind: 'inventory-regression',
          id: '(inventory)',
          detail: `清单条目 ${entryCount} < 基线 ${baseline} —— 删任务行或删已实现元素必须同 PR 说明理由并调基线`,
        },
      ]
    : []
}

export function runChecks({ data, planText, contractPy, contractTs }) {
  const planned = parsePlanned(planText, data.planSource.taskLinePattern, data.planSource.gapIdPattern)
  const gapIds = new Set()
  for (const p of planned) for (const g of p.gaps) gapIds.add(g)
  const anchorRes = checkAnchors(data.implemented, ROOT, {
    commentOnlyBaseline: data.commentOnlyAnchorBaseline?.entries,
  })
  const persistenceRes = checkAnchorPersistence(data.implemented, data.anchorCountBaseline)
  const eventViolations = checkEvents(data.implemented, contractPy, contractTs)
  const entryCount = gapIds.size + data.implemented.length
  const baselineViolations = checkBaseline(entryCount, data.entryCountBaseline)
  const anchorCount = (data.implemented ?? []).reduce((s, el) => s + (el.anchors ?? []).length, 0)
  return {
    plannedTasks: planned.length,
    gapIds: gapIds.size,
    implemented: (data.implemented ?? []).length,
    anchorCount,
    entryCount,
    baseline: data.entryCountBaseline,
    // 存量与未判定一律**如实报数**,绝不静默成"看起来全绿"(只减不增,新增的注释态锚点直接进 violations)
    knownCommentOnly: anchorRes.notices.filter((n) => n.kind === 'anchor-commented-out-known').length,
    clearedCommentOnly: anchorRes.notices.filter((n) => n.kind === 'anchor-commented-out-cleared').length,
    anchorUndetermined: anchorRes.undetermined,
    stripNotices: anchorRes.notices.filter((n) => n.kind === 'anchor-strip-undetermined').map((n) => `${n.id}: ${n.detail}`),
    danglingBaseline: persistenceRes.danglingBaseline,
    violations: [
      ...anchorRes.violations,
      ...persistenceRes.violations,
      ...eventViolations,
      ...baselineViolations,
    ],
  }
}

function selfTest() {
  // 判据 pattern 只有一份真相:优先取数据文件里的,读不到才用等价内联值(并显式告警)
  let planSource
  try {
    planSource = loadJson(DATA_FILE).planSource
  } catch {
    console.warn('⚠️ self-test 读不到数据文件,回退内联 pattern(可能与实际判据漂移)')
    planSource = {
      taskLinePattern: '^- \\[([ x])\\]\\s*(?:✅[^*]*)?\\*\\*(D[0-9]+)',
      gapIdPattern: 'G-[0-9]{2,3}',
    }
  }
  const base = {
    planSource,
    entryCountBaseline: 1,
    anchorCountBaseline: { total: 1, perElement: { ok: 1, ev: 0 } },
    implemented: [{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }], events: [] }],
  }
  const plan = '- [ ] **D90 示例元素(G-140)**:x\n- [x] ✅(2026-09-20)**D27 交付审查(G-29)**:y\n'
  const cases = [
    ['正常态', { ...base, implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] }, plan, 0],
    [
      '① 锚点文件不见',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'nope/nothere.tsx' }] }] },
      plan,
      1,
    ],
    [
      '① 锚点标识漂移',
      { ...base, implemented: [{ id: 'bad', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在' }] }] },
      plan,
      1,
    ],
    [
      '② 事件单端缺失',
      {
        ...base,
        implemented: [{ id: 'ev', anchors: [], events: ['brand_new_event'] }],
      },
      plan,
      1,
    ],
    ['③ 条目数倒退', { ...base, entryCountBaseline: 999 }, plan, 1],
    [
      '④a 锚点被整批删(条目内计数低于额度)',
      { ...base, implemented: [{ id: 'ok', anchors: [], events: [] }] },
      plan,
      1,
    ],
    [
      '④b 合法搬端:锚点从 A 文件搬到 B 文件(条目内计数不变)⇒ 必绿',
      { ...base, implemented: [{ id: 'ok', anchors: [{ file: 'pnpm-workspace.yaml', mustMatch: 'packages:' }], events: [] }] },
      plan,
      0,
    ],
    [
      '④c 台账缺 anchorCountBaseline(整文件回写指纹)',
      { ...base, anchorCountBaseline: undefined, implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] },
      plan,
      1,
    ],
    [
      '⑤a 注释式摘线(真语料:宿主只在 // 注释里留该词)⇒ 必红',
      {
        ...base,
        commentOnlyAnchorBaseline: { entries: [] },
        implemented: [
          { id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] },
        ],
      },
      plan,
      1,
    ],
    [
      '⑤b 同一处已登记为存量 ⇒ 只报数不判红(防恒红)',
      {
        ...base,
        commentOnlyAnchorBaseline: {
          entries: [
            {
              id: 'ok',
              file: 'apps/web/src/components/ai/task-status-bar.tsx',
              mustMatch: 'describeToolActivity',
              note: 'self-test 夹具',
            },
          ],
        },
        implemented: [
          { id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] },
        ],
      },
      plan,
      0,
    ],
  ]
  let bad = 0
  for (const [label, data, planText, expectedMin] of cases) {
    const res = runChecks({ data, planText, contractPy: '', contractTs: '' })
    const got = Math.min(res.violations.length, 1)
    const ok = got === Math.min(expectedMin, 1) && (expectedMin === 0 ? res.violations.length === 0 : true)
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${res.violations.length} 违规(期望 ${expectedMin === 0 ? '0' : '≥1'})`)
  }
  // ⑤b 的"只报数"必须真报出数(报不出来 = 存量清单形同隐形)
  const knownCase = runChecks({
    data: cases[9][1],
    planText: plan,
    contractPy: '',
    contractTs: '',
  })
  const knownCounted = knownCase.knownCommentOnly === 1 && knownCase.violations.length === 0
  if (!knownCounted) bad++
  console.log(
    `${knownCounted ? '✓' : '✗'} ⑤b 存量计数如实输出 → knownCommentOnly=${knownCase.knownCommentOnly}(期望 1)、违规 ${knownCase.violations.length}(期望 0)`,
  )
  // 事件双端齐备的正例:必须不报违规
  const evOk = runChecks({
    data: {
      ...base,
      anchorCountBaseline: { total: 0, perElement: {} },
      implemented: [{ id: 'ev', anchors: [], events: ['usage'] }],
    },
    planText: plan,
    contractPy: 'EVENTS = ["usage"]',
    contractTs: 'export const E = ["usage"]',
  })
  const evOkPass = evOk.violations.length === 0
  if (!evOkPass) bad++
  console.log(`${evOkPass ? '✓' : '✗'} ② 正例(双端都有)→ ${evOk.violations.length} 违规(期望 0)`)
  const parsed = runChecks({ data: base, planText: plan, contractPy: '', contractTs: '' })
  const parseOk = parsed.plannedTasks === 2 && parsed.gapIds === 2 && parsed.violations.length === 0
  if (!parseOk) bad++
  console.log(
    `${parseOk ? '✓' : '✗'} 解析判据:任务 ${parsed.plannedTasks}(期望 2)、G-ID ${parsed.gapIds}(期望 2)、违规 ${parsed.violations.length}(期望 0)`,
  )
  // 内容来源决策(2026-09-24 补):判仓库内容而非共享工作区快照,四个方向都要钉住
  const srcCases = [
    [{ staged: true, worktreeDirty: true }, 'index', '已暂存 → 判索引(这次提交会带走的内容)'],
    [{ staged: false, worktreeDirty: true }, 'head', '只有工作树脏 → 判 HEAD(别人未提交的缓冲区不算本仓状态)'],
    [{ staged: false, worktreeDirty: false }, 'disk', '干净文件 → 直读磁盘(与 index/HEAD 等价,免开进程)'],
    [{ staged: true, worktreeDirty: false }, 'index', '只暂存未再改 → 仍判索引'],
  ]
  for (const [inp, want, label] of srcCases) {
    const got = pickSource(inp)
    const ok = got === want
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} 内容来源 ${label} → ${got}(期望 ${want})`)
  }
  // 判据⑤ 的剥注释语义(成对正反例):本仓记过两次"状态机被串内 /* 骗进块注释态 ⇒ 假绿"
  const stripCases = [
    {
      label: '行注释被剥(含被注释掉的那行 import)',
      input: "const a = 1\n// import Q from 'q' // 摘线\nconst b = 2\n",
      ext: 'ts',
      trusted: true,
      kept: ['const a = 1', 'const b = 2'],
      gone: ["import Q from 'q'"],
    },
    {
      label: "串内 // 不得当注释起点(反向对照,防假红)",
      input: "const u = 'https://x.example/a' ;\nconst v = 2 // tail\n",
      ext: 'ts',
      trusted: true,
      kept: ["'https://x.example/a'", 'const v = 2'],
      gone: ['tail'],
    },
    {
      label: '串内 /* 不得进块注释态(防把后半个文件吞掉)',
      input: 'const u = "http://a/*b*/c" ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['"http://a/*b*/c"', 'const KEEP = 1'],
      gone: [],
    },
    {
      label: '多行块注释被剥且保留换行',
      input: 'a /* 块\n注释 */ b\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['a ', ' b', 'const KEEP = 1'],
      gone: ['块', '注释'],
    },
    { label: 'JSX {/* */} 被剥', input: 'const x = <T>{/* import Q */}1</T>\n', ext: 'tsx', trusted: true, kept: ['1'], gone: ['import Q'] },
    {
      label: '正则字面量里的 // 不当注释起点',
      input: 'const re = /https?:\\/\\//g ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['/https?:\\/\\//g', 'const KEEP = 1'],
      gone: [],
    },
    {
      label: '模板串内的伪注释符不剥',
      input: 'const s = `模板里 // 与 /* 都不算注释` ;\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: true,
      kept: ['`模板里 // 与 /* 都不算注释`', 'const KEEP = 1'],
      gone: [],
    },
    { label: '非 Python 文件里的 # 不是注释', input: 'const s = a # b ;\n', ext: 'ts', trusted: true, kept: ['# b'], gone: [] },
    { label: 'Python # 注释被剥', input: '# 说明 import Q\nx = 1\n', ext: 'py', trusted: true, kept: ['x = 1'], gone: ['import Q', '说明'] },
    {
      label: 'Python 三引号 docstring 里的 # 不当注释',
      input: '"""\n# 不是注释 import Q\n"""\nx = 1\n',
      ext: 'py',
      trusted: true,
      kept: ['# 不是注释 import Q', 'x = 1'],
      gone: [],
    },
    {
      label: '未闭合块注释 ⇒ trusted:false(调用方回退原文,绝不假红)',
      input: 'const bad = 1 /* 块注释没关\nconst KEEP = 1\n',
      ext: 'ts',
      trusted: false,
      kept: [],
      gone: [],
    },
    {
      label: '正常代码里的标识必须留下(变异④的正向底座)',
      input: "import QueueBar from '../components/QueueBar'\n",
      ext: 'tsx',
      trusted: true,
      kept: ["import QueueBar from '../components/QueueBar'"],
      gone: [],
    },
  ]
  for (const c of stripCases) {
    const r = stripCodeComments(c.input, c.ext)
    const trustOk = r.trusted === c.trusted
    const keptOk = c.kept.every((s) => r.text.includes(s))
    const goneOk = c.gone.every((s) => !r.text.includes(s))
    const ok = trustOk && keptOk && goneOk
    if (!ok) bad++
    const why = ok ? '' : !trustOk ? `(trusted 期望 ${c.trusted} 实得 ${r.trusted})` : !keptOk ? '(该留的没留)' : '(该剥的没剥)'
    console.log(`${ok ? '✓' : '✗'} 剥注释 ${c.label}${why}`)
  }
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [chat-element-coverage] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const data = loadJson(DATA_FILE)
  // 计划文本与两份契约同样按**仓库内容**判(见 contentAt 注释):PROJECT_PLAN.md 是共享工作区里
  // 最容易被并发会话按旧基线整文件覆写的一份,按磁盘读会把"别人没提交的旧副本"当成本仓清单。
  const planText = contentAt('PROJECT_PLAN.md')
  const relOpt = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replaceAll('\\', '/') : null)
  const readOpt = (p) => {
    const rel = relOpt(resolve(p))
    return rel ? contentAt(rel) : existsSync(p) ? readFileSync(p, 'utf8') : ''
  }
  const res = runChecks({
    data,
    planText,
    contractPy: readOpt(CONTRACT_PY),
    contractTs: readOpt(CONTRACT_TS),
  })
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ ...res, violations: res.violations }, null, 2))
  }
  if (res.violations.length === 0) {
    console.log(
      `✅ [chat-element-coverage] 清单 ${res.entryCount} 条(G-ID ${res.gapIds} + 已实现锚点 ${res.implemented})、锚点 ${res.anchorCount} 条、planned 任务 ${res.plannedTasks} 行,锚点存续性/代码面/契约均一致`,
    )
  } else {
    console.error(`❌ [chat-element-coverage] ${res.violations.length} 处违规(清单 ${res.entryCount} 条、锚点 ${res.anchorCount} 条):`)
    for (const v of res.violations) console.error(`  ${v.kind} :: ${v.id} :: ${v.detail}`)
  }
  // 存量与未判定一律要喊出来:静默的"看起来全绿"与恒红门同样是本仓记过最多次的坑
  if (res.knownCommentOnly > 0) {
    console.error(
      `  ⚠️ 存量注释态锚点 ${res.knownCommentOnly} 处(已登记 commentOnlyAnchorBaseline,只报数不判红、只减不增):`,
    )
    for (const e of data.commentOnlyAnchorBaseline?.entries ?? []) {
      console.error(`     · ${e.id} :: ${e.file} :: ${e.mustMatch}`)
    }
    console.error('     清账方式:把 mustMatch 改指宿主**代码面**上的真实标识(不得反向删注释来消账)')
  }
  if (res.clearedCommentOnly > 0) {
    console.error(
      `  ⚠️ 存量清单有 ${res.clearedCommentOnly} 项本轮未命中:要么已被清偿(请同 PR 移除登记项),要么该行 id/file/mustMatch 登记错位(= 基线失效,会让另一处恒红)。两种都不计红,但都必须人工看一眼`,
    )
  }
  if (res.anchorUndetermined > 0) {
    console.error(`  ⚠️ ${res.anchorUndetermined} 处锚定文件剥注释不可信,已回退原文判(与改前等强,未放宽):`)
    for (const s of res.stripNotices) console.error(`     · ${s}`)
  }
  if (res.danglingBaseline.length > 0) {
    console.error(
      `  ⚠️ anchorCountBaseline.perElement 有 ${res.danglingBaseline.length} 个键在 implemented 里已无对应条目(元素被改名/删除的指纹,只提示):${res.danglingBaseline.join(', ')}`,
    )
  }
  if (res.violations.length === 0) return 0
  console.error(
    `\n  💡 修复:渲染位被删/改名 → 恢复或同 PR 更新 scripts/data/chat-flow-elements.json 并说明理由;\n     事件单端缺 → 补 sse_contract.py 与 packages/shared/src/sse/contract.ts 两处;\n     条目/锚点倒退 → 恢复任务行或锚点,或说明为何撤销后同 PR 调基线;\n     注释式摘线(anchor-commented-out)→ 恢复宿主那行真代码,或把 mustMatch 改指代码面上的真实标识;\n     自检:node scripts/check-chat-element-coverage.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
  )
  return 1
}

export const __test__ = {
  parsePlanned,
  checkAnchors,
  checkEvents,
  checkBaseline,
  checkAnchorPersistence,
  stripCodeComments,
  runChecks,
  pickSource,
  contentAt,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
