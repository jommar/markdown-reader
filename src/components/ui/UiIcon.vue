<script setup lang="ts">
export type UiIconName =
  | 'back'
  | 'forward'
  | 'minus'
  | 'zero'
  | 'plus'
  | 'close'
  | 'copy'
  | 'moon'
  | 'sun'
  | 'chevron-down'
  | 'chevron-right'
  | 'crumb'
  | 'pin'
  | 'unpin'

const PATHS: Record<UiIconName, string> = {
  back: 'M19 12H5M12 19l-7-7 7-7',
  forward: 'M5 12h14M12 5l7 7-7 7',
  minus: 'M5 12h14',
  zero: 'M12 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z',
  plus: 'M12 5v14M5 12h14',
  close: 'M18 6L6 18M6 6l12 12',
  copy: 'M8 17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 17h8a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sun: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l1.41 1.41M19.07 4.93l1.41 1.41M16 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  crumb: 'M9 6l6 6-6 6',
  pin: 'M12 17v5M9 20h6M12 3a4 4 0 0 0-4 4c0 2.5 4 8 4 8s4-5.5 4-8a4 4 0 0 0-4-4z',
  unpin:
    'M12 17v5M9 20h6M12 3a4 4 0 0 0-4 4c0 1.5 1.5 4 3 6M15 9c0.5-0.8 1-1.7 1-2a4 4 0 0 0-4-4zM2 2l20 20',
}

withDefaults(defineProps<{ name: UiIconName; size?: number | string }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
