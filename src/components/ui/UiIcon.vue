<script setup lang="ts">
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Minus,
  Moon,
  Pin,
  PinOff,
  Plus,
  Sun,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'

export type UiIconName =
  | 'back'
  | 'forward'
  | 'minus'
  | 'zero'
  | 'plus'
  | 'close'
  | 'copy'
  | 'check'
  | 'moon'
  | 'sun'
  | 'chevron-down'
  | 'chevron-right'
  | 'crumb'
  | 'pin'
  | 'unpin'

const ICONS: Record<UiIconName, Component> = {
  back: ChevronLeft,
  forward: ChevronRight,
  minus: Minus,
  zero: Circle,
  plus: Plus,
  close: X,
  copy: Copy,
  check: Check,
  moon: Moon,
  sun: Sun,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  crumb: ChevronRight,
  pin: Pin,
  unpin: PinOff,
}

withDefaults(defineProps<{ name: UiIconName; size?: number | string }>(), { size: 16 })
</script>

<template>
  <component :is="ICONS[name]" :size="size" aria-hidden="true" />
</template>
