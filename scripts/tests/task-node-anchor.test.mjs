// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:计划任务 node 锚点判据(§22c 判据单源,测试内不复制规则表)。
//
// 立因(2026-10-31 本机一手现场):注册器把 process.execPath 烤进任务 action,一次由第三方
// AI IDE 自带 node 跑的注册,让两枚常驻任务长期烤着 `…\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`;
// 那枚解释器住在别人的产品目录里,随对方升级/卸载就消失 ⇒ 守护静默停摆。
// 本用例钉的是「锚点必须取本机 PATH 上那枚规范 node」+「取不到一律未判定,不许回落到自己」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__ as ANCHOR } from '../lib/task-node-anchor.mjs';

const { resolveTaskNodeAnchor, isThirdPartyNodePath, findThirdPartyNodeToken } = ANCHOR;

const WIN_SYS = 'C:/Program Files/nodejs/node.exe'
// 锚点产出按平台原生分隔符(要嵌进 PowerShell 单引号),所以断言期望也用反斜杠形态。
const WIN_SYS_NATIVE = 'C:\\Program Files\\nodejs\\node.exe';
const WIN_BUNDLED =
  'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/node.exe';

const existsAll = (...paths) => {
  const set = new Set(paths.map((p) => p.replace(/\\/g, '/').toLowerCase()));
  return (p) => set.has(String(p).replace(/\\/g, '/').toLowerCase());
};

test('PATH 上有规范 node ⇒ 用它,即便当次解释器是第三方捆绑 node(今天那枚病的正解)', () => {
  const v = resolveTaskNodeAnchor({
    execPath: WIN_BUNDLED,
    pathEntries: ['C:\\Program Files\\nodejs', 'D:\\nope'],
    exists: existsAll(WIN_SYS, WIN_BUNDLED),
    platform: 'win32',
  });
  assert.equal(v.ok, true);
  assert.equal(v.anchor, WIN_SYS_NATIVE);
  assert.equal(v.source, 'path-canonical');
  assert.match(v.note, /第三方捆绑目录/);
});

test('当次解释器就是 PATH 那枚 ⇒ 成功且不必改写(note 空,不制造噪音)', () => {
  const v = resolveTaskNodeAnchor({
    execPath: WIN_SYS,
    pathEntries: ['C:\\Program Files\\nodejs'],
    exists: existsAll(WIN_SYS),
    platform: 'win32',
  });
  assert.equal(v.ok, true);
  assert.equal(v.anchor, WIN_SYS_NATIVE);
  assert.equal(v.note, '');
});

test('PATH 取不到、解释器干净 ⇒ 按当次解释器落地但如实标 fallback', () => {
  const v = resolveTaskNodeAnchor({
    execPath: '/opt/custom/bin/node',
    pathEntries: ['/nonexistent/bin'],
    exists: existsAll('/opt/custom/bin/node'),
    platform: 'linux',
  });
  assert.equal(v.ok, true);
  assert.equal(v.source, 'execPath-fallback');
  assert.match(v.note, /PATH 上量不到 node/);
});

test('PATH 取不到、解释器在第三方私有目录 ⇒ 拒绝(判失败,不是未判定,也不是放行)', () => {
  const v = resolveTaskNodeAnchor({
    execPath: WIN_BUNDLED,
    pathEntries: [],
    exists: existsAll(WIN_BUNDLED),
    platform: 'win32',
  });
  assert.equal(v.ok, false);
  assert.equal(v.undetermined, false);
  assert.match(v.why, /第三方产品私有目录/);
  assert.match(v.why, /重跑本注册器|先修 PATH/);
});

test('两样都取不到 ⇒ 未判定,绝不猜也不注册(§0.3)', () => {
  const v = resolveTaskNodeAnchor({
    execPath: '',
    pathEntries: ['C:\\nowhere'],
    exists: () => false,
    platform: 'win32',
  });
  assert.equal(v.ok, false);
  assert.equal(v.undetermined, true);
  assert.equal(v.anchor, undefined);
});

test('非 win 平台找的是 node 而不是 node.exe', () => {
  const v = resolveTaskNodeAnchor({
    execPath: '/usr/local/bin/node',
    pathEntries: ['/usr/local/bin'],
    exists: existsAll('/usr/local/bin/node'),
    platform: 'darwin',
  });
  assert.equal(v.ok, true);
  assert.equal(v.anchor, '/usr/local/bin/node');
});

test('PATH 分段里的空段/尾斜杠/不存在目录不得产生命名漂移', () => {
  const v = resolveTaskNodeAnchor({
    execPath: WIN_BUNDLED,
    pathEntries: ['', '   ', 'D:\\missing\\', 'C:\\Program Files\\nodejs\\'],
    exists: existsAll(WIN_SYS),
    platform: 'win32',
  });
  assert.equal(v.anchor, WIN_SYS_NATIVE);
  assert.ok(!v.anchor.endsWith('/'), '锚点不该以分隔符收尾');
});

test('第三方私有目录识别:反斜杠/大写/另一种布局都要命中', () => {
  for (const p of [
    WIN_BUNDLED,
    'C:\\Users\\Admin\\.TRAE\\node\\v20\\node.exe',
    'C:/x/.codebuddy/tools/node.exe',
    'C:/tools/binaries/node/versions/22/node.exe',
  ]) {
    assert.equal(isThirdPartyNodePath(p), true, `应命中:${p}`);
  }
  for (const p of [WIN_SYS, '/usr/local/bin/node', '', undefined]) {
    assert.equal(isThirdPartyNodePath(p), false, `不该命中:${String(p)}`);
  }
});

// 今天真实的病形态:任务 action 面上是 wscript/pwsh,第三方捆绑 node 藏在**参数**里。
// 只判 Execute 会整型漏判,所以判据必须能在任意文本里认出「被当可执行体用的 node」。
test('参数里藏着的捆绑 node 要命中(VBS/pwsh 包装形态)', () => {
  const vbs =
    `shell.Run """C:\\Program Files\\PowerShell\\7\\pwsh.exe"" -Command ""Start-Process -FilePath ` +
    `'C:\\Users\\Administrator\\.workbuddy\\binaries\\node\\versions\\22.22.2-6\\node.exe' " """, 0, False`;
  const hit = findThirdPartyNodeToken(vbs);
  assert.ok(hit, 'VBS 参数里的捆绑 node 必须被认出来');
  assert.match(hit, /\.workbuddy/i);
});

test('正当数据路径不得误判成锚点(§12e 反恒红:巡检天天误报就等于不报)', () => {
  for (const text of [
    'node scripts/migrate-workbuddy-sessions.mjs --src C:\\Users\\Admin\\.workbuddy\\sessions\\chat-2026.json',
    'C:/Users/Admin/.trae/docs/notes.md',
    `node.exe ${'G:\\IHUI-AI\\scripts\\git-guardian.mjs'} --status`,
    '',
    undefined,
  ]) {
    assert.equal(findThirdPartyNodeToken(text), null, `不该命中:${String(text).slice(0, 60)}`);
  }
});

test('参数里的系统 node 不算禁地(否则本机每条正常任务都会翻红)', () => {
  assert.equal(
    findThirdPartyNodeToken('"C:\\Program Files\\nodejs\\node.exe" G:\\IHUI-AI\\scripts\\dev-stack.mjs --watch'),
    null,
  );
  assert.match(
    String(findThirdPartyNodeToken('C:\\x\\.codebuddy\\bin\\node.exe -e 1')),
    /codebuddy/i,
  );
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
