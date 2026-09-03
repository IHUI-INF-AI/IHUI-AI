#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// benchmark 任务套件生成器：node benchmarks/gen.mjs → 生成 benchmarks/tasks/
// 每个任务: workspace/(待修复/待实现 fixture) solved/(参考解) task.md(中文 prompt) verify.mjs(自动判定)
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = join(root, 'tasks');

// JS verify 公共头
const jsHead = (file) =>
`import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const mod = await import(pathToFileURL(resolve('${file}')).href);
`;

// Python verify: 内嵌测试代码, spawn python 执行(自动探测可用解释器)
const pyVerify = (moduleName, lines) =>
`import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const candidates = [
  ...(process.env.BENCH_PYTHON ? [process.env.BENCH_PYTHON] : []),
  'python',
  'python3',
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe'),
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'apps', 'ai-service', '.venv', 'bin', 'python'),
];
let py = null;
for (const c of candidates) {
  if (!c) continue;
  if (c.includes('/') || c.includes('\\\\')) {
    if (existsSync(c)) { py = c; break; }
  } else {
    const probe = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) { py = c; break; }
  }
}
if (!py) {
  console.error('未找到可用 Python 解释器, 可设置 BENCH_PYTHON');
  process.exit(1);
}
const code = [
${lines.map((l) => "  '" + l.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "',").join('\n')}
].join('\\n');
const r = spawnSync(py, ['-c', code], { encoding: 'utf8', cwd: process.cwd() });
if (r.status !== 0) {
  console.error(r.stdout || ''); console.error(r.stderr || '');
  process.exit(1);
}
console.log('PASS');
`;

const tasks = [
  // ---------- JS bug 修复 ----------
  {
    id: '01-fix-sum-off-by-one',
    task: 'workspace 中的 lib.mjs 里 sumTo(n) 应返回 1+2+...+n 的和，当前实现有边界错误。请修复，要求 sumTo(1)===1、sumTo(5)===15、sumTo(100)===5050。',
    files: {
      'lib.mjs': 'export function sumTo(n) {\n  let s = 0;\n  for (let i = 1; i < n; i++) {\n    s += i;\n  }\n  return s;\n}\n',
    },
    solved: {
      'lib.mjs': 'export function sumTo(n) {\n  let s = 0;\n  for (let i = 1; i <= n; i++) {\n    s += i;\n  }\n  return s;\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.sumTo(1), 1);
assert.equal(mod.sumTo(5), 15);
assert.equal(mod.sumTo(100), 5050);
assert.equal(mod.sumTo(0), 0);
console.log('PASS');
`,
  },
  {
    id: '02-fix-reverse-words',
    task: 'lib.mjs 中 reverseWords(s) 应把句子的“单词顺序”反转（单词本身不变），当前实现错误地反转了字符。请修复：reverseWords("hello world foo") === "foo world hello"。',
    files: {
      'lib.mjs': 'export function reverseWords(s) {\n  return s.split("").reverse().join("");\n}\n',
    },
    solved: {
      'lib.mjs': 'export function reverseWords(s) {\n  return s.split(" ").reverse().join(" ");\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.reverseWords('hello world foo'), 'foo world hello');
assert.equal(mod.reverseWords('a'), 'a');
assert.equal(mod.reverseWords('x y'), 'y x');
console.log('PASS');
`,
  },
  {
    id: '03-fix-async-sum',
    task: 'lib.mjs 中 sumAsync(arr) 应将数组每个元素乘 2 后求和，当前实现忘记等待 Promise，返回值是错误的。请修复为正确异步求和：await sumAsync([1,2,3]) === 12。',
    files: {
      'lib.mjs': 'export async function sumAsync(arr) {\n  const doubled = arr.map(async (x) => x * 2);\n  let s = 0;\n  for (const p of doubled) {\n    s += p;\n  }\n  return s;\n}\n',
    },
    solved: {
      'lib.mjs': 'export async function sumAsync(arr) {\n  const doubled = await Promise.all(arr.map(async (x) => x * 2));\n  let s = 0;\n  for (const v of doubled) {\n    s += v;\n  }\n  return s;\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(await mod.sumAsync([1, 2, 3]), 12);
assert.equal(await mod.sumAsync([]), 0);
assert.equal(await mod.sumAsync([-1, 5]), 8);
console.log('PASS');
`,
  },
  {
    id: '04-fix-nested-optional',
    task: 'lib.mjs 中 getUserCity(user) 在 user 为 null/缺 address 时会抛异常。请做安全访问：所有缺失情况返回 undefined，正常情况返回城市名。',
    files: {
      'lib.mjs': 'export function getUserCity(user) {\n  return user.address.city;\n}\n',
    },
    solved: {
      'lib.mjs': 'export function getUserCity(user) {\n  return user?.address?.city;\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.getUserCity({ address: { city: '上海' } }), '上海');
assert.equal(mod.getUserCity(null), undefined);
assert.equal(mod.getUserCity({}), undefined);
assert.equal(mod.getUserCity({ address: null }), undefined);
console.log('PASS');
`,
  },
  {
    id: '05-fix-dedupe',
    task: 'lib.mjs 中 dedupe(arr) 应去除重复元素并保持首次出现顺序，当前逻辑反了（只保留重复项）。请修复。',
    files: {
      'lib.mjs': 'export function dedupe(arr) {\n  const seen = [];\n  return arr.filter((x) => {\n    if (seen.includes(x)) {\n      seen.push(x);\n      return true;\n    }\n    return false;\n  });\n}\n',
    },
    solved: {
      'lib.mjs': 'export function dedupe(arr) {\n  const seen = [];\n  return arr.filter((x) => {\n    if (seen.includes(x)) {\n      return false;\n    }\n    seen.push(x);\n    return true;\n  });\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.deepEqual(mod.dedupe([1, 2, 2, 3, 1]), [1, 2, 3]);
assert.deepEqual(mod.dedupe(['a', 'b', 'a']), ['a', 'b']);
assert.deepEqual(mod.dedupe([]), []);
console.log('PASS');
`,
  },
  {
    id: '06-fix-date-pad',
    task: 'lib.mjs 中 formatDate(d) 应输出零填充的 "YYYY-MM-DD"（月、日两位），如 2026年3月5日 → "2026-03-05"。当前未填充，请修复。',
    files: {
      'lib.mjs': "export function formatDate(d) {\n  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();\n}\n",
    },
    solved: {
      'lib.mjs': 'export function formatDate(d) {\n  const m = String(d.getMonth() + 1).padStart(2, \'0\');\n  const day = String(d.getDate()).padStart(2, \'0\');\n  return d.getFullYear() + \'-\' + m + \'-\' + day;\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.formatDate(new Date(2026, 2, 5)), '2026-03-05');
assert.equal(mod.formatDate(new Date(2026, 10, 23)), '2026-11-23');
assert.equal(mod.formatDate(new Date(2026, 0, 1)), '2026-01-01');
console.log('PASS');
`,
  },
  {
    id: '07-fix-email-regex',
    task: 'lib.mjs 中 isValidEmail(s) 的正则过于严格，拒绝了大写字母、数字、+、- 和 . 等合法字符。请修复：合法常见邮箱返回 true；明显非法（无 @、无域名点、空串、含空格）返回 false。',
    files: {
      'lib.mjs': 'export function isValidEmail(s) {\n  return /^[a-z]+@[a-z]+\\.[a-z]{2,}$/.test(s);\n}\n',
    },
    solved: {
      'lib.mjs': "export function isValidEmail(s) {\n  return typeof s === 'string' && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$/.test(s) && !s.includes(' ');\n}\n",
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.isValidEmail('user@example.com'), true);
assert.equal(mod.isValidEmail('First.Last@sub.domain.org'), true);
assert.equal(mod.isValidEmail('a+b_tag@x.co'), true);
assert.equal(mod.isValidEmail('user-1@mail-site.com'), true);
assert.equal(mod.isValidEmail('plainaddress'), false);
assert.equal(mod.isValidEmail('@missing.com'), false);
assert.equal(mod.isValidEmail('user@nodot'), false);
assert.equal(mod.isValidEmail(''), false);
assert.equal(mod.isValidEmail('user @x.com'), false);
console.log('PASS');
`,
  },
  {
    id: '20-fix-clamp-edge',
    task: 'lib.mjs 中 clamp(v, min, max) 需处理边界：v 为 undefined 或 NaN 时返回 min；min > max 时先交换再夹取。请按此规范修复（如 clamp(5,10,1)===5，clamp(undefined,1,10)===1）。',
    files: {
      'lib.mjs': 'export function clamp(v, min, max) {\n  return Math.min(Math.max(v, min), max);\n}\n',
    },
    solved: {
      'lib.mjs': 'export function clamp(v, min, max) {\n  if (min > max) {\n    const t = min;\n    min = max;\n    max = t;\n  }\n  if (v === undefined || Number.isNaN(v)) {\n    return min;\n  }\n  return Math.min(Math.max(v, min), max);\n}\n',
    },
    verify: jsHead('lib.mjs') +
`assert.equal(mod.clamp(5, 1, 10), 5);
assert.equal(mod.clamp(-3, 0, 10), 0);
assert.equal(mod.clamp(99, 0, 10), 10);
assert.equal(mod.clamp(undefined, 1, 10), 1);
assert.equal(mod.clamp(NaN, 1, 10), 1);
assert.equal(mod.clamp(5, 10, 1), 5);
console.log('PASS');
`,
  },
  // ---------- Python bug 修复 ----------
  {
    id: '08-py-fix-fizzbuzz',
    task: 'fizzbuzz.py 中 fizzbuzz(n) 对 15 的倍数返回错误（分支顺序问题）。请修复：3 的倍数返回 "Fizz"，5 的倍数返回 "Buzz"，15 的倍数返回 "FizzBuzz"，其余返回数字字符串。',
    files: {
      'fizzbuzz.py': 'def fizzbuzz(n):\n    if n % 3 == 0:\n        return "Fizz"\n    if n % 5 == 0:\n        return "Buzz"\n    if n % 15 == 0:\n        return "FizzBuzz"\n    return str(n)\n',
    },
    solved: {
      'fizzbuzz.py': 'def fizzbuzz(n):\n    if n % 15 == 0:\n        return "FizzBuzz"\n    if n % 3 == 0:\n        return "Fizz"\n    if n % 5 == 0:\n        return "Buzz"\n    return str(n)\n',
    },
    verify: pyVerify('fizzbuzz', [
      'import sys; sys.path.insert(0, ".")',
      'from fizzbuzz import fizzbuzz',
      'assert fizzbuzz(15) == "FizzBuzz"',
      'assert fizzbuzz(30) == "FizzBuzz"',
      'assert fizzbuzz(9) == "Fizz"',
      'assert fizzbuzz(10) == "Buzz"',
      'assert fizzbuzz(7) == "7"',
      'assert fizzbuzz(1) == "1"',
      'print("OK")',
    ]),
  },
  {
    id: '09-py-fix-fib',
    task: 'fib.py 中 fib(n) 的基准情形写错了（fib(0) 应为 0）。请修复：fib(0)==0、fib(1)==1、fib(10)==55。',
    files: {
      'fib.py': 'def fib(n):\n    if n < 2:\n        return 1\n    return fib(n - 1) + fib(n - 2)\n',
    },
    solved: {
      'fib.py': 'def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n',
    },
    verify: pyVerify('fib', [
      'import sys; sys.path.insert(0, ".")',
      'from fib import fib',
      'assert fib(0) == 0',
      'assert fib(1) == 1',
      'assert fib(7) == 13',
      'assert fib(10) == 55',
      'print("OK")',
    ]),
  },
  {
    id: '10-py-fix-csv-parse',
    task: 'csvparse.py 中 parse_line(line) 应按逗号切分并去掉每段首尾空白，当前没有去空白导致 "a, b" 解析成 ["a", " b"]。请修复：parse_line("a, b , c") == ["a", "b", "c"]。',
    files: {
      'csvparse.py': 'def parse_line(line):\n    return line.split(",")\n',
    },
    solved: {
      'csvparse.py': 'def parse_line(line):\n    return [t.strip() for t in line.split(",")]\n',
    },
    verify: pyVerify('csvparse', [
      'import sys; sys.path.insert(0, ".")',
      'from csvparse import parse_line',
      'assert parse_line("a, b , c") == ["a", "b", "c"]',
      'assert parse_line("x,y") == ["x", "y"]',
      'assert parse_line("solo") == ["solo"]',
      'print("OK")',
    ]),
  },
  {
    id: '11-py-fix-account',
    task: 'account.py 中 Account.withdraw 缺少校验：amount <= 0 应抛 ValueError；amount 超过余额也应抛 ValueError。请修复（正常取款照常扣减并返回新余额）。',
    files: {
      'account.py': 'class Account:\n    def __init__(self):\n        self.balance = 0\n\n    def deposit(self, amount):\n        self.balance += amount\n        return self.balance\n\n    def withdraw(self, amount):\n        self.balance -= amount\n        return self.balance\n',
    },
    solved: {
      'account.py': 'class Account:\n    def __init__(self):\n        self.balance = 0\n\n    def deposit(self, amount):\n        self.balance += amount\n        return self.balance\n\n    def withdraw(self, amount):\n        if amount <= 0:\n            raise ValueError("amount must be positive")\n        if amount > self.balance:\n            raise ValueError("insufficient balance")\n        self.balance -= amount\n        return self.balance\n',
    },
    verify: pyVerify('account', [
      'import sys; sys.path.insert(0, ".")',
      'from account import Account',
      'a = Account()',
      'a.deposit(100)',
      'try:',
      '    a.withdraw(150)',
      '    sys.exit(1)',
      'except ValueError:',
      '    pass',
      'assert a.withdraw(30) == 70',
      'try:',
      '    a.withdraw(0)',
      '    sys.exit(2)',
      'except ValueError:',
      '    pass',
      'assert a.balance == 70',
      'print("OK")',
    ]),
  },
  // ---------- 新功能实现 ----------
  {
    id: '12-feat-stats',
    task: 'stats.mjs 已有 mean(arr)。请新增两个导出：median(arr)（空数组返回 null；偶数长度返回中间两数平均值）和 mode(arr)（出现次数最多的值，并列时返回最先达到最大出现次数的那个；空数组返回 null）。不要改动 mean。',
    files: {
      'stats.mjs': 'export function mean(arr) {\n  if (!arr.length) return null;\n  return arr.reduce((a, b) => a + b, 0) / arr.length;\n}\n',
    },
    solved: {
      'stats.mjs': 'export function mean(arr) {\n  if (!arr.length) return null;\n  return arr.reduce((a, b) => a + b, 0) / arr.length;\n}\n\nexport function median(arr) {\n  if (!arr.length) return null;\n  const s = [...arr].sort((a, b) => a - b);\n  const mid = Math.floor(s.length / 2);\n  if (s.length % 2 === 1) return s[mid];\n  return (s[mid - 1] + s[mid]) / 2;\n}\n\nexport function mode(arr) {\n  if (!arr.length) return null;\n  const counts = new Map();\n  let best = null;\n  let bestCount = 0;\n  for (const x of arr) {\n    const c = (counts.get(x) || 0) + 1;\n    counts.set(x, c);\n    if (c > bestCount) {\n      bestCount = c;\n      best = x;\n    }\n  }\n  return best;\n}\n',
    },
    verify: jsHead('stats.mjs') +
`assert.equal(mod.mean([1, 2, 3]), 2);
assert.equal(mod.median([1, 3, 2]), 2);
assert.equal(mod.median([1, 2, 3, 4]), 2.5);
assert.equal(mod.median([]), null);
assert.equal(mod.mode([1, 2, 2, 3]), 2);
assert.equal(mod.mode(['a', 'b', 'b', 'a', 'a']), 'a');
assert.equal(mod.mode([]), null);
console.log('PASS');
`,
  },
  {
    id: '13-feat-debounce',
    task: 'timers.mjs 当前为空模块。请实现并导出 debounce(fn, ms)：连续调用时只在最后一次调用后静默 ms 毫秒才执行一次，且只执行最后一次的参数。',
    files: {
      'timers.mjs': 'export {};\n',
    },
    solved: {
      'timers.mjs': 'export function debounce(fn, ms) {\n  let timer = null;\n  return function (...args) {\n    if (timer) clearTimeout(timer);\n    timer = setTimeout(() => {\n      timer = null;\n      fn.apply(this, args);\n    }, ms);\n  };\n}\n',
    },
    verify:
`import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { debounce } = await import(pathToFileURL(resolve('timers.mjs')).href);
let count = 0;
let lastArg = null;
const fn = (x) => { count++; lastArg = x; };
const d = debounce(fn, 50);
d(1);
d(2);
d(3);
await new Promise((r) => setTimeout(r, 130));
assert.equal(count, 1);
assert.equal(lastArg, 3);
d(9);
await new Promise((r) => setTimeout(r, 130));
assert.equal(count, 2);
assert.equal(lastArg, 9);
console.log('PASS');
`,
  },
  {
    id: '14-feat-uuid-validate',
    task: 'uuid.mjs 当前为空模块。请实现并导出 validateUuid(s)：合法 UUID（8-4-4-4-12 十六进制，大小写均可）返回 true，其余（无连字符、非十六进制字符、长度错误、空串、非字符串）返回 false。',
    files: {
      'uuid.mjs': 'export {};\n',
    },
    solved: {
      'uuid.mjs': "export function validateUuid(s) {\n  if (typeof s !== 'string') return false;\n  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);\n}\n",
    },
    verify: jsHead('uuid.mjs') +
`assert.equal(mod.validateUuid('123e4567-e89b-12d3-a456-426614174000'), true);
assert.equal(mod.validateUuid('123E4567-E89B-12D3-A456-426614174000'), true);
assert.equal(mod.validateUuid('123e4567e89b12d3a456426614174000'), false);
assert.equal(mod.validateUuid('123e4567-e89b-12d3-a456-42661417400g'), false);
assert.equal(mod.validateUuid(''), false);
assert.equal(mod.validateUuid('123e4567-e89b-12d3-a456-4266141740'), false);
assert.equal(mod.validateUuid(null), false);
console.log('PASS');
`,
  },
  {
    id: '15-feat-queue',
    task: 'queue.mjs 当前为空模块。请实现并导出 class TaskQueue：enqueue(x) 入队；dequeue() 出队并返回队首元素（空队返回 undefined）；peek() 查看队首（空队 undefined）；size() 返回当前长度。要求 FIFO。',
    files: {
      'queue.mjs': 'export {};\n',
    },
    solved: {
      'queue.mjs': 'export class TaskQueue {\n  constructor() {\n    this._items = [];\n  }\n  enqueue(x) {\n    this._items.push(x);\n  }\n  dequeue() {\n    return this._items.shift();\n  }\n  peek() {\n    return this._items[0];\n  }\n  size() {\n    return this._items.length;\n  }\n}\n',
    },
    verify: jsHead('queue.mjs') +
`const { TaskQueue } = mod;
const q = new TaskQueue();
assert.equal(q.size(), 0);
assert.equal(q.dequeue(), undefined);
assert.equal(q.peek(), undefined);
q.enqueue('a');
q.enqueue('b');
q.enqueue(3);
assert.equal(q.size(), 3);
assert.equal(q.peek(), 'a');
assert.equal(q.dequeue(), 'a');
assert.equal(q.dequeue(), 'b');
assert.equal(q.dequeue(), 3);
assert.equal(q.size(), 0);
console.log('PASS');
`,
  },
  // ---------- 多文件任务 ----------
  {
    id: '16-multi-rename',
    task: '将 mathUtils.mjs 中的 addNumbers 全局重命名为 sum，并同步更新 app.mjs 的引用。完成后 mathUtils 只导出 sum（不再有 addNumbers），app.total 行为不变。注意：app.mjs 必须继续命名导出 total 函数（外部 `import * as app from \'./app.mjs\'` 后 `app.total(1, 2, 3) === 6`）；sum 保持两参数签名（`sum(2, 3) === 5`）；重命名必须彻底——app.mjs 文件内容中不得再出现字符串 addNumbers（包括注释、说明文字，不只是 import 与调用处）。',
    files: {
      'mathUtils.mjs': 'export function addNumbers(a, b) {\n  return a + b;\n}\n',
      'app.mjs': 'import { addNumbers } from "./mathUtils.mjs";\n\nexport function total(a, b, c) {\n  return addNumbers(a, addNumbers(b, c));\n}\n',
    },
    solved: {
      'mathUtils.mjs': 'export function sum(a, b) {\n  return a + b;\n}\n',
      'app.mjs': 'import { sum } from "./mathUtils.mjs";\n\nexport function total(a, b, c) {\n  return sum(a, sum(b, c));\n}\n',
    },
    verify:
`import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const mu = await import(pathToFileURL(resolve('mathUtils.mjs')).href);
const app = await import(pathToFileURL(resolve('app.mjs')).href);
assert.equal(typeof mu.sum, 'function');
assert.equal(mu.sum(2, 3), 5);
assert.equal('addNumbers' in mu, false);
assert.equal(app.total(1, 2, 3), 6);
const appSrc = readFileSync(resolve('app.mjs'), 'utf8');
assert.equal(appSrc.includes('addNumbers'), false);
console.log('PASS');
`,
  },
  {
    id: '17-multi-extract',
    task: 'a.mjs 和 b.mjs 中存在完全重复的 slugify 函数。请提取公共实现到新文件 shared.mjs，并让 a.mjs、b.mjs 通过导入复用它（不得再各自保留重复实现）。',
    files: {
      'a.mjs': 'export function slugify(s) {\n  return s.toLowerCase().trim().replace(/\\s+/g, "-");\n}\n',
      'b.mjs': 'export function slugify(s) {\n  return s.toLowerCase().trim().replace(/\\s+/g, "-");\n}\n',
    },
    solved: {
      'shared.mjs': 'export function slugify(s) {\n  return s.toLowerCase().trim().replace(/\\s+/g, "-");\n}\n',
      'a.mjs': 'import { slugify } from "./shared.mjs";\n\nexport { slugify };\n',
      'b.mjs': 'import { slugify } from "./shared.mjs";\n\nexport { slugify };\n',
    },
    verify:
`import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
assert.equal(existsSync(resolve('shared.mjs')), true);
const shared = await import(pathToFileURL(resolve('shared.mjs')).href);
assert.equal(typeof shared.slugify, 'function');
const a = await import(pathToFileURL(resolve('a.mjs')).href);
const b = await import(pathToFileURL(resolve('b.mjs')).href);
assert.equal(a.slugify('Hello World'), 'hello-world');
assert.equal(b.slugify('Foo  Bar '), 'foo-bar');
assert.equal(readFileSync(resolve('a.mjs'), 'utf8').includes('./shared.mjs'), true);
assert.equal(readFileSync(resolve('b.mjs'), 'utf8').includes('./shared.mjs'), true);
console.log('PASS');
`,
  },
  {
    id: '18-multi-fix-imports',
    task: 'server.mjs 从 config.mjs 导入的名称与实际导出不一致，导致 getPort() 得不到正确端口。请统一修复（保持 config.mjs 导出 port = 8080），使 getPort() === 8080。',
    files: {
      'config.mjs': 'export const port = 8080;\n',
      'server.mjs': 'import { PORT } from "./config.mjs";\n\nexport function getPort() {\n  return PORT;\n}\n',
    },
    solved: {
      'server.mjs': 'import { port } from "./config.mjs";\n\nexport function getPort() {\n  return port;\n}\n',
    },
    verify:
`import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const server = await import(pathToFileURL(resolve('server.mjs')).href);
const config = await import(pathToFileURL(resolve('config.mjs')).href);
assert.equal(server.getPort(), 8080);
assert.equal(config.port, 8080);
console.log('PASS');
`,
  },
  // ---------- 编写测试 ----------
  {
    id: '19-write-tests',
    task: 'utils.mjs 已实现 capitalize / isBlank / countVowels 三个函数（实现是正确的）。请为其新建 utils.test.mjs：使用 node:assert 编写至少 6 条断言，覆盖三个函数的正常与边界情况（如空串），运行 node utils.test.mjs 退出码必须为 0。',
    files: {
      'utils.mjs': 'export function capitalize(s) {\n  if (!s) return s;\n  return s[0].toUpperCase() + s.slice(1);\n}\n\nexport function isBlank(s) {\n  return s === null || s === undefined || s.trim() === "";\n}\n\nexport function countVowels(s) {\n  return (s || "").toLowerCase().split("").filter((c) => "aeiou".includes(c)).length;\n}\n',
    },
    solved: {
      'utils.test.mjs': 'import { strict as assert } from "node:assert";\nimport { capitalize, isBlank, countVowels } from "./utils.mjs";\n\nassert.equal(capitalize("hello"), "Hello");\nassert.equal(capitalize(""), "");\nassert.equal(capitalize("x"), "X");\nassert.equal(isBlank("   "), true);\nassert.equal(isBlank("a"), false);\nassert.equal(isBlank(null), true);\nassert.equal(countVowels("Beautiful"), 5);\nassert.equal(countVowels(""), 0);\nassert.equal(countVowels("xyz"), 0);\nconsole.log("ALL TESTS PASSED");\n',
    },
    verify:
`import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const testFile = resolve('utils.test.mjs');
assert.equal(existsSync(testFile), true, 'utils.test.mjs 必须存在');
const src = readFileSync(testFile, 'utf8');
const assertCount = (src.match(/assert\\./g) || []).length;
assert.ok(assertCount >= 6, '至少 6 条断言, 实际 ' + assertCount);
assert.ok(src.includes('node:assert'), '必须使用 node:assert');
const r = spawnSync('node', ['utils.test.mjs'], { encoding: 'utf8', cwd: process.cwd() });
assert.equal(r.status, 0, 'node utils.test.mjs 必须通过:\\n' + (r.stderr || ''));
console.log('PASS');
`,
  },
];

rmSync(TASKS_DIR, { recursive: true, force: true });
mkdirSync(TASKS_DIR, { recursive: true });
for (const t of tasks) {
  const dir = join(TASKS_DIR, t.id);
  mkdirSync(join(dir, 'workspace'), { recursive: true });
  mkdirSync(join(dir, 'solved'), { recursive: true });
  const solvedAll = { ...t.files, ...t.solved };
  for (const [p, c] of Object.entries(t.files)) {
    writeFileSync(join(dir, 'workspace', p), c);
  }
  for (const [p, c] of Object.entries(solvedAll)) {
    writeFileSync(join(dir, 'solved', p), c);
  }
  writeFileSync(join(dir, 'task.md'), t.task + '\\n');
  writeFileSync(join(dir, 'verify.mjs'), t.verify);
}
console.log('generated ' + tasks.length + ' tasks under ' + TASKS_DIR);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
