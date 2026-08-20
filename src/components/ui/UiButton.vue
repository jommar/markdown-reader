<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'ghost'
    active?: boolean
    disabled?: boolean
  }>(),
  { variant: 'default', active: false, disabled: false },
)
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="active ? 'true' : undefined"
    class="text-fg-muted hover:border-border-strong hover:text-fg focus-visible:outline-accent rounded-sm border bg-none px-2 py-0.5 text-[0.82rem] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-40"
    :class="[
      variant === 'primary'
        ? 'border-accent bg-accent text-bg hover:border-accent hover:text-bg'
        : variant === 'ghost'
          ? 'hover:bg-bg-elev hover:text-fg border-transparent bg-transparent'
          : 'border-border',
      active ? 'border-accent text-accent' : '',
    ]"
  >
    <slot />
  </button>
</template>
