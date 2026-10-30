#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-mirror-fidelity.mjs — 小程序镜像页「还原度」对账门(2026-10-25 立)。
 *
 * 为什么要有这件器物:跨端对齐的**声明链**已经有机判(coverage 的 R1 登记真实 / R3 镜像棘轮
 * / R4 下沉率棘轮、auto-register-cross-end 补声明),但**声明 ≠ 还原**——一个小程序页可以在
 * 首行写着「镜像 packages/app/src/features/x/YSc​​reen.tsx」,正文却只渲染两行文案,把共享屏
 * 的 40 个业务文案键丢掉 38 个。此刻所有门都是绿的:页存在、标记在、路由在册、词包有键,
 * 而用户看到的页面是个空壳。这是「对齐全绿、体验全无」型的缺口,此前**没有任何尺子能量它**。
 *
 * 实测动机(2026-10-25 现读):小程序端对 `packages/app/src/features` 的真实 import = **0 行**,
 * 123 处引用全是注释标记;38 个已标记镜像页全部经人工改写。也就是说「镜像」在今天只是声明,
 * 不是复用 —— 声明链再全也测不出还原度。本门就是把这个盲区变成可量化、可棘轮、可入账的一维。
 *
 * 判什么:
 *   对每一对 (共享屏 spec ↔ 小程序镜像页),取共享屏消费的**业务 i18n 键集**为分母,取镜像页
 *   实际消费的键集为分子,算还原度;差集 = 「声明了却没还原的文案键」,即缺口账本的一行。
 *
 *   〔更正@2026-10-27,上一条只覆盖「端内手写形制」〕:上面这段立尺前提在「壳承载形制」装车后
 *   失效了而尺子没跟着改。现读:168 枚在册镜像页里 **122 枚是壳承载**(页面只 import
 *   `@rn-shells/<同名壳>`,壳再 import `@ihui/rn-app` 的共享屏本体),这些页自己不写文案是**设计如此**
 *   —— 分母那份文件就是它渲染的那份文件,按构造还原度 100%。尺子却把委托读成丢失:
 *   现读证据 edu-ai-hub 承载页判「缺 83/83」,而这 83 键全在 EduAiHubScreen.tsx 里消费。
 *   账面 missing=1703 / avg=10.8% 因此是**量具假分叉**,它的失效方向是逼人回去手抄已经在渲染的
 *   文案(与「自动化、减少开发」正相反)。现判据分四形制(见 hostingFormOf):
 *     · hosted —— 承载链三腿齐(同名壳引用 ∧ 壳在面上且真消费本 spec ∧ 取用形态与壳导出对得上)
 *       ⇒ 无键可缺;
 *     · broken —— 引了壳而任一腿断 ⇒ 这一页在产物里渲染不出(undefined 组件 / 编不过),
 *       逐条点名(比缺文案严重,不再混进手写存量);
 *     · other —— 页引了壳而**不是这一屏的壳**(声明镜像 A、承载的是 B)⇒ 声明只是账面上的,
 *       A 的键照旧全计为缺并逐条点名(数键的旧尺子对这一型完全无感:它只看键、不看壳指谁);
 *     · hand —— 端内不引壳的手写页 ⇒ 照旧逐键数,一分不宽。
 *   倒退棘轮随之多一类真牙:承载页被改回手写/壳被删 ⇒ 键从"0 缺"翻成"全缺" ⇒ 当场判倒退,
 *   而旧尺对这种退化完全无感(旧形制下它本来就报全缺)。
 *
 *   键集抽取两通道并集(缺一即系统性低估):
 *     ① `t('ns.key')` / `tt('ns.key')` 直调形态(人工改写后的页普遍是这个形态);
 *     ② `PAIR_KEYS` / `SINGLE_KEYS` 数组字面量里的字符串(gen-miniapp-mirror 生成形制:
 *        键以字符串数组声明、JSX 里 `t(titleKey)` 间接消费,不在 t('…') 字面量里)。
 *        只取通道 ① 会让**刚生成出来的页还原度恒为 0**,那把尺子立刻失去意义。
 *
 *   分母只算**业务键**:首段落入 GENERIC_NS(common/app/nav/button/action/state/error/tip/toast)
 *   的通用键不入分母。理由:共享屏普遍引用 `common.save` 这类通用文案,而镜像页复用端内
 *   通用组件时不会重新声明它们 —— 把它们算进分母会让还原度恒低,进而逼出恒红(§12e/§12f)。
 *   GENERIC_NS 单源在 gen-miniapp-mirror.mjs(与生成器同一份清单),本门 import,不复制第二份。
 *
 * 棘轮(唯一 blocking 维):锚点 = **基线面**同一 spec 的缺口集(默认 HEAD 面,§0.5「棘轮锚点 =
 *   该文件 HEAD 自身的违规数」;CI 问责腿用 --base=<ref> 显式指定基线)。只拦「本次改动把基线上
 *   已还原的键又丢掉」;存量缺口只报数(§12e);基线面尚无镜像对的新增页:hosted/broken 不拦
 *   (那是收口),**hand 拦** —— 造页器已默认壳承载形制,再新增手写页只会让 99 枚存量变多,
 *   与「最大化减少开发」正相反(2026-10-27 补;仍是差值棘轮,只拦本次新增)。
 *   为什么不拿人工基线 JSON 当锚点:coverage 已实证「补 47 条镜像后基线仍是旧读数 ⇒ 删任意
 *   一条标记门都判绿 = 假绿」。故一律 git 读 HEAD 面,免维护、不过期。
 *
 * 判据分工(§0.6 / §22c):镜像标记识别、页面枚举、面读取一律 import coverage 的 __test__
 *   (mirroredSpecs / collectShared / collectMiniapp / faceRead),键抽取 import
 *   gen-miniapp-mirror 的 extractUsedKeys —— 本门**零复制**这两把尺子与 GENERIC_NS 清单。
 *
 * 退出码:0 = 通过(含存量缺口只报数);1 = 判出倒退(blocking);2 = 未判定(取不到被审面、
 *   当前面 0 个镜像对 ⇒ 按 §0.3 不记绿也不冒红)。
 *
 * 接线(2026-10-26 定,AGENTS R4 补记 ② 同批):
 *   · 本机面 = 只读尺子:根 package.json `check:mirror-fidelity` + git-guardian 巡检轮派发,
 *     **不进提交链** —— 存量缺口 avg≈24.4% 若进链即恒红,恒红门的唯一结局是逼人 --no-verify
 *     (§12e/§12f,连带废掉全部守门)。
 *   · CI 面 = 不可旁路问责腿:ci-monorepo.yml build 矩阵 miniapp-taro 档直跑
 *     `--base=<基线>`(PR 判 base.sha,push 判 HEAD^1)。三档面在 CI 干净检出上全部退化
 *     (staged/worktree==HEAD ⇒ 倒退恒空),故问责必须走 --base 显式基线,否则这一步是假接线。
 *
 * Usage:
 *   node scripts/check-miniapp-mirror-fidelity.mjs              # 默认判 HEAD 面
 *   node scripts/check-miniapp-mirror-fidelity.mjs --staged     # 提交链档(索引 blob)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --worktree   # 人工逃生舱(磁盘)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --base=<ref> # 显式基线(CI 问责腿,任意 git 可解析 ref)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --json       # 机读(喂缺口账本)
 *   node scripts/check-miniapp-mirror-fidelity.mjs --top=10     # 列出缺口最大的 10 对
 *   node scripts/check-miniapp-mirror-fidelity.mjs --quiet      # 仅输出结论与失败
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, gitErrText } from './lib/face-reader.mjs'
import {
  directSharedUsage,
  shellRefsOf,
  shellTargetRel,
  mismatchedShellBinding,
} from './lib/rn-shell-refs.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { indexRetractions, readRetractions, retractionId } from './lib/key-retractions.mjs'
import { extractUsedKeys, __test__ as gen } from './gen-miniapp-mirror.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const { collectShared, collectMiniapp, mirroredSpecs, rnConsumes } = cov
const { GENERIC_NS } = gen.constants

/** 生成形制的键表块:PAIR_KEYS / SINGLE_KEYS 声明区内的全部字符串字面量。 */
const KEY_BLOCK_RE = /(?:PAIR_KEYS|SINGLE_KEYS)[^=]*=\s*\[([\s\S]*?)\n\]/g

/**
 * 同面批量取正文(rel -> text|null)。
 * 为什么必须走 catBatch 而不是 faceRead 逐个取:face-reader 头注实测「逐文件 git show 在
 * Windows 上 0.2~0.4s/次,~500 个屏要跑 2~3 分钟」。本门要读全部共享屏正文(取键集),
 * 逐个取会把门推到 109s —— 慢到没人愿意日常跑的尺子等于没有(提交链上尤其致命:
 * 一次绕过约等于链上全部守门对该提交作废)。故一律**一次 catBatch 取完**;取不到抛异常
 * 就向上冒,由 run() 记「未判定」,绝不把"没取到"记成 null 冒充"该面没有这份件"。
 */
export function batchReadTexts(face, rels) {
  const keys = [...new Set((rels || []).map((r) => String(r).replace(/\\/g, '/')))]
  if (face === 'worktree') {
    const out = new Map()
    for (const k of keys) {
      try {
        out.set(k, readFileSync(join(ROOT, k), 'utf8'))
      } catch {
        out.set(k, null)
      }
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : `${face === 'head' ? 'HEAD' : face}:`
  if (keys.length === 0) return new Map()
  const got = catBatch(
    ROOT,
    keys.map((k) => prefix + k),
    { maxBuffer: 1 << 28 },
  )
  const out = new Map()
  for (const k of keys) out.set(k, got.get(prefix + k) ?? null)
  return out
}

/**
 * 页面拆分子模块时,文案消费落在同目录 `./xxx` 模块里(实测 conversation-import 拆了
 * parts/analysis/core/transport 四个,16 个真实消费的键全在 parts 里) ⇒ 载体面必须含它们。
 * 只认 `./` 且不越目录:`../` 一律不取 —— 父目录/兄弟页不是本页的载体,取了会把别人的键
 * 算成本页已还原(那是"多放",失效方向与 §0.10 相反)。扩展名按 TS 工程惯例补候选。
 */
export function localModuleRels(pageRel, pageText) {
  const rel = String(pageRel || '').replace(/\\/g, '/')
  const slash = rel.lastIndexOf('/')
  if (slash < 0) return []
  const dir = rel.slice(0, slash)
  const out = new Set()
  for (const m of String(pageText || '').matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
    const spec = m[1]
    if (spec.includes('../')) continue
    const base = spec.replace(/^\.\//, '')
    if (/\.(tsx?|jsx?)$/.test(base)) out.add(`${dir}/${base}`)
    else
      for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) out.add(`${dir}/${base}${ext}`)
  }
  return [...out]
}

/**
 * 页面同名的页面配置:`pages/study/plan.tsx` → `pages/study/plan.config.ts`。
 * 小程序的页面标题只能写在 config 的 navigationBarTitleText 里(没有 t() 可用),
 * 所以标题类文案的载体面必须含它 —— 实测 12 个缺口键正是这样被原生导航栏承担。
 */
export function localConfigRel(pageRel) {
  const rel = String(pageRel || '').replace(/\\/g, '/')
  const slash = rel.lastIndexOf('/')
  if (slash < 0) return null
  const name = rel.slice(slash + 1).replace(/\.(tsx?|jsx?)$/, '')
  return `${rel.slice(0, slash)}/${name}.config.ts`
}

/** 从页面配置正文取原生导航栏标题;取不到返回 null(判不出就不减免)。 */
export function configTitleOf(text) {
  const m = String(text || '').match(/navigationBarTitleText\s*:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/)
  return m ? m[2] : null
}

/** 词包 JSON → 扁平 key→译文。嵌套命名空间按点拼回,与 t('a.b') 的键形态一致。 */
export function flattenPack(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenPack(v, key, out)
    else out[key] = String(v ?? '')
  }
  return out
}

/**
 * 同值别名:页面用的键与共享屏的键**译文逐字相同** ⇒ 同一句文案,页面确实渲染了它,
 * 只是两套命名空间各起了一个名(实测 setting.version / settings.version 同为「版本」)。
 * 只按 zh-CN 判:这是"这句文案在不在"的存在性证据,不是译文质量判据(五语对齐另有门 133/19)。
 * 值取不到(词包缺该键)一律不算 —— 判不出就不减免(§0.3)。
 */
export function aliasSameKeys(sharedKeys, pageKeys, valueOfSharedKey, mpValues, extraValues = []) {
  if (!mpValues) return []
  const pageValues = new Set()
  for (const u of pageKeys || []) {
    const v = mpValues[u]
    if (v) pageValues.add(String(v).trim())
  }
  // 非 t() 载体:原生导航栏标题(config)、以及调用方认定的其它页面内文案
  for (const v of extraValues || []) if (v) pageValues.add(String(v).trim())
  const out = []
  for (const k of sharedKeys || []) {
    const v = valueOfSharedKey(k)
    if (v && pageValues.has(String(v).trim())) out.push(k)
  }
  return out
}

/**
 * 通道 ②:键表数组里声明的键。命中 0 是合法的(人工改写后的页没有这些块),
 * 所以**不做「取不到即未判定」**——它不是必选输入,是并集的一条腿。
 */
export function extractDeclaredKeys(text) {
  const out = []
  if (!text) return out
  for (const m of String(text).matchAll(KEY_BLOCK_RE)) {
    for (const s of m[1].matchAll(/'([A-Za-z0-9_.-]+)'/g)) out.push(s[1])
  }
  return out
}

/** 首段落入通用命名空间的键不算业务键(理由见头注「分母只算业务键」)。 */
export function isBusinessKey(key) {
  return !GENERIC_NS.has(String(key || '').split('.')[0])
}

export function businessKeys(keys) {
  return (keys || []).filter(isBusinessKey)
}

/** 一个页面(共享屏或镜像页)消费的键集 = 两通道并集去重。 */
export function consumedKeys(text) {
  const set = new Set()
  for (const k of extractUsedKeys(text)) set.add(k)
  for (const k of extractDeclaredKeys(text)) set.add(k)
  return set
}

/**
 * 端词包命名空间齐全性(2026-10-29 立,纯函数零 IO)。
 *
 * 立因:`hosted` 行的文案由**共享源本体**渲染 ⇒ 本门按构造判它 100%、无键可缺;而逐键那把尺
 * 数的是"键在不在页面文本里",壳页文本里本来就没有键。**两把尺对同一件事同时失明**:
 * 共享源取词用的是本端词包,若那一整块命名空间从没搬进 `messages/miniapp-taro/`,这一屏
 * 每一句话都取不到词条,而账面一路是绿的。实测撞出来的两例:`pdfToolsPage`(54 键 × 5 语言全缺)
 * 与随后同族扫出的 16 个命名空间 —— 都发生在「还原度 74.9%、断链 0、声明不符 0」的读数为绿期间。
 *
 * 动态拼键(`t(\`x.${id}\`)`)的命名空间在这一维里量不到 ⇒ 逐条排除并另计,不混进缺陷数。
 * `available` 取不到 ⇒ 返回 null 由调用方记未判定,绝不折成"无缺口"(§0.3)。
 */
export function packNamespaceGap({ usedKeys, available }) {
  if (!available || !(available instanceof Set) || available.size === 0) return null
  const absent = new Set()
  for (const k of usedKeys || []) {
    const ns = String(k).split('.')[0]
    if (!ns || ns.includes('$')) continue
    if (!available.has(ns)) absent.add(ns)
  }
  return [...absent].sort()
}

/**
 * 这一对(共享屏 spec ↔ 小程序页)是**壳承载**还是**端内手写**。
 *
 * 立因(2026-10-27 实测):本门头注写于「壳承载形制」装车之前,当时小程序页全是人工改写
 * (「真实 import = 0 行,123 处引用全是注释标记」)。形制换了而尺子没换 ⇒ 它把委托读成丢失:
 * 现读 168 枚在册镜像页里 122 枚是 `@rn-shells/<同名壳>` 承载,整屏渲染的就是共享源本体,
 * 而共享源正是本门分母那份文件 —— 按构造还原度 100%,尺子却报 0%(现读证据:
 * edu-ai-hub 承载页被判「缺 83/83」,而那 83 个键全在 EduAiHubScreen.tsx 里消费)。
 * 这把尺子的失效方向是**逼人回去手抄已经在渲染的文案**,与目标(减少开发)正相反,故必修。
 *
 * 判承载三腿,缺一即不认(承重腿比"数键"更强,不是更弱):
 *   ① 页面引的壳里有一枚**真消费了本 spec**(cov.rnConsumes:同名符号 + `@ihui/rn-app`)。
 *      同名壳优先,但不要求同名 —— RN 壳名与共享屏名不同是仓内既有形态(现读 5 例:
 *      NewsScreen 渲染 SquareScreen、PlanScreen 渲染 PlanListScreen 等),按名判会把
 *      合法委托读成"声明未渲染",方向同样是逼人回头手抄;
 *   ② 该壳在本面上存在(引了不存在的壳 ⇒ 编不过,单列 broken);
 *   ③ 页面对壳的取用形态与壳的真导出对得上(mismatchedShellBinding 为空)。
 * 任一腿断 ⇒ form='broken':这一页在产物里渲染不出来(undefined 组件 / 编不过),
 * 比"少几个文案"严重,单独立桶点名,绝不混进手写存量里让人以为只是没抄完。
 * 引了壳而**没有一枚**消费本 spec ⇒ form='other':声明只是账面上的。
 * 另有第二种合法形态(2026-10-27 补):页面**不经壳直载共享屏**(`import { X as Y } from '@ihui/rn-app'`
 * ∧ JSX 真用 `<Y`)⇒ 同样记 hosted(why 空、via='direct')。它按构造渲染的就是分母那份文件,
 * 逐键数只会把 `t(\`about.${id}\`)` 这类动态拼键读成缺口(现读 pkg-about/about-shared/index 缺 15/15)。
 *
 * readShell 由调用方给 ⇒ 面纪律(§0.4 同面同轮)留在调用方,本函数纯判据零 IO。
 */
export function hostingFormOf({ spec, pageText, readShell }) {
  const name = String(spec || '')
    .split('/')
    .pop()
    .replace(/\.[jt]sx$/, '')
  if (!name) return { form: 'hand', why: '' }
  const refs = shellRefsOf(pageText || '')
  if (refs.size === 0) {
    if (directSharedUsage(pageText, name)) return { form: 'hosted', why: '', via: 'direct' }
    return { form: 'hand', why: '' }
  }
  const shells = new Map()
  for (const n of refs) shells.set(n, readShell(shellTargetRel(n)))
  const dangling = [...refs]
    .filter((n) => {
      const t = shells.get(n)
      return t === null || t === undefined
    })
    .sort()
  if (dangling.length > 0)
    return {
      form: 'broken',
      why: `${dangling.map(shellTargetRel).join(', ')} 在本面不存在 ⇒ 页面引了不存在的壳`,
    }
  let carrier = refs.has(name) ? name : null
  if (!carrier) {
    for (const n of [...refs].sort()) {
      if (rnConsumes({ text: shells.get(n) }, name)) {
        carrier = n
        break
      }
    }
  }
  if (!carrier)
    return {
      form: 'other',
      why: `声明镜像 ${name},而这一页承载的壳是 ${[...refs].sort().join(', ')}(均未消费该屏) ⇒ 声明的那一屏并未渲染`,
    }
  if (!rnConsumes({ text: shells.get(carrier) }, name))
    return { form: 'broken', why: `${shellTargetRel(carrier)} 未消费共享屏 ${name}` }
  const mismatch = mismatchedShellBinding(pageText, (r) => readShell(r))
  if (mismatch) return { form: 'broken', why: mismatch }
  return { form: 'hosted', why: '' }
}

/**
 * 一对镜像页的逐键缺口分解(纯函数,镜像测试直接用生产判据)。
 * 撤除的键**出射程而不进 covered** —— 算成"已还原"就变回了本台账要治的假绿那一型。
 * @param {{sharedKeys:string[], mpKeys:Set<string>, aliasSame:string[], retractedOf:(key:string)=>boolean}} a
 */
export function gapOfPair({ sharedKeys, mpKeys, aliasSame, retractedOf }) {
  const aliasSet = new Set(aliasSame)
  const unrecovered = sharedKeys.filter((k) => !mpKeys.has(k) && !aliasSet.has(k))
  const retracted = unrecovered.filter((k) => retractedOf(k))
  const missing = unrecovered.filter((k) => !retracted.includes(k))
  const scope = sharedKeys.length - retracted.length
  return { unrecovered, retracted, missing, scope, covered: scope - missing.length }
}

/**
 * 按给定面算全部镜像对的还原度。返回 { face, sharedCount, pairs, avg, totalMissing, hosted, hand, broken, rows }。
 * rows 每项 { spec, route, form, why, sharedKeys, covered, missing, fidelity }(|sharedKeys|=0 ⇒ fidelity=null)。
 * form ∈ hosted(委托共享源,按构造满还原)/ hand(端内手写,数键)/ other(承载的不是声明那一屏)/ broken(引了壳而链断,产物渲染不出)。
 */
export function computeFidelity(face) {
  const shared = collectShared(face)
  const miniapp = collectMiniapp(face)

  // 先按镜像标记反查「本次真正要判的共享屏」,再只取这一批正文(先筛后取,见 batchReadTexts 头注)。
  const paired = new Set()
  for (const p of miniapp) for (const spec of mirroredSpecs(p)) paired.add(spec)
  const specToText = batchReadTexts(
    face,
    shared.map((s) => s.spec).filter((spec) => paired.has(spec)),
  )

  // 手写页拆子模块时,文案消费散在同目录 ./xxx 里 ⇒ 同面批取一次,按页拼回载体面。
  const moduleTexts = batchReadTexts(face, [
    ...new Set(miniapp.flatMap((p) => (p.file ? localModuleRels(p.file, p.text) : []))),
  ])
  const localModulesOf = (p) =>
    (p.file ? localModuleRels(p.file, p.text) : []).map((r) => moduleTexts.get(r) || '').join('\n')

  // 页面配置里的原生导航栏标题(小程序只能用 config 写标题,没有 t() 可用)
  const configTexts = batchReadTexts(face, [
    ...new Set(miniapp.map((p) => (p.file ? localConfigRel(p.file) : null)).filter(Boolean)),
  ])
  const pageExtraValuesOf = (p) => {
    const rel = p.file ? localConfigRel(p.file) : null
    const title = rel ? configTitleOf(configTexts.get(rel)) : null
    return title ? [title] : []
  }

  // 壳承载要判「@rn-shells/<X> 指过去的那个壳在不在面上、引的是不是这一屏」⇒ 一次批取全部壳正文
  // (同名壳文件逐枚 faceRead 会把本门推到分钟级,慢到没人日常跑 = 等于没装车)。
  const shellRels = [
    ...new Set(miniapp.flatMap((p) => [...shellRefsOf(p.text || '')].map(shellTargetRel))),
  ]
  const shellTexts = batchReadTexts(face, shellRels)
  const readShell = (rel) => shellTexts.get(rel) ?? null

  // 端可得词包 = 本端包 ∪ shared(两端取词都算得到;少算 shared 会把 200+ 个正常命名空间读成缺口)。
  // 只读 zh-CN 顶层键:命名空间存在性五语言同构,键集对齐另有 check-i18n-parity 那道门管。
  // 本模块没有 faceRead,一律走自己的 batchReadTexts(§0.4 同面同轮:与被判正文取同一个面)。
  const PACK_RELS = [
    'packages/i18n/messages/miniapp-taro/zh-CN.json',
    'packages/i18n/messages/shared/zh-CN.json',
    // 共享屏的键住在 RN 包 ⇒ 同值对账要拿它当"这句文案本来该长什么样"的取值面。
    'packages/i18n/messages/mobile-rn/zh-CN.json',
  ]
  const packTexts = batchReadTexts(face, PACK_RELS)
  const flatOf = (rel) => {
    const t = packTexts.get(rel)
    if (t === null || t === undefined) return null
    try {
      return flattenPack(JSON.parse(t))
    } catch {
      return null
    }
  }
  const mpValues = flatOf(PACK_RELS[0])
  const sharedValues = flatOf(PACK_RELS[1])
  const rnValues = flatOf(PACK_RELS[2])
  const valueOfSharedKey = (k) =>
    (rnValues && rnValues[k]) || (sharedValues && sharedValues[k]) || null
  const topsOf = (rel) => {
    const t = packTexts.get(rel)
    if (t === null || t === undefined) return null
    try {
      return Object.keys(JSON.parse(t))
    } catch {
      return null
    }
  }
  const mpTops = topsOf(PACK_RELS[0])
  const shTops = topsOf(PACK_RELS[1])
  const packAvailable = mpTops && shTops ? new Set([...mpTops, ...shTops]) : null

  // 键级撤除台账(§0.4 同面同轮:与被判正文取同一个面)。取不到 = 没人撤过 ⇒ active 为空,
  // 缺口照原样数;绝不把"台账读不到"折成"全部免检"(那等于把判据做成白名单,§0.7)。
  const retr = readRetractions(face, ROOT)
  const retractionIndex = indexRetractions(retr.rows, retr.bad)
  const retractedOf = (route, spec, key) =>
    retractionIndex.active.has(retractionId({ page: route, spec, key }))

  const rows = []
  for (const s of shared) {
    if (!paired.has(s.spec)) continue
    const sharedText = specToText.get(s.spec)
    if (sharedText === null || sharedText === undefined) continue
    const sharedKeys = businessKeys([...consumedKeys(sharedText)])
    if (sharedKeys.length === 0) continue
    const seen = new Set()
    for (const k of sharedKeys) seen.add(k)
    for (const p of miniapp) {
      if (!p.file) continue
      if (!mirroredSpecs(p).has(s.spec)) continue
      const { form, why } = hostingFormOf({ spec: s.spec, pageText: p.text, readShell })
      const mpKeys = consumedKeys(`${p.text || ''}\n${p.cssText || ''}\n${localModulesOf(p)}`)
      // 承载页的文案由共享源本体渲染 ⇒ 无键可缺;断链/手写页照旧逐键数,一分不宽。
      // 同值别名单独记一列并从缺口中扣除:两套命名空间同一句译文 = 页面真渲染了这句。
      const aliasSame =
        form === 'hosted'
          ? []
          : aliasSameKeys(
              sharedKeys,
              mpKeys,
              valueOfSharedKey,
              mpValues,
              pageExtraValuesOf(p),
            ).filter((k) => !mpKeys.has(k))
      const { retracted, missing, scope, covered } =
        form === 'hosted'
          ? { retracted: [], missing: [], scope: sharedKeys.length, covered: sharedKeys.length }
          : gapOfPair({
              sharedKeys,
              mpKeys,
              aliasSame,
              retractedOf: (k) => retractedOf(p.route, s.spec, k),
            })
      const gap = packNamespaceGap({ usedKeys: sharedKeys, available: packAvailable })
      rows.push({
        spec: s.spec,
        route: p.route,
        form,
        why,
        sharedKeys: sharedKeys.length,
        scope,
        covered,
        missing,
        // 被撤除台账免掉的键单列:免了不等于没缺,账面必须能回答"这格为什么不算缺"
        retracted,
        // 同值别名(译名不同、译文逐字相同)单列报数:它算已还原,但不等于该页做了这块 UI
        aliasSame,
        fidelity: scope === 0 ? null : (scope - missing.length) / scope,
        // 本端词包里根本不存在的那些命名空间(null ⇒ 词包取不到,这一维未判定,不折成空数组冒绿)
        packAbsent: gap,
      })
    }
  }

  const totalScope = rows.reduce((a, r) => a + r.scope, 0)
  const totalCovered = rows.reduce((a, r) => a + r.covered, 0)
  const totalMissing = rows.reduce((a, r) => a + r.missing.length, 0)
  const totalAliasSame = rows.reduce((a, r) => a + (r.aliasSame?.length ?? 0), 0)
  // 台账腐烂:一条撤除现在不免除任何东西 = 这一格早已结清(键补回来了、页撤镜像了、
  // 或路由/屏改了名而台账还指着旧三元组)。§0.7「豁免项消失同样算红」⇒ 必须点名,不得留成永久免检。
  const usedRetractions = new Set(
    rows.flatMap((r) =>
      (r.retracted || []).map((k) => retractionId({ page: r.route, spec: r.spec, key: k })),
    ),
  )
  return {
    face,
    sharedCount: shared.length,
    pairs: rows.length,
    avg: totalScope === 0 ? null : totalCovered / totalScope,
    totalShared: rows.reduce((a, r) => a + r.sharedKeys, 0),
    totalScope,
    totalCovered,
    totalMissing,
    // 同值别名(译名不同、译文逐字相同)总数:已计入 covered,单列出来是为了让"缺多少"可解释
    totalAliasSame,
    // 撤除台账四维:免掉多少 / 台账共多少 / 哪些行不成立(不免) / 哪些行已不免除任何东西(腐烂)
    totalRetracted: rows.reduce((a, r) => a + (r.retracted?.length ?? 0), 0),
    retractionTotal: retractionIndex.total,
    retractionRefused: retractionIndex.refused,
    retractionBad: retractionIndex.bad,
    retractionRot: [...retractionIndex.active].filter((id) => !usedRetractions.has(id)),
    // 新维(2026-10-29):取不到词包 ⇒ packUndetermined 为真,由调用方落未判定档,
    // 绝不在这里把"没判"写成"零缺口"(§0.3)。
    packUndetermined: packAvailable === null,
    packAbsentRows: rows.filter((r) => Array.isArray(r.packAbsent) && r.packAbsent.length > 0)
      .length,
    packAbsentNamespaces: [
      ...new Set(rows.flatMap((r) => (Array.isArray(r.packAbsent) ? r.packAbsent : []))),
    ].sort(),
    hosted: rows.filter((r) => r.form === 'hosted').length,
    hand: rows.filter((r) => r.form === 'hand').length,
    other: rows.filter((r) => r.form === 'other').length,
    broken: rows.filter((r) => r.form === 'broken').length,
    rows,
  }
}

/** 棘轮:当前面相对基线面(默认 HEAD,CI 腿为 --base=<ref>)**新增**的缺口(存量不拦)。返回 [{spec, route, added}]。 */
export function regressions(now, base) {
  // 锚点键必须是「spec + 路由」:同一共享屏可以被两个小程序路由各镜像一份(现读 about/AboutScreen
  // 有 about/index 与 about-shared/index 两行),只按 spec 建索引时后一行会覆盖前一行 ⇒
  // 同一份数据自我比较也能报出"新增缺口"(实测一张 hand 一张 hosted 时 exactly 这一型)。
  const key = (r) => `${r.spec}\u0000${r.route}`
  const baseMissing = new Map()
  const basePaired = new Set()
  for (const r of base.rows) {
    basePaired.add(key(r))
    baseMissing.set(key(r), new Set(r.missing))
  }
  const out = []
  for (const r of now.rows) {
    if (!basePaired.has(key(r))) {
      // 新增镜像对:hosted/broken 是收口面,不拦;hand 是"又写了一份端内重复实现"——
      // 造页器已默认壳承载形制,新增手写页只会让 99 枚存量继续变多(目标「最大化减少开发」正相反)。
      // 差值棘轮:只拦本次新增,存量只报数(§12e)。
      if (r.form === 'hand') out.push({ spec: r.spec, route: r.route, added: [], kind: 'new-hand' })
      continue
    }
    const anchor = baseMissing.get(key(r)) || new Set()
    const added = r.missing.filter((k) => !anchor.has(k))
    if (added.length > 0) out.push({ spec: r.spec, route: r.route, added, kind: 'regressed' })
  }
  return out
}

function parseArgs(argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const topArg = argv.find((a) => a.startsWith('--top='))
  const baseArg = argv.find((a) => a.startsWith('--base='))
  const top = topArg ? Number(topArg.slice('--top='.length)) : 0
  return {
    staged,
    worktree,
    baseRef: baseArg ? baseArg.slice('--base='.length) : '',
    json: argv.includes('--json'),
    quiet: argv.includes('--quiet'),
    top: Number.isFinite(top) && top > 0 ? Math.floor(top) : 0,
  }
}

function run() {
  const argv = process.argv.slice(2)
  const opts = parseArgs(argv)
  if (opts.staged && opts.worktree) {
    console.error('❌ 未判定:--staged 与 --worktree 同给(两面旗互斥)')
    return 2
  }
  const face = opts.staged ? 'staged' : opts.worktree ? 'worktree' : 'head'
  const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`)

  let now
  try {
    now = computeFidelity(face)
  } catch (e) {
    console.error(`❌ 未判定(${face} 面取材异常):${e?.message ?? e}`)
    return 2
  }
  if (now.sharedCount === 0) {
    console.error(`❌ 未判定:${face} 面枚举到 0 个共享屏,还原度无从判起(不记绿)`)
    return 2
  }
  if (now.pairs === 0) {
    console.error(
      `❌ 未判定:${face} 面 0 个镜像对,还原度无从判起(镜像标记主判据见 check-cross-end-screen-coverage R3)`,
    )
    return 2
  }

  // 基线 ref 必须**先证明可解析**再拿去判:cov.collectShared/collectMiniapp 对不可解析的 ref 会
  // 静默回落读盘(实测 `--base=__no_such_ref__` 仍枚举到 242 个共享屏),于是 base 取自**本机未提交
  // 的工作树**、current 取自 HEAD/索引 ⇒ 两面不同形(§0.4),倒退恒空 ⇒ CI 问责腿静默冒绿(§0.3)。
  // 下面那道「基线面枚举到 0 个共享屏」的护栏结构上打不到这一型(0 从来读不出来)。
  if (opts.baseRef) {
    let resolved = ''
    let why = ''
    try {
      resolved = gitRaw(
        ['rev-parse', '--verify', '--quiet', `${opts.baseRef}^{commit}`],
        ROOT,
      ).trim()
    } catch (e) {
      why = gitErrText(e) || String(e?.message ?? e)
    }
    if (!resolved) {
      console.error(
        `❌ 未判定:基线面 ${opts.baseRef} 不可解析${why ? `(${why})` : '(git 说没有这个 commit)'}(判据对不可解析的 ref 会回落读盘 ⇒ 拿本机未提交内容当基线等于没判,不记绿)`,
      )
      return 2
    }
  }

  let base
  try {
    base = opts.baseRef
      ? computeFidelity(opts.baseRef)
      : face === 'head'
        ? now
        : computeFidelity('head')
  } catch (e) {
    console.error(`❌ 未判定(基线面 ${opts.baseRef || 'head'} 取材异常):${e?.message ?? e}`)
    return 2
  }
  const reg = regressions(now, base)
  const state = reg.length > 0 ? 'regressed' : 'ok'
  const baseLabel = opts.baseRef || (face === 'head' ? 'self' : 'head')
  // 基线护栏:faceList/faceRead 把"ref 不可解析"吞成空清单 ⇒ 基线空 ⇒ 倒退恒空 ⇒ 静默冒绿。
  // 0 个共享屏只可能是坏 ref 或该面无共享层 ⇒ 当场未判定(§0.3),绝不拿空基线判通过。
  if (base.sharedCount === 0) {
    console.error(
      `❌ 未判定:基线面 ${baseLabel} 枚举到 0 个共享屏(ref 不可解析或该面无共享层 ⇒ 不记绿)`,
    )
    return 2
  }
  const summary = {
    face,
    base: baseLabel,
    state,
    pairs: now.pairs,
    avg: now.avg,
    avgPct: pct(now.avg),
    totalShared: now.totalShared,
    totalMissing: now.totalMissing,
    totalAliasSame: now.totalAliasSame ?? 0,
    hosted: now.hosted,
    hand: now.hand,
    other: now.other,
    broken: now.broken,
    regressions: reg,
    rows: now.rows,
    // 新维随 json 一起出去,由漂移尺按"绝对值出声"接走(与 broken/other 同一链路),
    // 本尺的退出码口径不动 —— 它历来只把"倒退"折进 rc。
    packUndetermined: now.packUndetermined === true,
    packAbsentRows: now.packAbsentRows ?? 0,
    packAbsentNamespaces: now.packAbsentNamespaces ?? [],
    // 键级撤除台账四维一起出去:漂移尺要能区分"没缺"与"缺而被裁掉",还要能看见腐烂行
    retractionTotal: now.retractionTotal ?? 0,
    totalRetracted: now.totalRetracted ?? 0,
    retractionRefused: now.retractionRefused ?? [],
    retractionBad: now.retractionBad ?? [],
    retractionRot: now.retractionRot ?? [],
  }

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2))
    return reg.length > 0 ? 1 : 0
  }

  const head = `FIDELITY-RESULT face=${face} base=${baseLabel} pairs=${now.pairs} hosted=${now.hosted} hand=${now.hand} other=${now.other} broken=${now.broken} packAbsentRows=${now.packUndetermined === true ? '?' : (now.packAbsentRows ?? 0)} avg=${pct(now.avg)} missing=${now.totalMissing} aliasSame=${now.totalAliasSame ?? 0} retracted=${now.totalRetracted ?? 0}/${now.retractionTotal ?? 0} retractRefused=${(now.retractionRefused ?? []).length} retractBad=${(now.retractionBad ?? []).length} retractRot=${(now.retractionRot ?? []).length} regressions=${reg.length} state=${state}`
  console.log(head)
  const idText = (id) => String(id).split('\u0000').join(' | ')
  if ((now.retractionBad ?? []).length > 0) {
    console.log(
      `❌ 撤除台账有 ${(now.retractionBad ?? []).length} 行读不出来 ⇒ 这些行代表的裁决不生效(一律不免),逐条点名:`,
    )
    for (const b of now.retractionBad) console.log(`   ${b.why}:⇒ ${String(b.raw).slice(0, 90)}`)
  }
  if ((now.retractionRefused ?? []).length > 0) {
    console.log(
      `❌ 撤除台账有 ${(now.retractionRefused ?? []).length} 行不成立(缺理由/出处/到期日、出处过短、已到期或重复登记)⇒ 该键照原样算缺口:`,
    )
    for (const x of now.retractionRefused) console.log(`   ${idText(x.id)}:${x.why}`)
  }
  if ((now.retractionRot ?? []).length > 0) {
    console.log(
      `⚠️ 撤除台账有 ${(now.retractionRot ?? []).length} 行现在不免除任何东西(§0.7 清单腐烂:键已补回 / 页已改承载形 / 三元组对不上)⇒ 出路:核实后删该行,别留成永久免检:`,
    )
    for (const id of now.retractionRot) console.log(`   ${idText(id)}`)
  }
  if (now.broken > 0) {
    console.log('❌ 壳承载断链(引了壳而链不成立 ⇒ 这一页在产物里渲染不出,比缺文案严重):')
    for (const r of now.rows)
      if (r.form === 'broken') console.log(`   ${r.spec} → ${r.route}:${r.why}`)
  }
  if (now.other > 0) {
    console.log(
      '❌ 声明与承载不符(页写着镜像 A 而它承载的壳是 B ⇒ 账面「已镜像」而 A 那一屏并没渲染):',
    )
    for (const r of now.rows)
      if (r.form === 'other') console.log(`   ${r.spec} → ${r.route}:${r.why}`)
  }
  if (now.packUndetermined === true) {
    console.log(
      '⚠️ 端词包命名空间这一维**未判定**:取不到 messages/miniapp-taro 或 messages/shared 的顶层键' +
        ' ⇒ 不记"零缺口",也不冒红(§0.3)',
    )
  } else if ((now.packAbsentRows ?? 0) > 0) {
    console.log(
      '❌ 端词包缺整块命名空间(壳承载页的文案由共享源渲染,而它取词用的是本端词包 ⇒ 这些屏每句话都取不到词条;' +
        '逐键那把尺对 hosted 行按构造判 100%,两把尺同时看不见这一型):',
    )
    for (const r of now.rows)
      if (Array.isArray(r.packAbsent) && r.packAbsent.length)
        console.log(
          `   ${r.spec} → ${r.route} [${r.form}] 缺 ns: ${r.packAbsent.slice(0, 6).join(', ')}${r.packAbsent.length > 6 ? ' …' : ''}`,
        )
  }
  if (reg.length > 0) {
    console.log('❌ 还原度倒退(本次丢掉的键 / 新增的端内手写镜像页):')
    for (const r of reg) {
      if (r.kind === 'new-hand') {
        console.log(
          `   ${r.spec} → ${r.route}\n     新增镜像页是端内手写形制(既不引 @rn-shells 壳,也没直载共享屏)⇒ 又写了一份重复实现`,
        )
        continue
      }
      console.log(
        `   ${r.spec} → ${r.route}\n     新增缺口(${r.added.length}):${r.added.slice(0, 8).join(', ')}${r.added.length > 8 ? ' …' : ''}`,
      )
    }
  }
  if (!opts.quiet && now.totalMissing > 0) {
    const worst = [...now.rows]
      .sort((a, b) => b.missing.length - a.missing.length)
      .slice(0, opts.top || 10)
    console.log(
      `ℹ️ 存量缺口(只报数,不拦;[hand]=端内手写、[other]=承载的不是声明那屏、[broken]=壳承载断链)${opts.top ? ` top${opts.top}` : ' top10'}:`,
    )
    for (const r of worst) {
      if (r.missing.length === 0) continue
      console.log(
        `   ${(r.fidelity * 100).toFixed(0)}% [${r.form}] ${r.spec} → ${r.route} 缺 ${r.missing.length}/${r.sharedKeys}`,
      )
    }
  }
  return reg.length > 0 ? 1 : 0
}

/* §22d:直执行才跑主流程;测试 import __test__ 不得触发 CLI */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(run())
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  batchReadTexts,
  localModuleRels,
  localConfigRel,
  configTitleOf,
  flattenPack,
  aliasSameKeys,
  extractDeclaredKeys,
  isBusinessKey,
  businessKeys,
  consumedKeys,
  packNamespaceGap,
  gapOfPair,
  hostingFormOf,
  computeFidelity,
  regressions,
  run,
  HERE: fileURLToPath(new URL('.', import.meta.url)),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
