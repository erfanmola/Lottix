<script lang="ts">
export const LottiePlayerFileCache: { [key: string]: Uint8Array } = {};
</script>

<script setup lang="ts">
import "./LottiePlayer.scss";
import { ref, onMounted, onBeforeUnmount, computed } from "vue";
import Lottix from "../utils/lottix";

export type LottiePlayerProps = {
   src?: string;
   data?: string;
   speed?: number;
   autoplay?: boolean;
   loop?: boolean;
   fallback?: any;
   playOnClick?: boolean;
   outline?: string;
};

const props = defineProps<LottiePlayerProps>();

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const loaded = ref(false);
const lottix = ref<Lottix | null>(null);

onMounted(() => {
   const timer = setTimeout(() => {
      if (!canvas.value) return;

      const instance = new Lottix({
         canvas: canvas.value,
         src: props.data
            ? new TextEncoder().encode(props.data)
            : (LottiePlayerFileCache[props.src!] ?? props.src!),
         autoPlay: props.autoplay,
         loop: props.loop,
         renderer: "sw",
         speed: props.speed,
      });

      lottix.value = instance;

      instance.on("load", () => {
         loaded.value = true;
      });

      if (!(props.playOnClick || props.loop)) {
         instance.on("complete", () => {
            if (!instance) return;
            instance.destroy();
         });
      }
   });

   onBeforeUnmount(() => {
      clearTimeout(timer);
      if (lottix.value && lottix.value.state !== "destroyed") {
         lottix.value.destroy(true);
      }
      lottix.value = null;
   });
});

const onClickAnimation = () => {
   if (!(props.playOnClick && lottix.value)) return;
   if (lottix.value.state === "complete") lottix.value.play();
};

const outlineStyle = computed(() => {
   if (!props.outline) return {};
   return {
      maskImage: `url("data:image/svg+xml;base64,${btoa(props.outline)}")`,
   };
});
</script>

<template>
   <div ref="container" class="lottie-animation" @click="onClickAnimation">
      <!-- Fallback -->
      <template
         v-if="
            !loaded && props.fallback && !(props.src in LottiePlayerFileCache)
         "
      >
         <component :is="props.fallback" />
      </template>

      <!-- Outline shimmer -->
      <div v-if="!loaded" class="shimmer" :style="outlineStyle"></div>

      <canvas
         ref="canvas"
         :style="{ visibility: loaded ? 'visible' : 'hidden' }"
      />
   </div>
</template>
