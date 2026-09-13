-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
-- [IHUI-AI-PROVENANCE]:

-- P0 计费修复(2026-09-13):llm_call_logs.provider_code 32 → 64
-- 背景:渠道直连(2026-09-12 立)success 路径把 ai_relay_key_pool.provider_code(varchar(64))
--   原样写入 llm_call_logs.provider_code(varchar(32)),provider_code 超 32 字符的渠道
--   (如自定义上游池)insert 报 value too long,被 recordCall 顶层 catch 吞掉,
--   导致:成功调用不落 llm_call_logs、costUsedTotalCents/tokenUsedTotal 不累计(计费全丢)。
--   error 路径用 modelToProviderCode() 短码(≤16 字符)不受影响,故只丢 success。
-- 修复:列宽对齐到 64(与 ai_relay_key_pool.provider_code / ai_relay_discovery.provider_code 一致)。
-- 幂等:ALTER TYPE 重复执行无副作用;varchar 扩宽不重写表,瞬间完成。

ALTER TABLE llm_call_logs ALTER COLUMN provider_code TYPE varchar(64);
