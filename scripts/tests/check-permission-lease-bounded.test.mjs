// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-permission-lease-bounded.mjs`
 *
 * 钉四件事,都是"判据失效表现为安静"那一型(守门 70/76/81/89 同族):
 *  T1 取材面纪律 —— 本门必须走 `face-reader` 的 `catBatch`,不得回到磁盘 `readFileSync`
 *     或散写 `git show`(否则共享工作树滞后 HEAD 时结论会自洽地错位)。
 *  T2 头注接线态与注册表真值对账 —— **两态都认**:未注册时须明说未接线且不得谎称已装车;
 *     已注册时改验本门那条注册块的 blocking + skipEnv 成套(按块边界取,不取窗口)。
 *  T3 真仓 HEAD 面必须 exit 0(门不能对自己产出的形态失明)。
 *  T4 声明行不是调用点(反向锁,防 L1 对定义处产假阳)。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import { scanSource } from '../check-permission-lease-bounded.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GATE = path.join(ROOT, 'scripts', 'check-permission-lease-bounded.mjs');
const RUNNER = path.join(ROOT, 'scripts', 'guardian-runner.mjs');
const src = readFileSync(GATE, 'utf8');

test('T1 取材面纪律:必须走 face-reader 的 catBatch,不得散写 git show / 磁盘读内容', () => {
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/);
  assert.match(src, /catBatch\(/);
  assert.doesNotMatch(src, /gitRaw\(\s*\[[^\]]*'show'/, '内容不得由散写 `git show` 取');
  assert.doesNotMatch(src, /readFileSync\([^)]*join\(ROOT/, '被审内容不得按磁盘读(工作树会滞后 HEAD)');
});

/**
 * T2 头注声称的接线态必须与注册表真值一致(两态都认,不许把真话判红);已注册则 blocking + skipEnv 齐备。
 *
 * 2026-10-06 改判据的原因(与门 133 的 M3、radius 的 T2、token-sync 的 T9、mode-permission 的 T9
 * 同族):原判据名为「未注册时不得声称已装车」,实际锁的是**一句会过期的台词** ——
 * 它拿 `/(已接|已接入)\s*pre-commit|guardian-runner\s*第\s*\d+/` 去 grep 头注散文。
 * 两处实测无牙:
 *   ① 措辞一改就空转 —— 把头注改成 `【接线状态:已接入】本门已进 …注册表`(本门真值仍是**未注册**),
 *      变异注入确认生效后,该 grep 仍读出 false ⇒ 未注册却谎称已装车,断言照样绿(静默假绿)。
 *      根因:判据问的是"头注里有没有这几个字",不是"头注说的是不是真话"。
 *   ② 取材面用 `±600` **窗口**,实测无牙 —— 窗口跨进邻门,邻门的 `mode:'blocking'` +
 *      `skipEnv` 替本门交差(合成面验证:本门块裸装、两侧邻门齐备时,窗口版两侧断言仍双绿;
 *      同场景块边界版双红;把本门块补齐后块边界版才转绿)。
 * ⇒ 一条把真相判红的尺子,教出来的就是谎报。改为:**先读注册表真值,再据此决定头注该说哪一态**。
 *
 * ⚠️ 只认**现状陈述**,不认存档引文(同族三次踩坑换来的收口口径):
 *   - 引导语两种语序都真实存在(本门写「接线现状」,merge-deletion 门写「接线状态」),
 *     所以显式列出两个词,不能靠字符类赌语序 —— `接线状[态现]` 与 `接线[状现][态现]`
 *     都对「接线现状」0 命中(实测),那等于判据对它要读的那一行是瞎的。
 *   - 引导语容许括号里的时点注记;带 `已漂移 / 原<日期> / 不再是` 的历史记录与引文整行剔掉后再看
 *     "本门此刻在说什么",否则一句如实记录历史会被读成现状。
 */
test('T2 头注接线态必须与注册表现读一致;已注册则 blocking + skipEnv 齐备(块边界取本门那条)', () => {
  const runner = readFileSync(RUNNER, 'utf8');
  // 接线真值的唯一源: 注册表现读。判据据此决定期望,不由一句会过期的台词决定。
  const registered = runner.includes('check-permission-lease-bounded.mjs');
  const head = src.slice(0, src.indexOf('\nimport '));
  const GUIDE = /接线(?:现状|状态)\s*(?:\([^)]*\))?\s*[:：]/;
  const HISTORY = /已漂移|原\s*20\d{2}[-/]\d{2}|不再是/;
  const spoken = head.split('\n').filter((l) => !HISTORY.test(l));
  const statusLines = spoken.filter((l) => GUIDE.test(l));
  const claimsWired = statusLines.some((l) => /已接入|已注册|已挂进/.test(l));
  const claimsNotWired = statusLines.some((l) => /未接|尚未|未进/.test(l));

  if (registered) {
    assert.ok(
      claimsWired,
      `注册表里本门已注册,但头注的『接线现状/接线状态:』那一行仍说未接线 ⇒ 文档与提交链分叉:${JSON.stringify(statusLines)}`,
    );
  } else {
    // 未注册:必须**明说**未接线(而不是留白让人猜),且不得出现肯定式接线声称。
    assert.ok(
      claimsNotWired || statusLines.length === 0,
      `未进注册表,头注的『接线现状/接线状态:』那一行却不说未接线:${JSON.stringify(statusLines)}`,
    );
    assert.ok(
      !claimsWired,
      `未进注册表却声称已接 pre-commit ⇒ 给后人一个跑不通的出路(守门 89 R1/R2):${JSON.stringify(statusLines)}`,
    );
  }

  if (!registered) return;
  // ⚠️ 按**注册块边界**取本门那条,不用 `±600` 窗口:窗口会跨进邻门,邻门的
  // `mode:'blocking'` / `skipEnv` 替本门交差(上面 ② 的合成面实测)。
  // `\n  {` = 顶层注册项起始,`\n    script:` = 下一条开始;块内含下一条头两行(id/label),
  // 而 mode/skipEnv 一律排在 `script:` 之后 ⇒ 切不进邻门。退化路径只防 runner 形态再变。
  const at = runner.indexOf("script: 'check-permission-lease-bounded.mjs',");
  assert.ok(at >= 0, '注册表里没有本门的 script 行(与 registered 判定矛盾 ⇒ 判据自身不可信)');
  const start = runner.lastIndexOf('\n  {', at);
  const next = runner.indexOf('\n    script:', at + 10);
  const entry = runner.slice(start < 0 ? at : start, next > 0 ? next : runner.length);
  assert.match(entry, /mode:\s*'blocking'/, '已接线但非 blocking:放宽未租约化拦不住提交');
  assert.match(entry, /skipEnv:\s*'HUSKY_SKIP_PERMISSION_LEASE_BOUNDED'/, '已接线但无 skipEnv:恒红时没有应急出口');
});

test('T3 真仓 HEAD 面 exit 0(门对自己产出的形态不失明)', () => {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const out = execFileSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /✅ 权限放宽均已租约化/);
});

test('T4 声明行不是调用点;调用点缺到期必红', () => {
  assert.equal(
    scanSource('export function grantPermissionLease(input: GrantLeaseInput): PermissionLease {', 'apps/cli/src/tools/permission-lease.ts').length,
    0,
    '定义处被当成调用点判红 ⇒ 门对自身产出失明',
  );
  assert.equal(scanSource("grantPermissionLease({ scope: 's', capabilities: ['a'] })", 'apps/cli/src/x.ts').length, 1);
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
