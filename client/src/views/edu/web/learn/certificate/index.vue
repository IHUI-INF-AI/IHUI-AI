<template>
  <div class="certificate-coat">
    <el-button v-if="download" type="primary" size="large" @click="downloadCertificate">下载证书</el-button>
    <div class="certificate-rotate-wrap">
      <div :class="{'certificate-box-nmargin': download, 'certificate-rotate': download}" class="certificate-box" id="certificate" ref="certificate" :style="backgroundStyle">
        <div class="certificate-wrap">
          <div class="certificate-header">
            <div class="certificate-name">{{certificate.name}}</div>
          </div>
          <div class="certificate-main">
            <div class="certificate-member">
              <span>{{ certificate.member ? certificate.member.name : userName}}</span>
              <span style="font-weight: normal;">同学</span>
            </div>
            <div class="certificate-content">
              <span></span>
              <span>{{ certificate.lessonSignTime ? formatDate(certificate.lessonSignTime, 'yyyy年MM月dd日') : startTime}}</span>
              <span> </span>
              <span>{{ certificate.lessonCompleteTime ? formatDate(certificate.lessonCompleteTime, 'yyyy年MM月dd日') : endTime}}</span>
              <span> 参加 </span>
              <span class="certificate-course-name">{{certificate.lesson ? certificate.lesson.name : courseName}}</span>
              <span>培训，已完成课程学习</span>
              <span class="certificate-complete-desc">{{certificate.description || '经考核，成绩合格，特发此证书'}}</span>
            </div>
          </div>
          <div class="certificate-bottom">
            <div class="certificate-code">
              <span class="certificate-code-title">证书编号</span>
              <span class="certificate-code-main">{{certificate.code || code}}</span>
            </div>
            <div class="certificate-org">
              <p class="certificate-org-name">{{certificate.awardingOrganization}}</p>
              <p class="certificate-date">{{certificate.awardDate ? formatDate(certificate.awardDate, 'yyyy年MM月dd日') : awardDate}}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import {nextTick, ref} from "vue"
import {formatDate} from "@/util/dateUtils";
import {toBase64} from "@/api/edu/web/oss/oss";
export default {
  name: "CertificatePreview",
  props: {
    certificate: {
      type: Object
    },
    download: {
      type: Boolean
    }
  },
  setup(props) {
    const courseName = ref("课程示例") // 课程名称
    const userName = ref("张三") // 课程名称
    const startTime = ref(formatDate(new Date(), "yyyy年MM月dd日")) // 开始时间
    const futureTime = new Date(new Date().getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleString();
    const endTime = ref(formatDate(futureTime, "yyyy年MM月dd日")) // 结束时间
    const awardDate = ref(formatDate(new Date(), "yyyy年MM月dd日")) // 颁发时间
    // 设置编号  编号等于  日期 + 课程id  + 用户id这样
    const code = "UZ" + formatDate(futureTime, "yyyyMMddHHmmssSSS")

    const backgroundStyle = ref('background-image: url('+ props.certificate.design +');');
    toBase64(props.certificate.design, res => {
      if (res) {
        backgroundStyle.value = 'background-image: url(' + res + ')';
      }
    })

    const downloadCertificate = () => {
      nextTick(() => { // 使用$nextTick，解决数据还没有渲染到html就先转为图片，此时的图片会是空内容的问题
        const canvas = document.createElement("canvas") // 创建一个canvas节点
        const shareContent = document.getElementById("certificate") // 需要截图的包裹的（原生的）DOM 对象
        const width = shareContent.offsetWidth // 获取dom 宽度
        var height = shareContent.offsetHeight // 获取dom 高度
        const scale = 2 // 定义任意放大倍数 支持小数
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale) // 获取context,设置scale

        // 翻转90度，高要等于        height = width

        const rect = shareContent.getBoundingClientRect() // 获取元素相对于视口的
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop // 获取滚动轴滚动的长度
        html2canvas(document.getElementById("certificate"), { // 转换为图表          x: rect.left + 8, // 绘制的dom元素相对于视口的位置
          y: rect.top,
          scrollY: -scrollTop,
          scale: scale, // 添加的scale 参数
          width: width, // dom 原始宽度
          height: height,
          useCORS: true, // 开启跨          dpi: window.devicePixelRatio * 2
        }).then(canvas => {
          const context = canvas.getContext("2d")
          // 关闭抗锯          context.mozImageSmoothingEnabled = false
          context.msImageSmoothingEnabled = false
          context.imageSmoothingEnabled = false

          const imageData = canvas.toDataURL("image/png");
          var pdf = new jsPDF("p", "mm", "a4");
          pdf.addImage(imageData, "PNG", 0, 0, 300, 298);
          pdf.save(props.certificate.name + ".pdf");

          // var a = document.createElement("a")
          // a.download =  "my-certificate"
          // // 设置图片地址
          // a.href = imgUrl;
          // a.click();
        })
      })
    }
    return {
      backgroundStyle,
      formatDate,
      awardDate,
      downloadCertificate,
      courseName,
      userName,
      startTime,
      endTime,
      code
    }
  }
}
</script>

<style scoped lang="scss">
.certificate-coat {
  box-sizing: border-box;
  .el-button {
    float: right;
    font-size: 20px;
    writing-mode: vertical-rl;
    text-orientation: upright;
    height: auto;
    border-radius: 6px 0 0 6px;
  }
  .certificate-box {
    width: 1123px;
    height: 794px;
    position: relative;
    margin: 0 auto;
    padding: 0;
    box-sizing: border-box;
    background-repeat: no-repeat;
    background-size: 1123px 794px;
    .certificate-wrap {
      padding: 100px;
      height: 594px;
      width: 923px;
    }
  }

  .certificate-box-nmargin{
    margin: 0;
  }

  .certificate-header {
    margin: 40px 0 20px;
    .certificate-name {
      font-size: 60px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 30px;
      color: #000000;
      //text-shadow: 0 3px 0 #e5e7eb;
    }
  }

  .certificate-main {
    .certificate-member {
      width: auto;
      display: inline-block;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 5px;
      margin-top: 66px;
      color: #000000;
    }
    .certificate-content {
      font-size: 20px;
      color: #000000;
      text-indent: 44px;
      margin: 40px 0;
      line-height: 60px;
      span {
        letter-spacing: 2px;
      }
    }
    .certificate-course-name {
      text-align: center;
      letter-spacing: 5px;
      font-size: 20px;
      font-weight: 600;
      margin: 20px 10px 0;
    }
    .certificate-complete-desc {
    }
  }

  .certificate-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 40px;
    .certificate-code {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      font-size: 20px;
      margin-right: 20px;
      .certificate-code-title {
        color: #000000;
      }
      .certificate-code-main {
        color: #000000;
      }
    }
    .certificate-org {
      color: #000000;
      font-size: 20px;
      letter-spacing: 5px;
      text-align: center;

      .certificate-org-name {
        font-size: 20px;
        letter-spacing: 3px;
        text-align: center;
      }
      .certificate-date {
        margin-top: 10px;
        font-size: 20px;
      }
    }
  }
}
.certificate-rotate {
  transform: rotate(90deg);
  margin-top: 165px;
  margin-left: -165px;
}
</style>
