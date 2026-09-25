// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「词表键必须五语言可解析」守门(2026-09-23 立)。
 *
 * 堵的洞(实测,非推测):
 *  - scripts/check-i18n-keys.mjs 只从 `t('字面量')` 形态提键(:403-412 extractKeysByVar),
 *    对象字面量里的 i18n 键它**看不见**;
 *  - scripts/check-permission-mode-vocabulary.mjs 的 R4 只咬 3 种形状(:266-270),
 *    `PermissionTierDisplayKey` / `permissionTier.mode.*` 都不匹配,也不在其 KNOWN_CONSUMERS(:66-75);
 *  ⇒ packages/shared/src/chat/permission-tier.ts 头部那句"键必须是字面量:各端 i18n 键检查
 *    靠静态扫描保证五语言都存在"是**假前提**:新增档位可以全闸绿,而运行时
 *    packages/i18n/src/loader.ts:54 在 `typeof value !== 'string'` 时 `return key` —— 键名上界面。
 *
 * 判据(范式照抄 scripts/check-tool-display-resolvable.mjs,不另造一套):
 *   W1 扫 `const NAME [: 类型] = { … }` 对象字面量(未导出的也算 —— 词表常模块内私有),
 *      取深度 ≤2 的带点字符串字面量:`k: 'a.b.c'` 或 `k: { title: 'a.b.c' }`;
 *      值里只要出现非字面量/非字符串就整表不认(动态表由各端自证,不在本门视野);
 *   W2 锚定(防误报洪水):表的去重键里 **≥2 个**能在权威语料
 *      packages/i18n/messages/<source>/<lang>.json 里按**绝对路径**解析、且占比 ≥50% → 认定 i18n 词表。
 *      不满足的是"命名空间相对风格"(`typeLabel.single_choice` 配 useTranslations('adminEdu…'))
 *      或含点但根本不是键的字符串 map(模型名 `MiniMax-M2.5`),一律不检并计数说明;
 *   W3 逐键 × 逐语言:消费端(apps/<end> 内经解析后的 import 图**确实**能到词表模块、
 *      且提及该模块导出符号)的合并视图 shared+端 必须解析出非空字符串且不等于键名;
 *   W4 miniapp-taro 消费时,离线生成物各远程语言载荷也必须解析出值
 *      (解码与 REMOTE_LOCALES 取法直接复用 check-tool-display-resolvable 的导出,不自己拼路径);
 *   W5 共享层落点:packages/* 的词表,若某依赖该包的端**尚未 import 它**但该端消息源整块缺键,
 *      单列 notices(表×端聚合,不逐键刷屏);**不计入退出码** —— 该端未引用这张表 ⇒ 坏状态当前不可达,
 *      计入会把 blocking 门长期红在别人未接入的存量上(实测初版 5 条全属此类)。
 *   W6 **散落的取词字面量**(2026-09-25 补,补齐本门最大的盲区):
 *      W1 只认「整个对象的值都是 i18n 键」这种**对象字面量词表**,于是
 *      `const MENU_ITEMS = [{ key:'Search', labelKey:'menu.search', icon:Search }]`
 *      这种"数组里挂一个 labelKey 字符串"的形状**整类隐身** —— 首页"发现"区因此把
 *      `menu.search` 等 9 个从未存在于任何语言包的键直接渲染到了界面上,进了 HEAD 而全链无人报。
 *      新增两种形状:
 *        · 属性名以 `Key` 结尾(`labelKey` / `titleKey` / `ariaKey` / `placeholderKey` / JSX 的
 *          `i18nKey="…"`),值是**带点**字符串字面量;
 *        · 直接取词调用 `t('a.b.c')` / `tt('a.b')` / `i18n.t('a.b')` / `` t(`a.b`) ``(无插值)。
 *      裸 `key:'Search'`(不含点)是路由名/枚举值,不是 i18n 路径 —— 一律不判。
 *      判据刻意只用**最弱的一条**(与 W1–W5 的逐端×逐语言严格对账分工不同):
 *      该键在「全部消息源 × 5 语言」的叶子路径**后缀全集**里查不到 ⇒ 它从来没被任何语言包收录过。
 *      为什么按后缀:本仓 `*Key` 的取值有两套约定 —— 绝对路径(RN/Taro/shared)与
 *      命名空间相对(web `useTranslations('ns')` + `t('a.b')`,甚至命名空间在**另一个文件**里,
 *      如 footer-data.ts 的 `nameKey:'platforms.n8n'` 由 BrandMarquee 的 ns 兜住)。
 *      按绝对路径判会一次产出数百枚假红(实测 696),而后缀口径把"相对取词"整类吸收掉,
 *      只留下"这个键根本不存在"这一条硬事实 —— 正是本次事故的形态。
 *      **已知不覆盖**(如实登记):键存在但只在部分语言/部分端缺失(那一类仍由 W1–W4 逐键硬拦,
 *      前提是它以对象字面量词表的形式出现)、以及命名空间在别处且**拼错**的相对取词。
 *      W6 走**逐文件棘轮**:锚点 = 该文件 HEAD 自身的 W6 违规数,只拦"这次改动把新缺键加回来了",
 *      不拦仓库既有债(建票当日 HEAD 实测 35 文件 / 176 处,与首页事故同族;
 *      数字随 HEAD 移动,现值一律以 --json 的 scattered.inventory 为准,清一笔降一笔)。
 *
 * 判定面(2026-09-25 收口,本门原先整条链按磁盘读):
 *   共享工作区由多个并行会话同写,**常年滞后 HEAD 且含别人半编辑态的文件**。
 *   源码按磁盘读、语料按 HEAD 读会造出"自洽但基准错位"的假缺陷(当天即由此产出一份假报告)。
 *   现与 77/83/91/98/101 同口径:**全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工逃生舱**,
 *   清单与内容同面同轮;取材取不到 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
 *
 * 用法:
 *   node scripts/check-word-table-resolvable.mjs              # 全量(判 HEAD blob)
 *   node scripts/check-word-table-resolvable.mjs --staged     # pre-commit:判索引 blob,W6 锚 HEAD
 *   node scripts/check-word-table-resolvable.mjs --worktree   # 人工排查:按磁盘读(不作结论)
 *   node scripts/check-word-table-resolvable.mjs --json       # 机读
 *   node scripts/check-word-table-resolvable.mjs --self-test   # 注入违规 + 反例自证
 * 紧急跳过:HUSKY_SKIP_WORD_TABLE_RESOLVABLE=1 git commit ...
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的原语(绝对路径 git、`cat-file --batch` 批量读、仓库根校验)统一来自
// scripts/lib/face-reader.mjs —— 本门不再自带一份 gitExec + catBatch。那五处只有一个人会
// 写对的陷阱(裸 'git' 依赖 PATH / cat-file 的 stdio[0] 必须是 pipe / 逐文件派生 git /
// 仓库根比较要穿 junction / maxBuffer 要给足)只在那一处存在,重复一份就是重复一份风险。
import {
  Undetermined,
  assertRepoRoot as assertGitRepoRoot,
  catBatch,
  gitRaw,
} from './lib/face-reader.mjs'
// 复用既有闸的合并语义与 taro 离线包解码(§22d:被 import 时不触发它的 main)
import {
  mergeMessages,
  remoteLocaleList,
  decodeTaroBundle,
} from './check-tool-display-resolvable.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
/** 端清单与 check-tool-display-resolvable.mjs:32 同口径(api 不产界面文案,故不在列) */
const END_DIRS = ['web', 'extension', 'miniapp-taro', 'mobile-rn', 'cli']
const TARO_GEN = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'
const TARO_GEN_SCRIPT = 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs'
const SKIP_ENV = 'HUSKY_SKIP_WORD_TABLE_RESOLVABLE'

const SCAN_ROOTS = [
  'packages/shared/src',
  'packages/types/src',
  'packages/ui-react/src',
  'packages/app/src',
  'packages/api-client/src',
  'apps/web/app',
  'apps/web/src',
  'apps/extension/entrypoints',
  'apps/extension/lib',
  'apps/extension/components',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'apps/cli/src',
]
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'generated',
  'coverage',
  '__tests__',
  'tests',
  'test',
  '.output',
])

/** 带点键字面量:首段须是标识符形状(排除 '/api/x.y' 路径与纯数字段) */
const DOTTED_KEY_RE = /^['"]([A-Za-z][\w-]*(?:\.[\w$-]+)+)['"]$/

/** W6 的形状白名单之外还要一道"这不是取词属性"的排除:这些 `*Key` 名字在界面上从不取词。 */
const NON_I18N_KEY_PROPS = new Set([
  'queryKey',
  'mutationKey',
  'cacheKey',
  'storageKey',
  'persistKey',
  'sessionKey',
  'localeKeyStorage',
  'apiKey',
  'api_key',
  'secretKey',
  'accessKey',
  'refreshKey',
  'publicKey',
  'privateKey',
  'encryptionKey',
  'signingKey',
  'hashKey',
  'lockKey',
  'partitionKey',
  'sortKey',
  'groupKey',
  'groupByKey',
  'rowKey',
  'indexKey',
  'mapKey',
  'primaryKey',
  'foreignKey',
  'compositeKey',
  'hotKey',
  'kbdKey',
  'eventKey',
  'reactKey',
  'domKey',
  'slotKey',
  'formKey',
  'fieldKey',
])
/** 属性名以 Key 结尾(含 JSX 属性形态)。`key`/`keyCode` 不在其中,天然排除。 */
const KEY_PROP_NAME_RE = /^[A-Za-z_$][\w$]*Key$/

/** 权威消息源清单(与 @ihui/i18n loader 同源):W6 的后缀宇宙由它铺出。 */
const CORPUS_SOURCES = ['shared', 'web', 'extension', 'miniapp-taro', 'mobile-rn', 'cli']

// ─────────────────────────────────────────────────────────────────────────────
// 判定面(取材层):HEAD blob / 索引 blob / 工作区,同一轮只允许一个面
// ─────────────────────────────────────────────────────────────────────────────

/** exit 2 专用:输入取不到 / 清单为空 = "本门没能判定",与"判定为违规"(exit 1)严格分开。
 *  类本体就是共用层的 `Undetermined`(别名再导出,保持对外导出面与本门测试的 `instanceof` 不变)。 */
export const UndeterminedError = Undetermined

function treePaths(rev) {
  // -z 空字节分隔:中文/空格路径不能被换行分帧打断
  return rev === ''
    ? gitRaw(['ls-files', '-z'], ROOT).split('\0').filter(Boolean)
    : gitRaw(['ls-tree', '-r', '--name-only', rev, '-z'], ROOT).split('\0').filter(Boolean)
}

/** git 面的前置校验:① ROOT 必须是仓库根(共用层穿过 junction 比较,本门若是子目录会产出
 *  "自洽但基准错位"的假绿)② HEAD 面必须有提交 ③ staged 面不得有未合并路径。后两条是本门
 *  特有的面语义,故留在门里,不塞进共用层。 */
function assertRepoRoot() {
  assertGitRepoRoot(ROOT, '本门判定面')
  gitRaw(['rev-parse', '--verify', 'HEAD'], ROOT) // 绝不退化成"扫到 0 个文件所以绿"
}

function isSourcePath(p) {
  return (
    /\.tsx?$/.test(p) &&
    !/\.(test|spec)\.tsx?$/.test(p) &&
    !p.split('/').some((seg) => SKIP_DIRS.has(seg)) &&
    SCAN_ROOTS.some((d) => p.startsWith(d + '/'))
  )
}

/** 三种面共用同一份接口:清单、内容、存在性必须同一个对象上取,混面即假绿。 */
function makeGitReader(face) {
  const label = face === 'head' ? 'HEAD blob' : '索引 blob'
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  assertRepoRoot()
  if (face === 'staged' && gitRaw(['ls-files', '-u', '-z'], ROOT).length > 0)
    throw new UndeterminedError(
      '索引存在未合并路径(merge/rebase 进行中),:<path> 取材有歧义 ⇒ 无法判定,先收敛 merge',
    )
  const contents = new Map()
  const allPaths = new Set(treePaths(face === 'staged' ? '' : 'HEAD'))
  return {
    label,
    face,
    listSourceFiles() {
      const out = (face === 'staged' ? [...allPaths] : treePaths('HEAD')).filter(isSourcePath)
      if (out.length === 0)
        throw new UndeterminedError(
          `${label} 在扫描面(${SCAN_ROOTS.join(' + ')})枚举到 0 个源文件 ⇒ 无法判定`,
        )
      return out.sort()
    },
    fetch(rels) {
      const missing = [...new Set(rels)].filter((r) => r && !contents.has(r))
      if (missing.length === 0) return
      const map = catBatch(
        ROOT,
        missing.map((r) => prefix + r),
      )
      for (const rel of missing) {
        const text = map.get(prefix + rel)
        contents.set(rel, text === undefined ? null : text)
      }
    },
    read(rel) {
      if (!contents.has(rel)) this.fetch([rel])
      const text = contents.get(rel)
      if (text === null)
        throw new UndeterminedError(`${label} 取不到 ${rel}(对象缺失 / 非 blob / 已删除)`)
      return text
    },
    tryRead(rel) {
      if (!contents.has(rel)) this.fetch([rel])
      return contents.get(rel) ?? null
    },
    exists(rel) {
      return allPaths.has(rel)
    },
    listPackageDirs() {
      return [...allPaths]
        .filter((p) => /^packages\/[^/]+\/package\.json$/.test(p))
        .map((p) => p.replace(/\/package\.json$/, ''))
        .sort()
    },
  }
}

function makeWorktreeReader() {
  return {
    label: '工作区磁盘(仅人工排查,不作结论)',
    face: 'worktree',
    listSourceFiles() {
      const out = []
      const walk = (dir) => {
        let entries
        try {
          entries = readdirSync(dir)
        } catch {
          return
        }
        for (const name of entries) {
          const p = join(dir, name)
          let st
          try {
            st = statSync(p)
          } catch {
            continue
          }
          if (st.isDirectory()) {
            if (!SKIP_DIRS.has(name)) walk(p)
          } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
            out.push(relative(ROOT, p).replace(/\\/g, '/'))
          }
        }
      }
      for (const d of SCAN_ROOTS) walk(join(ROOT, d))
      if (out.length === 0)
        throw new UndeterminedError('工作区在扫描面枚举到 0 个源文件 ⇒ 无法判定')
      return out.sort()
    },
    fetch() {},
    read(rel) {
      try {
        return readFileSync(join(ROOT, rel), 'utf8')
      } catch (e) {
        throw new UndeterminedError(`工作区取不到 ${rel}:${e.message}`)
      }
    },
    tryRead(rel) {
      try {
        return readFileSync(join(ROOT, rel), 'utf8')
      } catch {
        return null
      }
    },
    exists(rel) {
      return existsSync(join(ROOT, rel))
    },
    listPackageDirs() {
      let names
      try {
        names = readdirSync(join(ROOT, 'packages'))
      } catch {
        throw new UndeterminedError('工作区读不到 packages/ 目录 ⇒ 无法判定')
      }
      return names
        .filter((n) => !SKIP_DIRS.has(n))
        .map((n) => `packages/${n}`)
        .sort()
    },
  }
}

/** 单一取材入口。全量默认 HEAD;`--staged` 用索引;工作区只作逃生舱。 */
export function makeFaceReader(face = 'head') {
  if (face === 'worktree') return makeWorktreeReader()
  if (face === 'head' || face === 'staged') return makeGitReader(face)
  throw new UndeterminedError(`未知判定面 "${face}"(允许 head / staged / worktree)`)
}

/** 本轮的活动面:纯函数默认从这里取内容,run() 每轮显式换面并清缓存。 */
let ACTIVE = null
function setActive(reader) {
  ACTIVE = reader
  sourceCache.clear() // 换面必须清缓存,否则上一面的文本会冒充这一面的结论
}
function active() {
  if (!ACTIVE) setActive(makeFaceReader('head'))
  return ACTIVE
}

// ─────────────────────────────────────────────────────────────────────────────
// 扫描小工具
// ─────────────────────────────────────────────────────────────────────────────

function skipString(s, i) {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === q) return j
  }
  return -1
}

function matchBrace(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') i = skipString(s, i)
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 剥注释:块注释与整行行注释(判据不得被注释里的示例骗到)。
 *  用**空格填充**而非删除 —— 行列偏移必须与原文件一致,报错才指得到真行号。 */
export function stripComments(src) {
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank)
}

// ─────────────────────────────────────────────────────────────────────────────
// W1 形状
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 对象字面量体内深度 ≤2 的 `字段: 'a.b.c'`。
 * @returns {{dotted:{path:string,key:string}[], plain:number, other:number}}
 *  plain = 不含点的字符串字面量(如 `title: '默认模式'`),other = 计算值/函数/数组等。
 */
export function scanObjectLiterals(body) {
  const dotted = []
  let plain = 0
  let other = 0
  const re = /(?:^|[,{\n])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*(?![\w$])/g
  let m
  while ((m = re.exec(body))) {
    const field = m[1] ?? m[2] ?? m[3]
    let i = m.index + m[0].length
    while (i < body.length && /\s/.test(body[i])) i++
    const ch = body[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(body, i)
      if (end === -1) break
      const km = DOTTED_KEY_RE.exec(body.slice(i, end + 1))
      if (km) dotted.push({ path: field, key: km[1] })
      else plain++
      re.lastIndex = end
    } else if (ch === '{') {
      const close = matchBrace(body, i)
      if (close === -1) break
      const inner = scanObjectLiterals(body.slice(i + 1, close))
      for (const h of inner.dotted) dotted.push({ path: `${field}.${h.path}`, key: h.key })
      plain += inner.plain
      other += inner.other
      re.lastIndex = close
    } else {
      other++
    }
  }
  return { dotted, plain, other }
}

/** `const NAME [: 类型标注] = {` —— 标注里允许 `;`(内联对象类型)与 `=>` */
const CONST_OBJECT_RE =
  /(?:^|\n)\s*(export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*(?::\s*(?:[^=]|=>)*?)?=\s*\{/g

/** 文件里的候选词表(纯函数:files = [{rel,text}],镜像测试由此注入假语料) */
export function discoverWordTables(files) {
  const tables = []
  for (const { rel, text } of files) {
    const src = stripComments(text)
    CONST_OBJECT_RE.lastIndex = 0
    let m
    while ((m = CONST_OBJECT_RE.exec(src))) {
      const open = src.indexOf('{', m.index + m[0].length - 1)
      const close = matchBrace(src, open)
      if (close === -1) continue
      const { dotted, plain, other } = scanObjectLiterals(src.slice(open + 1, close))
      CONST_OBJECT_RE.lastIndex = close
      if (dotted.length < 2 || plain > 0 || other > 0) continue
      const keys = [...new Set(dotted.map((d) => d.key))]
      if (keys.length < 2) continue
      // 行号必须钉在 `const` 关键字上:整段匹配以 `\n\s*` 开头,用 m.index 会报到上一条语句
      const constAt = m.index + m[0].indexOf('const')
      tables.push({
        file: rel,
        name: m[2],
        line: src.slice(0, constAt).split('\n').length,
        exported: Boolean(m[1]),
        keys,
        fields: dotted.map((d) => d.path),
      })
    }
  }
  return tables
}

// ─────────────────────────────────────────────────────────────────────────────
// 权威消息源
// ─────────────────────────────────────────────────────────────────────────────

function parseJson(text, rel) {
  try {
    return JSON.parse(text)
  } catch (e) {
    // 语料坏 JSON 不得静默当"这张表没有键" —— 那会把真缺键洗成绿(守门 94 同型)
    throw new UndeterminedError(`${rel} 不是合法 JSON:${e.message}`)
  }
}
/** 权威消息源:取不到即「无法判定」(语料是判据的地基,没有"读不到算通过"这一档) */
function readCorpus(reader, source, lang) {
  const rel = `packages/i18n/messages/${source}/${lang}.json`
  return parseJson(reader.read(rel), `${reader.label} 的 ${rel}`)
}

/** 消息对象 → Map(叶子路径 → 值);数组与字符串都算叶子 */
export function collectLeaves(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) collectLeaves(v, path, out)
    else out.set(path, v)
  }
  return out
}

/** 每端合并视图(shared + 端 override,与 @ihui/i18n loader:mergeMessages 同语义) */
export function buildMergedViews(reader = active()) {
  const views = {}
  for (const end of END_DIRS) {
    for (const lang of LANGS) {
      views[`${end}/${lang}`] = collectLeaves(
        mergeMessages(readCorpus(reader, 'shared', lang), readCorpus(reader, end, lang)),
      )
    }
  }
  return views
}

/** 绝对路径是否存在于权威语料(任一源 × 任一语言)—— 只服务 W2 锚定 */
export function corpusLeafSet(reader = active()) {
  const set = new Set()
  for (const source of CORPUS_SOURCES) {
    for (const lang of LANGS)
      for (const p of collectLeaves(readCorpus(reader, source, lang)).keys()) set.add(p)
  }
  return set
}

/** 可解析 = 有值 ∧ 是字符串 ∧ 非空 ∧ 不等于键名(等于键名就是静默回显) */
export function resolvable(map, key) {
  const value = map?.get(key)
  return typeof value === 'string' && value.trim() !== '' && value !== key
}

// ─────────────────────────────────────────────────────────────────────────────
// W3 消费端归属
// ─────────────────────────────────────────────────────────────────────────────

/** 各 packages 子目录 package.json 的 name → 目录(权威,不猜包名) */
export function buildPackageMap(reader = active()) {
  const map = new Map()
  for (const rel of reader.listPackageDirs()) {
    const pj = `${rel}/package.json`
    if (!reader.exists(pj)) continue
    const n = parseJson(reader.read(pj), `${reader.label} 的 ${pj}`)?.name
    if (typeof n === 'string') map.set(n, rel)
  }
  return map
}

const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']
function fileFromBase(baseRel, reader = active()) {
  if (!baseRel) return null
  const norm = baseRel.replace(/\\/g, '/')
  for (const ext of EXTS) {
    const p = norm + ext
    if (reader.exists(p)) return p
  }
  return null
}

/**
 * 说明符 → 仓库内模块相对路径。支持相对路径、`@/<x>`(端内 src 别名)、`@ihui/<pkg>[/<sub>]`。
 * 解析不到(第三方包、未登记的 tsconfig 别名)返回 null —— 宁漏不误报。
 */
export function resolveSpecifier(spec, fromRel, pkgMap, reader = active()) {
  if (typeof spec !== 'string' || spec.length === 0) return null
  if (!spec.startsWith('.')) {
    if (spec.startsWith('@/')) {
      const seg = /^apps\/([^/]+)\//.exec(fromRel)
      if (!seg) return null
      return fileFromBase(`apps/${seg[1]}/src/${spec.slice(2)}`, reader)
    }
    if (spec.startsWith('@ihui/')) {
      // 作用域名占两段:pkgName = '@scope/name',其余才是子路径
      const parts = spec.split('/')
      const pkgName = parts.slice(0, 2).join('/')
      const pkgDir = pkgMap.get(pkgName)
      if (!pkgDir) return null
      const sub = parts.slice(2).join('/')
      return sub
        ? (fileFromBase(`${pkgDir}/src/${sub}`, reader) ?? fileFromBase(`${pkgDir}/${sub}`, reader))
        : fileFromBase(`${pkgDir}/src/index`, reader)
    }
    return null
  }
  const abs = resolve(dirname(join(ROOT, fromRel)), spec)
  const rel = relative(ROOT, abs).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return fileFromBase(rel, reader)
}

const IMPORT_RE = /(?:^|[\s;}('])import\s+(?:type\s+)?[\s\S]*?\s+from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT_RE = /(?:^|[\s;}]|)\bimport\s+['"]([^'"]+)['"]/g
const EXPORT_FROM_RE = /(?:^|[\s;}])export\s+(?:\*|\{[\s\S]*?\})\s+from\s*['"]([^'"]+)['"]/g

/** 文件里所有 import / re-export 的说明符 */
export function importSpecifiers(text) {
  const src = stripComments(text)
  const out = []
  for (const re of [IMPORT_RE, BARE_IMPORT_RE, EXPORT_FROM_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src))) out.push(m[1])
  }
  return out
}

/** 模块导出的符号名(判"是否真被用到",避免 barrel 顺路可达算成消费方) */
export function exportedSymbols(text) {
  const src = stripComments(text)
  const out = new Set()
  for (const m of src.matchAll(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  ))
    out.add(m[1])
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) out.add(name)
    }
  }
  return out
}

/**
 * 顶层声明块:名字 → 该声明的文本切片。切片终点取"下一个顶层声明的起点"(最后一块到 EOF),
 * 因此函数体必被覆盖。只认**第 0 列**的声明 —— 缩进的声明是嵌套在别的块里,其文本已含于外层切片。
 * 切片偏"过含"(末尾块把后续杂项也算进来)是有意方向:多算一次引用只会保留判据,不会造成放行。
 */
function topLevelDeclBlocks(src) {
  const re =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm
  const starts = []
  let m
  while ((m = re.exec(src))) {
    starts.push({ at: m.index, name: m[1] })
    re.lastIndex = m.index + 1
  }
  const blocks = new Map()
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].at : src.length
    const prev = blocks.get(starts[i].name)
    blocks.set(starts[i].name, (prev ? prev + '\n' : '') + src.slice(starts[i].at, end))
  }
  return blocks
}

/** `export { a as b, c }` 的别名回填:b → a(判据认内部真名,消费端写的是对外名字) */
function exportAliases(src) {
  const map = new Map()
  for (const x of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of x[1].split(',')) {
      const seg = part.trim().replace(/^type\s+/, '')
      if (!seg || seg === 'default') continue
      const as = seg.split(/\s+as\s+/)
      const from = as[0].trim()
      const to = (as[1] ?? as[0]).trim()
      if (/^[A-Za-z_$][\w$]*$/.test(from) && /^[A-Za-z_$][\w$]*$/.test(to)) map.set(to, from)
    }
  }
  return map
}

/** 该表标识符在模块内**被谁读到**:从表名出发沿顶层声明块相互引用做传递闭包 */
export function tableReachableNames(moduleText, tableName) {
  return reachableFromBlocks(topLevelDeclBlocks(stripComments(moduleText)), tableName)
}

function reachableFromBlocks(blocks, tableName) {
  const word = new Map()
  const reFor = (name) => {
    if (!word.has(name)) word.set(name, new RegExp(String.raw`\b${name.replace(/[$]/g, '\\$')}\b`))
    return word.get(name)
  }
  const tainted = new Set([tableName])
  let grew = true
  while (grew) {
    grew = false
    for (const [name, text] of blocks) {
      if (tainted.has(name)) continue
      for (const t of tainted) {
        if (reFor(t).test(text)) {
          tainted.add(name)
          grew = true
          break
        }
      }
    }
  }
  return tainted
}

/**
 * 消费端判定的符号面 = 模块导出符号 ∩ 真正读到这张表的符号。
 *
 * 为什么必须收到这一层(2026-09-24 实测盲区,70 枚 blocking 恒红的真因):
 * `packages/shared/src/utils/error-messages.ts` 同模块导出 3 个函数 —— 只有
 * `getErrorI18nKey` / `resolveErrorMessage` 会把 `errors.*` 交给 `t()`;
 * `toUserFriendlyMessage` 读的是另一张固定中文表 `ERROR_CODE_TO_ZH`,压根不查词表。
 * 而 mobile-rn 约 40 个屏调的正是后者。旧判据"该端提到**任一**导出符号 ⇒ 它是这张键表的
 * 消费端",符号粒度被抹平,于是 14 枚全仓零调用方的键在 mobile-rn 上被判"界面会回显键名"。
 *
 * 两处兜底(方向一律是"退回旧判据、宁可多报"):
 * ① 覆盖性自检 —— 任一导出符号既没有自己的顶层声明块、也不是 `export { 内名 as 外名 }` 的别名,
 *   说明顶层切分没吃下这个文件(新语法形态 / 从别处 re-export)。**这条是命门**:切分一旦失效,
 *   触表面会缩成"只剩表自己"⇒ 消费端被判成 0 ⇒ 门在真缺陷上恒绿(首轮实测就是这样误伤了
 *   permission-tier / AgentRuntimePanel / budget-note 三张表的真消费端)。
 * ② 收窄后为空(表只被模块内的非导出代码读)→ 同样退回全量。
 */
export function tableScopedSymbols(moduleText, tableName) {
  const src = stripComments(moduleText)
  const all = exportedSymbols(moduleText)
  const blocks = topLevelDeclBlocks(src)
  const alias = exportAliases(src)
  const uncovered = [...all].filter((s) => !blocks.has(s) && !blocks.has(alias.get(s) ?? ''))
  if (!blocks.size || uncovered.length) return all
  const reach = reachableFromBlocks(blocks, tableName)
  const scoped = new Set()
  for (const s of all) {
    if (reach.has(s) || reach.has(alias.get(s) ?? s)) scoped.add(s)
  }
  return scoped.size ? scoped : all
}

const sourceCache = new Map()
/** 本轮某面上的源码文本(取不到即「无法判定」,绝不静默当空文件 —— 那会把真违规洗成绿) */
export function sourceFile(rel, reader = active()) {
  const ck = `${reader.label}\u0000${rel}`
  if (sourceCache.has(ck)) return sourceCache.get(ck)
  const text = reader.read(rel)
  sourceCache.set(ck, text)
  return text
}

/** 扫描面内全部源码文件(相对路径,正斜杠)—— 清单一律来自当前判定面 */
export function listSourceFiles(reader = active()) {
  return reader.listSourceFiles()
}

/** 反向 import 索引:模块 → 直接 import 它的文件(全仓一次构建,查多次) */
export function buildReverseIndex(files, pkgMap, reader = active()) {
  // 先一次 cat-file --batch 把整面读完:逐个 read() = 每个文件一次 git 派生,
  // 5000 个文件能把这道门拖到 5 分钟以上(实测镜像测试就是这么被咬住的)。
  reader.fetch([...new Set(files)])
  const importers = new Map()
  for (const rel of files) {
    for (const spec of importSpecifiers(sourceFile(rel, reader))) {
      const r = resolveSpecifier(spec, rel, pkgMap, reader)
      if (!r || r === rel) continue
      if (!importers.has(r)) importers.set(r, new Set())
      importers.get(r).add(rel)
    }
  }
  return importers
}

/** 谁(直接或间接,maxDepth 跳内)import 了 target */
export function reverseClosure(targetRel, importers, maxDepth = 4) {
  const found = new Set()
  let frontier = new Set([targetRel])
  for (let d = 0; d < maxDepth && frontier.size; d++) {
    const next = new Set()
    for (const mod of frontier) {
      for (const imp of importers.get(mod) ?? []) {
        if (imp === targetRel || found.has(imp)) continue
        found.add(imp)
        next.add(imp)
      }
    }
    frontier = next
  }
  return found
}

/** 消费端:该端存在文件既经 import 图到词表模块、又提及该模块导出的符号 */
export function consumerEnds(table, importers, symbols) {
  const hits = new Set()
  for (const rel of reverseClosure(table.file, importers)) {
    const seg = /^apps\/([^/]+)\//.exec(rel)
    if (!seg || !END_DIRS.includes(seg[1])) continue
    const text = sourceFile(rel)
    for (const s of symbols) {
      if (new RegExp(`\\b${s.replace(/\$/g, '\\$')}\\b`).test(text)) {
        hits.add(seg[1])
        break
      }
    }
  }
  return [...hits].sort()
}

/** 各包/各端 package.json 的直接 @ihui 依赖 */
export function buildDirectDeps(pkgMap, reader = active()) {
  const direct = new Map()
  const load = (dir, fallbackName) => {
    const rel = `${dir}/package.json`
    const text = reader.tryRead(rel)
    const j = text === null ? {} : parseJson(text, `${reader.label} 的 ${rel}`)
    const name = typeof j?.name === 'string' ? j.name : fallbackName
    direct.set(
      name,
      Object.keys({ ...j.dependencies, ...j.devDependencies }).filter(
        (k) => pkgMap.has(k) || k === name,
      ),
    )
    return name
  }
  for (const [name, dir] of pkgMap) load(dir, name)
  const appName = {}
  for (const end of END_DIRS) appName[end] = load(`apps/${end}`, `@ihui/${end}`)
  return { direct, appName }
}

/** 依赖(含传递)某个 packages/* 的端清单 */
export function endsDependingOnPackage(pkgDir, pkgMap, deps) {
  const target = [...pkgMap.entries()].find(([, d]) => d === pkgDir)?.[0]
  if (!target) return []
  const out = []
  for (const end of END_DIRS) {
    const start = deps.appName[end] ?? `@ihui/${end}`
    const seen = new Set([start])
    const queue = [start]
    while (queue.length) {
      for (const dep of deps.direct.get(queue.shift()) ?? []) {
        if (seen.has(dep)) continue
        seen.add(dep)
        queue.push(dep)
      }
    }
    if (seen.has(target)) out.push(end)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// W4 taro 离线生成物
// ─────────────────────────────────────────────────────────────────────────────

export function taroBundleViews(genScriptText, genFileText) {
  const parsed = remoteLocaleList(genScriptText)
  const remote = parsed ?? LANGS
  const decoded = decodeTaroBundle(genFileText, remote)
  const views = {}
  const broken = []
  for (const lang of remote) {
    if (!decoded[lang]) {
      broken.push(lang)
      continue
    }
    views[lang] = collectLeaves(decoded[lang])
  }
  // 取不到 REMOTE_LOCALES 清单 = 生成器格式变了,离线面根本没核验(宁可炸,不静默放过)
  return { views, remote, broken, unparsed: parsed === null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 判据组装(纯函数,可注入)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param tables     W1 认定的候选词表(带 keys/consumerEnds/dependentEnds)
 * @param corpusLeaves Set<绝对路径>  W2 锚定
 * @param views      { `${end}/${lang}` → Map<叶子,值> }
 * @param taro       { views: Map<lang,Map>, remote:[lang], broken:[lang] } | null
 * @param isSharedTable  (table)=>boolean
 */
export function evaluateWordTables({ tables, corpusLeaves, views, taro, isSharedTable }) {
  const checked = []
  const skipped = []
  const failures = []
  // W5 是"落点债"而非当前缺陷:该端依赖共享包但**尚未引用**这张表 ⇒ 今天没有任何界面会回显键名。
  // 让它计入 failures 会把 blocking 门长期红在别人未接入的存量上(实测 5 条全是这一类),
  // 故单列 notices:照报、不改退出码。真正接进去(端内出现该表符号)即由 W3/W4 逐键硬拦。
  const notices = []
  for (const t of tables) {
    const absCount = t.keys.filter((k) => corpusLeaves.has(k)).length
    const ratio = absCount / t.keys.length
    if (absCount === 0) {
      skipped.push({
        name: t.name,
        file: t.file,
        keys: t.keys.length,
        absCount,
        reason: '绝对路径全解析不出:命名空间相对取词或含点非键 map',
      })
      continue
    }
    if (absCount < 2 || ratio < 0.5) {
      skipped.push({
        name: t.name,
        file: t.file,
        keys: t.keys.length,
        absCount,
        reason: `锚定不足(${absCount}/${t.keys.length} < 50%)`,
      })
      continue
    }
    checked.push(t)
    const ends = t.consumerEnds ?? []
    for (const end of ends) {
      for (const lang of LANGS) {
        const view = views[`${end}/${lang}`]
        for (const key of t.keys) {
          if (!resolvable(view, key))
            failures.push({
              rule: 'W3',
              table: t,
              key,
              where: `${end}/${lang}`,
              why: '消费端合并视图(shared+端)解析不出值 → 界面回显键名',
            })
        }
      }
    }
    if (taro && ends.includes('miniapp-taro')) {
      if (taro.unparsed) {
        failures.push({
          rule: 'W4',
          table: t,
          key: `(${t.keys.length} 个键)`,
          where: 'taro-gen/REMOTE_LOCALES',
          why: `读不到离线包语言清单(${TARO_GEN_SCRIPT} 格式变更?)→ 小程序离线面未核验,判红而非静默放过`,
        })
      }
      for (const lang of taro.remote) {
        const view = taro.views[lang]
        if (!view) {
          failures.push({
            rule: 'W4',
            table: t,
            key: `(${t.keys.length} 个键)`,
            where: `taro-gen/${lang}`,
            why: '离线包解不出该语言载荷(生成物过期或格式变更,需 pnpm gen:i18n)',
          })
          continue
        }
        for (const key of t.keys) {
          if (!resolvable(view, key))
            failures.push({
              rule: 'W4',
              table: t,
              key,
              where: `taro-gen/${lang}`,
              why: '小程序离线语言包取不到值(pnpm gen:i18n 未跑或键未补)',
            })
        }
      }
    }
    if (isSharedTable(t)) {
      for (const end of t.dependentEnds ?? []) {
        if (ends.includes(end)) continue
        const missing = LANGS.filter((lang) =>
          t.keys.some((k) => !resolvable(views[`${end}/${lang}`], k)),
        )
        if (missing.length) {
          notices.push({
            rule: 'W5',
            table: t,
            key: `(${t.keys.length} 个键)`,
            where: `${end}/[${missing.join(',')}]`,
            why: '词表在共享包、该端依赖此包但尚未 import;键未沉到 shared 消息源 → 接入即回显键名',
          })
        }
      }
    }
  }
  return { checked, skipped, failures, notices }
}

/** 空输入不得静默变绿:全量模式一张表都没认出来 = 源码形状变了 */
export function guardNoTables({ tablesFound, mode, scopedCount }) {
  if (tablesFound === 0) return '全仓扫出 0 张候选词表(源码形状变更或扫描面漂移),判据不可信'
  if (mode === 'full' && scopedCount === 0) return '全量模式下待检词表为 0,判据不可信'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// W6 散落的取词字面量(*Key 属性位 / 直接 t() 调用)
// ─────────────────────────────────────────────────────────────────────────────

/** 带点键(无引号版,判据与 DOTTED_KEY_RE 同一条:首段标识符形状 + ≥2 段) */
export const DOTTED_KEY_BARE_RE = /^[A-Za-z][\w-]*(?:\.[\w$-]+)+$/

function dottedValue(raw) {
  if (typeof raw !== 'string' || !DOTTED_KEY_BARE_RE.test(raw)) return false
  if (raw.includes('\\')) return false
  return true
}

const SCATTER_PROP_RE =
  /(?:^|[,{[:\n])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?![\w$])/g
const SCATTER_JSX_RE = /(?:^|[\s(])((?:[A-Za-z_$][\w$]*)Key)\s*=\s*(['"])((?:[^'"\n]|\\.)*)\2/g
const SCATTER_CALL_RE =
  /(?:^|[^\w$.])((?:tt?|i18n\.t|intl\.t|i18next\.t|translator\.t|getT\(\)\.t))\s*\(\s*(['"`])((?:[^'"`\\]|\\.)*?)\2\s*[,)]/g

/**
 * 一个文件里所有"看起来就是取词"的带点字面量。
 * 三种形状:属性位 `labelKey: 'a.b'`(含数组/对象任意嵌套)、JSX 属性 `i18nKey="a.b"`、
 * 直接调用 `t('a.b')` / `` t(`a.b`) ``(带 `${}` 插值的动态键一律不收 —— 静态判据不猜运行时)。
 * @returns {{key:string, field:string, line:number, via:string}[]}
 */
export function scanScatteredKeys(text) {
  const src = stripComments(text)
  const lineOf = (idx) => src.slice(0, idx).split('\n').length
  const out = []
  const add = (key, field, via, idx) => {
    if (!dottedValue(key)) return
    // 属性位/JSX 属性额外要求"属性名以 Key 结尾且不在非取词名单";调用位没有属性名可对。
    if (via !== 'call' && (NON_I18N_KEY_PROPS.has(field) || !KEY_PROP_NAME_RE.test(field))) return
    out.push({ key, field, via, line: lineOf(idx) })
  }

  let m
  SCATTER_PROP_RE.lastIndex = 0
  while ((m = SCATTER_PROP_RE.exec(src))) {
    const field = m[1] ?? m[2] ?? m[3]
    let i = m.index + m[0].length
    while (i < src.length && /\s/.test(src[i])) i++
    const ch = src[i]
    if (ch !== '"' && ch !== "'" && ch !== '`') continue
    const end = skipString(src, i)
    if (end === -1) break
    SCATTER_PROP_RE.lastIndex = end
    const raw = src.slice(i + 1, end)
    if (ch === '`' && raw.includes('${')) continue
    add(raw, field, 'prop', m.index)
  }
  SCATTER_JSX_RE.lastIndex = 0
  while ((m = SCATTER_JSX_RE.exec(src))) add(m[3], m[1], 'jsx', m.index)
  SCATTER_CALL_RE.lastIndex = 0
  while ((m = SCATTER_CALL_RE.exec(src))) add(m[3], `${m[1]}()`, 'call', m.index)
  return out
}

/** 一条叶子路径贡献给后缀宇宙的所有 ≥2 段后缀(含它自己)。单一实现,自检与判据共用。 */
export function keySuffixes(path) {
  const segs = path.split('.')
  const out = []
  for (let i = 0; i + 2 <= segs.length; i++) out.push(segs.slice(i).join('.'))
  return out
}

/**
 * W6 的判据地基:**全语料叶子路径的后缀宇宙**(≥2 段的每个后缀)。
 * 按后缀而不是绝对路径,是因为 `*Key` 取值有两套并存约定(绝对路径 vs 命名空间相对,
 * 后者连命名空间都可能在**另一个文件**里声明)。绝对口径实测产出 696 枚假红,
 * 后缀口径只留"这个键从来没被任何语言包收录过"这一条硬事实。
 */
export function buildKeyUniverse(reader = active()) {
  const universe = new Set()
  for (const source of CORPUS_SOURCES) {
    for (const lang of LANGS) {
      for (const [p, v] of collectLeaves(readCorpus(reader, source, lang))) {
        if (typeof v !== 'string' || v.trim() === '') continue
        for (const s of keySuffixes(p)) universe.add(s)
      }
    }
  }
  if (universe.size === 0)
    throw new UndeterminedError(`${reader.label} 的后缀宇宙为空(语料整块读不到)⇒ 无法判定`)
  return universe
}

/** 单文件的 W6 违规(纯函数:universe 由调用方按同一判定面铺好) */
export function evaluateScatteredKeys({ file, text, universe }) {
  const first = new Map()
  for (const h of scanScatteredKeys(text)) if (!first.has(h.key)) first.set(h.key, h)
  const bad = []
  for (const h of first.values()) {
    if (universe.has(h.key)) continue
    bad.push({
      rule: 'W6',
      file,
      key: h.key,
      field: h.field,
      line: h.line,
      via: h.via,
      why: `${h.field} 的取值 "${h.key}" 在全部消息源 × 5 语言里查不到(连相对后缀都没有)→ 界面会原样回显键名`,
    })
  }
  return bad.sort((a, b) => a.line - b.line)
}

/**
 * 逐文件棘轮(与守门 77/83/98 同取向):锚点 = 该文件 **HEAD 自身**的 W6 违规数。
 * 全量模式下待检面就是 HEAD ⇒ 存量只报数不判红;把锚点写成 0 会让 37 个文件整片恒红,
 * 而恒红 blocking 门的唯一结局是逼人 `--no-verify`,连带废掉全部守门。
 */
export function splitScatteredRatchet(pendingByFile, headCountOf) {
  const fresh = []
  let tolerated = 0
  for (const [file, list] of pendingByFile) {
    const tol = headCountOf(file)
    if (list.length > tol) fresh.push({ file, list, tol })
    else tolerated += list.length
  }
  return { fresh, tolerated }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function stagedFiles() {
  try {
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], ROOT)
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

/** 权威语料的全部路径(与 buildMergedViews / buildKeyUniverse 同清单,一轮只取一次面) */
function corpusRelPaths() {
  return CORPUS_SOURCES.flatMap((s) => LANGS.map((l) => `packages/i18n/messages/${s}/${l}.json`))
}

/** W6 的廉价预筛:整份文本里连 `Key` 与 `t(` 都没有 ⇒ 三种形状都不可能出现。
 *  这只是提速短路,不是判据(判据在 scanScatteredKeys 里)。 */
function maybeHasScatteredKey(text) {
  return /Key\s*[:=]|\btt?\s*\(|\bi18n\.t\s*\(/.test(text)
}

export function run({ staged = false, json = false, quiet = false, worktree = false } = {}) {
  const log = (...a) => {
    if (!quiet) console.log(...a)
  }
  const warn = (...a) => {
    if (!quiet) console.error(...a)
  }
  // 一面到底:清单、源码、语料、包清单必须来自同一个 reader,混面即"自洽但基准错位"的假绿
  const face = worktree ? 'worktree' : staged ? 'staged' : 'head'
  const reader = makeFaceReader(face)
  setActive(reader)
  const files = reader.listSourceFiles()
  const st = staged ? stagedFiles() : null
  reader.fetch([
    ...files,
    ...corpusRelPaths(),
    ...reader.listPackageDirs().map((d) => `${d}/package.json`),
    ...END_DIRS.map((e) => `apps/${e}/package.json`),
    TARO_GEN,
    TARO_GEN_SCRIPT,
  ])
  const pkgMap = buildPackageMap(reader)
  const deps = buildDirectDeps(pkgMap, reader)
  const tables = discoverWordTables(files.map((rel) => ({ rel, text: sourceFile(rel, reader) })))

  let mode = 'full'
  let scope = '全量'
  let scoped = tables
  if (staged) {
    mode = 'staged'
    const touchesCorpus =
      st && (st.some((f) => f.startsWith('packages/i18n/messages/')) || st.includes(TARO_GEN))
    const touchesCode = st && st.some((f) => f.startsWith('apps/') || f.startsWith('packages/'))
    if (!st) scope = '暂存区读不到(git 不可用)→ 全表回归'
    else if (touchesCorpus) scope = '暂存区触及消息语料或离线包 → 全表回归'
    else if (touchesCode)
      // 只按"暂存文件里有没有词表"收窄会漏:新接线一个消费端(改 apps/**)就把原本无人消费的
      // 词表变成真缺口,而词表文件本身没动 —— 所以端内/包内任何源码改动都回归全表。
      scope = '暂存区含端内/共享包源码(import 归属可能变)→ 全表回归'
    else {
      scoped = []
      scope = '暂存区未触及 apps/ 与 packages/(词表、语料、消费端都不可能变)→ 本轮 0 张待检'
    }
  }

  const guard = guardNoTables({ tablesFound: tables.length, mode, scopedCount: scoped.length })
  if (guard) {
    if (!quiet) throw new Error(guard)
    return {
      ok: false,
      guard,
      failures: [],
      consumers: [],
      tablesFound: tables.length,
      checkedTables: 0,
    }
  }

  const importers = buildReverseIndex(
    [...new Set([...files, ...scoped.map((t) => t.file)])],
    pkgMap,
    reader,
  )
  const views = buildMergedViews(reader)
  const corpus = corpusLeafSet(reader)
  const taro = taroBundleViews(sourceFile(TARO_GEN_SCRIPT, reader), sourceFile(TARO_GEN, reader))
  const symbolsCache = new Map()
  for (const t of scoped) {
    // 键必须带表名:一个文件可同时挂多张键表(实测 CourseFilterScreen.tsx 3 张、privacy.tsx 2 张),
    // 各表的"触表符号"不同,按文件缓存会把前一张表的结论漏给后一张。
    const skey = `${t.file}#${t.name}`
    if (!symbolsCache.has(skey))
      symbolsCache.set(skey, tableScopedSymbols(sourceFile(t.file, reader), t.name))
    t.consumerEnds = consumerEnds(t, importers, symbolsCache.get(skey))
    const m = /^(packages\/[^/]+)\//.exec(t.file)
    t.dependentEnds = m ? endsDependingOnPackage(m[1], pkgMap, deps) : []
  }
  const { checked, skipped, failures, notices } = evaluateWordTables({
    tables: scoped,
    corpusLeaves: corpus,
    views,
    taro,
    isSharedTable: (t) => t.file.startsWith('packages/'),
  })

  // ── W6 散落的取词字面量:待检面 = 当前判定面,锚点 = 该文件 HEAD 自身违规数 ──
  const universe = buildKeyUniverse(reader)
  // 语料被本次提交动过 ⇒ 每个文件的结论都可能翻,必须全表回归(只扫暂存源文件会漏"删键"这一类)
  const corpusTouched =
    mode === 'staged' &&
    (!st || st.some((f) => f.startsWith('packages/i18n/messages/')) || st.includes(TARO_GEN))
  const w6Files = staged && st && !corpusTouched ? files.filter((f) => st.includes(f)) : files
  const pendingByFile = new Map()
  let scatteredCandidates = 0
  for (const rel of w6Files) {
    const text = sourceFile(rel, reader)
    if (!maybeHasScatteredKey(text)) continue
    const bad = evaluateScatteredKeys({ file: rel, text, universe })
    scatteredCandidates += bad.length
    if (bad.length) pendingByFile.set(rel, bad)
  }
  const headReader = face === 'head' ? reader : makeFaceReader('head')
  if (headReader !== reader) headReader.fetch([...pendingByFile.keys(), ...corpusRelPaths()])
  const headUniverse = headReader === reader ? universe : buildKeyUniverse(headReader)
  const headCountOf = (file) => {
    if (headReader === reader) return pendingByFile.get(file)?.length ?? 0
    const text = headReader.tryRead(file)
    // HEAD 没有这个文件 = 本次新增的文件 ⇒ 锚点 0,它的任何违规都是新增
    if (text === null) return 0
    return evaluateScatteredKeys({ file, text, universe: headUniverse }).length
  }
  const { fresh: scatteredFresh, tolerated: scatteredTolerated } = splitScatteredRatchet(
    pendingByFile,
    headCountOf,
  )
  for (const { file, list, tol } of scatteredFresh) {
    for (const v of list)
      failures.push({
        ...v,
        why: `${v.why}(该文件 HEAD 自身已有 ${tol} 处,本次 ${list.length} 处 —— 本门只拦超出的那部分)`,
        table: { file, line: v.line, name: '散落取词(W6)' },
      })
  }

  const report = {
    scope,
    mode,
    face: reader.label,
    tablesFound: tables.length,
    checkedTables: checked.length,
    keysChecked: checked.reduce((a, b) => a + b.keys.length, 0),
    consumers: checked.map((t) => ({
      table: `${t.file}:${t.line}#${t.name}`,
      ends: t.consumerEnds,
      dependentEnds: t.dependentEnds,
      keys: t.keys.length,
    })),
    skipped,
    taroRemoteLocales: taro.remote,
    taroBroken: taro.broken,
    scattered: {
      filesScanned: w6Files.length,
      filesWithMissingKeys: pendingByFile.size,
      missingKeys: scatteredCandidates,
      toleratedAtHead: scatteredTolerated,
      freshFiles: scatteredFresh.length,
      freshKeys: scatteredFresh.reduce((a, x) => a + Math.max(0, x.list.length - x.tol), 0),
      // 全量存量清单只有走 --json 才看得见(文本输出只截 12 行,提交时不刷屏)
      inventory: [...pendingByFile]
        .map(([file, list]) => ({
          file,
          count: list.length,
          headCount: headCountOf(file),
          keys: list.map((v) => `${v.key}@${v.line}`),
        }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
      detail: scatteredFresh.map((x) => ({
        file: x.file,
        headTol: x.tol,
        keys: x.list.map((v) => `${v.key}@${v.line}(${v.field})`),
      })),
    },
    landingDebts: notices.map((f) => ({
      rule: f.rule,
      table: `${f.table.file}:${f.table.line}#${f.table.name}`,
      key: f.key,
      where: f.where,
      why: f.why,
    })),
    failures: failures.map((f) => ({
      rule: f.rule,
      table: `${f.table.file}:${f.table.line}#${f.table.name}`,
      key: f.key,
      where: f.where ?? `${f.file}:${f.line}`,
      why: f.why,
    })),
  }
  if (json) {
    log(JSON.stringify(report, null, 2))
    return { ok: report.failures.length === 0, ...report }
  }
  log(
    `[word-table-resolvable] 判定面 ${report.face} · 候选词表 ${report.tablesFound} 张 → 认定 ${report.checkedTables} 张 / ${report.keysChecked} 键` +
      `(未锚定跳过 ${skipped.length} 张)· ${report.scope}` +
      (taro.broken.length ? ` · ⚠ taro 载荷解不出:${taro.broken.join(',')}` : ''),
  )
  log(
    `  W6 散落取词:扫 ${report.scattered.filesScanned} 文件 · 缺键 ${report.scattered.missingKeys} 处 / ${report.scattered.filesWithMissingKeys} 文件` +
      `(HEAD 存量容忍 ${report.scattered.toleratedAtHead} · 新增 ${report.scattered.freshFiles} 文件 / ${report.scattered.freshKeys} 键)`,
  )
  if (notices.length) {
    log(
      `  ⚠ 落点债 ${notices.length} 条(该端依赖共享包但尚未引用这张表 ⇒ 今天没有界面会回显键名,不计失败;一旦真接入,W3/W4 逐键硬拦):`,
    )
    for (const n of notices.slice(0, 10))
      log(`   · [W5] ${n.table.file}:${n.table.line}#${n.table.name} → ${n.key} @ ${n.where}`)
    if (notices.length > 10) log(`   …另 ${notices.length - 10} 条`)
  }
  if (!failures.length) {
    if (pendingByFile.size) {
      log(`  ⏸ W6 存量如实报数(锚点 = 各文件 HEAD 自身,只拦"这次改动把缺键加回来"的那些形态):`)
      for (const [file, list] of [...pendingByFile].slice(0, 12))
        log(`   · 存量 ${file}:${list.map((v) => `${v.key}@${v.line}`).join(' ')}`)
      if (pendingByFile.size > 12) log(`   …另 ${pendingByFile.size - 12} 个文件(--json 看全量)`)
    }
    if (!checked.length) {
      log(`  ⏭ 本轮待检 0 张(原因:${scope})—— 未核验任何词表,不是"已核验通过"`)
      return { ok: true, ...report }
    }
    log(
      `  ✅ 每键在 5 语言 × 消费端合并视图${checked.some((t) => t.consumerEnds.includes('miniapp-taro')) ? ' + 小程序离线包' : ''}全部取到值`,
    )
    return { ok: true, ...report }
  }
  warn(`  ❌ ${failures.length} 处取不到值(界面会回显键名):`)
  for (const f of failures.slice(0, 30)) {
    warn(
      `   · [${f.rule}] ${f.table.file}:${f.table.line}#${f.table.name} → ${f.key} @ ${f.where ?? `${f.file}:${f.line}`}`,
    )
    warn(`       ${f.why}`)
  }
  if (failures.length > 30) warn(`   …另 ${failures.length - 30} 处`)
  warn(
    '  修法:缺失键补进 packages/i18n/messages/<shared|端>/<lang>.json 五语言齐全(共享层词表优先沉到 shared);' +
      ` 改完跑 cd apps/miniapp-taro && pnpm gen:i18n 重生成离线包。紧急跳过 ${SKIP_ENV}=1`,
  )
  return { ok: false, ...report }
}

/** 注入违规 + 反例自证(全部用内存假语料,绝不写仓库真实文件) */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  // ── 假源码:一张好词表 + 三种"不该检"的形状 ─────────────────
  const fake = [
    {
      rel: 'packages/demo/src/words.ts',
      text: [
        'export const TIER_KEYS: Readonly<',
        '  Record<TierKey, { title: string; desc: string }>',
        '> = {',
        "  a: { title: 'tier.mode.a.title', desc: 'tier.mode.a.desc' },",
        "  b: { title: 'tier.mode.b.title', desc: 'tier.mode.b.desc' },",
        '}',
        'export const MODEL_NAMES: Record<string, string> = {',
        "  minimax: 'MiniMax-M2.5',",
        "  gpt: 'gpt-4.1',",
        '}',
        'export const RELATIVE_TABLE: Record<string, string> = {',
        "  one: 'typeLabel.single_choice',",
        "  two: 'typeLabel.judgment',",
        '}',
        'export const HALF_BAKED: Record<string, string> = {',
        "  ok1: 'tier.mode.a.title',",
        "  ok2: 'tier.mode.b.title',",
        "  junk1: 'x.y1',",
        "  junk2: 'p.q2',",
        "  junk3: 'r.s3',",
        '}',
        'export const MIXED_ZH: Record<string, string> = {',
        "  a: 'tier.mode.a.title',",
        "  b: 'tier.mode.b.title',",
        "  c: '直接写死的中文',",
        '}',
        'export const WITH_FN: Record<string, () => string> = {',
        "  a: 'tier.mode.a.title',",
        '  b: () => "x.y",',
        '}',
      ].join('\n'),
    },
  ]
  const found = discoverWordTables(fake)
  const names = found.map((f) => f.name)
  t(
    'W1 咬住 Record<K,{title,desc}> 嵌套形状并取到 4 键',
    found.find((f) => f.name === 'TIER_KEYS')?.keys.length === 4,
  )
  t('W1 不吃含函数值的 map(WITH_FN)', !names.includes('WITH_FN'))
  t('W1 不吃混了硬编码中文的 map(MIXED_ZH)', !names.includes('MIXED_ZH'))

  const corpus = new Set([
    'tier.mode.a.title',
    'tier.mode.a.desc',
    'tier.mode.b.title',
    'tier.mode.b.desc',
  ])
  const leafMap = (missing = []) =>
    new Map([...corpus].filter((k) => !missing.includes(k)).map((k) => [k, `V:${k}`]))
  const good = Object.fromEntries(LANGS.map((l) => [`web/${l}`, leafMap()]))
  const pick = (name, extra = {}) => [
    {
      file: 'packages/demo/src/words.ts',
      line: 1,
      name,
      keys: found.find((f) => f.name === name).keys,
      ...extra,
    },
  ]

  // ① 注入验证:表里一个键在 ko 缺失 → 必红,且点名 键/表/语言
  const injected = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['web'], dependentEnds: ['web'] }),
    corpusLeaves: corpus,
    views: { ...good, 'web/ko': leafMap(['tier.mode.b.desc']) },
    taro: null,
    isSharedTable: () => true,
  })
  t(
    '注入验证:某语言缺一个键 → W3 判红并点名 键/表/语言',
    injected.failures.some(
      (f) =>
        f.rule === 'W3' &&
        f.key === 'tier.mode.b.desc' &&
        f.where === 'web/ko' &&
        f.table.file.includes('words.ts'),
    ),
  )
  t(
    '反例:补齐 5 语言后同表通过(判据非恒红)',
    evaluateWordTables({
      tables: pick('TIER_KEYS', { consumerEnds: ['web'] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).failures.length === 0,
  )
  t(
    'W2 反例:含点但非 i18n 的模型名 map 判为不检(零失败)',
    !evaluateWordTables({
      tables: pick('MODEL_NAMES', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).failures.length,
  )
  t(
    'W2 反例:命名空间相对风格表(abs=0)判为不检',
    evaluateWordTables({
      tables: pick('RELATIVE_TABLE', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).skipped.some((s) => s.name === 'RELATIVE_TABLE' && s.absCount === 0),
  )
  t(
    'W2 反例:锚定不足半的表判为不检',
    evaluateWordTables({
      tables: pick('HALF_BAKED', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).skipped.some((s) => s.name === 'HALF_BAKED'),
  )
  t(
    'W2 锚定不掩盖真缺陷:过半可解析的表里,解析不出的那几个键仍逐条咬',
    (() => {
      const r = evaluateWordTables({
        tables: pick('HALF_BAKED', { consumerEnds: ['web'] }),
        corpusLeaves: new Set(['tier.mode.a.title', 'tier.mode.b.title', 'x.y1', 'p.q2', 'r.s3']),
        views: good,
        taro: null,
        isSharedTable: () => false,
      })
      const keys = new Set(r.failures.map((f) => f.key))
      return (
        r.checked.length === 1 &&
        keys.has('x.y1') &&
        keys.has('p.q2') &&
        keys.has('r.s3') &&
        r.failures.every((f) => f.rule === 'W3')
      )
    })(),
  )

  // W4:miniapp-taro 消费 + 离线包缺键 → 必红
  const withTaro = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'], dependentEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: {
      'miniapp-taro/zh-CN': leafMap(),
      'miniapp-taro/zh-TW': leafMap(),
      'miniapp-taro/en': leafMap(),
      'miniapp-taro/ja': leafMap(),
      'miniapp-taro/ko': leafMap(),
    },
    taro: { views: { ja: leafMap(['tier.mode.b.title']) }, remote: ['ja'], broken: [] },
    isSharedTable: () => true,
  })
  t(
    'W4 咬住离线生成物缺键(端 JSON 有、gen 载荷没有)',
    withTaro.failures.some((f) => f.rule === 'W4' && f.where === 'taro-gen/ja'),
  )
  const taroBrokenCase = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()])),
    taro: { views: {}, remote: ['en'], broken: ['en'], unparsed: false },
    isSharedTable: () => true,
  })
  t(
    'W4 生成物整体解不出 → 点名需 pnpm gen:i18n',
    taroBrokenCase.failures.some((f) => f.rule === 'W4' && /gen:i18n/.test(f.why)),
  )
  const taroUnparsedCase = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()])),
    taro: { views: {}, remote: LANGS, broken: ['zh-CN'], unparsed: true },
    isSharedTable: () => true,
  })
  t(
    'W4 取不到 REMOTE_LOCALES 清单 → 单独点名"离线面未核验"(不冒充缺键)',
    taroUnparsedCase.failures.some(
      (f) => f.rule === 'W4' && /REMOTE_LOCALES/.test(f.where) && /格式变更/.test(f.why),
    ),
  )
  t(
    'W4 生成器正常时不产生 REMOTE_LOCALES 假红',
    !withTaro.failures.some((f) => /REMOTE_LOCALES/.test(f.where)),
  )

  // W5:无人 import 但依赖该包的端整块缺键 → 单列落点债
  const w5 = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: [], dependentEnds: ['cli'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(
      LANGS.flatMap((l) => [
        [
          `cli/${l}`,
          leafMap([
            'tier.mode.a.title',
            'tier.mode.a.desc',
            'tier.mode.b.title',
            'tier.mode.b.desc',
          ]),
        ],
        [`web/${l}`, leafMap()],
      ]),
    ),
    taro: null,
    isSharedTable: () => true,
  })
  t(
    'W5 共享层词表在未接入的依赖端整块缺键 → 进 notices 落点债,且不进 failures',
    w5.notices.some((f) => f.rule === 'W5' && f.where.startsWith('cli/')) &&
      !w5.failures.some((f) => f.rule === 'W5'),
  )
  t(
    'W5 端包内的表不要求别的端(不误伤)',
    evaluateWordTables({
      tables: pick('TIER_KEYS', { consumerEnds: [], dependentEnds: ['cli'] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => false,
    }).failures.length === 0,
  )

  // 空输入防呆
  t(
    '空输入不静默变绿:全量 0 表 → guardNoTables 报错',
    guardNoTables({ tablesFound: 0, mode: 'full', scopedCount: 0 }) !== null,
  )
  t(
    '空输入防呆不误伤:暂存区没词表时 guard 只在候选=0 时报',
    guardNoTables({ tablesFound: 9, mode: 'staged', scopedCount: 0 }) === null,
  )

  // ── 消费端符号粒度(2026-09-24 补):只认"真读到这张表"的导出符号 ──────
  const modMulti = [
    "export const WORDS: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
    'const ZH_ONLY: Record<string, string> = { a: "甲", b: "乙" }',
    'export function keyOf(k: string) { return WORDS[k] }',
    'export function zhOnly(k: string) { return ZH_ONLY[k] }',
  ].join('\n')
  const scopedMulti = [...tableScopedSymbols(modMulti, 'WORDS')].sort()
  t('收窄:读表的导出符号留下、读另一张中文字面量表的不留', scopedMulti.join(',') === 'WORDS,keyOf')
  t(
    '反例(判据非恒真):把 zhOnly 改成也读这张表 → 它必须进触表面',
    [...tableScopedSymbols(modMulti.replace('ZH_ONLY[k]', 'WORDS[k]'), 'WORDS')]
      .sort()
      .join(',') === 'WORDS,keyOf,zhOnly',
  )
  t(
    '兜底①:符号没有自己的顶层声明块(re-export 形态)⇒ 退回全量,切分失效不得变绿',
    (() => {
      const viaReexport = ['export { nope } from "./other"', 'export const T = 1'].join('\n')
      return [...tableScopedSymbols(viaReexport, 'nope')].sort().join(',') === 'T,nope'
    })(),
  )
  t(
    '传递闭包:导出符号经**私有** helper 间接读表,仍须算触表',
    (() => {
      const viaPrivateHelper = [
        "const PRIV: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
        'function pick(k: string) { return PRIV[k] }',
        'export function unrelated() { return pick("a") }',
      ].join('\n')
      return [...tableScopedSymbols(viaPrivateHelper, 'PRIV')].join(',') === 'unrelated'
    })(),
  )
  t(
    '兜底②:无任何导出符号触表(收窄为空)⇒ 退回全量,不得判成"没有消费端"',
    (() => {
      const noExportReader = [
        "const PRIV: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
        'function pick(k: string) { return PRIV[k] }',
        'export function noop() { return 1 }',
      ].join('\n')
      return [...tableScopedSymbols(noExportReader, 'PRIV')].join(',') === 'noop'
    })(),
  )
  t(
    '别名:`export { 内名 as 外名 }` 时消费端写的是外名,判据须按外名收',
    [...tableScopedSymbols(`${modMulti}\nexport { keyOf as pickKey }`, 'WORDS')].includes(
      'pickKey',
    ),
  )
  // 真仓 A/B:同一份盘、只换符号面,证明收窄只影响该收的那一张
  t(
    '真仓:permission-tier 的真 accessor 不被收窄掉(收窄过窄即伪绿)',
    [
      ...tableScopedSymbols(
        sourceFile('packages/shared/src/chat/permission-tier.ts'),
        'PERMISSION_TIER_WORD_KEYS',
      ),
    ].includes('permissionTierWordKeys'),
  )
  t(
    '真仓 A/B:error-messages 用全量符号面算出消费端、用收窄面算出零消费端',
    (() => {
      const EM = 'packages/shared/src/utils/error-messages.ts'
      const importers = buildReverseIndex(listSourceFiles(), buildPackageMap())
      const full = exportedSymbols(sourceFile(EM))
      const narrow = tableScopedSymbols(sourceFile(EM), 'ERROR_CODE_TO_I18N_KEY')
      return (
        consumerEnds({ file: EM }, importers, full).includes('mobile-rn') &&
        consumerEnds({ file: EM }, importers, narrow).length === 0 &&
        !narrow.has('toUserFriendlyMessage') &&
        narrow.has('resolveErrorMessage')
      )
    })(),
  )

  // 真仓锚点:走权威入口 run()(全量),不拼内部件
  const live = run({ quiet: true })
  const tier = (live?.consumers ?? []).find((c) => c.table.includes('permission-tier.ts'))
  t('真仓:PERMISSION_TIER_WORD_KEYS 被认定且键数=10', Boolean(tier) && tier.keys === 10)
  t('真仓:词表消费端只认已登记端', Boolean(tier) && tier.ends.every((e) => END_DIRS.includes(e)))
  t(
    '真仓:候选词表不为 0(全量入口自带防呆)',
    (live?.tablesFound ?? 0) > 0 && (live?.checkedTables ?? 0) > 0,
  )
  const specCase = resolveSpecifier(
    '@ihui/shared/chat',
    'apps/miniapp-taro/src/x.ts',
    buildPackageMap(),
  )
  t(
    'import 解析:@ihui/shared/chat → packages/shared/src/chat/index.ts',
    specCase === 'packages/shared/src/chat/index.ts',
  )
  t(
    'import 解析:第三方包说明符返回 null(不猜路径)',
    resolveSpecifier('react', 'apps/web/src/x.ts', buildPackageMap()) === null,
  )
  t(
    'import 解析:css 资源不当模块',
    resolveSpecifier('./noop.css', 'apps/web/src/x.ts', buildPackageMap()) === null,
  )
  // 真数据注入:真表 + 真语料视图,人为抽掉一个语言的一个键 → W3 必点名
  t(
    '真表注入:从真语料删掉 permissionTier 的一个 ko 键 → W3 判红并点名 键/表/语言',
    (() => {
      const realTier = discoverWordTables([
        {
          rel: 'packages/shared/src/chat/permission-tier.ts',
          text: sourceFile('packages/shared/src/chat/permission-tier.ts'),
        },
      ]).find((x) => x.name === 'PERMISSION_TIER_WORD_KEYS')
      if (!realTier) return false
      const views = buildMergedViews()
      const ko = new Map(views['web/ko'])
      ko.delete(realTier.keys[0])
      const r = evaluateWordTables({
        tables: [{ ...realTier, consumerEnds: ['web'], dependentEnds: [] }],
        corpusLeaves: corpusLeafSet(),
        views: { ...views, 'web/ko': ko },
        taro: null,
        isSharedTable: () => false,
      })
      return (
        r.failures.length === 1 &&
        r.failures[0].rule === 'W3' &&
        r.failures[0].key === realTier.keys[0] &&
        r.failures[0].where === 'web/ko'
      )
    })(),
  )
  t(
    '注入验证:值是键名本身(静默回显)也判红',
    (() => {
      const echo = new Map([...corpus].map((k) => [k, k]))
      const r = evaluateWordTables({
        tables: pick('TIER_KEYS', { consumerEnds: ['web'] }),
        corpusLeaves: corpus,
        views: Object.fromEntries(LANGS.map((l) => [`web/${l}`, echo])),
        taro: null,
        isSharedTable: () => false,
      })
      return r.failures.length === 4 * 5 && r.failures.every((f) => f.rule === 'W3')
    })(),
  )

  // ── W6 散落取词(2026-09-25 补):形状 / 后缀吸收 / 棘轮 / 真实事故文件 ──
  // 宇宙按 buildKeyUniverse 同一套后缀构造铺(自检不得另立第二份真相)
  const w6universe = new Set(
    ['footer.platforms.n8n', 'search.title', 'history.title'].flatMap((p) => keySuffixes(p)),
  )
  const w6src = [
    'const MENU_ITEMS: HomeMenuItem[] = [',
    "  { key: 'Search', labelKey: 'menu.search', icon: Search },",
    "  { key: 'History', labelKey: 'menu.history', icon: History },",
    "  { key: 'Ok', labelKey: 'search.title', icon: Ok },",
    "  { key: 'Rel', nameKey: 'platforms.n8n', icon: Rel },",
    "  { key: 'Bare', key: 'Search', label: 'title' },",
    "  { id: 'q', queryKey: 'not.i18n.at.all' },",
    ']',
    "const s = t('search.title')",
    "const u = t('brand.new')",
    'const v = t(`search.title`)',
    'const w = t(`search.${dyn}.title`)',
    "// 注释里举例:labelKey: 'never.exists.line', descKey: 'never.exists.two'",
    "/* 块注释里的示例:labelKey: 'never.exists.block' */",
  ].join('\n')
  const w6bad = evaluateScatteredKeys({
    file: 'apps/demo/src/x.tsx',
    text: w6src,
    universe: w6universe,
  })
  const w6keys = new Set(w6bad.map((b) => b.key))
  t(
    'W6 阳性对照:数组里 labelKey/menu.* 从未入库 → 必被抓并点名键',
    w6keys.has('menu.search') && w6keys.has('menu.history'),
  )
  t(
    'W6 阳性对照:t() 直调的未入库键也必被抓',
    w6keys.has('brand.new') && w6bad.every((b) => b.line > 0),
  )
  t(
    'W6 反例(判据非恒红):已入库的绝对键 + 模板插值动态键一律放过',
    !w6keys.has('search.title') &&
      !w6keys.has('title') &&
      ![...w6keys].some((k) => k.includes('dyn')),
  )
  t(
    'W6 反例:命名空间相对取词按后缀吸收(platforms.n8n 只在 footer.* 下有)',
    !w6keys.has('platforms.n8n'),
  )
  t(
    'W6 反例:裸 key/label(不含点)与 queryKey 这类非取词属性不判',
    !w6keys.has('not.i18n.at.all') && ![...w6keys].some((k) => k === 'Search' || k === 'title'),
  )
  t(
    'W6 反例:注释里的示例键不得被扫到(stripComments 先生效)',
    ![...w6keys].some((k) => k.startsWith('never.exists')),
  )
  t(
    'W6 行号钉在字面量所在行(报错指得到真位置)',
    w6bad.find((b) => b.key === 'menu.search')?.line === 2,
  )
  // 棘轮:锚点 = 该文件 HEAD 自身违规数
  const headCounts = new Map([
    ['a.tsx', 3],
    ['b.tsx', 1],
  ])
  const mk = (file, n) => [
    file,
    Array.from({ length: n }, (_, i) => ({ key: `k${i}`, line: i + 1 })),
  ]
  const ratchet = splitScatteredRatchet(
    new Map([mk('a.tsx', 3), mk('b.tsx', 2), mk('new.tsx', 1)]),
    (f) => headCounts.get(f) ?? 0,
  )
  t(
    'W6 棘轮:与 HEAD 齐平的存量不判红、只拦"加回来的"(存量 37 文件不得变恒红)',
    ratchet.fresh.length === 2 &&
      ratchet.fresh.every((x) => x.file === 'b.tsx' || x.file === 'new.tsx') &&
      ratchet.tolerated === 3,
  )
  // 真仓:同一份 HomeScreen 文本,现状必绿、把当年那 9 个假键塞回去必红
  t(
    'W6 真仓对照:HomeScreen 现状 HEAD 零违规,而当年那批 menu.* 塞回去即点名',
    (() => {
      const HOME = 'apps/mobile-rn/src/screens/HomeScreen.tsx'
      const reader = makeFaceReader('head')
      const uni = buildKeyUniverse(reader)
      const real = sourceFile(HOME, reader)
      const clean = evaluateScatteredKeys({ file: HOME, text: real, universe: uni })
      const broken = evaluateScatteredKeys({
        file: HOME,
        text: real.replace(/labelKey: '[^']*'/, "labelKey: 'menu.search'"),
        universe: uni,
      })
      return (
        clean.length === 0 &&
        broken.length === 1 &&
        broken[0].key === 'menu.search' &&
        broken[0].file === HOME
      )
    })(),
  )
  t(
    'W6 后缀宇宙确实铺在真语料上(空宇宙/漏面即红)',
    (() => {
      const uni = buildKeyUniverse(makeFaceReader('head'))
      return uni.size > 1000 && !uni.has('menu.search') && uni.has('permissionTier.mode.plan.title')
    })(),
  )
  // 判定面:面旗互斥、未知面、取不到 —— 一律「无法判定」而非绿/红
  t(
    '判定面:未知面名与取不到的路径都抛 UndeterminedError(不冒红也不记绿)',
    (() => {
      let a = false
      let b = false
      try {
        makeFaceReader('nonsense')
      } catch (e) {
        a = e instanceof UndeterminedError
      }
      try {
        makeFaceReader('head').read('packages/does-not-exist/nope.ts')
      } catch (e) {
        b = e instanceof UndeterminedError
      }
      return a && b
    })(),
  )
  t(
    '判定面:全量入口按 HEAD blob 判定(报告里必须自报口径)',
    (() => {
      const r = run({ quiet: true })
      return Boolean(r?.face) && /HEAD/.test(r.face) && (r.scattered?.filesScanned ?? 0) > 0
    })(),
  )

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

export const __test__ = {
  stripComments,
  scanObjectLiterals,
  discoverWordTables,
  collectLeaves,
  buildMergedViews,
  corpusLeafSet,
  resolvable,
  resolveSpecifier,
  importSpecifiers,
  exportedSymbols,
  tableScopedSymbols,
  tableReachableNames,
  buildReverseIndex,
  reverseClosure,
  consumerEnds,
  buildPackageMap,
  buildDirectDeps,
  endsDependingOnPackage,
  listSourceFiles,
  taroBundleViews,
  evaluateWordTables,
  guardNoTables,
  run,
  // W6 与本门生命线(判定面)
  scanScatteredKeys,
  keySuffixes,
  buildKeyUniverse,
  evaluateScatteredKeys,
  splitScatteredRatchet,
  makeFaceReader,
  setActive,
  active,
  sourceFile,
  UndeterminedError,
  DOTTED_KEY_BARE_RE,
  NON_I18N_KEY_PROPS,
  CORPUS_SOURCES,
  LANGS,
  END_DIRS,
  DOTTED_KEY_RE,
  SCAN_ROOTS,
  TARO_GEN,
  TARO_GEN_SCRIPT,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  // 两个面旗同时给 = 调用方自己没说清按哪个面判 ⇒ 判死,不猜
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.error('❌ --staged 与 --worktree 互斥(判定面必须唯一),按无法判定退出')
    process.exit(2)
  }
  try {
    const r = run({
      staged: argv.includes('--staged'),
      json: argv.includes('--json'),
      worktree: argv.includes('--worktree'),
    })
    process.exit(r.ok ? 0 : 1)
  } catch (e) {
    // 抛到这里 = 取材取不到 / 清单为空 / 判据跑不下去 ⇒ 「无法判定」(exit 2),
    // 与「判定为违规」(exit 1)严格分开:前者不得冒红、更不得记绿。
    console.error(
      `❌ 无法判定(${e instanceof UndeterminedError ? '判定面取材失败' : '判据未能运行'}):${e?.message ?? e}`,
    )
    if (!(e instanceof UndeterminedError)) console.error(e?.stack ?? '')
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
