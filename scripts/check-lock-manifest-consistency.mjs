#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-lock-manifest-consistency.mjs — package.json 依赖声明 ↔ pnpm-lock.yaml importer specifier 对账
 *
 * 立的因(2026-09-24 真实事故):apps/web/package.json 声明 `"xlsx": "^0.18.5"`,
 * 而 lock 的 importers.apps.web.dependencies.xlsx.specifier 记 `npm:@e965/xlsx@^0.20.3`。
 * 后果不是报错,而是 pnpm 整段跳过 apps/web 的链接步骤 —— install / install --force 都在
 * 285ms 内回 "Already up to date",三条依赖永不落地,生产 next build 报 Module not found,
 * 本机 typecheck 全绿。本地任何编译/ lint / 单测都看不见这一类缺陷,只有对账能看见。
 *
 * 判据:
 *   R1 声明了但 lock 的 importer 里没有 ⇒ 红(缺记账;workspace:/catalog: 协议声明同样参与比对)
 *   R2 specifier 字符串不相等 ⇒ 红(即本次事故形态,含 npm: 别名不一致)
 *   R3 lock importer 有、package.json 已不声明 ⇒ 不计红但如实报数(孤儿记账)
 *   解析不到 / 结构不认识 ⇒ exit 2 "无法判定",绝不静默记为通过
 *
 * 两个"pnpm 自己的合法记账行为"维度(2026-09-24 补,不加就会恒红 22 枚→逼人跳闸):
 *   R4 维度 A = pnpm-workspace.yaml 的 overrides 参与比对。被 override 的依赖,pnpm 写进
 *      lock 的 specifier 是 **override 后的目标值**,与 package.json 原始声明天然不等
 *      (真仓实测 19 枚,如 @types/node ^22/^26→26.1.2、postcss ^8.4.49→^8.5.23)。
 *      期望值改取 override 目标:lock == override 目标 ⇒ 绿;lock 既不等于 manifest 原值
 *      也不等于任何 override 目标 ⇒ **仍红**。反向半边由严格侧兜住:某依赖只有**唯一一条
 *      裸名 override**(无 @版本选择器)时,pnpm 必然把 override 目标落进 lock,于是
 *      "lock 仍等于 manifest 原值"本身即缺陷(kind=override-not-applied,lock 被手改/未跑
 *      全量 install)—— 所以 R4 不是"命中 override 就不判"的无条件豁免。
 *      键形态两种(真仓实测均为扁平 map):裸名 `ioredis: 6.0.0`,以及**名字前缀 + 版本选择器**
 *      `postcss@<=8.5.22: ^8.5.23` / `fast-uri@>=3.0.0 <3.1.6: ^3.1.6`。后者必须按"包名前缀"
 *      归属(scoped 名首个 @ 属于 scope,不得当作名字起点),裸等值比对会整类看不见。
 *      带选择器的条目刻意**不**去判"声明区间是否落在选择器内"(那要引 semver range 引擎):
 *      它只往"可接受的期望值"集合里加值,不会拿走 manifest 等值这条绿路,因此只会少判
 *      不会误红。父作用域键 `foo>bar`(真仓 0 条;`>=` 里的 > 不是分隔符,见 splitOverrideKey)
 *      只作用于传递依赖,不参与直接声明比对,如实计数。
 *   R5 维度 B = peerDependencies 的记账形态。pnpm 把 peer 记进 lock 的 **devDependencies 段**
 *      且 specifier 是解析后的范围(真仓实测 3 枚:@tarojs/taro >=4.0.0→4.2.1、
 *      packages/app 的 react / react-native),值天然漂移 ⇒ **不比 specifier,但仍要求
 *      lock 的任一段里有它的条目**(缺条目仍红)。R4 与 R5 同时命中时按 R5 放过值比对。
 *   R4/R5 放过的每一条(仅统计"值确实不同却被放过"的那些)都进 overrideExempted /
 *   peerExempted,并在结论行报数与 --json 里可审计(含命中的 override key),不静默变绿。
 *
 * 模式与**判定面**(2026-09-24 收口到本仓对"读内容作判据"的既立口径,同守门 70/77/83/98):
 *   缺省(全量审计) 判 **HEAD blob**(`git show HEAD:<path>`)
 *   --staged        判**索引 blob**(`git show :<path>`)—— pre-commit 模式
 *   --head          显式判 HEAD(与缺省同,给测试/人工复验用)
 *   --worktree      显式判磁盘工作树,**只是人工排查的逃生舱**,不在提交链上
 *   为什么不得判盘(两条都是真失效,不是洁癖):
 *     · 假绿:`git add` 了一对不一致的 package.json/lock,作者随后又把磁盘文件改对 ⇒
 *       判盘全绿,而**提交进去的那一对是坏的** —— 今天卡死生产构建的正是这一形态。
 *     · 假红:共享工作区常年有几十个在途文件,盘上内容属于另一个会话的半编辑态;
 *       拿它判红会逼人 `--no-verify`,而跳闸一次等于全部守门作废(宁可不判,不产红到逼人跳闸)。
 *   三种模式下**所有**参与比对的文件(pnpm-workspace.yaml、pnpm-lock.yaml、每个包的
 *   package.json)一律经同一个出口 `reader.readFace(rel)` 取,不得一半读盘一半读 git ——
 *   混面会产出比读盘更糟的假结论。包清单的存在性/目录枚举同样取自该面。
 *   取不到(该面没这个路径 / 是二进制 / git 调用失败)⇒ 显式 exit 2 并点名路径,
 *   **绝不允许"取不到就跳过该包然后报绿"**。
 *   对账范围恒为全量:某包破损与"本次改了什么"无关,按暂存子集收窄会放过整类。
 *   取材实现所在(2026-09-25 收口):绝对路径 git、`-c safe.directory=*`、一次
 *   `cat-file --batch` 读完一批(不得逐文件派生 git)、batch 的 stdio[0] 必须是 'pipe'(设成
 *   'ignore' 会让 git 读到空输入,于是每个 rev 都"取不到" —— 本门第一次真仓自验就是被这一条
 *   咬出的假 exit 2)、junction 下的仓库根比较、64MB maxBuffer —— 全部由
 *   `scripts/lib/face-reader.mjs` 单点持有。本门只留自己需要的**形状适配**(`has` / `listDir`:
 *   94 要文件清单、101 要包清单,层刻意不统一对外形状)。再抄一份实现等于再抄一份风险。
 *   --json     机器可读输出(judgedFace 如实标面)
 *   --root <d> 显式指定仓库根(测试通道;缺省由脚本自身位置推导)。注意配 --worktree
 *              才按磁盘判 —— 磁盘夹具目录通常不是 git 仓,判 HEAD/索引会如实 exit 2。
 *   --self-test 临时目录小 fixture 正反成对自检(绝不扫真仓)
 *
 * 退出码:0 通过 / 1 业务违规 / 2 无法判定或脚本自身异常
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判定面取材的唯一实现(2026-09-25 收口)。本门此前自带一份 git 派生 + cat-file batch,而五处
// 易错点(裸 'git'、batch 的 stdio[0]='ignore'、逐文件派生、junction 下的仓库根比较、maxBuffer)
// 重复一份就是重复一份风险 —— 现在只从这里取。
import {
  FACES,
  FACE_LABEL,
  FACE_NOTE,
  Undetermined,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  sameDir,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
/** 夹具仓派生的超时(真仓取材的超时与 maxBuffer 由共用层自己兜) */
const GIT_TIMEOUT = 60000

/**
 * 单一取内容出口。`readFace(rel)` 是三态里**同一个面**的内容;`has`/`listDir` 让包清单的
 * 存在性与目录枚举也取自同一面(否则 glob 枚举读盘、内容读 git = 混面)。
 * git 调用一律惰性:失败抛 Undetermined ⇒ runCheck 收成 undetermined ⇒ exit 2,绝不记绿。
 *
 * 2026-09-25 起这一层只剩**本门特有的形状适配** —— 派生本体(绝对路径 git + safe.directory +
 * windowsHide + timeout + maxBuffer、`cat-file --batch`、穿 junction 的仓库根比较、磁盘面读取)
 * 全在 `scripts/lib/face-reader.mjs`;`has` / `listDir` 这两件套共用层刻意不提供(94 要文件
 * 清单、101 要包清单),所以由本门用它给的原语拼出来。
 */
export function makeFaceReader(face, root) {
  if (!FACES.includes(face)) throw new Undetermined(`未知判定面 "${face}"(允许: ${FACES.join(' / ')})`)
  const cache = new Map()
  const label = FACE_LABEL[face]
  if (face === 'worktree') {
    return {
      face,
      label,
      root,
      has(rel) {
        return existsSync(join(root, rel))
      },
      listDir(dirRel) {
        const base = dirRel === '.' || dirRel === '' ? root : join(root, dirRel)
        if (!existsSync(base)) return []
        try {
          return readdirSync(base, { withFileTypes: true }).filter((c) => c.isDirectory()).map((c) => c.name)
        } catch (e) {
          throw new Undetermined(`${label} 列目录 ${dirRel} 失败: ${e.message}`)
        }
      },
      readFace(rel) {
        if (cache.has(rel)) return cache.get(rel)
        // 层的 readWorktreeFile 只在"读失败"时抛(编码/权限错误原样点名,不伪装成业务结论),
        // 文案与本门旧版逐字同;"不存在"与"含 NUL 的二进制"合并成 null —— 两种都必须在**这里**
        // 抛掉,不得让调用方当成"没有这个包"跳过后报绿。
        const text = readWorktreeFile(root, rel)
        if (text === null) {
          throw new Undetermined(`${label} 取不到 ${rel}(不存在、是目录或含 NUL 的二进制),无法比对`)
        }
        cache.set(rel, text)
        return text
      },
      prefetch() {},
    }
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  let tracked = null
  function loadTracked() {
    if (tracked) return tracked
    // 面判定的相对基准必须是"仓库根":`ls-files --full-name` 与 `cat-file :<rel>` 都按仓库根
    // 解释路径,而 root 若是仓库的**子目录**,两者与 join(root,rel) 的基准就会错位 ——
    // 那正好产出门最不该产出的东西:看起来自洽、实则混面的绿。故显式判死,不做静默容忍。
    let top
    try {
      top = gitRaw(['rev-parse', '--show-toplevel'], root).trim()
    } catch (e) {
      throw new Undetermined(`${e.message} —— ${label} 只在 git 仓库根可用,人工排查磁盘状态请用 --worktree`)
    }
    const want = root.replace(/\\/g, '/')
    // 层的 sameDir 先各自 realpath 再比:§26 的 junction 改道让同一目录有两个字面写法,
    // 只比字面路径会把正常仓判成"基准错位"。
    if (!sameDir(top, root)) {
      throw new Undetermined(`${label} 只能在 git 仓库根判定:--root 给的是 ${want},而该目录的 toplevel 是 ${top}`)
    }
    // 索引面不需要提交存在(`git add` 过、尚未 commit 的中间态正是要判的对象);
    // HEAD 面则必须显式失败,绝不退化成"扫到 0 个包所以绿"。
    // 这里不加 `--quiet`:git 那句 "fatal: Needed a single revision" 早先会直接写在本门
    // stderr 上(本门的输出即结论)。根因是派生层没接管 stdio —— 已在
    // `lib/face-reader.mjs` 的 gitRaw 里以显式 stdio 修掉,故门的绕行一并撤除。
    if (face === 'head') {
      try {
        gitRaw(['rev-parse', '--verify', 'HEAD'], root)
      } catch {
        throw new Undetermined(`git rev-parse --verify HEAD 在 ${root} 取不到:该面没有可用提交`)
      }
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
    root,
    has(rel) {
      return loadTracked().has(rel)
    },
    listDir(dirRel) {
      const p = dirRel === '.' || dirRel === '' ? '' : `${dirRel}/`
      const out = new Set()
      for (const file of loadTracked()) {
        if (!file.startsWith(p)) continue
        const seg = file.slice(p.length).split('/')[0]
        if (seg) out.add(seg)
      }
      return [...out]
    },
    prefetch(rels) {
      const need = rels.filter((r) => !cache.has(r))
      if (need.length === 0) return
      const got = catBatch(root, need.map((r) => prefix + r))
      for (const r of need) cache.set(r, got.get(prefix + r) ?? null)
    },
    readFace(rel) {
      if (!cache.has(rel)) this.prefetch([rel])
      const text = cache.get(rel)
      if (text === null || text === undefined) {
        throw new Undetermined(
          `${label} 取不到 ${rel}(该面没有此路径、是 unmerged 或不是 blob)—— 拒绝"取不到就跳过"再报绿`,
        )
      }
      if (text.includes('\u0000')) throw new Undetermined(`${label} 的 ${rel} 是二进制,无法比对`)
      return text
    },
  }
}

/** 共用层解析出的 git 绝对路径(§5b:GUI 宿主 / 服务账户的 PATH 与交互终端不通)。
 *  本门不再自己派生 git,这个名字保留给镜像测试与人工核验取用。 */
const GIT_BIN = gitBinary()

function unquoteScalar(raw) {
  let s = String(raw).trim()
  if (s === '') return ''
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'")
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  const c = s.indexOf(' #')
  if (c > -1) s = s.slice(0, c).trimEnd()
  return s
}

export function parseWorkspaceGlobs(text) {
  const lines = String(text).split(/\r?\n/)
  const includes = []
  const excludes = []
  let inList = false
  for (const line of lines) {
    if (/^packages:\s*$/.test(line)) {
      inList = true
      continue
    }
    if (!inList) continue
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) {
      inList = false
      continue
    }
    const m = line.match(/^\s*-\s*(.+?)\s*$/)
    if (!m) throw new Undetermined(`pnpm-workspace.yaml packages 列表项不认识: ${line}`)
    const value = unquoteScalar(m[1])
    if (!value) continue
    if (value.startsWith('!')) excludes.push(value.slice(1))
    else includes.push(value)
  }
  if (includes.length === 0) {
    throw new Undetermined('pnpm-workspace.yaml 没有可识别的 packages: 列表')
  }
  return { includes, excludes }
}

function globToRegExp(pattern) {
  const source = pattern
    .split('/')
    .map((seg) => (seg === '*' ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return new RegExp(`^${source}$`)
}

function discoverPackages(reader) {
  if (!reader.has('package.json')) {
    throw new Undetermined(`${reader.label} 的 ${reader.root} 下没有 package.json,不像 workspace 根`)
  }
  const { includes, excludes } = parseWorkspaceGlobs(reader.readFace('pnpm-workspace.yaml'))
  const relSet = new Set(['.'])
  for (const pattern of includes) {
    if (pattern.endsWith('/*')) {
      const parent = pattern.slice(0, -2)
      for (const child of reader.listDir(parent)) {
        const rel = !parent || parent === '.' ? child : `${parent}/${child}`
        if (!reader.has(`${rel}/package.json`)) continue
        relSet.add(rel)
      }
    } else if (!pattern.includes('*')) {
      if (reader.has(`${pattern}/package.json`)) relSet.add(pattern)
    } else {
      throw new Undetermined(`不支持的 workspace glob 形态(只支持尾段 * 或字面路径): ${pattern}`)
    }
  }
  const excludeRes = excludes.map(globToRegExp)
  return [...relSet].filter((rel) => !excludeRes.some((re) => re.test(rel))).sort()
}

/** 只有 manifest 声明里的"非 registry 协议"值不参与 override 严格判(它们本就不由 override 改写) */
const NON_REGISTRY_PROTOCOL = /^(workspace:|catalog:|link:|file:|git:|git\+:|github:|gitlab:|https?:)/

export function isRegistryRange(spec) {
  return typeof spec === 'string' && spec !== '' && !NON_REGISTRY_PROTOCOL.test(spec)
}

/**
 * override 键归属拆分。真仓实测两种形态:
 *   `ioredis` / `@types/react`                → 裸名(selector = null,无条件生效)
 *   `postcss@<=8.5.22` / `fast-uri@>=3.0.0 <3.1.6` → 名字前缀 + 版本选择器
 * scoped 名的**首个** @ 属于 scope,故搜索起点必须跳过它(朴素 split('@')[0] 会把
 * `@types/react@^19` 拆成空名,整类 scoped override 就此隐身)。
 *
 * `>` 有两种语义,必须分清(建门实测踩到,真仓 13 条键全部带 `>=`):
 *   - 版本比较符 `>=` —— 属于选择器,**不是**父作用域
 *   - pnpm 的父作用域分隔符 `foo>bar` / `@scope/p>@scope/c` —— 只作用于传递依赖 bar,
 *     不得按名字命中"直接声明",否则等于凭空多一个可接受值
 * 判据:紧跟 `>` 的不是 `=` / 数字 / `v`(版本号起点)时才是父作用域分隔符。
 * 残余歧义(`foo>x-ray` 这类以 x/v 开头的子包名)一律**偏向"当作选择器"**:
 * 最坏结果只是给父包多一个可接受值(少判),绝不会产出假红。
 */
const PARENT_SCOPED_SEP = />(?![=\d*v])/

export function splitOverrideKey(key) {
  const k = String(key)
  if (PARENT_SCOPED_SEP.test(k)) return { name: k, selector: null, parentScoped: true }
  const at = k.indexOf('@', k.startsWith('@') ? 1 : 0)
  if (at <= 0) return { name: k, selector: null, parentScoped: false }
  return { name: k.slice(0, at), selector: k.slice(at + 1), parentScoped: false }
}


/**
 * 读 pnpm-workspace.yaml 的 overrides 扁平表(维度 A 的输入)。
 * 没有该段 ⇒ 空表(合法,退化为纯 manifest 比对);
 * 认识不了的形态(缩进非 2 / 无冒号 / 值为空 / 值为嵌套 map|list)⇒ Undetermined,
 * 因为 override 表读不全的直接后果是**产出假红**,与本文件 parseLockImporters 同一取向。
 */
export function parseWorkspaceOverrides(text, sourceLabel = 'pnpm-workspace.yaml') {
  const lines = String(text).split(/\r?\n/)
  const start = lines.findIndex((l) => /^overrides:(\s*\{\}\s*(#.*)?|\s*(#.*)?)?$/.test(l))
  if (start === -1) return []
  if (/^overrides:\s*\{\}/.test(lines[start])) return []
  const entries = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) break
    const indent = line.length - line.trimStart().length
    if (indent !== 2) {
      throw new Undetermined(`${sourceLabel} overrides 段第 ${i + 1} 行缩进 ${indent} 不认识(只支持扁平 2 空格表)`)
    }
    const m = line.match(/^ {2}(.+?):\s*(.*)$/)
    if (!m) throw new Undetermined(`${sourceLabel} overrides 条目行不认识(第 ${i + 1} 行): ${line}`)
    const key = unquoteScalar(m[1])
    const value = unquoteScalar(m[2])
    if (!key || !value || value.startsWith('{') || value.startsWith('[')) {
      throw new Undetermined(`${sourceLabel} overrides 第 ${i + 1} 行的键值形态不认识: ${line}`)
    }
    entries.push({ key, value })
  }
  return entries
}

/** 命中某个依赖名的全部 override 条目(裸名 + 该名字前缀的版本选择器) */
export function matchOverrideTargets(entries, name) {
  const out = []
  for (const e of entries) {
    const split = splitOverrideKey(e.key)
    if (split.parentScoped || split.name !== name) continue
    out.push({ key: e.key, value: e.value, selector: split.selector })
  }
  return out
}


/**
 * 只解析 importers: 块。lockfile v9 该块是高度规则的 YAML:
 * 缩进 2=包路径 / 4=依赖段 / 6=包名 / 8=specifier|version。
 * 任何认识不了的缩进、tab、未知段名一律 Undetermined —— 判据失效必须表现为红,不能表现为绿。
 */
export function parseLockImporters(text) {
  const lines = String(text).split(/\r?\n/)
  if (!lines.some((l) => /^lockfileVersion:/.test(l))) {
    throw new Undetermined("pnpm-lock.yaml 没有 'lockfileVersion:' 行")
  }
  const start = lines.findIndex((l) => /^importers:(\s+(#.*)?)?$/.test(l))
  if (start === -1) throw new Undetermined('pnpm-lock.yaml 里找不到 importers: 顶层块')
  const importers = new Map()
  let sections = null
  let sectionName = null
  let dep = null
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue
    if (/^\S/.test(line)) break
    const indent = line.length - line.trimStart().length
    if (line.slice(0, indent).includes('\t')) {
      throw new Undetermined(`importers 块第 ${i + 1} 行缩进含 tab`)
    }
    if (indent === 2) {
      const m = line.match(/^ {2}(.+?):\s*(\{\})?$/)
      if (!m) throw new Undetermined(`importer 路径行不认识(第 ${i + 1} 行): ${line}`)
      const map = new Map()
      importers.set(unquoteScalar(m[1]), map)
      sections = map
      sectionName = null
      dep = null
      continue
    }
    if (indent === 4) {
      if (!sections) throw new Undetermined(`第 ${i + 1} 行的依赖段出现在任何 importer 之前`)
      const m = line.match(/^ {4}(.+?):\s*(\{\})?$/)
      if (!m) throw new Undetermined(`依赖段行不认识(第 ${i + 1} 行): ${line}`)
      sectionName = unquoteScalar(m[1])
      if (!DEP_SECTIONS.includes(sectionName)) {
        throw new Undetermined(`importer 里出现未知依赖段 "${sectionName}"(第 ${i + 1} 行)`)
      }
      dep = null
      if (!sections.has(sectionName)) sections.set(sectionName, new Map())
      continue
    }
    if (indent === 6) {
      if (!sectionName) throw new Undetermined(`第 ${i + 1} 行的包名出现在任何依赖段之外`)
      const m = line.match(/^ {6}(.+?):\s*$/)
      if (!m) throw new Undetermined(`包名行不认识(第 ${i + 1} 行): ${line}`)
      dep = { specifier: null }
      sections.get(sectionName).set(unquoteScalar(m[1]), dep)
      continue
    }
    if (indent === 8) {
      const m = line.match(/^ {8}([A-Za-z]+):\s*(.*)$/)
      if (!m || !dep) throw new Undetermined(`specifier/version 行不认识(第 ${i + 1} 行): ${line}`)
      if (m[1] === 'specifier') dep.specifier = unquoteScalar(m[2])
      else if (m[1] !== 'version' && m[1] !== 'optional') {
        throw new Undetermined(`importer 依赖项下出现未知字段 "${m[1]}"(第 ${i + 1} 行)`)
      }
      continue
    }
    throw new Undetermined(`importers 块第 ${i + 1} 行缩进 ${indent} 不认识`)
  }
  if (importers.size === 0) throw new Undetermined('importers: 块解析结果为 0 个 importer')
  return importers
}

export function compareDeclarations(declaredBySection, lockSections, overrideEntries = []) {
  const violations = []
  const orphans = []
  const overrideExempted = []
  const peerExempted = []
  const declaredNames = new Set()
  for (const section of DEP_SECTIONS) {
    for (const [name, spec] of Object.entries(declaredBySection[section] ?? {})) {
      declaredNames.add(name)
      const candidates = []
      const own = lockSections.get(section)?.get(name)
      if (own) candidates.push({ in: section, entry: own })
      for (const s of lockSections.keys()) {
        if (s === section) continue
        const e = lockSections.get(s).get(name)
        if (e) candidates.push({ in: s, entry: e })
      }
      if (candidates.length === 0) {
        violations.push({ kind: 'missing', section, name, declared: spec, locked: null, lockedIn: null })
        continue
      }
      const pick = candidates.find((c) => c.in === section) ?? candidates[0]
      // 维度 B:peer 的 lock 记账常在别的段且值是解析后的范围 ⇒ 不比值,只验条目在位(缺条目已红)
      if (section === 'peerDependencies') {
        // 只把"值确实不同却被放过"计入报数,逐字相同的 peer 属于正常绿,不算豁免
        if (pick.entry.specifier !== spec) {
          peerExempted.push({ section, name, declared: spec, locked: pick.entry.specifier, lockedIn: pick.in })
        }
        continue
      }
      const targets = matchOverrideTargets(overrideEntries, name)
      const values = [...new Set(targets.map((t) => t.value))]
      // 维度 A(宽松侧):lock 等于任一 override 目标 ⇒ 绿(这正是 pnpm 该写的那个值)
      const byTarget = candidates.find((c) => values.includes(c.entry.specifier))
      if (byTarget) {
        if (byTarget.entry.specifier !== spec) {
          overrideExempted.push({
            section,
            name,
            declared: spec,
            locked: byTarget.entry.specifier,
            lockedIn: byTarget.in,
            overrideKeys: targets.filter((t) => t.value === byTarget.entry.specifier).map((t) => t.key),
          })
        }
        continue
      }
      const asDeclared = candidates.find((c) => c.entry.specifier === spec)
      // 严格侧(防"命中 override 就不判"的阉割):唯一一条**裸名** override 必然被 pnpm 落进 lock,
      // 于是 lock 仍停在 manifest 原值本身就是缺陷(lock 被手改 / 没跑全量 install)。
      const soleUnscoped = targets.length === 1 && targets[0].selector === null ? targets[0].value : null
      if (asDeclared && soleUnscoped && isRegistryRange(spec)) {
        violations.push({
          kind: 'override-not-applied',
          section,
          name,
          declared: spec,
          locked: asDeclared.entry.specifier,
          lockedIn: asDeclared.in,
          overrideValue: soleUnscoped,
        })
        continue
      }
      if (asDeclared) continue
      violations.push({
        kind: 'mismatch',
        section,
        name,
        declared: spec,
        locked: pick.entry.specifier,
        lockedIn: pick.in,
        overrideTargets: values.length > 0 ? values : undefined,
      })
    }
  }
  for (const [s, m] of lockSections) {
    for (const [name, entry] of m) {
      if (!declaredNames.has(name)) orphans.push({ section: s, name, locked: entry.specifier })
    }
  }
  return { violations, orphans, overrideExempted, peerExempted }
}

/** 维度 A 的输入:同一个面读 pnpm-workspace.yaml 的 overrides 段 */
function loadOverrides(reader) {
  const entries = parseWorkspaceOverrides(reader.readFace('pnpm-workspace.yaml'), 'pnpm-workspace.yaml')
  const parentScoped = entries.filter((e) => splitOverrideKey(e.key).parentScoped).length
  return { entries, parentScoped }
}

function readPkgJson(reader, rel) {
  const relPath = rel === '.' ? 'package.json' : `${rel}/package.json`
  const raw = reader.readFace(relPath)
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Undetermined(`${reader.label} 里的 ${relPath} 不是合法 JSON: ${e.message}`)
  }
}

export function runCheck(root, face = 'worktree') {
  try {
    const reader = makeFaceReader(face, root)
    const rels = discoverPackages(reader)
    const { entries: overrideEntries, parentScoped } = loadOverrides(reader)
    reader.prefetch([...rels.map((r) => (r === '.' ? 'package.json' : `${r}/package.json`)), 'pnpm-lock.yaml'])
    const importers = parseLockImporters(reader.readFace('pnpm-lock.yaml'))
    const violations = []
    const orphans = []
    const overrideExempted = []
    const peerExempted = []
    let declarations = 0
    for (const rel of rels) {
      const pkg = readPkgJson(reader, rel)
      const declaredBySection = {}
      let pkgDeclared = 0
      for (const s of DEP_SECTIONS) {
        declaredBySection[s] = pkg[s] && typeof pkg[s] === 'object' ? pkg[s] : {}
        pkgDeclared += Object.keys(declaredBySection[s]).length
      }
      declarations += pkgDeclared
      const lockSections = importers.get(rel)
      if (!lockSections) {
        if (pkgDeclared > 0) {
          violations.push({
            kind: 'missing-importer',
            pkg: rel,
            section: null,
            name: null,
            declared: `${pkgDeclared} 条`,
            locked: null,
            lockedIn: null,
          })
        }
        continue
      }
      const r = compareDeclarations(declaredBySection, lockSections, overrideEntries)
      for (const v of r.violations) v.pkg = rel
      for (const o of r.orphans) o.pkg = rel
      for (const x of r.overrideExempted) x.pkg = rel
      for (const x of r.peerExempted) x.pkg = rel
      violations.push(...r.violations)
      orphans.push(...r.orphans)
      overrideExempted.push(...r.overrideExempted)
      peerExempted.push(...r.peerExempted)
    }
    return {
      undetermined: null,
      judgedFace: face,
      packagesScanned: rels.length,
      declarations,
      violations,
      orphans,
      overrideExempted,
      peerExempted,
      overridesLoaded: overrideEntries.length,
      parentScopedOverrides: parentScoped,
    }
  } catch (e) {
    if (e instanceof Undetermined) {
      return {
        undetermined: e.message,
        judgedFace: FACES.includes(face) ? face : null,
        packagesScanned: 0,
        declarations: 0,
        violations: [],
        orphans: [],
        overrideExempted: [],
        peerExempted: [],
        overridesLoaded: 0,
        parentScopedOverrides: 0,
      }
    }
    throw e
  }
}

function formatViolation(v) {
  if (v.kind === 'missing-importer') {
    return `[缺记账] ${v.pkg}: lock 的 importers 里没有该包条目,而 package.json 声明了 ${v.declared}`
  }
  if (v.kind === 'missing') {
    return `[缺记账] ${v.pkg} ${v.section}.${v.name}: 声明 ${v.declared},lock importer 里无此条目`
  }
  if (v.kind === 'override-not-applied') {
    return (
      `[override 未落 lock] ${v.pkg} ${v.section}.${v.name}: manifest 声明 ${v.declared} 且 lock 也记 ${v.locked},` +
      `但 pnpm-workspace.yaml 有裸名 override → ${v.overrideValue}。pnpm 必然把 override 目标写进 lock,` +
      `两者同时停在原值说明 lock 被手改或没跑全量 pnpm install`
    )
  }
  return (
    `[不一致] ${v.pkg} ${v.section}.${v.name}: 声明 ${v.declared} ≠ lock specifier ${v.locked}` +
    (v.lockedIn && v.lockedIn !== v.section ? `(记在 ${v.lockedIn} 段)` : '') +
    (v.overrideTargets && v.overrideTargets.length > 0
      ? `(该依赖有 override,期望值应为 ${v.overrideTargets.join(' | ')} 之一,两者都不是)`
      : '')
  )
}

function report(result, mode, face) {
  const judged = face ?? result.judgedFace ?? 'worktree'
  console.log(
    `🔍 lock↔manifest specifier 对账 [${mode}] | 判定面: ${FACE_LABEL[judged]} —— ${FACE_NOTE[judged]}`
  )
  console.log(
    '   对账恒为全量(某包破损与"本次改了什么"无关),但内容一律取自上述单一面,不混读盘')
  if (result.undetermined) {
    console.error(`❌ 无法判定: ${result.undetermined} —— 本门拒绝在判据失效时"静默记为通过"(exit 2)`)
    return 2
  }
  console.log(
    `扫描包 ${result.packagesScanned} / 声明条目 ${result.declarations} / 违规 ${result.violations.length} / 孤儿记账 ${result.orphans.length}(反向条目不计红,如实报数)`
  )
  console.log(
    `维度 A overrides 表 ${result.overridesLoaded} 条(父作用域 > 形态 ${result.parentScopedOverrides} 条不参与直接声明比对)` +
      ` / 因 override 目标值放过 ${result.overrideExempted.length} 条` +
      ` / 维度 B peer 只验条目在位(不比 specifier)${result.peerExempted.length} 条`
  )
  for (const v of result.violations) console.log(formatViolation(v))
  for (const o of result.orphans) {
    console.log(`[孤儿] ${o.pkg} ${o.section}.${o.name}: lock 仍记 ${o.locked},package.json 已不声明`)
  }
  if (result.violations.length === 0) {
    console.log(
      `✅ specifier 全部一致(孤儿记账 ${result.orphans.length} 条、override 放过 ${result.overrideExempted.length} 条、peer 放过 ${result.peerExempted.length} 条均不计红)`
    )
    return 0
  }
  console.log('修复姿势: 改 package.json 后跑一次全量 `pnpm install`(不带 --filter)让 lock 重新记账,两者必须同 commit。')
  return 1
}

function w(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

/**
 * 测试/自检通道:在**临时夹具仓**里跑 git —— 派生本体仍是共用层的那一处(`gitRaw` 自带绝对路径
 * git + `safe.directory` + windowsHide + 数字 timeout,并把 `-C <dir>` 拼在这些 args 之前)。
 * 只在 mkScratch 目录里调用,绝不碰真仓;`core.autocrlf=false` 保证索引/HEAD blob 与写入字节
 * 逐字相同(否则换行归一会让"同一面"的比对失去意义)。
 */
const FIXTURE_GIT_CONFIG = Object.entries({
  'init.defaultBranch': 'main',
  'user.name': 'gate-fixture',
  'user.email': 'gate-fixture@invalid',
  'commit.gpgsign': 'false',
  'core.autocrlf': 'false',
}).flatMap(([key, value]) => ['-c', `${key}=${value}`])

export function gitInFixture(dir, args) {
  return gitRaw([...FIXTURE_GIT_CONFIG, ...args], dir, { timeout: GIT_TIMEOUT })
}

/** 测试/自检通道:把磁盘夹具变成一个真 git 仓(init + add,可选 commit) */
export function gitifyFixture(dir, { commit = true } = {}) {
  gitInFixture(dir, ['init', '-q'])
  gitInFixture(dir, ['add', '-A'])
  if (commit) gitInFixture(dir, ['commit', '-q', '-m', 'gate fixture'])
  return dir
}

const DEFAULT_WORKSPACE_YAML = "packages:\n  - 'apps/*'\n"
const DEFAULT_DEV_DEPS_BLOCK = "      typescript:\n        specifier: 'catalog:'\n        version: 5.9.3"

function makeFixture(dir, { webPkg, lock, rootPkg = { name: 'fixture-root' }, workspace = DEFAULT_WORKSPACE_YAML }) {
  w(join(dir, 'pnpm-workspace.yaml'), workspace)
  w(join(dir, 'package.json'), JSON.stringify(rootPkg, null, 2))
  w(join(dir, 'apps', 'web', 'package.json'), JSON.stringify({ name: 'web', ...webPkg }, null, 2))
  w(join(dir, 'pnpm-lock.yaml'), lock)
  return dir
}

function lockWith(webDepsBlock, webDevDepsBlock = DEFAULT_DEV_DEPS_BLOCK) {
  return [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  .: {}',
    '',
    '  apps/web:',
    '    dependencies:',
    webDepsBlock,
    '    devDependencies:',
    webDevDepsBlock,
    '',
    'packages:',
    '',
    "  '@e965/xlsx@0.20.3': {}",
    '',
  ].join('\n')
}

/** 按段生成 importer 块(维度 A/B 的夹具需要 devDependencies 段与 override 表成对出现) */
function lockFrom(sections) {
  const lines = ["lockfileVersion: '9.0'", '', 'importers:', '', '  .: {}', '', '  apps/web:']
  for (const [section, map] of Object.entries(sections)) {
    if (Object.keys(map).length === 0) continue
    lines.push(`    ${section}:`)
    for (const [name, spec] of Object.entries(map)) {
      lines.push(`      ${JSON.stringify(name)}:`, `        specifier: ${JSON.stringify(spec)}`, '        version: 0.0.0')
    }
  }
  lines.push('', 'packages:', '')
  return lines.join('\n')
}

/** 维度 A 夹具用的 workspace 文件:扁平 overrides + 后续顶层段(同时验"块到哪结束") */
function wsWithOverrides(overrideLines) {
  return [
    'packages:',
    "  - 'apps/*'",
    '',
    'overrides:',
    ...overrideLines,
    '',
    'peerDependencyRules:',
    '  ignoreMissing:',
    "    - '@opentelemetry/api'",
    '',
  ].join('\n')
}


const ACCIDENT_DEPS_BLOCK = [
  '      xlsx:',
  '        specifier: npm:@e965/xlsx@^0.20.3',
  "        version: '@e965/xlsx@0.20.3'",
  "      '@ihui/shared':",
  '        specifier: workspace:*',
  '        version: link:../packages/shared',
  '      jszip:',
  '        specifier: ^3.10.1',
  '        version: 3.10.1',
].join('\n')

export function runSelfTest() {
  const results = []
  const t = (label, cond) => results.push({ label, ok: !!cond })
  const scratch = mkScratch('lock-manifest-consistency')
  try {
    const baseWeb = {
      dependencies: {
        xlsx: '^0.18.5',
        '@ihui/shared': 'workspace:*',
      },
    }
    const aligned = makeFixture(join(scratch, 'aligned'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' } },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const broken = makeFixture(join(scratch, 'broken'), {
      webPkg: baseWeb,
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })

    const rAligned = runCheck(aligned)
    const rBroken = runCheck(broken)

    t('①事故形态:声明 ^0.18.5 vs lock npm:@e965/xlsx@^0.20.3 必判红', rBroken.violations.length === 1 && rBroken.violations[0].kind === 'mismatch' && rBroken.violations[0].name === 'xlsx')
    t('①反向对照:改一致后必绿', rAligned.violations.length === 0 && rAligned.undetermined === null)
    t('⑥workspace:* 一致时绿(参与比对不跳过)', rAligned.violations.every((v) => v.name !== '@ihui/shared'))
    t('④孤儿(jszip)不判红但报数', rAligned.violations.length === 0 && rAligned.orphans.some((o) => o.name === 'jszip'))

    const drift = makeFixture(join(scratch, 'ws-drift'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:^' } },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const rDrift = runCheck(drift)
    t('⑥workspace: 协议 specifier 漂移(* vs ^)必判红', rDrift.violations.length === 1 && rDrift.violations[0].name === '@ihui/shared')

    const missingPkg = makeFixture(join(scratch, 'missing'), {
      webPkg: {
        dependencies: {
          xlsx: 'npm:@e965/xlsx@^0.20.3',
          '@ihui/shared': 'workspace:*',
          'docx-preview': '^0.3.5',
        },
      },
      lock: lockWith(ACCIDENT_DEPS_BLOCK),
    })
    const rMissing = runCheck(missingPkg)
    t('③声明了但 lock 无条目(docx-preview)必判红 kind=missing', rMissing.violations.length === 1 && rMissing.violations[0].kind === 'missing' && rMissing.violations[0].name === 'docx-preview')

    const noImporters = makeFixture(join(scratch, 'no-importers'), {
      webPkg: { dependencies: { xlsx: '^0.18.5' } },
      lock: "lockfileVersion: '9.0'\n\npackages:\n\n  foo@1.0.0: {}\n",
    })
    const rNoImp = runCheck(noImporters)
    t('⑤lock 无 importers 块 → 无法判定(非绿非红)', rNoImp.undetermined !== null && rNoImp.violations.length === 0)

    const weird = makeFixture(join(scratch, 'weird'), {
      webPkg: { dependencies: { xlsx: '^0.18.5' } },
      lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  apps/web:\n    dependencies:\n      xlsx:\n        specifier: ^0.18.5\n        version: 0.18.5\n      '@odd/key':\n        bogon: 1\n",
    })
    const rWeird = runCheck(weird)
    t('⑤结构不认识(未知字段 bogon)→ 无法判定,不静默记过', rWeird.undetermined !== null)

    const importerAbsent = makeFixture(join(scratch, 'importer-absent'), {
      webPkg: { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3' } },
      lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n\npackages:\n",
    })
    const rAbsent = runCheck(importerAbsent)
    t('包整个没进 importer(声明>0)→ 判红 kind=missing-importer', rAbsent.violations.length === 1 && rAbsent.violations[0].kind === 'missing-importer')

    const peerMerged = makeFixture(join(scratch, 'peer-merged'), {
      webPkg: { peerDependencies: { react: '>=18.0.0' }, devDependencies: { typescript: 'catalog:' } },
      lock: lockWith('      react:\n        specifier: \'>=18.0.0\'\n        version: 19.2.8'),
    })
    const rPeer = runCheck(peerMerged)
    t('peer 被 pnpm 并进 dependencies 段且 specifier 相同 → 绿(不误报 missing)', rPeer.violations.length === 0 && rPeer.orphans.length === 0)

    const quoted = makeFixture(join(scratch, 'quoted'), {
      webPkg: { devDependencies: { typescript: 'catalog:' } },
      lock: lockWith(ACCIDENT_DEPS_BLOCK.replace("      '@ihui/shared':", "      jszip2:\n        specifier: '^3.10.1'\n        version: 3.10.1\n      '@ihui/shared':")),
    })
    const rQuoted = runCheck(quoted)
    t("引号形态 specifier('catalog:')去引号后比对,不误报", rQuoted.violations.length === 0)

    t('零声明包缺 importer 不判红', runCheck(makeFixture(join(scratch, 'zero-dep'), {
      webPkg: {},
      lock: "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n\npackages:\n",
    })).violations.length === 0)

    /* ---------- 维度 A:overrides 参与比对(R4) ---------- */
    t(
      'splitOverrideKey:scoped 名首个 @ 属 scope、版本选择器前缀归属、父作用域 > 识别',
      splitOverrideKey('@types/react@^19').name === '@types/react' &&
        splitOverrideKey('@types/react@^19').selector === '^19' &&
        splitOverrideKey('@types/react').name === '@types/react' &&
        splitOverrideKey('postcss@<=8.5.22').name === 'postcss' &&
        splitOverrideKey('foo>bar').parentScoped === true,
    )
    t(
      'splitOverrideKey:`>=` 里的 > 不是父作用域分隔符(真仓 13 条键带 >=,误判即整类 override 隐身)',
      splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').parentScoped === false &&
        splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').name === 'fast-uri' &&
        splitOverrideKey('fast-uri@>=3.0.0 <3.1.6').selector === '>=3.0.0 <3.1.6' &&
        splitOverrideKey('foo@>1.0.0').parentScoped === false &&
        splitOverrideKey('@scope/parent>@scope/child').parentScoped === true,
    )
    t('无 overrides 段的 workspace 文件 → 空表(合法,不是无法判定)', parseWorkspaceOverrides(DEFAULT_WORKSPACE_YAML).length === 0)

    const wsScoped = wsWithOverrides(["  '@types/react': 19.2.18", '  postcss@<=8.5.22: ^8.5.23'])
    const rOvrPass = runCheck(
      makeFixture(join(scratch, 'ovr-pass'), {
        webPkg: { devDependencies: { '@types/react': '^19.0.0', postcss: '^8.4.49' } },
        lock: lockFrom({ devDependencies: { '@types/react': '19.2.18', postcss: '^8.5.23' } }),
        workspace: wsScoped,
      }),
    )
    t(
      '维度 A:裸名 override 与 `名字@选择器` 两种键都命中,lock 等于 override 目标 → 绿且如实报数(真仓 19 枚的形状)',
      rOvrPass.undetermined === null && rOvrPass.violations.length === 0 && rOvrPass.overrideExempted.length === 2,
    )

    const wsStrict = wsWithOverrides(['  lodash-es: 9.9.9', '  webpack: 5.99.0'])
    const rOvrRed = runCheck(
      makeFixture(join(scratch, 'ovr-red'), {
        webPkg: { dependencies: { 'lodash-es': '^1.2.0' } },
        lock: lockFrom({ dependencies: { 'lodash-es': '^7.7.7' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '维度 A 反向对照①:被 override 的依赖,manifest 与 lock 都不等于 override 目标 → 必红(点名期望值)',
      rOvrRed.violations.length === 1 &&
        rOvrRed.violations[0].kind === 'mismatch' &&
        rOvrRed.violations[0].overrideTargets?.join('|') === '9.9.9',
    )
    const rOvrNotApplied = runCheck(
      makeFixture(join(scratch, 'ovr-not-applied'), {
        webPkg: { dependencies: { webpack: '^5.10.0' } },
        lock: lockFrom({ dependencies: { webpack: '^5.10.0' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '维度 A 反向对照②(防阉割):lock 被手改回 manifest 原值而裸名 override 未落进 lock → 必红 kind=override-not-applied',
      rOvrNotApplied.violations.length === 1 && rOvrNotApplied.violations[0].kind === 'override-not-applied',
    )
    const rOvrAligned = runCheck(
      makeFixture(join(scratch, 'ovr-aligned'), {
        webPkg: { dependencies: { webpack: '5.99.0' } },
        lock: lockFrom({ dependencies: { webpack: '5.99.0' } }),
        workspace: wsStrict,
      }),
    )
    t('维度 A 反向对照③:manifest 已等于 override 目标且 lock 一致 → 绿', rOvrAligned.violations.length === 0)

    const rUntouched = runCheck(
      makeFixture(join(scratch, 'ovr-unaffected'), {
        webPkg: { dependencies: { jszip: '^3.10.0' } },
        lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
        workspace: wsStrict,
      }),
    )
    t(
      '未被 override、非 peer 的依赖在"表里有别的 override"时仍走原判据 → 必红(今天的真事故形态)',
      rUntouched.violations.length === 1 &&
        rUntouched.violations[0].kind === 'mismatch' &&
        rUntouched.violations[0].overrideTargets === undefined,
    )
    t(
      '同一条依赖改一致后必绿',
      runCheck(
        makeFixture(join(scratch, 'ovr-unaffected-ok'), {
          webPkg: { dependencies: { jszip: '^3.10.1' } },
          lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
          workspace: wsStrict,
        }),
      ).violations.length === 0,
    )

    const wsSelector = wsWithOverrides(['  vite@<=6.4.2: ^6.4.3'])
    const rSelectorOut = runCheck(
      makeFixture(join(scratch, 'selector-out'), {
        webPkg: { devDependencies: { vite: '^7.0.0' } },
        lock: lockFrom({ devDependencies: { vite: '^7.0.0' } }),
        workspace: wsSelector,
      }),
    )
    t(
      '带 @版本选择器的 override 不匹配声明区间时不得强判(lock 等于 manifest 原值 → 绿)',
      rSelectorOut.violations.length === 0 && rSelectorOut.overrideExempted.length === 0,
    )

    const rSelectorApplied = runCheck(
      makeFixture(join(scratch, 'selector-applied'), {
        webPkg: { dependencies: { 'lodash-es': '^4.17.20' } },
        lock: lockFrom({ dependencies: { 'lodash-es': '^4.17.24' } }),
        workspace: wsWithOverrides(['  lodash-es@>=4.0.0 <=4.17.23: ^4.17.24']),
      }),
    )
    t(
      '带 >= 的版本选择器 override 端到端生效(误判成父作用域就会假红)',
      rSelectorApplied.violations.length === 0 && rSelectorApplied.overrideExempted.length === 1,
    )

    const wsParent = wsWithOverrides(["  '@aws-sdk/client-sts>fast-xml-parser': ^4.0.0"])
    const rParentOk = runCheck(
      makeFixture(join(scratch, 'parent-ok'), {
        webPkg: { dependencies: { 'fast-xml-parser': '^5.0.0' } },
        lock: lockFrom({ dependencies: { 'fast-xml-parser': '^5.0.0' } }),
        workspace: wsParent,
      }),
    )
    const rParentRed = runCheck(
      makeFixture(join(scratch, 'parent-red'), {
        webPkg: { dependencies: { 'fast-xml-parser': '^5.0.0' } },
        lock: lockFrom({ dependencies: { 'fast-xml-parser': '^4.0.0' } }),
        workspace: wsParent,
      }),
    )
    t(
      '父作用域 override 键不参与直接声明比对(计数如实、既不豁免也不误伤)',
      rParentOk.violations.length === 0 &&
        rParentOk.parentScopedOverrides === 1 &&
        rParentOk.overrideExempted.length === 0 &&
        rParentRed.violations.length === 1,
    )

    const rBadOverrides = runCheck(
      makeFixture(join(scratch, 'ovr-unparsable'), {
        webPkg: { dependencies: { jszip: '^3.10.1' } },
        lock: lockFrom({ dependencies: { jszip: '^3.10.1' } }),
        workspace: "packages:\n  - 'apps/*'\n\noverrides:\n  foo:\n    bar: 1.0.0\n",
      }),
    )
    t(
      'overrides 表形态不认识(嵌套 map)→ 无法判定 exit 2,不得退化成"当作没有 override"产红',
      rBadOverrides.undetermined !== null && rBadOverrides.violations.length === 0,
    )

    /* ---------- 维度 B:peer 记账只验条目在位(R5) ---------- */
    const rPeerDevSection = runCheck(
      makeFixture(join(scratch, 'peer-dev-section'), {
        webPkg: {
          peerDependencies: { '@tarojs/taro': '>=4.0.0' },
          devDependencies: { '@tarojs/taro': '4.2.1' },
        },
        lock: lockFrom({ devDependencies: { '@tarojs/taro': '4.2.1' } }),
      }),
    )
    t(
      '维度 B:peer 记在 devDependencies 段、specifier 是解析后的范围 → 绿并计入 peerExempted(真仓 3 枚的形状)',
      rPeerDevSection.violations.length === 0 && rPeerDevSection.peerExempted.length === 1,
    )
    const rPeerMissing = runCheck(
      makeFixture(join(scratch, 'peer-missing'), {
        webPkg: { peerDependencies: { 'peer-only': '^1.0.0' } },
        lock: lockFrom({}),
      }),
    )
    t(
      '维度 B 反向对照:peer 在 lock 任一段都没有条目 → 仍判红 kind=missing(只放过值,不放过缺记账)',
      rPeerMissing.violations.length === 1 && rPeerMissing.violations[0].kind === 'missing',
    )
    const rPeerAndOverride = runCheck(
      makeFixture(join(scratch, 'peer-and-override'), {
        webPkg: { peerDependencies: { react: '^18.0.0 || ^19.0.0' } },
        lock: lockFrom({ devDependencies: { react: '^18.2.0' } }),
        workspace: wsWithOverrides(['  react: 19.0.0']),
      }),
    )
    t(
      'A 与 B 同时适用时按 B 放过值比对(既非红也不记 override 放过)',
      rPeerAndOverride.violations.length === 0 &&
        rPeerAndOverride.peerExempted.length === 1 &&
        rPeerAndOverride.overrideExempted.length === 0,
    )

    const rCatalogGuard = runCheck(
      makeFixture(join(scratch, 'catalog-guard'), {
        webPkg: { devDependencies: { typescript: 'catalog:' } },
        lock: lockFrom({ devDependencies: { typescript: 'catalog:' } }),
        workspace: wsWithOverrides(['  typescript: 5.9.3']),
      }),
    )
    t(
      'catalog: 协议声明不参与"裸名 override 必须落 lock"的严格判(否则会误红)',
      rCatalogGuard.violations.length === 0,
    )

    /* ---------- 判定面(2026-09-24 收口:--staged 判索引、全量判 HEAD,不判滞后的工作树) ---------- */
    const BROKEN_WEB = { dependencies: { xlsx: '^0.18.5', '@ihui/shared': 'workspace:*' } }
    const OK_WEB = { dependencies: { xlsx: 'npm:@e965/xlsx@^0.20.3', '@ihui/shared': 'workspace:*' } }
    const webPkgFile = (dir) => join(dir, 'apps', 'web', 'package.json')

    // ① 假绿钉死:索引里那对**不一致**,盘上随后**改对**
    const fakeGreen = gitifyFixture(
      makeFixture(join(scratch, 'face-fake-green'), { webPkg: BROKEN_WEB, lock: lockWith(ACCIDENT_DEPS_BLOCK) }),
    )
    w(webPkgFile(fakeGreen), JSON.stringify({ name: 'web', ...OK_WEB }, null, 2))
    const fgStaged = runCheck(fakeGreen, 'staged')
    const fgWorktree = runCheck(fakeGreen, 'worktree')
    t(
      '判定面①假绿钉死:索引那对不一致而盘上已改对 ⇒ staged 面必红、worktree 面才绿(旧实现在这里判盘即放行坏提交)',
      fgStaged.undetermined === null &&
        fgStaged.violations.length === 1 &&
        fgStaged.violations[0].kind === 'mismatch' &&
        fgStaged.judgedFace === 'staged' &&
        fgWorktree.violations.length === 0,
    )

    // ② 假红钉死:索引里那对**一致**,盘上是**别人半编辑的不一致**
    const fakeRed = gitifyFixture(
      makeFixture(join(scratch, 'face-fake-red'), { webPkg: OK_WEB, lock: lockWith(ACCIDENT_DEPS_BLOCK) }),
    )
    w(webPkgFile(fakeRed), JSON.stringify({ name: 'web', ...BROKEN_WEB }, null, 2))
    t(
      '判定面②假红钉死:索引一致而盘上是并行会话的半编辑态 ⇒ staged 面必绿(不产红到逼人 --no-verify)',
      runCheck(fakeRed, 'staged').violations.length === 0 && runCheck(fakeRed, 'worktree').violations.length === 1,
    )

    // ③ 该面取不到 ⇒ 无法判定并点名路径,绝不"跳过该包再报绿"
    const noLock = gitifyFixture(
      makeFixture(join(scratch, 'face-no-lock'), { webPkg: OK_WEB, lock: lockWith(ACCIDENT_DEPS_BLOCK) }),
      { commit: false },
    )
    gitInFixture(noLock, ['rm', '-q', '--cached', 'pnpm-lock.yaml'])
    const rNoLock = runCheck(noLock, 'staged')
    const rNoHead = runCheck(noLock, 'head')
    t(
      '判定面③取不到必判"无法判定"并点名路径,不得记绿:索引里没有 pnpm-lock.yaml ⇒ staged 面红在取材上;' +
        '尚无提交 ⇒ head 面同样无法判定',
      rNoLock.undetermined !== null &&
        /pnpm-lock\.yaml/.test(rNoLock.undetermined) &&
        rNoLock.violations.length === 0 &&
        rNoHead.undetermined !== null &&
        rNoHead.violations.length === 0,
    )
    t('未知判定面 ⇒ 显式无法判定,不得静默退回读盘', runCheck(fakeGreen, 'nope').undetermined !== null)
    t(
      '判定面④同一轮只读一个面:head 面取到自己那份内容(有提交后 0 违规、面标记正确)',
      (() => {
        const committed = gitifyFixture(
          makeFixture(join(scratch, 'face-head-ok'), { webPkg: OK_WEB, lock: lockWith(ACCIDENT_DEPS_BLOCK) }),
        )
        w(webPkgFile(committed), JSON.stringify({ name: 'web', ...BROKEN_WEB }, null, 2))
        const rh = runCheck(committed, 'head')
        return (
          rh.undetermined === null &&
          rh.violations.length === 0 &&
          rh.judgedFace === 'head' &&
          runCheck(committed, 'worktree').violations.length === 1
        )
      })(),
    )
  } finally {
    rmScratch(scratch)
  }
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`${r.ok ? '✅' : '❌'} ${r.label}`)
  }
  console.log(`--self-test: ${results.length - failed}/${results.length} 通过`)
  return failed === 0 ? 0 : 1
}

const FACE_FLAGS = { '--staged': 'staged', '--head': 'head', '--worktree': 'worktree' }

/**
 * CLI → 判定面。缺省(全量)判 HEAD,--staged 判索引,--worktree 是人工排查的逃生舱。
 * 同时给两个面旗标 ⇒ 立即 exit 2 报错:静默取其一会让"这次到底判了哪一面"无法从命令里读出。
 */
export function resolveFace(argv) {
  const given = Object.entries(FACE_FLAGS).filter(([flag]) => argv.includes(flag))
  if (given.length > 1) {
    throw new Undetermined(`判定面互相冲突: ${given.map(([f]) => f).join(' 与 ')} 只能给一个`)
  }
  if (given.length === 1) return { face: given[0][1], mode: given[0][0] }
  return { face: 'head', mode: '--all' }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exit(runSelfTest())
  }
  let root = DEFAULT_ROOT
  const ri = argv.indexOf('--root')
  if (ri !== -1) {
    const arg = argv[ri + 1]
    if (!arg) {
      console.error('❌ --root 需要一个目录参数')
      process.exit(2)
    }
    root = resolve(arg)
    if (!existsSync(root)) {
      console.error(`❌ --root 指向的目录不存在: ${root}`)
      process.exit(2)
    }
  }
  let face
  let mode
  try {
    ;({ face, mode } = resolveFace(argv))
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }
  const result = runCheck(root, face)
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ mode, ...result, judgedFace: face }, null, 2))
    process.exit(result.undetermined ? 2 : result.violations.length ? 1 : 0)
  }
  process.exit(report(result, mode, face))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  Undetermined,
  unquoteScalar,
  parseWorkspaceGlobs,
  discoverPackages,
  parseWorkspaceOverrides,
  splitOverrideKey,
  matchOverrideTargets,
  isRegistryRange,
  parseLockImporters,
  compareDeclarations,
  runCheck,
  runSelfTest,
  makeFixture,
  lockWith,
  lockFrom,
  wsWithOverrides,
  DEFAULT_WORKSPACE_YAML,
  ACCIDENT_DEPS_BLOCK,
  // 判定面(§22c:面选择本身要能被测试直接调用,不得只活在文件内部)
  makeFaceReader,
  resolveFace,
  catBatch,
  gitifyFixture,
  gitInFixture,
  FACES,
  FACE_LABEL,
  FACE_NOTE,
  GIT_BIN,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
