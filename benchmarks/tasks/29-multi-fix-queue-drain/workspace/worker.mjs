// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { Queue } from './queue.mjs';

export function processAll(values) {
  const q = new Queue();
  for (const v of values) q.enqueue(v);
  return q.drain().map((v) => `job-${v}`);
}
