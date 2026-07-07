<template>
  <div class="category-module">
    <div class="category-module-container">
      <tabs-bar :item="item" component-name="twoRowTabsContent"/>
    </div>
  </div>
</template>

<script>
  import TabsBar from "./component/tabsBar.vue";
  export default {
    name: "tabsContent",
    components: {
      TabsBar
    },
    props: {
      item: {
        type: Object,
        required: true
      }
    }
  }
</script>

<style lang="scss" scoped>
.category-module {
  margin-bottom: 24px;
  width: 100%;
  max-width: 1240px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 10px;
  padding-right: 10px;
  box-sizing: border-box;

  @media (max-width: 1280px) {
    max-width: 100%;
  }
  
  .category-module-container {
    background: #ffffff;
    border-radius: $border-radius;
    border: 1px solid $border-color;
    overflow: hidden;
    box-shadow: $shadow-sm;
  }
}
</style>
