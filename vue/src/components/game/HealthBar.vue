<template>
  <g v-if="health < maxHealth" pointer-events="none">
    <rect :x="-width / 2" :y="y" :width="width" height="4" fill="#1b2719" />
    <rect :x="-width / 2" :y="y" :width="width * health / maxHealth" height="4" :fill="color" />
  </g>
</template>

<script setup>
import { computed } from 'vue'

// Полоска здоровья над объектом; показывается, только когда объект ранен
const props = defineProps({
  health: { type: Number, required: true },
  maxHealth: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
})

const color = computed(() => {
  const ratio = props.health / props.maxHealth
  if (ratio > 0.5) return '#6fd06a'
  if (ratio > 0.25) return '#e0c23a'
  return '#d6453a'
})
</script>
