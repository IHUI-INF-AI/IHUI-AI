// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 第三方 OAuth 平台品牌色唯一真相源(2026-09-06 立)。
 *
 * 背景:mobile-rn 登录页第三方平台按钮此前硬编码各平台品牌色(微信/Google/GitHub/
 *       飞书/钉钉/企业微信/支付宝),web 端用官方彩色 SVG 图标(品牌色内嵌资源)。
 *       为满足"全项目唯一 token / 不允许硬编码",将 RN 端第三方登录按钮品牌色
 *       收编为本文件常量,RN 端与共享登录组件统一 import,消除登录页品牌色硬编码。
 *
 * 说明:
 *   - 本组色为**平台品牌身份色**,明暗主题恒定(不随 colorScheme 变化),与 data 区分色
 *     (chart/SWARM_ROLE 等)同类豁免 token,不并入黑/白语义 token。
 *   - Apple 登录无单色品牌色,RN 端用主题黑白(light 黑 / dark 白),因此本文件只覆盖
 *     7 个有色平台;Apple 由消费方用 tokens.gray.black / surface.light 传入。
 *   - 微信绿统一为官方品牌绿 #07C160(登录按钮/图标网格一致)。既有 --color-wechat-green
 *     (#4cd964) 为语义绿(消息气泡等),语义不同,保留不动,勿混淆。
 */

/** 各平台品牌色(键对齐 @ihui/types ThirdPartyPlatform 变更集,仅含"有色"平台)。 */
export const OAUTH_BRAND_COLORS: Readonly<Record<string, string>> = {
  wechat: '#07C160',
  google: '#4285F4',
  github: '#181717',
  feishu: '#3370FF',
  dingtalk: '#0089FF',
  enterpriseWechat: '#2DC100',
  alipay: '#1677FF',
} as const