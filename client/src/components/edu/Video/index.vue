<template>
  <video
    ref="videoRef"
    controls
    lang="zh"
    :oncanplaythrough="onPlayerCanplaythrough"
    :onreadystatechange="playerStateChanged"
    :onpause="onPlayerPause"
    :onplay="onPlayerPlay"
    :oncanplay="onPlayerCanplay"
    :onended="onPlayerEnded"
    :onplaying="onPlayerPlaying"
    :onloadeddata="onPlayerLoadeddata"
    :onwaiting="onPlayerWaiting"
    :ontimeupdate="onPlayerTimeupdate"
    autoplay=""
    playsinline=""
    preload="auto"
    style="object-fit: fill;outline: none;"
    controlsList="nodownload">
    <source :src="videoSrc" type="video/mp4">
  </video>
</template>

<script>
  import {ref, watch} from "vue"
  export default {
    name: "VideoIndex",
    components: {
    },
    props: {
      src: {
        type: String,
        required: true
      },
      playerEnded: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerPause: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerPlay: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerWaiting: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerPlaying: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerLoadeddata: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerTimeupdate: {
        type: Function,
        default: (player) => {
          player
          // console.log(player)
        }
      },
      playerCanplay: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerCanplaythrough: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      },
      playerStateChangedCallback: {
        type: Function,
        default: (state) => {
          console.log(state)
        }
      },
      playerReadiedCallback: {
        type: Function,
        default: (player) => {
          console.log(player)
        }
      }
    },
    setup(props) {
      const videoSrc = ref(props.src)
      const videoRef = ref(null)
      watch(() => props.src, (val) => {
        videoRef.value.src = val;
        videoSrc.value = val
      })
      const onPlayerPlay = function(player) {
        console.log("播放器播放")
        props.playerPlay && props.playerPlay(player);
      }
      const onPlayerPause = function(player) {
        console.log("播放器暂停")
        props.playerPause && props.playerPause(player);
      }
      const onPlayerEnded = function(player) {
        console.log("播放器播放结束")
        props.playerEnded && props.playerEnded(player);
      }
      const onPlayerWaiting = function(player) {
        console.log("播放器等待")
        props.playerWaiting && props.playerWaiting(player);
      }
      const onPlayerPlaying = function(player) {
        console.log("播放器在播放")
        props.playerPlaying && props.playerPlaying(player);
      }
      const onPlayerLoadeddata = function(player) {
        console.log("播放器加载数据")
        props.playerLoadeddata && props.playerLoadeddata(player);
      }
      const onPlayerTimeupdate = function(player) {
        props.playerTimeupdate && props.playerTimeupdate(player);
      }
      const onPlayerCanplay = function(player) {
        console.log("播放器可以播放")
        props.playerCanplay && props.playerCanplay(player);
      }
      const onPlayerCanplaythrough = function(player) {
        props.playerCanplaythrough && props.playerCanplaythrough(player);
      }
      // or listen state event
      const playerStateChanged = function(playerCurrentState) {
        console.log("player current update state", playerCurrentState)
        props.playerStateChangedCallback && props.playerStateChangedCallback(playerCurrentState);
      }
      // player is ready
      const playerReadied = function(player) {
        console.log("the player is readied", player)
        props.playerReadiedCallback && props.playerReadiedCallback(player);
        // you can use it to do something...
        // player.[methods]
      }
      return {
        // playerOptions,
        videoSrc,
        videoRef,
        onPlayerPlay,
        onPlayerPause,
        onPlayerEnded,
        onPlayerWaiting,
        onPlayerPlaying,
        onPlayerLoadeddata,
        onPlayerTimeupdate,
        onPlayerCanplay,
        onPlayerCanplaythrough,
        playerStateChanged,
        playerReadied
      }
    }
  }
</script>

<style lang="scss">
  .video-js {

  }
</style>
