// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通用异步高亮双缓存 + 微任务订阅通知(2026-09-30 立,吸收批次 b74-W4 票 G-977984)。
 *
 * 吸收判据(机制与语言无关,高亮器由调用方注入,本模块不绑定具体高亮库):
 * - 两级缓存:高亮器实例 promise 缓存(按 lang:theme)+ tokens 结果缓存
 *   (key = theme:lang:codeLen:head100:tail100,头尾 100 字符 + 长度近似全文指纹);
 * - cache hit 也要 queueMicrotask 后再回调:同步回调会把缓存命中变成嵌套更新,
 *   与流式重渲染/历史恢复批量挂载叠加时触发 React #185 告警;
 * - 纯文本/日志语言直接返回 raw tokens,不进高亮状态机(无收益还拖渲染);
 * - 高亮器加载失败停在 rawTokens 不重试(失败的 promise 在实例缓存里粘住,
 *   后续同 lang:theme 请求不再触发加载,组件停在无高亮兜底态);
 * - tokens 缓存有界(FIFO 淘汰,默认 200 条),防长会话无界增长。
 */

/** 渲染用 token 模型:一行一个 token 数组,颜色可缺省(继承前景色)。 */
export interface HighlightToken {
  content: string
  color?: string
}

export interface HighlightedCode {
  tokens: HighlightToken[][]
  fg: string
  bg: string
}

/** 注入式高亮器:loadHighlighter 拿实例(可抛错),tokenize 在实例上做真正的分词。 */
export interface AsyncHighlightLoader {
  loadHighlighter: (language: string, theme: string) => Promise<unknown>
  tokenize: (
    highlighter: unknown,
    code: string,
    language: string,
    theme: string,
  ) => { tokens: HighlightToken[][]; fg?: string }
  /** 可选语言支持判定;返回 false 视同纯文本,直接走 raw tokens。 */
  isSupportedLanguage?: (language: string) => boolean
}

export interface AsyncHighlightCacheOptions extends AsyncHighlightLoader {
  /** tokens 缓存条数上限,超出 FIFO 淘汰最早;默认 200。 */
  tokensCacheLimit?: number
}

/** 无高亮收益的语言:直接 raw tokens,不启动 loader。 */
const PLAIN_TEXT_CODE_LANGUAGES = new Set([
  '',
  'text',
  'txt',
  'plain',
  'plaintext',
  'log',
  'output',
]);

export function shouldBypassSyntaxHighlighting(language: string): boolean {
  return PLAIN_TEXT_CODE_LANGUAGES.has(language.trim().toLowerCase());
}

/** 无高亮兜底态:整段按单色行 token 返回。 */
export function createRawCodeTokens(code: string): HighlightedCode {
  return {
    bg: 'transparent',
    fg: 'inherit',
    tokens: code.split('\n').map((line) =>
      line === ''
        ? []
        : [
            {
              color: 'inherit',
              content: line,
            },
          ],
    ),
  };
}

function getCodeTokensCacheKey(code: string, language: string, theme: string): string {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : '';
  return `${theme}:${language}:${code.length}:${start}:${end}`;
}

export interface AsyncHighlightCache {
  /**
   * 带缓存的异步高亮入口;React 组件只应在 effect 中调用。
   * 返回 null 表示结果未就绪(回调稍后送达);纯文本语言与缓存命中同步返回结果
   * (但缓存命中的回调仍推迟到微任务,见头部判据)。
   */
  highlight: (
    code: string,
    language: string,
    theme: string | undefined,
    callback?: (result: HighlightedCode) => void,
  ) => HighlightedCode | null;
  /** 内存诊断口:tokens 缓存当前条数。 */
  getTokensCacheSize: () => number;
  /** 测试/重置用:清空两级缓存与订阅。 */
  __clear: () => void;
}

export function createAsyncHighlightCache(options: AsyncHighlightCacheOptions): AsyncHighlightCache {
  const { loadHighlighter, tokenize, isSupportedLanguage } = options;
  const tokensCacheLimit = Math.max(1, options.tokensCacheLimit ?? 200);

  const highlighterCache = new Map<string, Promise<unknown>>();
  const tokensCache = new Map<string, HighlightedCode>();
  const subscribers = new Map<string, Set<(result: HighlightedCode) => void>>();
  // 分词在飞去重:同 key 并发请求共享同一条 tokenize 链,不重复分词。
  const pendingTokenize = new Map<string, Promise<void>>();

  /** 失败粘住:rejected promise 留在缓存里,后续同 key 请求不再重新加载(不重试)。 */
  const getHighlighterPromise = (language: string, theme: string): Promise<unknown> => {
    const cacheKey = `${theme}:${language}`;
    const cached = highlighterCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const promise = loadHighlighter(language, theme);
    highlighterCache.set(cacheKey, promise);
    return promise;
  };

  const setTokensCacheEntry = (cacheKey: string, value: HighlightedCode): void => {
    if (!tokensCache.has(cacheKey) && tokensCache.size >= tokensCacheLimit) {
      const oldest = tokensCache.keys().next();
      if (!oldest.done) {
        tokensCache.delete(oldest.value);
      }
    }
    tokensCache.set(cacheKey, value);
  };

  const highlight: AsyncHighlightCache['highlight'] = (code, language, theme, callback) => {
    const normalizedLanguage = language.trim().toLowerCase();
    const resolvedTheme = theme ?? 'default';

    // 纯文本/日志代码块没有高亮收益,却会把渲染拖进异步状态机;直接返回 raw tokens。
    if (shouldBypassSyntaxHighlighting(normalizedLanguage)) {
      return createRawCodeTokens(code);
    }
    if (isSupportedLanguage && !isSupportedLanguage(normalizedLanguage)) {
      return createRawCodeTokens(code);
    }

    const tokensCacheKey = getCodeTokensCacheKey(code, normalizedLanguage, resolvedTheme);
    const cached = tokensCache.get(tokensCacheKey);
    if (cached) {
      // 缓存命中也要通知 effect,但不能同步触发 setState:历史消息恢复时大量代码块
      // 在同一次提交后挂载,同步 callback 会把 cache-hit 变成嵌套更新(React #185)。
      if (callback) {
        queueMicrotask(() => callback(cached));
      }
      return cached;
    }

    if (callback) {
      let subs = subscribers.get(tokensCacheKey);
      if (!subs) {
        subs = new Set();
        subscribers.set(tokensCacheKey, subs);
      }
      subs.add(callback);
    }

    // 已有同 key 的分词在飞:只挂订阅,不重复发起 tokenize。
    if (!pendingTokenize.has(tokensCacheKey)) {
      const pending = getHighlighterPromise(normalizedLanguage, resolvedTheme)
        .then((highlighter) => {
          const result = tokenize(highlighter, code, normalizedLanguage, resolvedTheme);
          const tokenized: HighlightedCode = {
            bg: 'transparent',
            fg: result.fg ?? 'inherit',
            tokens: result.tokens,
          };
          setTokensCacheEntry(tokensCacheKey, tokenized);
          const subs = subscribers.get(tokensCacheKey);
          if (subs) {
            for (const sub of subs) {
              sub(tokenized);
            }
          }
          subscribers.delete(tokensCacheKey);
        })
        .catch((error: unknown) => {
          // 加载/分词失败:组件停留在 rawTokens 兜底态;实例 promise 已粘住失败,不重试。
          console.warn(
            `[async-highlight-cache] 高亮失败: language=${normalizedLanguage}, theme=${resolvedTheme}`,
            error,
          );
          subscribers.delete(tokensCacheKey);
        });
      pendingTokenize.set(tokensCacheKey, pending);
      pending.finally(() => pendingTokenize.delete(tokensCacheKey));
    }

    return null;
  };

  return {
    highlight,
    getTokensCacheSize: () => tokensCache.size,
    __clear: () => {
      highlighterCache.clear();
      tokensCache.clear();
      subscribers.clear();
      pendingTokenize.clear();
    },
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
