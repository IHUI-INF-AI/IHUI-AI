<template>
  <div class="payment-warp">
    <el-dialog custom-class="payment-tips" :lock-scroll="false" :close-on-press-escape="false" :close-on-click-modal="false" v-model="dialogModel" title="支付提示" width="30%" :before-close="closeDialog">
      <div class="title">请尽快完成支付</div>
      <div class="line2">单号：{{order.no}}</div>
      <div class="line2">支付费用：<span>¥{{order.paymentAmount}}</span></div>
      <div class="sub">请您及时付款，以便订单尽快处理！</div>
      <div class="sub" v-if="payment.code">
        {{payment.code}}
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="closeDialog">我已支付</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import {computed, ref} from "vue"
  import {useRouter} from "vue-router";
  // import {getToken} from "@/util/tokenUtils"
  // import {useRoute} from "vue-router";
  // import {error} from "@/util/tipsUtils";
  import {paymentLessonOrder} from "@/api/edu/web/learn/lesson";

  export default {
    name: "PaymentIndex",
    emits: ["beforeClose"],
    components: {
    },
    props: {
      beforeClose: {
        type: Function,
        default: () => {}
      },
      showDialogFlag: {
        type: Boolean
      },
      order: {
        type: Object,
        default: () => {
          return {
            no: "--",
            paymentAmount: 0.00
          }
        }
      }
    },
    setup(props, context) {
      const dialogModel = computed({
        get() {
          return props.showDialogFlag;
        },
        set(val) {
          context.emit('update:showDialogFlag', val);
        },
      });
      const closeDialog = () => {
        context.emit("beforeClose");
      }
      const paymentParam = {
        orderNo: props.order.no,
        returnUrl: window.location.origin + "/edu/learn/detail?id=" + (props.order?.id || '')
      }
      const payment = ref({
        code: ""
      })
      const router = useRouter();
      //使用resolve
      const href = router.resolve({
        path: "/edu/learn/payment/confirm",
        query: {paymentParam: JSON.stringify(paymentParam)}
      })
      // 点击事件
      window.open(href.href, "_blank")
      paymentLessonOrder(paymentParam, res => {
        payment.value = res
      })
      return {
        payment,
        closeDialog,
        dialogModel
      }
    }
  }
</script>

<style lang="scss" scoped>
  .payment-warp {
    .title {
      color: #54657a;
      font-size: 20px;
      height: 40px;
      line-height: 40px;
    }
    .line2 {
      color: #54657a;
      line-height: 50px;
      font-size: 16px;
      span {
        color: #ce323d;
      }
    }
    .sub {
      color: #9399a5;
      font-size: 14px;
    }
  }
</style>
