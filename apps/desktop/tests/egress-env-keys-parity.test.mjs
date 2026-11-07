// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端出口门与 CLI 那把尺的**同源的三条对账尺**(goal-b49 Z17,离线、零网络、零新依赖)。
 *
 * 跑法:`node --test apps/desktop/tests/egress-env-keys-parity.test.mjs`
 *
 * 纪律(§0.6 / §22c):本文件**只 import 两侧的源文本取"清单/键名"**,不复制任何判定实现;
 * 判据本体在 `apps/cli/src/sandbox/egress/policy.ts`(TS 那把尺)与
 * `apps/desktop/src-tauri/src/egress_gate.rs`(Rust 消费同一份 env 声明面)。
 *
 * 三把尺:
 *  1. **键名面同源**:Rust 的 `EGRESS_ENV_KEYS` 必须与 TS 的 `EGRESS_ENV` 逐名相等(双向),
 *     否则两引擎读的是两个开关 ⇒ 机主声明只生效一半。
 *  2. **反向锁(禁第二把尺)**:Rust 侧**不得出现**内置名单字面量(ssrf-guard 的
 *     `DENIED_HOST_NAMES`/`DENIED_HOST_SUFFIXES` 与 `ip-literal.ts` 的 `DENIED_CIDRS`)。
 *     这些字面量从源文件**现读**,不是本文件写死的 —— 名单加了新条目,这把尺自动跟长。
 *  3. **接线锁(§0.9:已装车而文档/代码不点名 = 没装)**:`egress_gate` 必须被 lib.rs 声明,
 *     且每个真的把 URL 交给 reqwest 的 Rust 文件必须要么调用 `guard_egress_target`,
 *     要么带行内 `egress-gate-exempt: <原因>`;豁免族必须逐条点名(不得静默通过)。
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const cliPolicyPath = join(repoRoot, 'apps', 'cli', 'src', 'sandbox', 'egress', 'policy.ts');
const rustGatePath = join(repoRoot, 'apps', 'desktop', 'src-tauri', 'src', 'egress_gate.rs');
const rustLibPath = join(repoRoot, 'apps', 'desktop', 'src-tauri', 'src', 'lib.rs');
const rustSrcDir = join(repoRoot, 'apps', 'desktop', 'src-tauri', 'src');
const ssrfGuardPath = join(repoRoot, 'packages', 'shared', 'src', 'utils', 'ssrf-guard.ts');
const ipLiteralPath = join(repoRoot, 'packages', 'shared', 'src', 'utils', 'ip-literal.ts');

const read = (p) => readFileSync(p, 'utf8');

/** 取 TS 源里 `export const EGRESS_ENV = { … } as const` 的**值**(键名清单)。 */
function tsEgressEnvKeys() {
  const src = read(cliPolicyPath);
  const block = src.match(/export const EGRESS_ENV\s*=\s*\{([\s\S]*?)\}\s*as const/);
  assert(block, `EGRESS_ENV 声明块在 ${cliPolicyPath} 找不到(源形变了 ⇒ 本尺失明,判失败)`);
  const keys = [...block[1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
  assert(keys.length > 0, 'EGRESS_ENV 现读取到 0 枚键 ⇒ 枚举到空判死(§0.3),不记绿');
  return keys;
}

/** 取 Rust 源里 `pub const EGRESS_ENV_KEYS: [&str; N] = [ … ];` 的字面量清单。 */
function rustEgressEnvKeys() {
  const src = read(rustGatePath);
  const block = src.match(/pub const EGRESS_ENV_KEYS\s*:\s*\[&str;\s*(\d+)\]\s*=\s*\[([\s\S]*?)\];/);
  assert(block, `EGRESS_ENV_KEYS 声明块在 ${rustGatePath} 找不到`);
  const declaredCount = Number(block[1]);
  const keys = [...block[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(keys.length, declaredCount, `元组长度声明 ${declaredCount} ≠ 现读 ${keys.length} 枚`);
  return keys;
}

/** 现读内置名单字面量(不写死在本文件里 —— 写死就是第三把尺)。 */
function builtinLiteralList() {
  const names = read(ssrfGuardPath).match(/export const DENIED_HOST_NAMES\s*=\s*\[([^\]]*)\]/);
  const suffixes = read(ssrfGuardPath).match(/export const DENIED_HOST_SUFFIXES\s*=\s*\[([\s\S]*?)\]/);
  const cidrs = read(ipLiteralPath).match(/export const DENIED_CIDRS\s*=\s*\[([\s\S]*?)\]/);
  assert(names && suffixes && cidrs, 'ssrf-guard / ip-literal 的名单声明形读不到 ⇒ 反向失明,判失败');
  const pick = (body) => [...String(body).matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]).filter((v) => v.length > 0);
  const literals = [...pick(names[1]), ...pick(suffixes[1]), ...pick(cidrs[1])];
  assert(literals.length > 0, '内置名单现读为 0 条 ⇒ 枚举到空判死,不记绿');
  return literals;
}

test('① 键名面同源:Rust EGRESS_ENV_KEYS == TS EGRESS_ENV(双向逐名)', () => {
  const ts = tsEgressEnvKeys().sort();
  const rs = rustEgressEnvKeys().sort();
  assert.deepEqual(rs, ts, `键名漂移: TS=${JSON.stringify(ts)} Rust=${JSON.stringify(rs)}`);
});

test('② 反向锁:Rust 门体内不得出现内置名单字面量(§0.6 第二把尺)', () => {
  const rust = read(rustGatePath);
  // 只查"作为数据出现"的形态:整行字面量常量;文档注释里的点名(说明为何不接)不算命中。
  const codeLines = rust
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\/!|\*)/.test(line))
    .join('\n');
  const offenders = builtinLiteralList().filter((literal) => codeLines.includes(`"${literal}"`));
  assert.deepEqual(offenders, [], `内置名单被复制进 Rust: ${JSON.stringify(offenders)}`);
});

test('③ 接线锁:模块已声明,且每个 reqwest 出站点都真的过了门', () => {
  assert.match(read(rustLibPath), /^mod egress_gate;/m, 'egress_gate 未在 lib.rs 声明 ⇒ 造了没装车');
  const files = readdirSync(rustSrcDir).filter((f) => f.endsWith('.rs'));
  const dialers = files.filter((f) => {
    const src = read(join(rustSrcDir, f));
    return src.includes('reqwest') && /\.send\(\)/.test(src);
  });
  assert(dialers.length > 0, '现读 0 枚 reqwest 出站点 ⇒ 枚举到空判死,不记绿');
  const unwired = dialers.filter((f) => {
    const src = read(join(rustSrcDir, f));
    return !src.includes('guard_egress_target') && !/egress-gate-exempt:\s*\S/.test(src);
  });
  assert.deepEqual(unwired, [], `出站点未过门也未具名豁免: ${JSON.stringify(unwired)}`);
  // 门体自身不算出站点(它零网络),但它必须被 ≥1 枚出站点调用。
  const callers = dialers.filter((f) => read(join(rustSrcDir, f)).includes('guard_egress_target'));
  assert(callers.length >= 4, `调用现读 ${callers.length} 枚文件,少于已知 4 处出站点 ⇒ 接线退化`);
});

test('④ 形状锁:门体零网络、零新依赖(只 std + log)', () => {
  const rust = read(rustGatePath)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\/!|\*)/.test(line))
    .join('\n');
  for (const banned of ['reqwest', 'TcpStream', 'UdpSocket', 'std::net::', 'getaddrinfo']) {
    assert(!rust.includes(banned), `出口门本体不得自己拨网络:命中 ${banned}`);
  }
  const cargoToml = read(join(repoRoot, 'apps', 'desktop', 'src-tauri', 'Cargo.toml'));
  assert(!/^\s*(idna|url|regex|trust-dns|hickory)/m.test(cargoToml), '本票不得新增 Rust 依赖');
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
