#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-miniapp-generated.mjs —— 小程序端「源 ↔ 派生产物」存续性对账(守门,blocking 语义)
 *
 * 立因(2026-09-25):miniapp 端有四件派生产物生成器,此前状态是「只有人手动跑、既无构建入口也无守门」:
 *   ① scripts/gen-i18n-compressed.mjs                     → src/i18n/generated/remote-locales.gen.ts
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
 *   I2 (G-415/A8, 2026-10-02) LineIcon 调用点「值→键」:组件取不到素材时静默 return null,
 *        调用点写错键 = 界面空白零报错,而 G3 只对账注册表↔svg 两面。两档:
 *        · name 值位上的字符串字面量不在 icons.ts 注册表(整体/三元两支/|| ?? 右侧;比较位不算)
 *          ⇒ 判红,各面同权(现读 HEAD 面为 0,不是恒红);
 *        · 逃逸写法(`as IconName / as never / as '字面联合'`、尾部 `!`)—— 类型系统被绕过,
 *          存量按该文件 HEAD 自身数量锚定、只在 --staged 面拦新增(SV3 同型:HEAD 面锚点是它自己,
 *          全量判红即恒红门);HEAD/worktree 面只报数。
 *   G5 (G-680) 生成物自述钉:离线包头部带一段由**输入字节**算出的 sha256 钉(lib/generated-input-pin.mjs)。
 *        钉 ≠ 现算哈希 ⇒ 判「陈旧」并点名是哪几份输入变了(blocking);
 *        钉 absent / malformed ⇒ 判「未判定」,只报数点名,既不记绿也不冒红 ——
 *        HEAD 面上现存那份产物还没有钉,当场 blocking 就是恒红门(§12e);
 *        升档前置 = 跑过一次 `pnpm gen:i18n` 并把带钉的产物入库,此后 absent 才有资格判红。
 *        为什么需要它:守门只比"键集合 + 取值",而**键集合相同而值不同**时按集合比的那一层看不见;
 *        本仓实录过「产物存在但内容是旧的」两次(离线包只有 release 才发现 / 生成器读了 dist)。
 *        幂等性:时刻行 generatedAt 不参与判据也不参与逐字节比对(出口 maskGeneratedAt),
 *        其余字节两次生成必须全等 —— 断言在 --self-test 与镜像测试里各钉一条。
 *   G5/U1 (G-816040, 2026-10-02) 四端「AI 可导航路由」派生产物:web / mobile-rn / miniapp-taro /
 *        extension 四份 ui-routes.generated.ts 同挂本门(--group ui-routes)。此前它们零对账
 *        (生成器无门判、无名集对账,extension 甚至自称「生成常量」却没有写它的脚本)。每份产物头
 *        带自述钉(lib/generated-input-pin.mjs 同一实现):
 *        · 钉 ≠ 现算输入哈希 ⇒ G5 判「陈旧」并点名是哪几份输入变了(blocking);
 *        · 钉 absent / malformed / 产物缺文件 ⇒ 判「未判定」,只报数点名,既不记绿也不冒红(同 G5 口径);
 *        · 钉 matched ⇒ 再做名集对账 U1:源侧派生路由集(web=page.tsx 扫描 / taro=app.config.ts 求值 /
 *          extension=SidepanelApp 的 <Route path> 清单)与产物解析集不等 ⇒ 判红逐条报名。
 *          RN 不镜像派生(分支感知的 TSX 扫描器太重)⇒ 只判钉。
 *        名集只在钉 matched 后判:absent 钉时名集红可能是存量漂移,当场 blocking 就是恒红门(§12e)。
 *        源侧派生逻辑与各生成器是 mergeMessages 同型的"刻意双份"(generate-ui-routes.mjs 等),
 *        改语义必须两处同批 —— 否则名集对账开始说谎。
 *   G5/U1 的**写回挂点**(2026-10-10 立):四端钉陈旧过去只有人肉重生成一条路 ⇒ 干净 HEAD 恒红 ⇒
 *        每次提交被迫 --no-verify(§12e/§12f)。现在它挂在 `scripts/lib/pre-commit-hook.js` 的
 *        TOKEN_SYNC_TARGETS 表上按各自触发面自动写回(§4「派生态一律挂这张表」),每行的写回出口 =
 *        `--heal-ui-routes`,复核门 = 本门(表第 5 行 sync-extension-tokens.mjs 同型:同一脚本两种模式)。
 *        **判据与判定路径一字未动**:本档不 import runCheck、不 git add、不给绿/红结论 —— 它只写产物,
 *        写完仍由同一面的判定轮复检;写不回去(别人的在飞副本/生成器坏了/量级异常)一律拒绝并点名。
 *        详见 healUiRoutes 头注(含"为什么不是本门自愈"的实测否证)。
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
 *   node scripts/check-miniapp-generated.mjs --group ui-routes # 只算四端 AI 可导航路由(G-816040)
 *   node scripts/check-miniapp-generated.mjs --json       # 机器可读结论(dev 链消费,单一实现)
 *   node scripts/check-miniapp-generated.mjs --strict     # 把 G2 孤儿也判红
 *   node scripts/check-miniapp-generated.mjs --self-test  # 逻辑自检(成对正反例,零副作用)
 *   node scripts/check-miniapp-generated.mjs --heal-ui-routes [--staged] # 四端 ui-routes 写回出口(不判定)
 *   node scripts/check-miniapp-generated.mjs --root <dir>  # 显式指定判定根(镜像测试夹具用;生产不带)
 *
 * 紧急跳过(接线后):HUSKY_SKIP_MINIAPP_GENERATED=1 git commit ...
 * 镜像测试:node --test scripts/tests/check-miniapp-generated.test.mjs
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
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
import {
  digestInputs,
  parsePin,
  differingInputs,
  maskGeneratedAt,
  renderPin,
  normalizeInputBytes,
  PIN_BEGIN,
  PIN_END,
} from './lib/generated-input-pin.mjs'

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

/* ── G-816040:四端「AI 可导航路由」产物的生成器直接输入 ── */
const TARO_APP_CONFIG = `${APP}/src/app.config.ts`
const RN_NAVIGATOR = 'apps/mobile-rn/src/navigation/RootNavigator.tsx'
const RN_LINKING = 'apps/mobile-rn/src/navigation/linking.ts'
const EXT_SIDEPANEL = 'apps/extension/entrypoints/sidepanel/SidepanelApp.tsx'

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
    /** 一次 cat-file --batch 读完一批(逐文件派生 git 在真仓是上千次进程创建,属禁止形态)。
     * 可合并(G-816040):taro 的输入集要两阶段(app.config 求值后才知道页面 config 清单),
     * 四端 ui-routes 也要按产物分批补清单 —— 增量键并进既有 batch,不得整体作废重读。 */
    prefetch(rels) {
      const uniq = [...new Set(rels)]
      if (!batch) {
        batch = catBatch(
          root,
          uniq.map((r) => `${refPrefix}${r}`),
        )
        batch.__keys = new Set(uniq)
        return
      }
      const newly = uniq.filter((r) => !batch.__keys.has(r))
      if (newly.length === 0) return
      const extra = catBatch(
        root,
        newly.map((r) => `${refPrefix}${r}`),
      )
      for (const [k, v] of extra) batch.set(k, v)
      for (const k of newly) batch.__keys.add(k)
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
 * scripts/gen-i18n-compressed.mjs 是本函数的另一份镜像,本门是第三份)。
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

/* ───────────────── G-680 生成物自述钉(离线包) ───────────────── */

/**
 * 钉的输入清单:必须与生成器实际读的那 8 份**逐字同集**(路径同、无多无少)。
 * 两侧共用 lib/generated-input-pin.mjs 这一份哈希实现与字节归一 —— 门与生成器各算一遍必然漂,
 * 而漂出来的红比漏判更难查(本仓"两处算同一 key 必须共用一份实现"同型)。
 * 关键口径:**从门正在审的那个面读**(全量=HEAD blob / --staged=索引 / --worktree=磁盘)。
 * 若清单来自磁盘而内容来自 git,就会产出一把自洽但基准错位的尺子(守门 101/118 同型)。
 */
function readPinInputs(reader) {
  return REMOTE_LOCALES.flatMap((locale) =>
    [`${MESSAGE_ROOT}/shared/${locale}.json`, `${MESSAGE_ROOT}/miniapp-taro/${locale}.json`].map((rel) => ({
      rel,
      text: reader.has(rel) ? reader.read(rel) : null,
    })),
  )
}

/**
 * G5:产物里的钉 ≠ 现算的输入哈希 ⇒ 判"陈旧"(blocking)。
 * 取不到钉 / 钉读不出 ⇒ **未判定**(只报数、点名),绝不静默记为"内容是新的":
 * 判不出不是通过,也不是红 —— 本仓最高频的失效型就是"把没判写成判过了"。
 * 为什么 absent 不判红:HEAD 面上现存那份产物还没有钉,当场 blocking 就是一台
 * 与任何提交都无关的恒红门,唯一结局是逼人 --no-verify 连带废掉全部守门(§12e 同型)。
 */
function checkBundlePin({ reader, bundleText, push, undetermined, face }) {
  const pin = parsePin(bundleText)
  if (!pin.present) {
    undetermined.pinState = 'absent'
    undetermined.pinDetail = `${I18N_BUNDLE} 里没有自述钉(${PIN_BEGIN} 整块不见)⇒ 无法判断产物是否按当前输入生成`
    return
  }
  if (pin.malformed) {
    undetermined.pinState = 'malformed'
    undetermined.pinDetail = `${I18N_BUNDLE} 的钉读不出来:${pin.reason}`
    return
  }
  const computed = digestInputs(readPinInputs(reader))
  if (computed.digest === pin.digest) {
    undetermined.pinState = 'matched'
    undetermined.pinDetail = `${pin.digest.slice(0, 12)}…(commit ${pin.sourceCommit || 'unknown'})`
    return
  }
  undetermined.pinState = 'stale'
  const diffs = differingInputs(pin, computed.perInput)
  const named = diffs.length
    ? diffs.map((d) => `${d.rel}(钉 ${String(d.pinned).slice(0, 8)}… vs ${face}面 ${String(d.actual).slice(0, 8)}…)`).join(', ')
    : '逐条输入哈希都相同而聚合哈希不等 ⇒ 钉的清单与现算集合不同(输入文件多了/少了/顺序无关)'
  push(
    'G5',
    'missing',
    true,
    I18N_BUNDLE,
    `产物自述钉的 inputsSha256=${pin.digest.slice(0, 12)}… 与 ${face}面现算=${computed.digest.slice(0, 12)}… 不等 ⇒ 离线包陈旧(键集合可能一模一样而值是旧的)。不一致的输入:${named}`,
  )
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

/* ── I2(G-415/A8)LineIcon 调用点「值→键」──
 * 立因:LineIcon 取不到素材时静默 return null(调用点写错键 = 界面空白,零报错),
 * 而本门 G3 只对账「icons.ts ↔ svg 目录」两面,调用点把什么值喂给 name= 这一格零看守。
 * 两档判据:
 *   I2 字面量不在注册表(判红,各面同权):name 值位上的字符串字面量(整体/三元两支/
 *      || ?? 右侧)在 icons.ts 查无此键 —— 运行时必空白。比较位(=== 'x')不算值位。
 *   逃逸写法(棘轮,只在 --staged 生效):`X as IconName / as never / as '字面联合'`、
 *      尾部非空断言 `X!` —— 类型系统被绕过,值→键无静态证明。存量按该文件 HEAD 自身
 *      数量锚定,只拦新增(同守门 77/83/102 口径);HEAD/worktree 面只报数,不新增恒红面。
 */

/** 引号感知的注释剥离:字符串字面量里的 `//`(URL)不得被当成注释吞掉。 */
function stripJsComments(text) {
  let out = ''
  let i = 0
  let quote = null
  while (i < text.length) {
    const ch = text[i]
    if (quote) {
      out += ch
      if (ch === '\\') {
        if (i + 1 < text.length) {
          out += text[i + 1]
          i += 2
          continue
        }
      } else if (ch === quote) {
        quote = null
      }
      i += 1
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** depth=0 且不在字符串里的位置扫描共用:返回每个字符的"深度是否为零"游标。 */
function topLevelCursor(e) {
  const depth = []
  let d = 0
  let quote = null
  for (let k = 0; k < e.length; k += 1) {
    const ch = e[k]
    depth[k] = d === 0 && !quote
    if (quote) {
      if (ch === '\\') k += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '(' || ch === '{' || ch === '[') d += 1
    else if (ch === ')' || ch === '}' || ch === ']') d -= 1
  }
  return depth
}

/** name 表达式值位上的字符串字面量(比较位不算值位 —— 三元条件里的 === 'x' 不是 name 值)。 */
function lineIconValueLiterals(raw) {
  const out = []
  const walk = (input) => {
    let e = String(input).trim()
    while (e.endsWith('!')) e = e.slice(0, -1).trim() // 非空断言剥掉(逃逸性由 hatch 判)
    if (!e) return
    const lit = /^'([^']*)'$/.exec(e) || /^"([^"]*)"$/.exec(e)
    if (lit) {
      out.push(lit[1])
      return
    }
    // 顶层 ` as ` 断言 → 只取左侧被断言的值
    const depth = topLevelCursor(e)
    for (let k = 0; k + 4 <= e.length; k += 1) {
      // ' as ' 首字符是空格 ⇒ 'as' 天然独立成词,无需再查词边界(查了反而把 `x as never` 全拒掉)
      if (!depth[k] || e.slice(k, k + 4) !== ' as ') continue
      walk(e.slice(0, k))
      return
    }
    // 剥一层配平括号
    if (e.startsWith('(') && e.endsWith(')')) {
      let d = 0
      let balanced = true
      for (let k = 0; k < e.length; k += 1) {
        if (e[k] === '(') d += 1
        else if (e[k] === ')') {
          d -= 1
          if (d === 0 && k !== e.length - 1) {
            balanced = false
            break
          }
        }
      }
      if (balanced) {
        walk(e.slice(1, -1))
        return
      }
    }
    // 顶层 || / ?? → 两侧都是值位
    const seps = []
    for (let k = 0; k < e.length - 1; k += 1) {
      if (!depth[k]) continue
      if (e[k] === '|' && e[k + 1] === '|') seps.push(k)
      if (e[k] === '?' && e[k + 1] === '?') seps.push(k)
    }
    if (seps.length) {
      let prev = 0
      for (const k of seps) {
        walk(e.slice(prev, k))
        prev = k + 2
      }
      walk(e.slice(prev))
      return
    }
    // 顶层三元 ?: → 只取两支(条件位不进 —— 'x === 'voice'' 的 'voice' 不是 name 值)
    let q = -1
    for (let k = 0; k < e.length; k += 1) {
      if (!depth[k]) continue
      if (e[k] === '?' && e[k + 1] !== '?' && e[k + 1] !== '.' && e[k - 1] !== '?') {
        q = k
        break
      }
    }
    if (q >= 0) {
      let d = 0
      let colon = -1
      for (let k = q + 1; k < e.length; k += 1) {
        if (e[k] === '(' || e[k] === '{' || e[k] === '[') d += 1
        else if (e[k] === ')' || e[k] === '}' || e[k] === ']') d -= 1
        else if (e[k] === ':' && d === 0) {
          colon = k
          break
        }
      }
      if (colon > q) {
        walk(e.slice(q + 1, colon))
        walk(e.slice(colon + 1))
        return
      }
    }
    // 标识符/成员/调用:无字面量(类型面是 IconName 时由 tsc 看守,不属本档)
  }
  walk(raw)
  return out
}

/** 逃逸写法:顶层 ` as ` 断言(as const 除外)或尾部非空断言 `!` —— 类型系统被绕过。 */
function isLineIconEscapeHatch(raw) {
  const e = String(raw).trim()
  if (/!$/.test(e) && !/!==/.test(e.slice(-4))) return true
  const depth = topLevelCursor(e)
  for (let k = 0; k + 4 <= e.length; k += 1) {
    // ' as ' 首字符是空格 ⇒ 'as' 天然独立成词,无需再查词边界
    if (!depth[k] || e.slice(k, k + 4) !== ' as ') continue
    const rest = e.slice(k + 4).trim()
    if (/^const\b/.test(rest)) continue
    return true
  }
  return false
}

/** 从(已剥注释的)源码提取全部 <LineIcon name=…> 调用点。 */
function extractLineIconNameExprs(text) {
  const sites = []
  const lineAt = (idx) => text.slice(0, idx).split('\n').length
  const re = /<LineIcon\b/g
  let m
  while ((m = re.exec(text))) {
    // 捕获开标签:括号/花括号配平后才认 '>',防 props 里的箭头函数 `=>` 提前截断
    let i = re.lastIndex
    let paren = 0
    let brace = 0
    let quote = null
    let end = -1
    for (; i < text.length; i += 1) {
      const ch = text[i]
      if (quote) {
        if (ch === '\\') i += 1
        else if (ch === quote) quote = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch
      else if (ch === '(') paren += 1
      else if (ch === ')') paren -= 1
      else if (ch === '{') brace += 1
      else if (ch === '}') brace -= 1
      else if (ch === '>' && paren === 0 && brace === 0 && text[i - 1] !== '=') {
        end = i
        break
      }
    }
    if (end < 0) break // 标签未闭合(文件截断),防御性停
    re.lastIndex = end + 1
    const tag = text.slice(m.index, end)
    const nm = /(^|[\s{])name\s*=\s*/.exec(tag)
    if (!nm) continue
    const j = nm.index + nm[0].length
    if (tag[j] === '{') {
      let d = 0
      let k = j
      for (; k < tag.length; k += 1) {
        if (tag[k] === '{') d += 1
        else if (tag[k] === '}') {
          d -= 1
          if (d === 0) break
        }
      }
      if (d !== 0) continue // 括号不配平(截断),防御性放过
      sites.push({ line: lineAt(m.index), expr: tag.slice(j + 1, k) })
    } else if (tag[j] === '"' || tag[j] === "'") {
      const q = tag[j]
      const close = tag.indexOf(q, j + 1)
      if (close > j) sites.push({ line: lineAt(m.index), expr: tag.slice(j, close + 1) })
    }
  }
  return sites
}

/** 一份(已剥注释)源码里的逃逸写法调用点数(棘轮锚点的计算单元)。 */
function countLineIconEscapeHatches(strippedText) {
  return extractLineIconNameExprs(strippedText).filter((s) => isLineIconEscapeHatch(s.expr)).length
}

/* ───────── G-816040 四端 ui-routes:源侧派生 / 产物解析(名集对账的两侧) ───────── */

const WEB_APP_PREFIX = 'apps/web/app/'
// 与 apps/web/scripts/generate-ui-routes.mjs 的 EXCLUDED_TOP_SEGMENTS 同表(mergeMessages 同型:
// 刻意双份并点名,改语义必须两处同批,否则 web 名集对账开始说谎)
const WEB_EXCLUDED_TOP = new Set(['sso', 'h5', 'api'])

/** web 源侧名集:app/**\/page.tsx → 路由路径(与 generate-ui-routes.mjs:toRoute 同规则) */
function deriveWebRoutes(reader) {
  const pages = reader.list([WEB_APP_PREFIX]).filter((p) => p.endsWith('/page.tsx'))
  if (pages.length === 0) {
    throw new Undetermined(`${reader.label} 在 ${WEB_APP_PREFIX} 下枚举不到 page.tsx,无法判定 web 名集`)
  }
  const paths = new Set()
  for (const rel of pages) {
    const segs = rel.slice(WEB_APP_PREFIX.length).split('/').slice(0, -1) // 去掉 page.tsx
    const out = []
    for (const seg of segs) {
      if (seg.startsWith('(') && seg.endsWith(')')) continue // 分组段不参与 URL
      out.push(seg.startsWith('[') && seg.endsWith(']') ? `:${seg.slice(1, -1)}` : seg)
    }
    if (out.length > 0 && WEB_EXCLUDED_TOP.has(out[0])) continue
    paths.add(out.length === 0 ? '/' : `/${out.join('/')}`)
  }
  return paths
}

/** web 产物侧名集:路由行 `  { path: '…', param, group }`(接口声明的 `path: string` 无引号不会误中) */
function parseWebRoutes(text) {
  return new Set([...text.matchAll(/\{\s*path:\s*'([^']+)'/g)].map((m) => m[1]))
}

/**
 * taro app.config.ts 的求值(与 apps/miniapp-taro/scripts/generate-ui-routes.mjs:evalConfigText 同规则:
 * 只做「剥 TS 断言 + export default → return」两处改写,其余交给 JS 引擎 —— 刻意双份,同批改)。
 */
function evalTaroConfigText(raw) {
  const js = String(raw).replace(/\s+as\s+[^,;}\]\n]+/g, '').replace(/^export default\s+/m, 'return ')
  return new Function('defineAppConfig', 'definePageConfig', js)((c) => c, (c) => c)
}

/** taro 页面全路径清单:pages + subPackages 拼 root(与生成器 buildRoutes 的 flat 同规则) */
function taroPageList(cfg) {
  const mainPages = cfg.pages
  const subPackages = cfg.subPackages ?? []
  if (!Array.isArray(mainPages) || mainPages.length === 0) {
    throw new Undetermined('app.config.ts 未解析出 pages 数组,无法判定 taro 名集/输入集')
  }
  return [
    ...mainPages,
    ...subPackages.flatMap((sp) => (sp.pages ?? []).map((page) => `${sp.root}/${page}`)),
  ]
}

/** 求 app.config:面上取不到 / 求值失败都必须是 Undetermined(判不出 ≠ 不陈旧) */
function readTaroAppConfig(reader) {
  const raw = reader.has(TARO_APP_CONFIG) ? reader.read(TARO_APP_CONFIG) : null
  if (raw === null) return null
  try {
    return evalTaroConfigText(raw)
  } catch (e) {
    throw new Undetermined(
      `${TARO_APP_CONFIG} 在判定面上求值失败,无法判定 taro 输入集/名集:${String(e.message).split('\n')[0]}`,
    )
  }
}

/** taro 生成器扫描集(与 collectSourceFiles 同规则,但枚举自判定面而非磁盘) */
function listTaroScanFiles(reader) {
  return reader.list([`${APP}/src/`]).filter((p) => {
    if (!/\.(ts|tsx)$/.test(p)) return false
    if (p.endsWith('.d.ts') || p.endsWith('.generated.ts') || p.endsWith('.config.ts')) return false
    if (/\.(test|spec)\.(ts|tsx)$/.test(p)) return false
    if (/(^|\/)(generated|__tests__)\//.test(p)) return false
    return true
  })
}

/** taro 钉输入清单 = app.config 原文 + 存在的页面 config + 参数探测扫描集(与生成器逐字同集) */
function taroInputRels(reader) {
  const rels = [TARO_APP_CONFIG]
  const cfg = readTaroAppConfig(reader)
  if (cfg) {
    for (const page of taroPageList(cfg)) {
      const rel = `${APP}/src/${page}.config.ts`
      if (reader.has(rel)) rels.push(rel)
    }
  }
  rels.push(...listTaroScanFiles(reader))
  return rels
}

/** taro 源侧名集:app.config.ts 求值 → 页面全路径(前导斜杠) */
function deriveTaroRoutes(reader) {
  const cfg = readTaroAppConfig(reader)
  if (!cfg) throw new Undetermined(`${reader.label} 取不到 ${TARO_APP_CONFIG},无法判定 taro 名集`)
  return new Set(taroPageList(cfg).map((p) => `/${p}`))
}

/** taro 产物侧名集:条目行 `path: '…'`(接口声明 `path: string` 无引号不会误中) */
function parseTaroRoutes(text) {
  return new Set([...text.matchAll(/\bpath:\s*'([^']+)'/g)].map((m) => m[1]))
}

/** extension 源侧名集:SidepanelApp 的 <Route path="…">(与 generate-ext-ui-routes.mjs:extractRoutes 同规则) */
function deriveExtensionRoutes(reader) {
  const raw = reader.has(EXT_SIDEPANEL) ? reader.read(EXT_SIDEPANEL) : null
  if (raw === null) throw new Undetermined(`${reader.label} 取不到 ${EXT_SIDEPANEL},无法判定 extension 名集`)
  const stripped = stripJsComments(raw)
  const paths = new Set()
  for (const m of stripped.matchAll(/<Route\s+path="([^"]*)"/g)) {
    const p = m[1]
    if (p === '*' || p.includes('${')) continue // 通配/动态:生成器同样排除(skipped 自述行计数)
    if (paths.has(p)) throw new Undetermined(`${EXT_SIDEPANEL} 出现重复路由 ${p},无法判定名集`)
    paths.add(p)
  }
  if (paths.size === 0) {
    throw new Undetermined(`${EXT_SIDEPANEL} 未解析到任何 <Route path>,无法判定 extension 名集`)
  }
  return paths
}

/** extension 产物侧名集:字符串数组行 `  '/path',`(头注里的 <Route path="…"> 不是独立引号行,不会误中) */
function parseExtensionRoutes(text) {
  return new Set([...text.matchAll(/^[ \t]*'([^']+)',[ \t]*$/gm)].map((m) => m[1]))
}

/**
 * 四份 ui-routes 派生产物的对账规格(G-816040)。
 * inputRels(reader):生成器实际读的全部输入(逐字同集)—— 先列清单统一 prefetch,再逐份读;
 * derive(reader):源侧名集;parse(text):产物侧名集。
 * RN 不镜像派生(分支感知 TSX 扫描器太重)⇒ derive/parse 为 null,只判钉。
 * 名集对账只在钉 matched 后跑(见文件头 G5/U1 条)。
 */
const UI_ROUTES_ARTIFACTS = [
  {
    rel: 'apps/web/src/lib/ui-routes.generated.ts',
    generator: 'apps/web/scripts/generate-ui-routes.mjs',
    inputRels(reader) {
      const pages = reader.list([WEB_APP_PREFIX]).filter((p) => p.endsWith('/page.tsx'))
      if (pages.length === 0) {
        throw new Undetermined(`${reader.label} 在 ${WEB_APP_PREFIX} 下枚举不到 page.tsx,无法判定 web 输入集`)
      }
      return pages
    },
    derive: deriveWebRoutes,
    parse: parseWebRoutes,
  },
  {
    rel: 'apps/mobile-rn/src/constants/ui-routes.generated.ts',
    generator: 'apps/mobile-rn/scripts/generate-ui-routes.mjs',
    inputRels: () => [RN_NAVIGATOR, RN_LINKING],
    derive: null,
    parse: null,
  },
  {
    rel: 'apps/miniapp-taro/src/constants/ui-routes.generated.ts',
    generator: 'apps/miniapp-taro/scripts/generate-ui-routes.mjs',
    inputRels: taroInputRels,
    derive: deriveTaroRoutes,
    parse: parseTaroRoutes,
  },
  {
    rel: 'apps/extension/lib/ext-ui-routes.generated.ts',
    generator: 'apps/extension/scripts/generate-ext-ui-routes.mjs',
    inputRels: () => [EXT_SIDEPANEL],
    derive: deriveExtensionRoutes,
    parse: parseExtensionRoutes,
  },
]

/* ─────────────────────────── 主判定 ─────────────────────────── */

/**
 * @param {{face:string, root:string, strict:boolean, group:string|null}} opts
 * @returns {{findings:Array, undetermined:Object, counts:Object}}
 */
function runCheck({ face, root, strict, group }) {
  const reader = makeReader(face, root)
  /** @type {Array<{code:string,dir:'missing'|'orphan'|'unreproducible',blocking:boolean,file:string,detail:string}>} */
  const findings = []
  const undetermined = {
    dynamicAssetPaths: 0,
    unreadableSourceFiles: 0,
    // I2(G-415/A8)逃逸写法调用点存量(as 断言 / 尾部 !)—— 只报数,棘轮只在 --staged 拦新增
    lineIconEscapeHatchSites: 0,
    // G-680 钉的四态:absent(没有钉)/ malformed(有钉读不出)/ matched(与现算同)/ stale(不等 ⇒ 已判红)。
    // 前两态是「未判定」,不得被读成"内容是新的";后两态由 report/JSON 原样带出。
    pinState: 'not-run',
    pinDetail: '',
    // G-816040 四端 ui-routes 的逐产物钉态(file-absent/absent/malformed/matched/stale),report/JSON 原样带出
    uiRoutesPins: [],
  }
  const counts = { bundleLocales: 0, sourceFilesScanned: 0, artifactFiles: 0, registryKeys: 0, lineIconCallSites: 0 }

  const push = (code, dir, blocking, file, detail) => findings.push({ code, dir, blocking, file, detail })

  /* ── 先枚举 + 一次预取,再判据 ──
   * 枚举与内容必须来自**同一个面**、且在**同一轮**里读:清单读磁盘而内容读 git 会产出一把
   * 自洽但基准错位的尺子(守门 101/91 同型)。
   * --group i18n 刻意不读那 500+ 个源文件:dev 冷启只需要"包是否过期"这一格,读全盘会把
   * 一次便宜的对账变成一次全端扫描。
   * --group ui-routes 同理只走四端产物自己的枚举(apps/web/app、taro src 扫描集、侧边栏),
   * 不做 miniapp 全盘枚举(本组不用它),四端清单在 ui-routes 块里自行 prefetch(可合并)。 */
  const uiRoutesOnly = group === 'ui-routes'
  let allFiles = []
  if (!uiRoutesOnly) {
    allFiles = reader.list([`${APP}/`])
    if (allFiles.length === 0) throw new Undetermined(`${reader.label} 在 ${APP}/ 下列出 0 个文件,无法判定`)
  }
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
  if (!uiRoutesOnly) {
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
  }

  /* —— G1/G2 i18n 离线包 —— */
  if (!group || group === 'i18n') {
    if (!reader.has(I18N_BUNDLE)) {
      throw new Undetermined(`${reader.label} 取不到产物 ${I18N_BUNDLE} —— 离线包根本不在,无法判定`)
    }
    const bundleText = reader.read(I18N_BUNDLE)
    const bundle = decodeBundle(bundleText)
    // G5 自述钉先于逐键对账:钉不等 = 整包按旧输入生成,此时 B2/B3 的"少哪些键"是在拿旧账判新账。
    checkBundlePin({ reader, bundleText, push, undetermined, face })

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

    /* —— I2 调用点「值→键」(G-415/A8) —— */
    let callSites = 0
    let escapeTotal = 0
    /** @type {Map<string, number>} rel -> 该文件逃逸写法调用点数(当前面) */
    const escapeByFile = new Map()
    for (const rel of sourceFiles) {
      const src = reader.read(rel)
      if (src === null) continue
      const stripped = stripJsComments(src)
      const sites = extractLineIconNameExprs(stripped)
      callSites += sites.length
      let escapes = 0
      for (const { line, expr } of sites) {
        if (isLineIconEscapeHatch(expr)) escapes += 1
        for (const lit of lineIconValueLiterals(expr)) {
          if (!keys.has(lit)) {
            push(
              'I2',
              'missing',
              true,
              rel,
              `L${line} 调用点写死的图标名 "${lit}" 不在 ${ICON_REGISTRY} 注册表 —— LineIcon 取不到素材时静默 return null(界面空白,零报错)`,
            )
          }
        }
      }
      if (escapes > 0) escapeByFile.set(rel, escapes)
      escapeTotal += escapes
    }
    counts.lineIconCallSites = callSites
    undetermined.lineIconEscapeHatchSites = escapeTotal
    // 棘轮:锚点 = 该文件 HEAD 版本自身的逃逸数。只在 --staged 生效(SV3 同型:
    // HEAD 面锚点是它自己 ⇒ 存量恒 0 新增,判红即恒红;worktree 是 dev 链逃生舱,只报数)。
    if (face === 'staged') {
      for (const [rel, cnt] of escapeByFile) {
        let headText = null
        try {
          headText = gitRaw(['show', `HEAD:${rel}`], root)
        } catch {
          headText = null // HEAD 里没有该文件(新文件)⇒ 锚点 0,任何逃逸都算新增
        }
        const headCount = headText ? countLineIconEscapeHatches(stripJsComments(headText)) : 0
        if (cnt > headCount) {
          push(
            'I2',
            'missing',
            true,
            rel,
            `调用点逃逸写法(as 断言 / 尾部非空断言)从 HEAD 的 ${headCount} 处涨到 ${cnt} 处 —— ` +
              `值→键无静态证明;新增一律用注册表字面量或 IconName 类型的值,不得用断言绕过`,
          )
        }
      }
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

  /* —— G5/U1 (G-816040) 四端「AI 可导航路由」:自述钉 + 名集对账 —— */
  if (!group || group === 'ui-routes') {
    // 两段式取材:先取「四份产物 + 各生成器的直接输入」;taro 的输入集要 app.config 求值后
    // 才能补齐(页面 config 清单 + 扫描集)⇒ 由 inputRels(reader) 二段补列。prefetch 可合并,
    // 两段并进同一批,不会重复读键。
    reader.prefetch([
      ...UI_ROUTES_ARTIFACTS.map((a) => a.rel),
      RN_NAVIGATOR,
      RN_LINKING,
      EXT_SIDEPANEL,
      TARO_APP_CONFIG,
    ])
    const uiInputRels = new Set()
    for (const art of UI_ROUTES_ARTIFACTS) {
      for (const rel of art.inputRels(reader)) uiInputRels.add(rel)
    }
    reader.prefetch([...uiInputRels])

    for (const art of UI_ROUTES_ARTIFACTS) {
      const state = { rel: art.rel, state: 'matched', detail: '' }
      undetermined.uiRoutesPins.push(state)
      const text = reader.has(art.rel) ? reader.read(art.rel) : null
      if (text === null) {
        state.state = 'file-absent'
        state.detail = `${reader.label} 面上没有该产物 —— 名集与钉都判不了(消费方 import 会先炸,构建面另行兜底)`
        continue
      }
      const pin = parsePin(text)
      if (!pin.present) {
        state.state = 'absent'
        state.detail = '产物里没有自述钉(IHUI-GEN-PIN-BEGIN 整块不见)⇒ 无法判断是否按当前输入生成'
        continue
      }
      if (pin.malformed) {
        state.state = 'malformed'
        state.detail = `钉读不出来:${pin.reason}`
        continue
      }
      const computed = digestInputs(
        art.inputRels(reader).map((rel) => ({ rel, text: reader.has(rel) ? reader.read(rel) : null })),
      )
      if (computed.digest !== pin.digest) {
        state.state = 'stale'
        const diffs = differingInputs(pin, computed.perInput)
        const named = diffs.length
          ? diffs
              .map((d) => `${d.rel}(钉 ${String(d.pinned).slice(0, 8)}… vs ${face}面 ${String(d.actual).slice(0, 8)}…)`)
              .join(', ')
          : '逐条输入哈希都相同而聚合哈希不等 ⇒ 钉的清单与现算集合不同(输入文件多了/少了/顺序无关)'
        push(
          'G5',
          'missing',
          true,
          art.rel,
          `产物自述钉的 inputsSha256=${pin.digest.slice(0, 12)}… 与 ${face}面现算=${computed.digest.slice(0, 12)}… 不等 ⇒ 产物陈旧(生成器:${art.generator})。不一致的输入:${named}`,
        )
        continue
      }
      state.detail = `${pin.digest.slice(0, 12)}…(commit ${pin.sourceCommit || 'unknown'})`
      // 名集对账只在钉 matched 时跑:absent 钉时名集红可能是存量漂移 ⇒ 恒红门(§12e)。
      // RN 不镜像派生(分支感知 TSX 扫描器太重)⇒ derive/parse 为 null,只判钉。
      if (!art.derive || !art.parse) continue
      const want = art.derive(reader) // 派生不出 ⇒ 抛 Undetermined(exit 2),绝不冒充名集
      const got = art.parse(text)
      const missing = [...want].filter((p) => !got.has(p)).sort()
      const extra = [...got].filter((p) => !want.has(p)).sort()
      if (missing.length || extra.length) {
        state.detail += ' + 名集不等(U1 判红,见上)'
        push(
          'U1',
          'missing',
          true,
          art.rel,
          `钉 matched(输入同步)但名集与源对不上:源有产无 ${missing.length} 条` +
            `${missing.length ? `(如 ${missing.slice(0, 3).join(', ')})` : ''};产有源无 ${extra.length} 条` +
            `${extra.length ? `(如 ${extra.slice(0, 3).join(', ')})` : ''} —— 手改产物或生成器漏跑都会落在这里,重跑 ${art.generator} 即收敛`,
        )
      }
    }
  }

  return { findings, undetermined, counts }
}

/* ───────── G-816040 写回档(--heal-ui-routes,2026-10-10 立) ─────────
 *
 * 立因:四端 ui-routes 产物的自述钉(G5)此前**只有人工重生成**这一条出路。实测后果不是"多跑一次
 * 脚本",而是恒红循环:`apps/web/app/**\/page.tsx` 被别人改了并入库,而链条上没有任何环节重跑生成器
 * ⇒ 产物钉落后 ⇒ 本门在**干净 HEAD** 上判红 ⇒ blocking 门红 = 本机每次提交都被迫 --no-verify
 * ⇒ 一次绕过约等于链上全部守门对该提交作废(§12e/§12f)。本仓已为此人肉修过多次(见
 * `git log --oneline -- apps/web/src/lib/ui-routes.generated.ts`)。
 *
 * 为什么挂点是登记表而不是本门自愈(择一实测,写在这里免得下一个人再走一遍):
 *   · 提交链里"写回 ⇒ 进这一次提交"只有 pre-commit 的 TOKEN_SYNC_TARGETS 做得到 —— 它持有
 *     staging 快照,写回后 `git add` 并 `INITIAL_STAGED_SNAPSHOT.add()` 才不会在 hook 退出前被
 *     `restoreStaging()` 当作"非预期 staged 文件"摘掉。实测(临时仓 + lib/staging-snapshot.js):
 *     提交者只 staged a.txt 时,门自己 `git add b.txt` 会在 hook 退出前被还原成 HEAD 内容,
 *     于是**门报了绿而提交仍是陈旧的** —— 那等于把恒红洗成静默恒红,比红更坏。所以本档**不** git add,
 *     也**不**改判据:它只是登记表某一行的「写回出口」(同型先例:表第 5 行的 cmd 与 check 同为
 *     sync-extension-tokens.mjs,一个模式写、一个模式判)。
 *   · 判据侧一字未动:runCheck / formatReport 不在本档调用路径里;红与绿仍由同面的判定轮说。
 *     本档写完后,提交链上真正的复检是 pre-commit 之后那一次 `--staged` 判定 —— 同一个面、同一轮取材。
 *
 * 本档永远不会做的事:① 用自己的输出替代判定(它只报"写没写回、为什么没写回");
 *   ② 把"刚写回的内容"当成被审面(收敛校验用的是**被审面**现算的 digest,不是磁盘);
 *   ③ 覆盖别人的在飞改动(工作树副本 ≠ 面副本 ⇒ 拒绝写回并点名);
 *   ④ 造出不存在的产物(面上没有该文件 ⇒ file-absent 是判定侧的未判定档,不是"生成一份")。
 */

/**
 * 单份产物一次自动写回允许的最大行级变更量(屏蔽 generatedAt 后按行做多重集差)。
 * 上限依据:一次正常写回的变更 = 聚合哈希 1 行 + 变了的逐输入哈希行(web 全量约 100 页都改也不过
 * 100 行)+ 产物体若干行;超过 240 行意味着"生成器给出的已经不是这次改动该有的产物"(扫错树、
 * 树被整体重写、产物被人手改过又没入账),那必须让人看见 —— 照守门 47 的 MAX_AUTOFIX=200 同型。
 */
const MAX_HEAL_CHANGED_LINES = 240

/** 行级变更量:按行做多重集差的绝对值和(屏蔽 generatedAt 后调用,时刻行不得算变更)。 */
function lineChangeCount(a, b) {
  const count = (text) => {
    const m = new Map()
    for (const line of String(text).split(/\r?\n/)) m.set(line, (m.get(line) ?? 0) + 1)
    return m
  }
  const ca = count(a)
  const cb = count(b)
  let n = 0
  for (const key of new Set([...ca.keys(), ...cb.keys()])) {
    n += Math.abs((ca.get(key) ?? 0) - (cb.get(key) ?? 0))
  }
  return n
}

/**
 * 四端 ui-routes 的自动写回出口(登记表某一行的 cmd;不判绿不判红)。
 * @param {{face:string, root:string, log?:(s:string)=>void}} opts
 * @returns {{rows: Array<{rel:string, action:string, note:string}>, code:number, healed:number, refused:number}}
 *   code:0 = 本次没有"写回出口自己坏了"的故障(refuse/skip 都是正常出口,判定权留给判定轮);
 *   code:1 = 生成器跑了而失败(登记表 failMode=block 的口径:生成器坏了不得静默)。
 *   取不到面/枚举不到输入 ⇒ 抛 Undetermined,由 main 落 exit 2(未判定 ≠ 通过,也 ≠ 已写回)。
 */
function healUiRoutes({ face, root, log = (s) => console.log(s) }) {
  const reader = makeReader(face, root)
  // 两段式取材与判定轮**逐字同构**(见 runCheck 的 G-816040 段):先取四份产物 + 各生成器的直接输入,
  // taro 的页面 config 清单要 app.config 求值后才补上。少 prefetch 一项,read 就返回 null
  // (取材层不为清单外的键懒读)—— 那会把输入清单算少几份,现算的聚合哈希跟着错(实测过这一型)。
  reader.prefetch([
    ...UI_ROUTES_ARTIFACTS.map((a) => a.rel),
    RN_NAVIGATOR,
    RN_LINKING,
    EXT_SIDEPANEL,
    TARO_APP_CONFIG,
  ])
  const inputSets = new Map()
  for (const art of UI_ROUTES_ARTIFACTS) inputSets.set(art.rel, art.inputRels(reader))
  reader.prefetch([...new Set([...inputSets.values()].flat())])

  const rows = []
  let healed = 0
  let refused = 0
  let code = 0

  for (const art of UI_ROUTES_ARTIFACTS) {
    const row = { rel: art.rel, action: 'skip', note: '' }
    rows.push(row)
    const faceText = reader.has(art.rel) ? reader.read(art.rel) : null
    if (faceText === null) {
      row.action = 'refuse'
      row.note = `${reader.label} 面上没有该产物 —— 写回出口不造"面上不存在的文件"(判定侧同事件记 file-absent,未判定)`
      refused += 1
      continue
    }
    const pin = parsePin(faceText)
    if (!pin.present || pin.malformed) {
      // absent/malformed 是判定侧的「未判定」档,不是"陈旧":本档只治陈旧,不替未判定发合格证。
      row.action = 'skip'
      row.note = `钉 ${pin.present ? 'malformed' : 'absent'} ⇒ 未判定档,不在写回范围(前置=先跑一次生成器把带钉产物入库)`
      continue
    }
    // 输入清单来自同一轮取材(见函数开头的两段式 prefetch),不在这里二次枚举。
    const inputRels = inputSets.get(art.rel)
    const computed = digestInputs(
      inputRels.map((rel) => ({ rel, text: reader.has(rel) ? reader.read(rel) : null })),
    )
    if (computed.digest === pin.digest) {
      // 幂等锁:第二次跑本档必须一个字节都不写(登记表 failMode=block 的前置依据)。
      row.action = 'clean'
      row.note = `钉已与${face}面现算同值(${computed.digest.slice(0, 12)}…)⇒ 不写回`
      continue
    }
    // 安全闸①:工作树副本必须与面副本同字节。不同 = 别人正拿着这份产物的在飞改动,门不得覆盖。
    const diskText = readWorktreeFile(root, art.rel)
    if (diskText === null) {
      row.action = 'refuse'
      row.note = `磁盘上没有 ${art.rel}(有人在删/尚未落地)⇒ 未写回`
      refused += 1
      continue
    }
    if (normalizeInputBytes(diskText) !== normalizeInputBytes(faceText)) {
      row.action = 'refuse'
      row.note = `工作树副本 ≠ ${face}面副本 ⇒ 该产物上有别人的在飞改动,门不动它(未写回)`
      refused += 1
      continue
    }
    const restore = () => writeFileSync(join(root, art.rel), diskText, 'utf8')
    // 安全闸②:生成器两面都得在位(面上没有 ⇒ cmd 跑到即失败,而不是"当成没有输入")。
    const genAbs = join(root, art.generator)
    if (!reader.has(art.generator) || !existsSync(genAbs)) {
      row.action = 'refuse'
      row.note = `生成器不可用(面:${reader.has(art.generator) ? '在' : '不在'} / 磁盘:${existsSync(genAbs) ? '在' : '不在'})${art.generator} ⇒ 未写回,请人工排查该端生成器`
      refused += 1
      continue
    }
    const ran = spawnSync(process.execPath, [genAbs], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 16 << 20,
      // 本机 node 宿主下不写 stdio 稳定 EBUSY(§12g);生成器不吃 stdin ⇒ 第一通道 'ignore'。
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (ran.status !== 0) {
      restore()
      row.action = 'fail'
      row.note = `${art.generator} 退出码 ${ran.status ?? '取不到'}:${
        String(ran.stderr || ran.stdout || '')
          .trim()
          .split('\n')[0] || '(无输出)'
      } ⇒ 未写回`
      code = 1
      continue
    }
    const newText = readWorktreeFile(root, art.rel)
    if (newText === null) {
      row.action = 'fail'
      row.note = `${art.generator} 跑完了却没写出 ${art.rel} ⇒ 生成器与产物对不上,门不猜`
      code = 1
      continue
    }
    // 收敛校验用**被审面**现算的 digest,不是刚写回的磁盘内容:磁盘与面不同源时门必须拒绝而不是 adopt。
    const newPin = parsePin(newText)
    if (!newPin.present || newPin.malformed || newPin.digest !== computed.digest) {
      restore()
      const drift = differingInputs(newPin, computed.perInput).slice(0, 3)
      row.action = 'refuse'
      row.note =
        `生成器按磁盘算出的钉(${newPin.present && !newPin.malformed ? `${newPin.digest.slice(0, 12)}…` : '不可读'})` +
        ` ≠ ${face}面现算(${computed.digest.slice(0, 12)}…)⇒ 未写回` +
        `(已复原)` +
        (drift.length ? `;差在:${drift.map((d) => d.rel).join(', ')}` : '') +
        ' —— 该端输入的工作树副本与索引/HEAD 副本不同,把磁盘钉入库就是替别人的未提交改动背书'
      refused += 1
      continue
    }
    const changed = lineChangeCount(maskGeneratedAt(faceText), maskGeneratedAt(newText))
    if (changed > MAX_HEAL_CHANGED_LINES) {
      restore()
      row.action = 'refuse'
      row.note = `写回量级 ${changed} 行 > 上限 ${MAX_HEAL_CHANGED_LINES}(已复原)—— 这不是"跟上一次改动"的量,门不自动背书,请人工看生成器输出`
      refused += 1
      continue
    }
    row.action = 'healed'
    row.note = `钉 ${pin.digest.slice(0, 12)}… → ${newPin.digest.slice(0, 12)}…,行级变更 ${changed}(待登记方 git add;复检仍由判定轮在同一面做)`
    healed += 1
  }

  log(
    `[miniapp-generated --heal-ui-routes] 面=${face}(${FACE_LABEL[face]}) 四端产物 ${rows.length} 份:` +
      ` 已写回 ${healed} / 拒绝写回 ${refused} / 无需写回 ${rows.length - healed - refused}` +
      (code === 1 ? ' / 生成器失败 1(阻塞提交,不静默)' : ''),
  )
  for (const r of rows) {
    if (r.action === 'clean') continue
    log(
      `  ${r.action === 'healed' ? '✍️' : r.action === 'fail' ? '❌' : '⏭️'} ${r.rel} —— [${r.action}] ${r.note}`,
    )
  }
  if (healed > 0) {
    log(
      '  ℹ️ 本档只写回,不判定:红/绿仍由同一面的判定轮说(提交链上 = pre-commit 之后的 --staged 判定)。',
    )
  }
  return { rows, code, healed, refused }
}

/* ─────────────────────────── 输出 ─────────────────────────── */

function formatReport(result, face, opts) {
  const red = result.findings.filter((f) => f.blocking)
  const reported = result.findings.filter((f) => !f.blocking)
  const lines = []
  lines.push(`[miniapp-generated] 面=${face}(${FACE_LABEL[face]}) 扫描源文件 ${result.counts.sourceFilesScanned} 个 / 产物文件 ${result.counts.artifactFiles} 个 / 注册表键 ${result.counts.registryKeys} 个 / LineIcon 调用点 ${result.counts.lineIconCallSites} 个 / 语言 ${result.counts.bundleLocales} 种`)
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
  lines.push(
    `  ◽ LineIcon 调用点逃逸写法(as 断言/尾部 !)存量 ${result.undetermined.lineIconEscapeHatchSites} 处 —— ` +
      `只报数;--staged 面按该文件 HEAD 自身数量锚定,只拦新增(I2)`,
  )
  if (result.undetermined.pinState === 'absent' || result.undetermined.pinState === 'malformed') {
    lines.push(
      `  📌 离线包自述钉(G-680):${result.undetermined.pinState} —— ${result.undetermined.pinDetail}`,
    )
    // absent/malformed 一律是**未判定**:它不等于"产物是新的"。
    // 现在就判红 = 一台与任何提交都无关的恒红门(HEAD 面上那份产物还没有钉),
    // 唯一结局是逼人 --no-verify 连带废掉全部守门(§12e)。升档前置见文件头 G5 条。
    lines.push('     ⚠️ 未判定 ≠ 通过:产物没记自己从哪份输入生成,陈旧与否无从现算。')
  } else {
    lines.push(`  📌 离线包自述钉(G-680):${result.undetermined.pinState} —— ${result.undetermined.pinDetail}`)
  }
  for (const s of result.undetermined.uiRoutesPins) {
    lines.push(`  📌 四端 ui-routes 自述钉(G-816040) ${s.rel}: ${s.state} —— ${s.detail}`)
    if (s.state !== 'matched' && s.state !== 'stale') {
      // 未判定三态(产物缺/钉缺/钉读不出)一律点名,绝不静默成"看起来全绿"。
      // 现在就判红 = 一台与任何提交都无关的恒红门(HEAD 面上这些产物还没有钉,§12e)。
      lines.push('     ⚠️ 未判定 ≠ 通过:按生成器重跑一次并把带钉产物入库,才进入「陈旧/名集」判定。')
    }
  }
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
    healUiRoutes: false,
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
    else if (a === '--heal-ui-routes') opts.healUiRoutes = true
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
  if (opts.group && !['i18n', 'assets', 'icons', 'tabbar', 'ui-routes'].includes(opts.group)) {
    console.error(`❌ --group 只认 i18n / assets / icons / tabbar / ui-routes,给了 "${opts.group}"`)
    return 2
  }
  if (opts.healUiRoutes) {
    // 写回档不判定:--json 那份机器契约是**判定**的输出面,--group 又暗示"只算某一组判定" ——
    // 两者与本档同给就是"旗语说一件、代码做另一件",当场拒收而不是挑一个听。
    if (opts.json || opts.group) {
      console.error('❌ --heal-ui-routes 是写回出口(不判定),不得与 --json / --group 同给')
      return 2
    }
    try {
      return healUiRoutes({ face, root: opts.root }).code
    } catch (e) {
      if (e instanceof Undetermined) {
        console.error(`⚠️ 无法判定(不冒红也不记绿,更不写回):${e.message}`)
        return 2
      }
      throw e
    }
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
          // dev 链与脚本读者要的就是这一格:钉到底判出了什么(not-run/absent/malformed/matched/stale)
          bundlePin: { state: result.undetermined.pinState, detail: result.undetermined.pinDetail },
          findings: result.findings,
          blocking: red,
          // dev 链只关心这一件事:离线包是否过期(G5 钉不等同样是"过期")
          bundleStale: red.some((f) => f.code === 'B1' || f.code === 'B2' || f.code === 'G5'),
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

  /* ── I2(G-415/A8)调用点「值→键」成对正反例 ── */
  t('stripJsComments:剥注释但字符串里的 // (URL) 必须活着', () => {
    eq(stripJsComments('const a = 1 // 注释\nconst b = 2'), 'const a = 1 \nconst b = 2', '行注释剥掉')
    eq(stripJsComments('/* 块注释 */ x'), ' x', '块注释剥掉')
    eq(stripJsComments("const u = 'https://cdn.example.com/a.png'"), "const u = 'https://cdn.example.com/a.png'", '字符串内 // 不得当注释')
  })
  t('extractLineIconNameExprs:多行标签 + name 前置箭头函数 prop,都能取到 name', () => {
    const sites = extractLineIconNameExprs(
      `<LineIcon\n  onClick={() => go('a>b')}\n  name={cond ? 'mic' : 'keyboard'}\n  size={40}\n/>`,
    )
    eq(sites.length, 1, '恰好一个调用点')
    eq(sites[0].expr.trim(), "cond ? 'mic' : 'keyboard'", 'name 表达式取全')
  })
  t('lineIconValueLiterals:值位字面量全收,比较位必须排除(阳性+阴性同例)', () => {
    eq(lineIconValueLiterals("'heart'").join(','), 'heart', '整体字面量')
    eq(lineIconValueLiterals("cond ? 'mic' : 'keyboard'").join(','), 'mic,keyboard', '三元两支')
    eq(lineIconValueLiterals("mode === 'voice' ? 'keyboard' : 'mic'").join(','), 'keyboard,mic', '比较位不算值位 —— 漏这条会把每个条件字面量误报成坏键')
    eq(lineIconValueLiterals("(X[p] || 'bot') as IconName").join(','), 'bot', '剥断言与括号后取兜底字面量')
    eq(lineIconValueLiterals('MEDALS[idx]!').length, 0, '非字面量 ⇒ 空,不虚报')
  })
  t('isLineIconEscapeHatch:四种兜法全认得,正常写法一个不冤枉', () => {
    eq(isLineIconEscapeHatch("icon as never"), true, 'as never')
    eq(isLineIconEscapeHatch('th.icon as IconName'), true, 'as IconName')
    eq(isLineIconEscapeHatch("TYPE_ICON[t] as 'heart' | 'star'"), true, "as 字面联合")
    eq(isLineIconEscapeHatch('MEDALS[idx]!'), true, '尾部非空断言')
    eq(isLineIconEscapeHatch("'bot'"), false, '字面量不是逃逸')
    eq(isLineIconEscapeHatch("cond ? 'a' : 'b'"), false, '字面三元不是逃逸')
    eq(isLineIconEscapeHatch('btn.icon'), false, 'IconName 类型的标识符交给 tsc,不冤枉')
  })
  t('countLineIconEscapeHatches:同一份源码的锚点计算单元,与逐点判定同数', () => {
    const src = [
      '<LineIcon name={a as never} />',
      '<LineIcon name={b!} />',
      '<LineIcon name="bot" />',
      '<LineIcon name={c} />',
    ].join('\n')
    eq(countLineIconEscapeHatches(src), 2, '两个逃逸点,字面量与普通标识符不计')
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

  t('端到端(磁盘面):写死的坏图标名判红;合法名与逃逸存量不红(成对)', () => {
    withScratch((dir) => {
      put(dir, ICON_REGISTRY, `export const ICONS = {\n  "bot": "<svg/>",\n  "heart": "<svg/>",\n} as const`)
      put(
        dir,
        `${APP}/src/pages/x.tsx`,
        [
          `export const A = () => <LineIcon name="ghost-key" size={40} />`, // 坏键 ⇒ I2 判红
          `export const B = () => <LineIcon name="bot" size={40} />`, // 合法
          `export const C = () => <LineIcon name={icon as IconName} size={40} />`, // 逃逸 ⇒ 只报数
        ].join('\n'),
      )
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'icons' })
      const i2 = r.findings.filter((f) => f.code === 'I2')
      eq(i2.length, 1, `只有坏字面量判红,实际 ${JSON.stringify(r.findings.map((f) => f.code))}`)
      eq(i2[0].blocking, true, 'I2 字面量档必须 blocking')
      if (!i2[0].detail.includes('ghost-key')) throw new Error(`必须点名坏键,实际:${i2[0].detail}`)
      eq(r.counts.lineIconCallSites, 3, '三个调用点都数到')
      eq(r.undetermined.lineIconEscapeHatchSites, 1, '逃逸点计入存量报数')
    })
  })

  /* ── G5 生成物自述钉(成对正反例,全部跑在临时仓的磁盘面上) ── */
  const pinFixtureInputs = () =>
    REMOTE_LOCALES.flatMap((l) => [
      { rel: `${MESSAGE_ROOT}/shared/${l}.json`, text: JSON.stringify({ hi: `${l}-shared` }) },
      { rel: `${MESSAGE_ROOT}/miniapp-taro/${l}.json`, text: JSON.stringify({ hi: `${l}-app` }) },
    ])
  const putPinFixture = (dir, { pinText, breakInput }) => {
    for (const i of pinFixtureInputs()) put(dir, i.rel, breakInput === i.rel ? '{"hi":"CHANGED"}' : i.text)
    const body = `export const REMOTE_LOCALE_B64: Record<RemoteLocale, string> = {\n}\n`
    put(dir, I18N_BUNDLE, `// GENERATED\n${pinText ?? ''}${body}`)
  }
  t('G5:钉与现算输入哈希一致 ⇒ matched,不得判红', () => {
    withScratch((dir) => {
      const pin = renderPin({
        generator: 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs',
        sourceCommit: 'deadbeef',
        inputs: pinFixtureInputs(),
        generatedAt: '2026-01-01T00:00:00.000Z',
      }).join('\n')
      putPinFixture(dir, { pinText: `${pin}\n` })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'i18n' })
      eq(r.undetermined.pinState, 'matched', `钉应判 matched,实际 ${JSON.stringify(r.undetermined)}`)
      eq(r.findings.filter((f) => f.code === 'G5').length, 0, 'matched 不该产出 G5')
    })
  })
  t('G5:任一份输入变了而钉没重算 ⇒ 判红并点名是哪份(阳性对照)', () => {
    withScratch((dir) => {
      const pin = renderPin({
        generator: 'g',
        inputs: pinFixtureInputs(),
        generatedAt: '2026-01-01T00:00:00.000Z',
      }).join('\n')
      const broken = `${MESSAGE_ROOT}/shared/ja.json`
      putPinFixture(dir, { pinText: `${pin}\n`, breakInput: broken })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'i18n' })
      eq(r.undetermined.pinState, 'stale', `应判 stale,实际 ${r.undetermined.pinState}`)
      const g5 = r.findings.filter((f) => f.code === 'G5')
      eq(g5.length, 1, `应恰好一条 G5,实际 ${g5.length}`)
      eq(g5[0].blocking, true, 'G5 必须是 blocking(它就是"陈旧"这件事的判据)')
      if (!g5[0].detail.includes(broken)) throw new Error(`红点必须点名变了的那份输入,实际:${g5[0].detail}`)
    })
  })
  t('G5:没有钉 ⇒ 未判定(absent),既不判红也不得被读成通过', () => {
    withScratch((dir) => {
      putPinFixture(dir, {})
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'i18n' })
      eq(r.undetermined.pinState, 'absent', `应判 absent,实际 ${r.undetermined.pinState}`)
      eq(r.findings.filter((f) => f.code === 'G5').length, 0, 'absent 不得判红(HEAD 面正是这一态,判红即恒红门)')
    })
  })
  t('G5:钉在而聚合哈希坏掉 ⇒ malformed(未判定),不得冒红也不得记绿', () => {
    withScratch((dir) => {
      const bad = `// ${PIN_BEGIN}\n// generator: g\n// inputsSha256: not-a-hash\n// generatedAt: x\n// ${PIN_END}\n`
      putPinFixture(dir, { pinText: bad })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'i18n' })
      eq(r.undetermined.pinState, 'malformed', `应判 malformed,实际 ${r.undetermined.pinState}`)
      eq(r.findings.filter((f) => f.code === 'G5').length, 0, 'malformed 不是判据失败,不得冒红')
    })
  })
  t('幂等:同一批输入两次 renderPin,屏蔽时刻行后必须逐字节全等', () => {
    const mk = (iso) =>
      renderPin({ generator: 'g', sourceCommit: 'abc', inputs: pinFixtureInputs(), generatedAt: iso }).join('\n')
    const a = maskGeneratedAt(mk('2026-01-01T00:00:00.000Z'))
    const b = maskGeneratedAt(mk('2026-09-29T23:59:59.999Z'))
    eq(a, b, '两次生成的钉屏蔽时刻后必须同字节(幂等性是本票的生命线)')
    if (mk('2026-01-01T00:00:00.000Z') === mk('2026-09-29T23:59:59.999Z')) {
      throw new Error('时刻行本应让原始字节不同 —— 相同说明 generatedAt 没写进去,幂等断言就是空的')
    }
  })
  t('字节归一:同一内容 CRLF 与 LF 必须算出同一个哈希(否则 Windows 检出的磁盘 vs git blob 恒红)', () => {
    const lf = [{ rel: 'a.json', text: '{\n "k": 1\n}\n' }]
    const crlf = [{ rel: 'a.json', text: '{\r\n "k": 1\r\n}\r\n' }]
    const bom = [{ rel: 'a.json', text: '﻿{\n "k": 1\n}\n' }]
    eq(digestInputs(lf).digest, digestInputs(crlf).digest, 'CRLF 归一')
    eq(digestInputs(lf).digest, digestInputs(bom).digest, 'BOM 归一')
  })

  /* ── G-816040 四端 ui-routes(成对正反例,web 磁盘面夹具) ── */
  const WEB_PAGE_REL = 'apps/web/app/(main)/x/page.tsx'
  const WEB_ART_REL = 'apps/web/src/lib/ui-routes.generated.ts'
  const webPageText = () => 'export default function XPage() {\n  return null\n}\n'
  /** web 单产物夹具:钉默认按盘面输入现算(withPin=false 出 absent 态;pinInputs 换成旧输入出 stale 态) */
  const webFixture = (dir, { routes, pinInputs, pageText, withPin = true } = {}) => {
    const onDisk = pageText ?? webPageText()
    put(dir, WEB_PAGE_REL, onDisk)
    const pinText = withPin
      ? renderPin({
          generator: 'apps/web/scripts/generate-ui-routes.mjs',
          sourceCommit: 'deadbeef',
          inputs: pinInputs ?? [{ rel: WEB_PAGE_REL, text: onDisk }],
          generatedAt: '2026-01-01T00:00:00.000Z',
        }).join('\n')
      : ''
    const routeLines = routes ?? [`  { path: '/x', param: false, group: 'x' },`]
    put(
      dir,
      WEB_ART_REL,
      `// GENERATED\n${pinText ? `${pinText}\n` : ''}export const UI_ROUTES: { path: string; param: boolean; group: string }[] = [\n${routeLines.join('\n')}\n]\n`,
    )
  }
  const webStateOf = (r) => r.undetermined.uiRoutesPins.find((s) => s.rel === WEB_ART_REL)

  t('G-816040 web:钉 matched 且名集相等 ⇒ 全绿(阳性对照,防本门自己恒红)', () => {
    withScratch((dir) => {
      webFixture(dir)
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(webStateOf(r)?.state, 'matched', `web 产物应判 matched,实际 ${JSON.stringify(r.undetermined.uiRoutesPins)}`)
      eq(r.findings.filter((f) => f.code === 'U1' || f.code === 'G5').length, 0, '齐全时不该有红')
    })
  })
  t('G-816040 web:手改产物路由 ⇒ 钉仍 matched 但 U1 判红并点名两侧差(验收例「手改一字节必红」)', () => {
    withScratch((dir) => {
      webFixture(dir, { routes: [`  { path: '/y', param: false, group: 'x' },`] })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      const u1 = r.findings.filter((f) => f.code === 'U1')
      eq(u1.length, 1, `应恰好一条 U1,实际 ${JSON.stringify(r.findings)}`)
      eq(u1[0].blocking, true, 'U1 必须 blocking(它就是「产物被手改」的判据)')
      if (!u1[0].detail.includes('/x') || !u1[0].detail.includes('/y')) {
        throw new Error(`必须点名两侧名集差,实际:${u1[0].detail}`)
      }
    })
  })
  t('G-816040 web:输入 page.tsx 变了而钉没重算 ⇒ G5 判红并点名该输入', () => {
    withScratch((dir) => {
      // 钉按旧文本烘(生成器当时跑过),盘面输入换成新文本 = 「源改了产物没跟上」
      webFixture(dir, {
        pageText: 'export default function CHANGED() {\n  return null\n}\n',
        pinInputs: [{ rel: WEB_PAGE_REL, text: webPageText() }],
      })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      const g5 = r.findings.filter((f) => f.code === 'G5')
      eq(g5.length, 1, `应恰好一条 G5,实际 ${JSON.stringify(r.findings)}`)
      eq(g5[0].blocking, true, 'G5 必须 blocking')
      if (!g5[0].detail.includes(WEB_PAGE_REL)) throw new Error(`必须点名变了的输入,实际:${g5[0].detail}`)
      eq(webStateOf(r)?.state, 'stale', `应判 stale,实际 ${webStateOf(r)?.state}`)
    })
  })
  t('G-816040 web:没有钉 ⇒ 未判定(absent),不冒红也不记绿(HEAD 面正是这一态)', () => {
    withScratch((dir) => {
      webFixture(dir, { withPin: false })
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(webStateOf(r)?.state, 'absent', `应判 absent,实际 ${webStateOf(r)?.state}`)
      eq(r.findings.length, 0, 'absent 不得判红')
    })
  })
  t('evalTaroConfigText:defineAppConfig 形态求值出 pages/subPackages(与 taro 生成器同规则)', () => {
    const cfg = evalTaroConfigText(
      "export default defineAppConfig({\n  pages: ['pages/index'],\n  subPackages: [{ root: 'pkg-ai', pages: ['ai/chat'] }],\n})\n",
    )
    eq(cfg.pages.join(','), 'pages/index', '主包页')
    eq(cfg.subPackages[0].root, 'pkg-ai', '分包 root')
    eq(taroPageList(cfg).join(','), 'pages/index,pkg-ai/ai/chat', '分包页拼 root')
  })

  /* ── G-816040 写回档(--heal-ui-routes,2026-10-10):成对正反例 ──
   * 夹具跑的是**真生成器本体**(从仓库源读进来装进临时树)—— 写回出口的"能不能修"必须由那件
   * 生成器自己回答,拿一份假的产物写手测出来的绿等于什么都没测(与"生成器漏跑"这一型同形)。
   */
  const GEN_REL_WEB = 'apps/web/scripts/generate-ui-routes.mjs'
  const PIN_LIB_REL = 'scripts/lib/generated-input-pin.mjs'
  const CONSUMER_WEB_REL = 'apps/web/src/lib/ui-action-registry.ts'
  /** 把真生成器 + 唯一钉实现 + 消费方契约装进临时树;取不到源 ⇒ 直接抛,不得静默跳过这一例 */
  const putWebGeneratorKit = (dir, { withGenerator = true } = {}) => {
    for (const rel of [GEN_REL_WEB, PIN_LIB_REL]) {
      if (rel === GEN_REL_WEB && !withGenerator) continue
      const src = readWorktreeFile(DEFAULT_ROOT, rel)
      if (src === null) throw new Error(`写回档夹具装不进:${rel} 在磁盘面上取不到`)
      put(dir, rel, src)
    }
    put(
      dir,
      CONSUMER_WEB_REL,
      "import { UI_ROUTES } from './ui-routes.generated'\nexport const R = UI_ROUTES // 消费方引用 ui-routes.generated\n",
    )
  }
  /** 陈旧现场:盘面输入是新文本,产物钉按旧文本烘(= 「page.tsx 改了并入库,产物没跟上」) */
  const putStaleWebArtifact = (dir, padRoutes = 0) => {
    const oldText = 'export default function OLD() {\n  return null\n}\n'
    put(dir, WEB_PAGE_REL, webPageText())
    const pin = renderPin({
      generator: GEN_REL_WEB,
      sourceCommit: 'deadbeef',
      inputs: [{ rel: WEB_PAGE_REL, text: oldText }],
      generatedAt: '2026-01-01T00:00:00.000Z',
    }).join('\n')
    const lines = [`  { path: '/x', param: false, group: 'x' },`]
    for (let i = 0; i < padRoutes; i += 1)
      lines.push(`  { path: '/pad${i}', param: false, group: 'x' },`)
    put(
      dir,
      WEB_ART_REL,
      `// GENERATED\n${pin}\nexport const UI_ROUTES: { path: string; param: boolean; group: string }[] = [\n${lines.join('\n')}\n]\n`,
    )
  }
  const webRowOf = (res) => res.rows.find((r) => r.rel === WEB_ART_REL)

  t('写回档(阳性对照):输入变了而钉没跟 ⇒ 真跑生成器写回,判定轮在同一个面复检到绿', () => {
    withScratch((dir) => {
      putWebGeneratorKit(dir)
      putStaleWebArtifact(dir)
      const before = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(
        before.findings.filter((f) => f.code === 'G5').length,
        1,
        '夹具必须先红(先红都不成立就是这条对照在空转)',
      )
      const res = healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      eq(res.code, 0, `写回档不得因"正常写回"而退出非 0,实际 ${res.code}`)
      eq(webRowOf(res).action, 'healed', `web 行应写回,实际 ${JSON.stringify(webRowOf(res))}`)
      const after = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(after.findings.length, 0, `写回后同面复检必须无红,实际 ${JSON.stringify(after.findings)}`)
      eq(
        after.undetermined.uiRoutesPins.find((s) => s.rel === WEB_ART_REL)?.state,
        'matched',
        '复检必须真判到 matched(不是把红改成不报)',
      )
    })
  })

  t('写回档(幂等锁):同一现场第二次跑必须写回 0 字节(登记表 failMode=block 的前置依据)', () => {
    withScratch((dir) => {
      putWebGeneratorKit(dir)
      putStaleWebArtifact(dir)
      healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      const once = readWorktreeFile(dir, WEB_ART_REL)
      const res = healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      eq(webRowOf(res).action, 'clean', `第二次必须判"无需写回",实际 ${webRowOf(res).action}`)
      eq(res.healed, 0, '第二次不得再写任何产物')
      eq(readWorktreeFile(dir, WEB_ART_REL), once, '第二次跑后产物必须逐字节不动')
    })
  })

  t('写回档(生成器修不了那半):生成器不在位 ⇒ 拒绝写回、产物不动、判定侧仍红(不得静默记绿)', () => {
    withScratch((dir) => {
      putWebGeneratorKit(dir, { withGenerator: false })
      putStaleWebArtifact(dir)
      const before = readWorktreeFile(dir, WEB_ART_REL)
      const res = healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      eq(webRowOf(res).action, 'refuse', `生成器不可用必须拒绝写回,实际 ${webRowOf(res).action}`)
      eq(readWorktreeFile(dir, WEB_ART_REL), before, '拒绝写回时产物字节不得动(不许"半修")')
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(r.findings.filter((f) => f.code === 'G5').length, 1, '修不了就还是红 —— 写回出口不产出绿')
    })
  })

  t('写回档(面上没有产物):refuse 且不凭空造文件(判定侧同事件仍是 file-absent 未判定)', () => {
    withScratch((dir) => {
      putWebGeneratorKit(dir)
      put(dir, WEB_PAGE_REL, webPageText())
      const res = healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      eq(webRowOf(res).action, 'refuse', `面上没有该产物 ⇒ 不写回,实际 ${webRowOf(res).action}`)
      eq(readWorktreeFile(dir, WEB_ART_REL), null, '写回出口不得把"面上没有的文件"造出来')
      const r = runCheck({ face: 'worktree', root: dir, strict: false, group: 'ui-routes' })
      eq(
        r.undetermined.uiRoutesPins.find((s) => s.rel === WEB_ART_REL)?.state,
        'file-absent',
        '判定侧口径不变:仍是未判定,不是绿',
      )
    })
  })

  t('写回档(量级闸):写回量 > 上限 ⇒ 复原并拒绝(异常量级必须让人看见,不自动背书)', () => {
    withScratch((dir) => {
      putWebGeneratorKit(dir)
      const pad = MAX_HEAL_CHANGED_LINES + 60
      putStaleWebArtifact(dir, pad)
      const before = readWorktreeFile(dir, WEB_ART_REL)
      const res = healUiRoutes({ face: 'worktree', root: dir, log: () => {} })
      const row = webRowOf(res)
      eq(
        row.action,
        'refuse',
        `超量级必须拒绝,实际 ${row.action} —— 夹具造的量级不够,需 ${pad} 条路由`,
      )
      if (!row.note.includes('量级')) throw new Error(`拒绝理由必须点名量级,实际:${row.note}`)
      eq(readWorktreeFile(dir, WEB_ART_REL), before, '超量级拒绝后必须复原到原字节')
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
  readPinInputs,
  checkBundlePin,
  // G-680:钉的实现只有一份,门与生成器都引它 —— 导出给镜像测试做"不得有第二份"的形状锁
  pinKit: { digestInputs, parsePin, renderPin, maskGeneratedAt, PIN_BEGIN },
  assetRefToRepoRel,
  collectAssetRefs,
  registryKeys,
  generatorTabbarNames,
  stripJsComments,
  extractLineIconNameExprs,
  lineIconValueLiterals,
  isLineIconEscapeHatch,
  countLineIconEscapeHatches,
  runCheck,
  parseArgv,
  main,
  ASSET_LIT_RE,
  DYN_PATH_RE,
  REMOTE_LOCALES,
  MESSAGE_ROOT,
  I18N_BUNDLE,
  ICON_REGISTRY,
  TABBAR_GENERATOR,
  // G-816040:四端 ui-routes 对账规格与其源侧派生件(镜像测试锁形状用)
  UI_ROUTES_ARTIFACTS,
  evalTaroConfigText,
  taroPageList,
  // 四端输入面的锚点:镜像测试的 T21 装车锁要用它们复算真输入清单,再对账登记表的触发面
  WEB_APP_PREFIX,
  TARO_APP_CONFIG,
  RN_NAVIGATOR,
  RN_LINKING,
  EXT_SIDEPANEL,
  // G-816040 写回档(2026-10-10):镜像测试要的是"写回出口真在位 + 量级闸的口径",不是第二份判据
  healUiRoutes,
  lineChangeCount,
  MAX_HEAL_CHANGED_LINES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
