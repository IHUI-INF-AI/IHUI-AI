import { describe, it, expect } from 'vitest';
import { readSseStream } from '../src/tools/mcp-runtime.js';

/** 用字符串数组构造一个 ReadableStream,每个元素作为一个 chunk 入队。 */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('readSseStream', () => {
  it('解析单个 message 事件', async () => {
    const events: Array<{ event: string; data: string }> = [];
    const stream = makeStream(['event: message\ndata: {"id":1,"result":"ok"}\n\n']);
    await readSseStream(stream, (event, data) => {
      events.push({ event, data });
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('message');
    expect(events[0]?.data).toBe('{"id":1,"result":"ok"}');
  });

  it('解析多个事件(连续)', async () => {
    const events: string[] = [];
    const stream = makeStream([
      'event: endpoint\ndata: /mcp?session=1\n\n',
      'event: message\ndata: {"id":1}\n\n',
    ]);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual(['/mcp?session=1', '{"id":1}']);
  });

  it('解析 endpoint 事件', async () => {
    let endpoint = '';
    const stream = makeStream(['event: endpoint\ndata: /mcp/post\n\n']);
    await readSseStream(stream, (event, data) => {
      if (event === 'endpoint') endpoint = data;
    });
    expect(endpoint).toBe('/mcp/post');
  });

  it('解析多行 data: 字段(用 \\n 连接)', async () => {
    let received = '';
    const stream = makeStream(['data: line1\ndata: line2\ndata: line3\n\n']);
    await readSseStream(stream, (_event, data) => {
      received = data;
    });
    expect(received).toBe('line1\nline2\nline3');
  });

  it('忽略注释行(以 : 开头)', async () => {
    const events: string[] = [];
    const stream = makeStream([': this is a comment\ndata: payload\n\n']);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual(['payload']);
  });

  it('默认 event 名为 message(无 event: 行)', async () => {
    const types: string[] = [];
    const stream = makeStream(['data: hello\n\n']);
    await readSseStream(stream, (event, _data) => {
      types.push(event);
    });
    expect(types).toEqual(['message']);
  });

  it('处理跨 chunk 的事件(行被分片)', async () => {
    const events: string[] = [];
    const stream = makeStream(['event: mes', 'sage\ndata: {"a":1}', '\n\n']);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual(['{"a":1}']);
  });

  it('兼容 CRLF 行尾', async () => {
    const events: string[] = [];
    const stream = makeStream(['event: message\r\ndata: ok\r\n\r\n']);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual(['ok']);
  });

  it('已 abort 的 signal 立即退出,不读取任何事件', async () => {
    const abortController = new AbortController();
    abortController.abort();
    const stream = makeStream(['data: never\n\n']);
    const events: string[] = [];
    await readSseStream(
      stream,
      (_event, data) => { events.push(data); },
      abortController.signal,
    );
    expect(events).toHaveLength(0);
  });

  it('空流(无事件)正常结束', async () => {
    const events: string[] = [];
    const stream = makeStream(['']);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual([]);
  });

  it('只有注释行不产生事件', async () => {
    const events: string[] = [];
    const stream = makeStream([': comment1\n: comment2\n\n']);
    await readSseStream(stream, (_event, data) => {
      events.push(data);
    });
    expect(events).toEqual([]);
  });
});
