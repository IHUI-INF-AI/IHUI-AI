#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-i18n-locale-content-language.mjs — i18n「语种内容 / 同名自套一层」守门
 *
 * 立论(2026-09-26 由 D20 实测逼出,AGENTS §19 已登记):现有五道 i18n 门判的是**键集**(parity)
 * 与"**有没有**中文残留",所以"**某一整块被整体落成另一门语言**"这一型结构上看不见。当天 HEAD 面
 * 实测到四种形态,而所有既有门禁全绿:
 *   ① `web/ja.json :: aiChat.org` 整块是**繁体中文**(「整理會話」「資料夾」「標籤」)
 *   ② `web/zh-TW.json :: aiChat.org` 整块是**谚文**(「대화 정리」)—— 与 ①、③ 构成三向轮转
 *   ③ `web/ko.json :: chat.exportMenu.exportPdf` 装的是**日文假名**(「PDF をエクスポート」)
 *   ④ `aiChat.toast.orgSaved` 被机械写成 `orgSaved:{orgSaved:"…"}` ⇒ `t('toast.orgSaved')` 取到
 *      的是**对象**:功能执行成功,但提示永远不响(parity 绿、语种也对,因为它确实是本语言的英文)
 * ①②③④ 在本门落地时于 HEAD / 索引 / 工作树三面**仍在**(本门实测;修内容不属本票职责 —— 尺子)。
 *
 * ── 判据 ────────────────────────────────────────────────────────────────────
 * L1 语种归属:按 Unicode **码位族**量,不按字形肉眼判。谚文「을」与假名「を」肉眼都是"非中文的一串",
 *   按字形判必错;族表与互斥性证明在 `scripts/lib/i18n-script-families.mjs`(唯一源)。
 *   · L1a 叶级跨族 —— 值里出现该 locale **完全不使用**的语族字符 ⇒ 候选。矩阵:
 *       zh-CN / zh-TW ← 假名、谚文;ja ← 谚文;ko ← 假名;**en ← 假名、谚文、汉字**。
 *     一条刻意**不判**的边界(打印计数,绝不静默):
 *       − `ko` 里的汉字:那是 `scan-i18n-zh-residue.mjs` 的既有 blocking 射程。同一笔债两道门各计
 *         一次会让两份基线互相顶掉(守门 83 的 brand.cta 同型)。
 *       − `en` 整门的 L1:该文件里品牌/术语原文必须留汉字(实测 `web/en` 2 处即「智汇 AI」);
 *         en 的既有判据是 `check-i18n-broken-en.mjs`。en 仍参与 L2。
 *       ⚠️ **上面这条 `en` 整门不判已于 2026-10-06 撤销**(见下面「E4」与 LOCALE_MATRIX 的注释):
 *         原形态是**按 locale 无条件不判** —— `scanLocaleContent` 在叶子循环**之前**就 return,
 *         所以 en.json 里混入中文残留永远不被 L1a 抓到。而实测:7 份 en.json 共 32,563 叶里
 *         汉字只有 **2** 处(都是 `IHUI AI (智汇 AI)` 这种括号内双语标注),`check-i18n-broken-en.mjs`
 *         又只接了 7 面里的 **3** 面(web/extension/shared)—— api / cli / miniapp-taro / mobile-rn
 *         的 en.json 中文残留**无门可管**。一个「有意的设计决策」被实现成「一个洞」,而它记的是
 *         **未判定** ⇒ `--strict` 永远归不了零。现在 en 与其他 locale 走**同一条链**分派。
 *   · L1b 块级(ja)—— "整块汉字、零假名"。纯码位**判不了**:日语本来就大量使用纯汉字词,实测 HEAD
 *       面 ja 有 42 个这样的块,零假名≠不是日语。所以再加一条**表驱动**证据 —— 块内存在不在日本
 *       常用汉字表(`scripts/joyo-kanji.json`,2136 字)内的汉字字种。加这条后 HEAD 面 42 → **1**,
 *       而那 1 个正是 ①号真事故。表取不到 ⇒ 该判据记"未判定"并点名,**不猜**。
 *   · **不能判的那一格(诚实边界)**:汉字族内部的简/繁之分。日本新字体与中国简化字**同码位**
 *       (気/会/図/点/写/台 …),所以"检测到汉字"既不能判 zh-TW 红也不能判 ja 红。本门只在**族级
 *       矛盾**上判红;简繁留给表驱动(opencc 字形转换)的那道门。
 * L2 同名自套一层:`{"x":{"x":…}}`(键名 = 其**唯一**子键名)⇒ 取父键永远拿到对象。
 *   `{"x":{"x":…,"y":…}}` **不判** —— 那是仓内既有正当形态(HEAD 实测 50 处,如 `login.login`);
 *   判它等于把 conventions 当违规。该计数照打印,不藏。
 *
 * ── 定级依据(实测数字,不是偏好) ─────────────────────────────────────────
 * HEAD 面实测:L1 候选**非 0**(L1a 15 处叶级 + L1b 1 个块),L2 存量 **5**(不是 0 —— 五份
 * `web/*.json` 各 1 处 `aiChat.toast.orgSaved`)。所以:
 *   · **默认档 L1 只报数**(exit 0),`--strict` 才判红。与本次改动无关的恒红 blocking 门,唯一结局
 *     是逼人 `--no-verify` 并连带废掉全部守门(AGENTS §12e 同型)。
 *   · **L2 走每文件 HEAD 自身存量棘轮**:锚点 = 该文件在 HEAD 的 L2 计数,只拦"比锚点更多"。
 *     存量 5 处只报数;任何新增(含全新 locale 文件,锚点按 0 计)当场判红 —— 这一条**默认档就判**。
 *   · `--strict` 下若还有"未判定"项 ⇒ **exit 2**,不得读成通过。
 *
 * ── 取材面(照 36/56/60/93/124 与 check-i18n-duplicate-namespaces 同一套) ─────
 * 全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工/夹具逃生舱;两面旗同给
 * ⇒ exit 2;任一面取不到 ⇒ **exit 2 显式"无法判定",绝不回落另一个面、绝不记绿**。清单
 * (`ls-tree` / `ls-files`)与正文(**一次** `cat-file --batch`)**同面同轮**;常用汉字表也按**被审面**
 * 读(表是判据输入,读磁盘会让"改表未提交"与"已提交"两种状态混用)。枚举到 0 个 locale 文件 /
 * 0 条叶子 ⇒ **判死而不记绿**。
 *
 * ── 豁免(四条,都是结构式判据,不是登记表;不新增行内标记族 ⇒ 不给守门 108 添新账) ──
 *   E1 与同 target 的 `zh-CN` 文件**同键路径逐字相同** ⇒ 有意的原文保留(法人名 / 备案号 / 品牌 /
 *      语言本名),不属"错语种"。**审的文件本身就是 zh-CN 时 E1 不生效** —— 否则自我比对等于自我豁免,
 *      zh-CN 里的整块外语永远看不见。zh-CN 侧由 L1a 自身把守,所以"zh-CN 与 zh-TW 同时装韩文"这种
 *      成对隐藏不可能两侧都静默。
 *   E2 叶子键名本身点名某种语言(`settings.lang_ko` / `settings.ko` / `languageKO`:末段归一后以某个
 *      locale 码结尾且等于它或以 `lang`/`language` 开头)⇒ 语言选择器按设计显示该语言**本名**。
 *      locale 码集**从被审目录的文件名自己推出**,没有手工清单。
 *   E3(2026-10-06 立)**叶子级**专名豁免:该叶子的**全部**表外字种都落在 `properNouns` 内 ⇒ 专名的
 *      日文正字形写法,放过。立论:`aboutIcprecord.r2` = `吉林省愛智匯人工智能科技有限公司` 躲过 E1
 *      **不是因为内容对**,而是 ja 用日文正字形(愛/匯/學)而 zh-CN 用中国简化字(爱/汇/学),逐字不同 ⇒
 *      E1 判不出 ⇒ 落进 L1b 挨打。这一整类(硅基流動/訊飛星火/火山引擎/企鵞号/鈦媒體/西瓜動画)都被
 *      漏到 L1b。**必须叶子级不能字级**:同一个 `智` 在 `community.text1`(专名)与在别处(普通词)
 *      身份不同;字级放行对两者一视同仁,那不叫分派,叫"靠改表过门"——`properNouns` 因此是**与 2136
 *      表分离的独立集合**,一个字都没进 `chars`/`codepoints`。反向防线:掺进任何一个非专名的表外字,
 *      整叶仍判。E3 命中数**必须单列打印**(归零即"合法字被当残留抓了"或"专名集没随表落库")。
 *   E4(2026-10-06 立)**叶子级**双语标注豁免(只为把 `en` 收进 L1 而立的**最窄**一条):该叶子的
 *      **全部汉字都落在圆括号段内**、括号**外没有汉字**、且括号外**有拉丁字母** ⇒ 这是英文句子里
 *      夹的一句中文对照(SEO 双语标注),不是"没翻译"。立论:`web/en.json` 实测只有 2 处汉字,形状是
 *      `IHUI AI (智汇 AI) is an all-in-one …` 与 `IHUI AI (Chinese: 智汇 AI) is …` —— 括号内是品牌
 *      原文,括号外是完整英文。若没有 E4 而只留 E1,这两处会**判红**(它们与 zh-CN 逐字不同);
 *      若把 E4 写成"en 见到汉字就放过",那它就是一个洞。**反向防线(逐条构造验过)**:
 *      `会话整理`(整段未翻译)/`整理会话 (Organize chats)`(汉字在括号外)/`智汇`(裸品牌,无括号)/
 *      `(智汇)`(括号外无拉丁,不是标注)全部**仍判**。E4 只认 han,不认 kana/hangul ——
 *      en 里出现假名/谚文一律判(`settings.ko = "한국어"` 那类由 E2 放过)。
 *   四条都**只报数并打印命中键路径**(清单腐烂会表现为计数变化,不是静默)。
 *
 * 退出码:0 = 通过 / 仅默认档报数 · 1 = 判红(L2 新增,或 --strict 下的 L1 候选)· 2 = 无法判定
 * 用法:node scripts/check-i18n-locale-content-language.mjs
 *        [--staged | --worktree] [--strict] [--all] [--self-test] [--root <dir>(仅 --worktree 档)]
 * 紧急跳过:HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE=1(接线后由 runner 的 skipEnv 使用)
 * 接线状态:**尚未接入 guardian-runner / package.json**(由主会话统一注册;本头注不声称已接线)。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import {
  FAMILY_NAMES,
  SCRIPT_RANGES,
  familiesIn,
  hasHan,
  hasKana,
  hasHangul,
  joyoSetFromRaw,
  nonJoyoHan,
  properNounSetFromRaw,
  rangesAreDisjoint,
} from './lib/i18n-script-families.mjs'

const SKIP_ENV = 'HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_REL = 'packages/i18n/messages'
const JOYO_REL = 'scripts/joyo-kanji.json'
/** L1b 块级判据的最小叶子数:1~2 叶的块(「確認」/「保存」)汉字是日语常态,样本不足以定性 */
const MIN_BLOCK_LEAVES = 3
/** L1b 的汉字占比门槛:低于此值说明该块主要是拉丁/数字,不读成"整块是中文" */
const HAN_SHARE_MIN = 0.5
/**
 * ⚠️ **块级叶数上限已于 2026-10-06 删除**(原 `MAX_LEAVES_PER_BLOCK = 4000`)。它不是性能上限,
 * 删掉的理由是它**保护不了任何东西**,却造了一个永久的洞:
 *   · 文件级扫描本来就是**不截断**的(下述 `collectLeaves` 的 `max` 参数已一并删除,`Infinity`
 *     是唯一形态)。也就是说"把全仓 162,829 条叶子全部读一遍"这件事**已经在付**了 —— 块级再限一次
 *     4000,省不下这个成本,只让 `web/ja.json::admin`(实测 **4,804** 叶)永远判不出。
 *   · 实测把 `web/ja.json` 的 L1b **全量不截断**跑一遍:2,116 个块、**175 ms**、L1b 判红 **0**。
 *     整门耗时 3.8 s 的绝大部分在 `cat-file --batch` 读 35 份文件上,不在块遍历上。
 *   · 块遍历的总代价是 `O(叶数 × 嵌套深度)`,深度是语言包自身的结构常量 ⇒ **与块的大小无关**。
 *     所以"给块设一个数"这件事没有性能含义,只有"覆盖含义":超过它的块一律记未判定,而未判定
 *     在 `--strict` 下是 exit 2 ⇒ 门永远归不了零,也就永远无法做变异验证。
 *   · 把 4000 改成 6000 是**把阈值挪到刚好盖住现存最大块**——本仓反复踩的"判据跟着数据走"。
 *     下一个 5,000 叶的块照样被截断。删掉上限才是能覆盖未来的方案。
 * 取代它的是**可见性**而不是**上限**:`maxBlockLeaves` 单列打印最大块及其键路径,于是"某个块
 * 变大了"这件事仍然看得见(不会因为没有上限就变成静默少扫),但**不再有任何一个块被判不出**。
 */

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * locale → 出现即构成族级矛盾的**标记名**(kana / hangul / han;`kana` 是 hira ∪ kata 的派生标记,
 * 因为"混入假名"这条判据不需要区分平片)。`null` = 该 locale 的 L1 **整门不判**(逃生舱,
 * 当前**无任何成员使用**,见下方断言)。这张表是"名单",故 `--self-test` 逐行取它自己的成员做正例
 * (守门 120 要求的那种"名单有牙"证明)。
 *
 * ⚠️ **`en` 曾经是 `null`,2026-10-06 收口时改回有判据**(票:让 `--strict` 归零)。原注释写的是
 * "en 整门的 L1 刻意不判(品牌/术语原文必须留在此文件)"—— 意图对,实现是**按 locale 无条件不判**:
 * `scanLocaleContent` 在叶子循环之前就 return,所以 en.json 里混入中文残留永远不被 L1a 抓。实测
 * 该洞是真的:`check-i18n-broken-en.mjs` 只接了 7 面中的 3 面(web/extension/shared),
 * api / cli / miniapp-taro / mobile-rn 的 en.json 无门可管。合法的那 2 处汉字由 **E4** 放过。
 */
export const LOCALE_MATRIX = {
  'zh-CN': { foreign: ['kana', 'hangul'] },
  'zh-TW': { foreign: ['kana', 'hangul'] },
  ja: { foreign: ['hangul'] },
  ko: { foreign: ['kana'] },
  en: { foreign: ['kana', 'hangul', 'han'] },
}
/** 标记全集:矩阵里出现的名字必须落在这里,拼错就等于那条判据永不命中 */
export const MARK_NAMES = ['kana', 'hangul', 'han']
/** 汉字在某 locale 属"他门射程":不判但计数(见文件头 L1a 第二条边界) */
const HAN_ELSEWHERE_OWNED = new Set(['ko'])
/** 码位族 → L1a 标记(kana = hira ∪ kata;latin 不参与跨族矛盾判定) */
const MARK_OF_FAMILY = { hira: 'kana', kata: 'kana', hangul: 'hangul', han: 'han' }

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工排查 / 测试夹具的逃生舱,提交链不走这档)',
}

/** 纯函数:argv → 判定面(口径与守门 36/56/60/124 逐字同形) */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/** `--root <dir>` 只作测试夹具通道;缺参数值不得静默退回仓库根 */
export function rootFromArgv(argv, def = ROOT) {
  const i = argv.indexOf('--root')
  if (i === -1) {
    const inline = argv.find((a) => a.startsWith('--root='))
    if (!inline) return { root: def, error: null }
    const value = inline.slice('--root='.length)
    return value
      ? { root: resolve(value), error: null }
      : { root: null, error: '--root= 后面必须给目录' }
  }
  const value = argv[i + 1]
  if (!value || value.startsWith('--'))
    return { root: null, error: '--root 需要一个目录参数(不得静默退回仓库根)' }
  return { root: resolve(value), error: null }
}

/** 语言包路径形态:messages/<target>/<locale>.json;不匹配的计入 skippedPathShapes。
 *  locale 段必须是 `ja` / `zh-CN` 这种 BCP-47 形状 —— 于是 `ja.bak.json`、`sub/ja.json`
 *  一律 null 并被如实计数,而不是"当成一个叫 ja.bak 的语言"闷声扫。 */
export function parseLocalePath(rel) {
  const m = /^packages\/i18n\/messages\/([^/]+)\/([^/.]+)\.json$/.exec(rel)
  if (!m) return null
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,4})?$/.test(m[2])) return null
  return { target: m[1], locale: m[2] }
}

/**
 * 枚举判定面上的 locale 文件。git 面只出**路径**,内容一律交给 readFaceTexts 在同一次
 * `cat-file --batch` 里读满 —— 枚举与内容必须同面同轮。
 * @returns {{rels:string[],unparsed:number}|null} null = 该面取不到(调用方判死,不回落)
 */
export function listLocaleRels(root, face, messagesRel = MESSAGES_REL) {
  let all
  if (face === 'worktree') {
    const dir = join(root, messagesRel)
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return null
    const walk = (d) => {
      const out = []
      for (const name of readdirSync(d)) {
        const p = join(d, name)
        if (statSync(p).isDirectory()) out.push(...walk(p))
        else if (name.endsWith('.json')) out.push(p)
      }
      return out
    }
    all = walk(dir).map((p) => relative(root, p).split(sep).join('/'))
  } else {
    const args =
      face === 'staged'
        ? ['ls-files', '--', messagesRel]
        : ['ls-tree', '-r', '--name-only', 'HEAD', '--', messagesRel]
    const out = gitRaw(args, root)
    if (out === null) return null
    all = out.split('\n').filter((l) => l.trim() && l.endsWith('.json'))
  }
  const rels = all.filter((r) => parseLocalePath(r))
  return { rels: rels.sort(), unparsed: all.length - rels.length }
}

/** 同面同轮读满:任一文件取不到 ⇒ 抛 Undetermined(调用方折成 exit 2,不回落磁盘也不回落另一个面) */
export function readFaceTexts(root, face, rels) {
  if (face === 'worktree') {
    const out = new Map()
    for (const rel of rels) {
      const t = readWorktreeFile(root, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树取不到 ${rel}`)
      out.set(rel, t)
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = new Map()
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
    out.set(rels[i], t)
  }
  return out
}

/**
 * L2 棘轮锚点:该文件在 **HEAD** 的 L2 存量数。
 * 单文件在 HEAD 不存在(本次新增)⇒ 锚点 0,于是新增内容一律判红 —— 这是"新增即拦"的正确形态。
 * git 整体取不到 ⇒ 抛给调用方,由它**如实喊出**"锚点取不到,按 0 计"(那会让本门更严,不是更松)。
 */
export function readL2Anchors(root, rels) {
  const specs = rels.map((r) => `HEAD:${r}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const anchors = new Map()
  let missingFromHead = 0
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined) {
      anchors.set(rels[i], 0)
      missingFromHead++
      continue
    }
    let obj = null
    try {
      obj = JSON.parse(t)
    } catch {
      obj = null
    }
    anchors.set(rels[i], obj ? findSelfNesting(obj).sole.length : 0)
  }
  return { anchors, missingFromHead }
}

/** 读常用汉字表(判据输入,按被审面取)。取不到 ⇒ {set:null,error} —— 调用方记未判定,不猜。
 *  ⚠️ **每条"取不到"都必须带得出原因**:本函数第一版在"文件在、解不出"时把 error 留成 null,
 *  于是结论行打成 `未判定(null)` —— 一句让人无法行动的诊断,与 §5d"读不到被下游报成失效"同族。
 *  专名字集合(`properNouns`)走**同一个 raw / 同一个面**:表与专名集同源,分开读就会出现
 *  "表已更新、专名集还是旧的"这种口径漂移,而漂移的表现是门变绿 —— 最坏的方向。 */
export function loadJoyo(root, face) {
  const finish = (raw, source, missingText) => {
    if (raw === null || raw === undefined)
      return { set: null, proper: null, source: null, error: missingText || `${JOYO_REL} 在该面取不到` }
    const set = joyoSetFromRaw(raw)
    if (!set)
      return {
        set: null,
        proper: null,
        source,
        error: `${JOYO_REL} 取到了但解不出 ≥2000 字(表被截断或格式变了)`,
      }
    return { set, proper: properNounSetFromRaw(raw), source, error: null }
  }
  if (face === 'worktree') {
    try {
      return finish(readWorktreeFile(root, JOYO_REL), '工作树', `${JOYO_REL} 不在工作树上`)
    } catch (e) {
      return { set: null, source: null, error: known(e) }
    }
  }
  const spec = (face === 'staged' ? ':' : 'HEAD:') + JOYO_REL
  try {
    const got = catBatch(root, [spec], { maxBuffer: 1 << 26 })
    return finish(got.get(spec), FACE_TXT[face], `${JOYO_REL} 在${FACE_TXT[face]}上不存在`)
  } catch (e) {
    return { set: null, source: null, error: known(e) }
  }
}

/** E2:叶子键名是否点名某种语言(locale 码从被审目录的文件名推出,没有手工清单) */
export function isEndonymKey(lastSegment, localeCodes) {
  const norm = String(lastSegment)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  if (!norm) return false
  for (const code of localeCodes) {
    const c = String(code)
      .toLowerCase()
      .replace(/[^a-z]/g, '')
    if (!c || c.length < 2) continue
    if (!norm.endsWith(c)) continue
    if (norm === c || norm.startsWith('lang') || norm.startsWith('language')) return true
  }
  return false
}

/** E1:与同 target 的 zh-CN **同键路径逐字相同**(审的文件就是 zh-CN 时调用方已挡住,见文件头) */
export function sameAsZhCn(zhObj, segs, value) {
  if (!zhObj || typeof zhObj !== 'object') return false
  let cur = zhObj
  for (const seg of segs) {
    if (Array.isArray(cur)) {
      const i = Number(seg)
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return false
      cur = cur[i]
      continue
    }
    if (cur && typeof cur === 'object' && seg in cur) cur = cur[seg]
    else return false
  }
  return typeof cur === 'string' && cur === value
}

/**
 * E3:该叶子是否**整体**是"专名的日文正字形写法"⇒ 豁免(只报数)。
 *
 * 立论(2026-10-06 由 HEAD 面恒红逼出):`aboutIcprecord.r2` = `吉林省愛智匯人工智能科技有限公司`。
 * 它躲过 E1「与 zh-CN 逐字相同」不是因为内容对,而是因为 ja 侧用**日文正字形**(愛/匯/學)而
 * zh-CN 侧用**中国简化字**(爱/汇/学)—— 逐字不同 ⇒ E1 判不出来 ⇒ 落进 L1b 挨打。
 * 这是「专名的日文正字形写法」这一整类被漏到 L1b 的真实病灶,不是孤例。
 *
 * ⚠️ **必须落在叶子级(叶子值 + 键上下文),不能落在字级**。同一个 `智` 在 `community.text1`
 * (公司名 `智匯AI`) 与在别的键(普通词)身份完全不同;字级放行对两者一视同仁,那不叫分派,
 * 叫"靠改表过门"。所以本判据读的是**叶子的全部表外字种**:全部落在专名集合内才豁免,
 * 只要掺进一个非专名的表外字(真残留),整叶仍判 —— 这就是反向防线。
 *
 * @param {string} value 叶子值
 * @param {Set<string>|null} proper 专名字集合;null = 未取到 ⇒ **false**(不猜也不放行)
 * @param {Set<string>|null} joyo 常用汉字表;null ⇒ false
 * @returns {{ok:boolean, chars:string}} chars = 落在专名集合内的那些表外字(报数用)
 */
export function properNounLeaf(value, proper, joyo) {
  if (!proper || proper.size === 0) return { ok: false, chars: '' }
  const suspects = nonJoyoHan(value, joyo)
  if (!suspects) return { ok: false, chars: '' }
  let chars = ''
  for (const ch of suspects) if (proper.has(ch)) chars += ch
  return { ok: chars.length > 0 && chars.length === [...suspects].length, chars }
}

/** 值里出现的 L1a 族标记集合(kana / hangul / han);纯拉丁/数字/标点 ⇒ 空 */
export function marksOfValue(v) {
  const hit = new Set()
  for (const f of familiesIn(v)) {
    const m = MARK_OF_FAMILY[f]
    if (m) hit.add(m)
  }
  return hit
}

/**
 * E4:**叶子级**双语标注豁免 —— 英文句子中间夹一句中文对照(SEO 写法),不是"没翻译"。
 *
 * 立论(2026-10-06 由「en 整门不判 ⇒ `--strict` 归不了零」逼出):把 `en` 放回 L1 矩阵后,HEAD 面
 * 立刻冒出 3 处候选,其中 2 处是 `web/en.json` 的
 * `about.metaDescription` = `IHUI AI (智汇 AI) is an all-in-one …` 与
 * `faq.q1Answer` = `IHUI AI (Chinese: 智汇 AI) is …`。它们与 zh-CN **逐字不同**(所以 E1 判不出),
 * 但**确实不是错语种** —— 括号里是品牌原文,括号外是完整英文。所以需要一条豁免,但必须**最窄**:
 *
 *   ① 值里**有**汉字(否则本函数不参与,谈不上豁免任何东西);
 *   ② **全部**汉字都落在成对的圆括号段内 —— 括号外出现任何一个汉字 ⇒ 那是正文,不是标注;
 *   ③ 括号外**有拉丁字母** —— `(智汇)` 这种"只有括号内中文、括号外没英文"的形态不是双语标注。
 *
 * **反向防线(这三条就是本判据的全部牙)**:整段未翻译的 `会话整理`、汉字跑到括号外的
 * `整理会话 (Organize chats)`、裸品牌 `智汇`、以及 `(智汇)` —— 逐条都**不豁免**,照判。
 * 另:`E4` **只认 han**,不认 kana / hangul —— en 里出现假名/谚文一律判(`settings.ko = "한국어"`
 * 那种语言本名由 E2 放过,不是由 E4)。
 *
 * @param {string} value 叶子值
 * @returns {{ok:boolean, chars:string}} chars = 括号内命中的那些汉字(报数用)
 */
export function bilingualAnnotationLeaf(value) {
  const s = String(value)
  if (!hasHan(s)) return { ok: false, chars: '' }
  let depth = 0
  let chars = ''
  let outside = ''
  for (const ch of s) {
    if (ch === '(' || ch === '（') {
      depth++
      continue
    }
    if (ch === ')' || ch === '）') {
      if (depth > 0) depth--
      continue
    }
    if (depth > 0) {
      if (hasHan(ch)) chars += ch
    } else outside += ch
  }
  // 括号没合上 / 括号外有汉字 / 括号外没有拉丁字母 ⇒ 都不是"英文句子夹一句中文对照"
  if (depth !== 0) return { ok: false, chars: '' }
  if (!chars) return { ok: false, chars: '' }
  if (hasHan(outside)) return { ok: false, chars: '' }
  if (!/[A-Za-z]/.test(outside)) return { ok: false, chars: '' }
  return { ok: true, chars: [...new Set(chars)].join('') }
}

/**
 * 叶子摊平。数组元素里的字符串**同样参与判定**(那是端上会渲染的文案),其下标进 `segs`,
 * 于是 E1 能在对照文件里走到同一个下标。`path` 只用于人读的点号串。
 *
 * ⚠️ **本函数刻意不接受"取多少叶"上限**(2026-10-06 删)。这里曾有一个 `max` 参数,块级传
 * `MAX_LEAVES_PER_BLOCK`(4000)、文件级传 `Infinity`,两次都栽了同一型:
 *   · 第一次:上限**同时**套在文件级上,于是 `web/*.json`(22,702 叶)只扫了前 4,000 叶 —— 门一路
 *     报绿,而 ②③ 号真事故(zh-TW 装谚文 10 处、ko 装假名 1 处)**结构上看不见**。
 *   · 第二次:块级那 4,000 仍在,把 `web/ja.json::admin`(4,804 叶)变成永久未判定 ⇒ `--strict`
 *     永远 exit 2。
 * "少扫不红"是本仓反复登记的最高频失效型,而**上限这个参数本身就是那个失效型的载体** ——
 * 它让"没扫"和"扫了没事"在代码里长得一模一样,调用方还得记得自己传的是哪一层。
 * 所以这里**删掉参数**而不是删掉阈值:能力唯一(全量),误用面消失。块的大小仍然可见
 * (`scanLocaleContent` 单列打印 `maxBlockLeaves`),所以"块变大了"不会变成静默少扫。
 */
export function collectLeaves(node, segs, out, path = '') {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const item = node[i]
      const s = [...segs, i]
      const p = `${path}[${i}]`
      if (item && typeof item === 'object') collectLeaves(item, s, out, p)
      else if (typeof item === 'string') out.push({ segs: s, path: p, v: item })
    }
    return out
  }
  for (const [k, v] of Object.entries(node)) {
    const s = [...segs, k]
    const p = path ? `${path}.${k}` : k
    if (v && typeof v === 'object') collectLeaves(v, s, out, p)
    else if (typeof v === 'string') out.push({ segs: s, path: p, v })
  }
  return out
}

/** 该叶子的人读路径是否"点名某种语言"(E2):取最后一个**字符串**段(数组下标不算键名) */
export function leafKeyName(segs) {
  for (let i = segs.length - 1; i >= 0; i--) if (typeof segs[i] === 'string') return segs[i]
  return ''
}

/**
 * L2:同名自套一层。
 * @returns {{sole:{path:string}[], notSole:{path:string}[]}} sole = 判据;notSole = 只报数
 */
export function findSelfNesting(node, prefix = '', sole = [], notSole = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return { sole, notSole }
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue
    const sub = Object.keys(v)
    if (sub.length === 1 && sub[0] === k) sole.push({ path: p })
    else if (sub.includes(k)) notSole.push({ path: p })
    findSelfNesting(v, p, sole, notSole)
  }
  return { sole, notSole }
}

/**
 * 单份 locale 文件的全部判据。**纯函数**(不碰磁盘 / 不派生 git),所以每条分支都能被自检构造出来。
 * @param rel 被审文件路径
 * @param obj 已 JSON.parse 的语言包对象;null = 解析失败(⇒ 计入未判定)
 * @param opts {{locale,localeCodes,zhCnObj,zhCnMissing,joyo,proper}}
 */
export function scanLocaleContent(rel, obj, opts) {
  const { locale, localeCodes, zhCnObj, zhCnMissing, joyo, proper } = opts
  const res = {
    rel,
    locale,
    leaves: 0,
    l1a: [],
    l1b: [],
    exemptEndonym: [],
    exemptIdentical: [],
    exemptProper: [],
    exemptBilingual: [],
    hanElsewhereOwned: 0,
    notJudgedLocale: LOCALE_MATRIX[locale] === null,
    undetermined: [],
    l2Sole: [],
    l2NotSole: [],
    maxBlockLeaves: 0,
    maxBlockPath: '',
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    res.undetermined.push(`${rel}:JSON 不可解析(或不是对象)⇒ 本门无法判定`)
    return res
  }
  const nest = findSelfNesting(obj)
  res.l2Sole = nest.sole
  res.l2NotSole = nest.notSole

  const leaves = collectLeaves(obj, [], [])
  res.leaves = leaves.length
  const foreign = LOCALE_MATRIX[locale]
  if (!foreign) {
    // ⚠️ 走到这里的**只有两种**locale,两种都必须"有话说"而不是静默放过:
    //   ① `LOCALE_MATRIX[locale] === undefined` —— 出现了**表里没有**的 locale(新增语种文件)。
    //     记未判定是**判死**:本门对这个语种一条判据都没有,放行等于假绿。
    //   ② `=== null` —— 表里显式声明"该 locale 的 L1 整门不判"的逃生舱。**当前无成员使用**
    //     (原先的 `en` 已于 2026-10-06 改成有判据,理由见 LOCALE_MATRIX 的注释)。留着它是因为
    //     "删掉逃生舱"会逼着下一个人把合法例外塞进行内标记;但用它必须付"记未判定 ⇒ --strict
    //     exit 2"的代价,所以它是一个**要付代价的**决定,不是静默选项。
    // ⚠️ 措辞刻意**不写"刻意不判"**:那会把"有意的设计决策"与"结论不完整"读成同一件事 ——
    //   2026-10-06 之前 `en` 就是被写成"刻意不判"而落进未判定清单的,`--strict` 因此永远归不了零。
    //   真正的"刻意不判"该走**豁免**(E1~E4,只报数),不该走未判定。
    res.undetermined.push(
      foreign === null
        ? `${rel}:locale「${locale}」在 LOCALE_MATRIX 里被显式声明为 L1 整门不判(逃生舱);L2 仍判。` +
          `若这是有意的设计决策,应改走 E1~E4 豁免(只报数)而不是留在未判定清单里`
        : `${rel}:locale「${locale}」不在 LOCALE_MATRIX 里 ⇒ 本门对它一条判据都没有,判死而不记绿`,
    )
    return res
  }
  const foreignSet = new Set(foreign.foreign)
  const endonym = (leaf) => isEndonymKey(leafKeyName(leaf.segs), localeCodes)

  for (const leaf of leaves) {
    const { path, v } = leaf
    const marks = marksOfValue(v)
    if (marks.size === 0) continue
    const hitMarks = [...marks].filter((m) => foreignSet.has(m))
    if (!hitMarks.length) {
      if (marks.has('han') && HAN_ELSEWHERE_OWNED.has(locale)) res.hanElsewhereOwned++
      continue
    }
    if (endonym(leaf)) {
      res.exemptEndonym.push({ path, marks: hitMarks.join('+'), v: v.slice(0, 40) })
      continue
    }
    if (locale !== 'zh-CN') {
      if (sameAsZhCn(zhCnObj, leaf.segs, v)) {
        res.exemptIdentical.push({ path, marks: hitMarks.join('+'), v: v.slice(0, 40) })
        continue
      }
      if (zhCnMissing) {
        res.undetermined.push(
          `${rel}::${path} 出现 ${hitMarks.join('+')},但该 target 无 zh-CN 可对照 ⇒ E1 判不出`,
        )
        continue
      }
    }
    // E4 只在矛盾标记**只有 han**时才可能成立(en 这一格)。⚠️ 这个限定是判据的一部分,不是优化:
    //   若允许 kana/hangul 混着一起豁免,`Sessions (中文) セッション` 这种值会被 E4 一起放过 ——
    //   括号里的中文是合法标注,但**括号外的假名是真的错了**,一豁免就一起看不见了。
    //   `bilingualAnnotationLeaf` 自己只看汉字,这里再挡一层"hitMarks 里不许有非 han 的标记"。
    if (hitMarks.length === 1 && hitMarks[0] === 'han') {
      const bi = bilingualAnnotationLeaf(v)
      if (bi.ok) {
        res.exemptBilingual.push({
          path,
          marks: hitMarks.join('+'),
          chars: bi.chars,
          v: v.slice(0, 40),
        })
        continue
      }
    }
    res.l1a.push({ path, marks: hitMarks.join('+'), v: v.slice(0, 60) })
  }

  if (locale === 'ja') {
    if (!joyo) {
      res.undetermined.push(`${rel}:常用汉字表(${JOYO_REL})取不到 ⇒ L1b 未判定(不猜,也不放行)`)
    } else {
      if (!proper)
        res.undetermined.push(
          `${rel}:专名字集(${JOYO_REL} 的 properNouns)取不到 ⇒ E3 判不出,L1b 照判(不猜,也不放行)`,
        )
      const exemptProperSeen = new Set()
      const walkBlocks = (node, prefix, baseSegs) => {
        for (const [k, v] of Object.entries(node)) {
          if (!v || typeof v !== 'object' || Array.isArray(v)) continue
          const p = prefix ? `${prefix}.${k}` : k
          const segs = [...baseSegs, k]
          // **全量**摊平(上限已删,理由见 collectLeaves 的注释):块再大也只是多判一遍,
          // 换来的是"没有任何块因为大而判不出"。块的大小仍然被**看见**(下面 maxBlockLeaves)。
          const all = collectLeaves(v, segs, [], p)
          if (all.length > res.maxBlockLeaves) {
            res.maxBlockLeaves = all.length
            res.maxBlockPath = p
          }
          // 三道豁免并列为**结构式**判据(E1 逐字相同 / E2 键名点名语言 / E3 叶子整体是专名
          // 正字形写法),不新增行内标记族 ⇒ 不给守门 108 添新账。E3 落在叶子级而非字级:
          // 掺进任何一个非专名的表外字,整叶仍判(反向防线,见 properNounLeaf 的立论)。
          // ⚠️ 块是**递归**遍历的(一个叶子属于所有祖先块),豁免计数必须按路径去重,
          // 否则同一个叶子会被它的每个祖先块各数一次,报数虚高。
          const usable = all.filter((l) => {
            if (isEndonymKey(leafKeyName(l.segs), localeCodes)) return false
            if (sameAsZhCn(zhCnObj, l.segs, l.v)) return false
            const pn = properNounLeaf(l.v, proper, joyo)
            if (pn.ok) {
              if (!exemptProperSeen.has(l.path)) {
                exemptProperSeen.add(l.path)
                res.exemptProper.push({ path: l.path, chars: pn.chars, v: l.v.slice(0, 40) })
              }
              return false
            }
            return true
          })
          const hanLeaves = usable.filter((l) => hasHan(l.v))
          const scriptLeaves = usable.filter((l) => marksOfValue(l.v).size > 0)
          const kanaLeaves = usable.filter((l) => hasKana(l.v) || hasHangul(l.v))
          if (
            usable.length >= MIN_BLOCK_LEAVES &&
            hanLeaves.length >= MIN_BLOCK_LEAVES &&
            kanaLeaves.length === 0 &&
            scriptLeaves.length > 0 &&
            hanLeaves.length / scriptLeaves.length >= HAN_SHARE_MIN
          ) {
            const suspects = new Set()
            for (const l of hanLeaves)
              for (const ch of nonJoyoHan(l.v, joyo) || '') suspects.add(ch)
            if (suspects.size > 0)
              res.l1b.push({
                path: p,
                leaves: usable.length,
                suspects: [...suspects].join(''),
                example: hanLeaves[0].v.slice(0, 40),
              })
          }
          walkBlocks(v, p, segs)
        }
      }
      walkBlocks(obj, '', [])
    }
  }
  return res
}

/** 汇总(纯函数) */
export function summarize(results, anchors) {
  const s = {
    files: results.length,
    leaves: 0,
    l1a: [],
    l1b: [],
    l2: [],
    exemptEndonym: [],
    exemptIdentical: [],
    exemptProper: [],
    exemptBilingual: [],
    hanElsewhereOwned: 0,
    l2SoleTotal: 0,
    l2WithinAnchor: 0,
    l2NotSole: 0,
    notJudgedLocales: new Set(),
    undetermined: [],
    maxBlockLeaves: 0,
    maxBlockWhere: '',
  }
  for (const r of results) {
    s.leaves += r.leaves
    for (const x of r.l1a) s.l1a.push({ ...x, rel: r.rel })
    for (const x of r.l1b) s.l1b.push({ ...x, rel: r.rel })
    for (const x of r.exemptEndonym) s.exemptEndonym.push({ ...x, rel: r.rel })
    for (const x of r.exemptIdentical) s.exemptIdentical.push({ ...x, rel: r.rel })
    for (const x of r.exemptProper) s.exemptProper.push({ ...x, rel: r.rel })
    for (const x of r.exemptBilingual) s.exemptBilingual.push({ ...x, rel: r.rel })
    s.hanElsewhereOwned += r.hanElsewhereOwned
    s.l2NotSole += r.l2NotSole.length
    // 取代被删掉的"块样本截断"计数:块不再有上限,所以"块有多大"改由**最大块**单列报出。
    // 可见性不能跟着上限一起删 —— 否则"某个块悄悄变大"就又变成一件没人看得见的事。
    if (r.maxBlockLeaves > s.maxBlockLeaves) {
      s.maxBlockLeaves = r.maxBlockLeaves
      s.maxBlockWhere = `${r.rel}::${r.maxBlockPath}`
    }
    if (r.notJudgedLocale) s.notJudgedLocales.add(r.locale)
    s.undetermined.push(...r.undetermined)
    const anchor = anchors ? (anchors.get(r.rel) ?? 0) : 0
    // "存量只报数"必须**看得见数字**:只报"超过锚点的"而不报"锚点内还有多少",
    // 读报告的人就会把 0 个超锚点读成 0 处存量(本门立项读数正是 5 处)。
    s.l2SoleTotal += r.l2Sole.length
    s.l2WithinAnchor += Math.min(r.l2Sole.length, anchor)
    if (r.l2Sole.length > anchor)
      s.l2.push({
        rel: r.rel,
        count: r.l2Sole.length,
        anchor,
        paths: r.l2Sole.slice(0, 8).map((x) => x.path),
      })
  }
  return s
}

/**
 * 纯函数:由结论算退出码。**本门定级的唯一落点**,所以每条分支都能被自检构造证明。
 * 优先级:判红 > 未判定(strict 才拦) > 通过。
 */
export function decide(s, { strict } = {}) {
  const reds = []
  if (s.l2.length)
    reds.push(
      `L2 同名自套一层:${s.l2.length} 个文件的计数超过其 HEAD 锚点(存量走棘轮,新增一律判红)`,
    )
  if (strict && (s.l1a.length || s.l1b.length))
    reds.push(`L1 语种矛盾:${s.l1a.length} 处叶级 + ${s.l1b.length} 个块(默认档只报数)`)
  if (reds.length) return { code: 1, reasons: reds }
  if (strict && s.undetermined.length)
    return {
      code: 2,
      reasons: [`--strict 下有 ${s.undetermined.length} 处未判定 ⇒ 结论不完整,不记为通过`],
    }
  return { code: 0, reasons: [] }
}

const clip = (t, n = 80) => String(t).replace(/\s+/g, ' ').slice(0, n)
const known = (e) => (e instanceof Undetermined ? e.message : (e?.stack ?? String(e)))

function printList(label, arr, fmt, showAll) {
  if (!arr.length) return
  console.log(`${C.red}  ${label} ${arr.length} 处:${C.reset}`)
  const show = showAll ? arr : arr.slice(0, 10)
  for (const x of show) console.log(`    ${C.dim}${fmt(x)}${C.reset}`)
  if (!showAll && arr.length > show.length)
    console.log(`    ${C.dim}… 另 ${arr.length - show.length} 处(--all 全列)${C.reset}`)
}

function main() {
  const argv = process.argv.slice(2)
  if (process.env[SKIP_ENV] === '1') {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 i18n 语种内容/同名自套守门(不推荐)${C.reset}`)
    process.exit(0)
  }
  if (argv.includes('--self-test')) process.exit(runSelfTest())

  const faceSel = faceFromArgv(argv)
  if (faceSel.error) {
    console.log(`${C.red}❌ 无法判定:${faceSel.error}${C.reset}`)
    process.exit(2)
  }
  const face = faceSel.face
  const sel = rootFromArgv(argv)
  if (sel.error) {
    console.log(`${C.red}❌ 无法判定:${sel.error}${C.reset}`)
    process.exit(2)
  }
  const root = sel.root
  if (face !== 'worktree' && root !== ROOT) {
    console.log(
      `${C.red}❌ 无法判定:--root 只在 --worktree 档有效(当前判定面:${FACE_TXT[face]})${C.reset}`,
    )
    process.exit(2)
  }
  const strict = argv.includes('--strict')
  const showAll = argv.includes('--all')

  const disjoint = rangesAreDisjoint()
  if (!disjoint.ok) {
    console.log(
      `${C.red}❌ 无法判定:码位族区间相交 ⇒ "哪段码位算哪族"没有唯一答案:${disjoint.overlaps.join('; ')}${C.reset}`,
    )
    console.log(`[i18n-locale-lang] 判定面:${FACE_TXT[face]} 文件 0 候选 0 判红 0 未判定 1`)
    process.exit(2)
  }

  let listed
  try {
    listed = listLocaleRels(root, face)
  } catch (e) {
    console.log(`${C.red}❌ 无法判定:枚举失败 ${known(e)}${C.reset}`)
    process.exit(2)
  }
  if (!listed) {
    console.log(
      `${C.yellow}⚠ 判定面(${FACE_TXT[face]})上没有 ${MESSAGES_REL} ⇒ 无法判定(空扫不记绿)${C.reset}`,
    )
    process.exit(2)
  }
  if (listed.rels.length === 0) {
    console.log(
      `${C.red}❌ 无法判定:判定面(${FACE_TXT[face]})上枚举到 0 个 locale 文件 ⇒ 判死而不记绿${C.reset}`,
    )
    process.exit(2)
  }
  let texts
  try {
    texts = readFaceTexts(root, face, listed.rels)
  } catch (e) {
    console.log(`${C.red}❌ 无法判定:${known(e)}(不回落另一个面)${C.reset}`)
    process.exit(2)
  }
  const localeCodes = [...new Set(listed.rels.map((r) => parseLocalePath(r).locale))]
  const joyoInfo = loadJoyo(root, face)

  let anchors = new Map()
  let anchorNote = ''
  if (face === 'head') {
    // 锚点面 == 判定面:同一次读的结果自己算(不必二次派生 git)
    for (const rel of listed.rels) {
      let o = null
      try {
        o = JSON.parse(texts.get(rel))
      } catch {
        o = null
      }
      anchors.set(rel, o ? findSelfNesting(o).sole.length : 0)
    }
  } else {
    try {
      const r = readL2Anchors(root, listed.rels)
      anchors = r.anchors
      if (r.missingFromHead)
        anchorNote = `(${r.missingFromHead} 个文件在 HEAD 不存在 ⇒ 锚点按 0 计)`
    } catch (e) {
      anchorNote = '锚点面(HEAD)取不到 ⇒ 全部按 0 计,新增一律判红:' + known(e)
      console.log(`${C.yellow}⚠ L2 ${anchorNote}${C.reset}`)
    }
  }

  const zhByTarget = new Map()
  for (const rel of listed.rels) {
    const { target, locale } = parseLocalePath(rel)
    if (locale !== 'zh-CN') continue
    try {
      zhByTarget.set(target, JSON.parse(texts.get(rel)))
    } catch {
      zhByTarget.set(target, null)
    }
  }

  const results = []
  for (const rel of listed.rels) {
    const { target, locale } = parseLocalePath(rel)
    let obj = null
    try {
      obj = JSON.parse(texts.get(rel))
    } catch {
      obj = null
    }
    results.push(
      scanLocaleContent(rel, obj, {
        locale,
        localeCodes,
        zhCnObj: locale === 'zh-CN' ? null : (zhByTarget.get(target) ?? null),
        zhCnMissing: locale !== 'zh-CN' && !zhByTarget.has(target),
        joyo: joyoInfo.set,
        proper: joyoInfo.proper,
      }),
    )
  }
  const s = summarize(results, anchors)
  const d = decide(s, { strict })
  const l1Total = s.l1a.length + s.l1b.length

  console.log(
    `${C.cyan}${C.bold}🔎 i18n 语种内容/同名自套守门(${MESSAGES_REL};${s.files} 文件、${s.leaves} 条叶子;判定面:${FACE_TXT[face]})${C.reset}`,
  )
  console.log(
    `  ${C.dim}族表:${FAMILY_NAMES.join('/')}(${Object.values(SCRIPT_RANGES).reduce((a, p) => a + p.length, 0)} 段区间,两两不相交) 常用汉字表:${joyoInfo.set ? `${joyoInfo.set.size} 字(${joyoInfo.source})` : `未取到 ⇒ L1b 未判定(${joyoInfo.error})`}${anchorNote ? ' L2 锚点:' + anchorNote : ''}${C.reset}`,
  )
  console.log(
    `  ${C.dim}口径:L1 默认档只报数(--strict 问责) / L2 每文件 HEAD 存量棘轮 / 不判:ko 的汉字(他门射程,实测 ${s.hanElsewhereOwned} 处)、${[...s.notJudgedLocales].join('/') || '无'} 的 L1(逃生舱,当前无成员)、zh-CN 自身的 E1 豁免、汉字族内部简繁(码位判不了)${C.reset}`,
  )
  console.log(
    `  ${C.dim}豁免命中:E2 语言本名 ${s.exemptEndonym.length} 处、E1 与 zh-CN 逐字相同 ${s.exemptIdentical.length} 处、E3 专名(叶子级,日文正字形)${s.exemptProper.length} 处${s.exemptProper.length === 0 ? C.yellow + '(⚠ 归零 = 合法字被当残留抓了,或 properNouns 未随表落库)' + C.dim : ''}、E4 双语标注(叶子级,en 括号内对照)${s.exemptBilingual.length} 处${s.exemptBilingual.length === 0 ? C.yellow + '(⚠ 归零 = en 里已无括号内双语标注,E4 该退役了)' + C.dim : ''};L2 同名自套存量 ${s.l2SoleTotal} 处(其中 ${s.l2WithinAnchor} 处落在各自 HEAD 锚点内 ⇒ 只报数不判红)、L2「同名但非唯一子键」(仓内既有形态,不判)${s.l2NotSole} 处;最大块 ${s.maxBlockLeaves} 叶(${s.maxBlockWhere || '无块'},无上限 ⇒ 没有任何块因大而未判定)${C.reset}`,
  )
  if (listed.unparsed)
    console.log(
      `  ${C.yellow}路径形态不是 <target>/<locale>.json 而跳过的 .json:${listed.unparsed}${C.reset}`,
    )

  printList(
    'L1a 叶级跨族候选',
    s.l1a,
    (x) => `${x.rel} :: ${x.path} [${x.marks}] = ${JSON.stringify(clip(x.v))}`,
    showAll,
  )
  printList(
    'L1b ja 整块汉字且含非日本常用汉字',
    s.l1b,
    (x) =>
      `${x.rel} :: ${x.path} 叶子=${x.leaves} 嫌疑字=${x.suspects} 例=${JSON.stringify(clip(x.example))}`,
    showAll,
  )
  printList(
    'L2 同名自套一层(超出该文件 HEAD 锚点)',
    s.l2,
    (x) => `${x.rel} 计数=${x.count} 锚点=${x.anchor} ${x.paths.join(', ')}`,
    showAll,
  )
  printList(
    '豁免命中(只报数)',
    s.exemptEndonym
      .concat(s.exemptIdentical)
      .concat(s.exemptProper.map((x) => ({ ...x, marks: `专名:${x.chars}` })))
      .concat(s.exemptBilingual.map((x) => ({ ...x, marks: `双语标注:${x.chars}` }))),
    (x) => `${x.rel} :: ${x.path} [${x.marks}] = ${JSON.stringify(clip(x.v))}`,
    showAll,
  )
  printList(
    '未判定(不记绿也不冒红)',
    s.undetermined.map((t) => ({ t })),
    (x) => x.t,
    showAll,
  )

  if (d.code === 2)
    console.log(`${C.yellow}⚠ 无法判定(不是"通过"):${d.reasons.join(';')}${C.reset}`)
  else if (d.code === 1) {
    console.log(`${C.red}${C.bold}❌ 判红:${d.reasons.join(';')}${C.reset}`)
    console.log(
      `${C.yellow}修复:改语言包**内容**属修数据,本门只判不改。按上面点名的键路径逐条改写成该 locale 的语言。${C.reset}`,
    )
    console.log(`${C.yellow}问责 L1(存量未清,默认档只报数):加 --strict${C.reset}`)
    console.log(`紧急跳过(不推荐):${C.cyan}${SKIP_ENV}=1 git commit ...${C.reset}`)
  } else if (l1Total > 0)
    console.log(
      `${C.green}✅ 默认档通过 —— L1 候选 ${l1Total} 处仅报数(存量未清时判红就是恒红门;问责跑 --strict)${C.reset}`,
    )
  else console.log(`${C.green}✅ 未发现语种内容矛盾,也无同名自套一层的新增${C.reset}`)

  console.log(
    `[i18n-locale-lang] 判定面:${FACE_TXT[face]} 文件 ${s.files} 候选 ${l1Total + s.l2.length} 判红 ${d.code === 1 ? l1Total + s.l2.length : 0} 未判定 ${s.undetermined.length}`,
  )
  process.exit(d.code)
}

/* ── 取证:--self-test(成对正反例;夹具全在内存,只有真表加载那条读实际文件) ──── */
function runSelfTest() {
  let pass = 0
  let fail = 0
  const A = (name, cond, extra = '') => {
    if (cond) {
      pass++
      console.log(`  ✅ ${name}`)
    } else {
      fail++
      console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`)
    }
  }
  // 合成常用汉字表:只放"日本确实常用"的字,让 T2b 那一型能被证明放过(真表另由 T11/T2b 用)
  const JOYOS = new Set([
    '会',
    '化',
    '删',
    '除',
    '削',
    '保',
    '存',
    '確',
    '認',
    '月',
    '火',
    '水',
    '木',
    '金',
    '土',
    '日',
    '言',
    '語',
    '対',
    '話',
  ])
  // 真表提前加载:T2b 的"误报压制"证明只有拿**仓里那张 2136 字表**跑才算数 ——
  // 合成表证明的是判据形状,真表证明的是"HEAD 面那 42 个纯汉字块不会因此变红"。
  let REAL_JOYO = null
  let REAL_PROPER = null
  let realJoyoErr = ''
  try {
    const raw = readFileSync(resolve(ROOT, JOYO_REL), 'utf8')
    REAL_JOYO = joyoSetFromRaw(raw)
    REAL_PROPER = properNounSetFromRaw(raw)
  } catch (e) {
    realJoyoErr = String((e && e.message) || e).slice(0, 60)
  }
  // 合成专名集:证明判据**形状**用(真表另由 T7e2 证)。
  // 收 智/匯/硅/钉 —— 钉**故意收在合成集里**,好让 T7f 能证明"掺一个非专名表外字 ⇒ 整叶仍判"。
  const PROPER = new Set([...'智匯硅钉'])
  const CODES = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en']
  const mk = (locale, obj, extra = {}) =>
    scanLocaleContent(`packages/i18n/messages/t/${locale}.json`, obj, {
      locale,
      localeCodes: CODES,
      zhCnObj: extra.zhCnObj ?? null,
      zhCnMissing: extra.zhCnMissing ?? false,
      joyo: 'joyo' in extra ? extra.joyo : JOYOS,
      proper: 'proper' in extra ? extra.proper : PROPER,
    })

  console.log(`${C.bold}--self-test:i18n 语种内容/同名自套${C.reset}`)

  // T0 码位族表:互斥性 + **逐族正例**(名单类判据必须有正向证明)
  const dis = rangesAreDisjoint()
  A('T0a 区间两两不相交', dis.ok, JSON.stringify(dis.overlaps))
  const PROBE = { han: '會', hira: 'を', kata: 'エ', hangul: '을', latin: 'P' }
  for (const [fam, ch] of Object.entries(PROBE))
    A(
      `T0b 正例:U+${ch.codePointAt(0).toString(16).toUpperCase()} 只归 ${fam}`,
      familiesIn(ch).length === 1 && familiesIn(ch)[0] === fam,
      JSON.stringify(familiesIn(ch)),
    )
  A(
    'T0c U+30FB「・」不归假名(中日通用中黑点,归进去就是满天假阳)',
    familiesIn('A・B').join(',') === 'latin',
  )
  A(
    'T0d 谚文与假名互不混判(量码位而不是字形)',
    hasHangul('을') && !hasKana('을') && hasKana('を') && !hasHangul('を'),
  )
  A(
    'T0e 矩阵每个 locale 的 foreign 都是已知标记名(拼错=那条判据永不命中)',
    Object.values(LOCALE_MATRIX).every((m) => !m || m.foreign.every((x) => MARK_NAMES.includes(x))),
  )
  // T0f **逐格正向证明**:矩阵里每个 (locale, foreign 标记) 都必须真能命中一次。
  // 上一枚自检就是因为把标记名写成族名('hira' 而不是 'kana')而整格空转 —— 只报"拦到坏值"
  // 不报"名单里的每一条都拦得到",名单就可以是张死表而门一路报绿(守门 120 立论的同型)。
  const MARK_FIXTURE = { kana: 'を', hangul: '을', han: '會' }
  let matrixProved = true
  const matrixMisses = []
  for (const [loc, m] of Object.entries(LOCALE_MATRIX)) {
    if (!m) continue
    for (const mark of m.foreign) {
      const r = mk(loc, {
        b: {
          one: `x${MARK_FIXTURE[mark]}y`,
          two: `z${MARK_FIXTURE[mark]}w`,
          plain: 'nothing here',
        },
      })
      // 两条含该标记的叶子都该被点名,第三条纯拉丁不该被牵连(否则就是满天假阳)
      if (
        r.l1a.length !== 2 ||
        r.l1a.some((x) => x.marks !== mark) ||
        r.l1a.some((x) => x.path === 'b.plain')
      ) {
        matrixProved = false
        matrixMisses.push(`${loc}/${mark}→${JSON.stringify(r.l1a.map((x) => [x.path, x.marks]))}`)
      }
    }
  }
  A('T0f 矩阵逐格正例:每个 (locale, foreign) 组合都命中一次', matrixProved, matrixMisses.join(' '))

  // T1 ja 整块汉字(逐字取自真事故的 web/ja :: aiChat.org 形状)⇒ L1b 候选
  const jaWrong = mk(
    'ja',
    { org: { title: '整理會話', folderLabel: '資料夾', tagsLabel: '標籤', filterAll: '全部' } },
    {
      zhCnObj: {
        org: { title: '整理会话', folderLabel: '文件夹', tagsLabel: '标签', filterAll: '全部' },
      },
    },
  )
  A(
    'T1 ja 整块繁体中文(零假名 + 含非常用汉字)⇒ L1b 候选',
    jaWrong.l1b.length === 1 && jaWrong.l1b[0].path === 'org',
    JSON.stringify(jaWrong.l1b),
  )

  // T2 正常日语(汉字 + 假名混排)⇒ **不判红**。缺这条,门会把每一段正常日语判红
  const jaNormal = mk(
    'ja',
    {
      org: {
        title: '会話を整理',
        folderLabel: 'フォルダー',
        tagsLabel: 'ラベル',
        save: '保存する',
      },
    },
    { zhCnObj: { org: { title: '整理会话' } } },
  )
  A(
    'T2 正常日语(汉字+假名混排)⇒ 不判红',
    jaNormal.l1b.length === 0 && jaNormal.l1a.length === 0,
    JSON.stringify(jaNormal.l1b),
  )

  // T2b 整块纯汉字但**全部**是日本常用汉字(星期 / 削除 / 保存)⇒ 不判红(42 个既有块的这一型必须放过)
  const jaKanjiOnly = mk('ja', {
    weekday: { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金' },
    act: { del: '削除', save: '保存', ok: '確認' },
  })
  A(
    'T2b ja 纯汉字但全在常用汉字表内 ⇒ 不判红(误报压制证明;合成表)',
    jaKanjiOnly.l1b.length === 0,
    JSON.stringify(jaKanjiOnly.l1b),
  )
  const jaKanjiOnlyReal = mk(
    'ja',
    {
      weekday: { mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土', sun: '日' },
      act: { del: '削除', save: '保存', ok: '確認', list: '一覧' },
    },
    { joyo: REAL_JOYO },
  )
  A(
    'T2b2 同一型夹具换用**真·常用汉字表** ⇒ 仍不判红(HEAD 面 42 个纯汉字块靠这条放过)',
    !!REAL_JOYO && jaKanjiOnlyReal.l1b.length === 0,
    realJoyoErr || JSON.stringify(jaKanjiOnlyReal.l1b),
  )

  // T2c 表取不到 ⇒ L1b 记未判定,绝不凭"字不在表里"猜
  const jaNoTable = mk(
    'ja',
    { org: { title: '整理會話', folderLabel: '資料夾', tagsLabel: '標籤' } },
    { joyo: null },
  )
  A(
    'T2c 常用汉字表取不到 ⇒ L1b 未判定而不是判红',
    jaNoTable.l1b.length === 0 && jaNoTable.undetermined.length === 1,
    JSON.stringify(jaNoTable.undetermined),
  )

  // T3 zh-TW 混进谚文 ⇒ L1a;正常繁体 ⇒ 绿
  const twWrong = mk(
    'zh-TW',
    { org: { title: '대화 정리', folderLabel: '폴더', tagsLabel: '태그' } },
    { zhCnObj: { org: { title: '对话整理', folderLabel: '文件夹', tagsLabel: '标签' } } },
  )
  A(
    'T3 zh-TW 整块谚文 ⇒ L1a 候选 3 处',
    twWrong.l1a.length === 3,
    JSON.stringify(twWrong.l1a.map((x) => x.path)),
  )
  const twNormal = mk(
    'zh-TW',
    { org: { title: '對話整理', folderLabel: '資料夾', tagsLabel: '標籤' } },
    { zhCnObj: { org: { title: '对话整理' } } },
  )
  A(
    'T3b 正常繁体 ⇒ 不判红(简繁不属码位可判那一格)',
    twNormal.l1a.length === 0 && twNormal.l1b.length === 0,
    JSON.stringify(twNormal.l1a),
  )

  // T4 ko 混进假名 ⇒ L1a;ko 的汉字 ⇒ 不判但计数
  const koWrong = mk('ko', {
    exportMenu: { pdf: 'PDF をエクス포트', png: 'PNG を 내보내기', doc: '문서 내보내기' },
  })
  A(
    'T4 ko 混进日文假名 ⇒ L1a 候选 2 处',
    koWrong.l1a.length === 2,
    JSON.stringify(koWrong.l1a.map((x) => x.path)),
  )
  const koHan = mk('ko', { a: '导出', b: '내보내기', c: '저장' })
  A(
    'T4b ko 里的汉字不重复计债(他门射程,只计数)',
    koHan.l1a.length === 0 && koHan.hanElsewhereOwned === 1,
    JSON.stringify(koHan.hanElsewhereOwned),
  )

  // T5 三向轮转(ja←繁体中文 / zh-TW←谚文 / ko←汉字):三条腿各自落到哪条判据,不能判的那条要如实说
  const rotJa = mk(
    'ja',
    { m: { a: '對話整理', b: '資料夾', c: '標籤' } },
    { zhCnObj: { m: { a: '对话整理', b: '文件夹', c: '标签' } } },
  )
  const rotTw = mk(
    'zh-TW',
    { m: { a: '대화 정리', b: '폴더', c: '태그' } },
    { zhCnObj: { m: { a: '对话整理' } } },
  )
  const rotKo = mk(
    'ko',
    { m: { a: '對話整理', b: '資料夾', c: '標籤' } },
    { zhCnObj: { m: { a: '对话整理' } } },
  )
  A('T5a 轮转腿 ja←繁体 ⇒ L1b 抓到', rotJa.l1b.length === 1, JSON.stringify(rotJa.l1b))
  A('T5b 轮转腿 zh-TW←谚文 ⇒ L1a 抓到', rotTw.l1a.length === 3)
  A(
    'T5c 轮转腿 ko←汉字 ⇒ 本门不判(既有 scan-i18n-zh-residue 射程),如实计 3',
    rotKo.l1a.length === 0 && rotKo.hanElsewhereOwned === 3,
    JSON.stringify(rotKo.hanElsewhereOwned),
  )
  const jaAmb = mk(
    'ja',
    { m: { a: '削除', b: '保存', c: '確認' } },
    { zhCnObj: { m: { a: '删除', b: '保存', c: '确认' } } },
  )
  A(
    'T5d 边界:ja 里"全在常用汉字表内"的纯汉字词 ⇒ 族级无矛盾 ⇒ 放过(简繁不属本门能力)',
    jaAmb.l1b.length === 0 && jaAmb.l1a.length === 0,
  )

  // T6 L2 三态 + 字符串里的示例 JSON 不算结构
  A("T6a {x:{x:'…'}} ⇒ 判", findSelfNesting({ x: { x: 'ok' } }).sole.length === 1)
  A("T6b {x:{y:'…'}} ⇒ 不判", findSelfNesting({ x: { y: 'ok' } }).sole.length === 0)
  const t6c = findSelfNesting({ x: { x: 'a', y: 'b' } })
  A(
    "T6c {x:{x:'…',y:'…'}} ⇒ 不判红但计数(同名非唯一子键是仓内既有正当形态)",
    t6c.sole.length === 0 && t6c.notSole.length === 1,
  )
  A(
    'T6d 值里写着一段 JSON 文本不算块(字符串不是对象)',
    findSelfNesting({ a: '{"a":"x"}' }).sole.length === 0,
  )
  A('T6e 深层嵌套也看得见', findSelfNesting({ p: { q: { r: { r: 'z' } } } }).sole.length === 1)
  const l2File = mk('en', { aiChat: { toast: { orgSaved: { orgSaved: 'Saved' } } } })
  A(
    'T6f 真事故形状 orgSaved:{orgSaved:…} ⇒ L2 命中,且 en 也参与 L2',
    l2File.l2Sole.length === 1 && l2File.l2Sole[0].path === 'aiChat.toast.orgSaved',
    JSON.stringify(l2File.l2Sole),
  )
  // T6g 数组里的字符串同样参与 L1a,且 E1 按**下标**对齐(下标错位就不算"原文保留")
  const arrHit = mk(
    'zh-TW',
    { ai: { tips: ['你好', '화이팅'] } },
    { zhCnObj: { ai: { tips: ['你好', '加油'] } } },
  )
  const arrSame = mk(
    'zh-TW',
    { ai: { tips: ['你好', '화이팅'] } },
    { zhCnObj: { ai: { tips: ['你好', '화이팅'] } } },
  )
  A(
    'T6g 数组元素参与判定且 E1 按下标对齐(下标不同⇒判、同下标逐字相同⇒豁免)',
    arrHit.l1a.length === 1 &&
      arrHit.l1a[0].path === 'ai.tips[1]' &&
      arrSame.l1a.length === 0 &&
      arrSame.exemptIdentical.length === 1,
    JSON.stringify({
      hit: arrHit.l1a.map((x) => x.path),
      ex: arrSame.exemptIdentical.map((x) => x.path),
    }),
  )

  // T7 两条豁免各一对正反
  const endo = mk('ja', { settings: { ko: '한국어', ja: '日本語', notice: '한국어 입니다' } })
  A(
    'T7a E2 语言本名键豁免(键名点名语言 ⇒ 放过;非该键仍判)',
    endo.exemptEndonym.length === 1 &&
      endo.l1a.length === 1 &&
      endo.l1a[0].path === 'settings.notice',
    JSON.stringify({ e: endo.exemptEndonym, l: endo.l1a.map((x) => x.path) }),
  )
  // E1 必须用**含外语族**的值来证:纯汉字值对本门根本不构成候选,拿它测 E1 等于测了个空分支
  const idt = mk(
    'zh-TW',
    { about: { legal: '대법원', other: '다른 것' } },
    { zhCnObj: { about: { legal: '대법원' } } },
  )
  A(
    'T7b E1 与 zh-CN 逐字相同 ⇒ 原文保留豁免;不同的仍判',
    idt.exemptIdentical.length === 1 &&
      idt.exemptIdentical[0].path === 'about.legal' &&
      idt.l1a.length === 1 &&
      idt.l1a[0].path === 'about.other',
    JSON.stringify({ e: idt.exemptIdentical, l: idt.l1a.map((x) => x.path) }),
  )
  const selfCn = mk('zh-CN', { settings: { notice: '한국어 입니다' } })
  A(
    'T7c 审的正是 zh-CN ⇒ E1 不生效(否则自我比对=自我豁免)',
    selfCn.l1a.length === 1,
    JSON.stringify(selfCn.l1a),
  )
  const noZh = mk('zh-TW', { about: { other: '다른 것' } }, { zhCnObj: null, zhCnMissing: true })
  A(
    'T7d 无 zh-CN 可对照 ⇒ 记未判定,既不冒红也不静默',
    noZh.l1a.length === 0 && noZh.undetermined.length === 1,
    JSON.stringify(noZh.undetermined),
  )

  // T7e E3 正反成对(逐字取自 HEAD 面真事故 aboutIcprecord 的形状)。
  // 对照组的说服力全在**两个字都不在常用汉字表内、方向也相同**(智匯 / 钉钉),
  // 唯一区别是一个是专名正字形、一个是没翻译的专名 ⇒ 分派不生效时这两个读数必须一模一样。
  const pnOk = mk(
    'ja',
    { aboutIcprecord: { r1: '吉ICP備2025027274号', r2: '吉林省愛智匯人工智能科技有限公司', p1: '吉ICP備2025027274号-7A' } },
    { joyo: REAL_JOYO, proper: REAL_PROPER },
  )
  A(
    'T7e E3 专名正字形(智匯)⇒ 豁免且**单列计数**,块因 usable 不足落"不判"',
    !!REAL_PROPER &&
      pnOk.l1b.length === 0 &&
      pnOk.exemptProper.length === 1 &&
      pnOk.exemptProper[0].path === 'aboutIcprecord.r2' &&
      pnOk.exemptProper[0].chars === '智匯',
    JSON.stringify({ l1b: pnOk.l1b, ex: pnOk.exemptProper }),
  )
  const pnBad = mk(
    'ja',
    { connectors: { dingtalk: '钉钉', feishu: '飛書', wecom: '企業微信', more: '钉钉飛書' } },
    { joyo: REAL_JOYO, proper: REAL_PROPER },
  )
  A(
    'T7e2 对照组:钉钉(同为表外、同方向、非专名)⇒ **必须仍判红**并点名键(分派生效的反证)',
    !!REAL_PROPER &&
      pnBad.l1b.length === 1 &&
      pnBad.l1b[0].suspects.includes('钉') &&
      pnBad.exemptProper.length === 0,
    JSON.stringify({ l1b: pnBad.l1b, ex: pnBad.exemptProper }),
  )
  // T7f **反向防线**:带专名不许静默放过整块 —— 掺一个非专名表外字,整叶仍判。
  const pnMixed = mk(
    'ja',
    { mixed: { a: '吉林省愛智匯人工智能科技有限公司', b: '整理會話', c: '資料夾', d: '標籤' } },
    { joyo: REAL_JOYO, proper: REAL_PROPER },
  )
  A(
    // 嫌疑字里**不该**有 `話`:話(U+8A71)是 2136 表内的常用汉字,表内字永远不是嫌疑。
    // 这里逐字写死,就是防"有人为了把这块变绿去动 2136 名单"。
    'T7f 反向防线:块里既有专名叶又有真残留叶 ⇒ 专名叶豁免、真残留叶仍被抓(不得整块放过)',
    !!REAL_PROPER &&
      pnMixed.exemptProper.length === 1 &&
      pnMixed.l1b.length === 1 &&
      pnMixed.l1b[0].suspects === '會夾籤',
    JSON.stringify({ ex: pnMixed.exemptProper, l1b: pnMixed.l1b }),
  )
  const pnNone = mk(
    'ja',
    { org: { title: '整理會話', folderLabel: '資料夾', tagsLabel: '標籤' } },
    { joyo: REAL_JOYO, proper: null },
  )
  A(
    'T7g 专名集取不到 ⇒ 记未判定且**照判**(不得因判不出就放行)',
    pnNone.l1b.length === 1 && pnNone.exemptProper.length === 0,
    JSON.stringify({ und: pnNone.undetermined, l1b: pnNone.l1b }),
  )

  // T8 en **参与** L1(2026-10-06 收口):原先整门不判,现在合法形状走 E4、真残留仍判红。
  // 这是"7 处未判定归零"的机器读数:en 不得再产生任何 undetermined。
  // ⚠️ 夹具逐字取自 HEAD 面 `web/en.json::about.metaDescription` 的形状。**不要**把它简化成
  // `IHUI AI (智汇 AI) 出品` —— 那个写法括号外还有汉字(出品),E4 正确地不豁免(它判的是"英文句子
  // 夹一句中文对照",不是"括号里有中文就行")。本轮第一次写夹具就踩了这个,已改成真形状。
  const enBi = mk('en', {
    about: { meta: 'IHUI AI (智汇 AI) is an all-in-one full-stack AI operating system.' },
  })
  A(
    'T8a en 参与 L1:括号内双语标注 ⇒ E4 豁免,且**不进未判定清单**(E4 是豁免不是"判不出")',
    enBi.l1a.length === 0 &&
      enBi.exemptBilingual.length === 1 &&
      enBi.undetermined.length === 0 &&
      enBi.notJudgedLocale === false,
    JSON.stringify({ e4: enBi.exemptBilingual, und: enBi.undetermined }),
  )
  const enRes = mk('en', { chat: { title: '会话整理', send: '发送消息' } })
  A(
    'T8b **反向防线**:en 里未翻译的中文 ⇒ 判红(不得因"en 不判"而静默放过;' +
      '这正是旧实现漏掉的那一类,而 check-i18n-broken-en 只接了 7 面中的 3 面)',
    enRes.l1a.length === 2 && enRes.exemptBilingual.length === 0 && enRes.undetermined.length === 0,
    JSON.stringify({ l1a: enRes.l1a.map((x) => x.path) }),
  )
  const enKana = mk('en', { nav: { label: 'セッション' } })
  A(
    'T8c en 里的**假名/谚文**一律判(E4 只认 han,括号里的合法中文不得连带放过括号外的假名)',
    enKana.l1a.length === 1 && enKana.exemptBilingual.length === 0,
    JSON.stringify(enKana.l1a.map((x) => x.path)),
  )
  const enMixed = mk('en', { nav: { label: 'Sessions (中文) セッション' } })
  A(
    'T8d E4 不得连带放过非 han 的矛盾标记(`hitMarks` 含 kana 时 E4 一律不适用)',
    enMixed.l1a.length === 1 && enMixed.exemptBilingual.length === 0,
    JSON.stringify({ l1a: enMixed.l1a.map((x) => x.path), e4: enMixed.exemptBilingual.length }),
  )
  // T8e 逃生舱:`LOCALE_MATRIX` 里**当前没有任何** `null` 成员。这是"en 那格洞不得回来"的哨兵 ——
  // 有人再把某个 locale 写成 `null`,本条立刻判红,逼他改走 E1~E4 或明写理由。
  A(
    'T8e LOCALE_MATRIX 无 `null` 成员(没有 locale 的 L1 是整门不判的)',
    Object.values(LOCALE_MATRIX).every((m) => m !== null),
    JSON.stringify(Object.keys(LOCALE_MATRIX).filter((k) => LOCALE_MATRIX[k] === null)),
  )
  // T8f 表里没有的 locale ⇒ **判死**(记未判定),不得静默放行。这是"新增语种文件"的方向性证明。
  const unknownLocale = mk('vi', { a: { b: 'cot' } })
  A(
    'T8f LOCALE_MATRIX 里没有的 locale ⇒ 记未判定(本门对它零判据,放行就是假绿)',
    unknownLocale.l1a.length === 0 &&
      unknownLocale.undetermined.length === 1 &&
      !unknownLocale.notJudgedLocale,
    JSON.stringify(unknownLocale.undetermined),
  )
  // T8g E4 纯函数的逐条正反(判据的牙全在这几条上)
  const e4 = (v) => bilingualAnnotationLeaf(v).ok
  const E4_CASES = [
    ['IHUI AI (智汇 AI) is an OS', true, '现存真形状:括号内品牌原文 + 括号外英文'],
    ['IHUI AI (Chinese: 智汇 AI) is an OS', true, '带 Chinese: 前缀的同一形状'],
    ['Pure English', false, '无汉字,本判据不参与'],
    ['会话整理', false, '整段未翻译'],
    ['点击这里开始使用', false, '整段未翻译(另一形状)'],
    ['整理会话 (Organize chats)', false, '汉字在括号外 ⇒ 是正文不是标注'],
    ['智汇', false, '裸品牌中文,无括号'],
    ['(智汇)', false, '括号外无拉丁字母 ⇒ 不是"英文句子夹中文"'],
    ['AI （智汇）', true, '全角括号内的中文标注'],
    ['(unclosed 智汇', false, '括号没合上 ⇒ 不猜'],
    ['会话 (organize) 整理', false, '括号内外都有汉字'],
    ['IHUI AI (智汇 AI) 出品', false, '⚠️括号外还有汉字 ⇒ 不是"英文句子夹一句中文对照"(写夹具时踩过)'],
  ]
  const e4Miss = E4_CASES.filter(([v, want]) => e4(v) !== want).map(
    ([v, want]) => `${JSON.stringify(v)}⇒${e4(v)}(期望${want})`,
  )
  A(`T8g E4 逐条正反(${E4_CASES.length} 例)`, e4Miss.length === 0, e4Miss.join(' '))

  // T9 decide 的方向性
  const base = {
    files: 1,
    leaves: 1,
    l1a: [],
    l1b: [],
    l2: [],
    exemptEndonym: [],
    exemptIdentical: [],
    exemptProper: [],
    exemptBilingual: [],
    hanElsewhereOwned: 0,
    l2NotSole: 0,
    notJudgedLocales: new Set(),
    undetermined: [],
    maxBlockLeaves: 0,
    maxBlockWhere: '',
  }
  A(
    'T9a 默认档 + 只有 L1 候选 ⇒ exit 0(不造恒红门)',
    decide({ ...base, l1a: [{ path: 'a' }] }, {}).code === 0,
  )
  A(
    'T9b --strict + L1 候选 ⇒ exit 1',
    decide({ ...base, l1a: [{ path: 'a' }] }, { strict: true }).code === 1,
  )
  A(
    'T9c L2 超锚点 ⇒ 默认档也判红',
    decide({ ...base, l2: [{ rel: 'x', count: 2, anchor: 1, paths: ['y'] }] }, {}).code === 1,
  )
  A(
    'T9d 默认档 + 未判定 ⇒ exit 0 但已打印点名',
    decide({ ...base, undetermined: ['u'] }, {}).code === 0,
  )
  A(
    'T9e --strict + 未判定 ⇒ exit 2(不记为通过)',
    decide({ ...base, undetermined: ['u'] }, { strict: true }).code === 2,
  )
  A(
    'T9f --strict 下判红优先于未判定(不得用 2 掩盖 1)',
    decide({ ...base, undetermined: ['u'], l1a: [{ path: 'a' }] }, { strict: true }).code === 1,
  )
  const sum = summarize(
    [mk('ja', { org: { a: '對話', b: '資料', c: '夾' } }), mk('ko', { m: { a: 'を' } })],
    new Map(),
  )
  A(
    'T9g summarize 把逐文件结果并成结论对象且不动锚点语义',
    sum.files === 2 && Array.isArray(sum.l1b) && Array.isArray(sum.l1a),
  )
  // T9h "存量只报数"必须**真的报数**:2 处存量落在锚点 2 之内 ⇒ 不判红,但读数必须是 2。
  // 只报"超锚点的"而不报"锚点内还有多少",读报告的人就会把 0 读成"没有这一型"
  // —— 而本门的立项读数是 5 处,这个数字必须一直看得见。
  const stockRes = mk('ja', { a: { a: 'x' }, b: { b: 'y' } })
  const stock = summarize([stockRes], new Map([[stockRes.rel, 2]]))
  A(
    'T9h 锚点内的存量必须被计数(不判红 ≠ 不存在)',
    stock.l2.length === 0 && stock.l2SoleTotal === 2 && stock.l2WithinAnchor === 2,
    JSON.stringify({ l2: stock.l2.length, tot: stock.l2SoleTotal, within: stock.l2WithinAnchor }),
  )

  // T10 面 / 参数 / 路径形态纯函数
  A(
    'T10a 默认 HEAD、--staged 索引、两旗同给判死',
    faceFromArgv([]).face === 'head' &&
      faceFromArgv(['--staged']).face === 'staged' &&
      !!faceFromArgv(['--staged', '--worktree']).error,
  )
  A(
    'T10b runner 追加的未知旗标不得改变判定面',
    faceFromArgv(['--staged', '--quiet', '--exit', '1']).face === 'staged',
  )
  A(
    'T10c --root 缺值不得静默退回仓库根',
    !!rootFromArgv(['--root']).error && !!rootFromArgv(['--root=']).error,
  )
  A(
    'T10d 路径形态:<target>/<locale>.json 之外一律 null',
    !!parseLocalePath('packages/i18n/messages/web/ja.json') &&
      parseLocalePath('packages/i18n/messages/web/sub/ja.json') === null &&
      parseLocalePath('packages/i18n/messages/web/ja.bak.json') === null,
  )
  A('T10e JSON 不可解析 ⇒ 未判定,不是判红也不是绿', mk('ja', null).undetermined.length === 1)
  // T10f 反向回归锁:**文件级与块级都不得截断**。这条正是本门两次真仓实跑咬到的同一个缺陷 ——
  // 第一次上限套在文件级时,web/*.json(22,702 叶)只扫前 4,000 叶,②③ 号真事故结构上看不见;
  // 第二次上限留在块级,把 `web/ja.json::admin`(4,804 叶)变成永久未判定 ⇒ `--strict` 归不了零。
  // 上限已于 2026-10-06 连参数一起删除,所以这里用一个**明确大于旧上限**的常量造夹具:
  // 谁把任何一层重新截断(哪怕把上限调到 5 万),本条都必须红。
  const LEGACY_CAP = 4000 // 已删除的 MAX_LEAVES_PER_BLOCK,只作为"夹具必须大于它"的锚
  const many = {}
  const N = LEGACY_CAP + 50
  for (let i = 0; i < N; i++) many[`k${i}`] = `plain text ${i}`
  many[`k${N - 1}`] = '이것은 한국어입니다'
  const big = mk('zh-TW', { deep: { nest: many } }, { zhCnObj: null })
  A(
    `T10f 文件级不被块上限截断(${N} 叶 > 旧上限 ${LEGACY_CAP},违规在最后一叶)`,
    big.leaves >= N && big.l1a.length === 1 && big.l1a[0].path === `deep.nest.k${N - 1}`,
    JSON.stringify({ leaves: big.leaves, hits: big.l1a.map((x) => x.path) }),
  )
  // T10g **块级**也不得截断(2026-10-06 新增):造一个叶子数超过旧上限的 ja 块,块尾放一处真
  // 残留(繁体中文块)。旧实现会记"未判定"而**不判**;现在必须照判。这条是本轮"8 处未判定归零"
  // 的机器读数 —— 删上限不是为了好看,是为了让这块真的被判。
  const hugeBlock = {}
  for (let i = 0; i < LEGACY_CAP + 20; i++) hugeBlock[`k${i}`] = `plain ${i}`
  Object.assign(hugeBlock, {
    bad1: '整理會話',
    bad2: '資料夾',
    bad3: '標籤',
  })
  const huge = mk('ja', { admin: hugeBlock }, { joyo: REAL_JOYO, proper: REAL_PROPER })
  A(
    `T10g 块级不被上限截断(${LEGACY_CAP + 23} 叶 > 旧上限 ${LEGACY_CAP} 的 ja 块,尾部有真残留)`,
    huge.undetermined.length === 0 &&
      huge.l1b.length === 1 &&
      huge.l1b[0].path === 'admin' &&
      huge.maxBlockLeaves >= LEGACY_CAP + 20,
    JSON.stringify({
      und: huge.undetermined,
      l1b: huge.l1b.map((x) => x.path),
      max: huge.maxBlockLeaves,
    }),
  )
  A(
    'T10h 任何 locale 都不得因块大而进未判定清单(截断计数已从结论对象里删掉)',
    !('truncatedBlocks' in huge) && !('truncatedBlocks' in base),
    'truncatedBlocks 已删;若它回来,说明块级上限又被加回来了',
  )

  // T11 真·常用汉字表可读(证明判据用的是仓里那张表,不是自造清单)
  A(
    'T11 真·常用汉字表可读且 ≥2000 字',
    !!REAL_JOYO && REAL_JOYO.size >= 2000,
    REAL_JOYO ? String(REAL_JOYO.size) : realJoyoErr,
  )
  // T11b **防假修法锁**:专名字一个字都不许进 2136 名单。把专名塞进 `chars`/`codepoints`
  // 也能让门变绿,但那是污染文化厅告示原文 + 没有分派逻辑的假修法(见 properNounSetFromRaw 立论)。
  // 交集非空 ⇒ 本条立刻判红。
  A(
    'T11b 防假修法:专名集与 2136 名单**零交集**(不许靠改表过门)',
    !!REAL_PROPER && [...REAL_PROPER].every((c) => !REAL_JOYO.has(c)),
    [...(REAL_PROPER || [])].filter((c) => REAL_JOYO && REAL_JOYO.has(c)).join(''),
  )
  A(
    'T11c 专名集非空且随表落库(E3 归零 = 合法字被当残留抓了,这条是它的哨兵)',
    !!REAL_PROPER && REAL_PROPER.size > 0,
    realJoyoErr || String((REAL_PROPER || new Set()).size),
  )

  console.log(`\n[i18n-locale-lang] --self-test pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

// §22d:CLI 直接执行才跑主流程;镜像测试 import 判据函数时不得有副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  ROOT,
  MESSAGES_REL,
  JOYO_REL,
  MIN_BLOCK_LEAVES,
  FACE_TXT,
  LOCALE_MATRIX,
  MARK_NAMES,
  faceFromArgv,
  rootFromArgv,
  parseLocalePath,
  listLocaleRels,
  readFaceTexts,
  readL2Anchors,
  loadJoyo,
  isEndonymKey,
  sameAsZhCn,
  properNounLeaf,
  bilingualAnnotationLeaf,
  marksOfValue,
  collectLeaves,
  leafKeyName,
  findSelfNesting,
  scanLocaleContent,
  summarize,
  decide,
  DEFAULT_ROOT: ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
