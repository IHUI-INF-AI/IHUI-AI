// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ws 的载入形态锁(2026-10-18 立)。
 *
 * 现场:tui-client / ws-bridge 都写成 `import wsModule from 'ws'` 再取 `wsModule.WebSocket`,
 * 而 ws 的 `exports.import` 指向 wrapper.mjs,它只 `export default WebSocket`(裸类),
 * `.WebSocket` / `.WebSocketServer` 两枚别名是 **CJS 档 index.js** 才挂上去的 ⇒ ESM / tsx / vitest
 * 这一路恒 undefined,`loadWsClient()` 返回 null,喊出来的却是「ws 包未安装」—— 而依赖既在
 * package.json 也在 lock 里。CI 上 g-814408 那 4 例因此红了整条必需检查。
 *
 * 另一处更坏:`ws-bridge.ts` 当时写 `mod.WebSocketServer ?? mod.default ?? null`,兜底命中的
 * `mod.default` 是**客户端** WebSocket,`new WsServer({server,path})` 会变成一条向外拨号的客户端连接,
 * 桥"起来了"而没人连得上 —— 而这条路径(serve)全仓无测试。
 *
 * 判据两半:① 行为面 —— 具名档必须是构造函数(四条载入形态共用的取法);
 * ② 形状面 —— 两个消费点必须真按具名档取,且不得留 `mod.default` 那种型别不对的兜底。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { WebSocket as WsClientNamed, WebSocketServer as WsServerNamed } from 'ws';

// 与同域那份 g-814408 用同一种定根法(import.meta.url,不靠 __dirname、不靠 process.cwd() —— §15)
const SRC = fileURLToPath(new URL('../src', import.meta.url));

function readSrc(rel: string): string {
  return readFileSync(resolve(SRC, rel), 'utf8');
}

describe('ws 载入形态:具名档才是四条路都取得到的那一档', () => {
  it('正向:具名 WebSocket / WebSocketServer 都是构造函数', () => {
    expect(typeof WsClientNamed).toBe('function')
    expect(typeof WsServerNamed).toBe('function')
  })

  it('形状锁:tui-client 与 ws-bridge 必须 import 具名档,不得回潮"默认导出取属性"', () => {
    for (const [rel, binding] of [
      ['client/tui-client.ts', 'WebSocket'],
      ['server/ws-bridge.ts', 'WebSocketServer'],
    ] as const) {
      const code = readSrc(rel)
      expect(
        new RegExp(`import \\{[^}]*\\b${binding}\\b[^}]*\\} from 'ws'`).test(code),
        `${rel} 必须从 'ws' 具名导入 ${binding}`,
      ).toBe(true)
      expect(
        /import\s+wsModule\s+from\s+'ws'/.test(code),
        `${rel} 不得再保留"默认导入整包再取属性"的写法`,
      ).toBe(false)
    }
  })

  it('反证锁:服务端不得用 `?? mod.default` 兜底(那枚是客户端构造函数,型别不对)', () => {
    const code = readSrc('server/ws-bridge.ts')
    expect(/default\s*\?\?/.test(code), 'ws-bridge 里不得出现 default 兜底').toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
