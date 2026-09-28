// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const server = await import(pathToFileURL(resolve('server.mjs')).href);
const config = await import(pathToFileURL(resolve('config.mjs')).href);
assert.equal(server.getPort(), 8080);
assert.equal(config.port, 8080);
console.log('PASS');
