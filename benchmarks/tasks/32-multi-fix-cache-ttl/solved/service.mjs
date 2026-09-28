// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { isExpired } from './cache.mjs';

const store = new Map();
let seq = 0;

export function setCached(key, value, ttl) {
  store.set(key, { value, ttl, createdAt: Date.now(), id: ++seq });
}

export function getCached(key) {
  const e = store.get(key);
  if (!e || isExpired(e)) return null;
  return e.value;
}
