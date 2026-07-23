import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import './privacy.css'

interface PrivacySection {
  subtitle: string
  paragraphs: Array<{ title?: string; text: string }>
}

export default function PrivacyPage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.privacy.title', '隐私政策') })
  })

  const overviewParagraphs: Array<{ title?: string; text: string }> = [
    {
      title: tt('about.privacy.overviewTitle', '智汇社隐私政策概述'),
      text: tt(
        'about.privacy.overviewP1',
        '"智汇社"(以下简称"我们"或"本公司")深知个人信息对您的重要性以及您对我们的信任之宝贵。为此,我们郑重承诺,将严格依照相关法律法规的规定并参照业界最佳实践,致力于保护您的个人信息及隐私安全。在使用"智汇社"及相关服务前,我们恳请您仔细阅读并全面理解本隐私政策,以便您做出合适的选择。',
      ),
    },
    {
      title: tt('about.privacy.coreTitle', '隐私政策核心要点:'),
      text: tt(
        'about.privacy.coreP1',
        '我们将依法并遵循本隐私政策收集和使用您的信息,不会因您同意本政策而强制捆绑收集非必要个人信息。',
      ),
    },
    {
      text: tt(
        'about.privacy.coreP2',
        '当您使用特定功能或服务时,为保证服务的正常运行我们可能需要收集和使用相关信息。提供,且这不会影响其他功能或服务的使用。',
      ),
    },
    {
      text: tt(
        'about.privacy.coreP3',
        '麦克风、相册(存储)、蓝牙、地图等敏感权限默认处于关闭状态,仅在您明确授权后,为实现特定功能或服务时才会被使用,您随时可以撤回这些授权。即使获得授权,我们也不会在无需要的情况下收集您的信息。',
      ),
    },
    {
      title: tt('about.privacy.detailTitle', '隐私政策详细内容:'),
      text: tt(
        'about.privacy.detailP1',
        '本隐私政策旨在详细阐述我们在个人信息处理方面的各项原则和实践,包括信息的收集、使用、存储、转移(如适用)和保护,以及您如何管理自己的个人信息',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP2',
        '鉴于本政策与您使用我们的服务紧密相关,我们强烈建议您仔细阅读并全面理解本政策内容,特别注意我们以加粗形式提示的关于您个人信息权益的重要条款。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP3',
        '个人信息的收集和使用:我们将明确说明收集信息的类型、目的和方式。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP4',
        'Cookie等同类技术的使用:我们将解释如何使用这些技术来改善您的用户体验和服务质量。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP5',
        '合作方、信息转移和公开:在涉及数据处理的合作方、信息转移和公开方面,我们将严格遵守相关法律法规和合同约定,确保您的信息安全。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP6',
        '个人信息的存储:我们将采取合理的技术和管理措施,确保您的个人信息在存储过程中的安全。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP7',
        '个人信息的安全保护:我们将采取多层次的安全保护措施,防止您的信息被未经授权的访问、使用或泄露。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP8',
        '管理您的个人信息:您将有权访问、更正、删除和限制我们对您个人信息的处理。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP9',
        '未成年人条款:我们将特别关注未成年人的个人信息保护,确保他们的合法权益不受侵犯。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP10',
        '隐私政策的修订和通知:我们将定期审视和更新本隐私政策,并确保及时通知您任何重大变更。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP11',
        '联系我们:如果您有任何疑问或建议,欢迎随时与我们联系。我们将竭诚为您服务。',
      ),
    },
    {
      text: tt(
        'about.privacy.detailP12',
        '请您在充分了解并同意本隐私政策后,再使用"智汇社"及相关服务。我们衷心感谢您的信任与支持,并承诺将持续努力提升个人信息保护水平,为您提供更加安全、可靠的服务。',
      ),
    },
  ]

  const sections: PrivacySection[] = [
    {
      subtitle: tt('about.privacy.s1.title', '1.关于个人信息的收集与使用'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s1.p0',
            '我们将遵循以下方式,收集用户在使用服务时主动提供的信息,以及通过自动化手段收集用户在使用功能或接受服务过程中产生的信息:',
          ),
        },
        {
          title: tt('about.privacy.s1.t1', '1.1注册与登录'),
          text: tt(
            'about.privacy.s1.p1',
            '在用户注册、登录"智汇社"及相关服务时,我们将通过以下方式收集信息: 用户可通过手机号创建账号。手机号码是为满足国家法律法规关于网络实名制的要求所必需的信息,若用户不提供手机号码,某些功能(如AI对话)可能无法提供。用户可使用第三方账号登录"智汇社"。在此情况下我们将获取用户在第三方平台注册的公开信息(如头像、昵称等),用于账号绑定和服务提供,但需经用户明确同意。',
          ),
        },
        {
          title: tt('about.privacy.s1.t2', '1.2智能对话服务'),
          text: tt(
            'about.privacy.s1.p2',
            '我们基于生成式人工智能模型提供对话及互动服务,并可能需要收集以下信息: 用户主动输入的文字、语音内容,以及使用模型时的行为信息(如点击、浏览记录等)。 用户反馈(如点赞、反馈提交等),以改进服务质量。在严格遵循安全加密和去标识化原则的前提下,我们可能会将上述数据用于模型训练和优化。若用户不希望其数据被用于此目的,可通过本隐私政策提供的联系方式与我们联系并要求撤回。 当用户输入图片或语音时,我们会请求相应的相机、相册或麦克风权限。若用户拒绝授权,相关功能将无法使用,但不影响其他功能的正常使用。 在需要地理位置信息以提供精准服务时,我们会请求用户授权获取地理位置信息。精确地理位置信息属于个人敏感信息,拒绝授权将影响定位准确性,但不影响其他功能的正常使用。',
          ),
        },
        {
          title: tt('about.privacy.s1.t3', '1.3智能搜索服务'),
          text: tt(
            'about.privacy.s1.p3',
            '为提供实时搜索结果,我们可能会收集和分析用户主动输入的信息,并可能根据用户地理位置提供相关搜索结果。',
          ),
        },
        {
          title: tt('about.privacy.s1.t4', '1.4 用户反馈与服务改进'),
          text: tt(
            'about.privacy.s1.p4',
            '我们可能会保存用户的通信/通话记录及相关内容,以便与用户联系、解决问题或记录处理方案。供给相关部门,但法律法规明确禁止提供的除外。此外,我们可能会发送问卷调查以改进服务,但用户有权选择不参与。',
          ),
        },
        {
          title: tt('about.privacy.s1.t5', '1.5 消息通知服务'),
          text: tt(
            'about.privacy.s1.p5',
            '我们可能会通过用户提供的联系方式发送通知(如用户体验调研)。用户可通过短信退订或联系我们退订此类消息。',
          ),
        },
        {
          title: tt('about.privacy.s1.t6', '1.6运营与安全保障'),
          text: tt(
            'about.privacy.s1.p6',
            '为维护服务正常运行、保护用户权益,我们可能会收集必要信息以确保产品与服务的安全稳定运行。这可能包括设备信息、日志信息等,以预防恶意程序、保障运营质量和效率。',
          ),
        },
        {
          title: tt('about.privacy.s1.t7', '1.7 收集、使用个人信息目的变更'),
          text: tt(
            'about.privacy.s1.p7',
            '随着业务发展,我们可能会调整功能和服务。在与原处理目的无直接关联的场景下,我们将重新征得用户同意并说明收集、使用个人信息的目的。',
          ),
        },
        {
          title: tt('about.privacy.s1.t8', '1.8 征得授权同意的例外'),
          text: tt(
            'about.privacy.s1.p8',
            '根据法律法规及国家标准,在某些特定情况下(如履行法定义务、维护公共安全等),我们可能无需事先征得用户同意即可收集和使用个人信息。这些情况在本隐私政策中有详细说明。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s2.title', '2.关于我们如何使用Cookie及同类技术的说明'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s2.p1',
            'Cookie和设备信息标识等同类技术是互联网领域广泛采纳的标准技术。当您使用"智汇社"多个Cookie或匿名标识符。这些技术的目的在于收集、标识和存储您访问及使用本产品时的相关信息。我们郑重承诺,所有Cookie的使用将严格限定在本隐私政策所述的目的范围内,不会用于其他任何用途。',
          ),
        },
        {
          text: tt(
            'about.privacy.s2.p2',
            '我们使用Cookie和同类技术,主要是为了实现以下功能或服务:',
          ),
        },
        {
          title: tt('about.privacy.s2.t1', '2.1 保障产品与服务的安全及高效运行'),
          text: tt(
            'about.privacy.s2.p3',
            '为确保您安全登录服务,并防范盗用、欺诈等不法行为,我们可能会设置用于认证和保障安全性的Cookie或匿名标识符。这些技术还有助于我们提升服务的运行效率,优化登录和响应速度,从而为您提供更为流畅的用户体验。',
          ),
        },
        {
          title: tt('about.privacy.s2.t2', '2.2 提升您的访问便捷性'),
          text: tt(
            'about.privacy.s2.p4',
            '借助这些技术,我们可以为您省去重复填写个人信息、输入搜索内容等繁琐步骤(例如:记录对话历史),使您的访问过程更为轻松便捷。',
          ),
        },
        {
          title: tt('about.privacy.s2.t3', '2.3关于Cookie的清除'),
          text: tt(
            'about.privacy.s2.p5',
            '您有权通过浏览器设置来拒绝或管理Cookie及同类技术。具体操作路径通常如下:进入浏览器的"设置"页面,找到与隐私和安全相关的设置选项,并关闭允许网站保存和读取Cookie的相关功能。请注意,具体的操作步骤可能因浏览器类型而异。但请留意,若您停用Cookie或同类技术,可能会影响到您享受服务的完整性和便捷性,甚至导致某些服务无法正常使用。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s3.title', '3.数据共享、转移与公开'),
      paragraphs: [
        {
          title: tt('about.privacy.s3.t1', '3.1数据共享与合作方'),
          text: tt(
            'about.privacy.s3.p1',
            '在与合作方进行数据共享时,我们始终坚守以下原则: 合法性原则:所有涉及数据共享的合作活动,均须具备明确的合法目的,并严格遵循相关法律法规。 正当性与必要性原则:数据的共享和使用仅限于实现正当目的所必需的最小范围。 安全性与审慎性原则:在评估合作方的数据处理目的及其安全保障能力时,我们将采取谨慎态度,并要求合作方严格遵守双方达成的法律协议。 关于合作方的具体信息,请参阅我们的《第三方信息共享清单》。 在特定场景下,如委托处理或共同处理个人信息,我们将与受托方或共同处理方签订法律协议,明确各自的权利和义务,确保个人信息的安全和合规使用。',
          ),
        },
        {
          title: tt('about.privacy.s3.t2', '3.2 数据转移'),
          text: tt(
            'about.privacy.s3.p2',
            '随着业务的发展,我们可能会涉及合并、收购或资产转让等情形,这可能导致您的个人信息被转移。在此类情况下,我们将确保继受方按照法律法规和本隐私政策的标准继续履行个人信息处理义务。若继受方拟改变原有的处理目的或方式,我们将要求其重新获得您的授权。',
          ),
        },
        {
          title: tt('about.privacy.s3.t3', '3.3 数据公开'),
          text: tt(
            'about.privacy.s3.p3',
            '我们承诺不会随意公开您的个人信息,除非得到您的明确同意或根据法律法规的规定。在公开个人信息时,我们将采取行业内标准的安全保护措施。但在某些特定情况下,如外罚违规账号或欺诈行为时,我们可能会公开相关账号的信息。',
          ),
        },
        {
          title: tt('about.privacy.s3.t4', '3.4 豁免情形'),
          text: tt(
            'about.privacy.s3.p4',
            '请注意,在特定情况下,根据法律法规和国家标准的规定,我们向合作方提供或公开您的个人信息可能无需事先获得您的授权同意。这些情况包括但不限于履行合同所必需、履行法定义务、维护国家安全、应对突发公共卫生事件等。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s4.title', '4.数据存储与安全'),
      paragraphs: [
        {
          title: tt('about.privacy.s4.t1', '4.1存储地点与跨境传输'),
          text: tt(
            'about.privacy.s4.p1',
            '我们遵循法律法规的规定,在中华人民共和国境内存储您的个人信息。目前,我们不会将您的信息传输至境外。若未来涉及跨境传输,我们将严格遵守相关法律法规,并征求您的同意。',
          ),
        },
        {
          title: tt('about.privacy.s4.t2', '4.2 存储期限与删除'),
          text: tt(
            'about.privacy.s4.p2',
            '我们将仅在为提供服务所必需的期间内保留您的个人信息。在您注销账户、主动删除个人信息或超出必要期限后,我们将对您的个人信息进行删除或匿名化处理。但请注意,根据法律法规的要求或出于财务、审计等目的,我们可能需要延长某些信息的存储期限。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s5.title', '5.个人信息安全保护措施'),
      paragraphs: [
        {
          title: tt('about.privacy.s5.t1', '5.1安全保障承诺'),
          text: tt(
            'about.privacy.s5.p1',
            '我们郑重承诺,将用户的个人信息安全视为首要任务。为此,我们将采取一系列合理且必要的安全措施,包括当使用、未经授权的访问、公开披露、篡改、损坏、丢失或泄露。',
          ),
        },
        {
          title: tt('about.privacy.s5.t2', '5.2 加密与匿名技术'),
          text: tt(
            'about.privacy.s5.p2',
            '为确保用户数据的安全,我们将采用行业领先的加密技术和匿名化处理手段。同时,我们还将部署安全保护机制,以抵御潜在的恶意攻击。',
          ),
        },
        {
          title: tt('about.privacy.s5.t3', '5.3 安全管理体系'),
          text: tt(
            'about.privacy.s5.p3',
            '我们已建立完备的安全管理体系,包括专业的安全部门、严格的安全管理制度和流程。我们仅允许授权人员访问用户数据,并定期进行安全审计,以确保数据使用的合规性和安全性。',
          ),
        },
        {
          title: tt('about.privacy.s5.t4', '5.4安全风险提示'),
          text: tt(
            'about.privacy.s5.p4',
            '尽管我们已采取诸多措施并遵循相关法律法规要求,但受限于当前技术和潜在的恶意行为,无法确保信息的百分之百安全。因此,我们强烈建议用户加强自身信息安全防护意识,采取必要措施保护个人账号和密码安全。',
          ),
        },
        {
          title: tt('about.privacy.s5.t5', '5.5 应急处理机制'),
          text: tt(
            'about.privacy.s5.p5',
            '为应对可能发生的信息安全事件,我们已制定详细的应急预案。一旦发生安全事件,我们将立即启动应急响应程序,及时通知用户并采取相应补救措施。我们将通过推送通知、邮件、信函、短信等方式与用户保持沟通,并在必要时按照监管部门要求上报处置情况。',
          ),
        },
        {
          title: tt('about.privacy.s5.t6', '5.6 服务外信息安全'),
          text: tt(
            'about.privacy.s5.p6',
            '请注意,当用户离开我们的服务范围开访间其他网站或使用其他服务时,我们将无法直接保护用户在这些平台上提交的个人信息。建议用户在使用此类服务时谨慎对待个人信息。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s6.title', '6.用户权利保障'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s6.p1',
            '我们尊重并致力于保障用户对其个人信息的各项权利,包括查阅、复制、更正、补充、删除、撤回同意、注销账号等。用户可以通过指定的路径和方式行使这些权利,我们将及时响应并处理用户的合理请求。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s7.title', '7.未成年人特殊保护'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s7.p1',
            '我们高度重视未成年人个人信息的保护。对于未满18周岁的未成年人,我们建议在监护人的陪同和指导下使用我们的服务。对于未满14周岁的儿童,我们将严格遵循相关法律法规的规定,收集、使用或披露其个人信息前需获得监护人的明确同意。如发现违规收集未成年人信息的情况,我们将立即采取措施删除相关信息。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s8.title', '8.隐私政策更新与通知'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s8.p1',
            '为适应服务更新和法律法规变化,我们可能会适时修订本隐私政策。修订后的政策将构成新的协议并具有同等法律效力。我们将在更新后的条款生效前通过公告等方式提醒用户注意更新内容。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s9.title', '9.我们使用的SDK及第三方服务'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s9.p1',
            '为了提供更完善的服务,我们的应用中集成了以下第三方SDK和服务,以下将详细介绍这些SDK和服务收集使用个人信息的目的、方式和范围:',
          ),
        },
        {
          title: tt('about.privacy.s9.t1', '9.1 360加固'),
          text: tt(
            'about.privacy.s9.p2',
            '目的:对app进行安全加固,保障应用的安全性。 方式:收集设备信息(如设备型号、操作系统版本等)。 范围:仅用于应用安全加固,不涉及个人信息收集。',
          ),
        },
        {
          title: tt('about.privacy.s9.t2', '9.2 ZIP4J包'),
          text: tt(
            'about.privacy.s9.p3',
            '目的:提供压缩和解压功能。 方式:不涉及个人信息收集。 范围:仅用于文件压缩和解压。',
          ),
        },
        {
          title: tt('about.privacy.s9.t3', '9.3 Chromium'),
          text: tt(
            'about.privacy.s9.p4',
            '目的:提供谷歌浏览器引擎功能。 方式:可能收集浏览记录、缓存数据等。 范围:仅用于提升应用内网页浏览体验。',
          ),
        },
        {
          title: tt('about.privacy.s9.t4', '9.4 AndroidGifDrawable'),
          text: tt(
            'about.privacy.s9.p5',
            '目的:Android Gif控件,能使用户进行gif播放。 方式:不涉及个人信息收集。 范围:仅用于gif图片播放。',
          ),
        },
        {
          title: tt('about.privacy.s9.t5', '9.5 iik视频播放器'),
          text: tt(
            'about.privacy.s9.p6',
            '目的:使APP能进行视频播放。 方式:可能收集设备信息、播放记录等。 范围:仅用于视频播放功能。',
          ),
        },
        {
          title: tt('about.privacy.s9.t6', '9.6 bolts'),
          text: tt(
            'about.privacy.s9.p7',
            '目的:一款底层类库集合,在后台实现异步操作。 方式:不涉及个人信息收集。 范围:仅用于提升APP性能。',
          ),
        },
        {
          title: tt('about.privacy.s9.t7', '9.7 Glide'),
          text: tt(
            'about.privacy.s9.p8',
            '目的:Android 图片加载和缓存库,提升APP查看图片的性能。 方式:可能收集图片缓存数据。 范围:仅用于图片加载和缓存。',
          ),
        },
        {
          title: tt('about.privacy.s9.t8', '9.8 Fresco'),
          text: tt(
            'about.privacy.s9.p9',
            '目的:一个强大的图片加载组件。 方式:可能收集图片缓存数据。 范围:仅用于图片加载和显示。',
          ),
        },
        {
          title: tt('about.privacy.s9.t9', '9.9 华为推送'),
          text: tt(
            'about.privacy.s9.p10',
            '目的:允许华为手机将最新信息及时通知用户。 方式:收集设备标识符、推送通知状态等。 范围:仅用于推送通知服务。',
          ),
        },
        {
          title: tt('about.privacy.s9.t10', '9.10 UniversalImageLoader'),
          text: tt(
            'about.privacy.s9.p11',
            '目的:图片缓存组件,提升图片查看速度。 方式:可能收集图片缓存数据。 范围:仅用于图片缓存。',
          ),
        },
        {
          title: tt('about.privacy.s9.t11', '9.11 SamsungLook'),
          text: tt(
            'about.privacy.s9.p12',
            '目的:允许三星手机将最新信息及时通知用户。 方式:收集设备标识符、推送通知状态等。 范围:仅用于推送通知服务。',
          ),
        },
        {
          title: tt('about.privacy.s9.t12', '9.12 淘宝Weex'),
          text: tt(
            'about.privacy.s9.p13',
            '目的:淘宝提供的一种优化解决方案,提升app性能。 方式:可能收集设备信息、应用性能数据等。 范围:仅用于优化应用性能。',
          ),
        },
        {
          title: tt('about.privacy.s9.t13', '9.13 Okhttp3'),
          text: tt(
            'about.privacy.s9.p14',
            '目的:高效的HTTP客户端,提升app用户体验。 方式:可能收集网络请求信息。 范围:仅用于网络请求。',
          ),
        },
        {
          title: tt('about.privacy.s9.t14', '9.14 Okio'),
          text: tt(
            'about.privacy.s9.p15',
            '目的:用于补充Java.io和java.nio的不足,以便app能够更加方便、快速地访问、存储和处理数据。 方式:不涉及个人信息收集。 范围:仅用于数据访问和处理。',
          ),
        },
        {
          title: tt('about.privacy.s9.t15', '9.15 DCloud SDK'),
          text: tt(
            'about.privacy.s9.p16',
            '目的:用于应用性能监控、用户行为分析、推送通知、社会化分享、一键登录等功能。 方式:收集设备信息(如设备标识符、网络标识等)。 范围:仅用于提供上述功能,具体共享的信息会根据DCloud的隐私政策和SDK的实际功能来定。',
          ),
        },
        {
          title: tt('about.privacy.s9.t16', '9.16 MAC地址收集'),
          text: tt(
            'about.privacy.s9.p17',
            '目的:为了保障网络连接的稳定性和安全性,我们可能会收集用户的MAC地址。 方式:应用会在用户同意相关权限后,收集设备的MAC地址信息。 范围:MAC地址仅用于上述目的,不会用于其他任何目的。我们承诺不会将MAC地址与任何可识别个人身份的信息相关联。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s10.title', '10.联系方式'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s10.p1',
            '如用户对本隐私政策有任何疑问、意见或建议,或需要投诉、举报相关问题,可以通过以下方式与我们联系:',
          ),
        },
        {
          text: tt(
            'about.privacy.s10.p2',
            '10.1 通过智汇社官方网站或App内的反馈入口进行反馈。',
          ),
        },
        {
          text: tt(
            'about.privacy.s10.p3',
            '10.2 长春市高新区益田硅谷公馆二期(益田罗堤悦府)B9栋1801室。',
          ),
        },
      ],
    },
    {
      subtitle: tt('about.privacy.s11.title', '11.业务简介'),
      paragraphs: [
        {
          text: tt(
            'about.privacy.s11.p1',
            '吉林省李氏数字文化有限公司成立于2024年12月,是一家专业研究人工智能领域技术型公司,着重前瞻式技术尝试,经过自主研发,完成了AI Agent的底层算法,创建一款侧重行为通用型智能体,目前产品智汇社AI拥有APP端和web端,适用于需要生活和日常工作普通人,无需任何基础即可拥有智能体。且AI访问的外部网站均为正规网站,AI的所有请求默认用户都已经知情且同意,智汇社只提供AI服务功能,本产品使用的正版商用的千库网素材,如果有其他侵权的因素,请通知智汇社进行删除。',
          ),
        },
      ],
    },
  ]

  return (
    <ScrollView className="privacy-page" scrollY>
      <View className="privacy-content">
        <Text className="privacy-main-title">{tt('about.privacy.mainTitle', '隐私政策')}</Text>
        <Text className="privacy-update-time">
          {tt('about.privacy.updateDate', '更新日期: 2025年06月21日')}
        </Text>
        <Text className="privacy-update-time">
          {tt('about.privacy.effectiveDate', '生效日期: 2025年06月21日')}
        </Text>

        <View className="privacy-section">
          {overviewParagraphs.map((p, idx) => (
            <View key={idx} className="privacy-paragraph-wrap">
              {p.title ? <Text className="privacy-paragraph-title">{p.title}</Text> : null}
              <Text className="privacy-paragraph">{p.text}</Text>
            </View>
          ))}
        </View>

        {sections.map((section, sIdx) => (
          <View key={sIdx} className="privacy-section">
            <Text className="privacy-subtitle">{section.subtitle}</Text>
            {section.paragraphs.map((p, pIdx) => (
              <View key={pIdx} className="privacy-paragraph-wrap">
                {p.title ? <Text className="privacy-paragraph-title">{p.title}</Text> : null}
                <Text className="privacy-paragraph">{p.text}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
