# @ihui/sdk

IHUI-AI 官方 TypeScript SDK(OpenAI 兼容)。

## 安装

```bash
npm install @ihui/sdk
```

## 用法

```ts
import { IhuiClient } from '@ihui/sdk';
const client = new IhuiClient('https://api.aizhs.top', 'your-api-key');
const resp = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好' }],
});
console.log(resp.choices[0].message.content);
const models = await client.models.list();
```

HTTP 4xx/5xx 抛 `IhuiError`(含 status + body)。骨架版本,后续真发布时补实现。
