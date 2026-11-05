#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口内置名单件生成器(goal-b49 Z26)—— 把「内置内网名段 / 内网域名族」那张表产出为
 * **机器可消费的派生态**,让 Rust 侧 `include_str!` 吃到它,从而把 Z17 留在
 * `egress_gate.rs` 的两条 `unjudged` 腿接掉。
 *
 * 源头(唯一,本文件**不写任何名单字面量**,§0.6):
 *  - `packages/shared/src/utils/ssrf-guard.ts` → `DENIED_HOST_NAMES` / `DENIED_HOST_SUFFIXES`
 *    (经 re-export 打到 `ip-literal.ts` 的 `DENIED_CIDRS` / `IPV6_EMBEDDED_V4_PREFIXES`);
 *  - `apps/cli/src/sandbox/egress/builtin-rules.ts` → `BUILTIN_EGRESS_RULES`
 *    (那张表把网段/域名族**折成规则形状**的两行族语义在此,不在本文件复算);
 *  - `apps/cli/src/sandbox/egress/policy.ts` → `judgeEgressTarget`
 *    (跨语言行为向量的**期望值由生产判据本体算**,不是本文件猜的)。
 *
 * 派生纪律(照本仓受管块口径):
 *  - 产物幂等:同一批源 ⇒ 逐字节相同(产物里**没有时刻/计数/随机量**,否则每次跑都漂);
 *  - 派生态**禁止手改**:改判据只改源文件,再 `node scripts/generate-egress-builtin-list.mjs --write`;
 *  - 取材失败 ⇒ exit 2「未判定」并点名原因,绝不写半张表、绝不拿 0 冒充「没有」(§0.3);
 *  - 枚举到 0 条 ⇒ 判死(同样 exit 2)。
 *
 * TS 侧「生产判据怎么被 node 加载」:shared/cli 的源用**无扩展名相对 import**
 * (`./ip-literal`),node 原生 type-stripping 认不出这种形(2026-11-06 实测
 * ERR_MODULE_NOT_FOUND),而仓库里没有 esbuild/jiti/tsx 可借 ⇒ 唯一出口 = 运行时临时
 * resolve 钩子。钩子夹具落 `scripts/lib/scratch-dir.mjs` 的 `mkScratch()`(§15b:
 * 工作树内禁止夹具、禁止 os.tmpdir()),用完 `rmScratch()`;钩子文件**不入仓**。
 *
 * 用法:
 *   node scripts/generate-egress-builtin-list.mjs            # 只读预演,报 drift/no-drift
 *   node scripts/generate-egress-builtin-list.mjs --write    # 落盘 + 紧随注入水印
 *   node scripts/generate-egress-builtin-list.mjs --self-test
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { spawnSync } from 'node:child_process'

import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 派生态落点(与 TS 源同目录,消费方一眼看得出它是谁家的)。 */
export const ARTIFACT_REL = 'packages/shared/src/utils/egress-builtin-list.json'
export const ARTIFACT_PATH = join(ROOT, ARTIFACT_REL)

const SRC = {
  ssrfGuard: 'packages/shared/src/utils/ssrf-guard.ts',
  ipLiteral: 'packages/shared/src/utils/ip-literal.ts',
  cliBuiltin: 'apps/cli/src/sandbox/egress/builtin-rules.ts',
  cliPolicy: 'apps/cli/src/sandbox/egress/policy.ts',
}

/**
 * 跨语言行为向量语料:**一律 host 形**(裸主机名 / IP 字面量)。
 * 刻意不放整条 URL —— CLI 那把尺吃的是 host 词(`dns-adjudicator.ts` 先从命令行剥),
 * 而 Rust 侧的出站点交的是 URL(它自己剥 scheme/path,见 egress_gate.rs 头注);
 * 把 URL 塞进共用语料只会钉住那个剥法差异而不是这张表(剥法另有 e9 型用例单独钉)。
 */
export const VECTOR_CORPUS = [
  '', 'localhost', 'LOCALHOST.', 'ip6-localhost', 'ip6-loopback', 'metadata',
  'a.local', 'sub.a.local', 'deep.sub.a.local', 'x.internal', 'y.internaldomain',
  'z.localhost', 'local', 'internal', 'example.com', 'aizhs.top', 'notlocal.host',
  '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.20.0.1',
  '192.0.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '240.0.0.1', '8.8.8.8',
  '::', '::1', '100::1', '2001:db8::1', '64:ff9b:1::5', 'fc00::1', 'fe80::1', 'ff02::1',
  '2002:0808:0808::1', '64:ff9b::808:808', '2002:7f00:0001::', '64:ff9b::a9fe:a9fe',
  '::ffff:127.0.0.1',
]

const HOOK_SRC = `export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const tries = []
    if (/\\.(?:js|mjs)$/.test(specifier)) tries.push(specifier.replace(/\\.(?:js|mjs)$/, '.ts'))
    else if (!/\\.[A-Za-z]{2,5}$/.test(specifier)) tries.push(specifier + '.ts')
    for (const candidate of tries) {
      try { return await nextResolve(candidate, context) } catch { /* 回落到原名报错 */ }
    }
    throw err
  }
}
`

/** 经运行时钩子加载四张源;任一侧加载不起来 ⇒ 抛错由调用方折成 exit 2(不猜、不回落)。 */
export async function loadTsEngines () {
  for (const [role, rel] of Object.entries(SRC)) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`源缺失(${role}): ${rel}`)
  }
  const scratch = mkScratch('ihui-egress-list-hook-')
  try {
    const hookFile = join(scratch, 'ts-extension-resolve-hook.mjs')
    writeFileSync(hookFile, HOOK_SRC, 'utf8')
    register(pathToFileURL(hookFile).href)
    const guard = await import(pathToFileURL(join(ROOT, SRC.ssrfGuard)).href)
    const builtin = await import(pathToFileURL(join(ROOT, SRC.cliBuiltin)).href)
    const policy = await import(pathToFileURL(join(ROOT, SRC.cliPolicy)).href)
    return { guard, builtin, policy }
  } finally {
    rmScratch(scratch)
  }
}

export function buildManifest ({ guard, builtin, policy }) {
  const hostNames = [...guard.DENIED_HOST_NAMES]
  const hostSuffixes = [...guard.DENIED_HOST_SUFFIXES]
  const deniedCidrs = [...guard.DENIED_CIDRS]
  const embedded = (guard.IPV6_EMBEDDED_V4_PREFIXES ?? []).map((row) => ({
    cidr: row.cidr,
    v4BitOffset: row.v4BitOffset,
    label: row.label,
  }))
  const rows = (builtin.BUILTIN_EGRESS_RULES ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    effect: row.effect,
    enforcement: row.enforcement,
    why: row.why,
  }))
  for (const [name, list] of [['DENIED_HOST_NAMES', hostNames], ['DENIED_HOST_SUFFIXES', hostSuffixes], ['DENIED_CIDRS', deniedCidrs], ['IPV6_EMBEDDED_V4_PREFIXES', embedded], ['BUILTIN_EGRESS_RULES', rows]]) {
    if (list.length === 0) throw new Error(`${name} 现读取到 0 条 ⇒ 枚举到空判死,不记绿(§0.3)`)
  }
  // 表 ⇄ 名单的存续对账(只做「每条源名单都要在规则表里露头」的存在性核对,不复算两行族形)。
  for (const name of hostNames) {
    if (!rows.some((row) => row.domain === name)) throw new Error(`规则表缺主机名行: ${name}`)
  }
  for (const suffix of hostSuffixes) {
    const tld = suffix.replace(/^\./, '')
    if (!rows.some((row) => row.domain === tld)) throw new Error(`规则表缺后缀根层行: ${tld}`)
    if (!rows.some((row) => row.domain === `**.${tld}`)) throw new Error(`规则表缺后缀子域行: **.${tld}`)
  }
  const vectors = VECTOR_CORPUS.map((target) => {
    const j = policy.judgeEgressTarget(target, builtin.BUILTIN_EGRESS_POLICY)
    return {
      target,
      decision: j.decision,
      layer: j.layer,
      reason: j.reason,
      ruleId: j.ruleId ?? null,
      enforcement: j.enforcement,
    }
  })
  if (vectors.some((v) => !['allow', 'deny', 'unjudged'].includes(v.decision))) {
    throw new Error('TS 引擎给出的 decision 取值不在档位表内 ⇒ 语料或源判据形变,不落盘')
  }
  return {
    schema: 'ihui-egress-builtin-list/v1',
    generatedBy: 'scripts/generate-egress-builtin-list.mjs',
    handEditForbidden: '派生态:改判据只改 packages/shared/src/utils/{ssrf-guard,ip-literal}.ts 与 apps/cli/src/sandbox/egress/builtin-rules.ts,再跑生成器 --write;手改本文件由 scripts/check-egress-builtin-list-sync.mjs 判红',
    consumedBy: 'apps/desktop/src-tauri/src/egress_gate.rs(include_str!)',
    sources: SRC,
    hostNames,
    hostSuffixes,
    deniedCidrs,
    ipv6EmbeddedV4Prefixes: embedded,
    rows,
    vectors,
  }
}

export function serialize (manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function main () {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  return loadTsEngines()
    .then((engines) => {
      const text = serialize(buildManifest(engines))
      const current = existsSync(ARTIFACT_PATH) ? readFileSync(ARTIFACT_PATH, 'utf8') : null
      if (current === text) {
        console.log(`[egress-list] drift=no artifact=${ARTIFACT_REL}`)
        return 0
      }
      if (!argv.includes('--write')) {
        console.log(`[egress-list] drift=yes(${current === null ? '产物不存在' : '与源重算不同'})—— 跑 --write 落盘`)
        return 1
      }
      writeFileSync(ARTIFACT_PATH, text, 'utf8')
      const inject = spawnSync(process.execPath, [join(ROOT, 'scripts/watermark.mjs'), 'inject', ARTIFACT_PATH], {
        encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
      console.log(`[egress-list] wrote ${ARTIFACT_REL} bytes=${text.length} watermark-inject rc=${inject.status ?? 'null'} ${(inject.stdout ?? '').trim().split('\n').pop() ?? ''}`)
      return 0
    })
    .catch((e) => {
      console.error(`[egress-list] 未判定/失败: ${e?.message ?? e}`)
      process.exitCode = 2
    })
}

function selfTest () {
  const results = []
  const ok = (name, cond) => results.push([cond, name])
  ok('产物落点在册目录', ARTIFACT_REL.startsWith('packages/shared/src/utils/'))
  ok('语料含裸根层', VECTOR_CORPUS.includes('localhost') && VECTOR_CORPUS.includes('local'))
  ok('语料含嵌入 v4 的正反两例', VECTOR_CORPUS.includes('64:ff9b::a9fe:a9fe') && VECTOR_CORPUS.includes('64:ff9b::808:808'))
  ok('序列化零时刻(幂等前提)', !new Date().toISOString().slice(0, 10).includes(serialize({ a: 1 })))
  ok('钩子源码不写死盘符', !HOOK_SRC.includes('G:\\') && !HOOK_SRC.includes('/home/'))
  return loadTsEngines()
    .then((engines) => {
      const m = buildManifest(engines)
      ok('名单来自源而非本文件常量', m.hostNames.includes('metadata') && m.deniedCidrs.includes('169.254.0.0/16') && m.rows.length > m.hostNames.length)
      ok('每条内置网段都有向量落到它', m.vectors.length === VECTOR_CORPUS.length)
      ok('两行族形由 cli 表给出而非本文件拼', m.rows.some((r) => r.domain.startsWith('**.')))
      const again = serialize(buildManifest(engines))
      ok('两次序列化逐字节相同', again === serialize(m))
      let failed = 0
      for (const [pass, name] of results) {
        console.log(`${pass ? '✓' : '✗'} ${name}`)
        if (!pass) failed += 1
      }
      console.log(`[egress-list:self-test] ${results.length - failed}/${results.length} 通过`)
      process.exitCode = failed === 0 ? 0 : 1
    })
    .catch((e) => {
      console.error(`[egress-list:self-test] 未判定: ${e?.message ?? e}`)
      process.exitCode = 2
    })
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { ARTIFACT_REL, ARTIFACT_PATH, SRC, VECTOR_CORPUS, HOOK_SRC, loadTsEngines, buildManifest, serialize }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
