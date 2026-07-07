<template>
  <svg :class="svgClass" aria-hidden="true" :style="{ width: size + 'px', height: size + 'px', color: color }">
    <use :xlink:href="iconName" :fill="color"></use>
  </svg>
</template>

<script>
  export default {
    name: "svg-icon",
    props: {
      name: {
        type: String,
        required: true
      },
      class: {
        type: String
      },
      color: {
        type: String,
        default: "#000"
      },
      size: {
        type: Number,
        default: 24
      }
    },
    computed: {
      iconName () {
        return `#icon-${this.name}`
      },
      svgClass () {
        if (this.class) {
          return "svg-icon " + this.class
        } else {
          return "svg-icon"
        }
      }
    }
  }
</script>

<style scoped>
  .svg-icon {
    width: 1em;
    height: 1em;
    vertical-align: -0.15em;
    fill: currentColor;
    overflow: hidden;
    stroke: currentColor;
  }
</style>
