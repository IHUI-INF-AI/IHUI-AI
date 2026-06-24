<template>
  <div class="theme-toggle-container right-menu-item">
    <label class="switch">
      <input
        id="navbar-theme-input"
        type="checkbox"
        :checked="currentTheme === 'theme-dark'"
        @change="toggleTheme"
      />
      <div class="slider round">
        <div class="sun-moon">
          <svg id="navbar-moon-dot-1" class="moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-moon-dot-2" class="moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-moon-dot-3" class="moon-dot" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-light-ray-1" class="light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-light-ray-2" class="light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-light-ray-3" class="light-ray" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>

          <svg id="navbar-cloud-1" class="cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-cloud-2" class="cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-cloud-3" class="cloud-dark" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-cloud-4" class="cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-cloud-5" class="cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
          <svg id="navbar-cloud-6" class="cloud-light" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="50"></circle>
          </svg>
        </div>
        <div class="stars">
          <svg id="navbar-star-1" class="star" viewBox="0 0 20 20">
            <path
              d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"
            ></path>
          </svg>
          <svg id="navbar-star-2" class="star" viewBox="0 0 20 20">
            <path
              d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"
            ></path>
          </svg>
          <svg id="navbar-star-3" class="star" viewBox="0 0 20 20">
            <path
              d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"
            ></path>
          </svg>
          <svg id="navbar-star-4" class="star" viewBox="0 0 20 20">
            <path
              d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z"
            ></path>
          </svg>
        </div>
      </div>
    </label>
  </div>
</template>

<script>
export default {
  name: "ThemeSwitch",
  computed: {
    currentTheme() {
      return this.$store.state.settings.sideTheme;
    },
  },
  methods: {
    toggleTheme() {
      // Switch theme
      const newTheme = this.currentTheme === 'theme-dark' ? 'theme-light' : 'theme-dark';
      this.$store.dispatch("settings/changeSetting", {
        key: "sideTheme",
        value: newTheme,
      });
      // Automatically save to local
      if (this.$cache && this.$cache.local) {
        this.$cache.local.set(
          "layout-setting",
          `{
              "sideTheme":"${newTheme}"
            }`,
        );
      }
    },
  },
};
</script>

<style lang="scss" scoped>
// Completely copy the styles from Settings component word for word
// Ensure style structure is completely consistent with Settings component
.theme-toggle-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 24px;
  margin-bottom: 24px;

  // Navbar specific style adjustment (does not affect internal styles)
  // scope provides [data-v-xxx] so the &.right-menu-item specificity is already higher than the global .right-menu-item
  &.right-menu-item {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: calc(100% - 6px);
    max-height: 44px;
    min-height: 24px;
    margin: 0 8px;
    flex-shrink: 0;
    margin-top: 0;
    margin-bottom: 0;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 24px;
    vertical-align: middle;
    
    #navbar-theme-input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    
    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background-color: var(--color-blue-2196f3);
      -webkit-transition: 0.4s;
      transition: 0.4s;
      z-index: var(--z-0);
      overflow: hidden;
      
      &.round {
        border-radius: var(--global-border-radius);
      }
    }
    
    #navbar-theme-input:checked + .slider {
      background-color: var(--el-text-color-primary);
    }
    
    #navbar-theme-input:focus + .slider {
      box-shadow: none;
    }
    
    .sun-moon {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 4px;
      bottom: 4px;
      background-color: yellow;
      -webkit-transition: 0.4s;
      transition: 0.4s;
      border-radius: 50%;
    }
    
    #navbar-theme-input:checked + .slider .sun-moon {
      -webkit-transform: translateX(16px);
      -ms-transform: translateX(16px);
      transform: translateX(16px);
      background-color: var(--el-bg-color);
      -webkit-animation: rotate-center 0.6s ease-in-out both;
      animation: rotate-center 0.6s ease-in-out both;
    }
    
    .moon-dot {
      opacity: 0;
      transition: 0.4s;
      fill: gray;
    }
    
    #navbar-theme-input:checked + .slider .sun-moon .moon-dot {
      opacity: 1;
    }
    
    #navbar-moon-dot-1 {
      left: 6px;
      top: 2px;
      position: absolute;
      width: 4px;
      height: 4px;
      z-index: calc(var(--z-base) + 3);
    }
    
    #navbar-moon-dot-2 {
      left: 1px;
      top: 6px;
      position: absolute;
      width: 6px;
      height: 6px;
      z-index: calc(var(--z-base) + 3);
    }
    
    #navbar-moon-dot-3 {
      left: 10px;
      top: 11px;
      position: absolute;
      width: 2px;
      height: 2px;
      z-index: calc(var(--z-base) + 3);
    }
    
    #navbar-light-ray-1 {
      left: -5px;
      top: -5px;
      position: absolute;
      width: 28px;
      height: 28px;
      z-index: -1;
      fill: white;
      opacity: 0.1;
    }
    
    #navbar-light-ray-2 {
      left: -50%;
      top: -50%;
      position: absolute;
      width: 36px;
      height: 36px;
      z-index: -1;
      fill: white;
      opacity: 0.1;
    }
    
    #navbar-light-ray-3 {
      left: -11px;
      top: -11px;
      position: absolute;
      width: 38px;
      height: 38px;
      z-index: -1;
      fill: white;
      opacity: 0.1;
    }
    
    .cloud-light {
      position: absolute;
      fill: var(--color-gray-eee);
      animation-name: cloud-move;
      animation-duration: 6s;
      animation-iteration-count: infinite;
    }
    
    .cloud-dark {
      position: absolute;
      fill: var(--color-gray-ccc);
      animation-name: cloud-move;
      animation-duration: 6s;
      animation-iteration-count: infinite;
      animation-delay: 1s;
    }
    
    #navbar-cloud-1 {
      left: 19px;
      top: 10px;
      width: 26px;
    }
    
    #navbar-cloud-2 {
      left: 28px;
      top: 7px;
      width: 13px;
    }
    
    #navbar-cloud-3 {
      left: 11px;
      top: 15px;
      width: 19px;
    }
    
    #navbar-cloud-4 {
      left: 23px;
      top: 11px;
      width: 26px;
    }
    
    #navbar-cloud-5 {
      left: 30px;
      top: 9px;
      width: 13px;
    }
    
    #navbar-cloud-6 {
      left: 14px;
      top: 17px;
      width: 19px;
    }
    
    .stars {
      transform: translateY(-24px);
      opacity: 0;
      transition: 0.4s;
    }
    
    #navbar-theme-input:checked + .slider .stars {
      -webkit-transform: translateY(0);
      -ms-transform: translateY(0);
      transform: translateY(0);
      opacity: 1;
    }
    
    .star {
      fill: white;
      position: absolute;
      -webkit-transition: 0.4s;
      transition: 0.4s;
      animation-name: star-twinkle;
      animation-duration: 2s;
      animation-iteration-count: infinite;
    }
    
    #navbar-star-1 {
      width: 12px;
      top: 1px;
      left: 2px;
      animation-delay: 0.3s;
    }
    
    #navbar-star-2 {
      width: 4px;
      top: 10px;
      left: 2px;
    }
    
    #navbar-star-3 {
      width: 8px;
      top: 13px;
      left: 6px;
      animation-delay: 0.6s;
    }
    
    #navbar-star-4 {
      width: 11px;
      top: 0;
      left: 11px;
      animation-delay: 1.3s;
    }
    
    @keyframes cloud-move {
      0% {
        transform: translateX(0);
      }

      40% {
        transform: translateX(4px);
      }

      80% {
        transform: translateX(-4px);
      }

      100% {
        transform: translateX(0);
      }
    }
    
    @keyframes star-twinkle {
      0% {
        transform: scale(1);
      }

      40% {
        transform: scale(1.2);
      }

      80% {
        transform: scale(0.8);
      }

      100% {
        transform: scale(1);
      }
    }
    
    @keyframes rotate-center {
      0% {
        transform: translateX(16px) rotate(0deg);
      }

      100% {
        transform: translateX(16px) rotate(360deg);
      }
    }
  }
}
</style>
