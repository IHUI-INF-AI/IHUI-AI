// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const loader = await import(pathToFileURL(resolve('loader.mjs')).href);
const cfg = await import(pathToFileURL(resolve('config.mjs')).href);
assert.equal(typeof cfg.loadConfig, 'function', 'config.mjs 必须导出 loadConfig');
assert.deepEqual(loader.loadSettings(), { env: 'test', debug: true });
console.log('PASS');
