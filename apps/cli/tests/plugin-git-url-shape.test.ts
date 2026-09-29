// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):活进程的 TEMP 可能仍钉在 C 盘,故一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

/**
 * G-786 —— git clone 的 URL/ref/sha 形状白名单与 `--` 分隔。
 *
 * 钉的是实测可达缺陷:远端 marketplace manifest 里的 `"url":"--upload-pack=…"` 会被 installer 原样
 * 递到 `cache.ts::performClone` 的 argv **位置参数位**,而旧实现既没有 `--` 分隔、也没有前导横杠拒绝、
 * 更没有 scheme 校验 ⇒ git 把它当**选项**解析;`"url":"ext::sh -c …"` 在启用该 transport 的 git 构建下
 * 等于执行外部命令。typecheck/lint 对这一格全绿(它连编译期症状都没有),只有尺子能看见。
 *
 * 测试口径(两条是本票的硬性约束,不是风格):
 *   - **正反成对**:每个拒绝都配一条"同形但合法"的放过,否则判据过宽与过窄在账面上长得一样;
 *   - **拒绝必须证明"根本没派生 git"**:`node:child_process` 整体被 mock,拒绝路径断言
 *     `execFileSync` 零调用 —— 用 IHUI_MOCK_GIT_CLONE_SRC 那条钩子做不到这件事(它是"不派生"的
 *     另一种成因,会替拒绝路径发出假绿灯),所以成功路径同样用 mock 的 execFileSync 记录 argv。
 */

const execFileSyncMock = vi.hoisted(() => vi.fn((_cmd: string, _args: readonly string[]) => ''));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
  execSync: vi.fn(() => ''),
  spawn: vi.fn(),
  spawnSync: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
  execFile: vi.fn(),
  fork: vi.fn(),
}));

import {
  assertGitCloneInputs,
  evaluateGitRef,
  evaluateGitSha,
  evaluateGitUrl,
  GitCloneInputRejectedError,
} from '../src/plugins/url-shape.js';
import * as marketplace from '../src/plugins/marketplace.js';
import { isGitSource } from '../src/plugins/marketplace.js';
import { getCachePath, getOrCloneGitCache } from '../src/plugins/cache.js';

const HOME_ENV = 'IHUI_HOME';
const MOCK_CLONE_SRC_ENV = 'IHUI_MOCK_GIT_CLONE_SRC';
const GIT_BIN_ENV = 'IHUI_GIT_BIN';

let tmpHome: string;
let savedHome: string | undefined;
let savedMock: string | undefined;
let savedGitBin: string | undefined;

beforeEach(() => {
  tmpHome = mkScratch('git-url-shape-home-');
  savedHome = process.env[HOME_ENV];
  savedMock = process.env[MOCK_CLONE_SRC_ENV];
  savedGitBin = process.env[GIT_BIN_ENV];
  process.env[HOME_ENV] = tmpHome;
  // 三个钩子全清:判据必须跑在"真派生分支"上,而派生本身被 mock 截住
  delete process.env[MOCK_CLONE_SRC_ENV];
  delete process.env[GIT_BIN_ENV];
  execFileSyncMock.mockReset();
  execFileSyncMock.mockImplementation((_cmd: string, args: readonly string[]) => {
    // 让 clone 之后那趟提交点有活可干:把 target(最后一个位置参数)造成一份非空副本
    const target = args[args.length - 1] ?? '';
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'plugin.json'), '{"name":"p"}', 'utf-8');
    return '';
  });
});

afterEach(() => {
  if (savedHome !== undefined) process.env[HOME_ENV] = savedHome;
  else delete process.env[HOME_ENV];
  if (savedMock !== undefined) process.env[MOCK_CLONE_SRC_ENV] = savedMock;
  else delete process.env[MOCK_CLONE_SRC_ENV];
  if (savedGitBin !== undefined) process.env[GIT_BIN_ENV] = savedGitBin;
  else delete process.env[GIT_BIN_ENV];
  rmScratch(tmpHome);
});

// ==================== ① 判据只有一份(两处 import 同一实现) ====================

describe('G-786 单一判据源', () => {
  it('marketplace 的转发出口与 url-shape 的实现是同一个函数引用(不是第二份正则)', () => {
    expect(marketplace.evaluateGitUrl).toBe(evaluateGitUrl);
    expect(marketplace.evaluateGitRef).toBe(evaluateGitRef);
    expect(marketplace.evaluateGitSha).toBe(evaluateGitSha);
    expect(marketplace.assertGitCloneInputs).toBe(assertGitCloneInputs);
    expect(marketplace.GitCloneInputRejectedError).toBe(GitCloneInputRejectedError);
  });
});

// ==================== ② url 形状白名单(纯函数,正反成对) ====================

describe('evaluateGitUrl — 前导横杠与 scheme 白名单', () => {
  it('① 位置参数位上的 git 选项(前导 -)必拒,且拒绝码是结构化的', () => {
    for (const bad of ['--upload-pack=/bin/sh', '--upload-pack=touch pwned', '-u', '--'] as const) {
      const v = evaluateGitUrl(bad);
      expect(v.ok, bad).toBe(false);
      if (!v.ok) expect(v.reasonCode, bad).toBe('urlLeadingDash');
    }
  });

  it('② ext:: 外部 transport 必拒(判据与本机 git 是否启用 ext:: 无关)', () => {
    const v = evaluateGitUrl("ext::sh -c 'touch pwned'");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasonCode).toBe('urlSchemeUnsupported');
    // 阳性对照的同族:`ext::` 不带空白的形态同样不得放行(不得只靠"含空白"这一支拒绝)
    const bare = evaluateGitUrl('ext::sh');
    expect(bare.ok).toBe(false);
  });

  it('③ 正例:https 是生产默认放行档', () => {
    const v = evaluateGitUrl('https://github.com/openclarity/demo.git');
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.kind).toBe('https');
      expect(v.host).toBe('github.com');
    }
  });

  it('④ 回环 http 仅在测试钩子在位时放行(G-797),非回环 http 与"无钩子的回环"都必拒', () => {
    for (const okLoop of ['http://127.0.0.1:8080/x.git', 'http://localhost:3000/x.git', 'http://[::1]/x.git']) {
      const v = evaluateGitUrl(okLoop, { loopbackTestHook: true });
      expect(v.ok, okLoop).toBe(true);
      if (v.ok) expect(v.kind, okLoop).toBe('loopbackHttp');
    }
    const evil = evaluateGitUrl('http://evil.test/x.git', { loopbackTestHook: true });
    expect(evil.ok).toBe(false);
    if (!evil.ok) expect(evil.reasonCode).toBe('urlSchemeUnsupported');

    // G-797 的正反成对:同一个**回环**值,钩子不在位时必须落到新的结构化码。
    // 这一条是本票的产出本身 —— 少了它,"回环一律放行"与"回环按钩子放行"在账面上同形。
    for (const loop of ['http://127.0.0.1:9/evil.git', 'http://localhost:8802/x.git', 'http://[::1]/x.git']) {
      const v = evaluateGitUrl(loop);
      expect(v.ok, loop).toBe(false);
      if (!v.ok) {
        expect(v.reasonCode, loop).toBe('urlLoopbackHttpNeedsTestHook');
        // detail 只允许带 redact 后的预览,不得把原文搬进可打印字段
        expect(v.detail, loop).not.toContain('evil.git');
      }
    }
    // https 与 ssh 不受这一档影响(缺省参数就是生产路径,绝不能顺手被收紧成拒)
    expect(evaluateGitUrl('https://github.com/openclarity/demo.git').ok).toBe(true);
    expect(evaluateGitUrl('git@github.com:openclarity/scp-like.git').ok).toBe(true);
  });

  it('④c G-798:内嵌凭据的 userinfo 必拒,且拒绝理由里不得带出那把凭据;ssh 登录名不受影响', () => {
    // 拒绝档:https / 带钩子的回环 http / ssh 带口令段
    const reject: Array<[string, string]> = [
      ['https://user:S3cr3tTok3n@github.com/a/b.git', 'https'],
      ['https://oauth2@github.com/a/b.git', 'https(只有用户名也算 userinfo —— 它就是凭据身份)'],
      ['http://syncuser:S3cr3tPassw0rd@127.0.0.1:8080/x.git', 'loopback http(带钩子也照样拒)'],
      ['ssh://git:S3cr3tTok3n@github.com/a/b.git', 'ssh 带口令段'],
    ]
    for (const [url, why] of reject) {
      const v = evaluateGitUrl(url, { loopbackTestHook: true });
      expect(v.ok, `${why} :: ${url}`).toBe(false);
      if (!v.ok) {
        expect(v.reasonCode, url).toBe('urlCredentialsInUrl');
        // 拒绝面不得把凭据搬进可打印字段(detail 会随错误对象进日志)
        expect(v.detail, `detail 泄漏凭据:${v.detail}`).not.toContain('S3cr3t');
        expect(v.detail, `detail 泄漏凭据:${v.detail}`).not.toContain('Passw0rd');
      }
    }
    // 正向对照(票面"两种结果各有正解"里的那一半):这些形态必须**照旧放行**,
    // 否则本判据就从"拦凭据"变成"拦 ssh",把 SSH 通道整条封死。
    expect(evaluateGitUrl('https://github.com/openclarity/demo.git').ok).toBe(true);
    const ssh = evaluateGitUrl('ssh://git@github.com/a/b.git');
    expect(ssh.ok).toBe(true);
    if (ssh.ok) expect(ssh.kind).toBe('sshUrl');
    expect(evaluateGitUrl('git@github.com:openclarity/scp-like.git').ok).toBe(true);
    expect(evaluateGitUrl('http://127.0.0.1:8080/x.git', { loopbackTestHook: true }).ok).toBe(true);
  });

  it('④d G-798 咽喉点:带凭据的 URL 必拒且不派生 git(拒绝必须发生在任何进程创建之前)', async () => {
    process.env[GIT_BIN_ENV] = 'git-fixture'; // 只为了放行回环那一档以外的通道,本例走 https
    const err = await getOrCloneGitCache('https://user:S3cr3tTok3n@example.com/x.git').catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    const rejected = err as GitCloneInputRejectedError;
    expect(rejected.field).toBe('url');
    expect(rejected.reasonCode).toBe('urlCredentialsInUrl');
    expect(execFileSyncMock.mock.calls.length, '拒绝路径不得派生 git').toBe(0);
    // message 里也不得出现那把凭据(previewOf 的脱敏方向在这里被验收)
    expect(rejected.message).not.toContain('S3cr3t');
  });


  it('⑤ ssh 形态按结构放行(ssh:// 与 scp-like user@host:path)', () => {
    const viaUrl = evaluateGitUrl('ssh://git@github.com/a/b.git');
    expect(viaUrl.ok).toBe(true);
    if (viaUrl.ok) expect(viaUrl.kind).toBe('sshUrl');

    const viaScp = evaluateGitUrl('git@github.com:a/b.git');
    expect(viaScp.ok).toBe(true);
    if (viaScp.ok) expect(viaScp.kind).toBe('scpLike');

    // 收紧过宽的对照:路径**中间**带 - 与 + 的正当 scp 形态不得被误拒
    const withDash = evaluateGitUrl('git@github.com:open-org/repo-name.git');
    expect(withDash.ok).toBe(true);

    // 同形但恶意的 scp-like:path 段前导横杠、host 段前导横杠都不得被当成合法 scp 形态
    const badPath = evaluateGitUrl('git@github.com:--upload-pack=/bin/sh');
    expect(badPath.ok).toBe(false);
    if (!badPath.ok) expect(badPath.reasonCode).toBe('urlMalformed');
    const badHost = evaluateGitUrl('git@-github.com:a/b.git');
    expect(badHost.ok).toBe(false);
  });

  it('其余非白名单形态一律拒(裸路径 / file:// / git:// / 空串 / 非字符串 / 缺主机 / 含空白)', () => {
    const cases: readonly [unknown, string][] = [
      ['/tmp/local-repo', 'urlMalformed'],
      // 盘符串被 WHATWG URL 认成单字母 scheme(`c:`),所以落在 schemeUnsupported 而不是 malformed;
      // 两态都是拒 —— 这一条记下来是为了防止后来人把判据"修"成按前缀猜本地路径。
      ['C:\\Windows\\system32', 'urlSchemeUnsupported'],
      ['file:///etc/passwd', 'urlSchemeUnsupported'],
      ['git://github.com/a/b.git', 'urlSchemeUnsupported'],
      ['', 'urlEmpty'],
      [42, 'urlNotString'],
      [null, 'urlNotString'],
      // 特殊 scheme 的空主机在 WHATWG 解析期就报错 ⇒ 落 malformed;`urlHostMissing` 这一支只有
      // 非特殊 scheme(ssh:// 允许不透明形态、空主机)才可达 —— 两条各配一例,免得判据里留一条
      // 永不成立却看起来在判的分支(本仓"判据必须覆盖自己产出的形态"同一条禁令)。
      ['https://', 'urlMalformed'],
      ['ssh:///a/b.git', 'urlHostMissing'],
      ['https://example.test/a b.git', 'urlWhitespace'],
    ];
    for (const [input, expected] of cases) {
      const v = evaluateGitUrl(input);
      expect(v.ok, String(input)).toBe(false);
      if (!v.ok) expect(v.reasonCode, String(input)).toBe(expected);
    }
  });
});

// ==================== ③ ref / sha ====================

describe('evaluateGitRef / evaluateGitSha', () => {
  it('⑥ 前导 - 的 ref 必拒;缺省与空串等价"未给分支"(放过)', () => {
    const bad = evaluateGitRef('--upload-pack=/bin/sh');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reasonCode).toBe('refLeadingDash');

    expect(evaluateGitRef('main')).toEqual({ ok: true, present: true });
    expect(evaluateGitRef(undefined)).toEqual({ ok: true, present: false });
    expect(evaluateGitRef('')).toEqual({ ok: true, present: false });
    // 反例:带空白/控制字符的 ref 不是合法分支名(也是 ext:: 残渣的常见形态)
    expect(evaluateGitRef('v1.0.0 sh -c x').ok).toBe(false);
    expect(evaluateGitRef(7).ok).toBe(false);
  });

  it('sha 只认 4–64 位十六进制(它是 fetch/checkout 的位置参数,而 checkout 不能加 --)', () => {
    expect(evaluateGitSha('504f159447764f8feb887b1eb973297288b28dcd').ok).toBe(true);
    expect(evaluateGitSha('504f159').ok).toBe(true);
    expect(evaluateGitSha(undefined)).toEqual({ ok: true, present: false });
    const bad = evaluateGitSha('--upload-pack=/bin/sh');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reasonCode).toBe('shaMalformed');
    expect(evaluateGitSha('504f159447764f8feb887b1eb973297288b28dcx').ok).toBe(false);
  });

  it('assertGitCloneInputs 的归因顺序:url 先于 ref 先于 sha', () => {
    const e1 = capture(() => assertGitCloneInputs({ url: '-x', ref: '-y', sha: 'zz' }));
    expect(e1).toBeInstanceOf(GitCloneInputRejectedError);
    expect(e1?.field).toBe('url');
    const e2 = capture(() => assertGitCloneInputs({ url: 'https://ok.test/a.git', ref: '-y', sha: 'zz' }));
    expect(e2?.field).toBe('ref');
    const e3 = capture(() => assertGitCloneInputs({ url: 'https://ok.test/a.git', ref: 'main', sha: 'zz' }));
    expect(e3?.field).toBe('sha');
    expect(() => assertGitCloneInputs({ url: 'https://ok.test/a.git', ref: 'main', sha: '504f159' })).not.toThrow();
  });
});

// ==================== ④ 咽喉点:拒绝路径根本不派生 git ====================

describe('getOrCloneGitCache → performClone — 判据先于任何派生', () => {
  it('① "--upload-pack=…" 被拒,且 execFileSync 零调用', async () => {
    const url = '--upload-pack=/bin/sh';
    const err = await getOrCloneGitCache(url).catch((e: unknown) => e as GitCloneInputRejectedError);
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    expect(err.field).toBe('url');
    expect(err.reasonCode).toBe('urlLeadingDash');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('② "ext::sh -c \'touch pwned\'" 被拒,且 execFileSync 零调用', async () => {
    const url = "ext::sh -c 'touch pwned'";
    const err = await getOrCloneGitCache(url).catch((e: unknown) => e as GitCloneInputRejectedError);
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    expect(err.field).toBe('url');
    expect(execFileSyncMock).not.toHaveBeenCalled();
    // 磁盘上也不该留下任何被"clone"出来的东西:降级分支不得把没拿到写成拿到了
    expect(fs.existsSync(getCachePath(url))).toBe(false);
  });

  it('⑥ 前导 - 的 ref 被拒,且 execFileSync 零调用', async () => {
    const err = await getOrCloneGitCache('https://ok.test/a.git', { ref: '--upload-pack=/bin/sh' }).catch(
      (e: unknown) => e as GitCloneInputRejectedError,
    );
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    expect(err.field).toBe('ref');
    expect(err.reasonCode).toBe('refLeadingDash');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('拒绝的消息体不回显入参原文(manifest 里的 URL 可能内嵌凭据)', async () => {
    const err = await getOrCloneGitCache('--upload-pack=/bin/sh').catch((e: unknown) => e as Error);
    expect(String(err?.message ?? '')).not.toContain('/bin/sh');
  });

  it('③ 正例:合法 https 派生一次,且位置参数前有 "--" 分隔', async () => {
    const url = 'https://github.com/openclarity/demo.git';
    const result = await getOrCloneGitCache(url);
    expect(result.fromCache).toBe(false);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const args = execFileSyncMock.mock.calls[0]?.[1] as readonly string[];
    const sep = args.indexOf('--');
    expect(sep).toBeGreaterThan(0);
    expect(args.slice(0, sep)).toEqual(['clone', '--depth', '1']);
    // url 必须落在分隔符之后 —— 这才是"选项解析已经关掉"的证据
    expect(args[sep + 1]).toBe(url);
    expect(args.indexOf(url)).toBeGreaterThan(sep);
    // 第二个位置参数是 clone 目标目录:必须是绝对路径且落在本次隔离的缓存根里(不是 url 的变形)
    const target = args[sep + 2] ?? '';
    expect(path.isAbsolute(target)).toBe(true);
    expect(target.startsWith(tmpHome)).toBe(true);
    expect(args[args.length - 1]).toBe(target);
  });

  it('③b 带 ref 时 --branch 在分隔符之前,url 仍在其后', async () => {
    const url = 'https://github.com/openclarity/two.git';
    await getOrCloneGitCache(url, { ref: 'v1.2.3' });
    const args = execFileSyncMock.mock.calls[0]?.[1] as readonly string[];
    const sep = args.indexOf('--');
    expect(args.slice(0, sep)).toEqual(['clone', '--depth', '1', '--branch', 'v1.2.3']);
    expect(args[sep + 1]).toBe(url);
  });

  it('④/⑤ 回环 http(带测试钩子)与 ssh 形态在咽喉点上同样放行(白名单不得只认 https)', async () => {
    // G-797:回环 http 在咽喉点上now需要一个在位的测试钩子才放行。这里用 GIT_BIN 那一档,
    // 因为它**不**改变 clone 的分支(仍真走派生路径,只是二进制名被换),所以 argv 断言仍然有效;
    // MOCK_CLONE_SRC 那档会让 clone 变成"复制目录",argv 根本不产生 —— 用它就证明不了"放行=真派生"。
    process.env[GIT_BIN_ENV] = 'git-fixture';
    await getOrCloneGitCache('http://127.0.0.1:8080/fixture.git');
    const loopArgs = execFileSyncMock.mock.calls[0]?.[1] as readonly string[];
    expect(loopArgs.indexOf('--')).toBeGreaterThan(0);

    execFileSyncMock.mockClear();
    await getOrCloneGitCache('git@github.com:openclarity/scp-like.git');
    const scpArgs = execFileSyncMock.mock.calls[0]?.[1] as readonly string[];
    expect(scpArgs).toContain('git@github.com:openclarity/scp-like.git');
    expect(scpArgs.indexOf('--')).toBeLessThan(scpArgs.indexOf('git@github.com:openclarity/scp-like.git'));
  });

  it('④b G-797:无测试钩子时回环 http 在咽喉点上必拒,且不派生 git(SSRF-into-git 的正面关闭)', async () => {
    // beforeEach 已把两个钩子都清掉 ⇒ 此刻就是"生产路径"。
    expect(process.env[MOCK_CLONE_SRC_ENV]).toBeUndefined();
    expect(process.env[GIT_BIN_ENV]).toBeUndefined();

    const err = await getOrCloneGitCache('http://127.0.0.1:9/evil.git').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    const rejected = err as GitCloneInputRejectedError;
    expect(rejected.field).toBe('url');
    expect(rejected.reasonCode).toBe('urlLoopbackHttpNeedsTestHook');
    // 拒绝必须发生在**任何派生之前**:判据是"根本没调用过 git",而不是"调用失败"
    expect(execFileSyncMock.mock.calls.length, '拒绝路径不得派生 git').toBe(0);
    // 结构化码不得只活在文案里:message 里不含被拒的原文(可能内嵌凭据)
    expect(rejected.message).not.toContain('evil.git');
  });

  it('④b 非回环 http 在咽喉点上被拒且不派生', async () => {
    const err = await getOrCloneGitCache('http://evil.test/x.git').catch((e: unknown) => e as GitCloneInputRejectedError);
    expect(err).toBeInstanceOf(GitCloneInputRejectedError);
    expect(err.reasonCode).toBe('urlSchemeUnsupported');
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });
});

// ==================== ⑤ marketplace 守卫的形态收窄 ====================

describe('isGitSource — 只收窄形态,不接管 scheme 判定', () => {
  it('合法 git source 仍为 true;url 非字符串 / 空串不再通过守卫', () => {
    expect(isGitSource({ source: 'url', url: 'https://x.git' })).toBe(true);
    expect(isGitSource('./plugins/foo')).toBe(false);
    expect(isGitSource({ type: 'local', path: './plugins/foo' })).toBe(false);
    expect(isGitSource({ source: 'url', url: '' })).toBe(false);
    expect(isGitSource({ source: 'url', url: 42 as unknown as string })).toBe(false);
    expect(isGitSource({ source: 'url' } as unknown as { source: 'url'; url: string })).toBe(false);
  });

  it('守卫不因 scheme 而改口(分流职责与形状问责点是两件事)', () => {
    // 恶意形态照样会被 performClone 拦下;守卫若在这里按 scheme 拒绝,
    // installer 会把它落到"未知的 source 类型"分支,结构化 reasonCode 就丢了。
    expect(isGitSource({ source: 'url', url: '--upload-pack=/bin/sh' })).toBe(true);
  });
});

// ==================== 辅助 ====================

function capture(fn: () => void): GitCloneInputRejectedError | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof GitCloneInputRejectedError ? e : null;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
