#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ITCP 独立包同步器(2026-11-27):把仓库内的契约类型与规范正文同步到 `protocol/`,
// 产出一个**不进 workspace、不依赖锁文件**的独立包目录(可直接 npm publish)。
//
// 边界与不变量:
//   1. 源的唯一权威是 `packages/types/src/tool-contract.ts` 与 `docs/spec/tool-contract-protocol.md`;
//      `protocol/` 里的产物一律由本脚本生成,禁止手改(改了 `--check` 会红)。
//   2. 产物首部只加一行 AUTO-SYNCED 提示,其余逐字节等于源(CRLF 归一化)。
//   3. 只复制、不改写语义;不做类型裁剪(裁剪会让"外部看见的契约"与"守门判的契约"分叉)。
//
// 用法:
//   node scripts/sync-itcp-package.mjs           # 生成/刷新 protocol/
//   node scripts/sync-itcp-package.mjs --check   # 只比对,不同步则退出码 1(供测试与 CI)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SRC_TYPE = resolve(REPO, 'packages/types/src/tool-contract.ts');
const SRC_SPEC = resolve(REPO, 'docs/spec/tool-contract-protocol.md');
const OUT_TYPE = resolve(REPO, 'protocol/src/tool-contract.ts');
const OUT_SPEC = resolve(REPO, 'protocol/docs/tool-contract-protocol.md');

const AUTO_HEADER =
  '// AUTO-SYNCED: 由 scripts/sync-itcp-package.mjs 从 packages/types/src/tool-contract.ts 生成,' +
  '勿手改(要改请改源文件再跑 node scripts/sync-itcp-package.mjs)\n\n';

const norm = (text) => text.replace(/\r\n/g, '\n');
const readOr = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const renderType = () => AUTO_HEADER + norm(readFileSync(SRC_TYPE, 'utf8'));
const renderSpec = () => norm(readFileSync(SRC_SPEC, 'utf8'));

if (process.argv.includes('--check')) {
  const problems = [];
  if (norm(readOr(OUT_TYPE)) !== renderType()) {
    problems.push('protocol/src/tool-contract.ts 与 packages/types/src/tool-contract.ts 不同步');
  }
  if (norm(readOr(OUT_SPEC)) !== renderSpec()) {
    problems.push('protocol/docs/tool-contract-protocol.md 与 docs/spec/tool-contract-protocol.md 不同步');
  }
  if (problems.length > 0) {
    process.stderr.write('[itcp-package] 不同步(跑 node scripts/sync-itcp-package.mjs 修):\n');
    for (const p of problems) process.stderr.write(` - ${p}\n`);
    process.exit(1);
  }
  process.stdout.write('[itcp-package] 同步一致(2/2)\n');
  process.exit(0);
}

mkdirSync(dirname(OUT_TYPE), { recursive: true });
mkdirSync(dirname(OUT_SPEC), { recursive: true });
writeFileSync(OUT_TYPE, renderType(), 'utf8');
writeFileSync(OUT_SPEC, renderSpec(), 'utf8');
process.stdout.write('[itcp-package] 已同步 2 个产物 → protocol/(src/tool-contract.ts, docs/tool-contract-protocol.md)\n');
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
