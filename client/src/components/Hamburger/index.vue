<template>
  <div @click="toggleClick" class="hamburger-wrapper">
    <!-- Show collapse icon when sidebar is expanded (button when sidebar is pulled out) -->
    <svg
      v-if="isActive"
      class="hamburger-icon"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="20"
      height="20"
    >
      <g>
        <rect
          x="20"
          y="20"
          width="560"
          height="560"
          rx="70"
          fill-opacity="0"
          stroke-opacity="1"
          stroke="currentColor"
          fill="none"
          stroke-width="40"
        />
        <g transform="matrix(0,1,-1,0,208.0009765625,-208.0009765625)">
          <line
            x1="208.0009765625"
            y1="-20"
            x2="808.0009765625"
            y2="-20"
            fill-opacity="0"
            stroke-opacity="1"
            stroke="currentColor"
            fill="none"
            stroke-width="40"
          />
        </g>
      </g>
    </svg>
    <!-- Show expand icon when sidebar is collapsed (button when sidebar is not pulled out) -->
    <svg
      v-else
      class="hamburger-icon"
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="20"
      height="20"
    >
      <g>
        <path
          d="M0 90C7.848438341267089e-15 40.29437251522859 40.2943725152286 0 90 0L366 0C366 0 366 0 366 0L366 600C366 600 366 600 366 600L90 600C40.2943725152286 600 0 559.7056274847714 0 510Z"
          fill="currentColor"
          fill-opacity="1"
        />
        <rect
          x="20"
          y="20"
          width="560"
          height="560"
          rx="70"
          fill-opacity="0"
          stroke-opacity="1"
          stroke="currentColor"
          fill="none"
          stroke-width="40"
        />
        <g transform="matrix(0,1,-1,0,335.0009765625,-335.0009765625)">
          <line
            x1="335.0009765625"
            y1="-20"
            x2="935.0009765625"
            y2="-20"
            fill-opacity="0"
            stroke-opacity="1"
            stroke="currentColor"
            fill="none"
            stroke-width="40"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<script>
export default {
  name: "Hamburger",
  props: {
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    toggleClick() {
      this.$emit("toggleClick");
    },
  },
};
</script>

<style scoped>
.hamburger-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hamburger-icon {
  display: inline-block;
  vertical-align: middle;
  width: 20px;
  height: 20px;
  color: inherit;
  transition: color 0.3s;
}
</style>
