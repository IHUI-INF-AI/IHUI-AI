// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:install-dev-stack-autostart 的注册结果判据(§22c 判据单源,不复制规则表)。
//
// 立因(2026-10-31 实测):IHUI-DevStack 是 ExecutionTimeLimit=0 的常驻任务,注册 + Start 之后
// 立刻回读 LastTaskResult 拿到的是 267009(SCHED_S_TASK_RUNNING,任务正在跑),而旧判据
// `/LAST=(?!0\b)/` 只认 0 ⇒ 每次成功注册都被打成「注册/启动失败」并 exit 1。后果不止是人看见
// 假错:dev-stack-watchdog 的自愈腿按 `r.status !== 0` 记 repair-failed,永远收不到成功,
// 每 2 分钟重装一次、顺手杀掉正在跑的守护(双头抢拉 + 服务抖)。
// 本用例钉的是「成功形态必须被判成成功」+「拿不到形状必须是未判定而不是成功」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__ as AUTOSTART } from '../install-dev-stack-autostart.mjs';

const { judgeRegisterOutcome, TASK_RESULT_RUNNING } = AUTOSTART;

test('LAST=0(任务已跑完)⇒ 成功', () => {
  const v = judgeRegisterOutcome('LOGON=S4U LAST=0');
  assert.equal(v.ok, true);
  assert.equal(v.undetermined, false);
  assert.match(v.why, /completed/);
});

test('LAST=267009(常驻任务正在跑)⇒ 成功 —— 本用例钉的就是旧判据打错的那一枚', () => {
  assert.equal(TASK_RESULT_RUNNING, 267009);
  const v = judgeRegisterOutcome('LOGON=S4U LAST=267009');
  assert.equal(v.ok, true);
  assert.equal(v.undetermined, false);
  assert.match(v.why, /running/);
});

test('pwsh 的 CLIXML 进度噪声混在输出里也要能判出来(本机实测形态)', () => {
  const out = ['#< CLIXML', '<Objs Version="1.1.0.1">…一坨进度记录…</Objs>', 'LOGON=S4U LAST=267009'].join(
    '\n',
  );
  const v = judgeRegisterOutcome(out);
  assert.equal(v.ok, true);
  assert.equal(v.logon, 'S4U');
});

test('LogonType 非 S4U ⇒ 判失败(有桌面即会弹窗,不能当成功收下)', () => {
  const v = judgeRegisterOutcome('LOGON=Interactive LAST=0');
  assert.equal(v.ok, false);
  assert.equal(v.undetermined, false);
  assert.match(v.why, /LogonType=Interactive/);
});

test('LastTaskResult 是别的错误码 ⇒ 判失败', () => {
  for (const code of ['1', '2147942402', '267011']) {
    const v = judgeRegisterOutcome(`LOGON=S4U LAST=${code}`);
    assert.equal(v.ok, false, `LAST=${code} 不该算成功`);
    assert.equal(v.undetermined, false);
  }
});

test('读不到形状(空/半截/异常输出)⇒ 未判定,绝不冒绿(§0.3)', () => {
  for (const out of ['', undefined, null, 'Register-ScheduledTask: Access denied', 'LOGON=S4U', 'LAST=0']) {
    const v = judgeRegisterOutcome(out);
    assert.equal(v.ok, false, `未判定不得算成功:${String(out)}`);
    assert.equal(v.undetermined, true, `形状缺失应落未判定:${String(out)}`);
  }
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
