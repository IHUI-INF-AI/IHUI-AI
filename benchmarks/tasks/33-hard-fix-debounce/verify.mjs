// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const r = spawnSync(process.execPath, ['--test', 'debounce.test.mjs'], { encoding: 'utf8', cwd: process.cwd(), windowsHide: true });
if (r.status !== 0) {
  console.error(r.stdout || ''); console.error(r.stderr || '');
  process.exit(1);
}
console.log('PASS');
