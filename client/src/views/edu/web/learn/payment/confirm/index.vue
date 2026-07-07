<template>
  <div class="payment-warp"></div>
</template>

<script>
  import {ref} from "vue"
  import {paymentLessonOrder} from "@/api/edu/web/learn/lesson";
  import {useRoute} from "vue-router";

  export default {
    name: "paymentConfirm",
    components: {
    },
    props: {
    },
    setup() {
      const payment = ref({
        code: ""
      })
      const route = useRoute()
      const paymentParam = JSON.parse(route.query.paymentParam)
      paymentLessonOrder(paymentParam, res => {
        payment.value = res
        // 新建tab页跳转支付页
        const div = document.createElement("div")
        /* 此处form就是后台返回接收到的数据 */
        div.innerHTML = res.code
        document.body.appendChild(div)
        document.forms[0].submit()
      })
      return {
        payment
      }
    }
  }
</script>

<style lang="scss" scoped>
</style>
