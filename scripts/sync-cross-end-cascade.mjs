#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-cross-end-cascade.mjs — 跨端对齐「一键级联」编排器(只读预演默认,--apply 才写)
 *
 * 立因(2026-11-01 机主令:"rn 端应自动同步 web 端样式与功能,小程序对齐 rn,并且全部自动化、
 * 最大化减少开发"):链条各腿(派生写回 / 三端落档 / 镜像声明 / 门户登记 / 造页 / dist 重建)
 * 都已挂在 git-guardian 的巡检轮里按节律自跑,但**没有一条把整条链按依赖序一次跑完的按需入口** ——
 * 改完一笔 web 要么等 30-60 分钟节拍,要么逐条手敲七八个命令(漏一条 = 下游对账拿到旧面假分叉)。
 * 本器物只做一件事:**按依赖序派发既有器物**,让"等节拍"变成"敲一发"。
 *
 * 铁律(§0.6 单一真相源 / §22c 禁复算判据):
 *   ① 本层**零判据** —— 不读 token、不数分叉、不建基线;每段 argv 指向既有器物,
 *      旗标形态取自 git-guardian 各腿的派发点与器物自身头注(2026-11-01 逐枚实测)。
 *   ② 顺序即契约:非色档生成(TS 档表 → tokens.css 受管块)→ 派生同源 → RN 色档入表 →
 *      三端落档(web→RN→小程序)→ 声明链 → 门户收敛 → 造页 → 手写页转化 → dist 重建 ——
 *      与 guardian 主轮次同序;下游判据要问的是上游写没写,倒过来只会拿到中间态。
 *   ③ 三态如实(§0.3):器物不在位 / 跑前炸(用法错、超时、非 JSON)⇒ 该段 `unjudged`,
 *      **不记绿也不冒红**;verify 段 rc≠0 是"该维真有分叉"⇒ 如实报 `red`,不许洗白。
 *      整体退出码:全绿 0 / 任一段 red 或 failed 1 / 任一段 unjudged 2。"没判过"永不冒充"判过"。
 *   ④ 默认只读:写盘段在缺省档标 `skipped(dry)`(与 land-* 器物自身"默认预演"同一哲学);
 *      要落盘显式 --apply。--dry-run 与 --apply 同时给 ⇒ exit 2 用法错(与守门横向口径同一条)。
 *   ⑤ 派生进程纪律(§12g):execFileSync 一律显式 stdio + windowsHide,不 shell:true。
 *
 * 用法:
 *   node scripts/sync-cross-end-cascade.mjs                 # 只读预演(写盘段跳过,verify 段照跑)
 *   node scripts/sync-cross-end-cascade.mjs --apply         # 全链落盘(web→RN→小程序 一键跟随)
 *   node scripts/sync-cross-end-cascade.mjs --only=verify-ui-parity  # 按段 id 只跑指定段(见 STAGES)
 *   node scripts/sync-cross-end-cascade.mjs --only=converge,verify   # 亦可按段类过滤
 *   node scripts/sync-cross-end-cascade.mjs --json          # 机器可读结论(驾驶舱/CI 可消费)
 *   node scripts/sync-cross-end-cascade.mjs --self-test     # 判序自检(零副作用,不落盘不派子进程)
 *
 * 段类(kind):derive | land | declare | converge | create | convert | rebuild | verify
 * 应急:单段跑挂想续跑其余 ⇒ --skip=<name1,name2>(点名跳过并在结论里如实标注,不静默)。
 */
/* eslint-disable no-console -- CLI 编排器,预演/落盘结论需人读 stdout(与 land-*-style-tiers 同型) */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/**
 * 链条定义 —— 唯一真相在器物本体,这里只是"谁先谁后 + 用哪枚旗标"的编排。
 * base = 预演档 argv(可被只读消费);apply = 追加旗标(缺省档写盘段整段跳过)。
 */
const STAGES = [
  {
    // 2026-11-01 由 verify 档就地升级为写腿:本器物 --check 与 --write 互斥(同给 exit 2),
    // 故 base 留空、apply 档追加 --write(不带 --apply 时写腿整段跳过,缺省只读的 --check 校验
    // 由压轴 verify-cross-end-tokens 腿承载 —— 门 93 的 R9–R11 判据 import 本器物同一实现)。
    // 必须排在 derive-tokens 之前:heal-derived-in-checkout 的 tokens 族是拿 tokens.css
    // 受管块当源往下派生(小程序/RN/extension 各副本),本腿不落盘它派生的就是旧面。
    name: 'verify-css-tokens',
    kind: 'derive',
    desc: '非色档受管块生成:tokens.css 受管块 ← TS 档表(SPACING_STEPS/TYPE_STEPS/ELEVATION_CSS,门 93 R9-R11 同源判据的写档)',
    script: 'sync-css-tokens.mjs',
    base: [],
    apply: ['--write'],
    write: true,
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'derive-tokens',
    kind: 'derive',
    desc: '样式派生面写回(tokens 族:小程序/RN/extension 各受管块 ← tokens.css 单源)',
    script: 'heal-derived-in-checkout.mjs',
    base: ['--family', 'tokens', '--json'],
    write: true,
    timeoutMs: 30 * 60 * 1000,
  },
  {
    // 2026-11-04 补链:这一腿是「小程序对齐 RN」里**唯一能机械做对**的那一半 ——
    // spec 绑定块(import + 映射声明)由 RN 壳单方持有、逐字派生到小程序壳。
    // 此前它只有人肉入口,于是"改完 RN 壳忘了镜像映射"只能等 check-ui-spec-mirror 在提交链上抓,
    // 抓到时已经是两处不一致的现场。器物自带归属闸(他席在飞的壳文件 held 不写),
    // 所以挂进级联不会覆盖任何人的未提交工作(失效方向恒为"少写一次")。
    name: 'mirror-spec-blocks',
    kind: 'derive',
    desc: '小程序 spec 绑定块 ← RN 壳派生(gen-ui-mirror;只写 import 与映射声明,不改 JSX 体)',
    script: 'gen-ui-mirror.mjs',
    base: [],
    apply: ['--apply'],
    write: true,
    timeoutMs: 10 * 60 * 1000,
    note: '归属闸:脏集里的壳一律 held 不写;landing 账本命中则本轮 skipLanded(幂等)',
  },
  {
    name: 'rn-token-pairs',
    kind: 'derive',
    desc: 'RN 色档同源入表(色值档补进跨端映射)',
    script: 'plan-rn-token-pairing.mjs',
    base: [],
    apply: ['--apply'],
    write: true,
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'land-web',
    kind: 'land',
    // 2026-11-04:此处原为 apply: ['--apply'](**不带字重锁**)。具名档是三元组(size/line-height/
    // font-weight),裸 --apply 会把无 font-* 伴随的 text-xl→text-heading 从 400 顶到 700(落档器
    // 头注的编译取证反例)= 静默改全站字重;且与守护恒带 --only-weight-locked 的口径分叉,
    // 一键链与自愈腿会互相打架。现与守护逐字同口径:锁档 + 补 font-[weight:inherit] 后
    // 仍是可证零变化,再叠 --limit 20 小批落盘(落点账本 skipLanded 逐轮续跑)。
    desc: 'web 端非色档落档自愈(锁字重 + 继承钉,与守护同口径)',
    script: 'land-web-style-tiers.mjs',
    base: [],
    apply: ['--apply', '--only-weight-locked', '--pin-inherit-weight', '--limit', '20'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'land-rn',
    kind: 'land',
    desc: 'RN 端非色档落档自愈',
    script: 'land-rn-style-tiers.mjs',
    base: [],
    apply: ['--apply'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'land-miniapp',
    kind: 'land',
    desc: '小程序端非色档落档自愈',
    script: 'land-miniapp-style-tiers.mjs',
    base: [],
    apply: ['--apply'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'mirror-declare',
    kind: 'declare',
    desc: 'RN→小程序镜像声明链补洞',
    script: 'repair-cross-end-mirror.mjs',
    base: ['--json'],
    apply: ['--apply'],
    write: true,
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'portal-converge',
    kind: 'converge',
    desc: 'web→RN 门户判定收敛(可自动登记面)',
    script: 'auto-register-cross-end.mjs',
    base: ['--converge-portal', '--converge-render', '--only=portal'],
    apply: ['--apply'],
    write: true,
    timeoutMs: 15 * 60 * 1000,
  },
  {
    name: 'shell-pages',
    kind: 'create',
    desc: 'RN 缺失宿主屏补壳',
    script: 'gen-rn-shell-types.mjs',
    base: ['--all', '--write'],
    write: true,
    timeoutMs: 15 * 60 * 1000,
    note: '器物自身 --write 即落档档形,预演档跳过',
  },
  {
    name: 'rn-host-shell',
    kind: 'create',
    desc: '共享屏→RN 宿主薄壳生成(仅 seedable 落盘;needs-manual 只点名)',
    script: 'gen-rn-host-shell.mjs',
    base: ['--all', '--cap=5'],
    apply: ['--write'],
    write: true,
    timeoutMs: 15 * 60 * 1000,
    note: '--cap=5 逐批推进;落盘后由 check-rn-host-shell-coverage 判「至少一枚 RN 壳直接 import」',
  },
  {
    name: 'miniapp-pages',
    kind: 'create',
    desc: '小程序缺页造页闭环',
    script: 'land-cross-end-shell-pages.mjs',
    base: ['--json'],
    apply: ['--apply'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'hand-mirror',
    kind: 'convert',
    desc: '手写小程序页→托管镜像转化',
    script: 'upgrade-miniapp-shell-pages.mjs',
    base: ['--json'],
    apply: ['--land'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'rebuild-dist',
    kind: 'rebuild',
    desc: 'workspace dist 落后重建(消费方读 dist 不读 src)',
    script: 'heal-stale-dist.mjs',
    base: ['--json'],
    apply: ['--apply'],
    write: true,
    timeoutMs: 20 * 60 * 1000,
  },
  {
    name: 'verify-miniapp-tokens',
    kind: 'verify',
    desc: '校验:小程序 token 受管三面同步(门 36)',
    script: 'check-miniapp-tokens-sync.mjs',
    base: [],
    redOnFail: true,
    redName: 'miniapp-tokens',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-cross-end-tokens',
    kind: 'verify',
    desc: '校验:三端品牌色同源对账(门 93)',
    script: 'check-cross-end-tokens.mjs',
    base: ['--quiet'],
    redOnFail: true,
    redName: 'cross-end-tokens',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-ui-parity',
    kind: 'verify',
    desc: '校验:小程序↔RN 同脸 + web 腿(门 128)',
    script: 'check-cross-end-ui-parity.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'ui-parity',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-screen-coverage',
    kind: 'verify',
    desc: '校验:共享屏→小程序镜像覆盖(门 237)',
    script: 'check-cross-end-screen-coverage.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'screen-coverage',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-style-tiers',
    kind: 'verify',
    desc: '校验:三端非色档裸数字分叉尺',
    script: 'check-web-rn-style-tiers.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'style-tiers',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    // 2026-11-04 补链(功能维):原 verify 段只判样式(几何/圆角/镜像还原度),
    // 「web 有这屏、RN 有没有对应屏」「两端同名组件的 props 差哪些」「同屏文案是否同措辞」
    // 三格全在链外 —— 于是"样式全绿"很容易被读成"功能也对齐了"。
    // 三枚器物都是既有守门/报告器的同源件,本层零判据、只派发与如实分档。
    name: 'verify-web-rn-screens',
    kind: 'verify',
    desc: '校验:web 路由 ↔ RN 屏承载 + 侧栏入口可达性(功能维,报告器档)',
    script: 'check-web-rn-screen-parity.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'web-rn-screens',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-props-parity',
    kind: 'verify',
    desc: '校验:两端同名组件 props 对账(门 285 同源器物)',
    script: 'check-cross-end-component-props-parity.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'props-parity',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-copy-parity',
    kind: 'verify',
    desc: '校验:同屏 web↔RN 措辞一致性(门 291 同源器物;B2 同值异键只出 advisory)',
    script: 'check-web-rn-copy-parity.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'copy-parity',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-fidelity',
    kind: 'verify',
    desc: '校验:小程序镜像还原度(文案键未覆盖面)',
    script: 'check-miniapp-mirror-fidelity.mjs',
    base: ['--json'],
    redOnFail: true,
    redName: 'fidelity',
    timeoutMs: 10 * 60 * 1000,
  },
  {
    name: 'verify-i18n-parity',
    kind: 'verify',
    desc: '校验:i18n 五语言键集 parity',
    script: 'check-i18n-keys.mjs',
    base: [],
    redOnFail: true,
    redName: 'i18n-parity',
    timeoutMs: 10 * 60 * 1000,
  },
]

const KINDS = [...new Set(STAGES.map((s) => s.kind))]
/** 段 id 唯一真相:--only 的白名单与报错清单都必须从这里取,不得另抄一份字面量。 */
const STAGE_IDS = STAGES.map((s) => s.name)

/** 三档旗标解析;非法形态返回 {usageError}(失效方向 = 多要一次定向说明,不是多放一次跳门) */
export function parseArgs(argv) {
  const opts = {
    apply: false,
    dryRun: false,
    json: false,
    selfTest: false,
    only: null,
    skip: new Set(),
    usageError: null,
  }
  for (const a of argv) {
    if (a === '--apply') opts.apply = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a.startsWith('--only=')) opts.only = a.slice(7).split(',').filter(Boolean)
    else if (a.startsWith('--skip=')) opts.skip = new Set(a.slice(7).split(',').filter(Boolean))
    else
      opts.usageError = `未知旗标:${a}(可用 --apply/--dry-run/--only=<stageId|kind>/--skip=<name>/--json/--self-test)`
  }
  if (opts.apply && opts.dryRun) opts.usageError = '--apply 与 --dry-run 互斥,两面旗同给当场拒绝'
  if (opts.usageError) return opts
  // --only 令牌既认段 id 也认段类(混给亦可;全不命中 ⇒ usageError,防"打错字静默空跑")
  if (opts.only !== null) {
    if (opts.only.length === 0)
      return {
        ...opts,
        usageError: `--only= 后没有段 id ⇒ 未执行任何段(可用 stageId=${STAGE_IDS.join('/')})`,
      }
    const hit = opts.only.filter((t) => STAGE_IDS.includes(t) || KINDS.includes(t))
    if (hit.length !== opts.only.length) {
      const bad = opts.only.filter((t) => !hit.includes(t))
      return {
        ...opts,
        usageError: `--only 含未知令牌:${bad.join(',')} ⇒ 未执行任何段(可用 stageId=${STAGE_IDS.join('/')};段类=${KINDS.join('/')})`,
      }
    }
  }
  return opts
}

export function selectStages(stages, opts) {
  if (!opts.only) return stages
  const set = new Set(opts.only)
  return stages.filter((s) => set.has(s.kind) || set.has(s.name))
}

/**
 * 写盘段的档位裁决(dry 缺省跳写;--skip 点名跳)。返回 null=执行,或 {state,detail}=不执行。
 */
export function stageDisposition(stage, opts) {
  if (opts.skip.has(stage.name))
    return { state: 'skipped', detail: '--skip 点名跳过(如实标注,不静默)' }
  if (stage.write && !opts.apply)
    return { state: 'skipped', detail: '写盘段·缺省只读(要落盘给 --apply)' }
  return null
}

/**
 * 单段三态裁决(§0.3):绿 done / 分红 red(仅 verify 段 rc≠0)/ 其余一律 unjudged。
 * 器物跑了但 rc≠0 且不是 verify 段 ⇒ failed(器物自身写盘失败,是真败不是未判)。
 */
export function classifyStage(stage, { ran, rc, spawnable }) {
  if (!ran) return 'skipped'
  if (!spawnable) return 'unjudged' // 不在位/起不动/超时 ⇒ 这一维没判完,不冒充绿也不冒红
  if (rc === 0) return 'done'
  if (stage.redOnFail) return 'red'
  return 'failed'
}

/** 整体退出码:unjudged 优先顶 2?"red/failed" 顶 1?—— red 是真信号必须能拦住人,故 red>unjudged 序:1 与 2 并存取 2? */
export function chainExit(states) {
  if (states.includes('red') || states.includes('failed')) return 1
  if (states.includes('unjudged')) return 2
  return 0
}

/**
 * 单段 argv 装配(唯一实现,runStage 与镜像测试同走这一格,§22c 禁测试复算):
 * base 恒带;写腿在 --apply 档追加 apply 旗(缺省档写腿整段被 stageDisposition 跳过,走不到这里)。
 */
export function stageArgv(stage, opts) {
  return [...stage.base, ...(stage.write && opts.apply ? (stage.apply ?? []) : [])]
}

function runStage(stage, opts, logger) {
  const disp = stageDisposition(stage, opts)
  if (disp) {
    logger(`⏭️ ${stage.name} —— ${disp.detail}`)
    return { name: stage.name, kind: stage.kind, state: 'skipped', detail: disp.detail }
  }
  const script = join(HERE, stage.script)
  if (!existsSync(script)) {
    logger(`❓ ${stage.name} —— 器物不在位(scripts/${stage.script})⇒ 本段未判定`)
    return { name: stage.name, kind: stage.kind, state: 'unjudged', detail: '器物不在位' }
  }
  const argv = stageArgv(stage, opts)
  try {
    const out = execFileSync(process.execPath, [script, ...argv], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true, // §5b 派生进程纪律
      timeout: stage.timeoutMs ?? 10 * 60 * 1000,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g 显式接管 stdio
    })
    const tail = summarize(out)
    logger(`✅ ${stage.name} —— ${tail}`)
    return { name: stage.name, kind: stage.kind, state: 'done', detail: tail }
  } catch (e) {
    const rc = typeof e?.status === 'number' ? e.status : null
    const state = classifyStage(stage, { ran: true, rc, spawnable: rc !== null })
    const out = String(e?.stdout ?? '')
    const errText = String(e?.stderr ?? e?.message ?? '')
      .trim()
      .split('\n')
      .slice(-2)
      .join(' / ')
    const detail =
      state === 'red'
        ? `尺子判红:${redReason(out, errText)}`
        : state === 'failed'
          ? `器物失败 rc=${rc}:${errText}`
          : `未能判定:${errText.slice(0, 160)}`
    logger(
      `${state === 'red' ? '🔴' : state === 'failed' ? '❌' : '❓'} ${stage.name} —— ${detail}`,
    )
    return { name: stage.name, kind: stage.kind, state, detail, rc }
  }
}

/**
 * 结论摘要:优先取"有判据身份的末行"(state=/RESULT/verdict/结论/判定/✅/❌/ℹ️),
 * 多行 JSON 整块收成一行(取 verdict/state 族键优先)——旧版拿末行,JSON 的收尾 "}"
 * 被当成结论(读数失真,2026-11-01 实测即此型)。太长截断;空输出如实"无输出"。
 */
const VERDICT_HINT =
  /(state=|STATE\s|RESULT|verdict|VERDICT|结论|判定|✅|❌|⚠|❓|🔴|无变化|clean|regressed|undetermined)/
export function summarize(stdoutText) {
  const lines = String(stdoutText ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return '无输出'
  for (let i = lines.length - 1; i >= 0; i--) {
    if (VERDICT_HINT.test(lines[i])) return clip(lines[i])
  }
  // 整段像 JSON({}/[] 开头收尾)⇒ 收成一行,判据键优先
  const joined = lines.join('')
  if (/^[{[]/.test(lines[0]) && /[}\]]$/.test(lines.at(-1))) {
    try {
      const obj = JSON.parse(joined)
      const pick = obj?.verdict ?? obj?.state ?? obj?.summary ?? obj
      return clip(typeof pick === 'string' ? pick : JSON.stringify(pick))
    } catch {
      return clip(joined.replace(/\s+/g, ' '))
    }
  }
  return clip(lines.at(-1))
}
function clip(s) {
  return s.length > 220 ? `${s.slice(0, 220)}…` : s
}

/**
 * 判红理由的可读性(2026-11-04 立,实测型):
 * 有器物把结论写 **stderr**、stdout 留空(门 285 现读即此型)。旧式 `summarize(out) || errText`
 * 里 summarize 对空串返回的是字面量「无输出」——非空字符串,`||` 因此**永远短路**,
 * 真实红因被"无输出"顶掉。这不是措辞问题:级联的全部价值就是让人一眼看见哪一维真分叉,
 * 显示"无输出"等于把"没判"与"判红"折成同一行(§0.3 禁止的形态)。
 */
export function redReason(rawOut, errText) {
  const out = String(rawOut ?? '')
  const err = String(errText ?? '').trim()
  if (out.trim().length > 0) return summarize(out)
  return err || '无输出(器物流程既未写 stdout 也未写 stderr)'
}

/** 自检:判序零副作用 —— 不 spawn、不落盘,只用夹具验三态裁决与旗标闸(§0.9 造好没装车=没有) */
async function selfTestRun() {
  const { test } = await import('node:test')
  const assert = (await import('node:assert/strict')).default
  const W = (over = {}) => ({ name: 'w', kind: 'land', write: true, ...over })
  const V = (over = {}) => ({ name: 'v', kind: 'verify', write: false, redOnFail: true, ...over })
  await test('S1 缺省档:写盘段跳过、verify 段执行(真段 apply 腿只预演)', () => {
    const o = parseArgs([])
    assert.equal(stageDisposition(W(), o).state, 'skipped')
    assert.equal(stageDisposition(V(), o), null)
    // 用真链条上的 apply 腿再锁一次:缺省档不得装配写旗,也不得真派发
    const css = STAGES.find((s) => s.name === 'verify-css-tokens')
    assert.ok(css?.write && css.apply?.length, 'verify-css-tokens 的 apply 腿登记缺失')
    assert.equal(stageDisposition(css, o).state, 'skipped')
    assert.deepEqual(stageArgv(css, o), [])
    assert.deepEqual(stageArgv(css, parseArgs(['--apply'])), ['--write'])
  })
  await test('S2 --apply:写盘段放行', () => {
    const o = parseArgs(['--apply'])
    assert.equal(stageDisposition(W(), o), null)
  })
  await test('S3 两面旗同给当场拒绝', () => {
    assert.match(parseArgs(['--apply', '--dry-run']).usageError, /互斥/)
    assert.match(parseArgs(['--nope']).usageError, /未知旗标/)
  })
  await test(`S4 --only=<stageId> 对全部 ${STAGES.length} 段严格只跑指定段`, () => {
    // 原断言把段数写成字面量 20 ⇒ 2026-11-04 实测现值 21(写腿 15 + 校验 7)时自检自身先炸,
    // 而它炸的形态与"选择器失效"完全同形,等于让判序自证长期不可信。
    // 改为从 STAGES 派生 + 下限守卫:段被误删会撞下限,新增段则天然被下面的循环全覆盖。
    assert.ok(STAGES.length >= 20, `段数坍缩到 ${STAGES.length} ⇒ 链条被误删,自检拒绝通过`)
    for (const s of STAGES) {
      const sel = selectStages(STAGES, parseArgs([`--only=${s.name}`]))
      assert.deepEqual(
        sel.map((x) => x.name),
        [s.name],
        `--only=${s.name} 必须恰好命中该段(多带/漏带都算选择器失效)`,
      )
    }
  })
  await test('S5 --only 认段类但不会扩成全部段;打错字/空值当场 exit 2 并列可用 id', () => {
    assert.equal(parseArgs(['--only=verify']).usageError, null)
    const land = selectStages(STAGES, parseArgs(['--only=land']))
    assert.equal(land.length, 3, '--only=land 应只命中三条 land 段')
    assert.ok(land.every((s) => s.kind === 'land'))
    const bad = parseArgs(['--only=reconcile']).usageError
    assert.match(bad, /未知令牌/)
    assert.match(bad, /可用 stageId=/)
    assert.match(bad, /portal-converge/, '报错必须列出可用段 id,不能只报段类')
    assert.match(parseArgs(['--only=']).usageError, /没有段 id/)
    assert.equal(
      selectStages(STAGES, parseArgs(['--only=verify', '--skip=fidelity'])).some(
        (s) => s.name === 'fidelity',
      ),
      false,
    )
  })
  await test('S6 三态裁决:verify rc=1⇒red / 非verify rc=1⇒failed / 起不动⇒unjudged', () => {
    assert.equal(classifyStage(V(), { ran: true, rc: 1, spawnable: true }), 'red')
    assert.equal(classifyStage(W(), { ran: true, rc: 1, spawnable: true }), 'failed')
    assert.equal(classifyStage(V(), { ran: true, rc: null, spawnable: false }), 'unjudged')
    assert.equal(classifyStage(W(), { ran: false, rc: null, spawnable: false }), 'skipped')
  })
  await test('S7 退出码:red 与 unjudged 并存取 1(真信号优先顶红)', () => {
    assert.equal(chainExit(['done', 'skipped']), 0)
    assert.equal(chainExit(['done', 'unjudged']), 2)
    assert.equal(chainExit(['unjudged', 'failed']), 1)
    assert.equal(chainExit(['unjudged', 'red']), 1)
  })
  await test('S8 链条顺序不变量:派生在前、重建随后、校验压轴(倒序即拿到中间态)', () => {
    const kinds = STAGES.map((s) => s.kind)
    assert.ok(kinds.indexOf('derive') < kinds.indexOf('land'))
    assert.ok(kinds.lastIndexOf('land') < kinds.indexOf('rebuild'))
    assert.ok(kinds.join('').endsWith('verify'.split('').join('')))
    assert.ok(kinds.at(-1) === 'verify' && kinds.at(0) === 'derive')
  })
  await test('S9 器物在位锁:每段脚本都真实存在,段 id 唯一且不与段类撞名', () => {
    assert.equal(
      new Set(STAGE_IDS).size,
      STAGE_IDS.length,
      '段 id 出现重复 ⇒ --only 选择器无法严格命中',
    )
    assert.ok(!KINDS.includes('reconcile'), '段类里出现 reconcile ⇒ 段注/选择器需重新对齐')
    for (const s of STAGES) {
      assert.ok(existsSync(join(HERE, s.script)), `${s.script} 不在位`)
      assert.ok(!KINDS.includes(s.name), `段 id ${s.name} 与段类同名 ⇒ --only 选择器歧义`)
    }
  })
  await test('S10 判红理由:stdout 空时必须落到 stderr,"无输出"不得盖掉真红因', () => {
    // 门 285 现读就是这型:结论打 stderr、stdout 空。旧式 `summarize(out) || errText` 恒短路。
    assert.match(redReason('', '❌ 映射表体检失败 3 处:证据行漂移'), /映射表体检失败 3 处/)
    assert.match(redReason('   \n ', '❌ 真的红因'), /真的红因/)
    // stdout 有读数时仍优先读数,不被 stderr 噪声抢走
    assert.match(redReason('noise\n结论:state=clean', 'warn: something'), /state=clean/)
    assert.match(redReason('', ''), /未写 stdout/)
  })
  console.log('✅ self-test 10 例全绿')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const results = []
  const print = opts.json ? () => {} : (...a) => console.log(...a)
  if (opts.usageError) {
    console.error(`❌ 用法错:${opts.usageError}`)
    process.exit(2)
  }
  if (opts.selfTest) {
    await selfTestRun()
    return
  }
  print(`▶ 跨端级联(web→RN→小程序)face=${opts.apply ? '写盘' : '只读预演'} 段数=${STAGES.length}`)
  for (const stage of selectStages(STAGES, opts)) {
    results.push(runStage(stage, opts, print))
  }
  const states = results.map((r) => r.state)
  const counts = states.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {})
  const code = chainExit(states)
  const verdictLine = `级联结论 done=${counts.done ?? 0} red=${counts.red ?? 0} failed=${counts.failed ?? 0} unjudged=${counts.unjudged ?? 0} skipped=${counts.skipped ?? 0}`
  if (opts.json) {
    console.log(
      JSON.stringify(
        { apply: opts.apply, stages: results, counts, exit: code, verdict: verdictLine },
        null,
        null,
      ),
    )
  } else {
    console.log(`${code === 0 ? '✅' : code === 1 ? '🔴' : '❓'} ${verdictLine}`)
    for (const r of results)
      if (r.state === 'red' || r.state === 'failed' || r.state === 'unjudged')
        console.log(`   · ${r.name}[${r.state}] ${r.detail}`)
  }
  process.exit(code)
}

// ─── 判序自证(§22d 双形态入口)────────────────────────────────
export const __test__ = {
  STAGES,
  KINDS,
  STAGE_IDS,
  parseArgs,
  selectStages,
  stageArgv,
  stageDisposition,
  classifyStage,
  chainExit,
  summarize,
  redReason,
  selfTestRun,
}

// 顶层守卫:被 import 时不触发主流程
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
