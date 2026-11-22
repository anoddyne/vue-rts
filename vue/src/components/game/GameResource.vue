<template>
  <g
      :data-element-id="resource.id"
      :transform="`translate(${position.x} ${position.y})`"
      role="button"
      :aria-label="resource.type.name"
      :aria-pressed="selected"
      tabindex="0"
      @click.stop="emit('select', $event)"
      @keydown.enter.stop.prevent="emit('select')"
      @keydown.space.stop.prevent="emit('select')"
  >
    <ellipse cx="0" cy="0" rx="18" ry="8" fill="#263c24" :stroke="selected ? '#ffe08a' : 'none'" />
    <rect x="-3" y="-25" width="6" height="25" fill="#725034" />
    <path d="M -19,-10 L 0,-46 L 19,-10 Z" fill="#477c3f" stroke="#263c24" />
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { worldToScreen } from '@/game/map.js'

const props = defineProps({
  resource: { type: Object, required: true },
  gridSize: { type: Number, required: true },
  selected: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])
const position = computed(() => worldToScreen(props.resource.x, props.resource.y, props.gridSize))
</script>
