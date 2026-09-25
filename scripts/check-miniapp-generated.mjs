#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-generated.mjs —— 小程序端「源 ↔ 派生产物」存续性对账(守门,blocking 语义)
 *
 * 立因(2026-09-25):miniapp 端有四件派生产物生成器,此前状态是「只有人手动跑、既无构建入口也无守门」:
 *   ① apps/miniapp-taro/scripts/gen-i18n-compressed.mjs   → src/i18n/generated/remote-locales.gen.ts
 *      (在 build/build:weapp 链里,但 **不在 dev 链** ⇒ 开发时离线语言包常年是旧的)
 *   ② scripts/gen-taro-lucide-icons.mjs                   → src/static/images/icons/*.svg   (纯人工,无入口)
 *   ③ apps/miniapp-taro/scripts/gen-line-icons.mjs        → src/components/LineIcon/icons.ts(纯人工,无入口)
 *   ④ apps/miniapp-taro/scripts/gen-tabbar-icons.mjs      → src/assets/tabbar/*.png         (纯人工,无入口)
 * 本仓反复出现「造好没装车」这一型(守门 64/70/81 皆同族)。本门负责「产物与源是否还对得上」,
 * 与那几道门一样:**判据必须在有人跑它时才成立**,所以它同时被 dev 链消费(见 dev-weapp.mjs)。
 *
 * 四条判据(方向即任务书的两句话):
 *   G1 漏生成 = 源里有但产物里没有(**判红**):
 *        B1 i18n:某 remote 语言整块不在离线包里
 *        B2 i18n:源 JSON 的叶子键在包里找不到(= 包过期,端上会回落远端取词或直接缺词)
 *        R1 资源:源码里写死的资源字面量在面里查无此文件(= 运行时 404/空白,<Image> 不报错)
 *        L1 注册表:icons/ 下有 .svg 而 icons.ts 没有对应键(= 生成器没跑)
 *   G2 孤儿/死资源 = 产物里有但源里已无(**默认只报数,--strict 判红**;删文件属 §7 删除安全,须人工确认):
 *        B3 i18n:包里的叶子键在源 JSON 已不存在
 *        R2 资源:产物目录(icons/ 与 assets/tabbar/)里没有任何引用指向的文件
 *   G3 不可复现(默认只报数,**永不判红**):icons.ts 有键而 icons/ 无同名 .svg。
 *        这是既有事实 —— 图标源在「图片全量外置 CDN」那轮被清空(现 1 个 svg vs 78 键),
 *        gen-line-icons.mjs 自己的 50% 拒绝闸就是为它而写。判红等于造一道恒红门,
 *        而恒红门的唯一结局是逼人 --no-verify、连带废掉全部守门(§12e)。
 *   G4 动态路径:模板字符串拼出来的资源路径结构上判不了,**如实计数**(unreproducible 之外再报 undetermined),
 *        绝不静默成「看起来全绿」。
 *
 * 口径(与守门 70/77/83/98/101 一致,这一层由 scripts/lib/face-reader.mjs 单点持有):
 *   全量判 **HEAD blob** / `--staged` 判**索引 blob** / `--worktree` 仅作人工与 dev 链的逃生舱。
 *   之所以不判磁盘:共享工作树常年滞后 HEAD,按磁盘算会在恒红/假绿之间来回跳。
 *   取不到输入 ⇒ **exit 2「无法判定」**,既不冒红也不记绿。
 *
 * 用法:
 *   node scripts/check-miniapp-generated.mjs              # 全量(HEAD),exit 0/1/2
 *   node scripts/check-miniapp-generated.mjs --staged     # 索引面,pre-commit 用
 *   node scripts/check-miniapp-generated.mjs --worktree   # 磁盘面(dev 链自查用,不作提交门禁)
 *   node scripts/check-miniapp-generated.mjs --group i18n # 只算离线包(dev 冷启的快速路径)
 *   node scripts/check-miniapp-generated.mjs --json       # 机器可读结论(dev 链消费,单一实现)
 *   node scripts/check-miniapp-generated.mjs --strict     # 把 G2 孤儿也判红
 *   node scripts/check-miniapp-generated.mjs --self-test  # 逻辑自检(成对正反例,零副作用)
 *   node scripts/check-miniapp-generated.mjs --root <dir>  # 显式指定判定根(镜像测试夹具用;生产不带)
 *
 * 紧急跳过(接线后):HUSKY_SKIP_MINIAPP_GENERATED=1 git commit ...
 * 镜像测试:node --test scripts/tests/check-miniapp-generated.test.mjs
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACES,
  FACE_LABEL,
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ─────────────────────────── 被对账的四件产物(路径常量) ─────────────────────────── */
const APP = 'apps/miniapp-taro'
const I18N_BUNDLE = `${APP}/src/i18n/generated/remote-locales.gen.ts`
const ICON_REGISTRY = `${APP}/src/components/LineIcon/icons.ts`
const ICON_ASSET_DIR = `${APP}/src/static/images/icons`
const TABBAR_ASSET_DIR = `${APP}/src/assets/tabbar`
const TABBAR_GENERATOR = `${APP}/scripts/gen-tabbar-icons.mjs`
const MESSAGE_ROOT = 'packages/i18n/messages'
const REMOTE_LOCALES = ['en', 'ja', 'ko', 'zh-TW']

/** 参与引用扫描的源文件后缀(资源字面量可能出现在这些地方) */
const SCAN_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|html|wxml)$/
/** 磁盘面枚举时跳过的目录(构建产物与依赖树里没有「源」可判) */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-alipay', '.swc', '.turbo', '.git', 'coverage'])
/** 产物目录:孤儿判据(G2-R2)只看这两个生成器自己的落点,别碰别人的素材库 */
const ARTIFACT_DIRS = [ICON_ASSET_DIR, TABBAR_ASSET_DIR]

/* ─────────────────────────── 取材面(统一走 lib/face-reader) ─────────────────────────── */

/**
 * 本门的取材层:在 lib/face-reader 的原语上只加本门需要的形状 —— `list(prefixes)` 枚举、
 * `has(rel)` 存在性、`prefetch`+`read` 内容。三件必须来自**同一个面**:
 * 若枚举读磁盘而内容读 git,就会产出自洽但基准错位的假绿(守门 101 同型教训)。
 */
function makeReader(face, root) {
  if (!FACES.includes(face)) throw new Undetermined(`未知判定面 "${face}"`)
  const label = FACE_LABEL[face]

  if (face === 'worktree') {
    return {
      face,
      label,
      list(prefixes) {
        const out = []
        for (const p of prefixes) {
          // 前缀必须剥掉尾斜杠:walkDir 自己会再补一个 '/',于是 'apps/x/' 下的文件被拼成
          // 'apps/x//src/...'。本门第一轮就在磁盘面上被它把"孤儿扫描"静默清零
          // (artifactRels 全部 startsWith 失败)—— 判据失效不会报错,只会报绿。
          const norm = p.replace(/\/+$/, '') || '.'
          const base = norm === '.' ? root : join(root, norm)
          if (!existsSync(base)) continue
          walkDir(base, norm, out)
        }
        return out.sort()
      },
      has(rel) {
        return existsSync(join(root, rel))
      },
      prefetch() {},
      read(rel) {
        return readWorktreeFile(root, rel)
      },
    }
  }

  const refPrefix = face === 'staged' ? ':' : 'HEAD:'
  let tracked = null
  let batch = null
  function loadTracked() {
    if (tracked) return tracked
    if (face === 'head') {
      // HEAD 面必须显式失败,绝不退化成「扫到 0 个路径所以绿」
      gitRaw(['rev-parse', '--verify', 'HEAD'], root)
    }
    const raw =
      face === 'staged'
        ? gitRaw(['ls-files', '--full-name', '-z'], root)
        : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root)
    tracked = new Set(raw.split('\0').filter(Boolean))
    if (tracked.size === 0) throw new Undetermined(`${label} 在 ${root} 下列出 0 个路径,无法判定`)
    return tracked
  }
  return {
    face,
    label,
    list(prefixes) {
      return [...loadTracked()].filter((p) => prefixes.some((x) => p.startsWith(x))).sort()
    },
    has(rel) {
      return loadTracked().has(rel)
    },
    /** 一次 cat-file --batch 读完一批(逐文件派生 git 在真仓是上千次进程创建,属禁止形态) */
    prefetch(rels) {
      if (batch) return
      const uniq = [...new Set(rels)]
      batch = catBatch(
        root,
        uniq.map((r) => `${refPrefix}${r}`),
      )
      batch.__keys = new Set(uniq)
    },
    read(rel) {
      if (!batch) throw new Undetermined(`${label} 未 prefetch 就 read(${rel}) —— 取材层被绕开了`)
      if (!batch.__keys.has(rel)) {
        // 允许读清单外的单个文件(语言包等由调用方另列),取不到即 null
        const v = batch.get(`${refPrefix}${rel}`)
        return v === undefined ? null : v
      }
      const v = batch.get(`${refPrefix}${rel}`)
      return v === undefined ? null : v
    },
  }
}

/**
 * 磁盘递归:先判重解析点再下钻 —— §26 记过事故,PowerShell/递归枚举**会穿过 junction**,
 * 于是「扫本仓产物」会顺着改道链接清进 D:\DevEnv 那一侧。这里只枚举、不删,但同样不得穿透:
 * 穿透会把别人工具态里的文件误记成本仓产物(即门自己产出假红)。
 */
function walkDir(abs, relPrefix, out) {
  let entries
  try {
    entries = readdirSync(abs, { withFileTypes: true })
  } catch (e) {
    throw new Undetermined(`磁盘面列目录 ${relPrefix} 失败: ${e.message}`)
  }
  for (const c of entries) {
    if (SKIP_DIRS.has(c.name)) continue
    const childAbs = join(abs, c.name)
    const childRel = `${relPrefix}/${c.name}`
    if (c.isSymbolicLink()) continue // junction/软链:不穿透、不收录
    if (c.isDirectory()) walkDir(childAbs, childRel, out)
    else if (c.isFile()) out.push(childRel)
  }
}

/* ─────────────────────────── i18n 离线包 ─────────────────────────── */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * 与 packages/i18n/src/loader.ts:80 的 mergeMessages 同语义(该文件即单一真相源;
 * apps/miniapp-taro/scripts/gen-i18n-compressed.mjs:30 是本函数的另一份镜像,本门是第三份)。
 * 刻意在此写明三处而非默默复制 —— 改语义必须三处同批,否则「产物 ⊇ 源」这条判据会开始说谎。
 */
function mergeMessages(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override)) {
    const val = override[key]
    const baseVal = result[key]
    if (isPlainObject(val) && isPlainObject(baseVal)) result[key] = mergeMessages(baseVal, val)
    else if (val !== undefined) result[key] = val
  }
  return result
}

/** 叶子键 → 值(点分路径)。生成器写包用的就是这个形状,运行时 JSON.parse 后同形。 */
function leafMap(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (isPlainObject(v)) leafMap(v, p, out)
    else out[p] = v
  }
  return out
}

/**
 * 叶子取值比较。
 * ⚠️ 不能直接 `a !== b`:数组与对象按引用比,源里 `"labels": ["a","b"]` 与包里同内容数组
 * **永远不相等**,于是本门会在一个完全健康的仓上恒红(建门第一轮就踩到了:4 语言各报 14 处
 * "取值不一致",全是数组键)。判据自己造的假红比漏判更糟 —— 它逼人 --no-verify。
 */
function sameLeafValue(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== typeof b) return false
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return false
}

/**
 * 从产物里解出每个 remote 语言的叶子键值。
 *
 * 两种"没有内容"必须分开,否则结论会说谎:
 *   · 这一行**根本不存在** ⇒ 该语言整块缺失 = 业务结论(判红 B1,可修:跑一次生成器)
 *   · 行在而**载荷解不开** ⇒ 格式/编码坏了 ⇒ **抛 Undetermined**(exit 2)
 * 把后者报成"少了一种语言",就是让一个环境/格式问题冒充业务结论(守门 97 记过同型:
 * readFileSync 漏 import 被外层 catch 吞成"取不到内容")。
 */
function decodeBundle(bundleText) {
  const out = new Map()
  for (const locale of REMOTE_LOCALES) {
    // 键行两种引法都要认:en: '...' 与 'zh-TW': '...' (生成器对带连字符的键必加引号)。
    // 行首用 [ \t] 而不是 \s —— \s 含换行,配 m 标志会让正则跨过上一行去匹配,
    // 于是"这一行不存在"被误判成"存在"(语言被当成解开了),属门自己造出的假绿。
    const lineRe = new RegExp(`^[ \\t]*['"]?${locale}['"]?[ \\t]*:[ \\t]*(.*)$`, 'm')
    const line = lineRe.exec(bundleText)
    if (!line) {
      out.set(locale, null)
      continue
    }
    // 载荷先按引号取整段;取不到引号也照样交给下面的 base64 判据,坏载荷必须抛而非记空
    const body = line[1].trim()
    const quoted = /^['"`]([^'"`]*)['"`]/.exec(body)
    const payload = (quoted ? quoted[1] : body).trim()
    let leaves
    try {
      if (!/^[A-Za-z0-9+/=]+$/.test(payload)) throw new Error('载荷不是 base64 字符集')
      const json = Buffer.from(gunzipSync(Buffer.from(payload, 'base64'))).toString('utf8')
      leaves = leafMap(JSON.parse(json))
    } catch (e) {
      throw new Undetermined(
        `离线包 ${locale} 的载荷解不开(base64/gzip/JSON 任一环),无法判定:${String(e.message).split('\n')[0]}`,
      )
    }
    out.set(locale, leaves)
  }
  return out
}

/** 源侧:shared ⊕ miniapp-taro 两份 JSON 合并后的叶子键值 */
function readSourceLeaves(reader, locale) {
  const sharedRel = `${MESSAGE_ROOT}/shared/${locale}.json`
  const miniRel = `${MESSAGE_ROOT}/miniapp-taro/${locale}.json`
  const read = (rel) => {
    if (!reader.has(rel)) return null
    const t = reader.read(rel)
    if (t === null) throw new Undetermined(`${reader.label} 取不到 ${rel}`)
    try {
      return JSON.parse(t)
    } catch (e) {
      throw new Undetermined(`${rel} 不是合法 JSON,无法判定: ${String(e.message).split('\n')[0]}`)
    }
  }
  const shared = read(sharedRel)
  const mini = read(miniRel)
  if (shared === null && mini === null) return null // 两份源都不存在 ⇒ 本门不管这一语言
  return leafMap(mergeMessages(shared ?? {}, mini ?? {}))
}

/* ─────────────────────────── 资源引用 ↔ 文件存在 ─────────────────────────── */

/**
 * 资源字面量:必须是「以 src 下的根目录起头 + 已知素材后缀 + 整段是静态字面量」。
 * 带 `${` 的一律不判(G4),URL 不判,只认字面路径 —— 宁漏不误报。
 */
const ASSET_LIT_RE =
  /['"`](\/?(?:static|assets|pkg-[a-z]+|pages)\/[\w.\-/]*\.(?:png|jpe?g|gif|webp|svg))['"`]/g
const DYN_PATH_RE = /['"`][^'"`\n]*\$\{[^'"`\n]*\.(?:png|jpe?g|gif|webp|svg)/g

/** 把端内相对路径映射到仓库相对路径:小程序里 `/static/x` 与 `assets/y` 都相对 src/ */
function assetRefToRepoRel(literal) {
  const bare = literal.replace(/^\//, '')
  return `${APP}/src/${bare}`
}

function collectAssetRefs(reader, sourceFiles) {
  /** @type {Map<string,Set<string>>} repoRel -> 引用它的源文件 */
  const refs = new Map()
  let dynamic = 0
  for (const rel of sourceFiles) {
    const text = reader.read(rel)
    if (text === null) continue // 面上没有该文件(枚举与内容同面时不会发生,防御性放过并计入 undetermined)
    for (const m of text.matchAll(ASSET_LIT_RE)) {
      const target = assetRefToRepoRel(m[1])
      if (!refs.has(target)) refs.set(target, new Set())
      refs.get(target).add(rel)
    }
    dynamic += countMatches(text, DYN_PATH_RE)
  }
  return { refs, dynamic }
}

function countMatches(text, re) {
  return Array.from(text.matchAll(re)).length
}

/* ─────────────────────────── LineIcon 注册表 ─────────────────────────── */

/** icons.ts 的键集合。形状与生成器一致:对象字面量里的 `"name": "<svg...>"`。 */
function registryKeys(text) {
  const out = new Set()
  for (const m of text.matchAll(/^\s{2}(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:/gm)) {
    const k = m[1] ?? m[2] ?? m[3]
    if (k) out.add(k)
  }
  return out
}

/** gen-tabbar-icons.mjs 自己声明的输出表(键名即 tab-<name>),用于「生成器说有、产物没有」 */
function generatorTabbarNames(text) {
  const block = /const ICONS\s*=\s*\{([\s\S]*?)\n\}/m.exec(text)
  if (!block) throw new Undetermined(`${TABBAR_GENERATOR} 里解析不到 ICONS 表,无法判定生成器输出清单`)
  const names = [...block[1].matchAll(/^\s*([A-Za-z0-9_-]+)\s*:/gm)].map((m) => m[1])
  if (names.length === 0) throw new Undetermined(`${TABBAR_GENERATOR} 的 ICONS 表为空,无法判定`)
  return names
}

/* ─────────────────────────── 主判定 ─────────────────────────── */

/**
 * @param {{face:string, root:string, strict:boolean, group:string|null}} opts
 * @returns {{findings:Array, undetermined:Object, counts:Object}}
 */
function runCheck({ face, root, strict, group }) {
  const reader = makeReader(face, root)
  /** @type {Array<{code:string,dir:'missing'|'orphan'|'unreproducible',blocking:boolean,file:string,detail:string}>} */
  const findings = []
  const undetermined = { dynamicAssetPaths: 0, unreadableSourceFiles: 0 }
  const counts = { bundleLocales: 0, sourceFilesScanned: 0, artifactFiles: 0, registryKeys: 0 }

  const push = (code, dir, blocking, file, detail) => findings.push({ code, dir, blocking, file, detail })

  /* ── 先枚举 + 一次预取,再判据 ──
   * 枚举与内容必须来自**同一个面**、且在**同一轮**里读:清单读磁盘而内容读 git 会产出一把
   * 自洽但基准错位的尺子(守门 101/91 同型)。
   * --group i18n 刻意不读那 500+ 个源文件:dev 冷启只需要"包是否过期"这一格,读全盘会把
   * 一次便宜的对账变成一次全端扫描。 */
  const allFiles = reader.list([`${APP}/`])
  if (allFiles.length === 0) throw new Undetermined(`${reader.label} 在 ${APP}/ 下列出 0 个文件,无法判定`)
  const needSourceRead = !group || group === 'assets' || group === 'icons'
  const sourceFiles = needSourceRead
    ? allFiles.filter((p) => {
        if (!SCAN_EXT_RE.test(p)) return false
        if (p.includes('/dist/')) return false
        // 产物自身不参与「谁引用了资源」的判定:它们是结果,不是引用方
        return p !== I18N_BUNDLE && p !== ICON_REGISTRY
      })
    : []
  const artifactRels = needSourceRead
    ? allFiles.filter((p) => ARTIFACT_DIRS.some((d) => p.startsWith(`${d}/`)))
    : []
  const localeRels = REMOTE_LOCALES.flatMap((l) => [
    `${MESSAGE_ROOT}/shared/${l}.json`,
    `${MESSAGE_ROOT}/miniapp-taro/${l}.json`,
  ])
  const singletonRels = [...new Set([I18N_BUNDLE, ICON_REGISTRY, TABBAR_GENERATOR])].filter((p) =>
    reader.has(p),
  )
  reader.prefetch([
    ...localeRels,
    ...sourceFiles,
    ...artifactRels,
    ...new Set(singletonRels.filter((p) => reader.has(p))),
  ])
  counts.sourceFilesScanned = sourceFiles.length

  /* —— G1/G2 i18n 离线包 —— */
  if (!group || group === 'i18n') {
    if (!reader.has(I18N_BUNDLE)) {
      throw new Undetermined(`${reader.label} 取不到产物 ${I18N_BUNDLE} —— 离线包根本不在,无法判定`)
    }
    const bundle = decodeBundle(reader.read(I18N_BUNDLE))
    for (const locale of REMOTE_LOCALES) {
      const src = readSourceLeaves(reader, locale)
      const art = bundle.get(locale)
      if (src === null) continue
      counts.bundleLocales += 1
      if (art === null) {
        push('B1', 'missing', true, I18N_BUNDLE, `${locale}:源里有 ${Object.keys(src).length} 个键,离线包整块没有该语言`)
        continue
      }
      const missing = Object.keys(src).filter((k) => !(k in art))
      const orphans = Object.keys(art).filter((k) => !(k in src))
      const wrongValue = Object.keys(src).filter((k) => k in art && !sameLeafValue(src[k], art[k]))
      if (missing.length) {
        push('B2', 'missing', true, I18N_BUNDLE, `${locale}:包比源少 ${missing.length} 个键,如 ${missing.slice(0, 3).join(', ')}`)
      }
      if (wrongValue.length) {
        push('B2', 'missing', true, I18N_BUNDLE, `${locale}:包与源同键但取值不一致 ${wrongValue.length} 个,如 ${wrongValue.slice(0, 3).join(', ')}`)
      }
      if (orphans.length) {
        push('B3', 'orphan', strict, I18N_BUNDLE, `${locale}:包里有 ${orphans.length} 个源已无的键,如 ${orphans.slice(0, 3).join(', ')}`)
      }
    }
  }

  /* —— G1-R1 / G2-R2 / G4 资源 —— */
  if (!group || group === 'assets') {
    const { refs, dynamic } = collectAssetRefs(reader, sourceFiles)
    undetermined.dynamicAssetPaths = dynamic
    for (const [target, from] of refs) {
      if (!reader.has(target)) {
        push('R1', 'missing', true, target, `被 ${[...from].slice(0, 3).join(', ')} 引用,面上查无此文件`)
      }
    }
    counts.artifactFiles = artifactRels.length
    for (const rel of artifactRels) {
      if (!refs.has(rel)) {
        push('R2', 'orphan', strict, rel, `${ARTIFACT_DIRS.some((d) => rel.startsWith(`${d}/`)) ? '产物目录' : '产物'}里的文件没有任何静态引用`)
      }
    }
  }

  /* —— G1-L1 / G3 LineIcon 注册表 —— */
  if (!group || group === 'icons') {
    const svgs = allFiles.filter((p) => p.startsWith(`${ICON_ASSET_DIR}/`) && p.endsWith('.svg'))
    if (!reader.has(ICON_REGISTRY)) {
      throw new Undetermined(`${reader.label} 取不到 ${ICON_REGISTRY},无法判定注册表`)
    }
    const keys = registryKeys(reader.read(ICON_REGISTRY))
    counts.registryKeys = keys.size
    for (const svg of svgs) {
      const name = svg.slice(ICON_ASSET_DIR.length + 1, -'.svg'.length)
      if (!keys.has(name)) push('L1', 'missing', true, svg, `icons/ 下有该源,但 ${ICON_REGISTRY} 没有对应键`)
    }
    const svgNames = new Set(svgs.map((s) => s.slice(ICON_ASSET_DIR.length + 1, -'.svg'.length)))
    const unreproducible = [...keys].filter((k) => !svgNames.has(k))
    if (unreproducible.length) {
      push(
        'G3',
        'unreproducible',
        false,
        ICON_REGISTRY,
        `${unreproducible.length}/${keys.size} 个键在 ${ICON_ASSET_DIR}/ 没有同名 .svg —— 图标源已在「图片全量外置 CDN」那轮清空,` +
          `gen-line-icons.mjs 的 50% 拒绝闸即为此而写。**永不判红**(判红=恒红=逼人 --no-verify)`,
      )
    }
  }

  /* —— G1 生成器声明的输出表 ⊂ 产物 —— */
  if (!group || group === 'tabbar') {
    if (reader.has(TABBAR_GENERATOR)) {
      const names = generatorTabbarNames(reader.read(TABBAR_GENERATOR))
      for (const name of names) {
        for (const suffix of ['', '-active']) {
          const rel = `${TABBAR_ASSET_DIR}/tab-${name}${suffix}.png`
          if (!reader.has(rel)) push('T1', 'missing', true, rel, `gen-tabbar-icons.mjs 声明要产出它,面上却没有`)
        }
      }
    }
  }

  return { findings, undetermined, counts }
}

/* ─────────────────────────── 输出 ─────────────────────────── */

function formatReport(result, face, opts) {
  const red = result.findings.filter((f) => f.blocking)
  const reported = result.findings.filter((f) => !f.blocking)
  const lines = []
  lines.push(`[miniapp-generated] 面=${face}(${FACE_LABEL[face]}) 扫描源文件 ${result.counts.sourceFilesScanned} 个 / 产物文件 ${result.counts.artifactFiles} 个 / 注册表键 ${result.counts.registryKeys} 个 / 语言 ${result.counts.bundleLocales} 种`)
  if (red.length) {
    lines.push(`  ❌ 漏生成/缺资源 ${red.length} 处:`)
    for (const f of red) lines.push(`     [${f.code}] ${f.file} —— ${f.detail}`)
  } else {
    lines.push('  ✅ 未发现漏生成')
  }
  if (reported.length) {
    lines.push(`  ℹ️ 如实报数(不计失败)${reported.length} 组:`)
    for (const f of reported) lines.push(`     [${f.code}] ${f.file} —— ${f.detail}`)
  }
  lines.push(
    `  ◽ 判不了但如实计数:动态资源路径 ${result.undetermined.dynamicAssetPaths} 处` +
      (result.undetermined.unreadableSourceFiles ? ` / 读不到的源文件 ${result.undetermined.unreadableSourceFiles} 个` : ''),
  )
  if (!opts.strict) {
    const orphan = result.findings.filter((f) => f.dir === 'orphan').length
    if (orphan) lines.push(`  ⚠️ 另有孤儿/死资源 ${orphan} 处默认不判红(删文件属 §7 删除安全,须人工确认);--strict 可改判红`)
  }
  return lines.join('\n')
}

/* ─────────────────────────── CLI ─────────────────────────── */

function parseArgv(argv) {
  const opts = {
    staged: false,
    worktree: false,
    strict: false,
    json: false,
    selfTest: false,
    group: null,
    root: DEFAULT_ROOT,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--group') opts.group = argv[++i] ?? null
    else if (a.startsWith('--group=')) opts.group = a.slice(8)
    else if (a === '--root') opts.root = resolve(argv[++i] ?? '')
    else if (a.startsWith('--root=')) opts.root = resolve(a.slice(7))
    else throw new Error(`未知参数:${a}`)
  }
  return opts
}

function main(argv) {
  const opts = parseArgv(argv)
  if (opts.selfTest) return selfTest()

  const { face, error } = selectFace({ staged: opts.staged, worktree: opts.worktree, def: 'head' })
  if (error) {
    console.error(`❌ ${error}`)
    return 2
  }
  if (opts.group && !['i18n', 'assets', 'icons', 'tabbar'].includes(opts.group)) {
    console.error(`❌ --group 只认 i18n / assets / icons / tabbar,给了 "${opts.group}"`)
    return 2
  }
  try {
    const result = runCheck({ face, root: opts.root, strict: opts.strict, group: opts.group })
    if (opts.json) {
      const red = result.findings.filter((f) => f.blocking)
      process.stdout.write(
        JSON.stringify({
          face,
          counts: result.counts,
          undetermined: result.undetermined,
          findings: result.findings,
          blocking: red,
          // dev 链只关心这一件事:离线包是否过期
          bundleStale: red.some((f) => f.code === 'B1' || f.code === 'B2'),
        }) + '\n',
      )
    } else {
      console.log(formatReport(result, face, opts))
    }
    const red = result.findings.filter((f) => f.blocking)
    return red.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定(不冒红也不记绿):${e.message}`)
      return 2
    }
    throw e
  }
}

/* ─────────────────────────── self-test ─────────────────────────── */

function selfTest() {
  const results = []
  const t = (name, fn) => {
    try {
      fn()
      results.push(`✅ ${name}`)
    } catch (e) {
      results.push(`❌ ${name} —— ${e.message}`)
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg ?? ''} 期望 ${JSON.stringify(b)},实际 ${JSON.stringify(a)}`)
  }

  t('mergeMessages:override 覆盖同名标量', () => {
    const m = mergeMessages({ a: 'x', b: { c: 1 } }, { a: 'y', b: { d: 2 } })
    eq(m.a, 'y', '标量覆盖')
    eq(m.b.c, 1, '保留')
    eq(m.b.d, 2, '新增')
  })
  t('mergeMessages:对象盖住标量 ⇒ 该路径不再是叶子(G3 型不误判为缺)', () => {
    const src = leafMap(mergeMessages({ a: { b: 'str' } }, { a: { b: { deep: 'x' } } }))
    eq('a.b' in src, false, 'a.b 应被结构性覆盖')
    eq(src['a.b.deep'], 'x', '深键存在')
  })
  t('decodeBundle:能解出注入的 base64+gzip', () => {
    const json = JSON.stringify({ hello: 'world', nest: { k: 'v' } })
    const gz = gzipSync(Buffer.from(json, 'utf8'))
    const text = `export const X = {\n  en: '${Buffer.from(gz).toString('base64')}',\n}\n`
    const m = decodeBundle(text)
    const en = m.get('en')
    eq(Object.keys(en).length, 2, '两枚叶子键')
    eq(en['nest.k'], 'v', '深键取值')
    eq(m.get('ja'), null, '缺语言应是 null 而不是空集')
  })
  t('decodeBundle:载荷在而坏了 ⇒ 抛 Undetermined,不得冒充「少了这一语言」', () => {
    let threw = null
    try {
      decodeBundle("export const X = {\n  en: '@@notbase64@@',\n}\n")
    } catch (e) {
      threw = e
    }
    eq(threw instanceof Undetermined, true, '必须抛 Undetermined')
  })
  t('decodeBundle:键行根本不存在 ⇒ 该语言记 null(= 业务结论 B1),与上一条成对', () => {
    const good = Buffer.from(gzipSync(Buffer.from(JSON.stringify({ hi: 'ha' }), 'utf8'))).toString('base64')
    const m = decodeBundle(`export const X = {\n  ja: '${good}',\n}\n`)
    eq(m.get('ja').hi, 'ha', 'ja 有合法载荷,应解出内容')
    eq(m.get('en'), null, 'en 没有键行 ⇒ null,而不是抛、也不是空对象')
  })
  t('decodeBundle:带连字符的键(生成器写 \'zh-TW\':)必须被认出来', () => {
    const good = Buffer.from(gzipSync(Buffer.from(JSON.stringify({ a: 'b' }), 'utf8'))).toString('base64')
    const m = decodeBundle(`export const X = {\n  'zh-TW': '${good}',\n}\n`)
    eq(m.get('zh-TW') ? m.get('zh-TW').a : null, 'b', "引号形态的 zh-TW 键不得被当成缺失")
  })

  t('sameLeafValue:数组/对象按内容比,不得按引用比(本门第一轮就在此造过 4×14 处假红)', () => {
    eq(sameLeafValue(['a', 'b'], ['a', 'b']), true, '同内容数组必须算相等')
    eq(sameLeafValue({ x: 1 }, { x: 1 }), true, '同内容对象必须算相等')
    eq(sameLeafValue(['a'], ['b']), false, '内容不同必须算不等')
    eq(sameLeafValue('ok', 'ok'), true, '标量同值')
    eq(sameLeafValue('ok', 'no'), false, '标量改译必须判出来')
    eq(sameLeafValue(0, '0'), false, '类型不同不得算相等')
  })

  t('assetRefToRepoRel:带/不带前导斜杠都落在 src 下', () => {
    eq(assetRefToRepoRel('/static/images/a.png'), 'apps/miniapp-taro/src/static/images/a.png')
    eq(assetRefToRepoRel('assets/tabbar/a.png'), 'apps/miniapp-taro/src/assets/tabbar/a.png')
  })
  t('ASSET_LIT_RE:认静态字面量,不认插值拼接与 URL', () => {
    eq(countMatches(`src="/static/images/x.png" iconPath: 'assets/tabbar/y.png'`, ASSET_LIT_RE), 2, '两条静态引用')
    // 动态拼接(G4 型):路径里有 ${ ,不匹配静态判据,只计入 undetermined。
    // 刻意不用 .test() —— 带 g 的 /re/.test() 依赖 lastIndex,是"同一表达式两次结果不同"的经典假绿源。
    eq(countMatches('const a = `/static/images/${n}.png`', ASSET_LIT_RE), 0, '模板拼接不得算静态引用')
    eq(countMatches(`icon: 'https://cdn.example.com/a.png'`, ASSET_LIT_RE), 0, 'URL 不得算端内资源')
    eq(countMatches('const a = `/static/images/${n}.png`', DYN_PATH_RE), 1, '动态路径必须被数到,不得静默')
  })
  t('registryKeys:双引号/单引号/裸名三种键形都收', () => {
    const ks = registryKeys('export const ICONS = {\n  "a-b": "<svg/>",\n  \'c.d\': "<svg/>",\n  plain: "<svg/>",\n} as const')
    eq([...ks].sort().join(','), 'a-b,c.d,plain')
  })
  t('generatorTabbarNames:从生成器源码解析出 tab 名表', () => {
    const names = generatorTabbarNames('const ICONS = {\n  home: "<path/>",\n  // c\n  user: "<path/>",\n}')
    eq(names.join(','), 'home,user')
  })
  t('generatorTabbarNames:解析不到表 ⇒ 抛,不得当成空表报绿', () => {
    let threw = null
    try {
      generatorTabbarNames('const NOT_ICONS = {}')
    } catch (e) {
      threw = e
    }
    eq(threw instanceof Undetermined, true)
  })

  /* —— 端到端:磁盘面夹具(锁住 list() 的归一化,以及"引用↔存在"两个方向) —— */
  const withScratch = (fn) => {
    const dir = mkScratch('check-miniapp-generated')
    try {
      return fn(dir)
    } finally {
      rmScratch(dir)
    }
  }
  const put = (dir, rel, text) => {
    const abs = join(dir, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text, 'utf8')
  }

  t('磁盘面 list() 不得产出双斜杠路径(本门第一轮就靠它把孤儿扫描静默清零过)', () => {
    withScratch((dir) => {
      put(dir, `${ICON_ASSET_DIR}/a.svg`, '<svg/>')
      const reader = makeReader('worktree', dir)
      const listed = reader.list([`${APP}/`])
      eq(listed.includes(`${ICON_ASSET_DIR}/a.svg`), true, `夹具里的 svg 必须被枚举到,实际 ${JSON.stringify(listed)}`)
      eq(listed.some((p) => p.includes('//')), false, `枚举结果不得含 //,实际 ${listed.join(' | ')}`)
    })
  })

  t('端到端(磁盘面):缺资源判红、孤儿只报数 —— 两条方向各一次,成对', () => {
    withScratch((dir) => {
      put(dir, `${APP}/src/pages/x.tsx`, `export const I = () => <Image src="/static/images/missing.png" other='assets/tabbar/present.png' />`)
      put(dir, `${TABBAR_ASSET_DIR}/present.png`, 'PNG')
      put(dir, `${TABBAR_ASSET_DIR}/ghost.png`, 'PNG')
      put(dir, `${APP}/config/index.ts`, '')
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'assets' })
      const codes = r.findings.map((f) => `${f.code}:${f.file}`)
      eq(
        codes.includes(`R1:${APP}/src/static/images/missing.png`),
        true,
        '引用了但不存在的资源必须判红,实际 ' + codes.join(' | '),
      )
      const missing = r.findings.filter((f) => f.code === 'R1')
      eq(missing.every((f) => f.blocking), true, 'R1 必须是 blocking')
      const orphans = r.findings.filter((f) => f.code === 'R2')
      eq(orphans.map((f) => f.file).join(','), `${TABBAR_ASSET_DIR}/ghost.png`, '只有没人引用的才算孤儿')
      eq(orphans.every((f) => !f.blocking), true, '默认档孤儿不判红(删文件须人工确认)')
      eq(runCheck({ face: 'worktree', root: dir, strict: true, group: 'assets' }).findings.filter((f) => f.code === 'R2').every((f) => f.blocking), true, '--strict 时孤儿改判红')
    })
  })

  t('端到端(磁盘面):产物目录一个不缺时,R1 必须为 0(反向对照,防止本门自己恒红)', () => {
    withScratch((dir) => {
      put(dir, `${APP}/src/pages/x.tsx`, `export const I = () => <Image src="assets/tabbar/present.png" />`)
      put(dir, `${TABBAR_ASSET_DIR}/present.png`, 'PNG')
      const r = runCheck({ face: 'worktree', root: dir, strict: true, group: 'assets' })
      eq(r.findings.filter((f) => f.code === 'R1').length, 0, `齐全时不该有缺资源,实际 ${JSON.stringify(r.findings)}`)
      eq(r.findings.filter((f) => f.code === 'R2').length, 0, `齐全时不该有孤儿,实际 ${JSON.stringify(r.findings)}`)
    })
  })

  console.log(results.join('\n'))
  const bad = results.filter((r) => r.startsWith('❌')).length
  console.log(`\n自检:${results.length} 例,失败 ${bad}`)
  return bad === 0 ? 0 : 1
}

// §22d 双形态入口:被镜像测试 import 时只取导出符号,绝不执行 CLI 主流程(派生 git + process.exit)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exitCode = 2
  }
}

// 纯导出符号:镜像测试 import 到它即证明顶层没有跑 CLI(§22d)。
// 刻意不把判定面的字面量抄进测试 —— 面清单归本门持有,测试只验形状与内容。
export const CHECK_FACES = FACES

export const __test__ = {
  makeReader,
  mergeMessages,
  leafMap,
  sameLeafValue,
  decodeBundle,
  readSourceLeaves,
  assetRefToRepoRel,
  collectAssetRefs,
  registryKeys,
  generatorTabbarNames,
  runCheck,
  parseArgv,
  main,
  ASSET_LIT_RE,
  DYN_PATH_RE,
  REMOTE_LOCALES,
  I18N_BUNDLE,
  ICON_REGISTRY,
  TABBAR_GENERATOR,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
