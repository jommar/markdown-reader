<template>
  <div class="smoke">{{ msg }}</div>
</template>

<script setup lang="ts">
defineProps<{ msg: string }>()
</script>
