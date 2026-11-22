// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816025 的常驻尺子 —— 「后台结果回灌历史前的五道有序校验」与「无可观察源 ⇒ lost 且仍发通知」。
 *
 * 跑法(cwd = 仓库根):`node --test apps/cli/src/tools/__tests__/background-lost-terminal.test.mjs`
 *
 * 三件事必须先说清,否则读的人会把这份测试当成别的东西:
 *
 *  1. **为什么是 `.mjs` + `registerHooks` 而不是 vitest**。票面把验收命令钉死成 `node --test <本文件>`,
 *     而本端 `apps/cli` 的测试是 vitest(`package.json` 的 `test` 脚本)。Node 24 原生剥类型可以加载
 *     `.ts`,但**不会**把 TS 惯例的 `./x.js` 说明符改写到 `x.ts`(实测 `ERR_MODULE_NOT_FOUND`)。
 *     所以这里注册一个**只做一件事**的解析钩子:`<dir>/x.js` 盘上不存在而同目录 `<dir>/x.ts` 存在
 *     时才改写 —— 真 `.js` 文件优先放过,不做模糊匹配。钩子只在本测试进程内生效,不动任何产品配置。
 *     判"钩子有没有作用"的正向凭据是下面的用真的走完了 `registerTask` 的整条事件链
 *     (不是只调纯函数);若解析层坏了,这一文件会是收集期失败而不是断言失败。
 *
 *  2. **台账隔离**。`registerTask` 会往 `getIhuiRoot()` 落 JSONL,而那个根由 `IHUI_HOME` 决定
 *     (`apps/cli/src/plugins/paths.ts`)。所以在 import 之前把 `IHUI_HOME` 指到仓库内
 *     `.ihui-agent/tmp/`(§15/§25 的临时物唯一落点),跑完删掉 —— 不许把测试记录写进真实 CLI 状态目录。
 *
 *  3. **成对纪律**。票面三条判据各配正反:"落 lost"必须配"播报次数 = 1";"不判 lost"必须配
 *     "播报次数 = 0";"止步即无 `[truncated]`"必须配"合格条目超预算**确实**带 `[truncated]`" ——
 *     少了正向半边,前者可以靠"永远不产出文本"蒙过去(判据失效的表现永远是安静)。
 */
import { describe, it, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ==================== 装载:先隔离落点,再注册解析钩子 ====================

/** 从本文件所在目录往上找到仓库根(判据 = 同目录既有 package.json 又有 pnpm-workspace.yaml)。 */
function findRepoRoot() {
  let dir = fileURLToPath(import.meta.url);
  if (!dir.endsWith(path.sep)) dir = path.dirname(dir);
  else dir = path.dirname(dir.replace(/[\\/]+$/, ''));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml')) && existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`找不到仓库根(从 ${fileURLToPath(import.meta.url)} 往上 12 层没同时命中 package.json 与 pnpm-workspace.yaml)`);
}

const REPO_ROOT = findRepoRoot();
const TOOLS_DIR = path.join(REPO_ROOT, 'apps', 'cli', 'src', 'tools');
/** 测试期的 CLI 状态根:仓库内、已 gitignore,跑完删除。 */
const TEST_HOME = path.join(REPO_ROOT, '.ihui-agent', 'tmp', 'background-lost-terminal-home');

// IHUI_HOME 必须在 import 被测模块之前落定(background-ledger 的落点由它推导)。
process.env.IHUI_HOME = TEST_HOME;
mkdirSync(TEST_HOME, { recursive: true });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const asJs = path.resolve(parentDir, specifier);
      const asTs = `${asJs.slice(0, -3)}.ts`;
      // 只在"真 .js 不存在而同名 .ts 存在"时改写:绝不覆盖真实 JS 文件,也不做模糊匹配。
      if (!existsSync(asJs) && existsSync(asTs)) {
        return { url: pathToFileURL(asTs).href, format: 'module-typescript', shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const registry = await import(pathToFileURL(path.join(TOOLS_DIR, 'background-registry.ts')).href);
/**
 * 取词出口。**必须**在 `registerHooks` 之后按 `.ts` 直接动态 import:写成文件顶部的静态
 * `import { t } from '../../i18n/index.js'` 会被 ESM 在钩子注册**之前**求值 ⇒ 整文件收集期
 * `ERR_MODULE_NOT_FOUND`(实测,0 通过 / 1 失败,红形如"装载坏了"而不是断言坏了)。
 * 判据① 的期望值由语言包现取,所以本测试需要与产码同一份取词出口。
 */
const { t } = await import(pathToFileURL(path.join(TOOLS_DIR, '..', 'i18n', 'index.ts')).href);
/** 把语言包里的期望文本转义成正则片段。播报文本自带 `[无可观察源]` 这类方括号,
 *  不转义会被当字符类读 ⇒ 断言"没匹配上"而文本其实是对的(实测第一次就红在这里)。 */
const rx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const {
  registerTask,
  registerFailedTask,
  getTask,
  clearAllTasks,
  decideTerminalSettlement,
  TASK_NOTIFICATION_MAX_CHARS,
  __test__,
} = registry;

// 解析钩子真的生效了吗 —— 正向凭据:被测模块必须导出本票的判据,而不是"import 没炸"。
assert.equal(typeof decideTerminalSettlement, 'function', 'decideTerminalSettlement 未导出 ⇒ 装载路径不对,后续一切断言无效');
assert.equal(typeof __test__.setTerminalNoticeSink, 'function', '播报出口不可注入 ⇒ 判据①无从量次数');

// ==================== 夹具 ====================

/** 与 apps/cli/tests/background-registry.test.ts 同形:注册表只要求它是个 EventEmitter。 */
function fakeChild() {
  return new EventEmitter();
}

/** 一条会走到第⑤道容量步的超长正文(status 头 + 一个远超预算的 result)。 */
function overBudgetNotice() {
  return { status: '任务 bg_probe 状态: lost', result: 'x'.repeat(TASK_NOTIFICATION_MAX_CHARS + 10) };
}

/** 纯函数入参的默认档:五道全过、结果有去处(= settled 基线)。 */
function baseEvidence(overrides) {
  return {
    ownsEntry: true,
    alreadyClaimed: false,
    hasObservableOutcome: true,
    hasDirectWaiter: false,
    handledByAnotherProducer: false,
    buildNotice: () => overBudgetNotice(),
    ...overrides,
  };
}

// ==================== 判据①:无可观察源 ⇒ lost,且通知照发 ====================

describe('G-816025 判据① 无可观察源 ⇒ 终态 lost 且播报照发', () => {
  let emitted = [];
  beforeEach(() => {
    emitted = [];
    __test__.setTerminalNoticeSink((notice) => {
      emitted.push(notice);
    });
  });
  afterEach(() => {
    clearAllTasks();
    __test__.setTerminalNoticeSink(null);
  });

  it('真事件路径:close(null, null) 且零输出、零等待者 ⇒ status=lost', () => {
    const child = fakeChild();
    const id = registerTask(child, 'phantom terminate');
    child.emit('close', null, null); // 进程没了:既没退出码也没有信号
    assert.equal(getTask(id).status, 'lost', '无可观察源的终态必须落成 lost(此前这一格"按哪一档写"未定义)');
  });

  it('同一支 ⇒ 播报**恰好一次**,文本含"无可观察源"与 lost 状态行(只落档不出声 = 本判据必红)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'phantom terminate');
    child.emit('close', null, null);
    assert.equal(emitted.length, 1, `lost 必须照样播报:期望 1 次,实得 ${emitted.length} 次`);
    // 断言不吃机器语言环境:播报正文自 2026-10-05 起走语言包(AGENTS §30 状态词汇五语言同批 +
    // 守门 70 硬编码中文棘轮),所以期望值由**同一个 t()** 现取 —— 既与 locale 无关,又反向锁住
    // "这一行必须来自语言包而不是写死在代码里"(写回硬编码 ⇒ 这里取到的字符串与产出不同 ⇒ 本条红)。
    assert.match(emitted[0], /lost/, '状态行必须带 lost 档名(ASCII 档名跨语言不变)');
    assert.match(emitted[0], new RegExp(rx(t('cli.bgNoticeNoObservableSource').slice(0, 10))));
    assert.match(emitted[0], new RegExp(rx(t('cli.bgNoticeStatus').split('{id}')[0].trim())));
    assert.match(emitted[0], new RegExp(id));
  });

  it('正向对照:有等待者接得住 ⇒ 不判 lost、不走播报出口(等待者投递才是它的通知载体)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'waiter present');
    const seen = [];
    __test__.addSettleListener(id, (snap) => seen.push(snap?.status ?? 'null'));
    child.emit('close', null, null);
    assert.equal(getTask(id).status, 'exited', '当场有等待者 ⇒ 结果有去处,不得判 lost');
    assert.deepEqual(seen, ['exited']);
    assert.equal(emitted.length, 0, 'settled 一支不许往播报出口打(否则每次正常收尾都是噪音)');
  });

  it('同一轮重放终态 ⇒ 播报仍只一次(第②道幂等拦双发)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'phantom terminate');
    child.emit('close', null, null);
    __test__.notifySettled(getTask(id)); // 第二次:本轮已 claim
    assert.equal(emitted.length, 1, `claim 之后不许再播一条:期望 1 次,实得 ${emitted.length} 次`);
    assert.equal(getTask(id).status, 'lost');
  });

  it('沙盒拒绝的占位任务 ⇒ 有 stderr 正文就是去处,不得被判成 lost(反例:把新档当垃圾桶)', () => {
    const id = registerFailedTask('blocked by sandbox', '⛔ 命令被沙盒拒绝: 预检未通过');
    __test__.notifySettled(getTask(id));
    assert.equal(getTask(id).status, 'error', 'error 是已知结论,不是"无从判定"');
    assert.equal(emitted.length, 0);
  });
});

// ==================== 判据②:有去处不得判 lost(反向锁) ====================

describe('G-816025 判据② 结果还有去处 ⇒ 一律不得判 lost', () => {
  let emitted = [];
  beforeEach(() => {
    emitted = [];
    __test__.setTerminalNoticeSink((notice) => emitted.push(notice));
  });
  afterEach(() => {
    clearAllTasks();
    __test__.setTerminalNoticeSink(null);
  });

  it('拿到退出码(0)⇒ 保持 exited', () => {
    const child = fakeChild();
    const id = registerTask(child, 'clean exit');
    child.emit('close', 0, null);
    assert.equal(getTask(id).status, 'exited');
    assert.equal(emitted.length, 0);
  });

  it('拿到非零退出码 ⇒ 保持 exited(成败已记就是去处,不是"结果丢了")', () => {
    const child = fakeChild();
    const id = registerTask(child, 'nonzero exit');
    child.emit('close', 3, null);
    assert.equal(getTask(id).status, 'exited');
  });

  it('没拿到码但留住了输出 ⇒ 保持 exited(内容还留着就是去处)', () => {
    const child = fakeChild();
    child.stdout = new EventEmitter();
    const id = registerTask(child, 'silent code, loud output');
    child.stdout.emit('data', Buffer.from('SOMETHING-RECOVERABLE\n', 'utf-8'));
    child.emit('close', null, null);
    assert.equal(getTask(id).status, 'exited', '有内容可回灌 ⇒ 不得把已知结果洗成 lost');
    assert.equal(emitted.length, 0);
  });

  it('信号已知(SIGKILL)⇒ 保持 killed(终止原因已记,不是无从判定)', () => {
    const child = fakeChild();
    const id = registerTask(child, 'killed with signal');
    child.emit('close', null, 'SIGKILL');
    assert.equal(getTask(id).status, 'killed');
    assert.equal(emitted.length, 0);
  });

  it('spawn error 分支 ⇒ 保持 error 且不播报', () => {
    const child = fakeChild();
    const id = registerTask(child, 'spawn failed');
    child.emit('error', new Error('ENOENT'));
    assert.equal(getTask(id).status, 'error');
    assert.equal(emitted.length, 0);
  });
});

// ==================== 判据③:容量截断必须排在归属与幂等之后 ====================

describe('G-816025 判据③ 顺序锁:未通过归属/幂等的条目不得出现截断标记', () => {
  it('归属不成立 ⇒ haltedAt=ownership、正文构造函数一次都没被调用', () => {
    let built = 0;
    const decision = decideTerminalSettlement(
      baseEvidence({ ownsEntry: false, buildNotice: () => (built += 1, overBudgetNotice()) }),
    );
    assert.equal(decision.outcome, 'not-owned');
    assert.equal(decision.haltedAt, 'ownership');
    assert.equal(decision.notification, null, '未通过归属判定的条目不得拿到通知文本');
    assert.doesNotMatch(String(decision.notification ?? ''), /\[truncated\]/, '止步条目不许出现截断标记');
    assert.equal(built, 0, '第⑤道没走到就不许构造正文(构造了就可能被斩)');
    assert.deepEqual(decision.passedChecks, []);
  });

  it('幂等不成立(本轮已 claim)⇒ 同样止步于第②道,正文零构造', () => {
    let built = 0;
    const decision = decideTerminalSettlement(
      baseEvidence({ alreadyClaimed: true, buildNotice: () => (built += 1, overBudgetNotice()) }),
    );
    assert.equal(decision.outcome, 'already-claimed');
    assert.equal(decision.haltedAt, 'idempotency');
    assert.equal(decision.notification, null);
    assert.equal(built, 0);
    assert.deepEqual(decision.passedChecks, ['ownership'], 'passedChecks 只许列出真正走过的判据');
  });

  it('正向半边:五道全过且正文超预算 ⇒ **确实**带 [truncated](否则上面两条可以是靠永不产出蒙的)', () => {
    let built = 0;
    const decision = decideTerminalSettlement(
      baseEvidence({ hasObservableOutcome: false, buildNotice: () => (built += 1, overBudgetNotice()) }),
    );
    assert.equal(built, 1, '第⑤道必须真的构造一次正文');
    assert.ok(decision.notification !== null, '合格条目必须拿到文本');
    assert.match(decision.notification, /\[truncated\]/);
    assert.equal(decision.outcome, 'lost', '无去处 ⇒ lost');
    assert.equal(decision.emitNotice, true, 'lost ⇒ 通知照发(票面判据①)');
    assert.equal(decision.markLost, true);
    assert.equal(decision.consumeClaim, true);
  });

  it('判据顺序逐字 = 归属 → 幂等 → 可观察性 → 跨生产者去重 → 容量', () => {
    const decision = decideTerminalSettlement(baseEvidence());
    assert.deepEqual(decision.passedChecks, [
      'ownership',
      'idempotency',
      'observability',
      'crossProducerDedup',
      'capacity',
    ]);
    assert.equal(decision.haltedAt, null);
    assert.equal(decision.outcome, 'settled');
    assert.equal(decision.markLost, false);
  });
});

// ==================== 第④道:跨生产者去重(仍 claim,不发通知) ====================

describe('G-816025 第④道 跨生产者去重 ⇒ 仍 claim 但不播报', () => {
  it('handledByAnotherProducer=true ⇒ 不判 lost、不发通知、但消耗 claim(上游 :484-504 同构)', () => {
    const decision = decideTerminalSettlement(
      baseEvidence({ hasObservableOutcome: false, hasDirectWaiter: false, handledByAnotherProducer: true }),
    );
    assert.equal(decision.outcome, 'deduped-by-producer');
    assert.equal(decision.haltedAt, 'crossProducerDedup');
    assert.equal(decision.markLost, false, '另一处已经处理过 ⇒ 结果并非无去处,不许报 lost');
    assert.equal(decision.emitNotice, false);
    assert.equal(decision.consumeClaim, true, '去重也要 claim:否则每轮事件都重判一遍');
    assert.equal(decision.notification, null);
    assert.deepEqual(decision.passedChecks, ['ownership', 'idempotency', 'observability']);
  });
});

// ==================== 台账侧:lost 不新立档(等价性) ====================

describe('G-816025 台账等价:lost 与 exited+无码 必得同一个 ended-unknown', () => {
  it('toLedgerTerminal(lost, null) === toLedgerTerminal(exited, null) === ended-unknown', () => {
    const asLost = __test__.toLedgerTerminal('lost', null);
    const asExited = __test__.toLedgerTerminal('exited', null);
    assert.equal(asLost, 'ended-unknown');
    assert.equal(asExited, 'ended-unknown');
    assert.equal(asLost, asExited, '等价性是本票敢"先记账再定终态"的唯一理由,不得被改成 failed');
  });

  it('反向对照:lost 不得被读成 failed(把"拿不回来"渲染成"跑失败了"就是本判据要拦的)', () => {
    assert.notEqual(__test__.toLedgerTerminal('lost', null), 'failed');
    assert.notEqual(__test__.toLedgerTerminal('lost', null), 'succeeded');
  });

  it('已知结论照旧各自成档:killed→cancelled / error→failed / 码 0→succeeded / 非零→failed', () => {
    assert.equal(__test__.toLedgerTerminal('killed', null), 'cancelled');
    assert.equal(__test__.toLedgerTerminal('error', null), 'failed');
    assert.equal(__test__.toLedgerTerminal('exited', 0), 'succeeded');
    assert.equal(__test__.toLedgerTerminal('exited', 2), 'failed');
  });
});

// ==================== 装载自检:测试没在审一个不存在的东西 ====================

describe('G-816025 装载自检(阳性对照)', () => {
  it('被测模块确实是从 apps/cli/src/tools 解析来的(钩子若失效,这一句会在 import 期就炸)', () => {
    // 取一条真实源码文本作证据:判据住在被测文件里,而不是测试自己造了一份。
    const src = readFileSync(path.join(TOOLS_DIR, 'background-registry.ts'), 'utf-8');
    assert.match(src, /export function decideTerminalSettlement/);
    assert.match(src, /'running' \| 'exited' \| 'killed' \| 'error' \| 'lost'/);
  });

  it('测试期 CLI 状态根落在仓库内临时区,不写真实 ~/.ihui', () => {
    assert.equal(process.env.IHUI_HOME, TEST_HOME);
    assert.ok(TEST_HOME.startsWith(path.join(REPO_ROOT, '.ihui-agent', 'tmp')), '隔离根必须在 .ihui-agent/tmp 下');
    assert.notEqual(path.resolve(process.env.IHUI_HOME ?? ''), path.join(os.homedir(), '.ihui'));
  });
});

// 跑完清掉测试期的 CLI 状态根(§25:临时物用完即清,不留孤儿目录)。
// 必须挂在 `after` 上而不是文件末尾的裸语句:node:test 的用例是在文件求值**之后**才跑的,
// 顶层 rmSync 会在台账还没写完就把目录删掉(表现是"用例随机失败"而不是"清理没生效")。
after(() => {
  rmSync(TEST_HOME, { recursive: true, force: true });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
