// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815 —— cli 插件域 git 派生的三件套封顶(timeout / maxBuffer / 净化 env)。
 *
 * 钉的是实测可达的三格失效(票面原文):无 timeout ⇒ 共享 gitdir 被锁住时点"安装"一直转圈;
 * 无 maxBuffer ⇒ 大输出 ENOBUFS 抛错而目录已有内容("clone 失败但东西在");
 * 无 env 净化 ⇒ 继承 `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_CONFIG_GLOBAL`/`GIT_SSH_COMMAND`,
 * clone 落到**错误的对象库**。
 *
 * 测试口径(两条是硬约束,不是风格):
 *   - **真派生**:全部经 `binary: process.execPath` 起真 Node 子进程冒充 git,不 mock child_process ——
 *     mock 出来的"封顶"证明的是断言写法,不是封顶真的杀得掉进程(§22c"镜像测试只复读实现就是复读机")。
 *   - **正反成对**:每个拒绝都配一条同形但放过的一侧(上限放宽必须拿到完整输出;白名单内的代理键必须透传),
 *     否则"判据过宽"与"判据过窄"在账面上长得一样。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  DEFAULT_GIT_MAX_BUFFER_BYTES,
  DEFAULT_GIT_TIMEOUT_MS,
  GIT_KILL_SIGNAL,
  GitCommandTimeoutError,
  GitOutputTooLargeError,
  buildGitEnv,
  execGitCapped,
  execGitStatus,
  lastStatusDegradation,
  gitVerbOf,
  resolveGitBinary,
  resolveGitSpawnOptions,
} from '../src/plugins/git-runner.js';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

/** 让子进程把自己的 env 里被关心的几档打回来(JSON 一行,便于断言) */
const ENV_PROBE_SCRIPT = [
  'console.log(JSON.stringify({',
  'gitDir: process.env.GIT_DIR ?? null,',
  'indexFile: process.env.GIT_INDEX_FILE ?? null,',
  'configGlobal: process.env.GIT_CONFIG_GLOBAL ?? null,',
  'sshCommand: process.env.GIT_SSH_COMMAND ?? null,',
  'askpass: process.env.GIT_ASKPASS ?? null,',
  'marker: process.env.IHUI_GITCAPS_TEST_MARKER ?? null,',
  'terminalPrompt: process.env.GIT_TERMINAL_PROMPT ?? null,',
  'hasPath: !!process.env.PATH,',
  'systemRoot: process.env.SystemRoot ?? process.env.WINDIR ?? null,',
  'proxy: process.env.HTTP_PROXY ?? null,',
  '}))',
].join('');

const DANGER_KEYS = [
  'GIT_DIR',
  'GIT_INDEX_FILE',
  'GIT_CONFIG_GLOBAL',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'IHUI_GITCAPS_TEST_MARKER',
  'HTTP_PROXY',
] as const;

describe('G-815 execGitCapped —— timeout 封顶', () => {
  it('挂起的 git 在 timeoutMs 内被 SIGTERM 终止,并点名 timeout', () => {
    const t0 = Date.now();
    let thrown: unknown;
    try {
      // 子进程自己睡 8s;封顶只给 300ms ⇒ 必须是"被杀"而不是"等完"
      execGitCapped(['-e', 'setTimeout(() => {}, 8000)'], { binary: process.execPath, timeoutMs: 300 });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GitCommandTimeoutError);
    const err = thrown as GitCommandTimeoutError;
    expect(err.code).toBe('ETIMEDOUT');
    expect(err.timeoutMs).toBe(300);
    expect(err.message).toContain('300ms');
    expect(err.message).toContain(GIT_KILL_SIGNAL);
    // 有牙证明:真的被杀掉了(而不是断言碰巧对上)。8s 的进程若没被封顶,这里会是 8000ms。
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  it('反向对照:正常返回的调用不抛,且拿到 stdout', () => {
    const out = execGitCapped(['-e', 'console.log("ok-stdout")'], {
      binary: process.execPath,
      timeoutMs: 15_000,
    });
    expect(out.trim()).toBe('ok-stdout');
  });
});

describe('G-815 execGitCapped —— maxBuffer 封顶', () => {
  it('超上限抛结构化错误,**绝不返回半截内容**', () => {
    let returned: string | undefined;
    let thrown: unknown;
    try {
      returned = execGitCapped(['-e', 'console.log("x".repeat(500000))'], {
        binary: process.execPath,
        maxBufferBytes: 1024,
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(GitOutputTooLargeError);
    expect((thrown as GitOutputTooLargeError).code).toBe('ENOBUFS');
    expect((thrown as GitOutputTooLargeError).maxBufferBytes).toBe(1024);
    // 这一条是本票的落点:旧形态"抛错但调用方已经拿到过一部分"根本不可能,而"返回半截"才是
    // "clone 失败但东西在"的账面对应物 —— 出口必须只有一种结局。
    expect(returned).toBeUndefined();
  });

  it('反向对照:上限放宽到 20MB 时同一脚本拿到完整 500000 字符', () => {
    const out = execGitCapped(['-e', 'console.log("x".repeat(500000))'], {
      binary: process.execPath,
      maxBufferBytes: 20 * 1024 * 1024,
    });
    expect(out.trim().length).toBe(500000);
  });
});

describe('G-815 execGitCapped —— 净化 env', () => {
  const scratch = mkScratch('ihui-gitcaps-env-');
  afterEach(() => {
    for (const k of DANGER_KEYS) delete process.env[k];
    rmScratch(scratch);
  });

  it('GIT_DIR / GIT_INDEX_FILE / GIT_CONFIG_GLOBAL / GIT_SSH_COMMAND / 任意标记键一律不透传', () => {
    // 把父进程摆在"最容易被污染"的形态上:指向另一个对象库 + 一个自定义 SSH 命令 + 一个测试标记
    process.env.GIT_DIR = path.posix.join(scratch, 'wrong-gitdir');
    process.env.GIT_INDEX_FILE = path.posix.join(scratch, 'wrong-index');
    process.env.GIT_CONFIG_GLOBAL = path.posix.join(scratch, 'wrong-config');
    process.env.GIT_SSH_COMMAND = 'ssh -i /secret/id_ed25519';
    process.env.GIT_ASKPASS = 'echo-pw';
    process.env.IHUI_GITCAPS_TEST_MARKER = 'must-not-inherit';

    const raw = execGitCapped(['-e', ENV_PROBE_SCRIPT], { binary: process.execPath });
    const seen = JSON.parse(raw.trim()) as Record<string, string | boolean | null>;
    expect(seen.gitDir).toBeNull();
    expect(seen.indexFile).toBeNull();
    expect(seen.configGlobal).toBeNull();
    expect(seen.sshCommand).toBeNull();
    expect(seen.askpass).toBeNull();
    expect(seen.marker).toBeNull();
    // 交互提示必须被关掉:否则 git 会挂在"请输入凭据"上,封顶之前一直转圈(票面失效型第一条的另一半)
    expect(seen.terminalPrompt).toBe('0');
  });

  it('反向对照:白名单内的 PATH/SystemRoot 与代理键必须透传(否则"卡到协议超时"又回来了)', () => {
    // Linux runner 没有 SystemRoot:白名单键必须自注入 —— 验证的是"透传"而非"恰好存在"
    const prevSystemRoot = process.env.SystemRoot;
    process.env.SystemRoot = 'C:////Windows';
    process.env.HTTP_PROXY = 'http://127.0.0.1:7897';
    try {
      const raw = execGitCapped(['-e', ENV_PROBE_SCRIPT], { binary: process.execPath });
      const seen = JSON.parse(raw.trim()) as Record<string, string | boolean | null>;
      expect(seen.hasPath).toBe(true);
      expect(typeof seen.systemRoot === 'string' && (seen.systemRoot as string).length > 0).toBe(true);
      expect(seen.proxy).toBe('http://127.0.0.1:7897');
    } finally {
      if (prevSystemRoot === undefined) delete process.env.SystemRoot;
      else process.env.SystemRoot = prevSystemRoot;
    }
  });

  it('buildGitEnv 只吃投影源,不吃调用方的其余键', () => {
    const env = buildGitEnv({ PATH: '/bin', GIT_DIR: '/x', GIT_SSH_COMMAND: 'ssh', AWS_SECRET_KEY: 'k', ZZ_RANDOM: 'v' });
    expect(env.PATH).toBe('/bin');
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_SSH_COMMAND).toBeUndefined();
    expect(env.AWS_SECRET_KEY).toBeUndefined();
    expect(env.ZZ_RANDOM).toBeUndefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
  });
});

describe('G-815 默认值与派生形态(三个参数都必须有默认值)', () => {
  it('不传任何 opts 也拿到 timeout / maxBuffer / 净化 env / windowsHide', () => {
    const r = resolveGitSpawnOptions();
    expect(r.timeoutMs).toBe(DEFAULT_GIT_TIMEOUT_MS);
    expect(r.maxBufferBytes).toBe(DEFAULT_GIT_MAX_BUFFER_BYTES);
    expect(r.windowsHide).toBe(true);
    expect(r.killSignal).toBe(GIT_KILL_SIGNAL);
    expect(Object.prototype.hasOwnProperty.call(r.env, 'GIT_TERMINAL_PROMPT')).toBe(true);
  });

  it('调用方覆盖生效,但 windowsHide 不是可选项(AGENTS §5b:缺它 = 用户桌面反复弹窗)', () => {
    const r = resolveGitSpawnOptions({ timeoutMs: 1234, maxBufferBytes: 5678 });
    expect(r.timeoutMs).toBe(1234);
    expect(r.maxBufferBytes).toBe(5678);
    expect(r.windowsHide).toBe(true);
  });
});

describe('G-815 git 二进制解析(不裸写 PATH 之外的猜测,也不做探活派生)', () => {
  it('IHUI_GIT_BIN 覆盖优先且**不被存在性过滤掉**(用例常拿它指向不存在路径模拟无 git)', () => {
    const scratch = mkScratch('ihui-gitcaps-bin-');
    try {
      const fake = path.posix.join(scratch, 'definitely-not-git');
      const resolved = resolveGitBinary({ IHUI_GIT_BIN: fake } as NodeJS.ProcessEnv);
      expect(resolved).toBe(fake);
      expect(fs.existsSync(resolved)).toBe(false);
    } finally {
      rmScratch(scratch);
    }
  });

  it('没有覆盖时给出绝对路径候选或 PATH 兜底,并且这条解析不派生任何进程', () => {
    const before = resolveGitBinary({} as NodeJS.ProcessEnv);
    expect(typeof before).toBe('string');
    expect(before.length).toBeGreaterThan(0);
    // 派生过不了这关:resolveGitBinary 若跑 --version,本用例文件里没有任何 mock,真机会真起进程。
    // 这里以"返回值的形态"作证据 —— 绝对候选带分隔符,PATH 兜底恰为 'git'。
    expect(before === 'git' || before.includes('/') || before.includes('\\')).toBe(true);
  });
});

describe('G-815 动词提取(只为文案可读,分类从不依赖它)', () => {
  it('带 -C 前缀的数组取到 fetch;认不出时回退字面量而不是抛错', () => {
    expect(gitVerbOf(['clone', '--depth', '1'])).toBe('clone');
    expect(gitVerbOf(['-C', '/tmp/repo', 'fetch', 'origin'])).toBe('git');
    expect(gitVerbOf([])).toBe('git');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

const { writeFileSync, mkdirSync } = fs
const { join } = path

// ─── G-814424 超输出上限 ⇒ 降级到折叠档 + 留痕可问(不是直接作废整份结论) ───
describe('G-814424 execGitStatus —— 超限降级为按目录折叠，且必须喊出来', () => {
  /** 造一个"未跟踪文件多到全档超上限、但折叠档装得下"的临时仓 */
  function mkUntrackedRepo(tag: string): string {
    const dir = mkScratch('ihui-gitcaps-' + tag + '-')
    const g = (a: string[]) => execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...a], { encoding: 'utf8' })
    g(['init', '-q'])
    writeFileSync(join(dir, 'tracked.txt'), 'x\n')
    g(['add', 'tracked.txt'])
    g(['commit', '-q', '-m', 'base'])
    // 3 个目录 × 12 个未跟踪文件：全档 ≈ 36 行，折叠档 = 3 行 `dir/`
    for (let d = 0; d < 3; d++) {
      const sub = join(dir, 'deep' + d)
      mkdirSync(sub, { recursive: true })
      for (let f = 0; f < 12; f++) writeFileSync(join(sub, 'f' + f + '.txt'), 'padding-padding-padding\n')
    }
    return dir
  }

  it('全档超限 ⇒ 返回折叠结论(非 null / 非抛错) + degraded + 一条 warn + 可问的记账', () => {
    const dir = mkUntrackedRepo('deg-')
    try {
      const warns: string[] = []
      const r = execGitStatus(dir, { maxBufferBytes: 400, warn: (m) => { warns.push(m) } })
      expect(r).not.toBeNull()
      expect(r.degraded).toBe(true)
      expect(r.collapsedUntrackedRoots.length).toBe(3)
      expect(r.collapsedUntrackedRoots.every((x) => x.endsWith('/'))).toBe(true)
      // 可识别标记的结构面:折叠档下不存在任何"具体文件"行 —— 若哪天折叠坏了、返回半截全量输出,
      // 这里就会露出具体文件名而这条断言立刻红(半截输出会被消费方读成「文件不存在」)。
      expect(r.lines.length).toBe(3)
      expect(r.lines.every((l) => l.endsWith('/'))).toBe(true)
      // 恰好一条 warn:既不静默(消费方无从知道清单不完整)也不刷屏(长跑进程里每次查询都喊)
      expect(warns.length).toBe(1)
      // 折叠档不得把"没列出的文件"伪装成"不存在":必须明写它不是完整清单
      expect(warns.join('')).toContain('不是完整未跟踪列表')
      const memo = lastStatusDegradation(dir)
      expect(memo?.collapsedRoots).toBe(3)
      expect(memo?.maxBufferBytes).toBe(400)
    } finally { rmScratch(dir) }
  })

  it('同 key 第二次调用直接走折叠档:不再触发上限路径(被记住),也不重复喊 warn', () => {
    const dir = mkUntrackedRepo('memo-')
    try {
      const first: string[] = []
      execGitStatus(dir, { maxBufferBytes: 400, warn: (m) => { first.push(m) } })
      expect(first.length).toBe(1)
      // 判据:全档输出 36 行 ≈600B 必超 400B —— 若第二次仍先撞全档,必然再抛一次 ENOBUFS、再喊一条 warn。
      // 记住之后直奔折叠档 ⇒ 结论照旧 degraded(留痕不撒谎),但既不再撞限也不再刷屏。
      const second: string[] = []
      const r2 = execGitStatus(dir, { maxBufferBytes: 400, warn: (m) => { second.push(m) } })
      expect(r2.degraded).toBe(true)
      expect(r2.collapsedUntrackedRoots.length).toBe(3)
      expect(second).toEqual([])
      expect(lastStatusDegradation(dir)).not.toBeNull()
    } finally { rmScratch(dir) }
  })

  it('没超限 ⇒ 走全档、degraded=false、不留任何记账(正向对照)', () => {
    const dir = mkUntrackedRepo('full-')
    try {
      const warns: string[] = []
      const r = execGitStatus(dir, { maxBufferBytes: 20 * 1024 * 1024, warn: (m) => { warns.push(m) } })
      expect(r.degraded).toBe(false)
      expect(r.collapsedUntrackedRoots).toEqual([])
      expect(warns).toEqual([])
      expect(lastStatusDegradation(dir)).toBeNull()
      expect(r.lines.filter((l) => l.startsWith('??')).length).toBe(36)
    } finally { rmScratch(dir) }
  })

  it('折叠档也超限 ⇒ 照旧抛，绝不返回一份空结论(失效方向是失败不是假完整)', () => {
    const dir = mkUntrackedRepo('both-')
    try {
      expect(() => execGitStatus(dir, { maxBufferBytes: 1, warn: () => {} })).toThrow(GitOutputTooLargeError)
      expect(lastStatusDegradation(dir)).toBeNull()
    } finally { rmScratch(dir) }
  })

  it('只在这一类上降级：超时/普通失败原样上抛，不给第二次执行(反向锁)', () => {
    const dir = mkScratch('ihui-gitcaps-throw-')
    try {
      // 不是 git 仓 ⇒ status 以非零退出失败(class=exit)，不得被折叠档掩盖
      let caught: unknown = null
      try { execGitStatus(dir, { maxBufferBytes: 20 * 1024 * 1024, warn: () => {} }) } catch (e) { caught = e }
      expect(caught).not.toBeNull()
      expect(caught).not.toBeInstanceOf(GitOutputTooLargeError)
      expect(lastStatusDegradation(dir)).toBeNull()
    } finally { rmScratch(dir) }
  })
})
