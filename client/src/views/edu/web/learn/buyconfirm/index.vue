<template>
  <!-- 菜单-->
  <learn-nav-menu/>
  <div class="buy-wrap">
    <!--  面包 -->
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/edu/learn'}">课程</el-breadcrumb-item>
      <el-breadcrumb-item>购买确认</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="item-wrap">
      <div class="title-item">
        <h1>商品确认</h1>
      </div>
      <div class="item-content-wrap">
        <div class="table-header">
          <div class="header-label">商品名称</div>
          <div class="header-label">支付价格</div>
        </div>
        <div class="table-content" v-for="item in lessonList" :key="item.id">
          <div class="content-item">
            <a class="title_a" href="#" target="_blank">
              <!--              <span>限时折扣</span>-->
              <img :src="item.image"/>
            </a>
            <p>
              <input type="hidden" class="ids ids_30808" value="30808">
              <a href="/course/30808.html" target="_blank">{{item.name}}</a>
              <!-- 学分 -->
              <!--              <a href="/members/in-fo" target="_blank" class="member" rel="noopener noreferrer">会员购课最多赠2学分,学分说明 &gt;</a>-->
            </p>
          </div>
          <div class="content-item text-align-center">￥{{item.price}}</div>
        </div>
      </div>
      <div class="title-item">
        <h1>支付方式</h1>
      </div>
      <div class="item-content-wrap">
        <div class="pay-method-item">
          <div class="pay-method-item-label">
            <el-radio
              v-model="value2"
              class="ml-2"
              active-color="#07c160"
              inactive-color="#cccccc">
              支付费            </el-radio>
          </div>
          <div class="pay-method-item-icon">
            <el-icon>
              <Alipay  theme="outline" size="52" fill="#ffffff" :strokeWidth="1"></Alipay>
            </el-icon>
          </div>
        </div>
      </div>
      <div class="item-content-wrap display-inline-block margin-tb30">
        <div class="protocol-bottom">
          <div>购买人：{{member.name}}</div>
          <div>
            <el-radio
              v-model="value2"
              class="ml-2"
              active-color="#999999"
              inactive-color="#999999">
              我已经阅读并确认签署
            </el-radio>
            <a href="javascript:void(0)" @click="showAgreement">《购买协议》</a>
          </div>
        </div>
        <div class="finish">
          <div class="left">
            <span class="num">共结算{{order.itemList.length}}件商</span>
            <span class="detail">价格明细</span>
            <div class="price_detail">
              <div class="detail_top">
                <div class="line">
                  <span>原价</span>
                  <span>￥{{order.itemAmount}}</span>
                </div>
                <div class="line">
                  <span>优惠金额</span>
                  <span>-￥{{order.freightAmount}}</span>
                </div>
              </div>
              <div class="split"></div>

              <div class="line">
                <span class="total">待支付</span>
                <span class="ready_pay"><span>¥{{order.itemAmount - order.freightAmount}}</span></span>
              </div>
            </div>
          </div>
          <div class="right fr">
            <span class="has_discount"><label class="text">已优惠</label><span>¥{{order.freightAmount}}</span></span>
            <span class="ready_pay red"><label class="text">待支付</label><span>¥{{order.itemAmount - order.freightAmount}}</span></span>
            <div class="button" @click="payment">去支付</div>
          </div>
        </div>
      </div>
    </div>
    <payment-dialog v-if="showDialogFlag" :order="orderItem" :show-dialog-flag="showDialogFlag" @before-close="paymentDialogClose"/>
  </div>
</template>

<script>
  import { ref, markRaw } from "vue"
  import { ArrowRight } from '@/lib/lucide-fallback'
  import { getToken } from "@/util/tokenUtils"
  import { getLessonListByIds, createLessonOrder } from "@/api/edu/web/learn/lesson"
  import { useRoute } from "vue-router";
  import LearnNavMenu from "@/views/edu/web/learn/navMenu";
  import PaymentDialog from "@/views/edu/web/learn/payment";
  import {getUser} from "@/util/userUtils";
  export default {
    name: "buyConfirm",
    components: {
      LearnNavMenu,
      PaymentDialog
    },
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const lessonList = ref([])
      const isLogin = ref(getToken())
      const route = useRoute()
      const idListStr = route.query.ids;
      let idList;
      if (idListStr) {
        idList = idListStr.split(",")
      }
      const member = getUser()
      const lessonLoading = ref(true)
      const order = ref({
        itemAmount: 0,
        paymentAmount: 0,
        freightAmount: 0,
        itemList: []
      })
      getLessonListByIds({idList: idList}, res => {
        lessonList.value = res || []
        lessonLoading.value = false
        let amount = 0
        let discountAmount = 0
        let itemList = []
        for (const lesson of res) {
          amount += lesson.price
          itemList.push({
            itemId: lesson.id,
            price: lesson.price,
            quantity: 1,
            paymentAmount: lesson.price,
            originalPrice: lesson.price,
            title: lesson.name,
            image: lesson.image
          })
        }
        order.value.itemAmount = amount
        order.value.freightAmount = discountAmount
        order.value.paymentAmount = amount - discountAmount
        order.value.itemList = itemList
      })
      const showDialogFlag = ref(false)
      const orderItem = ref({
        no: ""
      })
      const payment = () => {
        createLessonOrder(order.value, (res) => {
          orderItem.value = res || {}
          showDialogFlag.value = true
        })
      }
      const paymentDialogClose = () => {
        showDialogFlag.value = false;
      }
      return {
        ArrowRight: ArrowRightIcon,
        lessonList,
        isLogin,
        lessonLoading,
        order,
        payment,
        member,
        showDialogFlag,
        orderItem,
        paymentDialogClose
      }
    }
  }
</script>

<style lang="scss" scoped>
  .buy-wrap {
    width: calc(100% - 20px);
    margin: 0 auto;
    padding-top: 40px;
    :deep(.el-breadcrumb) {
      margin: 20px 0;
    }
    .item-wrap {
      width: 100%;
      position: relative;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      .title-item {
        padding: 20px 0;
      }
      .margin-tb30 {
        margin: 30px 0;
      }
      .item-content-wrap {
        width: 100%;
        min-height: 128px;
        border-radius: 6px;
        background-color: #fafafa;
        .table-header {
          .header-label {
            display: inline-block;
            height: 40px;
            line-height: 40px;
            text-align: center;
            color: #6a7281;
            font-size: 14px;
            width: 50%;
          }
        }
        .table-content {
          border-top: 1px solid #f0f0f0;
          color: #313d54;
          .content-item {
            display: inline-block;
            font-size: 14px;
            width: calc(50% - 40px);
            text-align: left;
            padding: 20px;
            a span {
              position: absolute;
              width: 62px;
              height: 22px;
              line-height: 22px;
              background-image: linear-gradient(to right, #da3034, #e7495b);
              text-align: center;
              color: #fff;
              font-size: 12px;
            }
            img {
              width: 126px;
              vertical-align: middle;
              max-height: 81px;
            }
            p {
              display: inline-block;
              width: 295px;
              vertical-align: middle;
              color: #313d54;
              font-size: 14px;
              line-height: 20px;
              padding-left: 10px;
              text-align: left;
              a {
                color: #313d54;
                display: block;
              }
              a.member {
                font-size: 12px;
                color: #c98660;
                margin-top: 10px;
              }
            }
          }
          .text-align-center {
            text-align: center;
          }
        }
        .pay-method-item {
          padding: 20px;
          display: inline-block;
          text-align: center;
          .pay-method-item-label {
            padding: 10px 0;
          }
          .pay-method-item-icon {
            :deep(.i-icon-alipay) {
              background: #0373ff;
              padding: 10px;
              border-radius: 6px;
            }
          }
        }
        .protocol-bottom {
          display: flex;
          justify-content: space-between;
          margin: 10px auto;
          width: calc(100% - 50px);
          padding: 10px 25px 0;
        }
        .finish {
          width: 100%;
          margin: 0 auto;
          height: 80px;
          line-height: 80px;
          position: relative;
          .left, .right {
            display: inline-block;
            height: 100%;
          }
          .left {
            padding-left: 25px;
            .num {
              color: #2e3d56;
              font-weight: bold;
              font-size: 18px;
            }
            .detail {
              text-decoration: underline;
              cursor: pointer;
              margin-left: 10px;
              font-size: 18px;
              color: #9299a7;
              &:hover {
                color: #ee4854;
              }
              &:hover+.price_detail {
                display: block;
              }
            }
          }
          .right {
            padding-right: 25px;
            span {
              font-size: 18px;
              margin: 0 10px;
            }
            .red {
              color: #e32229;
            }
            .text {
              margin-right: 4px;
            }
            .button {
              cursor: pointer;
              outline: 0;
              text-align: center;
              display: inline-block;
              width: 175px;
              height: 50px;
              line-height: 50px;
              border-radius: 3px;
              background-color: #ce323d;
              border: 0;
              color: #fff;
              font-size: 18px;
              font-weight: bold;
              margin-top: 15px;
            }
          }
          .fr {
            float: right;
          }
          .price_detail {
            display: none;
            position: absolute;
            bottom: 60px;
            left: 100px;
            width: 290px;
            background-color: #fff;
            box-shadow: 0 0 10px rgb(0 0 0 / 10%);
            padding: 20px 25px 10px;
            font-size: 16px;
            .split {
              width: 100%;
              height: 1px;
              background-color: #f6f7f9;
              margin: 12px 0;
            }
            .line {
              height: 40px;
              line-height: 40px;
            }
            .line>span {
              display: inline-block;
              &:first-child {
                width: 120px;
                color: #9299a6;
              }
              &:nth-child(2) {
                width: calc(100% - 120px);
                text-align: right;
                color: #313d54;
                float: right;
              }
              &.ready_pay {
                color: #e41235;
              }
            }
          }
        }
      }
      .display-inline-block {
        display: inline-block;
      }
    }
  }
  .payment-tips {
    .title {
      color: #54657a;
      font-size: 20px;
      height: 70px;
      line-height: 70px;
    }
  }
</style>
<style lang="scss">
  .el-main {
    min-height: auto;
  }
  .el-overlay {
    z-index: 9999999;
  }
</style>
