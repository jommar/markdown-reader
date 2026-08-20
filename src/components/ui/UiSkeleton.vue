<script setup lang="ts">
withDefaults(
  defineProps<{
    lines?: number
    width?: string
  }>(),
  { lines: 3, width: '100%' },
)
</script>

<template>
  <div class="flex flex-col gap-2" aria-hidden="true">
    <div
      v-for="i in lines"
      :key="i"
      class="skeleton-line bg-bg-inset animate-pulse rounded-sm"
      :style="{ width: i === lines ? '70%' : width, height: '0.9rem' }"
    />
  </div>
</template>

<style scoped>
.skeleton-line {
  animation-duration: var(--duration-200);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none !important;
  }
}
</style>
