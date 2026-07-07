<template>
  <div class="content-container">
    <div v-html="agreement.content"></div>
  </div>
</template>

<script>
  import {ref} from "vue"
  import {getAgreement} from "@/api/edu/web/setting/agreement"
  import {useRoute} from "vue-router";
  export default {
    name: "AgreementIndex",
    data() {
      const agreement = ref({})
      const route = useRoute()
      const type = route.params.type
      getAgreement({type: type}, res => {
        agreement.value = res
      })
      return {
        agreement
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-container {
    margin: 60px auto 40px;
    background: #fafafa;
    max-width: 1200px;
    min-width: 1200px;
  }
</style>
