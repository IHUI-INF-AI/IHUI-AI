// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 宿主能力节点(仅小程序消费,不上收共享屏):
// - 实名验证弹层:FocusInput(微信身份证键盘) + api.realNameAuth 提交;RN 走独立 RealNameAuth 页,web 无此路由;
// - 微信分享按钮:<Button openType="share"> 无 Taro 程序化替代,共享屏只接收 shareAction 节点。
import { Button, Image, Text, View } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'

export interface VerifySheetProps {
  title: string
  avatar: string
  initial: string
  idPlaceholder: string
  namePlaceholder: string
  idValue: string
  nameValue: string
  copyright: string
  confirmLabel: string
  onInputId: (value: string) => void
  onInputName: (value: string) => void
  onConfirm: () => void
}

/** 实名验证折叠弹层(原 pages/distribution/index.tsx 的仅小程序弹层,原样下沉宿主模块) */
export function renderVerifySheet(props: VerifySheetProps) {
  return (
    <View className="dist-mask">
      <View className="dist-verify">
        <View className="dist-verify-header">
          <Text className="dist-verify-title">{props.title}</Text>
        </View>
        <View className="dist-verify-avatar">
          {props.avatar ? (
            <Image className="dist-verify-avatar-img" src={props.avatar} mode="aspectFill" />
          ) : (
            <View className="dist-verify-avatar-img dist-person-placeholder">
              <Text>{props.initial}</Text>
            </View>
          )}
        </View>
        <FocusInput
          className="dist-verify-input"
          placeholder={props.idPlaceholder}
          value={props.idValue}
          onInput={(e) => props.onInputId(e.detail.value)}
        />
        <FocusInput
          className="dist-verify-input"
          placeholder={props.namePlaceholder}
          value={props.nameValue}
          onInput={(e) => props.onInputName(e.detail.value)}
        />
        <Text className="dist-verify-copyright">{props.copyright}</Text>
        <View className="dist-verify-btn" onClick={props.onConfirm} hoverClass="opacity-60">
          <Text>{props.confirmLabel}</Text>
        </View>
      </View>
    </View>
  )
}

/** 微信原生分享按钮(open-type=share),注入共享屏 qrSheet.shareAction */
export function renderWxShareButton(label: string) {
  return (
    <Button className="dist-qrpop-btn" openType="share">
      {label}
    </Button>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
