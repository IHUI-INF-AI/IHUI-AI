#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-cross-end-tokens.mjs - Guard: RN color tokens (rn-tokens.ts) vs
 * miniapp/web color tokens (design-tokens/tokens.css) drift for
 * semantically-identical pairs.
 *
 * 两端唯一定义处:
 *   RN:        packages/design-tokens/src/rn-tokens.ts (rnTokens/rnLightTokens/rnDarkTokens, HEX)
 *   miniapp/web: packages/design-tokens/src/styles/tokens.css (@theme+:root 亮色 / .dark 暗色)
 *
 * 映射表只收"确定语义相同"的色值对(宁缺毋滥),每条注明取值依据。
 * 任何映射对值不一致 → ❌ + exit 1(阻塞),防止跨端颜色漂移。
 *
 * 比对规则:比对前归一为统一格式 —— HEX 原样保留(小写+去空白);
 * hsl(h s% l%) / hsl(h, s%, l%) 转换为 #rrggbb 后比对;rgba/hsla 保持原样不转换
 * (rn rgba(78,163,245,0.15) 与 css rgba(78, 163, 245, 0.15) 视为相等)。
 * tokens.css .dark 未覆盖的变量按 CSS cascade 回退到亮色值参与暗色比对。
 *
 * Usage:
 *   node scripts/check-cross-end-tokens.mjs           # full check
 *   node scripts/check-cross-end-tokens.mjs --list    # print mapping table only
 *   node scripts/check-cross-end-tokens.mjs --quiet   # errors only
 *   node scripts/check-cross-end-tokens.mjs --self-test  # 三条判据的正反例取证
 *
 * 除"已声明映射逐位对账"外,还有若干条**反自立门户 / 反手抄**判据(现行清单 = R2…R8,以代码为准,
 * 不在注释里数条数 —— 数一次就会过期一次):
 *   R2 品牌键覆盖 —— rn-tokens 的 `brand` 命名空间里每个键,必须要么被某条已声明映射覆盖,
 *      要么在 RN_ONLY_BRAND_KEYS 里写明"web 无对应变量"的理由;豁免项若已不存在同样算红(防清单腐烂)。
 *   R3 悬空引用 —— 全仓任何 `tokens.brand.<key>` / `tk.brand.<key>` 形态的引用必须命中已声明键集合
 *      (只认 token 袋前缀:业务代码里局部变量也叫 brand 的不少,裸 `brand.x` 会满天假红)。
 *   R4 基础档覆盖面(2026-09-24 补,起因见下)—— 不靠手工映射表:把 rn-tokens 三张表的**每个颜色叶子**
 *      按确定规则推导同名 CSS 变量(`<ns>.<key>` → `--color-<kebab(ns)>-<kebab(key)>`,DEFAULT 折叠为父名),
 *      推得到就必须等值;确有语义分歧的要写进 BASE_CONFLICTS 并给理由,清单里写了而实际已不冲突 = 红(防腐烂),
 *      推不到同名变量的一律不判(不猜语义)。
 *   R5 端内两表自洽 —— `rnTokens`(遗留基表)与 `rnLightTokens` 同路径必须同值。同一文件内两张表各说各话
 *      时,`packages/app` 导出的 `tokens` 就是基表 ⇒ 288 个调用点吃的是那份落后的值。零容忍。
 *   R6 v3 端 `/alpha` 用量 ↔ alpha 插件登记表对账(2026-09-25 补,见文件下方 R6 段说明)——
 *      扫三个 v3 消费端源码里**真实写过**的 `bg-<档>/<数值>`、`text-<档>/<数值>`、`border-<档>/<数值>` 类名,逐条要求
 *      `tailwind-alpha-plugin.js` 的 `ALPHA_USAGE` 登记过、且 `buildAlphaUtilities` 真的产出了那个选择器;
 *      表里登了却没人用的条目按"清单腐烂"同样判红。
 *   R8 手抄色值回潮(2026-09-25 补,见文件下方 R8 段说明)—— RN 令牌表里那些「与 tokens.css 同名同值」
 *      的档已经由 scripts/sync-rn-tokens.mjs 派生到端上,共享 RN 代码(packages/app/src)里再写一份
 *      同值 `#hex` 字面量就是第二真相。禁用值集合是**由两份源算出来的**,不是手工清单;存量按 HEAD 棘轮
 *      只报数,本次新引入的那一枚才判红。
 *
 * 为什么补 R4/R5:本门此前只核 13 条**手工登记的**映射,于是"8/8 in sync"与"基础档整片没人管"同时为真
 * —— AGENTS 第四十二批未闭环③点名的正是这个盲区。补登记式映射会把盲区换成一份必然过期的清单
 * (守门 91 的组件清单已经证明过这一点),所以 R4 改成**按名推导**;推导面实测 78 条叶子/68 条等值。
 * 另:R4 的比对必须容忍 shadcn 的 HSL 整数舍入 —— `--color-success: hsl(142 71% 45%)` 转 HEX 得
 * #21c45d 而 RN 写 #22c55e,单通道差 1 是**同一颜色的两种编码**,不是漂移;不容忍就会在门上线当天造 4 枚
 * 假红(实测),而恒红门的唯一结局是逼人 --no-verify、连带废掉全部守门。
 *
 * 已知限制(如实登记):
 *   - tokens.css 的块注释里满是 `--color-x:说明文字` 形态,取变量前必须整段剥离注释 —— 否则注释文本会被
 *     `(--[\w-]+):([^;]+);` 当成变量值(实测会产出 4 条假漂移,含"值里带换行的注释全文")。
 *   - R4 推不到的 86 条叶子(gray 色阶 / overlay / error / text.primary 等)依赖人工复核才进对账;
 *     逃逸路径是"给 RN 键改名使推导断链",那属 review 可见的改动,不由本门伪装语义推断来兜。
 *
 * 为什么补 R6(2026-09-25):AGENTS §4 有一条"新增颜色档必须同时进 tailwind-alpha-plugin,否则新档又缺
 * /alpha",但它落地时**只有散文、零判据**(全仓无一道门 import 过该插件)。后果不是"风格不统一"而是
 * 静默失效:v3 从 `var(--color-x)` 解析不出通道 ⇒ 未登记的 `bg-card/50` 根本不产出 CSS,typecheck / lint /
 * build / 其余约 150 道门全都不红 —— 与本票要防的缺陷同型。插件文件头自称由
 * `scripts/tests/tailwind-alpha-plugin.test.mjs` 的「用量对账」看护,该文件**在 HEAD 与磁盘上都不存在**
 * (实测 `git cat-file -e HEAD:...` 报 does not exist),所以那句自述是空头支票,R6 是它的兑现。
 * 单一真相 = **源码里的真实用量**,不新增第二份手工清单:登记表既被当期望集,也被反向核防腐烂。
 * 全部门判据同一种取材口径(2026-09-25 起):缺省判 **HEAD blob**,`--staged` 判**索引 blob**,
 * `--worktree` 只作人工逃生舱(扫跟踪文件的工作树内容,提交链永不调它),两面旗同给直接判死。
 * R6 的"表与用量必须同面"是这条口径最早的一处落地;此前 R1/R2/R4/R5(两份 token 源的比对)
 * 恒按 `readFileSync` 读磁盘,于是同一轮里"色值同不同源"看磁盘、"这些色值有没有被各端引用"看仓库 ——
 * 一次未提交的 token 改动能让前半段红、后半段绿,而 AGENTS 给本门写的口径只对了一半。
 * 表读磁盘、用量读 HEAD 会在并行会话刚补行的瞬间产出假红,反之(表读磁盘 + 用量读索引)则产出假绿:
 * 作者只暂存了源码那半边就能带着没有 CSS 的类名过关。故 `ALPHA_USAGE` / preset colors / tokens.css
 * 三份输入一律按判定面取 blob(与同日"诊断只能取同一个面"的教训一致)。
 *
 * Exit: 0 = 全绿, 1 = 红
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

// git 派生与 `cat-file --batch` 取材一律走共用层 scripts/lib/face-reader.mjs。本门曾是全链最后一处
// **自带一份 batch 解析**的门:那五处易错点(裸 'git'、stdio[0]='ignore' 会把喂进去的清单丢掉、
// 逐文件派生、maxBuffer 不够、junction 下的仓库根比较)在这里各有一份,而"输出被截断 ⇒ 无法判定"
// 这条正确判据更要各修一遍 —— 收口成一层之后,它只有一份实现。
import {
  Undetermined,
  catBatch,
  gitRaw,
  parseBatch,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// **相对路径**(取材层按 `<rev>:<rel>` 取 blob);磁盘读只在 `--worktree` 档发生,见 readFaceText
const RN_TOKENS_REL = 'packages/design-tokens/src/rn-tokens.ts'
const TOKENS_CSS_REL = 'packages/design-tokens/src/styles/tokens.css'

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const listOnly = argv.includes('--list')
const SELF_TEST = argv.includes('--self-test')
// 判定面在**这里**定一次:此前本门 R1/R2/R4/R5 读磁盘、R3/R6/R7 读 HEAD/索引,
// 同一次运行里"两份色值表同不同源"看磁盘、"这些色值有没有被各端引用"看仓库 ——
// 一边可能红一边可能绿,而结论取决于谁先看。一面一判,不留两把尺子。
const FACE_SEL = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})
if (FACE_SEL.error) {
  console.error(`❌ ${FACE_SEL.error}`)
  process.exit(2)
}
const face = FACE_SEL.face
/** 结论行要把"这一轮的结论是关于哪个面"说清 —— 换面就是换结论对象,不能让同一句话两种口径都用。 */
const FACE_TXT = {
  head: 'HEAD(全量审计,存量腐烂照红)',
  staged: '索引⊕HEAD(存量腐烂按棘轮放过)',
  worktree: '工作树(仅人工逃生舱,存量按棘轮放过;提交链永不走这档)',
}

// ─── 映射表(每条含取值依据,rn 路径 = [常量名, ...嵌套键]) ───
const MAPPINGS = [
  {
    label: 'vip.gold ↔ --color-vip-gold-start',
    rn: { light: ['rnLightTokens', 'vip', 'gold'], dark: ['rnDarkTokens', 'vip', 'gold'] },
    css: { light: '--color-vip-gold-start', dark: '--color-vip-gold-start' },
    basis:
      'rn-tokens.ts L52 注释「VIP 会员金色(对齐 --color-vip-gold-start/end,明暗同值)」;tokens.css @theme L136,.dark 无覆盖(cascade 回退亮色)',
  },
  {
    label: 'vip.goldEnd ↔ --color-vip-gold-end',
    rn: { light: ['rnLightTokens', 'vip', 'goldEnd'], dark: ['rnDarkTokens', 'vip', 'goldEnd'] },
    css: { light: '--color-vip-gold-end', dark: '--color-vip-gold-end' },
    basis: '同上(rn-tokens.ts L52 注释);tokens.css @theme L137,.dark 无覆盖',
  },
  // 注(2026-09-17):原「surface.inputBg ↔ --color-link-bg」配对已移除。根因:两边语义均已漂移且
  // 不再同源——rn surface.inputBg 已改为中性输入框底色(light #F5F5F5/dark #262626),
  // tokens.css --color-link-bg 已改为链接背景浅蓝透明(light rgba(143,184,204,0.15)/dark
  // rgba(163,196,214,0.14));「输入框背景」与「链接背景」语义不同,强行配对无意义,
  // 与 2026-09-06 移除「indigo.DEFAULT ↔ --color-brand」同一处置模式。
  // 注(2026-09-06):原「indigo.DEFAULT ↔ --color-brand」配对已移除。根因:品牌"统一黑/白"后,
  // tokens.css --color-brand 已从 #6366f1 改为 #000000/#ffffff(对齐 RN brand.DEFAULT 纯黑纯白),
  // 而 RN indigo(强调色 #6366f1/#818cf8)是 RN 专属的 indigo 强调色,web 无 --color-brand 对应。
  // 二者语义不同(token 不同),故不再强行配对;RN indigo 强调色与 web 强调色的对齐属品牌方向决策,待评审。
  {
    label: 'brand.DEFAULT (light) ↔ --color-primary (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'DEFAULT'] },
    css: { light: '--color-primary' },
    basis:
      'rn-tokens.ts L14/L59/L177 注释「brand.DEFAULT = #000000 对齐 web 亮色 --color-primary」;tokens.css @theme L50 --color-primary: hsl(0 0% 0%)(HSL→HEX 归一后 #000000)',
  },
  {
    label: 'brand.DEFAULT (dark) ↔ --color-primary (.dark)',
    rn: { dark: ['rnDarkTokens', 'brand', 'DEFAULT'] },
    css: { dark: '--color-primary' },
    basis:
      'rn-tokens.ts L15/L231 注释「brand.DEFAULT = #FFFFFF 对齐 web 暗色 --color-primary(纯白底)」;tokens.css L354 .dark --color-primary: hsl(0 0% 100%)(有覆盖,HSL→HEX 归一后 #ffffff)',
  },
  // 2026-09-24:补上缺的另一半。此前只声明了 DEFAULT 一对,而"CTA = DEFAULT+foreground 成对"里
  // 的 foreground 从没进过对账 —— 于是 web 改了 --color-primary-foreground 而 RN 不改,本门也不会红。
  {
    label: 'brand.foreground (light) ↔ --color-primary-foreground (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'foreground'] },
    css: { light: '--color-primary-foreground' },
    basis:
      'rn-tokens.ts「品牌底(brand.DEFAULT)之上的前景色」;tokens.css @theme --color-primary-foreground: hsl(0 0% 100%)',
  },
  {
    label: 'brand.foreground (dark) ↔ --color-primary-foreground (.dark)',
    rn: { dark: ['rnDarkTokens', 'brand', 'foreground'] },
    css: { dark: '--color-primary-foreground' },
    basis:
      'rn-tokens.ts rnDarkTokens brand.foreground = #000000(深色底翻黑前景);tokens.css .dark --color-primary-foreground: hsl(0 0% 0%)',
  },
  // 2026-09-24:CTA 独立档(明暗同值)。它不是 §4 当年删掉的那种"端内自立混血键"
  // (ctaFill 浅色=web primary、深色另取一档)—— 这一档**两主题逐位同值**,且先在
  // tokens.css @theme 落变量再登记,正是 §4「真要新增品牌档」规定的顺序。
  // 为什么必须新增:--color-primary 在 web 兼任墨色(text-primary 1803 处),不能为了
  // 按钮观感去动它;而 brand.DEFAULT 浅=纯黑/深=纯白,大色块在两主题里都是与页面相反的一极。
  {
    label: 'brand.cta (light) ↔ --color-cta (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'cta'] },
    css: { light: '--color-cta' },
    basis:
      'tokens.css @theme --color-cta: #4a7a96(= --color-brand-accent-deep 亮档,2026-09-14 定稿强调色);rn-tokens.ts rnLightTokens brand.cta = #4A7A96',
  },
  {
    label: 'brand.cta (dark) ↔ --color-cta (.dark 无覆盖,cascade 回退)',
    rn: { dark: ['rnDarkTokens', 'brand', 'cta'] },
    css: { dark: '--color-cta' },
    basis:
      '刻意明暗同值:tokens.css .dark 不覆盖 --color-cta(cascade 回退 @theme 的 #4a7a96);rn-tokens.ts rnDarkTokens brand.cta = #4A7A96',
  },
  {
    label: 'brand.ctaForeground (light) ↔ --color-cta-foreground (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'ctaForeground'] },
    css: { light: '--color-cta-foreground' },
    basis:
      'tokens.css @theme --color-cta-foreground: #ffffff;rn-tokens.ts rnLightTokens brand.ctaForeground = #FFFFFF(白字对 #4A7A96 实测 4.65:1,过 AA)',
  },
  {
    label: 'brand.ctaForeground (dark) ↔ --color-cta-foreground (.dark 无覆盖,cascade 回退)',
    rn: { dark: ['rnDarkTokens', 'brand', 'ctaForeground'] },
    css: { dark: '--color-cta-foreground' },
    basis: '同上,明暗同值 #ffffff',
  },
  // 2026-09-06:danger/错误红对齐。RN danger.DEFAULT + error.text 与 web --color-danger
  // 统一为同一语义口(亮 #dc2626 / 暗 #ef4444),并纳入守门防漂移。
  {
    label: 'danger.DEFAULT (light) ↔ --color-danger (:root)',
    rn: { light: ['rnLightTokens', 'danger', 'DEFAULT'] },
    css: { light: '--color-danger' },
    basis:
      'rn-tokens.ts danger.DEFAULT = #dc2626(2026-09-06 对齐 web --color-danger);tokens.css L175 --color-danger: #dc2626',
  },
  {
    label: 'danger.DEFAULT (dark) ↔ --color-danger (.dark)',
    rn: { dark: ['rnDarkTokens', 'danger', 'DEFAULT'] },
    css: { dark: '--color-danger' },
    basis:
      'rn-tokens.ts rnDarkTokens danger.DEFAULT = #ef4444(明暗同义对齐 web .dark);tokens.css L457 .dark --color-danger: #ef4444',
  },
]

// ─── 提取:rn-tokens.ts ───

/** 提取 `export const <name> ... = {` 的平衡花括号对象体。 */
function extractTsObjectBody(src, constName) {
  const re = new RegExp(`export const ${constName}[^=]*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return src.slice(m.index + m[0].length, i - 1)
}

/** 在对象体内按嵌套键路径解析叶子字符串字面量(如 ['vip','gold'] → '#FFD700')。 */
function resolveTsPath(body, path) {
  // 表名漂移(rnBodies 里没有这一张表)时 body 是 undefined。旧实现在此**裸抛**
  // `Cannot read properties of undefined (reading 'length')` —— 经顶层 catch 变成匿名 exit 2,
  // 谁都看不出是"映射表指了张不存在的表"。判据取不到输入必须点名原因,而不是抛栈。
  if (typeof body !== 'string')
    throw new UndeterminedError(
      `映射表指向的常量表取不到(body=${String(body)};path=${String(path)}):` +
        ' rn-tokens.ts 里是否有名为 ' +
        String(path && path[0]) +
        ' 的表?要么补表要么改映射,不得让它表现为崩溃。'
    )
  let text = body
  for (let idx = 0; idx < path.length; idx++) {
    const key = path[idx]
    const isLeaf = idx === path.length - 1
    const re = new RegExp(`(?:^|[\\s,{])${key}\\s*:`)
    const m = re.exec(text)
    if (!m) return null
    let i = m.index + m[0].length
    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] === '{') {
      if (isLeaf) return null
      let depth = 1
      i++
      const start = i
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      text = text.slice(start, i - 1)
    } else {
      if (!isLeaf) return null
      const sm = /^'([^']*)'|^"([^"]*)"/.exec(text.slice(i))
      return sm ? (sm[1] ?? sm[2]) : null
    }
  }
  return null
}

// ─── 提取:tokens.css(复用 check-rn-global-css-sync.mjs 的块提取模式) ───

/** 提取所有匹配 selector 的块内文本(平衡花括号)。 */
function extractAllBlocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{', 'g')
  const blocks = []
  let m
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(m.index + m[0].length, i - 1))
    re.lastIndex = i
  }
  return blocks
}

/** 提取块内 CSS 变量,返回 { name: value }。 */
export function extractCssVars(text) {
  const vars = {}
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(text)) !== null) vars[m[1]] = m[2].trim()
  return vars
}

/** 合并多个 selector 块的变量(后者覆盖前者)。 */
function mergeCssVars(css, selectors) {
  const merged = {}
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel)) Object.assign(merged, extractCssVars(block))
  return merged
}

// ─── 比对 ───

/**
 * 品牌命名空间的"已声明键"之外,只允许这份显式清单里的键(web 侧确无对应 CSS 变量的历史档)。
 * 清单本身受 R2 检查:写了却已不存在的键同样算红(防豁免清单腐烂)。
 */
export const RN_ONLY_BRAND_KEYS = {
  dark: '品牌绿 #34D399 只在 RN 侧使用,web/tokens.css 无对应变量;新增品牌色档必须先落 tokens.css 再登记映射',
}

/**
 * R4 的"确有语义分歧"登记表(键 = `<常量名>|<RN 路径>`)。**只许减不许增**,且写了却已不再冲突 = 红。
 * 每条必须写清:哪一侧是什么、为什么不能直接对齐、以及"改哪一侧"要花什么代价 —— 空口径的豁免等于没有门。
 */
export const BASE_CONFLICTS = {
  'rnDarkTokens|warning.DEFAULT':
    'RN 暗档沿用 amber-500(#f59e0b)而 tokens.css/.dark 把它提亮到 hsl(38 85% 55%)(≈#eea62b)。两侧都有理由(暗底上更亮的告警字 vs 与小程序 app.css 同值),属跨端视觉决策:改 RN 会同时动 miniapp-taro 的 tk.warning.DEFAULT 调用面。归 RN 主题属主定档,不得静默择一。',
  'rnDarkTokens|danger.bright':
    'RN 暗档取 red-300(#fca5a5),web/.dark 的 --color-danger-bright 取 #ef4444 —— 且 web 暗档里 danger.DEFAULT 与 danger.bright 同为 #ef4444,"bright"在暗档已不再更亮。谁对取决于暗档是否还要层级差,属视觉决策而非机械对齐。',
  'rnDarkTokens|surface.light':
    'tokens.css 与 miniapp app.css 都把 --color-surface-light 钉成明暗同值 #FFFFFF(注释原文「对比白字/白卡面,明暗同值」),而 RN 暗档是 #262626。把 RN 改成 #FFFFFF 会在深色档案下凭空造出白卡片面,正是守门 83 R2 要拦的形态;改 web 那侧又会破 §4「成对即合规」的前提。两侧合同互斥,必须人裁定哪一个才是合同。',
}

/** 取对象体里某个命名空间(如 brand)的顶层键名列表。 */
export function namespaceKeys(body, ns) {
  const m = new RegExp(`(?:^|[\\s,{])${ns}\\s*:\\s*\\{`).exec(body)
  if (!m) return []
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (i < body.length && depth > 0) {
    if (body[i] === '{') depth++
    else if (body[i] === '}') depth--
    i++
  }
  const inner = body.slice(start, i - 1)
  const keys = []
  const re = /(?:^|[,{\n])\s*([A-Za-z_$][\w$]*)\s*:/g
  let mm
  while ((mm = re.exec(inner))) keys.push(mm[1])
  return [...new Set(keys)]
}

/** 映射表里被声明过的 brand 键(path = ['rnLightTokens','brand','DEFAULT'] → 'DEFAULT') */
export function declaredBrandKeys(mappings) {
  const out = new Set()
  for (const mp of mappings)
    for (const mode of ['light', 'dark']) {
      const p = mp.rn[mode]
      if (p && p[1] === 'brand' && p[2]) out.add(p[2])
    }
  return out
}

/** R2:brand 命名空间里出现"既没被映射声明、也不在豁免清单"的键 → 违规(端内自立一档的入口) */
export function checkBrandKeys({ bodies, declared, allowlist }) {
  const bad = []
  const seen = new Set()
  for (const [name, body] of Object.entries(bodies)) {
    for (const key of namespaceKeys(body, 'brand')) {
      seen.add(key)
      if (!declared.has(key) && !(key in allowlist)) bad.push({ where: name, key })
    }
  }
  const stale = Object.keys(allowlist).filter((k) => !seen.has(k))
  return { bad, stale }
}

/**
 * R3:token 袋里引用了不存在的品牌档 → 悬空引用。
 * 编译不一定红(主题袋常被当作宽类型),运行时才是 `undefined` 颜色 —— 与守门 77 的 B6 同一类"两边都不红"。
 *
 * 必须带 token 袋前缀(`tokens.` / `tk.` / `theme.` …):首版只匹配 `brand\.` 就撞上了
 * `BrandMarquee.tsx` 里那个**局部变量也叫 brand**的轮播数据对象(`brand.nameKey` / `brand.src`),
 * 产出成片假红。裸 `brand.x` 在业务代码里语义太多,不收。
 */
export function danglingBrandRefs(text, allowed) {
  const out = []
  const re = /\b(?:tokens|tk|theme|activeTokens|token|t)\s*\.\s*brand\s*\.\s*([A-Za-z_$][\w$]*)\b/g
  let m
  while ((m = re.exec(text))) if (!allowed.has(m[1])) out.push({ key: m[1], at: m[0] })
  return out
}

/** hsl(h s% l%) / hsl(h, s%, l%) → '#rrggbb'。s=0 时 a=0、f(n)=l,灰度边界天然正确。 */
function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  const hex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/**
 * 归一化比对值:HEX 原样保留(小写+去空白);hsl(h s% l%) / hsl(h, s%, l%)
 * 转换为 #rrggbb;rgba/hsla 保持原样不转换(仅小写+去空白)。
 * 注意:必须先提取 hsl 再处理空白 —— 空格分隔格式 `hsl(0 0% 0%)` 一旦
 * 去空白会破坏参数边界,导致无法解析。
 */
function normalizeColor(v) {
  const compact = v.trim().replace(/\s+/g, ' ').toLowerCase()
  const m = /^hsla?\(\s*([\d.]+)\s*(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/.exec(
    compact,
  )
  if (m) return hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  const flat = compact.replace(/\s+/g, '')
  // #fff 与 #ffffff 是同一颜色;不展开会让"一侧写缩写"的合法写法判成漂移
  const short = /^#([0-9a-f]{3})$/.exec(flat)
  return short
    ? `#${short[1]
        .split('')
        .map((c) => c + c)
        .join('')}`
    : flat
}

/**
 * shadcn 的 HSL 分量按整数存(#22c55e → hsl(142 71% 45%)),往返编码后单通道最多差 1。
 * 比对时把两侧都折成 RGB 三元组量距离;非 hex/hsl(如 rgba)退回归一字符串全等 ——
 * 透明度差 0.05 是真分歧,不该被容差吞掉。
 */
function toRgbTriple(v) {
  const c = v.trim().replace(/\s+/g, ' ').toLowerCase()
  const h = /^hsla?\(\s*([\d.]+)\s*(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/.exec(c)
  if (h) {
    const [hh, s, l] = [parseFloat(h[1]), parseFloat(h[2]), parseFloat(h[3])]
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
    const f = (n) => {
      const k = (n + hh / 30) % 12
      return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    }
    return [f(0), f(8), f(4)].map((x) => Math.round(x * 255))
  }
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c)
  if (!m) return null
  const t =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((x) => x + x)
          .join('')
      : m[1]
  return [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16))
}

/** 同一颜色的两种编码(shadcn HSL 整数舍入)允许单通道差 1;超过即真漂移。 */
export const HSL_ROUNDING_TOLERANCE = 1
export function colorsAgree(a, b) {
  const ra = toRgbTriple(a)
  const rb = toRgbTriple(b)
  if (ra && rb) return Math.max(...ra.map((v, i) => Math.abs(v - rb[i]))) <= HSL_ROUNDING_TOLERANCE
  return normalizeColor(a) === normalizeColor(b)
}

/**
 * 剥掉 CSS 块注释。必须在使用变量提取之前做:tokens.css 的注释里满是
 * `- --color-warning-amber:RN warning.amber(...)` 这类说明行,不剥就会被当成变量声明,
 * 取到的"值"是一段跨多行的注释全文(实测造出 4 条假漂移)。
 */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 剥 TS 注释(块 + 整行 `//`)。rn-tokens.ts 的注释全是 `/** *​/` 文档块,
 * 里面写着 `brand.DEFAULT = #000000 对齐 web …` 这类**说明性赋值**;叶子收集若穿过去,
 * 就会把注释文本当取值来源。整行 `//` 只出现在水印横幅行。
 */
export function stripTsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
}

/** 递归收集对象体里的颜色叶子:返回 [{ path, value }](path 用 . 连接,数字键原样)。 */
export function objectLeaves(text, prefix = []) {
  const out = []
  const re = /(?:^|[,{\n])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*|\d+))\s*:\s*/g
  let m
  while ((m = re.exec(text))) {
    const key = m[1] ?? m[2] ?? m[3]
    let i = m.index + m[0].length
    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] === '{') {
      const start = i + 1
      let depth = 1
      i++
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      out.push(...objectLeaves(text.slice(start, i - 1), [...prefix, key]))
      re.lastIndex = i
      continue
    }
    const sm = /^'([^']*)'|^"([^"]*)"/.exec(text.slice(i))
    if (sm) out.push({ path: [...prefix, key].join('.'), value: sm[1] ?? sm[2] })
    re.lastIndex = i
  }
  return out
}

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

/**
 * R4 的推导规则:RN 路径 `brandAccent.gradFrom` → `--color-brand-accent-grad-from`;
 * `warning.DEFAULT` → 先试 `--color-warning-default`,再折叠成父名 `--color-warning`。
 * 规则确定、可被镜像测试复算,不引入第二份手工清单。
 */
export function deriveCssVarNames(path) {
  const i = path.lastIndexOf('.')
  const ns = i < 0 ? '' : path.slice(0, i)
  const key = i < 0 ? path : path.slice(i + 1)
  const head = ns ? `--color-${kebab(ns)}-${kebab(key)}` : `--color-${kebab(key)}`
  return key === 'DEFAULT' && ns ? [head, `--color-${kebab(ns)}`] : [head]
}

/**
 * R4:三张 RN 表的每个叶子,凡能按名推到同名 CSS 变量的都必须等值。
 * 确有语义分歧的必须登记在 registered(键 = `<常量名>|<路径>`),且写了却已不冲突 = 红(防腐烂)。
 * @returns {{checked:number, drift:Array, stale:Array}}
 */
export function checkBasePalette({ leavesByConst, cssLight, cssDark, registered }) {
  const drift = []
  const hitKeys = new Set()
  let checked = 0
  for (const [constName, leaves] of Object.entries(leavesByConst)) {
    const mode = constName === 'rnDarkTokens' ? 'dark' : 'light'
    const table = mode === 'dark' ? cssDark : cssLight
    for (const lf of leaves) {
      if (!/^\s*(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(lf.value)) continue // 只判颜色,不收数字/字符串配置项
      const varName = deriveCssVarNames(lf.path).find((c) => c in table)
      if (!varName) continue
      checked++
      const key = `${constName}|${lf.path}`
      if (colorsAgree(lf.value, table[varName])) continue
      if (key in registered) {
        hitKeys.add(key)
        continue
      }
      drift.push({ key, mode, path: lf.path, rn: lf.value, css: varName, cssVal: table[varName] })
    }
  }
  const stale = Object.keys(registered).filter((k) => !hitKeys.has(k))
  return { checked, drift, stale }
}

/**
 * R5:`rnTokens`(遗留基表)与 `rnLightTokens` 同路径必须同值。
 * 基表经 `packages/app/src/theme/tokens.ts` 以 `tokens` 之名被大量屏直接取用,
 * 两张表分叉 = 同一语义有两个真相,且落后那份才是实际渲染出来的。
 */
export function checkIntraPalette({ base, light }) {
  const out = []
  const b = new Map((base || []).map((l) => [l.path, l.value]))
  for (const lf of light || []) {
    if (!b.has(lf.path)) continue
    const v0 = b.get(lf.path)
    if (normalizeColor(v0) !== normalizeColor(lf.value))
      out.push({ path: lf.path, base: v0, light: lf.value })
  }
  return out
}

// ─── R6:v3 端 `/alpha` 用量 ↔ tailwind-alpha-plugin 登记表对账(2026-09-25) ───

/** 三份输入的仓库路径(全部按判定面取 blob,不得混面)。 */
export const ALPHA_PLUGIN_REL = 'packages/design-tokens/src/tailwind-alpha-plugin.js'
export const ALPHA_PRESET_REL = 'packages/design-tokens/src/tailwind-preset.js'
export const ALPHA_TOKENS_REL = 'packages/design-tokens/src/styles/tokens.css'
/** 扫这三处 = Tailwind **v3** 的两个消费端 + 被 v3 端编译的共享包(实测 miniapp 3.4.17 / mobile-rn 3.4.19,
 *  两端 tailwind.config 都 require 同一份 preset ⇒ 同一个插件)。web / extension 是 v4,原生支持 alpha,
 *  扫它们会把"本来就能用的类名"判成缺登记 = 假红。 */
export const ALPHA_SCAN_FACES = ['apps/miniapp-taro/src', 'apps/mobile-rn/src', 'packages/app/src']
/**
 * 其中 `apps/miniapp-taro` 实际跑的是 **Tailwind v4**,不是端内 `package.json` 声明的 v3.4.17
 * (2026-09-25 实测,三条证据见 PROJECT_PLAN O62附⑤:产物 base 层带 v4 指纹;
 * `weapp-tailwindcss@5.2.9` 引用的入口是 `@tailwindcss/postcss`,而 v4 的 main 导出会报错
 * 拒绝被当 postcss 插件用)。而 v4 **原生**产出项目自定义色的 `/alpha` —— 带真 `@theme` 复测
 * 7/7 命中,含 `bg-cta/20` 与任意值 `bg-muted/[0.12]`,声明体是 `color-mix(in srgb, …)`。
 * ⇒ "必须登记进 ALPHA_USAGE"对 miniapp 是**假要求**:登记了它也不读插件(插件挂在 v3 preset 上,
 * 而该 preset 在 miniapp 真实构建里根本没被加载),不登记 v4 也照样能出。
 * 所以 R6 的"必须登记 / 清单腐烂"两判只对**真 v3 消费端**(mobile-rn + packages/app)生效;
 * miniapp 的 alpha 用量仍**照数报出**,只是不判红 —— 它属于那条尚未接线的"utilities 到端"问题。
 */
export const ALPHA_V4_FACES = ['apps/miniapp-taro/src']
export const isV4Face = (rel) => ALPHA_V4_FACES.some((p) => rel === p || rel.startsWith(p + '/') || rel.startsWith(p + '\\'))
/** 真 v3 消费端 = 全部扫描面减去 v4 面。登记表与"必须登记"判据都只认这一份。 */
export const ALPHA_V3_SCAN_FACES = ALPHA_SCAN_FACES.filter((p) => !ALPHA_V4_FACES.includes(p))
export const ALPHA_SCAN_EXT = /\.(tsx|ts|css|scss)$/
/** 行内豁免:必须带原因,且只对**本行或紧邻上一行**生效(逐行,不得一行标记救全文件)。 */
export const ALPHA_EXEMPT_RE = /alpha-plugin-exempt:\s*\S/

const ALPHA_KINDS_ALL = [
  'bg',
  'text',
  'border',
  'from',
  'via',
  'to',
  'ring',
  'fill',
  'stroke',
  'outline',
  'shadow',
  'decoration',
  'caret',
  'accent',
  'divide',
  'placeholder',
]

// 具名"无法判定"类型直接取层的。本门原先自造一个同名空类,而层的 catBatch/gitRaw 抛的是它自己的
// `Undetermined` ⇒ 一旦混用,层抛上来的异常会掉进"本门自身异常"分支(exit 2 裸崩、只打 message),
// 而不是"无法判定"(exit 1 + 点名原因)。同一族异常只能有一种。
const UndeterminedError = Undetermined

/**
 * 一次 git 调用;失败即抛(调用方按"无法判定"处理,绝不静默当扫过了)。派生本体在层里 ——
 * 绝对路径 git、`-c safe.directory=*`、`-c core.quotepath=false`、`-C root`、windowsHide、
 * 显式 stdio、够大的 maxBuffer 都由那一处统一给,本门只保留自己的超时/缓冲额度。
 */
function gitExec(args, opts = {}) {
  return gitRaw(args, root, { timeout: 120_000, maxBuffer: 256 << 20, ...opts })
}

/**
 * 一次 `cat-file --batch` 取多个 blob:rev 用 `HEAD:path` / `:path` 两种前缀。取不到记 null(不抛);
 * **输出被截断则抛"无法判定"** —— 这条判据的实现现在在层里(`parseBatch`),不再各门各修一遍。
 */
function readBlobs(revs) {
  return catBatch(root, revs, { timeout: 120_000, maxBuffer: 256 << 20 })
}

/**
 * 崩溃面形状判据(纯函数 ⇒ 可喂正反例)。
 *
 * 为什么不做成"读自身源码 + 断言"就完事:那样**无法证明它有牙** —— 想验证就得把旧形状写回本文件,
 * 而旧形状一旦写回就是语法错(`break` 落在循环外),文件根本跑不起来,证明退化成"没测"。
 * 抽成纯函数后,反例只是传入的一小段字符串(门 103 的 T12 同一课:证明这类行为只能用纯函数 + 构造面)。
 *
 * 收口进取材层之后本尺子的三件事变了形,按新形状重写:
 *  · `usesLayer` 取代"本文件里有截断串" —— 截断判据现在住在层里,本门**不该**再有那句话;
 *  · `selfBatchBack` 防的是"有人把自带 batch 解析加回来"(那正是本门原来的样子);
 *  · 截断本身不再靠文本证明,改成直接喂 `parseBatch` 一个断掉的缓冲(见 selfTest 的 truncOk)。
 */
export function checkCrashShape(sourceText) {
  const flat = sourceText.replace(/\s+/g, '')
  const forbiddenFlat = ('map.set(rev, null)' + '\n      break').replace(/\s+/g, '')
  return {
    usesLayer:
      /from '\.\/lib\/face-reader\.mjs'/.test(sourceText) && /\bcatBatch\(root,/.test(sourceText),
    // `'--batch'` 是 `'--batch-check'` 的前缀,不加负向断言会把"只用 batch-check"误判成自带解析
    selfBatchBack: /'cat-file'\s*,\s*'--batch(?!-check)'/.test(sourceText),
    silentBreakBack: flat.includes(forbiddenFlat),
    catchHasStack: sourceText.includes('e?.stack ?? e'),
  }
}

/** 真取插件模块本体(判据用它的 buildAlphaUtilities,严禁在测试或本门里抄一份等价实现)。 */
export async function loadAlphaPlugin(base = root) {
  try {
    return await import(pathToFileURL(join(base, ALPHA_PLUGIN_REL)).href)
  } catch (e) {
    throw new UndeterminedError(`取不到 alpha 插件实现(${ALPHA_PLUGIN_REL}):${e.message}`)
  }
}

/** 极简 JS 字面量对象解析器:只认 键 / 字符串 / 数组 / 嵌套对象,其余一律判"无法判定"。
 *  刻意不用 eval/new Function:登记表被人写成非常量形态时必须大声失败,而不是被静默求值。 */
export function parseLiteralObject(body) {
  let i = 0
  const s = body
  const ws = () => {
    while (i < s.length && /[\s,;]/.test(s[i])) i++
  }
  const fail = (at) => {
    throw new UndeterminedError(`字面量登记表解析失败(位置 ${at}):${JSON.stringify(s.slice(at, at + 40))}`)
  }
  const readString = () => {
    const q = s[i]
    const start = i++
    while (i < s.length && s[i] !== q) i += s[i] === '\\' ? 2 : 1
    if (i >= s.length) fail(start)
    return s.slice(start + 1, i++)
  }
  const readValue = () => {
    ws()
    const c = s[i]
    if (c === '{') {
      i++
      const inner = parseLiteralObjectInner()
      return inner
    }
    if (c === '[') {
      i++
      const arr = []
      for (;;) {
        ws()
        if (s[i] === ']') {
          i++
          return arr
        }
        if (i >= s.length) fail(i)
        arr.push(readValue())
      }
    }
    if (c === "'" || c === '"') return readString()
    fail(i)
  }
  function parseLiteralObjectInner() {
    const out = {}
    for (;;) {
      ws()
      if (s[i] === '}' || i >= s.length) {
        i++
        return out
      }
      let key
      if (s[i] === "'" || s[i] === '"') key = readString()
      else {
        const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(s.slice(i))
        if (!m) fail(i)
        key = m[0]
        i += m[0].length
      }
      ws()
      if (s[i] !== ':') fail(i)
      i++
      out[key] = readValue()
    }
  }
  return parseLiteralObjectInner()
}

/** 从 blob 文本里按锚点取出平衡花括号的对象体(锚点必须唯一,多处即无法判定)。 */
export function extractObjectBody(src, anchorRe) {
  // 必须沿用锚点自带的 flag(漏掉 m 会让 `^export const …` 只能在串首匹配 ⇒ 整门"取不到登记表")
  const flags = anchorRe.flags.includes('g') ? anchorRe.flags : `${anchorRe.flags}g`
  const hits = [...src.matchAll(new RegExp(anchorRe.source, flags))]
  if (hits.length !== 1)
    throw new UndeterminedError(`锚点 ${anchorRe} 命中 ${hits.length} 处(须恰好 1 处),登记表形态已超出判据`)
  const m = hits[0]
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  if (depth !== 0) throw new UndeterminedError('登记表花括号不配平')
  return src.slice(start, i - 1)
}

/** preset 的 colors 树 → 类名可用档名集合(嵌套 DEFAULT 折叠为父名:`primary.DEFAULT` → `bg-primary`)。 */
export function flattenColorTiers(colors) {
  const out = new Set()
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const path = [...prefix, k]
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (Object.prototype.hasOwnProperty.call(v, 'DEFAULT')) out.add(path.join('-'))
        walk(v, path)
      } else if (typeof v === 'string') out.add(path.join('-'))
    }
  }
  walk(colors, [])
  return new Set([...out].filter((t) => !t.endsWith('-DEFAULT')))
}

/** 把注释字符替换成空格(保持行号/列号),字符串与模板原样保留。
 *  两个历史假阳形态都由本函数消掉:① 注释里举例子(`// 如 bg-info/10`)不得当用量;
 *  ② `'https://x/*'` 里的 `/*` 不得把后续代码骗进块注释状态机。 */
export function maskComments(text, isCss = false) {
  let out = ''
  let i = 0
  let mode = null // 'sq' | 'dq' | 'tpl' | 'line' | 'block'
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (mode === 'line') {
      if (c === '\n') {
        mode = null
        out += c
      } else out += ' '
      i++
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = null
        out += '  '
        i += 2
        continue
      }
      out += c === '\n' ? '\n' : ' '
      i++
      continue
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'tpl') {
      const q = mode === 'sq' ? "'" : mode === 'dq' ? '"' : '`'
      if (c === '\\') {
        out += c + (n ?? '')
        i += 2
        continue
      }
      if (c === q) mode = null
      else if (mode === 'tpl' && c === '\n') {
        out += c
        i++
        continue
      }
      out += c
      i++
      continue
    }
    if (!isCss && (c === "'" || c === '"' || c === '`')) {
      mode = c === "'" ? 'sq' : c === '"' ? 'dq' : 'tpl'
      out += c
      i++
      continue
    }
    if (!isCss && c === '/' && n === '/') {
      mode = 'line'
      out += '  '
      i += 2
      continue
    }
    if (c === '/' && n === '*') {
      mode = 'block'
      out += '  '
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/** 从一份(已剥注释的)源码里抽取 alpha 形态类名。返回命中 + 判不出来的动态拼接形态。
 *  `original` 必须传**剥注释前**的原文:行内豁免 `alpha-plugin-exempt: 原因` 本身就写在注释里,
 *  拿 masked 文本去找标记 = 豁免永远不生效(自检抓到过这个形态)。行号在两版里逐行对齐。 */
export function extractAlphaUsages(masked, { tiers, isCss = false, original = null } = {}) {
  const src = isCss ? masked.replace(/\\([\\/:.[\]()-])/g, '$1') : masked
  const rawLines = (original ?? masked).split('\n')
  const tokens = []
  const undetermined = []
  // 前导边界刻意允许 `.`:CSS 侧的选择器形态就是 `.bg-muted\/\[0\.12\]`。
  // 仍禁止 `/` 与 `-` 与单词字符 —— 前者挡住 URL 路径段(`learn/bg-success/10` 不是类名),后两者防止把
  // 更长标识符的尾巴当成一次独立命中。
  const re = new RegExp(
    `(^|[^\w/-])((?:[a-zA-Z0-9_.[\\]():;=-]+:)*)(?:(${ALPHA_KINDS_ALL.join('|')})-)` +
      `([a-zA-Z][a-zA-Z0-9-]*|\\[[^\\]]*\\])/(\\[[^\\]]*\\]|[0-9]{1,3})(?![\\w/%])`,
    'g',
  )
  let m
  while ((m = re.exec(src)) !== null) {
    const [, , variants, kind, tier, mod] = m
    const upto = src.slice(0, m.index + m[0].length)
    const line = upto.split('\n').length - 1
    tokens.push({
      kind,
      tier,
      mod,
      variants: variants || '',
      line,
      onPresetTier: tiers ? tiers.has(tier) : false,
      excerpt: (rawLines[line] || '').trim().slice(0, 110),
    })
  }
  // 动态拼接出来的 alpha 类名(档位或修饰符来自变量/模板)—— 判据看不见内容,只如实报数不判红
  const dynRes = [
    new RegExp(`(?:${ALPHA_KINDS_ALL.join('|')})-[^\\s"'\\\`]*\\$\\{`, 'g'),
    new RegExp(`(?:${ALPHA_KINDS_ALL.join('|')})-[a-zA-Z0-9_-]*/(?:['"\\\`]\\s*\\+|\\$\\{)`, 'g'),
  ]
  for (const r of dynRes) {
    let d
    while ((d = r.exec(src)) !== null) {
      const line = src.slice(0, d.index).split('\n').length - 1
      undetermined.push({ line, text: (rawLines[line] || '').trim().slice(0, 110) })
    }
  }
  // 行内豁免只对命中行本身或紧邻上一行生效(取**原文**,豁免就写在注释里)
  for (const t of tokens) {
    t.exempt = ALPHA_EXEMPT_RE.test(rawLines[t.line] || '') || ALPHA_EXEMPT_RE.test(rawLines[t.line - 1] || '')
  }
  return { tokens, undetermined }
}

/**
 * 用量 ↔ 登记表对账。produced 由**真插件**算出(单一实现,不在此复述产出规则)。
 * @returns {{checked:number, missing:Array, rot:Array, unproduced:Array, buildIssues:Array,
 *            unsupportedKind:Array, exempted:number, nonPreset:number}}
 */
export function checkAlphaUsage({ usages, usage, colors, plugin, baselineRot = null }) {
  const built = plugin.buildAlphaUtilities(usage, colors)
  const kinds = Object.keys(plugin.ALPHA_UTILITY_KINDS)
  const missing = []
  const unsupportedKind = []
  const unproduced = []
  const covered = new Set()
  let nonPreset = 0
  let exempted = 0
  for (const u of usages) {
    if (!u.onPresetTier) {
      nonPreset++
      continue
    } // 默认色板(white/black/gray-*)v3 自己能算通道,不属本插件职责
    if (u.exempt) {
      exempted++
      continue
    }
    const key = `${u.kind}-${u.tier}/${u.mod}`
    if (!kinds.includes(u.kind)) {
      unsupportedKind.push({ ...u, key })
      continue
    }
    const listed = Array.isArray(usage[u.tier]?.[u.kind]) && usage[u.tier][u.kind].includes(u.mod)
    if (!listed) {
      missing.push({ ...u, key })
      continue
    }
    covered.add(key)
    if (!Object.prototype.hasOwnProperty.call(built.utilities, plugin.escapeSelectorClass(key)))
      unproduced.push({ ...u, key })
  }
  const rotAll = []
  for (const [tier, byKind] of Object.entries(usage)) {
    for (const [kind, mods] of Object.entries(byKind || {}))
      for (const mod of mods || []) {
        const key = `${kind}-${tier}/${mod}`
        if (covered.has(key) || usages.some((u) => u.exempt && `${u.kind}-${u.tier}/${u.mod}` === key)) continue
        rotAll.push({ key, tier, kind, mod })
      }
  }
  // 棘轮:baselineRot = 上一枚提交(HEAD 面)已有的腐烂集合。传入时只拦"本次新造出来的腐烂",
  // 存量只报数不判红 —— 与守门 77/83/98 同一个取向:恒红门的唯一结局是逼人 --no-verify,连带废掉全部守门。
  const rot = baselineRot ? rotAll.filter((x) => !baselineRot.has(x.key)) : rotAll
  return {
    checked: usages.filter((u) => u.onPresetTier).length,
    missing,
    rot,
    rotInherited: rotAll.length - rot.length,
    unproduced,
    buildIssues: [...built.unresolvable, ...built.unknownKinds],
    unsupportedKind,
    exempted,
    nonPreset,
  }
}

/**
 * 插件产出的是 `rgba(var(--color-X-rgb), a)`,所以每个登记档都必须能在 tokens.css 取到通道三元组。
 * `:root`/`@theme` 缺 = 声明整条被浏览器判非法丢弃(与"没产出"同后果)⇒ 判红;
 * 只有 `.dark` 缺 = cascade 回退到亮档值 ⇒ 暗档偏色但仍可见,按"如实报数不判红"处理。
 */
export function checkAlphaChannelVars({ usage, colors, cssLight, cssDark, plugin }) {
  const missingLight = []
  const missingDark = []
  for (const tier of plugin.alphaTiers(usage)) {
    const varName = plugin.cssVarFromTierColor(plugin.resolveThemeColor(colors, tier))
    if (!varName) continue // 由 buildAlphaUtilities 的 unresolvable 判红,不在此重复计
    const chan = `${varName}${plugin.ALPHA_CHANNEL_SUFFIX}`
    if (!(chan in cssLight)) missingLight.push({ tier, chan })
    else if (!(chan in cssDark)) missingDark.push({ tier, chan })
  }
  return { missingLight, missingDark }
}

/** 按判定面收集 R6 语料:清单与内容同面;`--staged` 用索引 blob 覆盖 HEAD,删除的路径从语料中移除。
 *  同时带回 HEAD 原文(`head`)—— 腐烂判据要按"本次提交是否新增"算棘轮,必须有两个面的用量集。
 *  `allowEmpty`(R8 用):枚举到 0 个路径时返回空数组而不是判"无法判定"。理由是一条**辅助**判据的
 *  扫描面在某台检出/最小夹具里可以合法地不存在(没有 packages/app),不该让整个门 exit 2;
 *  但空面必须由 `counts.emptyFace` 大声带出,不得伪装成"扫过了、干净"。 */
export function collectAlphaCorpus({ face, faces = ALPHA_SCAN_FACES, allowEmpty = false }) {
  const FACE_SHORT = { head: 'HEAD', staged: '索引', worktree: '工作树' }
  const listed = gitExec(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', ...faces])
    .split('\0')
    .filter((p) => p && ALPHA_SCAN_EXT.test(p))
  const paths = new Set(listed)
  let extra = []
  if (face === 'staged') {
    // 暂存变更集(不是"整个索引"):这次提交真会带走的那些路径
    extra = gitExec(['diff', '--name-only', '--cached', '--', ...faces])
      .split('\n')
      .filter((p) => p && ALPHA_SCAN_EXT.test(p))
  } else if (face === 'worktree') {
    // 逃生舱:按跟踪文件清单(`git ls-files` = 索引面),内容一律从磁盘读 ——
    // 未跟踪文件不在射程内(否则又把别人的草稿扫进来,正是本门要避免的那一型)
    extra = gitExec(['ls-files', '-z', '--', ...faces])
      .split('\0')
      .filter((p) => p && ALPHA_SCAN_EXT.test(p))
  }
  for (const p of extra) paths.add(p)
  // 辅助判据(R8)的扫描面可以在某台检出/最小夹具里合法地不存在;
  // 让它把整个门打成 exit 2 是过度反应 —— 但空面必须由 counts.emptyFace 大声带出,不得伪装成"扫过且干净"。
  if (paths.size === 0 && allowEmpty) return []
  if (paths.size === 0)
    throw new UndeterminedError(
      `${FACE_SHORT[face]} 面在扫描面(${faces.join(' + ')})枚举到 0 个文件 —— 判据不扫空气`,
    )
  const all = [...paths]
  const headMap = readBlobs(all.map((p) => `HEAD:${p}`))
  const idxMap = face === 'staged' ? readBlobs(all.map((p) => `:${p}`)) : headMap
  // 本面的取内容出口 —— 三档只有这一处差异,故只写一次
  const readEff = (rel) =>
    face === 'head'
      ? headMap.get(`HEAD:${rel}`)
      : face === 'staged'
        ? idxMap.get(`:${rel}`)
        : readWorktreeFile(root, rel)
  const out = []
  const undeterminable = []
  for (const rel of all) {
    const head = headMap.get(`HEAD:${rel}`)
    if (head === null || head === undefined) {
      // 只在本面存在(本次新增的文件):HEAD 没有它,自然也没有 HEAD 侧用量
      if (face === 'head') undeterminable.push(rel)
      out.push({ rel, head: '', eff: readEff(rel) ?? '' })
      continue
    }
    if (face === 'head') {
      out.push({ rel, head, eff: head })
      continue
    }
    const eff = readEff(rel)
    if (eff === null || eff === undefined) continue // 本面已无此文件(本次删除)
    out.push({ rel, head, eff })
  }
  if (undeterminable.length > 0)
    throw new UndeterminedError(
      `HEAD blob 取不到 ${undeterminable.length} 个路径(首个:${undeterminable[0]}),按无法判定处理,不静默少扫`,
    )
  return out
}

// ─── Main ───

// §22d 双形态入口:被镜像测试 import 时只拿导出符号,绝不执行 CLI 主流程(读文件 + process.exit)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = {
  MAPPINGS,
  RN_ONLY_BRAND_KEYS,
  BASE_CONFLICTS,
  namespaceKeys,
  declaredBrandKeys,
  checkBrandKeys,
  danglingBrandRefs,
  normalizeColor,
  resolveTsPath,
  checkCrashShape,
  colorsAgree,
  stripCssComments,
  stripTsComments,
  objectLeaves,
  deriveCssVarNames,
  checkBasePalette,
  checkIntraPalette,
  extractTsObjectBody,
  extractCssVars,
  // R6(2026-09-25):v3 端 /alpha 用量 ↔ 插件登记表
  UndeterminedError,
  ALPHA_PLUGIN_REL,
  ALPHA_PRESET_REL,
  ALPHA_TOKENS_REL,
  ALPHA_SCAN_FACES,
  ALPHA_V4_FACES,
  ALPHA_V3_SCAN_FACES,
  isV4Face,
  ALPHA_SCAN_EXT,
  ALPHA_EXEMPT_RE,
  parseLiteralObject,
  extractObjectBody,
  flattenColorTiers,
  maskComments,
  extractAlphaUsages,
  checkAlphaUsage,
  checkAlphaChannelVars,
  collectAlphaCorpus,
  loadAlphaPlugin,
  readAlphaRegistry,
  runR6,
  // R8(2026-09-25):手抄色值回潮 ↔ RN 派生面。两个常量**不进本对象** —— 它们是 __test__ 之后
  // 才声明的 const,写在这里会撞 TDZ(模块求值期 ReferenceError);函数声明有提升故可列。
  // 测试要取常量请从模块命名空间取(import 的活绑定在求值完成后才读)。
  indexDerivedColors,
  extractHandCopiedColors,
  pickFreshHandCopies,
  runR8,
}

if (isDirectRun)
  main().catch((e) => {
    // 脚本自身异常(含"无法判定")= exit 2:不冒判据红,更绝不记绿
    // 「无法判定」是预期结论,一句话足够;但**任何其他异常**都必须带栈落地 —— 本门此前偶发
    // `Cannot read properties of undefined (reading 'length')` 且只打 message,三轮复跑就再也
    // 复现不出来(全量模式一次崩、三次正常)。匿名 exit 2 = 不可诊断 = 下一任只能重新猜。
    if (e instanceof UndeterminedError) console.error(`❌ 无法判定:${e?.message ?? e}`)
    else console.error(`❌ 本门自身异常(非"无法判定"路径):\n${e?.stack ?? e}`)
    process.exit(2)
  })

async function main() {
  await cli()
}

/** 按判定面读出 R6 的三份输入:登记表 / preset colors / tokens.css 变量表。三者必须同面。 */
/** 索引里有未合并路径(merge/rebase 进行中)时 `:<path>` 是有歧义的 stage 号,读出来既不是索引
 *  也不是工作树 ⇒ 一律判"无法判定",绝不猜一个 stage 用(与守门 94/101 同一口径)。 */
export function assertUnmergedClean(face) {
  if (face === 'staged' && gitExec(['ls-files', '-u', '-z']).length > 0)
    throw new UndeterminedError(
      '索引存在未合并路径(merge/rebase 进行中),索引面取材有歧义 ⇒ 无法判定,先收敛 merge',
    )
}

/**
 * 按判定面取一批文件的**文本** —— 本门所有取材都走这一个出口。
 *
 * 为什么强调"一个出口":这道门此前 R1/R2/R4/R5 直接 `readFileSync` 磁盘,而 R3/R6/R7 判 HEAD/索引,
 * 于是同一枚提交里"两份色值表是否同源"看的是磁盘、"这些色值有没有被各端引用"看的是仓库 ——
 * 一次本地未提交的 token 改动能让前半段报红而后半段报绿,结论取决于谁先看。AGENTS 给它写的
 * 口径是"全量判 HEAD blob、--staged 判索引",本门此前只对了一半。
 */
export function readFaceText(face, rels) {
  if (face === 'worktree') {
    return rels.map((rel) => {
      const t = readWorktreeFile(root, rel)
      if (t === null || t === undefined) throw new UndeterminedError(`工作树(逃生舱)取不到 ${rel}`)
      return t
    })
  }
  assertUnmergedClean(face)
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const map = readBlobs(rels.map((rel) => prefix + rel))
  return rels.map((rel) => {
    const got = map.get(prefix + rel)
    if (got === null || got === undefined)
      throw new UndeterminedError(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rel}`)
    return got
  })
}

/** R1/R2/R4/R5 的两份输入:RN 色值表 + web tokens.css。返回**未剥注释**原文,由调用方按判据需要剥。 */
export function readTokenSources(face) {
  const [rn, css] = readFaceText(face, [RN_TOKENS_REL, TOKENS_CSS_REL])
  return { rn, css }
}

export function readAlphaRegistry(face) {
  const [pluginTxt, presetTxt, tokensTxt] = readFaceText(face, [
    ALPHA_PLUGIN_REL,
    ALPHA_PRESET_REL,
    ALPHA_TOKENS_REL,
  ])
  const usage = parseLiteralObject(
    extractObjectBody(
      // 锚点带 `^` 就必须带 m flag:写 `/^…/` 而漏 m 时 `^` 只认串首,整张表变成"取不到"
      // (本门第一版就是这样,`--self-test` 的"锚点带 ^ 必须多行命中"用例钉死这个回归)
      maskComments(pluginTxt, false),
      /^export const ALPHA_USAGE\s*=\s*\{/m,
    ),
  )
  const colors = parseLiteralObject(
    extractObjectBody(maskComments(presetTxt, false), /\bcolors\s*:\s*\{/),
  )
  const cssSrc = stripCssComments(tokensTxt)
  const cssLight = mergeCssVars(cssSrc, ['@theme', ':root'])
  return {
    usage,
    colors,
    cssLight,
    cssDark: { ...cssLight, ...mergeCssVars(cssSrc, ['.dark']) },
    faces: { pluginTxt, presetTxt },
  }
}

/** R6 全流程:取面 → 抽用量 → 对账。返回 failures 数组 + 计数,供 cli 与自检共用。 */
/**
 * R7:v3 端「裸 rpx 长度」被解析成颜色属性。
 * 实测(v3.4.19 + 隔离夹具,逐条摘录见 PROJECT_PLAN O62附④):
 *   `text-[28rpx]` → `color: 28rpx`、`border-[2rpx]` → `border-color: 2rpx`、
 *   `border-t-[1rpx]` → `border-top-color: 1rpx`(b/l/r 同理;x/y 落两轴 color,
 *   s/e 落 border-inline-*-color)、`divide-[2rpx]` → 子元素 `border-color`、
 *   `ring-[6rpx]` → `--tw-ring-color`、`outline-[2rpx]` → `outline-color` —— 全部无效且不报错。
 *   而 `text-[13px]` / `border-t-[1px]` / `ring-[6px]` / `outline-[2px]` 本就正确落
 *   font-size / border-*-width / ring width / outline-width。**决定对错的是单位不是前缀** ——
 *   只有 rpx 这一族坏,因为 v3 的类型推断认得 px/rem/em、不认 rpx(量错的二进制不得引用结论:
 *   端内 node_modules 是 v3.4.19,根 node_modules 是 v4,v4 认任意单位)。
 * 覆盖面按实测划定,两处**刻意不收**(收了就是噪音红,判据不得覆盖本来就对的形态):
 *   ① `divide-x-[Nrpx]` / `divide-y-[Nrpx]`(轴形式)落 border-*-width,正确;
 *   ② `w-/h-/p-/m-/gap-/top-…` 等单类型 length 插件对 rpx 是透传(width: 10rpx),正确。
 * 正解 = 显式类型前缀:`border-t-[length:1rpx]`(夹具实测落 border-top-width);
 * 裸 `divide-[Nrpx]` 的正解是改用轴形式(它想表达的若是线宽)。
 */
export const R7_PREFIX_ALT = 'border-(?:[tblrxyse])|border|text|divide|ring|outline'
/** fam → v3 实际落到的(错误)属性,全部来自上方隔离夹具的逐字摘录。 */
export const R7_WRONG_PROP = {
  text: 'color',
  border: 'border-color',
  'border-t': 'border-top-color',
  'border-b': 'border-bottom-color',
  'border-l': 'border-left-color',
  'border-r': 'border-right-color',
  'border-x': 'border-left-color + border-right-color',
  'border-y': 'border-top-color + border-bottom-color',
  'border-s': 'border-inline-start-color',
  'border-e': 'border-inline-end-color',
  divide: 'border-color(子元素)',
  ring: '--tw-ring-color',
  outline: 'outline-color',
}
export function extractBareRpxLengths(masked, original) {
  const hits = []
  let undetermined = 0
  // `border-(?:[tblrxyse])` 必须排在 `border` 之前:alternation 取先命中者,反过来
  // "border-t-[1rpx]" 会在 "border" 分支上因后随 "-t" 而非 "-[" 而整体退空。
  // 同一次命中也保证 divide-x/divide-y 不被误收("divide" 分支要求紧跟 "-[")。
  const re = new RegExp(`\\b(${R7_PREFIX_ALT})-\\[(\\d+(?:\\.\\d+)?)rpx\\]`, 'g')
  for (const m of masked.matchAll(re)) {
    const at = m.index
    const col = masked.slice(0, at).split('\n').pop().length
    const line = masked.split('\n')[masked.slice(0, at).split('\n').length - 1]
    const ln = masked.slice(0, at).split('\n').length
    hits.push({ fam: m[1], value: `${m[2]}rpx`, key: `${m[1]}-[${m[2]}rpx]`, ln, col, line: line.trim().slice(0, 120) })
  }
  // 括号里带插值的任意值(如 `text-[${size}rpx]`)结构上判不出单位,只报数不判红。
  // 刻意只认"方括号内部含 ${"这一形态 —— 早先用"全文任意插值"计数会报出上千处,
  // 那个数字与判据无关,只会让报告里的"判不出"看起来像一批待办。
  const dyn = original.match(new RegExp(`\\b(?:${R7_PREFIX_ALT})-\\[[^\\]]*\\$\\{[^\\]]*\\]`, 'g')) || []
  undetermined += dyn.length
  return { hits, undetermined }
}

export async function runR7({ face, quiet }) {
  const corpus = collectAlphaCorpus({ face })
  const scanOne = (getKey) => {
    const list = []
    let und = 0
    for (const { rel, head, eff } of corpus) {
      const isCss = /\.(css|scss)$/.test(rel)
      const src = getKey === 'eff' ? eff : head
      if (src === undefined) continue
      const { hits, undetermined } = extractBareRpxLengths(maskComments(src, isCss), src)
      und += undetermined
      for (const h of hits) list.push({ ...h, rel })
    }
    return { hits: list, undetermined: und }
  }
  const sEff = scanOne('eff')
  // 非默认档都要 HEAD 侧基线:棘轮比的是"本次新引入",工作树档同理(磁盘 vs HEAD)
  const sHead = face === 'head' ? null : scanOne('head')
  const headKeys = sHead ? new Set(sHead.hits.map((h) => `${h.rel} ${h.key}`)) : null

  const fresh = headKeys ? sEff.hits.filter((h) => !headKeys.has(`${h.rel} ${h.key}`)) : sEff.hits

  const failures = []
  for (const h of fresh.slice(0, 12)) {
    const prop = R7_WRONG_PROP[h.fam] || '颜色属性'
    const fix =
      h.fam === 'divide'
        ? '改法:改用轴形式 `divide-x-[…rpx]` / `divide-y-[…rpx]`(轴形式在 v3 下本就落 border-*-width);裸 divide-[<rpx>] 会被当作 divide 的颜色档'
        : `改法:加显式类型前缀 \`${h.fam}-[length:${h.value}]\`。`
    failures.push({
      tag: `R7 裸 rpx 长度 ${h.key}`,
      detail: `${h.rel}:${h.ln} —— v3 不认 rpx 单位,会把它解析成**颜色属性**` +
        `(\`${h.key}\` → ${prop}: ${h.value}),整条声明无效。` + fix,
    })
  }
  if (fresh.length > 12) failures.push({ tag: 'R7 裸 rpx 长度', detail: `…另有 ${fresh.length - 12} 处` })

  const counts = {
    files: corpus.length,
    checked: sEff.hits.length,
    fresh: fresh.length,
    undetermined: sEff.undetermined,
  }
  if (!quiet)
    console.log(
      `  · R7:${counts.files} 文件里抽到 ${counts.checked} 处裸 rpx 长度` +
        `(本次新引入 ${counts.fresh}${face === 'head' ? '' : ',HEAD 存量不计=棘轮'}),` +
        `判不出形态 ${counts.undetermined} 处(不判红),口径 ${face}`,
    )
  return { failures, counts }
}

// ─── R8:手抄色值回潮 ↔ RN 派生面(2026-09-25)───
/**
 * 判的是「生成器已经把这一档送到端上了,组件里却又写回一份字面量」—— 即 AGENTS §4
 * 「端内 CSS/色值副本一律是派生态,禁止手抄」在共享 RN 代码里那一格。此前本门只核
 * **两份色值表是否同源**(R1/R4)与**端内有没有自立品牌档**(R2/R3),而组件里写死
 * `'#C41E7A'` 结构上不在任何一判据的射程内:表同源、键已声明,门一路绿灯,而派生器一改
 * 源值这一处就静默掉队(2026-09-25 实测:modelType 六色 + agentName 共 7 处即此型)。
 *
 * 判据是**派生出来的集合**而不是手工清单(手工清单必腐烂,本仓记过多次):
 * 禁用值 = RN 三张表里「能按名推到同名 CSS 变量且两侧同值」的那些档的颜色值。
 * 所以 modelType / agentName 一旦进 rn-tokens.ts,组件里再写这些字面量就自动纳判,
 * 不需要任何人再登记一次;反过来,源里根本没有对应档的自造色不属本判据(那是 R2/R4 的地盘)。
 *
 * 宁漏不误报的三条窄口径:① 只认 `#hex` 字面量(rgba/hsl 形态与注释文本一律不判);
 * ② 只扫 HAND_COPY_SCAN_FACES(apps/mobile-rn/src 的同一型由
 *    scripts/check-mobile-rn-style-parity.mjs 的基线棘轮管,两端互补不互替);
 * ③ 存量按 HEAD 棘轮只报数 —— 与无关提交过不去的 blocking 红只会逼人 --no-verify、
 *    连带废掉全部守门(§12e 同型),本次新引入的那一枚才判红。
 * 行内出口:`handcopy-token-exempt: <原因>`,须带原因,且只救本行或紧邻上一行(同 R6 口径)。
 */
export const HAND_COPY_SCAN_FACES = ['packages/app/src']
export const HAND_COPY_EXEMPT_RE = /handcopy-token-exempt:\s*\S/
/**
 * 纯黑 / 纯白刻意**不入禁用集**(归一后已把 #fff / #000 展开成六位)。
 * 理由不是"判不出来",而是本仓合同明确允许把它们当常量写:rn-tokens.ts 的 surface.light 文档块原文
 * 「真正需要品牌色上的白字…应使用 brand.foreground…**或直接用 #FFFFFF 常量**」。
 * 收进来只会给别人的正当写法(遮罩上的白字、图片上的黑底)制造噪音红,
 * 而噪音红的代价本仓记过很多次:逼人 --no-verify,连带废掉全部守门。
 */
export const HAND_COPY_NEUTRALS = new Set(['#ffffff', '#000000'])
const HEX_LEAF_RE = /^\s*#[0-9a-f]{3,8}\s*$/i

/** RN 派生面上「与源同值」的颜色 → 出处(表.路径 + 同名 CSS 变量),供报错文案点名该走哪一档。 */
export function indexDerivedColors({ leavesByConst, cssLight, cssDark }) {
  const idx = new Map()
  for (const [constName, leaves] of Object.entries(leavesByConst)) {
    const table = constName === 'rnDarkTokens' ? cssDark : cssLight
    for (const lf of leaves) {
      if (!HEX_LEAF_RE.test(lf.value)) continue
      const varName = deriveCssVarNames(lf.path).find((c) => c in table)
      if (!varName) continue
      // 值不同即不收录:那一档正被 R4 判红(或已登记分歧),本门不得替它背书"组件也该用这个值"
      if (!colorsAgree(lf.value, table[varName])) continue
      const norm = normalizeColor(lf.value)
      if (HAND_COPY_NEUTRALS.has(norm)) continue
      if (!idx.has(norm)) idx.set(norm, { rnPath: `${constName}.${lf.path}`, cssVar: varName })
    }
  }
  return idx
}

/** 从(已剥注释的)源码里抽出与派生面同值的 hex 字面量。`original` 必须是剥注释前的原文(豁免写在注释里)。 */
export function extractHandCopiedColors(masked, original, valueIndex) {
  const hits = []
  const rawLines = original.split('\n')
  // 大小写都要认:派生面上大量档写的是 **#FFFFFF / #C41E7A** 这类大写形态,
  // 只写 [0-9a-f] 会让"手抄回去的那一枚"正好隐身(本门首版即如此,由自检的阳性对照抓出)。
  const re = /#([0-9a-fA-F]{3,8})\b/g
  let m
  while ((m = re.exec(masked)) !== null) {
    const norm = normalizeColor(m[0])
    const via = valueIndex.get(norm)
    if (!via) continue
    const line = masked.slice(0, m.index).split('\n').length - 1
    const exempt =
      HAND_COPY_EXEMPT_RE.test(rawLines[line] || '') ||
      HAND_COPY_EXEMPT_RE.test(rawLines[line - 1] || '')
    hits.push({
      hex: norm,
      key: norm,
      ln: line + 1,
      line: (rawLines[line] || '').trim().slice(0, 120),
      exempt,
      via,
    })
  }
  return { hits }
}

/** 棘轮对账:本次判定面上出现、而 HEAD 那一面没有的 (文件, 色值) 才判红。 */
export function pickFreshHandCopies(effHits, headHitKeys) {
  if (headHitKeys === null) return { fresh: effHits.filter((h) => !h.exempt), inherited: 0 }
  const fresh = []
  let inherited = 0
  for (const h of effHits) {
    if (headHitKeys.has(`${h.rel} ${h.key}`)) {
      inherited++
      continue
    }
    if (!h.exempt) fresh.push(h)
  }
  return { fresh, inherited }
}

export async function runR8({ face, quiet }) {
  const src = readTokenSources(face)
  const rnSrc = stripTsComments(src.rn)
  const cssSrc = stripCssComments(src.css)
  const cssLight = mergeCssVars(cssSrc, ['@theme', ':root'])
  const cssDark = { ...cssLight, ...mergeCssVars(cssSrc, ['.dark']) }
  const leavesByConst = {}
  for (const name of ['rnTokens', 'rnLightTokens', 'rnDarkTokens']) {
    const body = extractTsObjectBody(rnSrc, name)
    if (body === null)
      throw new UndeterminedError(`R8 在 rn-tokens.ts 里定位不到 export const ${name} ⇒ 无法判定`)
    leavesByConst[name] = objectLeaves(body, [])
  }
  const valueIndex = indexDerivedColors({ leavesByConst, cssLight, cssDark })
  if (valueIndex.size === 0)
    throw new UndeterminedError('R8 的禁用值集合取到 0 条(派生面为空)= 判据失明,不记为通过')

  const corpus = collectAlphaCorpus({ face, faces: HAND_COPY_SCAN_FACES, allowEmpty: true })
  const emptyFace = corpus.length === 0
  const scanOne = (getKey) => {
    const list = []
    for (const { rel, head, eff } of corpus) {
      const src0 = getKey === 'eff' ? eff : head
      if (src0 === undefined) continue
      for (const h of extractHandCopiedColors(maskComments(src0, false), src0, valueIndex).hits)
        list.push({ ...h, rel })
    }
    return list
  }
  const sEff = scanOne('eff')
  const sHead = face === 'head' ? null : scanOne('head')
  const headKeys = sHead ? new Set(sHead.map((h) => `${h.rel} ${h.key}`)) : null
  const { fresh, inherited } = pickFreshHandCopies(sEff, headKeys)
  const exempted = sEff.filter((h) => h.exempt).length

  const failures = []
  for (const h of fresh.slice(0, 12))
    failures.push({
      tag: `R8 手抄色值回潮 ${h.rel}:${h.ln} ${h.hex}`,
      detail:
        `${h.line} —— 这个色值已由 tokens.css 经 scripts/sync-rn-tokens.mjs 派生进 RN 令牌表` +
        `(档:${h.via.rnPath} ← ${h.via.cssVar}),组件里再写一份字面量就是第二真相:源改色时它不跟随。` +
        `改法是取同一份主题袋(tk.modelType.* / tk.agentName.DEFAULT,或 mobile-rn 的 tokens.*)。` +
        `确属不该同源时写行内 handcopy-token-exempt: <原因>`,
    })
  if (fresh.length > 12)
    failures.push({ tag: 'R8 手抄色值回潮', detail: `…另有 ${fresh.length - 12} 处` })

  const counts = {
    files: corpus.length,
    checked: sEff.length,
    fresh: fresh.length,
    inherited,
    exempted,
    values: valueIndex.size,
    emptyFace,
  }
  if (!quiet)
    console.log(
      `  · R8:${counts.files} 文件(禁用值集 ${counts.values} 条,派生自 RN 令牌表 ↔ tokens.css 同值档)里抽到 ` +
        `${counts.checked} 处同值 hex 字面量(本次新引入 ${counts.fresh}${face === 'head' ? '' : `,HEAD 存量 ${inherited} 不计=棘轮`},` +
        `已豁免 ${counts.exempted})` +
        (emptyFace ? ' —— ⚠️ 扫描面为空,本判据本轮未生效(不记为通过)' : '') +
        `,口径 ${face}`,
    )
  return { failures, counts }
}

export async function runR6({ face, quiet }) {  const reg = readAlphaRegistry(face)
  const plugin = await loadAlphaPlugin()
  const tiers = flattenColorTiers(reg.colors)
  const corpus = collectAlphaCorpus({ face })
  const scanOne = (getKey) => {
    const list = []
    let und = 0
    for (const { rel, head, eff } of corpus) {
      const isCss = /\.(css|scss)$/.test(rel)
      const src = getKey === 'eff' ? eff : head
      if (src === undefined) continue
      const { tokens, undetermined: un } = extractAlphaUsages(maskComments(src, isCss), {
        tiers,
        isCss,
        original: src,
      })
      und += un.length
      for (const t of tokens) list.push({ ...t, rel })
    }
    return { tokens: list, undetermined: und }
  }
  const sEff = scanOne('eff')
  // HEAD 侧的腐烂是"存量债":staged 面只拦本次提交新造出来的那些(棘轮,同守门 77/83/98 的取向)。
  // 全量面没有"上一枚提交"可言,故 baseline 为 null = 全部照红。
  // 非默认档都要 HEAD 侧基线:棘轮比的是"本次新引入",工作树档同理(磁盘 vs HEAD)
  const sHead = face === 'head' ? null : scanOne('head')
  const baseRot = sHead
    ? new Set(
        checkAlphaUsage({
          usages: sHead.tokens.filter((x) => !isV4Face(x.rel)),
          usage: reg.usage,
          colors: reg.colors,
          plugin,
        }).rot.map((x) => x.key),
      )
    : null
  const usages = sEff.tokens.filter((x) => !isV4Face(x.rel))
  const v4Only = sEff.tokens.length - usages.length
  const undetermined = sEff.undetermined
  const r = checkAlphaUsage({ usages, usage: reg.usage, colors: reg.colors, plugin, baselineRot: baseRot })
  const chans = checkAlphaChannelVars({
    usage: reg.usage,
    colors: reg.colors,
    cssLight: reg.cssLight,
    cssDark: reg.cssDark,
    plugin,
  })
  const failures = []
  for (const x of r.missing)
    failures.push({
      tag: `R6 未登记的 alpha 用量 ${x.key}`,
      detail: `${x.rel}:${x.line + 1} —— v3 端写得出这个类名但**根本不产出 CSS**(typecheck/lint/build 全不红)。` +
        `修复出口:` + `node scripts/sync-alpha-usage.mjs` + `(表由用量导出,勿手改 ALPHA_USAGE;` +
        `它会在 ${ALPHA_PLUGIN_REL} 里原位写入 ${x.tier}: { …, ${x.kind}: [..., '${x.mod}'] })。` +
        `仅当该形态确属不该登记时,才用行内 alpha-plugin-exempt: <原因>。`,
    })
  for (const x of r.unsupportedKind)
    failures.push({
      tag: `R6 插件不支持的前缀 ${x.key}`,
      detail:
        `${x.rel}:${x.line + 1} —— 档位来自 preset(v3 解析不出 var() 的通道),而 ${ALPHA_PLUGIN_REL} 的前缀能力表只有 ` +
        `${Object.keys(plugin.ALPHA_UTILITY_KINDS).join('/')} ⇒ 这条类名静默零产出。确需支持要先在该表复刻输出形状(见插件头注"已知边界"),或写 ${x.key} 的等价写法;临时出口 \`alpha-plugin-exempt: 原因\``,
    })
  for (const x of r.unproduced)
    failures.push({
      tag: `R6 登记了却没产出选择器 ${x.key}`,
      detail: `${x.rel}:${x.line + 1} —— buildAlphaUtilities 未生成该选择器(档取不出单一 var / 修饰符解析不出数值)`,
    })
  for (const x of r.buildIssues)
    failures.push({
      tag: `R6 登记表自身产不出内容:${x}`,
      detail: `ALPHA_USAGE 里的这一项在 preset colors 里解析不出 CSS 变量或不支持前缀,必须修表或修 preset`,
    })
  for (const x of r.rot)
    failures.push({
      tag: `R6 清单腐烂:${x.key}`,
      detail: `登记在 ALPHA_USAGE 里,但 v3 三个消费端源码已无人写它 —— 每条登记都等于往小程序主包塞一条死规则(插件头注:登记表大小 = 样式表增量),请删除该行`,
    })
  for (const x of chans.missingLight)
    failures.push({
      tag: `R6 缺通道三元组变量 ${x.chan}`,
      detail: `tokens.css 的 @theme/:root 未声明它 ⇒ 插件产出的是一条 alpha 函数包着未定义变量的声明,整条被丢弃(与未登记同后果)。新增档位必须同时补 :root 与 .dark 两份三元组`,
    })
  if (!quiet) {
    for (const x of chans.missingDark)
      console.log(
        `  ⚠️ NOTICE ${x.chan} 在 tokens.css 的 .dark 未声明 ⇒ 暗档 alpha 沿 cascade 用亮档值(可见但偏色),不判红、待人工定档`,
      )
    console.log(
      `  · R6:${corpus.length} 个文件里抽到 ${r.checked} 处需登记的 v3 端 alpha 类名(preset 档 ${r.checked} / 默认色板 ${r.nonPreset} / 已豁免 ${r.exempted};另有 v4 端 ${v4Only} 处不判),` +
        `登记 ${Object.values(reg.usage).reduce((a, b) => a + Object.values(b).reduce((x, y) => x + y.length, 0), 0)} 形态,` +
        `判不出形态 ${undetermined} 处(不判红),腐烂 新增 ${r.rot.length} / HEAD 存量 ${r.rotInherited} 不计,` +
        `口径 ${FACE_TXT[face]}`,
    )
  }
  return { failures, counts: { files: corpus.length, tokens: usages.length, ...r, undetermined } }
}

async function cli() {
  if (SELF_TEST) process.exit(await selfTest())
  if (listOnly) {
    console.log('check-cross-end-tokens.mjs 映射表(RN rn-tokens.ts ↔ tokens.css):')
    for (const [i, mp] of MAPPINGS.entries())
      console.log(`  ${i + 1}. ${mp.label}\n     依据: ${mp.basis}`)
    process.exit(0)
  }

  if (!quiet) console.log('[check-cross-end-tokens] Checking rn-tokens.ts vs tokens.css...')

  const src0 = readTokenSources(face)
  const rnSrc = stripTsComments(src0.rn)
  const cssSrc = stripCssComments(src0.css)

  const rnBodies = {}
  for (const name of ['rnTokens', 'rnLightTokens', 'rnDarkTokens']) {
    rnBodies[name] = extractTsObjectBody(rnSrc, name)
    if (rnBodies[name] === null) {
      console.error(`[check-cross-end-tokens] ❌ 无法在 rn-tokens.ts 中定位 export const ${name}`)
      process.exit(1)
    }
  }

  // tokens.css: @theme + :root = 亮色;.dark = 暗色(未覆盖变量 cascade 回退亮色)
  const cssVarsLight = mergeCssVars(cssSrc, ['@theme', ':root'])
  const cssVarsDark = { ...cssVarsLight, ...mergeCssVars(cssSrc, ['.dark']) }

  const failures = []
  let checked = 0
  for (const mp of MAPPINGS) {
    for (const mode of ['light', 'dark']) {
      const rnPath = mp.rn[mode]
      const cssVar = mp.css[mode]
      if (!rnPath || !cssVar) continue
      checked++
      const rnVal = resolveTsPath(rnBodies[rnPath[0]], rnPath.slice(1))
      const table = mode === 'dark' ? cssVarsDark : cssVarsLight
      const cssVal = cssVar in table ? table[cssVar] : null
      const tag = `${mp.label} [${mode}]`
      if (rnVal === null || cssVal === null) {
        failures.push({
          tag,
          detail: `提取失败: rn='${rnVal ?? '<missing>'}' css='${cssVal ?? '<missing>'}'`,
        })
        continue
      }
      if (!colorsAgree(rnVal, cssVal))
        failures.push({ tag, detail: `rn='${rnVal}' vs css='${cssVal}'` })
    }
  }

  // ── R2 品牌键覆盖 + R3 悬空引用(反"端内自立一档",见文件头说明) ──
  const declared = declaredBrandKeys(MAPPINGS)
  const brand = checkBrandKeys({ bodies: rnBodies, declared, allowlist: RN_ONLY_BRAND_KEYS })
  for (const b of brand.bad)
    failures.push({
      tag: `R2 未声明的品牌档 ${b.where}.brand.${b.key}`,
      detail: `web 侧没有对应 CSS 变量、也没登记豁免理由 —— 品牌色必须在 tokens.css 有唯一出口(如 --color-primary)后登记映射;确属 RN 专属则在 RN_ONLY_BRAND_KEYS 写明原因`,
    })
  for (const s of brand.stale)
    failures.push({
      tag: `R2 豁免清单腐烂`,
      detail: `RN_ONLY_BRAND_KEYS 里的 '${s}' 在 rn-tokens 已不存在,请删除该条`,
    })

  // ── R4 基础档按名推导对账 + R5 端内两表自洽(反"只核手工映射"的盲区,见文件头) ──
  const leavesByConst = {}
  for (const name of ['rnTokens', 'rnLightTokens', 'rnDarkTokens'])
    leavesByConst[name] = objectLeaves(rnBodies[name] || [], [])
  const base = checkBasePalette({
    leavesByConst,
    cssLight: cssVarsLight,
    cssDark: cssVarsDark,
    registered: BASE_CONFLICTS,
  })
  for (const d of base.drift)
    failures.push({
      tag: `R4 基础档跨端漂移 ${d.key} [${d.mode}]`,
      detail:
        `rn='${d.rn}' vs ${d.css}='${d.cssVal}' —— 同名 CSS 变量已存在,两侧必须同值;` +
        `确属语义不同请在 BASE_CONFLICTS 登记"哪一侧是什么/为什么不能对齐/改动代价",不得静默择一`,
    })
  for (const s of base.stale)
    failures.push({
      tag: 'R4 冲突登记表腐烂',
      detail: `BASE_CONFLICTS 里的 '${s}' 已不再冲突(有人对齐了却没删登记),请删除该条`,
    })

  const intra = checkIntraPalette({
    base: leavesByConst.rnTokens,
    light: leavesByConst.rnLightTokens,
  })
  for (const i of intra)
    failures.push({
      tag: `R5 端内两表分叉 ${i.path}`,
      detail:
        `rnTokens(遗留基表)='${i.base}' vs rnLightTokens='${i.light}' —— packages/app 以 tokens 之名导出的就是基表,` +
        `两张表同路径不同值 = 落后那份才是实际渲染出来的;对齐方向取 web tokens.css 的现值`,
    })

  // R3 扫**仓库内容**,缺省不扫共享工作树的未提交缓冲区(并行会话的半截草稿不该钉红别人的提交):
  //   缺省 = HEAD;--staged = 只判"索引 ≠ HEAD"的路径的索引 blob(= 这次提交会带走的内容);
  //   --worktree = 人工逃生舱,扫跟踪文件的工作树内容(改完 token 想看效果时用,提交链永不走这档)。
  //   注意 `git grep --cached` 扫的是**整个索引**(所有跟踪文件),不是暂存变更集 —— 首跑直接用它
  //   把八竿子不着的历史内容判出 81 处,故必须自己取"暂存变更集"再逐个读索引 blob。
  // 只扫 apps/ + packages/ 的 ts/tsx:scripts/ 下的守门脚本与文档会在注释里提到已退役的档名(ctaFill 即此),
  // 那不是引用,不需要为它们再发明一套豁免语法。
  const refs = []
  // `-c safe.directory=*` 由层统一前置,这里只写本子命令自己的参数。
  const GREP = ['grep', '-n', '--no-color', '-e', '\\.brand\\.']
  try {
    if (face !== 'staged') {
      // HEAD 档带 rev;工作树档不带 rev(git 即按跟踪文件的工作树内容搜)
      refs.push(
        ...gitExec([...GREP, ...(face === 'head' ? ['HEAD'] : []), '--', 'apps', 'packages'])
          .split('\n')
          .filter(Boolean),
      )
    } else {
      const staged = gitExec(['diff', '--name-only', '--cached', '--', 'apps', 'packages'])
        .split('\n')
        .filter((f) => /\.(ts|tsx)$/.test(f))
      // 一批 blob 一次取,不再逐文件派生 git。旧写法每个暂存文件起一个进程,且 `git show :path`
      // 抛错就在内层 `catch { continue }` 里被吞掉 —— 那不只吞"本次删除的路径"(合法),
      // 也吞真取材失败(少扫不红 = 假绿)。层的 readBlobs 把取不到的记 null、把截断抛出来。
      const blobs = readBlobs(staged.map((rel) => `:${rel}`))
      for (const rel of staged) {
        const blob = blobs.get(`:${rel}`)
        if (blob === null || blob === undefined) continue // 本次删除的路径:索引里已无内容
        blob.split('\n').forEach((l, i) => {
          if (/\.brand\./.test(l)) refs.push(`${rel}:${i + 1}:${l}`)
        })
      }
    }
  } catch (e) {
    if (e && e.status === 1) {
      /* git grep 无命中 = 退出码 1,属正常 */
    } else {
      failures.push({
        tag: 'R3 悬空引用',
        detail: `git 未能执行(${String((e && e.message) || e).slice(0, 90)}),按失败处理,不静默放行`,
      })
    }
  }
  const allowedKeys = new Set([...declared, ...Object.keys(RN_ONLY_BRAND_KEYS)])
  const dangling = []
  for (const line of refs)
    for (const d of danglingBrandRefs(line, allowedKeys)) dangling.push({ line, ...d })
  for (const d of dangling.slice(0, 12))
    failures.push({
      tag: 'R3 悬空 brand 引用',
      detail: `${d.line.slice(0, 120)} —— '${d.key}' 不是已声明的品牌档(可用:${[...allowedKeys].join('/')});CTA 一律 brand.DEFAULT + brand.foreground`,
    })
  if (dangling.length > 12)
    failures.push({ tag: 'R3 悬空 brand 引用', detail: `…另有 ${dangling.length - 12} 处` })

  // ── R6:v3 端 /alpha 用量 ↔ tailwind-alpha-plugin 登记表(AGENTS §4 那条散文规则的唯一判据) ──
  const r6 = await runR6({ face, quiet })
  failures.push(...r6.failures)

  // ── R7:v3 端裸 rpx 长度被解析成颜色属性(AGENTS §4 那条 rpx 规则的唯一判据) ──
  const r7 = await runR7({ face, quiet })
  failures.push(...r7.failures)

  // ── R8:手抄色值回潮 ↔ RN 派生面(AGENTS §4「端内色值副本一律是派生态」在共享 RN 代码里的判据) ──
  const r8 = await runR8({ face, quiet })
  failures.push(...r8.failures)

  if (failures.length === 0) {
    if (!quiet)
      console.log(
        `[check-cross-end-tokens] ✅ ${checked} 条映射逐位同值 + R4 基础档按名推导 ${base.checked} 条同值` +
          `(已登记分歧 ${Object.keys(BASE_CONFLICTS).length} 条) + R5 端内两表 ${intra.length === 0 ? '同值' : '分叉'} + ` +
          `品牌键全部已声明(${[...allowedKeys].join('/')}) + 无悬空 brand 引用 + ` +
          `R6 alpha 用量 ${r6.counts.checked} 处全部已登记且真产出(${r6.counts.files} 文件,口径 ${FACE_TXT[face]}) + ` +
          `R7 裸 rpx 长度 ${r7.counts.checked} 处(已全部改为 [length:] 形态) + ` +
          `R8 手抄色值 ${r8.counts.fresh} 处新增(${r8.counts.checked} 处同值字面量,存量 ${r8.counts.inherited} 按棘轮放过)`,
      )
    process.exit(0)
  }

  console.error(
    `[check-cross-end-tokens] Found ${failures.length} problem(s) (映射对账 ${checked} 条,R4 推导面 ${base.checked} 条):`,
  )
  for (const f of failures) console.error(`  ❌ ${f.tag}: ${f.detail}`)
  console.error(
    '  值不一致 = 两端有一侧改了没同步,请人工决策对齐方向;R2/R3 = 品牌色不得在端内自立一档(AGENTS §4 跨端同源);' +
      'R6 = 新写/新登记的 /alpha 形态必须两边对上(AGENTS §4「新增颜色档必须同时进这个插件」的唯一判据);' +
      'R7 = 裸 rpx 长度必须加显式 type 前缀(覆盖面 = text/border + border 八方向 + 裸 divide + ring + outline;divide-x/y、w/p/gap 与一切 px/rem 形态本就落对属性,不得拦)。' +
      'R8 = 已由 tokens.css 派生进 RN 令牌表的色值不得在共享 RN 组件里再写一份字面量(禁用集是派生出来的,不是手工清单;存量走 HEAD 棘轮,只拦本次新引入)。',
  )
  process.exit(1)
}

// ─── 自检(不读真仓,纯判据正反例;--self-test) ───
async function selfTest() {
  const bodies = {
    ok: `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF' },
`,
    forked: `
  brand: { DEFAULT: '#000000', foreground: '#FFFFFF', ctaFill: '#000000', ctaText: '#FFFFFF', dark: '#34D399' },
  surface: { light: '#FFFFFF' },
`,
  }
  const declared = declaredBrandKeys(MAPPINGS)
  const cases = [
    {
      name: 'brand 键全部已声明 → 绿',
      got: checkBrandKeys({ bodies: { a: bodies.ok }, declared, allowlist: RN_ONLY_BRAND_KEYS }),
      wantBad: 0,
      wantStale: 0,
    },
    {
      name: '自立 ctaFill/ctaText → 红并点名两键',
      got: checkBrandKeys({
        bodies: { a: bodies.forked },
        declared,
        allowlist: RN_ONLY_BRAND_KEYS,
      }),
      wantBad: 2,
      wantStale: 0,
    },
    {
      name: '键集合解析不误伤兄弟命名空间(surface.light 不算 brand 键)',
      got: { bad: namespaceKeys(bodies.ok, 'surface').map((k) => ({ key: k })), stale: [] },
      wantBad: 1,
      wantStale: 0,
    },
  ]
  let fail = 0
  for (const c of cases) {
    const badN = c.got.bad ? c.got.bad.length : 0
    const staleN = c.got.stale ? c.got.stale.length : 0
    const ok = badN === c.wantBad && staleN === c.wantStale
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} ${c.name} (bad=${badN}/${c.wantBad} stale=${staleN}/${c.wantStale})`,
    )
  }
  const allowed = new Set([...declared, ...Object.keys(RN_ONLY_BRAND_KEYS)])
  const refCases = [
    { name: 'R3 已声明档 → 不报', text: 'const x = tk.brand.DEFAULT', want: 0 },
    {
      name: 'R3 退役档必须报(8 个滞后草稿就是这个形态)',
      text: 'backgroundColor: tokens.brand.ctaFill',
      want: 1,
    },
    {
      name: 'R3 主题袋别名形态(tk./theme./t.)一样要管',
      text: 'const a = theme.brand.ctaText',
      want: 1,
    },
    // 假红防线:业务代码里**局部变量也叫 brand** 很常见(轮播数据、品牌列表),裸 brand.x 不收
    {
      name: 'R3 正向对照:局部变量 brand 的属性引用不得判红(BrandMarquee 实测踩到)',
      text: 'const brand = { nameKey: "x", src: "y" }\n<Tooltip key={brand.nameKey}><img src={brand.src}/>',
      want: 0,
    },
  ]
  for (const c of refCases) {
    const n = danglingBrandRefs(c.text, allowed).length
    const ok = n === c.want
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (命中 ${n},期望 ${c.want})`)
  }
  // 豁免清单必须"写了就真存在":真仓里跑一次 stale
  const real = checkBrandKeys({
    bodies: {
      rnLightTokens: extractTsObjectBody(readTokenSources('head').rn, 'rnLightTokens'),
    },
    declared,
    allowlist: RN_ONLY_BRAND_KEYS,
  })
  const allowOk = real.stale.length === 0 && real.bad.length === 0
  if (!allowOk) fail++
  console.log(
    `${allowOk ? '✅' : '❌'} 真仓 rnLightTokens.brand 键全被声明或豁免覆盖(bad=${real.bad.length} stale=${real.stale.length})`,
  )
  // ── R4 基础档推导 / R5 端内自洽 / 精度容差 / 注释剥离(2026-09-24 补面取证) ──
  const cssFix = {
    '--color-warning-amber': '#f59e0b',
    '--color-danger': '#dc2626',
    '--color-success': 'hsl(142 71% 45%)',
    '--color-scrim': 'rgba(0,0,0,0.4)',
  }
  const r4 = (leaves, registered = {}) =>
    checkBasePalette({
      leavesByConst: { rnLightTokens: leaves },
      cssLight: cssFix,
      cssDark: cssFix,
      registered,
    })
  const r4Cases = [
    {
      name: 'R4 同名变量而值不同 → 判红并点名',
      got: r4([{ path: 'warning.amber', value: '#000000' }]),
      drift: 1,
      stale: 0,
      checked: 1,
    },
    {
      name: 'R4 同值 → 不判',
      got: r4([{ path: 'warning.amber', value: '#f59e0b' }]),
      drift: 0,
      stale: 0,
      checked: 1,
    },
    // shadcn 把 #22c55e 存成 hsl(142 71% 45%)(分量四舍五入),往返编码单通道差 1 是同一颜色
    {
      name: 'R4 精度容差:HSL 舍入不得算漂移(否则门上线当天造 4 枚假红)',
      got: r4([{ path: 'success.DEFAULT', value: '#22c55e' }]),
      drift: 0,
      stale: 0,
      checked: 1,
    },
    {
      name: 'R4 反向对照:真漂移(通道差 35)不得被容差吞掉',
      got: r4([{ path: 'danger.DEFAULT', value: '#ff3333' }]),
      drift: 1,
      stale: 0,
      checked: 1,
    },
    // DEFAULT 折叠:RN 的 ns.DEFAULT 对应 web 的 --color-<ns>,仓内不存在 --color-warning-default
    {
      name: 'R4 DEFAULT 折叠成父名',
      got: r4([{ path: 'danger.DEFAULT', value: '#dc2626' }]),
      drift: 0,
      stale: 0,
      checked: 1,
    },
    {
      name: 'R4 非颜色叶子(数字/字符串配置)一律不判',
      got: r4([
        { path: 'warning.amber', value: '4' },
        { path: 'danger.DEFAULT', value: 'tabular-nums' },
      ]),
      drift: 0,
      stale: 0,
      checked: 0,
    },
    {
      name: 'R4 rgba 叶子也在面内(门让你怎么写、门就必须看得见怎么写)',
      got: checkBasePalette({
        leavesByConst: { rnLightTokens: [{ path: 'overlay.modal', value: 'rgba(0,0,0,0.9)' }] },
        cssLight: { '--color-overlay-modal': 'rgba(0,0,0,0.4)' },
        cssDark: {},
        registered: {},
      }),
      drift: 1,
      stale: 0,
      checked: 1,
    },
    {
      name: 'R4 已登记分歧 → 不判红',
      got: r4([{ path: 'warning.amber', value: '#000000' }], {
        'rnLightTokens|warning.amber': '理由:两侧语义已分叉,待人裁',
      }),
      drift: 0,
      stale: 0,
      checked: 1,
    },
    {
      name: 'R4 登记表腐烂(登记了却已不冲突)→ 判红',
      got: r4([{ path: 'warning.amber', value: '#f59e0b' }], {
        'rnLightTokens|warning.amber': '已对齐却忘删登记',
      }),
      drift: 0,
      stale: 1,
      checked: 1,
    },
  ]
  let r4Fail = 0
  for (const c of r4Cases) {
    const ok =
      c.got.drift.length === c.drift &&
      c.got.stale.length === c.stale &&
      c.got.checked === c.checked
    if (!ok) r4Fail++
    console.log(
      `${ok ? '✅' : '❌'} ${c.name} (drift=${c.got.drift.length}/${c.drift} stale=${c.got.stale.length}/${c.stale} checked=${c.got.checked}/${c.checked})`,
    )
  }
  const r5Cases = [
    {
      name: 'R5 端内两表同路径不同值 → 判红',
      n: checkIntraPalette({
        base: [{ path: 'danger.DEFAULT', value: '#ff3333' }],
        light: [{ path: 'danger.DEFAULT', value: '#dc2626' }],
      }).length,
      want: 1,
    },
    {
      name: 'R5 大小写/缩写同值(#000 vs #000000)不得判红',
      n: checkIntraPalette({
        base: [{ path: 'gray.black', value: '#000' }],
        light: [{ path: 'gray.black', value: '#000000' }],
      }).length,
      want: 0,
    },
    {
      name: 'R5 只在一张表里出现的键不判(不是分叉)',
      n: checkIntraPalette({ base: [], light: [{ path: 'surface.bg', value: '#fff' }] }).length,
      want: 0,
    },
  ]
  let r5Fail = 0
  for (const c of r5Cases) {
    const ok = c.n === c.want
    if (!ok) r5Fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (命中 ${c.n},期望 ${c.want})`)
  }
  // 注释剥离:tokens.css 的注释里满是 `- --color-x:说明文字`,不剥就会被当变量取值
  const dirtyCss =
    '@theme {\n  /* - --color-warning:RN warning.amber 说明 */\n  --color-warning: #f59e0b;\n}'
  const stripped = extractCssVars(stripCssComments(dirtyCss))
  const strippedOk = Object.keys(stripped).length === 1 && stripped['--color-warning'] === '#f59e0b'
  if (!strippedOk) r4Fail++
  console.log(
    `${strippedOk ? '✅' : '❌'} 注释里的 "--color-x:说明" 不得被当变量取值(剥注释前实测产出 4 条假漂移) → 取到 ${JSON.stringify(stripped)}`,
  )
  const unstripped = extractCssVars(dirtyCss)
  console.log(
    `   · 反向对照(不剥注释):同一份 CSS 取到 ${Object.keys(unstripped).length} 个变量、值=${JSON.stringify(Object.values(unstripped)[0]).slice(0, 46)}… —— 这就是缺陷形态,不判红只留痕`,
  )
  // TS 注释剥离:说明性赋值不得进叶子面
  const tsLeafOk =
    objectLeaves(
      stripTsComments("brand: {\n /** foreground: '#FFFFFF' 是说明 */\n cta: '#4A7A96' \n}"),
    ).length === 1
  if (!tsLeafOk) r4Fail++
  console.log(`${tsLeafOk ? '✅' : '❌'} TS 文档块里的赋值说明不得被当叶子取值(只应收到 cta 一条)`)
  // 真仓不变量:R4 除登记项外零漂移、登记表无腐烂、R5 零分叉 —— 钉的是"必须为 0",不是钉某条清单
  const realLeaves = {}
  // 真仓不变量一律按**默认面(HEAD)**取证:自检证明的是"判据对已入库内容成立",
  // 跟着 --worktree 走会让自检结论随本机磁盘变化,那就不是自检而是复查工作区。
  const srcReal = readTokenSources('head')
  const realRn = stripTsComments(srcReal.rn)
  for (const n of ['rnTokens', 'rnLightTokens', 'rnDarkTokens'])
    realLeaves[n] = objectLeaves(extractTsObjectBody(realRn, n) || '', [])
  const realCssSrc = stripCssComments(srcReal.css)
  const rl = mergeCssVars(realCssSrc, ['@theme', ':root'])
  const rd = { ...rl, ...mergeCssVars(realCssSrc, ['.dark']) }
  const realBase = checkBasePalette({
    leavesByConst: realLeaves,
    cssLight: rl,
    cssDark: rd,
    registered: BASE_CONFLICTS,
  })
  const realIntra = checkIntraPalette({
    base: realLeaves.rnTokens,
    light: realLeaves.rnLightTokens,
  })
  const invOk =
    realBase.drift.length === 0 &&
    realBase.stale.length === 0 &&
    realIntra.length === 0 &&
    realBase.checked > 50
  if (!invOk) fail++
  console.log(
    `${invOk ? '✅' : '❌'} 真仓不变量:R4 推导面 ${realBase.checked} 条(漂移 ${realBase.drift.length} 须 0 / 登记 ${Object.keys(BASE_CONFLICTS).length} 条且腐烂 ${realBase.stale.length} 须 0)、R5 分叉 ${realIntra.length} 须 0`,
  )
  for (const d of realBase.drift.slice(0, 5))
    console.log(`     · 未登记漂移 ${d.key} rn=${d.rn} vs ${d.css}=${d.cssVal}`)
  for (const i of realIntra.slice(0, 5))
    console.log(`     · 端内分叉 ${i.path} base=${i.base} vs light=${i.light}`)

  // ── 崩溃面自证(2026-09-25 补):本门全量模式曾偶发匿名 `TypeError … reading 'length'` + exit 2,
  // 只打 message 不打栈 ⇒ 复跑三轮再也复现不出来。两条断言把"崩"换成"具名无法判定"。
  let ghostThrew = null
  try {
    resolveTsPath(undefined, ['rnGhostTokens', 'x'])
  } catch (e) {
    ghostThrew = e
  }
  const ghostOk =
    ghostThrew instanceof UndeterminedError &&
    /取不到/.test(ghostThrew.message) &&
    /rnGhostTokens/.test(ghostThrew.message)
  console.log(
    `${ghostOk ? '✅' : '❌'} 表名漂移必须抛具名"无法判定"并点名是哪张表(旧行为:裸 TypeError,不可诊断)`
  )
  let normalThrew = null
  try {
    resolveTsPath('--color-x: #fff;', ['x'])
  } catch (e) {
    normalThrew = e
  }
  const normalOk = normalThrew === null
  console.log(`${normalOk ? '✅' : '❌'} 反向对照:正常 body 不得被新守卫误判成取不到`)

  // 装车形状量"本门是否真走层";截断这条**不再拿源码文本当尺子** —— 层的 parseBatch 是导出的
  // 纯函数,可以直接喂一段断掉的缓冲来证明它有牙(门 103 T12 同一课:构造面 > 文本面)。
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const shape = checkCrashShape(self)
  const shapeOk =
    shape.usesLayer && !shape.selfBatchBack && !shape.silentBreakBack && shape.catchHasStack
  console.log(
    `${shapeOk ? '✅' : '❌'} 装车形状:本门不得自带 cat-file --batch 解析(必须走层)、顶层 catch 必带栈 → got=${JSON.stringify(shape)}`,
  )
  const good = 'x'.repeat(40)
  const truncBuf = Buffer.from(`${good} blob 3\nabc`, 'utf8')
  let truncThrew = null
  try {
    parseBatch(truncBuf, ['HEAD:a', 'HEAD:b']) // 两个 rev,但第二段头已经没有了 ⇒ 截断
  } catch (e) {
    truncThrew = e
  }
  const truncOk = truncThrew instanceof UndeterminedError && /处截断/.test(truncThrew.message ?? '')
  console.log(
    `${truncOk ? '✅' : '❌'} 层的截断判据真咬:输出在第 2/2 个对象处断掉必须抛具名"无法判定"(旧行为:静默少扫 = 假绿) → got=${truncThrew?.constructor?.name}`,
  )
  // 反向对照:同一段缓冲,revs 只要一条就完全合法 ⇒ 不得被判成截断(否则这条判据是恒红尺子)
  let completeThrew = null
  try {
    parseBatch(truncBuf, ['HEAD:a'])
  } catch (e) {
    completeThrew = e
  }
  const completeOk = completeThrew === null
  console.log(`${completeOk ? '✅' : '❌'} 反向对照:完整输出不得被截断判据误伤 → got=${completeThrew?.message}`)
  // 反例必须真红,否则形状尺子是无牙的(把旧形状写回本文件当证明会因语法错跑不起来,
  // 所以只能喂字符串 —— 门 103 T12 同一课)。
  // ⚠️ 被禁的两个形态**不能原样写进本文件**:这把尺子量的就是本文件自身,写进去等于自己制造一次
  // "违规"(本门第一版把被禁字面量抄进断言,结果自身恒命中自己的禁令)。用拼接,运行时才成形态。
  const DASH = '-'
  const NIL = 'null'
  const BRK = 'break'
  const neg = checkCrashShape(
    "import { join } from 'node:path'\nfunction catBatch(revs){ const out = gitExec(['cat-file', '" +
      DASH +
      DASH +
      "batch'])\n  map.set(rev, " +
      NIL +
      ')\n      ' +
      BRK +
      '\n}\n',
  )
  const negOk = !neg.usesLayer && neg.selfBatchBack && neg.silentBreakBack
  console.log(
    `${negOk ? '✅' : '❌'} 反例有牙:一段"自带 batch + 静默 break"的文本必须同时被三个字段抓到 → got=${JSON.stringify(neg)}`
  )
  if (!ghostOk || !normalOk || !shapeOk || !truncOk || !completeOk || !negOk) fail++

  const r6 = await selfTestR6()
  const r7 = selfTestR7()
  const totalCases =
    cases.length +
    refCases.length +
    1 +
    r4Cases.length +
    r5Cases.length +
    3 +
    6 + // 崩溃面那一段:表名漂移 / 反向对照 / 装车形状 / 截断真咬 / 截断反例 / 形状反例
    r6.cases +
    r7.cases
  if (r4Fail + r5Fail > 0) fail += r4Fail + r5Fail
  fail += r6.fail + r7.fail
  console.log(fail ? `❌ self-test 失败 ${fail} 例` : `✅ self-test 全通过(${totalCases} 例)`)
  return fail ? 1 : 0
}

// ─── R6 自检:成对正反例(表里缺项必红 / 在用必绿 / 无人用必红 / 动态只报数) ───
/**
 * R7 自检。形状判据只能用**纯函数 + 构造面**证明(把样本写进真仓文件做变异,
 * 会让断言自指且随时被别人的提交改掉),故这里全部走 extractBareRpxLengths 纯函数;
 * 真仓那一侧只留一条"改完应为 0"的不变量,并由上面第 1/3/9 例作阳性对照 ——
 * 没有那三例,"0 处"就只是探针没响。
 */
function selfTestR7() {
  let fail = 0
  const cases = []
  const t = (name, src, want, isCss = false) => {
    const { hits } = extractBareRpxLengths(maskComments(src, isCss), src)
    const got = hits.map((h) => h.key).sort()
    const ok = JSON.stringify(got) === JSON.stringify([...want].sort())
    cases.push(name)
    if (!ok) {
      fail++
      console.log(`❌ R7 ${name}: 期望 [${want.join(', ')}] 实得 [${got.join(', ')}]`)
    }
  }

  // 阳性对照:这三例若探针不响,后面那条"真仓 0 处"毫无意义
  t('裸 rpx text 必命中', 'className="text-[28rpx]"', ['text-[28rpx]'])
  t('裸 rpx border 必命中', 'className="border-[2rpx]"', ['border-[2rpx]'])
  t('小数 rpx 必命中', 'style="text-[1.5rpx]"', ['text-[1.5rpx]'])
  // ── 2026-09-25 扩面:方向性 border / 裸 divide / ring / outline(夹具实测全部落颜色属性)──
  // 每一族都有成对的反向例(实测本来就对的形态),判据覆盖面 = 缺陷面,不得多也不得少。
  t('border-t 必命中', 'className="border-t-[1rpx] border-border"', ['border-t-[1rpx]'])
  t('border-b 必命中', 'className="border-b-[2rpx]"', ['border-b-[2rpx]'])
  t('border-l/r 必命中', 'className="border-l-[1rpx] border-r-[1rpx]"', ['border-l-[1rpx]', 'border-r-[1rpx]'])
  t('border-x 必命中', 'className="border-x-[3rpx]"', ['border-x-[3rpx]'])
  t('border-y 必命中', 'className="border-y-[3rpx]"', ['border-y-[3rpx]'])
  t('border-s/e 必命中', 'className="border-s-[2rpx] border-e-[2rpx]"', ['border-s-[2rpx]', 'border-e-[2rpx]'])
  t('裸 divide 必命中', 'className="divide-[2rpx]"', ['divide-[2rpx]'])
  t('ring 必命中', 'className="focus:ring-[6rpx]"', ['ring-[6rpx]'])
  t('outline 必命中', 'className="outline-[2rpx]"', ['outline-[2rpx]'])
  // 反向例:夹具逐字证明这些形态在 v3 下落**正确属性**,纳进必制造噪音红
  t('divide-x 轴形式不命中(落 border-*-width,本就对)', 'className="divide-x-[4rpx]"', [])
  t('divide-y 轴形式不命中', 'className="divide-y-[4rpx]"', [])
  t('单类型 length 插件不命中(w/p/gap 对 rpx 是透传)', 'className="w-[10rpx] p-[10rpx] gap-[10rpx]"', [])
  t('border-t px 不命中', 'className="border-t-[1px]"', [])
  t('ring px 不命中', 'className="ring-[6px]"', [])
  t('outline px 不命中', 'className="outline-[2px]"', [])
  t('方向性已带 length: 不命中(门自己产出的修复形态必须被认作合法)', 'className="border-t-[length:1rpx] border-b-[length:2rpx]"', [])
  t('ring/outline 已带 length: 不命中', 'className="ring-[length:6rpx] outline-[length:2rpx]"', [])
  t('border-t-0 标量不命中', 'className="border-t-0"', [])
  // 真实源码形状(notification.tsx 原样):同串里颜色档任意值与方向性裸 rpx 并存,
  // 只许命中前者之外的那一条,`border-[color:var(…)]` 不得被计债
  t('方向性与 color 显式档混排只命中裸 rpx 那一条', 'className="border-t-[1rpx] border-solid border-[color:var(--color-border)]"', ['border-t-[1rpx]'])
  // 单位决定对错:px/rem/em 在 v3 下本就落对属性,绝不该报
  t('px 不命中', 'className="text-[13px]"', [])
  t('border px 不命中', 'className="border-[2px]"', [])
  t('rem 不命中', 'className="text-[1.25rem]"', [])
  // 修复形态与颜色形态不得被误伤
  t('已带 length: 不命中', 'className="text-[length:28rpx]"', [])
  t('已带 color: 不命中', 'className="text-[color:var(--x)]"', [])
  t('var 颜色不命中', 'className="text-[var(--color-card)]"', [])
  // 注释里的样本不算用量(上一轮 bg-muted/40 就是被注释喂出来的假阳)
  t('JS 注释不命中', '// className="text-[28rpx]"\nconst a = 1', [])
  t('CSS 注释不命中', '/* text-[28rpx] */\n.x{color:red}', [], true)
  // 行号要能定位到真实行,否则报错文案不可用
  {
    const src = 'const a = 1\nconst b = 2\nclassName="text-[30rpx]"'
    const { hits } = extractBareRpxLengths(maskComments(src), src)
    cases.push('行号定位')
    if (hits.length !== 1 || hits[0].ln !== 3) {
      fail++
      console.log(`❌ R7 行号定位: 期望第 3 行,实得 ${hits[0] ? hits[0].ln : '无命中'}`)
    }
  }
  return { fail, cases: cases.length }
}

async function selfTestR6() {
  const plugin = await loadAlphaPlugin()
  const fxColors = {
    primary: { DEFAULT: 'var(--color-primary)', foreground: 'var(--color-primary-foreground)' },
    card: 'var(--color-card)',
    muted: { DEFAULT: 'var(--color-muted)' },
    ring: 'var(--color-ring)',
  }
  const tiers = flattenColorTiers(fxColors)
  const scan = (code, isCss = false) =>
    extractAlphaUsages(maskComments(code, isCss), { tiers, isCss, original: code })
  const sum = (x) => ({
    missing: x.missing.length,
    rot: x.rot.length,
    unprod: x.unproduced.length,
    unsup: x.unsupportedKind.length,
    build: x.buildIssues.length,
    nonPreset: x.nonPreset,
    exempt: x.exempted,
  })
  const t = (mod, kind = 'bg') => ({ [kind]: [mod] })
  const r6Cases = [
    {
      name: 'R6 表里已登记且源码在用 → 零红',
      code: 'className="bg-primary/10"',
      usage: { primary: t('10') },
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
    },
    {
      name: 'R6 表里缺这一档(v3 静默零产出的真实形态)→ 必红并点名',
      code: 'className="bg-card/50"',
      usage: { primary: t('10') },
      want: { missing: 1, rot: 1, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x) => x.missing[0].key === 'bg-card/50',
    },
    {
      name: 'R6 补了用到的档、同时留下没人用的档 → 只剩腐烂红且点名腐烂项',
      code: 'className="bg-card/50"',
      usage: { card: t('50'), primary: t('10') },
      want: { missing: 0, rot: 1, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x) => x.rot[0].key === 'bg-primary/10',
    },
    {
      name: 'R6 表里有用量端无人用(清单腐烂)→ 必红',
      code: '',
      usage: { primary: t('10'), muted: t('[0.12]') },
      want: { missing: 0, rot: 2, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
    },
    {
      name: 'R6 动态拼接的类名判不出来 → 只报数不判红',
      code: 'const c = `bg-${tier}/${op}`',
      usage: {},
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x, s) => s.undetermined.length === 1,
    },
    {
      name: 'R6 注释里举的例子不得当用量(否则门会拿散文逼人造登记)',
      code: '// 例如 bg-primary/10 需要登记\n/* bg-card/90 */\nconst x = 1',
      usage: {},
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x, s) => s.tokens.length === 0,
    },
    {
      name: 'R6 反向对照:串里的 /* 不得把后续真用量骗进块注释(守门 70 同型假绿)',
      code: "const u = 'https://a/*x';\nconst c = \"bg-primary/10\"",
      usage: { primary: t('10') },
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x, s) => s.tokens.length === 1,
    },
    {
      name: 'R6 默认色板(white/black)v3 原生支持 → 不得要求登记',
      code: 'className="bg-white/50 text-white/80"',
      usage: {},
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 2, exempt: 0 },
    },
    {
      name: 'R6 变体前缀(hover:/dark:)必须被看见,否则按规矩写的形态反而隐身',
      code: 'className="hover:bg-primary/10 dark:bg-primary/10"',
      usage: { primary: t('10') },
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x, s) => s.tokens.length === 2 && s.tokens.every((tk) => tk.variants !== ''),
    },
    {
      name: 'R6 CSS 侧转义选择器形态 .bg-muted\\/\\[0\\.12\\] 必须被看见',
      code: '.bg-muted\\/\\[0\\.12\\] { background: red }',
      usage: { muted: t('[0.12]') },
      isCss: true,
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
      also: (x, s) => s.tokens.length === 1,
    },
    {
      name: 'R6 插件能力表外的前缀(ring-)→ 判红并给出口',
      code: 'className="ring-primary/20"',
      usage: { primary: t('10') },
      want: { missing: 0, rot: 1, unprod: 0, unsup: 1, build: 0, nonPreset: 0, exempt: 0 },
      also: (x) => x.unsupportedKind[0].key === 'ring-primary/20',
    },
    {
      name: 'R6 豁免必须带原因:同行 alpha-plugin-exempt: <原因> → 不判红',
      code: 'className="bg-card/50" // alpha-plugin-exempt: 浮层遮罩专用',
      usage: {},
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 1 },
    },
    {
      name: 'R6 豁免标记不带原因 → 无效,照判红(不得用它清账)',
      code: 'className="bg-card/50" // alpha-plugin-exempt:',
      usage: {},
      want: { missing: 1, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
    },
    {
      name: 'R6 豁免只对命中行或紧邻上一行生效(逐行,不救全文件)',
      // 标记只救本行与紧邻上一行:第 4 行的用量距标记 3 行,必须照判红
      code: 'className="bg-card/50" // alpha-plugin-exempt: 只这一行\nconst pad = 1\nconst pad2 = 2\nconst b = "bg-card/60"',
      usage: {},
      want: { missing: 1, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 1 },
    },
    {
      name: 'R6 表里登了 preset 取不出的档 → buildAlphaUtilities 报 unresolvable,必红',
      code: '',
      usage: { ghost: t('10') },
      want: { missing: 0, rot: 1, unprod: 0, unsup: 0, build: 1, nonPreset: 0, exempt: 0 },
    },
    {
      name: 'R6 嵌套档 primary-foreground 必须能推导 + 真产出(否则 text-primary-foreground/90 判不出来)',
      code: 'className="text-primary-foreground/90"',
      usage: { 'primary-foreground': t('90', 'text') },
      want: { missing: 0, rot: 0, unprod: 0, unsup: 0, build: 0, nonPreset: 0, exempt: 0 },
    },
  ]
  let fail = 0
  for (const c of r6Cases) {
    const s = scan(c.code, !!c.isCss)
    const full = checkAlphaUsage({ usages: s.tokens, usage: c.usage, colors: fxColors, plugin })
    const got = sum(full)
    let ok = JSON.stringify(got) === JSON.stringify(c.want)
    if (ok && c.also) ok = c.also(full, s) === true
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} ${c.name} → got=${JSON.stringify(got)}`,
    )
  }
  // 腐烂棘轮成对证明(缺了它,无关提交会被"别人欠的债"钉红 → 逼人 --no-verify → 全部守门作废)
  const rtTable = { card: t('50'), primary: t('10') }
  const rtCode = 'className="bg-card/50"'
  const rtSuppressed = checkAlphaUsage({
    usages: scan(rtCode).tokens,
    usage: rtTable,
    colors: fxColors,
    plugin,
    baselineRot: new Set(['bg-primary/10']), // HEAD 已有这条存量腐烂
  })
  const rtFresh = checkAlphaUsage({
    usages: scan(rtCode).tokens,
    usage: rtTable,
    colors: fxColors,
    plugin,
    baselineRot: new Set(), // 同一份输入,基线为空 → 必须红(证明上一条不是恒绿)
  })
  const rtNewStillRed = checkAlphaUsage({
    usages: scan(rtCode).tokens,
    usage: rtTable,
    colors: fxColors,
    plugin,
    // 基线里躺着**另一条**存量腐烂:本次新造出来的 bg-primary/10 不在基线内 → 棘轮不得放过
    baselineRot: new Set(['bg-ghost/99']),
  })
  const ratchetOk =
    rtSuppressed.rot.length === 0 &&
    rtSuppressed.rotInherited === 1 &&
    rtFresh.rot.length === 1 &&
    rtNewStillRed.rot.length === 1 &&
    rtFresh.rot[0].key === 'bg-primary/10'
  if (!ratchetOk) fail++
  console.log(
    `${ratchetOk ? '✅' : '❌'} R6 腐烂棘轮:HEAD 存量压红 ${rtSuppressed.rot.length}(须 0)/ 继承计数 ${rtSuppressed.rotInherited}(须 1)/ 无基线同一输入 ${rtFresh.rot.length}(须 1)/ 基线不含本条时 ${rtNewStillRed.rot.length}(须 1 —— 棘轮只放过存量,绝不放过本次新造的腐烂)`,
  )
  // 解析器:真登记表必须解析得出,且非常量形态必须大声失败(不得静默少扫)
  let reg
  try {
    reg = readAlphaRegistry('head')
  } catch (e) {
    console.log(`❌ R6 真登记表取不到(无法判定,不算通过):${e.message}`)
    return { fail: fail + 1, cases: r6Cases.length + 5 }
  }
  // 真表只验**形状**(每档每前缀都是字符串数组),不验大小、更不点名"必须有 primary/bg/10" ——
  // 那张表由 sync-alpha-usage.mjs 从用量导出,当天没人写 /alpha 它就是 {}(2026-09-25 即是)。
  // "解析得对不对"这件事改由下面的构造字面量证明,与仓库用量无关。
  const parsedOk = Object.values(reg.usage).every((byKind) =>
    Object.values(byKind).every((mods) => Array.isArray(mods) && mods.every((m) => typeof m === 'string')),
  )
  const probeParsed = parseLiteralObject(
    extractObjectBody(
      "export const ALPHA_USAGE = {\n  primary: { bg: ['10'], border: ['20'] },\n  muted: { bg: ['[0.12]'] },\n}",
      /^export const ALPHA_USAGE\s*=\s*\{/m,
    ),
  )
  const probeOk =
    plugin.alphaTiers(probeParsed).length === 2 &&
    JSON.stringify(probeParsed.primary.bg) === JSON.stringify(['10']) &&
    JSON.stringify(probeParsed.muted.bg) === JSON.stringify(['[0.12]'])
  if (!parsedOk || !probeOk) fail++
  console.log(
    `${parsedOk && probeOk ? '✅' : '❌'} R6 解析器:真表形状 OK=${parsedOk}(现 ${plugin.alphaTiers(reg.usage).length} 档,合法地可为 0)/ 构造字面量解析 OK=${probeOk}(2 档 3 形态)· flattenColorTiers 得 ${flattenColorTiers(reg.colors).size} 档(preset 无 -DEFAULT 泄漏:${![...flattenColorTiers(reg.colors)].some((x) => x.endsWith('-DEFAULT'))})`,
  )
  let threw = 0
  try {
    parseLiteralObject('a: foo(1)')
  } catch (e) {
    threw = e instanceof UndeterminedError ? 1 : 2
  }
  let anchorThrew = 0
  try {
    extractObjectBody('colors: { a: "x" } colors: { b: "y" }', /\bcolors\s*:\s*\{/)
  } catch (e) {
    anchorThrew = e instanceof UndeterminedError ? 1 : 2
  }
  if (threw !== 1 || anchorThrew !== 1) fail++
  console.log(
    `${threw === 1 && anchorThrew === 1 ? '✅' : '❌'} 登记表写成非常量形态 / 锚点不唯一 → 必须抛"无法判定"(got ${threw}/${anchorThrew})`,
  )
  // 锚点回归(本门第一版的真实缺陷):带 ^ 的锚点漏了 m flag ⇒ `^` 只认串首,整张表读成"取不到"
  const anchorFixture = 'head\nexport const ALPHA_USAGE = { primary: { bg: ["10"] } }\n'
  let withM = 'ok'
  try {
    extractObjectBody(anchorFixture, /^export const ALPHA_USAGE\s*=\s*\{/m)
  } catch (e) {
    withM = e instanceof UndeterminedError ? 'threw' : 'wrong-error'
  }
  let withoutM = 'ok'
  try {
    extractObjectBody(anchorFixture, /^export const ALPHA_USAGE\s*=\s*\{/)
  } catch (e) {
    withoutM = e instanceof UndeterminedError ? 'threw' : 'wrong-error'
  }
  const anchorFlagOk = withM === 'ok' && withoutM === 'threw'
  if (!anchorFlagOk) fail++
  console.log(
    `${anchorFlagOk ? '✅' : '❌'} 锚点带 ^ 必须配 m flag 才命中(带 m=${withM} / 漏 m=${withoutM} —— 漏 m 正是首版让整门读不到登记表的原因)`,
  )
  // 真仓不变量:HEAD 面**不得有任何"该红没红"的方向**漏过。
  // 刻意不把 rot.length === 0 也钉成必过条件:本票落地的那枚提交里才把首条腐烂行(bg-muted/40)删掉,
  // 若钉死 rot==0,自检会在"判据已入库、数据修正在下一枚提交"的窗口里恒红 —— 恒红门的唯一结局是逼人
  // 绕过钩子、连带废掉全部守门。腐烂照旧**逐条点名判红**(见 r6Cases 的腐烂用例),只是不由这条不变量代收。
  let r6Real
  try {
    r6Real = await runR6({ face: 'head', quiet: true })
  } catch (e) {
    console.log(`❌ R6 真仓跑不动(无法判定,不算通过):${e.message}`)
    return { fail: fail + 1, cases: r6Cases.length + 5 }
  }
  const hard = r6Real.failures.filter((f) => !f.tag.startsWith('R6 清单腐烂'))
  // ⚠️ 这里**不得**钉"用量条数 > N"。登记表大小是**移动量** —— 它等于此刻有多少人写了 /alpha,
  // 合法地可以是 0(2026-09-25 把面收到真 v3 两端后就是 0)。把它当健康期望,下次归零就会
  // 红在一件正确的事上。防"整门失明"由上面 r6Cases 里的构造面阳性对照负责:那几例证明
  // 判据喂给它东西时它一定响;本条只要求"扫得动、扫完无硬红、文件面不为空"。
  const realOk = hard.length === 0 && r6Real.counts.files > 800
  if (!realOk) fail++
  console.log(
    `${realOk ? '✅' : '❌'} R6 真仓不变量:${r6Real.counts.files} 文件 / preset 档用量 ${r6Real.counts.checked} 处,` +
      `未登记 ${r6Real.counts.missing.length}(须 0)/ 未产出选择器 ${r6Real.counts.unproduced.length}(须 0)/` +
      ` 表自身产不出 ${r6Real.counts.buildIssues.length}(须 0)/ 不支持前缀 ${r6Real.counts.unsupportedKind.length}(须 0)/` +
      ` 其余硬红 ${hard.length}(须 0),` +
      `默认色板 ${r6Real.counts.nonPreset} 处不计、判不出 ${r6Real.counts.undetermined} 处不判红、腐烂 ${r6Real.counts.rot.length} 条(照红并点名)`,
  )
  for (const f of r6Real.failures.slice(0, 6)) console.log(`     · ${f.tag}: ${f.detail.slice(0, 120)}`)
  return { fail, cases: r6Cases.length + 5 }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
