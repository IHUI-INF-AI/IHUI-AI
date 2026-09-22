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
 *
 * 用法:node scripts/check-dockerfile-copy-paths.mjs [--staged|--self-test|--help]
 * 退出码:0 通过 / 1 检出违规 / 2 脚本自身异常。
 * 紧急跳过:HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1 git commit ...
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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

function gitLines(args) {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
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
      text = readFileSync(join(root, wf), 'utf8')
    } catch {
      continue
    }
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
    files = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'ls-tree', '-r', '--name-only', 'HEAD'],
      {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      },
    )
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

export function scanDockerfile({ rel, content, rootRefs, context, committed }) {
  return [
    ...checkLifecycleCopies({ content, refs: rootRefs, rel }),
    ...(context ? checkCopySourcesExist({ content, rel, context, committed }) : []),
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
  const n = SELFTEST_CASES.length
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
        '',
        '退出码: 0 通过 / 1 检出违规 / 2 脚本自身异常',
      ].join('\n'),
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  const staged = argv.includes('--staged')
  // A 判据的钩子引用集取自 **HEAD 的根 package.json**:CI/Docker 构建的是提交内容而非工作树,
  // 而工作树里这份文件可能正被并行会话改(实测:它已被本地删掉钩子但未暂存)。
  let pkgSrc
  try {
    pkgSrc = execFileSync('git', ['-c', 'safe.directory=*', 'show', 'HEAD:package.json'], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
  } catch {
    try {
      pkgSrc = readFileSync(join(ROOT, 'package.json'), 'utf8')
    } catch (e) {
      console.error(`${C.red}✗${C.reset} 读不到根 package.json(HEAD 与工作树均失败):${e.message}`)
      return 2
    }
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
      content = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue
    }
    const context = contexts.get(rel) ?? contexts.get(rel.replace(/^\.\/+/, ''))
    if (context) judgedB += 1
    violations.push(...scanDockerfile({ rel, content, rootRefs, context, committed }))
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
      `${files.length} 个 Dockerfile 的 COPY 源与钩子依赖齐备` +
      `(A 判据钩子引用:${JSON.stringify(rootRefs)};B 判据按 workflow 声明的上下文核了 ${judgedB}/${files.length} 个)`,
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
  parseCopies,
  lifecycleScriptRefs,
  workflowContexts,
  committedPaths,
  SELFTEST_CASES,
  LIFECYCLE_KEYS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
