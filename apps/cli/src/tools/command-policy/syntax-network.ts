// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令语法表 · 网络出口档(curl / wget / ssh 系 + gh):`effect: network` 的基线效应是 egress 取词闸门的唯一开关。
 *
 * 由 goal-b49 Z14 机械拆分而来(逐字搬运,零改写):
 * 登记内容与拆前逐字节一致,只是分档到不同文件;基线效应/arity 的取值口径未动。
 */

import type { CommandSpec } from './types.js';
import { opt } from './syntax-options.js';
import { INFO_OPTIONS } from './syntax-options.js';

export const GH_TABLE: Readonly<Record<string, CommandSpec>> = {

  gh: {
    effect: 'write',
    structured: true,
    globalOptions: [opt('R', { arity: 'required' }), opt('repo', { arity: 'required' }), opt('hostname', { arity: 'required' }), opt('version'), opt('help')],
    subcommands: {
      pr: { readGuardOptions: ['list', 'view', 'status', 'diff', 'checkout'], mutatingOperands: ['create', 'merge', 'close', 'review', 'ready', 'reopen', 'edit', 'comment', 'delete'], options: [opt('web'), opt('json', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('number', { arity: 'required' }), opt('body', { arity: 'required' }), opt('title', { arity: 'required' }), opt('base', { arity: 'required' }), opt('delete-branch'), opt('merge-method', { arity: 'required' }), opt('rebase', { arity: 'optional' }), opt('repo', { arity: 'required' })] },
      issue: { readGuardOptions: ['list', 'view', 'status'], mutatingOperands: ['create', 'close', 'comment', 'edit', 'reopen', 'delete', 'transfer', 'lock'], options: [opt('web'), opt('json', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('state', { arity: 'required' }), opt('label', { arity: 'required' }), opt('assignee', { arity: 'required' }), opt('milestone', { arity: 'required' }), opt('title', { arity: 'required' }), opt('body', { arity: 'required' })] },
      release: { readGuardOptions: ['list', 'view'], mutatingOperands: ['create', 'edit', 'delete', 'upload', 'download'], options: [opt('web'), opt('latest'), opt('draft'), opt('prerelease'), opt('notes', { arity: 'required' }), opt('notes-file', { arity: 'required' }), opt('title', { arity: 'required' }), opt('target', { arity: 'required' })] },
      api: { effects: ['network', 'write'], options: [opt('X', { arity: 'required', rule: 'gh api -X' }), opt('method', { arity: 'required' }), opt('cache', { arity: 'required' }), opt('f', { arity: 'required' }), opt('field', { arity: 'required' }), opt('input', { arity: 'required' }), opt('jq', { arity: 'required' }), opt('paginate'), opt('slurp'), opt('include'), opt('silent'), opt('preview', { arity: 'required' })] },
      auth: { readGuardOptions: ['status'], mutatingOperands: ['login', 'logout', 'refresh', 'token'], options: [opt('git-protocol', { arity: 'required' }), opt('hostname', { arity: 'required' }), opt('scopes', { arity: 'required' }), opt('web'), opt('with-token')] },
      workflow: { readGuardOptions: ['list', 'view'], mutatingOperands: ['run', 'enable', 'disable', 'delete'], options: [opt('log'), opt('watch'), opt('failed'), opt('attempt', { arity: 'required' }), opt('jq', { arity: 'required' })] },
      repo: { readGuardOptions: ['view', 'clone', 'fork', 'list'], mutatingOperands: ['create', 'sync', 'delete', 'archive', 'rename', 'unarchive'], options: [opt('clone'), opt('fork'), opt('private'), opt('public'), opt('source', { arity: 'required' }), opt('description', { arity: 'required' })] },
      codespaces: { readGuardOptions: ['list', 'view'], mutatingOperands: ['create', 'ssh', 'code', 'stop', 'delete', 'set'], options: [] },
      browse: { effects: ['network'], options: [] },
      search: { effects: ['network'], options: [opt('limit', { arity: 'required' }), opt('json', { arity: 'required' })] },
      status: { effects: ['network'], options: [opt('repo', { arity: 'required' }), opt('jq', { arity: 'required' })] },
      alias: { readGuardOptions: ['list'], mutatingOperands: ['set', 'delete'], options: [] },
      gpg: { readGuardOptions: ['list'], mutatingOperands: ['key'], options: [] },
    },
  },
};

export const NETWORK_SPECS: Readonly<Record<string, CommandSpec>> = {

  curl: {
    effect: 'network',
    options: [
      opt('d', { arity: 'required', effects: ['write'], rule: 'curl -d' }), opt('D', { arity: 'required', effects: ['write'] }), opt('F', { arity: 'required' }), opt('H', { arity: 'required' }), opt('I'), opt('k'), opt('L'), opt('o', { arity: 'required', effects: ['write'] }), opt('O'), opt('P', { arity: 'required' }), opt('q'), opt('r'), opt('S'), opt('s'), opt('T', { arity: 'required', effects: ['write'] }), opt('u', { arity: 'required' }), opt('v'), opt('X', { arity: 'required', rule: 'curl -X' }),
      opt('append'), opt('compressed'), opt('connect-timeout', { arity: 'required' }), opt('cookie', { arity: 'required' }), opt('cookie-jar', { arity: 'required', effects: ['write'] }), opt('data', { arity: 'required' }), opt('data-ascii', { arity: 'required' }), opt('data-binary', { arity: 'required' }), opt('data-raw', { arity: 'required' }), opt('disable'), opt('form', { arity: 'required' }), opt('header', { arity: 'required' }), opt('head'), opt('insecure'), opt('location'), opt('location-trusted'), opt('max-filesize', { arity: 'required' }), opt('max-redirs', { arity: 'required' }), opt('max-time', { arity: 'required' }), opt('output-dir', { arity: 'required', effects: ['write'] }), opt('proxy', { arity: 'required' }), opt('remote-name', { effects: ['write'] }), opt('request', { arity: 'required' }), opt('retry', { arity: 'required' }), opt('show-error'), opt('silent'), opt('trace', { arity: 'required', effects: ['write'] }), opt('trace-ascii', { arity: 'required', effects: ['write'] }), opt('upload-file', { arity: 'required', effects: ['write'] }), opt('user', { arity: 'required' }), opt('verbose'), opt('config', { arity: 'required' }),
    ],
  },
  // ---- Z14:wget 基线效应补 network(接 Z9 ④-2,「在册 ≠ 效应在册」那一格)----
  // 为什么是 network:egress 的裸域名取词闸门(`sandbox/egress/bare-host.ts`)只问 `effects.includes('network')`
  // 的段,wget 此前只有 write 基线 ⇒ `wget db.internal/x` 一个目标都不造。
  // 目的地词位权威(本仓现读,四条生产样本,全部是「选项 + 位置参数 URL」同一形态):
  //   `deploy/saas/scripts/create-customer.sh:168` 与 `resume-customer.sh:63` = `wget --spider -q http://127.0.0.1:8802/api/health`
  //   `scripts/setup-enterprise-demo.sh:211`(healthcheck argv)= `wget -q --spider http://localhost:8802/health`
  //   `deploy/prod-bundle/README.md:263` = `wget -qO- http://127.0.0.1:8080/api/health`
  // 取不到网络身份权威的一律不登记:`tools/sandbox/policy.ts` 的 `NETWORK_COMMAND_BASENAMES` 逐字含 `wget`,
  // 同文件 `DANGEROUS_PATTERNS` 的管道外联档也把 wget 与 curl 同列(既有同源口径,不是我新造的归类)。
  // 拆前那格基线 `write` 承载的知识不丢:URL 操作数存在即下载 ⇒ 保留写副作用(`operandsBreakReadonly`)。
  wget: {
    effect: 'network',
    operandsBreakReadonly: true,
    options: [opt('a', { arity: 'required' }), opt('c'), opt('e', { arity: 'required' }), opt('nv'), opt('o', { arity: 'required' }), opt('O', { arity: 'required' }), opt('P', { arity: 'required' }), opt('q'), opt('r'), opt('S'), opt('t', { arity: 'required' }), opt('v'), opt('Y', { arity: 'required' }), opt('b'), opt('background'), opt('continue'), opt('directory-prefix', { arity: 'required' }), opt('header', { arity: 'required' }), opt('level', { arity: 'required' }), opt('mirror'), opt('no-check-certificate'), opt('no-clobber'), opt('no-parents'), opt('output-document', { arity: 'required' }), opt('output-file', { arity: 'required' }), opt('post-data', { arity: 'required' }), opt('quiet'), opt('recursive'), opt('restrict-file-names', { arity: 'required' }), opt('server-response'), opt('spider'), opt('timeout', { arity: 'required' }), opt('tries', { arity: 'required' }), opt('user-agent', { arity: 'required' })],
  },

  // ---- ssh 系网络命令登记(goal-b49 Z9;纯数据面,零判据)----
  // 为什么登记在这里就够了:`sandbox/egress/bare-host.ts` 的裸域名取词闸门按**本表的 network 效应**
  // 决定"这条命令段要不要问",所以登记 network ⇒ 闸门自动跟长,那一侧一个字都不用改。
  // 两条依据都取自仓内现成权威,不凭印象造词位:
  //   ① "这些 basename 属网络类" = `tools/sandbox/policy.ts` 的 `NETWORK_COMMAND_BASENAMES`
  //      (本仓那份唯一清单,逐字取自其中的 `ssh` / `scp` / `sftp`)。
  //   ② "目的地在哪个词位" = `plugins/url-shape.ts` 的 `SCP_LIKE_RE`(`user@host:path`)与
  //      `ALLOWED_URL_SCHEMES` 的 ssh 档(`user@host`),两者都是**非选项操作数**;求值器的
  //      操作数切分见 `evaluate.ts` 的"词法切分"一节。`bare-host.ts` 头注列的同一组形态即消费面。
  // 未登记的选项按纪律 3 = 判不出(unknown),登记这三条不新增任何免确认命令。
  ssh: {
    // 选项只登记到本仓生产 argv 实测到的那一格:`scripts/git-guardian.mjs` 的 `SSH_COMMAND`
    // (`-i <key>` + 两个 `-o K=V`)与 `tests/plugin-git-guard-g814388.test.ts` 的 `ssh -i /secret/id_ed25519`
    effect: 'network',
    options: [opt('i', { arity: 'required' }), opt('o', { arity: 'required' }), ...INFO_OPTIONS],
  },
  // scp/sftp 的远端规格就是操作数本身(`user@host:path` / `user@host`);本仓无这两条的 argv 样本,
  // 故**不**登记任何短选项 —— 带选项的形态落 unknown,取词闸门仍按 network 基线效应照常开。
  scp: { effect: 'network', options: [...INFO_OPTIONS] },
  sftp: { effect: 'network', options: [...INFO_OPTIONS] },
  // ---- Z14:nc 登记(接 Z9 ④-1)----
  // 身份权威同上(`NETWORK_COMMAND_BASENAMES` 逐字含 `nc`);目的地词位 = 第一个非选项操作数,
  // 端口是第二个(纯数字不含点 ⇒ `bareHostOf` 的形态校验天然拒取,不需在这里加第二把尺)。
  // 词位实证 = 本仓既有样本 `nc monitor.internal 22`(`tests/egress-bare-host.test.ts` 与
  // `tests/command-policy-network-commands.test.ts` 都写过它);Z14 已把「未登记命令」的示例改指仍未登记的 `telnet`。
  // 仓内**无** `nc -<opt>` 的 argv 样本 ⇒ 与 scp/sftp 同档:不登记任何短选项(纪律 3),带选项的形态落 unknown,
  // 取词闸门仍按 network 基线效应照常开。登记 nc 不新增任何免确认命令(既非 read 也不放宽只读面)。
  nc: { effect: 'network', options: [...INFO_OPTIONS] },
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
