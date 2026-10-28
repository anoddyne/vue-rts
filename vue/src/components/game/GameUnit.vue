<template>
  <g>
    <polyline
        v-if="marks.length"
        :points="routePoints"
        fill="none"
        stroke="#ffe08a"
        stroke-width="1.5"
        stroke-dasharray="5 4"
        pointer-events="none"
    />
    <ellipse
        v-for="(mark, index) in marks"
        :key="mark.id"
        :cx="mark.x"
        :cy="mark.y"
        rx="7"
        ry="4"
        fill="none"
        :stroke="index === 0 ? '#ffe08a' : '#d7c48a'"
        :stroke-width="index === 0 ? 2 : 1.5"
        :stroke-dasharray="index === 0 ? null : '3 2'"
        pointer-events="none"
    />
    <g
        class="game-unit"
        :transform="`translate(${position.x} ${position.y})`"
        role="button"
        :aria-label="unit.type.name"
        :aria-pressed="selected"
        tabindex="0"
        @click.stop="emit('select', $event)"
        @keydown.enter.stop.prevent="emit('select')"
        @keydown.space.stop.prevent="emit('select')"
    >
      <ellipse
          v-if="selected"
          :rx="unit.type.radius * 1.8"
          :ry="unit.type.radius * 0.9"
          fill="none"
          stroke="#ffe08a"
          stroke-width="2"
      />
      <circle
          :cy="-unit.type.radius"
          :r="unit.type.radius"
          :fill="unit.type.color"
          :stroke="groupStroke"
          stroke-width="2"
      />
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { worldToScreen } from '@/game/map.js'
import { getGroupStyle } from '@/game/objects.js'

const props = defineProps({
  unit: { type: Object, required: true },
  gridSize: { type: Number, required: true },
  selected: { type: Boolean, default: false },
  waypoints: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const position = computed(() => worldToScreen(props.unit.x, props.unit.y, props.gridSize))
const groupStroke = computed(() => getGroupStyle(props.unit.group).unit)
const marks = computed(() => props.waypoints.map(point => ({
  id: point.id,
  ...worldToScreen(point.x, point.y, props.gridSize),
})))
const routePoints = computed(() => [position.value, ...marks.value]
  .map(point => `${point.x},${point.y}`)
  .join(' '))
</script>

<style scoped lang="scss">
.game-unit {
  cursor: pointer;

  &:focus:not(:focus-visible) {
    outline: none;
  }
}
</style>
