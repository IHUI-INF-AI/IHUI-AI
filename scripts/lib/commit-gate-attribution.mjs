// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * safe-commit 的"钩子失败归因"判据(2026-09-25 立)。
 *
 * 要修的那个缺陷:safe-commit 在首次 commit 失败后原样打印
 *   「按用户规则"hook 失败因其他 agent 代码 → --no-verify 重试"」
 * 并直接 `--no-verify`。问题是**它从未计算过归因** —— "其他 agent 代码"是抄来的结论,不是量出来的。
 * 实测(2026-09-25 00:4x):一轮 134 道门跑完 111 通过 / 2 警告 / **1 失败**,红的是
 * `check-push-sync`(判的是"本地是否领先远端"这种远端态,与提交内容无关),而输出照样写成
 * "因其他 agent 代码"。三种不相干的成因被压成同一条措辞:
 *   ① 我的内容真红  → 本该修完再提,却跳门把违规送进主干;
 *   ② 别人的内容红  → 跳门是对的(AGENTS §12),措辞也该如此;
 *   ③ 门判的是机器/远端态 → 提交者结构上无法满足,跳门合法,但写成"他人代码"会让人以为
 *      门在别人的问题上生效过。
 *
 * 为什么不维护一张"机器态门 id 清单":清单必然腐烂(AGENTS 对 `RN_ONLY_BRAND_KEYS` 的教训是
 * "豁免项若已不存在同样算红")。这里改成**按当次证据判定**:
 *   - 先把 runner 汇总里的 blocking 失败门逐条解析出来(格式与 `printSummary` 同源);
 *   - 再逐道复跑该门,拿它**自己这次的输出**去比对本次声明的文件集:
 *     点名了我的文件 ⇒ 判"我的",拒绝跳门;
 *     没点名 ⇒ 判"非本次内容",允许跳门,但措辞只说量到的那部分;
 *     复跑已过关 ⇒ 更强的一条:该红不在本次内容里。
 *
 * 本模块是纯判定 + 注入式复跑(`runGate`),因此可在不 spawn git 的前提下自测。
 */

const ANSI_RE = /\x1b\[[0-9;]*m/g

/**
 * "长得像结论的行"的标记。
 * ⚠️ 为什么必须逐行筛而不是整段 includes:守门脚本常在开头**回显本次触发它的文件清单**
 * (门 35 mypy 实测就打 `[mypy 守门] staged 检测到 2 个 Python 文件改动:\n - apps/ai-service/...`)。
 * 整段子串匹配会把这行清单当成"该门点名了我的违规"⇒ 误判 `mine` ⇒ 把别人一次本该合法的提交
 * 拒死(2026-09-25 02:22 真实发生,留痕 kind=mine,而 mypy 真正报错的是另外两个文件)。
 * 结论行必带定位或错误字样;纯清单行不带,故排除。
 */
const FINDING_LINE_RE = /(error|错误|违规|failure|failed|❌|✗|:\d+\b|报数|判定)/i

/** 只在"结论行"里找本次声明的文件 */
export function findingLines(output) {
  return stripAnsi(output)
    .split(/\r?\n/)
    .filter((l) => FINDING_LINE_RE.test(l))
}

export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI_RE, '')
}

/**
 * 解析 guardian-runner 的汇总块。
 * 返回 { batchReported, executed, total, earlyAbort, failed:[{id,label,script}] }
 *
 * ⚠️ 格式锚点必须与 `scripts/guardian-runner.mjs` 的 printSummary / failedGates 输出一致:
 *   `  总检查数: 134(已执行 134)`
 *   `🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:`
 *   `   · [29] 🚀 Push 同步兜底(...)`
 *   `     单独复现:node scripts/check-push-sync.mjs --staged`
 * 格式漂了必须落到 `batchReported:false`(= 未归因),**绝不**静默当成"没有失败门"。
 */
export function parseGateSummary(text) {
  const clean = stripAnsi(text)
  const totalM = /总检查数:\s*(\d+)\s*[（(](?:已执行\s*(\d+))?/.exec(clean)
  const executed = totalM ? Number(totalM[2] ?? totalM[1]) : null
  const total = totalM ? Number(totalM[1]) : null
  const earlyAbort = /←\s*提前中止/.test(clean)
  const failed = []
  const seen = new Set()
  for (const m of clean.matchAll(
    /·\s*\[([^\]]+)\]\s*([^\n]*)\n\s*单独复现:node\s+scripts\/(\S+)/g,
  )) {
    const id = m[1].trim()
    // 去重:真实钩子日志是多轮追加的(取样时同一道门出现 4 次),不去重就会把该门复跑 N 遍,
    // 明细里全是重复行。单次调用的输出本不含重复,这一条是防御性的。
    if (seen.has(id)) continue
    seen.add(id)
    failed.push({ id, label: m[2].trim(), script: m[3].trim() })
  }
  const batchReported = totalM !== null || /道\s*blocking\s*门失败/.test(clean)
  return { batchReported, executed, total, earlyAbort, failed }
}

/** 一句提示:钩子常把汇总只写进日志文件,stdout 里根本没有 —— 那是本判据的第二输入源 */
const SUMMARY_HEAD_RE = /🛡️\s*守门脚本批量检查汇总/g

/**
 * 从一整段日志(多轮追加)里取**最后一轮**的汇总文本。
 *
 * 为什么需要它:实测 2026-09-25 那次 --no-verify,`hookOutput` 里只有到 `[30a]` 为止的进度行,
 * 真正的汇总块(134 项跑完 / 3 道红:30c 71 84)只落在 `.workbuddy/hook-logs/pre-commit.log`。
 * 没有这一层,归因在真仓里的实际命中率是"永远未归因"。
 *
 * 只认最后一轮,并要求这一轮里**出现过本次声明的任一文件名** —— 否则可能拿着
 * 上一轮(别人的提交)的清单给自己归因,那是凭空造一条"不是我"的证据。
 * @param {string} logText 日志全文(调用方负责截尾,别把整份 33KB×N 喂进来)
 * @param {string[]} mustMention 本次声明的文件清单
 * @returns {{text:string|null, why:string}}
 */
export function pickLastSummaryRun(logText, mustMention) {
  const clean = stripAnsi(logText)
  const heads = [...clean.matchAll(SUMMARY_HEAD_RE)]
  if (heads.length === 0) return { text: null, why: '日志里没有任何汇总块' }
  const start = heads[heads.length - 1].index
  const seg = clean.slice(start)
  if (!/道\s*blocking\s*门失败|失败:\s*\d+/.test(seg))
    return { text: null, why: '最后一轮汇总块不完整' }
  // 回溯本轮开头:上一轮汇总之后到本轮汇总之前,应当出现过本次声明的文件
  const prevStart = heads.length > 1 ? heads[heads.length - 2].index : 0
  const window = clean.slice(prevStart, start)
  if (!(mustMention ?? []).some((f) => window.includes(f))) {
    return { text: null, why: '最后一轮汇总之前的清单未点名本次文件 ⇒ 可能是他人那一轮,不用于归因' }
  }
  return { text: seg, why: 'ok' }
}

/**
 * 归因主判据。
 * @param text        首次 commit 的 stdout+stderr(可含 ANSI)
 * @param fallbackText 可选:同一轮的钩子日志尾部(stdout 未带汇总时的第二输入源)
 * @param stagedFiles 本次声明并暂存的文件清单(仓库根相对路径)
 * @param runGate     (script) => {status:number, output:string} —— 注入式复跑,便于自测
 * @returns kind ∈ 'mine'(点名本次文件 ⇒ 拒跳) | 'not-ours'(有证据表明红不在本次内容 ⇒ 可跳)
 *          | 'unattributed'(批未跑完 / 解析不到 / 复跑不可用 ⇒ 保守可跳,但如实说未归因)
 */
export function classifyHookFailure({ text, fallbackText, stagedFiles, runGate }) {
  let parsed = parseGateSummary(text)
  let source = '钩子标准输出'
  if (parsed.failed.length === 0 && fallbackText) {
    const picked = pickLastSummaryRun(fallbackText, stagedFiles)
    if (picked.text) {
      const p2 = parseGateSummary(picked.text)
      if (p2.failed.length > 0) {
        parsed = p2
        source = '同一轮钩子日志尾部(stdout 未带汇总)'
      }
    }
  }
  const detail = [parsed.failed.length > 0 ? `失败门清单取材:${source}` : '']
  if (!parsed.batchReported || parsed.failed.length === 0) {
    return {
      kind: 'unattributed',
      ranFullBatch: false,
      failed: parsed.failed,
      detail: ['未能从钩子输出解析出守门汇总块 —— 归因未计算,不得声称"因他人代码"'],
      reason: parsed.batchReported
        ? '汇总里没列出 blocking 失败门(可能红在守门批量检查之外)'
        : '钩子未产出守门汇总(可能提前退出)',
    }
  }
  if (parsed.earlyAbort) {
    detail.push(
      `本轮提前中止(已执行 ${parsed.executed}/${parsed.total}),其后各门未跑 ⇒ 不得称"全批已跑"`,
    )
  }

  let mine = 0
  let nowPassing = 0
  let unrunnable = 0
  for (const g of parsed.failed) {
    let r = null
    try {
      r = runGate(g.script)
    } catch (e) {
      r = null
      unrunnable++
      detail.push(`[${g.id}] 复跑异常:${e?.message ?? e}`)
    }
    if (!r) continue
    if (r.status === 0) {
      nowPassing++
      detail.push(`[${g.id}] ${g.label} —— 复跑已通过(exit 0),该红不在本次内容里`)
      continue
    }
    const lines = findingLines(r.output)
    const named = stagedFiles.filter((f) => lines.some((l) => l.includes(f)))
    if (named.length > 0) {
      mine++
      detail.push(
        `[${g.id}] ${g.label} —— 复跑仍红,且**结论行**点名本次文件:${named.join(' , ')}` +
          `(取证行:${lines
            .filter((l) => named.some((f) => l.includes(f)))
            .slice(0, 2)
            .join(' ⏎ ')})`,
      )
    } else {
      const echo = stagedFiles.filter((f) => stripAnsi(r.output).includes(f))
      detail.push(
        `[${g.id}] ${g.label} —— 复跑仍红,但未点名本次任何文件` +
          (echo.length ? `(输出里出现过 ${echo.join(' , ')},但只出现在清单/回显行,不算点名)` : ''),
      )
    }
  }

  if (mine > 0) {
    return {
      kind: 'mine',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      reason: `${mine} 道失败门在复跑时点名了本次声明的文件 —— 这是本任务自己的红,必须修,禁止 --no-verify`,
    }
  }
  if (unrunnable === parsed.failed.length) {
    return {
      kind: 'unattributed',
      ranFullBatch: !parsed.earlyAbort,
      failed: parsed.failed,
      detail,
      reason: '失败门全部无法复跑,归因未计算',
    }
  }
  return {
    kind: 'not-ours',
    ranFullBatch: !parsed.earlyAbort,
    failed: parsed.failed,
    detail,
    reason:
      nowPassing === parsed.failed.length
        ? `${parsed.failed.length} 道失败门复跑后全部通过 ⇒ 红不在本次提交内容里`
        : `${parsed.failed.length} 道失败门逐道复跑后均未点名本次声明的文件 ⇒ 红不在本次提交内容里`,
  }
}

/** 给提交者看的一句话:只说量到的事,不做没做过的归因 */
export function verdictLine(v) {
  if (v.kind === 'mine') return `❌ ${v.reason}`
  if (v.kind === 'not-ours') return `✅ ${v.reason}(据此走应急跳门,守门结论以下方逐道复跑记录为准)`
  return `⚠️ ${v.reason} —— 按应急路径落地,已留痕;请勿把它读成"通过了守门"或"因他人代码"`
}

// ------------------------------------------------------------------ 自检

const SUMMARY = `
🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  通过: 111
  警告: 2
  失败: 1
  跳过: 20
`
const FAIL_29 = `
🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [29] 🚀 Push 同步兜底(防"commit 后忘记 push"复发)
     单独复现:node scripts/check-push-sync.mjs --staged
`
const MY_FILES = ['scripts/foo.mjs', 'PROJECT_PLAN.md']

/**
 * 真仓格式取样:锚点必须与 guardian-runner 的实际打印同源。
 * 这条不是"测试跑自己的夹具" —— 它从 runner 源码里把格式串抠出来,格式漂了即红,
 * 从而在 safe-commit 静默退化成"永不归因"**之前**就暴露。
 */
function formatPinnedFromRunner(assert, runnerSource) {
  assert(
    /总检查数:\s*\$\{effectiveChecks\.length\}\(已执行\s*\$\{executed\}/.test(runnerSource),
    'runner 的「总检查数」打印格式已漂移 ⇒ parseGateSummary 的锚点失效',
  )
  assert(
    /道 blocking 门失败/.test(runnerSource),
    'runner 的「N 道 blocking 门失败」打印已漂移 ⇒ 失败清单解析失效',
  )
  assert(
    /·\s*\[\$\{g\.id\}\]\s*\$\{g\.label\}/.test(runnerSource),
    'runner 的「· [id] label」失败行格式已漂移 ⇒ 逐门归因失效',
  )
  assert(
    /单独复现:node scripts\/\$\{g\.script\}/.test(runnerSource),
    'runner 的「单独复现:」行格式已漂移 ⇒ 拿不到 script ⇒ 归因整段停摆',
  )
}

export function selfTest(assert, runnerSource) {
  formatPinnedFromRunner(assert, runnerSource)

  // --- P0 阳性对照:上面那两条夹具必须真能被解析(否则后面全是空断言) ---
  const p = parseGateSummary(SUMMARY + FAIL_29)
  assert(p.batchReported === true, 'P0 夹具未被识别为"跑过守门批"')
  assert(p.failed.length === 1, `P0 应解析出 1 道失败门,实得 ${p.failed.length}`)
  assert(p.failed[0]?.id === '29', `P0 门编号应为 29,实得 ${p.failed[0]?.id}`)
  assert(
    p.failed[0]?.script === 'check-push-sync.mjs',
    `P0 script 应为 check-push-sync.mjs,实得 ${p.failed[0]?.script}`,
  )
  assert(p.earlyAbort === false, 'P0 不该把"未提前中止"读成提前中止')

  // --- P0b 去重:同一道门列两次只算一次(否则逐道复跑会重复跑,明细全是重复行) ---
  const dup = parseGateSummary(SUMMARY + FAIL_29 + FAIL_29)
  assert(dup.failed.length === 1, `P0b 重复失败行应去重为 1 道,实得 ${dup.failed.length}`)
  assert(
    parseGateSummary(SUMMARY + FAIL_29 + FAIL_29.replace('[29]', '[77]')).failed.length === 2,
    'P0b 去重不得把**不同**门吃掉',
  )

  // --- A1 实测那一轮:红的是远端态门,复跑过关 ⇒ not-ours ---
  const a1 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({
      status: 0,
      output: '⏭ 本地与 origin/main HEAD 不同但无 ahead commit(可能 behind,跳过)',
    }),
  })
  assert(a1.kind === 'not-ours', `A1 应判 not-ours,实得 ${a1.kind}`)

  // --- A2 我的内容真红 ⇒ 必须判 mine(旧版在这一型上说"他人代码") ---
  const a2 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:12 违规' }),
  })
  assert(a2.kind === 'mine', `A2 失败门点名本次文件时必须判 mine,实得 ${a2.kind}`)
  assert(/禁止 --no-verify/.test(a2.reason), 'A2 mine 的措辞必须落到"禁止跳门"')

  // --- A3 别人的内容红(未点名我的文件)⇒ not-ours,但 detail 要如实说"仍红" ---
  const a3 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ apps/web/src/other.tsx:3 类型错误' }),
  })
  assert(a3.kind === 'not-ours', `A3 应判 not-ours,实得 ${a3.kind}`)
  assert(/未点名本次任何文件/.test(a3.detail.join('\n')), 'A3 必须如实记录"该门复跑仍红"')

  // --- A4 输出带 ANSI 色码也要能点名(否则 mine 会被色码打断而漏判) ---
  const a4 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '\x1b[31m  ✗ scripts/foo.mjs:1 \x1b[0m' }),
  })
  assert(a4.kind === 'mine', `A4 ANSI 色码不得让归因失明,实得 ${a4.kind}`)

  // --- A5 解析不到汇总 ⇒ unattributed,且不得谎称 not-ours ---
  const a5 = classifyHookFailure({
    text: 'fatal: 钩子提前退出',
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a5.kind === 'unattributed', `A5 无汇总块必须判未归因,实得 ${a5.kind}`)

  // --- A6 汇总说"失败 0"而没有任何失败行 ⇒ 未归因(不能当成"已证明不是我的") ---
  const a6 = classifyHookFailure({
    text: SUMMARY,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a6.kind === 'unattributed', `A6 解析不到失败门清单时必须未归因,实得 ${a6.kind}`)
  // 归因失效的**原因也必须说对**:把"没解析到汇总"写成"复跑不可用",下一个读的人会去查
  // spawn 而不是查格式漂移 —— 本票整张票就是为了不再出现这种"结论碰巧对、解释是错的"记录。
  assert(
    /汇总里没列出|未产出守门汇总/.test(a6.reason),
    `A6b reason 须指向解析失败,实得:${a6.reason}`,
  )
  assert(a6.detail.join('\n').includes('归因未计算'), 'A6b 未归因须留明细,不得只给一个 kind 值')

  // --- A7 复跑全抛异常 ⇒ 未归因,不是 not-ours ---
  const a7 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => {
      throw new Error('spawn 失败')
    },
  })
  assert(a7.kind === 'unattributed', `A7 复跑不可用必须未归因,实得 ${a7.kind}`)

  // --- A8 提前中止(GUARDIAN_STOP_ON_FIRST)⇒ 如实标注,不称"全批已跑" ---
  const a8 = classifyHookFailure({
    text: SUMMARY.replace('(已执行 134)', '(已执行 3 ← 提前中止)') + FAIL_29,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 0, output: '' }),
  })
  assert(a8.ranFullBatch === false, 'A8 提前中止轮次不得记为"全批已跑"')
  assert(/提前中止/.test(a8.detail.join('\n')), 'A8 必须把提前中止写进明细')

  // --- A9 多门混合:一门过关、一门点名我 ⇒ 整体仍须 mine(一条证据就够定责) ---
  const a9 = classifyHookFailure({
    text:
      SUMMARY +
      FAIL_29 +
      FAIL_29.replace('[29]', '[77]').replace('check-push-sync', 'check-radius-single-source'),
    stagedFiles: MY_FILES,
    runGate: (script) =>
      script.startsWith('check-push-sync')
        ? { status: 0, output: '' }
        : { status: 1, output: 'apps/mobile-rn/x.tsx:4 scripts/foo.mjs:9 绕档' },
  })
  assert(a9.kind === 'mine', `A9 任一门点名本次文件即须判 mine,实得 ${a9.kind}`)
  assert(a9.failed.length === 2, `A9 应解析出 2 道失败门,实得 ${a9.failed.length}`)
  // --- A10 措辞层:三种 kind 各说各的话,不得互相冒充 ---
  assert(/❌/.test(verdictLine(a2)), 'A10 mine 的措辞必须是失败口吻')

  // --- A11 真实误伤回归:门回显"触发我的文件清单"不得被当成点名 ---
  // 文本取自 2026-09-25 02:22 门 35 (check-mypy) 的真实输出:它回显了本次 staged 的 Python 文件,
  // 而 mypy 真正报错的是另外两个文件。旧实现用整段 includes ⇒ 判成 mine ⇒ 拒掉了别人一次合法提交。
  const MYPY_REAL = `[mypy 守门] staged 检测到 2 个 Python 文件改动,触发 mypy 检查:
  - apps/ai-service/app/core/llm_gateway.py
  - apps/ai-service/tests/test_model_router_wiring.py

❌ mypy 守门失败(1.7s)
--- mypy 输出 ---
app\\services\\tool_input_scanner.py:32: error: Module "app.services.sandbox" has no attribute "_DANGEROUS_PATTERNS"  [attr-defined]
app\\services\\mcp_server.py:1954: error: Module "app.services.sandbox" has no attribute "sandbox_executor"  [attr-defined]
Found 2 errors in 2 files (checked 548 source files)
--- end ---`
  const a11 = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: [
      'apps/ai-service/app/core/llm_gateway.py',
      'apps/ai-service/tests/test_model_router_wiring.py',
    ],
    runGate: () => ({ status: 1, output: MYPY_REAL }),
  })
  assert(a11.kind === 'not-ours', `A11 清单回显不得判成 mine,实得 ${a11.kind}`)
  assert(
    /只出现在清单\/回显行/.test(a11.detail.join('\n')),
    'A11 必须把"为什么不算点名"写进明细,不得静默',
  )
  // 反向:若 mypy 真报在本人声明的文件上,必须立刻判 mine(本条防"修过头变成永不归责")
  const a11b = classifyHookFailure({
    text: SUMMARY + FAIL_29,
    stagedFiles: ['apps/ai-service/app/core/llm_gateway.py'],
    runGate: () => ({
      status: 1,
      output:
        'apps/ai-service/app/core/llm_gateway.py:88: error: Missing type annotation  [no-any-return]',
    }),
  })
  assert(a11b.kind === 'mine', `A11b 真报在本人文件上时必须仍判 mine,实得 ${a11b.kind}`)

  // --- B1 第二输入源:stdout 没有汇总(实测真仓就是这样),必须从同一轮日志尾部取到 ---
  // 真实日志的顺序是「上一轮汇总 … 本轮 staged 清单 … 本轮汇总」,清单夹在两轮之间。
  const ROUND_PREV = `🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  失败: 1
🚫 1 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [57] 上一轮别人的门
     单独复现:node scripts/check-chat-element-coverage.mjs --staged
`
  const ROUND_MINE = `🛡️ 守门脚本批量检查汇总
  总检查数: 134(已执行 134)
  失败: 3
🚫 3 道 blocking 门失败 —— 本轮已跑完全部 134 项,未提前中止:
   · [30c] 陈旧副本守门
     单独复现:node scripts/check-stale-copy.mjs --staged
   · [71] 计划登记行防丢
     单独复现:node scripts/check-plan-line-loss.mjs --staged
   · [84] 反回退守门
     单独复现:node scripts/check-stale-revert.mjs --staged
`
  const b1 = classifyHookFailure({
    // stdout 停在半路(真仓实测形态):只有进度行,没有汇总
    text: '[30a] 🛡️ Commit 丢失防护…\n(完整日志: .workbuddy/hook-logs/pre-commit.log)',
    fallbackText: `${ROUND_PREV}\nstaged 文件清单:\n - scripts/foo.mjs\n - PROJECT_PLAN.md\n${ROUND_MINE}`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '别的文件 red' }),
  })
  assert(b1.kind === 'not-ours', `B1 应经日志尾部完成归因,实得 ${b1.kind}`)
  assert(b1.failed.length === 3, `B1 应取到最后一轮的 3 道门,实得 ${b1.failed.length}`)
  assert(/日志尾部/.test(b1.detail.join('\n')), 'B1 必须写明清单取材自日志尾部,不得伪装成 stdout')

  // --- B2 不得拿"上一轮(别人)"的清单给自己归因 ---
  const b2 = classifyHookFailure({
    text: '没有汇总块',
    // 本轮清单里完全没提本次声明的文件 ⇒ 只能算别人的那一轮
    fallbackText: `${ROUND_MINE}\nstaged 文件清单:\n - apps/other/theirs.ts\n`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: 'x' }),
  })
  assert(b2.kind === 'unattributed', `B2 清单未点名本次文件时必须拒绝使用该轮,实得 ${b2.kind}`)

  // --- B3 同一轮里点名我 ⇒ 仍须 mine(第二输入源不得把责任洗掉) ---
  const b3 = classifyHookFailure({
    text: '',
    fallbackText: `清单:\n - scripts/foo.mjs\n${ROUND_MINE}`,
    stagedFiles: MY_FILES,
    runGate: () => ({ status: 1, output: '  ✗ scripts/foo.mjs:3 历史版本回写' }),
  })
  assert(b3.kind === 'mine', `B3 通过日志归因后仍须能定责,实得 ${b3.kind}`)
  // 未归因必须自带"不许当成过门"的警示(整句含该词是合法的,故判前缀与警示词,不判子串)
  const unattr = verdictLine(a5)
  assert(/^\s*⚠️/.test(unattr), `A10 未归因必须以警示口吻开头,实得:${unattr}`)
  assert(/请勿/.test(unattr), 'A10 未归因必须自带"不得当成已通过"的警示')
  assert(/复跑/.test(verdictLine(a1)), 'A10 not-ours 必须把结论指向复跑记录,而不是任何"过门"式断言')
  return { parsedFixture: p }
}

/** §22c 约定:核心判据一律经 __test__ 暴露,镜像测试直接 import,不再抄第二份实现 */
export const __test__ = {
  stripAnsi,
  findingLines,
  parseGateSummary,
  pickLastSummaryRun,
  classifyHookFailure,
  verdictLine,
  SUMMARY,
  FAIL_29,
  MY_FILES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
