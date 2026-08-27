/**
 * CarteScreen 社群宣传卡页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/carte/index.vue(82 行纯静态宣传卡,无 JS 逻辑):
 * - 白底全屏(type-container background #fff)
 * - 顶部渐变卡(type-bottom-top,#f4f4fb → #9395e4,上圆角 30rpx):
 *   头像(100rpx) + 「AI智汇社 | 私董会创始人 | 李总」(34rpx bold black) + 「为您推荐」
 * - 棕色介绍文字(32rpx bold):扫描二维码免费进智汇社社群
 * - 社群二维码(ewm@2x.png,380rpx)
 * - 购买按钮在原页面为注释状态,不复刻
 *
 * 注:历史版本曾把本路由误实现为「创作者名片」(getAgents/getProfile)——本路由
 * 语义为社群宣传卡,已按用户确认「跟原来一样」恢复对齐原项目。
 */
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rpx } from '../utils/rpx'

/** 原页面图片资源(CDN,与 Uniapp 一致) */
const AVATAR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/xuancai@2x.png'
const QR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/ewm@2x.png'

export default function CarteScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.bottom}>
        <View style={styles.bottomTop}>
          <View>
            <Image source={{ uri: AVATAR_IMAGE }} style={styles.avatar} resizeMode="cover" />
          </View>
          <View style={styles.bottomTopText}>
            <Text style={styles.founder}>AI智汇社 | 私董会创始人 | 李总</Text>
            <Text style={styles.recommend}>为您推荐</Text>
          </View>
        </View>

        <Text style={styles.intro}>
          扫描下方二维码,可免费进入智汇社社群,群内定期免费分享AI信息并有专属客服为您服务
        </Text>

        <View style={styles.qrWrap}>
          <Image source={{ uri: QR_IMAGE }} style={styles.qr} resizeMode="cover" />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  } as ViewStyle,
  bottom: {
    position: 'absolute',
    top: rpx(100),
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: rpx(30),
    paddingBottom: rpx(60),
  } as ViewStyle,
  bottomTop: {
    paddingHorizontal: rpx(30),
    paddingVertical: rpx(10),
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: '#9395E4',
  } as ViewStyle,
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  } as ImageStyle,
  bottomTopText: {
    flex: 1,
    paddingLeft: rpx(24),
  } as ViewStyle,
  founder: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: rpx(12),
  } as TextStyle,
  recommend: {
    fontSize: 13,
    color: '#333333',
    marginTop: 2,
  } as TextStyle,
  intro: {
    marginTop: rpx(20),
    paddingHorizontal: rpx(40),
    color: '#A52A2A',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  } as TextStyle,
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rpx(16),
  } as ViewStyle,
  qr: {
    width: 190,
    height: 190,
  } as ImageStyle,
})
