/**
 * RecruitmentScreen 操盘手计划页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/recruitment/index.vue(84 行纯静态宣传页):
 * - 全屏背景大图(recruitment/bigtp@2x.png)
 * - 顶部居中标题「操盘手计划」(白色 32rpx)
 * - 底部渐变卡片(type-bottom-top):创始人头像 + 「AI智汇社 | 私董会创始人 | 李总」+ 推荐语
 * - 棕色介绍文案:扫描二维码免费进社群
 * - 社群二维码(ewm@2x.png,380rpx)
 * - 「购买¥18888」渐变按钮(红→紫)
 * - 原页面无任何 JS 逻辑(纯静态),购买按钮点击提示联系客服
 *
 * 注:历史版本曾把本路由误实现为招聘列表(getAiCareers)——招聘属另一功能,
 * 本路由语义为操盘手计划宣传页,已恢复对齐原项目。
 */
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useI18n } from '../i18n'
import { rpx } from '../utils/rpx'

/** 原页面图片资源(CDN,与 Uniapp 一致) */
const BG_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/bigtp@2x.png'
const AVATAR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/xuancai@2x.png'
const QR_IMAGE =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/recruitment/ewm@2x.png'

export default function RecruitmentScreen() {
  const { t } = useI18n()

  const handleBuy = (): void => {
    // 原页面为纯静态展示,购买按钮无绑定逻辑;APP 端提示联系客服完成购买
    Alert.alert(t('common.hint'), '请联系客服购买操盘手计划服务')
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: BG_IMAGE }} style={styles.bgImage} resizeMode="cover" />
      <Text style={styles.title}>操盘手计划</Text>

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

        <View style={styles.buyWrap}>
          <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.85}>
            <Text style={styles.buyText}>购买¥18888</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  } as ImageStyle,
  title: {
    position: 'absolute',
    top: rpx(20),
    left: 0,
    right: 0,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  } as TextStyle,
  bottom: {
    position: 'absolute',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: rpx(10),
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
    fontSize: 15,
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
  buyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: rpx(30),
  } as ViewStyle,
  buyBtn: {
    width: 125,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#EA5252',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  buyText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
  } as TextStyle,
})
