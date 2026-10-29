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
          :fill="groupColor"
          stroke="#1b2719"
          stroke-width="1.5"
      />
      <circle :cy="-unit.type.radius" :r="unit.type.radius * 0.5" :fill="unit.type.color" />
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { worldToScreen } from '@/game/map.js'
import { getGroupColor } from '@/game/objects.js'

const props = defineProps({
  unit: { type: Object, required: true },
  gridSize: { type: Number, required: true },
  selected: { type: Boolean, default: false },
  waypoints: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const position = computed(() => worldToScreen(props.unit.x, props.unit.y, props.gridSize))
// Заливка — цвет группы, точка в центре — цвет типа юнита
const groupColor = computed(() => getGroupColor(props.unit.group))
const marks = computed(() => props.waypoints.map(point => ({
  id: point.id,
  ...worldToScreen(point.x, point.y, props.gridSize),
})))
// Линия маршрута проходит через все точки обхода каждого события
const routePoints = computed(() => [position.value, ...props.waypoints
  .flatMap(event => (event.path?.length ? event.path : [event])
    .map(point => worldToScreen(point.x, point.y, props.gridSize)))]
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
