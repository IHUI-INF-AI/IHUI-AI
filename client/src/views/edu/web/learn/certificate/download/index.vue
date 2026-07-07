<template>
  <div class="certificate-coat" v-loading="loading">
    <certificate-preview v-if="!loading" :certificate="certificate" :download="true"/>
  </div>
</template>

<script>
import CertificatePreview from "@/views/edu/web/learn/certificate/index.vue";
import {useRoute} from "vue-router";
import {getCertificate} from "@/api/edu/web/certificate";
import {ref} from "vue";

export default {
  name: "CertificateDownload",
  components: {CertificatePreview},
  props: {

  },
  setup() {
    const route = useRoute();
    const id = route.query.id
    const certificate = ref({})
    const loading = ref(true)
    getCertificate(id, res => {
      loading.value = false
      if (!res) {
        console.error("证书不存在")
        return
      }
      certificate.value = res;
    })
    return {
      loading,
      certificate
    }
  }
}
</script>

<style scoped lang="scss">

</style>
