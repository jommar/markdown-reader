<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    ariaLabel?: string
    disabled?: boolean
    mono?: boolean
    invalid?: boolean
    describedBy?: string
  }>(),
  {
    modelValue: '',
    placeholder: '',
    ariaLabel: undefined,
    disabled: false,
    mono: false,
    invalid: false,
    describedBy: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'enter'): void
}>()

const el = ref<HTMLInputElement | null>(null)

const showClear = computed(() => !props.disabled && props.modelValue.length > 0)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onEnter() {
  emit('enter')
}

function onClear() {
  emit('update:modelValue', '')
  el.value?.focus()
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('update:modelValue', '')
  }
}

defineExpose({
  focus: () => el.value?.focus(),
})
</script>

<template>
  <div class="relative flex w-full items-center">
    <input
      ref="el"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedBy"
      :disabled="disabled"
      :class="[
        'bg-bg-inset text-fg focus-visible:outline-accent w-full rounded-sm border px-1.5 py-1 pr-7 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40',
        invalid ? 'border-danger focus-visible:outline-danger' : 'border-border',
        mono ? 'font-mono' : 'font-prose',
      ]"
      @input="onInput"
      @keydown.enter.prevent="onEnter"
      @keydown.escape="onEsc"
    />
    <button
      v-if="showClear"
      type="button"
      aria-label="Clear"
      class="text-fg-muted hover:text-fg active:opacity-70 absolute right-1 rounded-sm p-0.5 leading-none"
      tabindex="-1"
      @click="onClear"
    >
      ×
    </button>
  </div>
</template>
