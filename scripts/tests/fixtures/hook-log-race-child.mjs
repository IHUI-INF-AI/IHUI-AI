// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
//
// hook-run-hidden.vbs 并发争用夹具的子进程。
// 参数: <tag> <lines> <sleepMs> <exitCode>
//   - 向 stdout 打 <lines> 行,每行都带唯一 tag;
//   - 向 stderr 打一行;
//   - 在打印前后各 sleep 一次,把 "cmd.exe 持有重定向句柄" 的窗口撑开,
//     使并发调用真的重叠(而不是靠调度偶然);
//   - exitCode 用于第二类夹具:钩子自身失败必须原样传播 rc(默认 0)。

const [tag = 'x', linesArg = '200', sleepArg = '0', exitArg = '0'] = process.argv.slice(2)
const lines = Number(linesArg)
const sleepMs = Number(sleepArg)
const exitCode = Number(exitArg)

const wait = (ms) => {
  if (!(ms > 0)) return
  const end = Date.now() + ms
  while (Date.now() < end) {
    // 忙等:不引入定时器噪音,让并发窗口稳定可复现
  }
}

wait(sleepMs)
for (let i = 0; i < lines; i += 1) {
  process.stdout.write(`RACE ${tag} ${i}\n`)
}
process.stderr.write(`RACE ${tag} stderr\n`)
wait(sleepMs)
process.exitCode = exitCode
