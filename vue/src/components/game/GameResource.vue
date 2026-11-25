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
    <ellipse cx="0" cy="0" rx="24" ry="9" fill="#263c24" :stroke="selected ? '#ffe08a' : 'none'" />
    <g v-if="resource.resourceType === 'wood'">
      <path d="M -10,1 V -16 M 10,0 V -17" stroke="#725034" stroke-width="5" />
      <path d="M -22,-8 L -10,-35 L 2,-8 Z M -3,-9 L 10,-41 L 23,-9 Z" :fill="resource.type.color" stroke="#263c24" />
    </g>
    <g v-else stroke="#353832" stroke-linejoin="round">
      <path d="M -22,0 L -17,-15 L -8,-20 L 2,-11 L 7,1 Z" :fill="resource.type.color" />
      <path d="M -5,4 L 1,-18 L 13,-26 L 22,-15 L 23,0 Z" :fill="resource.type.color" />
      <path d="M 1,-18 L 9,-12 L 22,-15 M 9,-12 L 7,3" fill="none" />
    </g>
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
