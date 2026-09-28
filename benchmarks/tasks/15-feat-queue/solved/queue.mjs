// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export class TaskQueue {
  constructor() {
    this._items = [];
  }
  enqueue(x) {
    this._items.push(x);
  }
  dequeue() {
    return this._items.shift();
  }
  peek() {
    return this._items[0];
  }
  size() {
    return this._items.length;
  }
}
