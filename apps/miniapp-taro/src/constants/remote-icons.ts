// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 原项目 zhs_app-ZZ 远程图库共享图标注册表(2026-07-30 立,原登记 290 个唯一 URL)
 *
 * 来源:扫描原项目 src 全部 .vue/.js/.ts/.scss/.css/.json,提取 file.aizhs.top 与
 * bspapp.com 远程图库 URL 引用。G-924 收口轮(2026-10-23)按 "全仓 HEAD 面零消费方"
 * 判据现读全表 290 条,只保留 32 条被真实引用的键,其余 258 条(含所有仅原型有、
 * 本仓无对应页面/组件的图标)整体撤除;后续新增键必须带消费方,判据锁见文件尾注。
 *
 * 本地副本:apps/miniapp-taro/src/assets/remote/(经 config/index.ts copy 规则打进包 /remote-images/)。
 * 匹配策略:URL path 精确匹配 → basename 匹配本地副本;未命中则直接用远程 URL。
 *
 * 使用方式:
 *   import { REMOTE_ICONS, icon, getRemoteIcon } from '@/constants/remote-icons';
 *   <Image src={icon('empty')} />
 *   <Image src={REMOTE_ICONS.king!} />
 *   const src = getRemoteIcon('search');
 */

import { aizhsUrl, bspappUrl } from '@/constants/icon-urls'

const modelIcon = aizhsUrl('remote-images/model.png')
const erweimaIcon = aizhsUrl('remote-images/erweima.png')
const emptyIcon = aizhsUrl('remote-images/empty.png')
const tishiIconIcon = aizhsUrl('remote-images/tishi_icon.png')
const searchIcon = aizhsUrl('remote-images/search.svg')
const sqb20250816161049a277Icon = aizhsUrl('remote-images/sqb_20250816161049A277.png')
const qqb20250816161046a276Icon = aizhsUrl('remote-images/qqb_20250816161046A276.png')
const szdy20250816161421a290Icon = aizhsUrl('remote-images/szdy_20250816161421A290.png')
const qzdy20250816161419a289Icon = aizhsUrl('remote-images/qzdy_20250816161419A289.png')
const shoucangIcon = aizhsUrl('remote-images/shoucang.png')
const hotIcon = aizhsUrl('remote-images/hot.png')
const defaultMingpian2Icon = aizhsUrl('remote-images/default/mingpian.png')
const addTextIcon = aizhsUrl('remote-images/add/text.svg')
const addPicterIcon = aizhsUrl('remote-images/add/picter.svg')
const addVideoIcon = aizhsUrl('remote-images/add/video.svg')
const addAudioIcon = aizhsUrl('remote-images/add/audio.svg')
const videoIconIcon = aizhsUrl('remote-images/video_icon.png')
const yinpinIconIcon = aizhsUrl('remote-images/icon-yinpin.png')

// 2026-08-27 恢复:原 CDN(file.aizhs.top / bspapp)已退服,从原项目源码
// (D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue)找回的图标,拷贝至本地副本
// (经 config/index.ts copy 规则打包进小程序包 /remote-images/ 目录)
const kingLocalIcon = aizhsUrl('remote-images/king.png')

/**
 * 远程图标注册表:name → 资源路径(本地 import 或远程 URL)
 *
 * G-924 收口(立票@2026-10-21,2026-10-23 二次收口):原票点名 10 条线上取不到的 URL
 * 已在 2026-10-22 撤除;本轮按 "全仓 HEAD 面零消费方 ⇒ 死键" 判据现读注册表全部 290 条,
 * 消费方形态覆盖:icon('KEY') 字面量、REMOTE_ICONS.KEY / ICONS.KEY(含 history.tsx /
 * special.tsx 的类型收窄别名)、REMOTE_ICONS['KEY']。命中 32 条保留,其余 258 条零引用
 * 一并撤除;连带摘掉 90 条不再被任何保留条目引用的 const 定义。判据接线锁:
 * apps/miniapp-taro/tests/remote-icons-no-dead-keys.test.ts(新增死键即红,不再靠人工现测)。
 * §7 三问逐条:①承载功能 = 无(零引用),②等价实现不适用,③不存在不可删情形。
 */
export const REMOTE_ICONS: Record<string, string> = {
  king: kingLocalIcon,
  model: modelIcon,
  erweima: erweimaIcon,
  privateadvisory: aizhsUrl('sys-mini/privateadvisory.png'),
  message: bspappUrl('tabbar/home/xia/message.png'),
  fufei: bspappUrl('tabbar/course/fufei.png'),
  jiqirenBig: bspappUrl('tabbar/ai_agent/jiqiren-big.png'),
  empty: emptyIcon,
  aimusic: aizhsUrl('sys-mini/xtk/aimusic.png'),
  aitext: aizhsUrl('sys-mini/xtk/aiText.png'),
  tishiIcon: tishiIconIcon,
  aiVideo: bspappUrl('tabbar/home/zhong/ai-video.png'),
  jiqiren: bspappUrl('tabbar/home/second/jiqiren.png'),
  search: searchIcon,
  imageOr: aizhsUrl('sys-mini/xtk/image_or.png'),
  plazaIcon01: aizhsUrl('sys-mini/xtk/plaza_icon01.png'),
  sqb20250816161049a277: sqb20250816161049a277Icon,
  qqb20250816161046a276: qqb20250816161046a276Icon,
  szdy20250816161421a290: szdy20250816161421a290Icon,
  qzdy20250816161419a289: qzdy20250816161419a289Icon,
  shoucang: shoucangIcon,
  hot: hotIcon,
  gold: aizhsUrl('sys-mini/default/gold.png'),
  xing: aizhsUrl('sys-mini/default/xing.png'),
  zuan: aizhsUrl('sys-mini/default/zuan.png'),
  defaultMingpian2: defaultMingpian2Icon,
  addText: addTextIcon,
  addPicter: addPicterIcon,
  addVideo: addVideoIcon,
  addAudio: addAudioIcon,
  videoIcon: videoIconIcon,
  yinpinIcon: yinpinIconIcon,
}

/**
 * 按名称获取远程图标资源路径(严格 string 返回,缺省返回 '')。
 *
 * 配合 `noUncheckedIndexedAccess: true` 使用,避免调用方再处理 undefined。
 * 用途:在 <Image src={...}> 等要求严格 string 的 JSX 属性中安全取值。
 *
 * @param name - 注册表 key(如 'back' / 'rankOne')
 * @returns 本地 import 引用或远程 URL;未注册时返回 ''(空串),不会 break UI
 */
export function icon(name: string): string {
  return REMOTE_ICONS[name] ?? ''
}

/**
 * 按名称获取远程图标资源路径(可能 undefined,适合需要显式判空场景)。
 * @param name - 注册表 key(如 'back' / 'rankOne')
 * @returns 本地 import 引用或远程 URL;未注册时返回 undefined
 */
export function getRemoteIcon(name: string): string | undefined {
  return REMOTE_ICONS[name]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
