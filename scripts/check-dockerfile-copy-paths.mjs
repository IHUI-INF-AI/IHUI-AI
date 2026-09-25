#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 72:Dockerfile 构建上下文一致性。
 *
 * 起因(2026-09-22 实测,CI 上 build-api 与 build-web 同时红):
 *   提交 79b906463f 给**根 package.json** 加了 `"postinstall": "node scripts/fix-expo-metro-junction.mjs"`,
 *   但 deploy/docker/Dockerfile.{api,web,cli,migrate} 只 COPY 清单文件就执行 `pnpm install`
 *   —— 镜像里没有 scripts/ ⇒ install 阶段 `MODULE_NOT_FOUND` ⇒ **五个镜像构建里坏四个**。
 *   本地跑不到 docker 时完全无人知晓(typecheck/lint/单测全绿也发现不了,因为没人跑 docker build)。
 *
 * 两条判据(都只用仓库内信息,不需要知道 CI 传的 context):
 *   A. 「根上下文识别」:凡 COPY 行里出现 `pnpm-workspace.yaml`(根 monorepo 独有标记)的 Dockerfile,
 *      其依赖安装会触发**根** package.json 的 preinstall/postinstall/prepare 钩子 ⇒
 *      这些钩子用 `node <file>` 引用的每个脚本,**必须**也出现在该文件的某条 COPY 源里。
 *   B. 「COPY 源存在性」:每条**不带 `--from=`**、不含通配符/变量的 COPY 源路径,
 *      必须能从构建上下文取到(按 Dockerfile 自身目录或仓库根两种基准各试一次,命中其一即通过 ——
 *      上下文究竟是哪个目录只有 workflow 知道,故判据刻意取并集,宁可漏不误报)。
 *   C. 「pnpm --filter 脚本覆盖」:`pnpm --filter <spec> run <script>` 对闭包里**没有该脚本**的包是
 *      **静默跳过**而非报错。若被跳过的是"自带 build(产出 dist)"的包,下游按 main/exports 读 dist
 *      就会 Module not found。2026-09-23 实测即此类:Dockerfile.web 用 `run build:static` 而 7 个
 *      可构建依赖全都没有该脚本 ⇒ 依赖一个都没构建 ⇒ CI build-web 恒红(同仓 Dockerfile.api 用
 *      `run build`,故一直绿 —— 差别只在脚本名,本地不跑 docker 时零信号)。
 *
 * 用法:node scripts/check-dockerfile-copy-paths.mjs [--staged|--self-test|--help]
 * 退出码:0 通过 / 1 检出违规 / 2 脚本自身异常。
 * 紧急跳过:HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1 git commit ...
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

// 判定面取材一律走共用层(2026-09-26 迁,守门 118 的 loose-git 档收口)。
// 本门此前自己 `execFileSync('git', ['show','HEAD:package.json'])` 读正文:那五件各门自己写必错的
// 事(裸 'git' 依赖 PATH / cat-file 的 stdio[0] / 逐文件派生 / junction 下的根比对 / maxBuffer)
// 全在这里各写了一遍。**面本身一字未改** —— A 判据的基准仍是"提交内容"(HEAD),被审的 Dockerfile
// 内容、workflow 上下文与 workspace 包图仍按工作树取(文件头注释写明的口径),换的只是取法。
import { Undetermined, catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const LIFECYCLE_KEYS = ['preinstall', 'postinstall', 'prepare']
const SCRIPT_FILE_RE = /\.(mjs|cjs|js|ts)$/
/** 根 monorepo 上下文标记:只有根 package.json 安装阶段才会被 COPY 进来的文件 */
const ROOT_CTX_MARKER = /pnpm-workspace\.yaml/
/** 钩子命令里的 `node <路径>`(允许夹带 --flag) */
const NODE_ARG_RE = /\bnode\b((?:\s+--[\w=.-]+)*)\s+([^\s'";|&]+)/g

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

/**
 * 枚举路径清单(不读正文)也走层的统一派生:绝对 git + safe.directory + quotepath + 数字 timeout
 * + maxBuffer。失败仍返回 `[]` —— 与改法前逐字等值，调用方各自有"空清单不得静默判绿"的护栏。
 */
function gitLines(args) {
  try {
    return gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 按面读一个路径的**正文**(取材层)。
 *
 * 本门各判据取哪一面,是文件头注释里写定的既有口径,本票一字未改:
 *  - A 判据的基准 = `HEAD`(CI/Docker 构建消费的是提交内容,工作树可能正被并行会话改);
 *  - B/C 判据的被审内容(Dockerfile、workflow 上下文、workspace 包图)= 工作树。
 * 换的只是"怎么取":此前是 `execFileSync('git',['show','HEAD:package.json'])` + `readFileSync`。
 * 抽成函数是为了让 `--self-test` 能**构造**"索引 ≠ HEAD"的现场,证明取的是被点名的那一面,
 * 而不是"碰巧磁盘上就是 HEAD 的那一份"(§22c:判据的对象是文件形态时,镜像/自检的输入必须取自真实现场)。
 */
export function readAtFace(root, face, rel) {
  if (face === 'worktree') return readWorktreeFile(root, rel)
  const rev = face === 'staged' ? '' : 'HEAD'
  const spec = `${rev}:${rel}`
  return catBatch(root, [spec], { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT }).get(spec) ?? null
}

/**
 * A 判据基准的取源:HEAD 优先,取不到才降级到工作树(原实现的兜底顺序,未改),
 * 两面都给不出 ⇒ 抛 `Undetermined` ⇒ 对外 exit 2「无法判定」，
 * 不得把"没读到根清单"混成 `return 2` 的一句模糊话,更不得当成通过。
 */
export function lifecyclePackageSource(root, read = (face, rel) => readAtFace(root, face, rel)) {
  const head = read('head', 'package.json')
  if (typeof head === 'string') return { src: head, used: 'HEAD blob' }
  let why = 'HEAD 面取不到'
  try {
    const disk = read('worktree', 'package.json')
    if (typeof disk === 'string') return { src: disk, used: '工作树(HEAD 取不到时降级)' }
    why = '工作树也没有该文件'
  } catch (e) {
    why = `工作树读取失败:${e?.message ?? e}`
  }
  throw new Undetermined(`读不到根 package.json(HEAD 与工作树均失败):${why}`)
}

/** 从 package.json 的生命周期钩子里抽出被 `node <file>` 引用的脚本路径(只收仓库内相对路径)。 */
export function lifecycleScriptRefs(pkg) {
  const out = new Set()
  for (const key of LIFECYCLE_KEYS) {
    const cmd = pkg?.scripts?.[key]
    if (typeof cmd !== 'string') continue
    NODE_ARG_RE.lastIndex = 0
    let m
    while ((m = NODE_ARG_RE.exec(cmd))) {
      const target = m[2].replace(/^['"]|['"]$/g, '')
      if (!SCRIPT_FILE_RE.test(target)) continue
      if (target.startsWith('/') || target.includes('..')) continue // 绝对路径/越界不归本门管
      out.add(target)
    }
  }
  return [...out].sort()
}

/**
 * 解析 Dockerfile 的 COPY 指令。
 * 返回 [{ srcs, dst, line, hasFrom, wildcard }] —— 只认普通 COPY(ADD 在本仓未用于上下文文件)。
 */
export function parseCopies(content) {
  const out = []
  const raw = content.split(/\r?\n/)
  // 先把反斜杠续行折回一条逻辑行(记下起始行号),否则 `COPY a \` + `  b /` 会被拆成两条残缺指令
  const logical = []
  for (let i = 0; i < raw.length; i++) {
    let text = raw[i]
    const start = i
    while (/\\\s*$/.test(text) && i + 1 < raw.length) {
      text = text.replace(/\\\s*$/, ' ') + raw[i + 1].trim()
      i += 1
    }
    logical.push({ text, line: start + 1 })
  }
  for (const { text, line } of logical) {
    const m = /^\s*COPY\s+(--from=\S+\s+)?(--\S+\s+)*(.+)$/i.exec(text)
    if (!m) continue
    const parts = (m[3] || '').trim().split(/\s+/)
    if (parts.length < 2) continue
    const dst = parts[parts.length - 1]
    const srcs = parts.slice(0, -1)
    out.push({
      srcs,
      dst,
      line,
      hasFrom: Boolean(m[1]),
      wildcard: srcs.some((s) => /[*?]/.test(s) || /\$\{?\w/.test(s)),
    })
  }
  return out
}

/** A 判据:根上下文 Dockerfile 是否覆盖了钩子引用的每个脚本。 */
export function checkLifecycleCopies({ content, refs, rel }) {
  const violations = []
  const isRootCtx = content
    .split(/\r?\n/)
    .some((l) => /^\s*COPY\b/i.test(l) && ROOT_CTX_MARKER.test(l))
  if (!isRootCtx) return violations
  const copied = new Set()
  for (const c of parseCopies(content)) {
    if (c.hasFrom) continue
    for (const s of c.srcs) {
      copied.add(s.replace(/^\.\//, ''))
      // `COPY scripts/foo.mjs scripts/` 与 `COPY scripts scripts/` 两种写法都算覆盖 scripts/foo.mjs
      if (s.replace(/^\.\//, '').endsWith('/')) copied.add(s.replace(/^\.\//, ''))
    }
  }
  for (const ref of refs) {
    const direct = copied.has(ref)
    const byDir = [...copied].some(
      (c) => c !== ref && ref.startsWith(c.endsWith('/') ? c : `${c}/`) && !/\*/.test(c),
    )
    if (direct || byDir) continue
    violations.push({
      file: rel,
      kind: 'lifecycle-script-not-copied',
      detail: `钩子引用的 ${ref} 未被任何 COPY 源覆盖`,
      hint: `在 ${rel} 的 \`RUN pnpm install\` 之前加一行:COPY ${ref} ${dirname(ref)}/`,
    })
  }
  return violations
}

/**
 * 从 .github/workflows/*.yml 里抽 `file: → context:` 映射。
 * B 判据必须知道构建上下文才能判"源文件是否存在",没声明上下文的 Dockerfile 一律跳过(宁漏不误报)。
 */
export function workflowContexts(root) {
  const map = new Map()
  const files = gitLines(['ls-files', '--', '.github/workflows'])
  for (const wf of files) {
    let text
    try {
      text = readWorktreeFile(root, wf)
    } catch {
      continue
    }
    if (typeof text !== 'string') continue
    let ctx = null
    for (const line of text.split(/\r?\n/)) {
      const c = /^\s*context:\s*(\S+)\s*$/.exec(line)
      if (c) {
        ctx = c[1].replace(/^['"]|['"]$/g, '')
        continue
      }
      const f = /^\s*file:\s*(\S+)\s*$/.exec(line)
      if (f && ctx) {
        const target = f[1].replace(/^['"]|['"]$/g, '').replace(/^\.\//, '')
        if (!/\$\{/.test(target) && !/\$\{\{/.test(ctx)) map.set(target, ctx)
        ctx = null
      }
    }
  }
  return map
}

/**
 * 已提交路径全集(相对仓库根,posix 分隔)。
 * 存在性一律按**提交内容**判,不按工作树:Docker/CI 构建消费的是 commit,而工作树里可能正有
 * 并行会话未暂存的删除(实测本仓 `scripts/fix-expo-metro-junction.mjs` 就被本地删了但未暂存,
 * 按工作树判会产出一条与真实构建结果相反的假阳性)。
 */
export function committedPaths(root = ROOT) {
  let files = []
  try {
    files = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD'], root, { timeout: GIT_TIMEOUT })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    files = []
  }
  const set = new Set()
  for (const f of files) {
    set.add(f)
    let i = f.indexOf('/')
    while (i >= 0) {
      set.add(f.slice(0, i + 1)) // 目录形式(a/b/)也登记,便于 COPY 目录源匹配
      i = f.indexOf('/', i + 1)
    }
  }
  return set
}

/**
 * B 判据:COPY 源必须能从**已声明的构建上下文**的提交内容里取到。
 * @param {string} context workflow 里声明的 context('.' = 仓库根)
 */
export function checkCopySourcesExist({ content, rel, context, committed }) {
  const violations = []
  const prefix = context === '.' ? '' : `${context.replace(/^\.\//, '').replace(/\/+$/, '')}/`
  for (const c of parseCopies(content)) {
    if (c.hasFrom || c.wildcard) continue
    for (const s of c.srcs) {
      if (s.startsWith('/') || s.includes('..') || s.startsWith('|')) continue
      // `COPY . .` = 整个上下文,恒存在,不参与存在性判定
      if (s === '.' || s === './') continue
      const key = (prefix + s.replace(/^\.\//, '')).replace(/\/+$/, '')
      if (committed.has(key) || committed.has(`${key}/`)) continue
      violations.push({
        file: rel,
        kind: 'copy-source-missing',
        detail: `第 ${c.line} 行 COPY 源 ${s} 不在构建上下文 ${context === '.' ? '<repo 根>' : context}/ 的提交内容里`,
        hint: `该路径拼写有误、已在提交中被删除,或被 .dockerignore 排除`,
      })
    }
  }
  return violations
}

/**
 * 把 `\` 续行折成一条逻辑行,并记住起始物理行号(报违规要指到 RUN 那一行)。
 */
export function logicalLines(content) {
  const out = []
  let buf = ''
  let start = 0
  content.split(/\r?\n/).forEach((raw, i) => {
    const conts = /\\\s*$/.test(raw)
    if (!buf) start = i + 1
    buf += raw.replace(/\\\s*$/, ' ')
    if (!conts) {
      if (buf.trim()) out.push({ line: start, text: buf })
      buf = ''
    }
  })
  if (buf.trim()) out.push({ line: start, text: buf })
  return out
}

/** 展开一个 `--filter` 表达式为 workspace 包名集合;认不出的形态一律返回 null(宁漏不误报)。 */
export function expandFilterSpec(spec, graph) {
  const name = spec.replace(/^['"]|['"]$/g, '')
  if (name.startsWith('!') || name.startsWith('...')) return null // 取反/上游依赖方向,本判据不管
  const depsOnly = name.endsWith('^...')
  const withDeps = !depsOnly && name.endsWith('...')
  const root = depsOnly ? name.slice(0, -4) : withDeps ? name.slice(0, -3) : name
  const node = graph.get(root)
  if (!node) return null // 包名解析不到,不猜
  const out = new Set(depsOnly ? [] : [root])
  if (!depsOnly && !withDeps) return out // 单包形态:不含依赖,别把闭包误扩出去
  const queue = [...node.deps]
  while (queue.length) {
    const d = queue.pop()
    if (out.has(d) || !graph.has(d)) continue
    out.add(d)
    queue.push(...graph.get(d).deps)
  }
  if (depsOnly) out.delete(root)
  return out
}

/**
 * C 判据:`pnpm --filter <spec>... run <script>` 是"闭包里逐包执行,**包没有这个脚本就静默跳过**",
 * 而不是"报错"。被跳过的包若自己带 `build`(即产出 dist 的包),下游按 `main`/`exports` 读 dist 时
 * 就 Module not found —— 且本地不跑 docker 时零信号。
 *
 * 实打实的成因(2026-09-23 实测 CI build-web 恒红):Dockerfile.web 跑
 * `--filter @ihui/web... run build:static`,而 web 的 7 个可构建依赖**全部只有 `build`、没有
 * `build:static`** ⇒ 一个都没被构建 ⇒ `@ihui/api-client`(main: ./dist/index.js)解析失败;
 * 同仓 Dockerfile.api 用 `run build`(人人都有)⇒ build-api 一直绿。两条 Dockerfile 只差一个脚本名。
 *
 * 只认"自身带 build 却缺被调用脚本"的包:纯配置/纯类型包(eslint-config、tsconfig)没有 build,
 * 跳过是正确行为,不计违规。
 */
export function checkPnpmFilterScripts({ content, rel, graph }) {
  const violations = []
  for (const { line, text } of logicalLines(content)) {
    if (!/\bpnpm\b/.test(text) || !/--filter\s+\S+/.test(text)) continue
    // 按 && / || / ; 切段逐段配对:一条 RUN 里两次 `pnpm --filter X run S` 各有自己的包集与脚本,
    // 混在一起取"首个脚本"会让后一段借用前一段的闭包(误报或漏报皆可能)。
    for (const seg of text.split(/\s*(?:&&|\|\||;)\s*/)) {
      if (!/--filter\s+\S+/.test(seg)) continue
      const runM = /\brun\s+([\w:.-]+)/.exec(seg)
      if (!runM) continue
      const script = runM[1]
      const pkgs = new Set()
      let unrecognized = false
      for (const s of [...seg.matchAll(/--filter\s+(\S+)/g)].map((m) => m[1])) {
        const expanded = expandFilterSpec(s, graph)
        if (expanded === null) {
          unrecognized = true
          break
        }
        for (const p of expanded) pkgs.add(p)
      }
      if (unrecognized || !pkgs.size) continue
      const skipped = [...pkgs].filter((p) => {
        const node = graph.get(p)
        return node.hasBuild && !node.scripts.has(script)
      })
      if (!skipped.length) continue
      violations.push({
        file: rel,
        kind: 'pnpm-filter-script-skipped',
        detail: `第 ${line} 行 \`run ${script}\` 会静默跳过 ${skipped.length} 个产出 dist 的包:${skipped.sort().join(', ')}`,
        hint:
          `这些包只有自己的构建脚本(如 build)而没有 ${script},pnpm 不报错、直接跳过 ⇒ 镜像里 dist 缺失。` +
          `先跑 \`--filter <pkg>^... run build\` 构建依赖,再单独跑目标包的那条脚本`,
      })
    }
  }
  return violations
}

/**
 * workspace 包图(读工作树 package.json):name -> { scripts:Set, deps:workspace 依赖名, hasBuild }。
 * 读不到任何包时返回 null,由调用方按"未真正运行"处理(不得静默判绿)。
 */
export function workspaceGraph(root = ROOT) {
  const files = gitLines([
    'ls-files',
    '--',
    'package.json',
    'packages/*/package.json',
    'apps/*/package.json',
  ])
  const graph = new Map()
  for (const relPath of files) {
    if (relPath.includes('node_modules')) continue
    let p
    try {
      p = JSON.parse(readWorktreeFile(root, relPath))
    } catch {
      continue
    }
    if (!p?.name) continue
    const deps = []
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [k, v] of Object.entries(p[field] || {})) {
        if (typeof v === 'string' && v.startsWith('workspace')) deps.push(k)
      }
    }
    graph.set(p.name, {
      scripts: new Set(Object.keys(p.scripts || {})),
      hasBuild: Boolean(p.scripts?.build),
      deps,
    })
  }
  return graph.size ? graph : null
}

export function scanDockerfile({ rel, content, rootRefs, context, committed, graph }) {
  return [
    ...checkLifecycleCopies({ content, refs: rootRefs, rel }),
    ...(context ? checkCopySourcesExist({ content, rel, context, committed }) : []),
    ...(graph ? checkPnpmFilterScripts({ content, rel, graph }) : []),
  ]
}

export const SELFTEST_CASES = [
  {
    name: '根上下文 + 钩子脚本未 COPY → 违规(即 CI 上 build-api/web 的真实故障)',
    dockerfile:
      'FROM node:20\nWORKDIR /app\nCOPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./\nRUN pnpm install --frozen-lockfile\n',
    refs: ['scripts/fix-expo-metro-junction.mjs'],
    want: 'violation',
  },
  {
    name: '补上 COPY 该行 → 放过(修法有效性)',
    dockerfile:
      'FROM node:20\nWORKDIR /app\nCOPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./\nCOPY scripts/fix-expo-metro-junction.mjs scripts/\nRUN pnpm install --frozen-lockfile\n',
    refs: ['scripts/fix-expo-metro-junction.mjs'],
    want: 'pass',
  },
  {
    name: '反例:非根上下文(不 COPY pnpm-workspace.yaml)不受 A 判据约束',
    dockerfile: 'FROM node:20\nWORKDIR /app\nCOPY package.json ./\nRUN npm install\n',
    refs: ['scripts/fix-expo-metro-junction.mjs'],
    want: 'pass',
  },
  {
    name: '反例:COPY 整个 scripts 目录也算覆盖',
    dockerfile:
      'COPY package.json pnpm-workspace.yaml ./\nCOPY scripts scripts/\nRUN pnpm install\n',
    refs: ['scripts/x.mjs'],
    want: 'pass',
  },
  {
    name: 'lifecycleScriptRefs 只认 node 直接执行的文件,忽略 pnpm/内联 -e',
    cmd: 'node scripts/a.mjs && pnpm run build && node -e "1"',
    wantRefs: ['scripts/a.mjs'],
  },
  {
    name: 'C 判据:--filter app... run build:static,依赖只有 build → 静默跳过(即 CI build-web 真故障)',
    dockerfile: 'FROM n\nRUN pnpm --filter @t/app... run build:static\n',
    graph: new Map([
      ['@t/app', { scripts: new Set(['build', 'build:static']), hasBuild: true, deps: ['@t/dep'] }],
      ['@t/dep', { scripts: new Set(['build']), hasBuild: true, deps: [] }],
    ]),
    want: 'violation',
  },
  {
    name: 'C 判据修法有效性:先 --filter app^... run build 再单独 run build:static',
    dockerfile:
      'FROM n\nRUN pnpm --filter @t/app^... run build && pnpm --filter @t/app run build:static\n',
    graph: new Map([
      ['@t/app', { scripts: new Set(['build', 'build:static']), hasBuild: true, deps: ['@t/dep'] }],
      ['@t/dep', { scripts: new Set(['build']), hasBuild: true, deps: [] }],
    ]),
    want: 'pass',
  },
  {
    name: 'C 判据反例:依赖是纯类型/配置包(自身无 build)→ 跳过是正确行为,不报',
    dockerfile: 'FROM n\nRUN pnpm --filter @t/app... run build:static\n',
    graph: new Map([
      [
        '@t/app',
        { scripts: new Set(['build', 'build:static']), hasBuild: true, deps: ['@t/tsconfig'] },
      ],
      ['@t/tsconfig', { scripts: new Set(), hasBuild: false, deps: [] }],
    ]),
    want: 'pass',
  },
  {
    name: 'C 判据反例:取反/上游方向等认不出的 filter 表达式一律放过(宁漏不误报)',
    dockerfile: 'FROM n\nRUN pnpm --filter "!@t/app" run build:static\n',
    graph: new Map([['@t/app', { scripts: new Set(['build']), hasBuild: true, deps: [] }]]),
    want: 'pass',
  },
  {
    name: 'C 判据:反斜杠续行的 RUN 同样判定(logicalLines 折叠生效)',
    dockerfile: 'FROM n\nRUN pnpm \\\n  --filter @t/app... \\\n  run build:static\n',
    graph: new Map([
      ['@t/app', { scripts: new Set(['build', 'build:static']), hasBuild: true, deps: ['@t/dep'] }],
      ['@t/dep', { scripts: new Set(['build']), hasBuild: true, deps: [] }],
    ]),
    want: 'violation',
  },
]

function selfTest() {
  let bad = 0
  for (const c of SELFTEST_CASES) {
    if (c.wantRefs) {
      const got = lifecycleScriptRefs({ scripts: { postinstall: c.cmd } })
      const ok = JSON.stringify(got) === JSON.stringify(c.wantRefs)
      if (!ok) bad++
      console.log(`${ok ? '✅' : '❌'} ${c.name}(实得 ${JSON.stringify(got)})`)
      continue
    }
    if (c.graph) {
      const v = checkPnpmFilterScripts({
        content: c.dockerfile,
        rel: 'deploy/docker/Dockerfile.t',
        graph: c.graph,
      })
      const got = v.length ? 'violation' : 'pass'
      const ok = got === c.want
      if (!ok) bad++
      console.log(`${ok ? '✅' : '❌'} ${c.name}(期望 ${c.want},实得 ${got})`)
      continue
    }
    const v = checkLifecycleCopies({
      dockerfile: 't',
      content: c.dockerfile,
      refs: c.refs,
      rel: 'deploy/docker/Dockerfile.t',
    })
    const got = v.length ? 'violation' : 'pass'
    const ok = got === c.want
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${c.name}(期望 ${c.want},实得 ${got})`)
  }
  // ---- 判定面构造证明(2026-09-26 迁移配套)------------------------------------
  // 现场:临时 git 仓里 `package.json` 的**索引版本**新增了 postinstall 钩子(引用一个没被 COPY 的
  // 脚本),而 **HEAD 版本**没有。四条断言各证明一件事,少一条就是恒真式:
  //   ① staged 面必须取到索引那一份(钩子 = 1)⇒"跟面走"不是注释;
  //   ② head 面对同一输入必须取到 HEAD 那一份(钩子 = 0)⇒ ① 的反向对照;
  //   ③ A 判据的基准按本门既有口径**恒取 HEAD**(文件头注释写明的),所以它此刻必须看不见索引那一份;
  //   ④ HEAD 取不到才降级工作树,两面都取不到 ⇒ 抛 `Undetermined`(对外 exit 2),绝不静默判绿。
  // ⚠️ 断言必须**在 rmScratch 之前**执行:上一版把注册与执行拆到 finally 两侧,用例真正跑起来时
  //    目录已没了,`spawnSync` 报的是 `git.exe ENOENT` —— 一个夹具生命周期 bug 伪装成"git 坏了"。
  const extra = []
  const xt = (name, fn) => extra.push({ name, fn })
  const repo = mkScratch('ihui-dockerfile-face-')
  try {
    const pkgClean = JSON.stringify({ name: 't', scripts: {} })
    const pkgHook = JSON.stringify({ name: 't', scripts: { postinstall: 'node scripts/new-hook.mjs' } })
    mkdirSync(join(repo, 'packages', 'a'), { recursive: true })
    writeFileSync(join(repo, 'package.json'), pkgClean, 'utf8')
    gitRaw(['init', '-q'], repo, { timeout: GIT_TIMEOUT })
    gitRaw(['add', '-A'], repo, { timeout: GIT_TIMEOUT })
    gitRaw(['-c', 'user.name=gate', '-c', 'user.email=gate@local', 'commit', '-q', '-m', 'base'], repo, { timeout: GIT_TIMEOUT })
    writeFileSync(join(repo, 'package.json'), pkgHook, 'utf8')
    gitRaw(['add', '--', 'package.json'], repo, { timeout: GIT_TIMEOUT })

    xt('索引内容与 HEAD 不同 ⇒ staged 面必须取索引那一份(A 判据基准的钩子数 = 1)', () => {
      const refs = lifecycleScriptRefs(JSON.parse(readAtFace(repo, 'staged', 'package.json')))
      if (refs.length !== 1 || refs[0] !== 'scripts/new-hook.mjs') throw new Error(`实得 ${JSON.stringify(refs)}`)
    })
    xt('同一输入在 HEAD 面给出 HEAD 的结论(反向对照:上一条不是恒真式)', () => {
      const refs = lifecycleScriptRefs(JSON.parse(readAtFace(repo, 'head', 'package.json')))
      if (refs.length !== 0) throw new Error(`HEAD 那一版没有钩子,实得 ${JSON.stringify(refs)}`)
    })
    xt('A 判据的基准按既有口径恒取 HEAD —— 索引里改了也不算跟随索引', () => {
      const got = lifecyclePackageSource(repo)
      if (got.used !== 'HEAD blob') throw new Error(`used=${got.used}`)
      if (lifecycleScriptRefs(JSON.parse(got.src)).length !== 0) throw new Error('A 判据基准不该跟随索引那一份')
    })
    xt('HEAD 取不到才降级工作树;两面都取不到 ⇒ 抛 Undetermined(不得把"没读到"记成通过)', () => {
      const diskOnly = lifecyclePackageSource(repo, (face) => (face === 'head' ? null : pkgHook))
      if (lifecycleScriptRefs(JSON.parse(diskOnly.src)).length !== 1) throw new Error('降级后必须看见工作树那一份的钩子')
      let threw = null
      try {
        lifecyclePackageSource(repo, () => null)
      } catch (e) {
        threw = e
      }
      if (!(threw instanceof Undetermined)) throw new Error(`两面都取不到必须抛 Undetermined,实得 ${String(threw)}`)
    })

    for (const c of extra) {
      try {
        c.fn()
        console.log(`✅ ${c.name}`)
      } catch (e) {
        bad++
        console.log(`❌ ${c.name} — ${e.message}`)
      }
    }
  } finally {
    rmScratch(repo)
  }
  const n = SELFTEST_CASES.length + extra.length
  console.log(bad === 0 ? `\nself-test 全通过(${n} 例)` : `\nself-test 失败 ${bad}/${n} 例`)
  return bad === 0 ? 0 : 1
}

function listDockerfiles(staged) {
  const base = staged
    ? gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : gitLines(['ls-files'])
  return base.filter((f) => /(^|\/)Dockerfile([.\-]|$)/i.test(f) && !f.includes('node_modules'))
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.log(
      [
        '用法: node scripts/check-dockerfile-copy-paths.mjs [--staged|--self-test|--help]',
        '',
        'A: 走根 workspace 上下文装依赖的 Dockerfile,必须 COPY 根 package.json 生命周期钩子引用的脚本',
        'B: 每条 COPY 源路径必须能从构建上下文取到(仓库根 / Dockerfile 同目录各试一次)',
        'C: `pnpm --filter <spec>... run <script>` 不得静默跳过"带 build 却没有该脚本"的依赖包',
        '',
        '退出码: 0 通过 / 1 检出违规 / 2 脚本自身异常',
      ].join('\n'),
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  const staged = argv.includes('--staged')
  // 本门没有"工作树档"这个判定面(A 基准恒取 HEAD、B 的存在性按提交内容、被审内容取工作树),
  // 所以 `--worktree` 不是"另一个面"而是**未知开关**。未知开关静默落进默认分支是本仓踩过的坑
  // (表现为"账面像按档判了,其实什么都没换"),这里直接判死而不是忽略。
  // 把本门口径统一成三面同形属另一票(见 PROJECT_PLAN 第八批交接 H-3 的落地注记)。
  if (argv.includes('--worktree')) {
    console.error(`${C.red}✗${C.reset} 本门无 --worktree 档(判定面口径见文件头,统一属另一票)`)
    return 2
  }
  // A 判据的钩子引用集取自 **HEAD 的根 package.json**:CI/Docker 构建的是提交内容而非工作树,
  // 而工作树里这份文件可能正被并行会话改(实测:它已被本地删掉钩子但未暂存)。
  // 取法走取材层(`readAtFace`),降级顺序与兜底语句与原实现一致;两面都给不出 ⇒ exit 2。
  let pkgSrc
  try {
    pkgSrc = lifecyclePackageSource(ROOT).src
  } catch (e) {
    console.error(`${C.red}✗${C.reset} ${e instanceof Undetermined ? e.message : `读不到根 package.json:${e?.message ?? e}`}`)
    return 2
  }
  let pkg
  try {
    pkg = JSON.parse(pkgSrc)
  } catch (e) {
    console.error(`${C.red}✗${C.reset} 根 package.json 解析失败:${e.message}`)
    return 2
  }
  const rootRefs = lifecycleScriptRefs(pkg)
  const contexts = workflowContexts(ROOT)
  const committed = committedPaths(ROOT)
  if (!committed.size) {
    console.error(`${C.red}✗${C.reset} git ls-tree HEAD 返回空(未真正读到提交内容,不得静默判绿)`)
    return 2
  }
  const graph = workspaceGraph(ROOT)
  if (!graph) {
    console.error(
      `${C.red}✗${C.reset} C 判据读不到任何 workspace 包 package.json(git ls-files 未真正运行,不得静默判绿)`,
    )
    return 2
  }
  const files = listDockerfiles(staged)
  if (!files.length) {
    // 空输入不得恒绿:全量模式下列不出任何 Dockerfile 说明 git ls-files 没真跑起来
    if (staged) {
      console.log(`${C.green}✓${C.reset} 暂存区无 Dockerfile 改动,跳过`)
      return 0
    }
    console.error(`${C.red}✗${C.reset} 未列出任何 Dockerfile(git ls-files 未真正运行,不得静默通过)`)
    return 2
  }
  const violations = []
  let judgedB = 0
  for (const rel of files) {
    let content
    try {
      content = readWorktreeFile(ROOT, rel)
    } catch {
      continue
    }
    if (typeof content !== 'string') continue
    const context = contexts.get(rel) ?? contexts.get(rel.replace(/^\.\/+/, ''))
    if (context) judgedB += 1
    violations.push(...scanDockerfile({ rel, content, rootRefs, context, committed, graph }))
  }
  if (violations.length) {
    console.log(
      `${C.red}✗${C.reset} [check-dockerfile-copy-paths ${staged ? '--staged' : '全量'}] ` +
        `${violations.length} 处 Dockerfile 构建上下文缺陷(扫描 ${files.length} 个 Dockerfile):`,
    )
    for (const v of violations)
      console.log(`   ${v.file} [${v.kind}] ${v.detail}\n     修法则:${v.hint}`)
    console.log(
      `  ${C.dim}根上下文钩子引用集 = ${JSON.stringify(rootRefs)};本地无 docker 时这里是唯一防线${C.reset}`,
    )
    return 1
  }
  console.log(
    `${C.green}✓${C.reset} [check-dockerfile-copy-paths ${staged ? '--staged' : '全量'}] ` +
      `${files.length} 个 Dockerfile 的 COPY 源、钩子依赖与 pnpm --filter 脚本覆盖齐备` +
      `(A 判据钩子引用:${JSON.stringify(rootRefs)};B 判据按 workflow 声明的上下文核了 ${judgedB}/${files.length} 个;` +
      `C 判据按 workspace 包图 ${graph.size} 个包核过依赖构建脚本)`,
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  Promise.resolve(main())
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  main,
  scanDockerfile,
  checkLifecycleCopies,
  checkCopySourcesExist,
  checkPnpmFilterScripts,
  expandFilterSpec,
  logicalLines,
  workspaceGraph,
  parseCopies,
  lifecycleScriptRefs,
  workflowContexts,
  committedPaths,
  SELFTEST_CASES,
  LIFECYCLE_KEYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
