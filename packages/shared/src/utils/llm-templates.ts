/**
 * Provider → LLM 平台模板代码映射
 *
 * 用途:model-selector / 模型广场页根据 model vendor 字段,
 *       判断该模型所属厂商是否在「LLM 配置中心」里有预置模板可以一键配置。
 *
 * 平台模板定义在 apps/api/src/routes/platform-templates.ts,共 15+ 预置。
 *  - openai / anthropic / google / deepseek / moonshot / zhipu / alibaba / baidu /
 *    bytedance / stepfun / groq / openrouter / ollama / lmstudio / custom
 *
 * 映射原则:
 *  - 1:1 直接命中(大多数情况):openai ↔ openai, deepseek ↔ deepseek ...
 *  - 厂商别名合并:qwen ↔ alibaba, doubao ↔ bytedance, kimi ↔ moonshot, wenxin ↔ baidu,
 *    glm ↔ zhipu, glm-4 ↔ zhipu
 *  - 平台型 provider(如 openrouter/bedrock/azure)直接命中同名模板
 *  - 无预置模板的厂商返回 null(UI 引导用户到"自定义"模板自填 baseUrl)
 */
const VENDOR_TO_TEMPLATE: Record<string, string> = {
  // === 国际原厂(直接命中)===
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  deepseek: 'deepseek',
  // === 国内原厂(别名合并)===
  qwen: 'alibaba', // 通义千问 → alibaba dashscope
  zhipu: 'zhipu', // 智谱 GLM
  chatglm: 'zhipu',
  glm: 'zhipu',
  moonshot: 'moonshot', // 月之暗面 Kimi
  kimi: 'moonshot',
  doubao: 'bytedance', // 字节豆包
  bytedance: 'bytedance',
  stepfun: 'stepfun', // 阶跃星辰
  wenxin: 'baidu', // 百度文心
  baidu: 'baidu',
  // === 国际推理平台(直接命中)===
  groq: 'groq',
  openrouter: 'openrouter',
  // === 云平台/聚合 ===
  bedrock: 'openai', // Bedrock 走 OpenAI 兼容
  azure: 'openai', // Azure OpenAI 走 OpenAI 兼容
  // === 本地 ===
  ollama: 'ollama',
  openwebui: 'ollama', // OpenWebUI 兼容 Ollama / OpenAI
  lmstudio: 'lmstudio',
  local: 'ollama', // 通用 local 默认按 Ollama 走
  // === 无预置模板的厂商(返回 null,UI 提示用自定义模板)===
  // meta / mistral / xai / cohere / nvidia / ai21 / microsoft / perplexity / ...
  // together / fireworks / huggingface / replicate / stability / inflection / ibm
  // cerebras / sambanova / snowflake / deepinfra / alephalpha / nous / vertexai
  // gemma / copilot / bing / novita / lambda / baseten / crusoe / targon / centml
  // nebius / upstage / leptonai / hyperbolic / featherless / parasail / friendli
  // anyscale / infermatic / replit / siliconcloud / modelscope / ppio / volcengine
  // bailian / baai / tii / liquid / ai2 / baichuan / spark / yi / sensenova / skywork
  // internlm / minimax / hunyuan
}

/**
 * 把模型 vendor / model.id 转换为 LLM 平台模板 code。
 *  - 优先使用入参 vendor(provider 字段)
 *  - 兜底用 model id 推断(从 brand-icon 的 inferVendor 也可复用)
 *
 * 返回 null 表示该厂商在「LLM 配置中心」没有预置模板,
 * UI 应当引导用户到「自定义平台」自填 baseUrl。
 */
export function providerToTemplateCode(vendor: string | null | undefined): string | null {
  if (!vendor) return null
  return VENDOR_TO_TEMPLATE[vendor.toLowerCase()] ?? null
}

/**
 * 判断某个 provider 是否有预置模板(用于 UI 决定显示"一键配置"还是"自定义"按钮)
 */
export function hasPresetTemplate(vendor: string | null | undefined): boolean {
  return providerToTemplateCode(vendor) !== null
}
