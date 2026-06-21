<template>
  <div v-loading="loading" :style="'height:' + height">
    <iframe
      :src="src"
      frameborder="no"
      style="width: 100%; height: 100%"
      scrolling="auto"
    />
  </div>
</template>
<script>
export default {
  props: {
    src: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      height: document.documentElement.clientHeight - 94.5 + "px;",
      loading: true,
      url: this.src,
    };
  },
  mounted: function () {
    setTimeout(() => {
      this.loading = false;
    }, 300);
    window.onresize = () => {
      this.height = document.documentElement.clientHeight - 94.5 + "px;";
    };
  },
};
</script>
