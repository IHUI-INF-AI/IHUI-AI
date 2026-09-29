// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 不受信文档链接净化器(2026-09-30 立,吸收批次 b74-W4 票 G-977972)。
 *
 * 场景:渲染不受信来源生成的 HTML(文档预览、富文本导入等)时,文档内的
 * `<a href>` / `<a xlink:href>` 可能携带任意协议。吸收判据:
 * - 只放行 http/https 外链与当前文档内部锚点(#),其余协议一律降级为不可点文本;
 * - `java\nscript:` 这类用控制字符伪装的 scheme 先拒不修(逐字符判断,
 *   避免安全正则自身触发 no-control-regex lint);
 * - DOM 写入后统一净化 + 点击代理阻断,双保险(统一净化覆盖不了运行期再写入的属性);
 * - 外链绝不直接导航主 renderer,统一交给受控打开入口回调;
 * - MutationObserver 只扫描实际新增的子树(分批挂载大文档曾每批 O(全树) 重复扫描)。
 */

/**
 * 判定不受信 href 能否安全写入 DOM。
 * 返回净化后的值(内部锚点原样 / 外链 trim 后原样),不可点时返回 null。
 */
export function sanitizeDocumentHref(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const href = value.trim();
  if (!href) {
    return null;
  }

  // 控制字符可以把 `java\nscript:` 伪装成看似普通的协议;先拒绝而不是尝试修复。
  // 逐字符判断,避免安全正则本身触发 lint 的 no-control-regex 警告。
  for (const character of href) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return null;
    }
  }

  // 文档内部锚点:只放行非空且不含危险字符的形态,交给浏览器默认滚动行为。
  if (href.startsWith("#")) {
    return href.length > 1 && !/[\s<>"']/.test(href) ? href : null;
  }

  // 外链只认 http/https;scheme 用小写比较,防 `JAVASCRIPT:` 大小写形态绕过。
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    return null;
  }

  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

/** 锚点上允许出现的链接属性(HTML href 与 SVG 的 xlink:href 都收口)。 */
const LINK_TARGET_ATTRIBUTES = ["href", "xlink:href"] as const;

/** 就地净化单个锚点元素:不安全属性摘除并降级可点性,安全但形态不同的属性改写。 */
function sanitizeLinkElement(element: Element): void {
  for (const attribute of LINK_TARGET_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value === null) {
      continue;
    }

    const safeHref = sanitizeDocumentHref(value);
    if (safeHref === null) {
      element.removeAttribute(attribute);
      if (element.tagName.toLowerCase() === "a") {
        // HTML a 与 SVG a 都支持 setAttribute;用 aria-disabled 标记不可点。
        element.setAttribute("aria-disabled", "true");
      }
      continue;
    }

    if (safeHref !== value) {
      element.setAttribute(attribute, safeHref);
    }
  }
}

/** 净化一个子树内全部锚点(含子树根自身是锚点的情况)。 */
function sanitizeLinkTree(root: ParentNode): void {
  if (root instanceof Element && root.tagName.toLowerCase() === "a") {
    sanitizeLinkElement(root);
  }
  root.querySelectorAll("a").forEach(sanitizeLinkElement);
}

/**
 * 为文档渲染容器安装统一的 DOM 净化与点击阻断;返回卸载函数。
 * - 挂载时先对现有子树做一次全量净化;
 * - 点击阶段做第二道保险:安全外链交受控打开入口回调,内部锚点放行默认行为,
 *   其余一律 preventDefault(覆盖运行期绕过统一净化直接写入的属性);
 * - 后续新增子树只增量扫描,不再全树重复查询。
 */
export function installDocLinkSanitizer(
  root: HTMLElement,
  onOpenExternalUrl?: (url: string) => void,
): () => void {
  const handleClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!target) {
      return;
    }

    const safeHref = sanitizeDocumentHref(
      target.getAttribute("href") ?? target.getAttribute("xlink:href"),
    );
    if (safeHref === null) {
      event.preventDefault();
      return;
    }
    if (safeHref.startsWith("#")) {
      return;
    }

    // 文档外链不能直接导航主 renderer;统一交给受控打开入口。
    event.preventDefault();
    onOpenExternalUrl?.(safeHref);
  };

  sanitizeLinkTree(root);
  root.addEventListener("click", handleClick);

  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver((records) => {
          const addedRoots = new Set<ParentNode>();
          for (const record of records) {
            if (record.type === "attributes" && record.target instanceof Element) {
              sanitizeLinkElement(record.target);
              continue;
            }
            record.addedNodes.forEach((addedNode) => {
              if (addedNode instanceof Element || addedNode instanceof DocumentFragment) {
                addedRoots.add(addedNode);
              }
            });
          }
          // 第三方 renderer 分批挂载或虚拟化重挂载时,每批 mutation 都曾扫描完整
          // 预览 DOM,大文档重复 O(全树) 查询;这里只扫描实际新增的子树。
          addedRoots.forEach(sanitizeLinkTree);
        });

  observer?.observe(root, {
    attributeFilter: ["href", "xlink:href"],
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => {
    observer?.disconnect();
    root.removeEventListener("click", handleClick);
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
