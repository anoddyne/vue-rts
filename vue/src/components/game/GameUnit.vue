<template>
  <g>
    <polyline
        v-if="marks.length"
        :points="routePoints"
        fill="none"
        :stroke="routeColor"
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
        :stroke="mark.attack ? ATTACK_COLOR : index === 0 ? '#ffe08a' : '#d7c48a'"
        :stroke-width="index === 0 ? 2 : 1.5"
        :stroke-dasharray="index === 0 ? null : '3 2'"
        pointer-events="none"
    />
    <g
        class="game-unit"
        :data-element-id="unit.id"
        :data-facing="UNIT_DIRECTIONS[facing]"
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
      <g v-for="side in body.sides" :key="side.name">
        <polygon
            :points="side.outline"
            :fill="body.material"
            :style="{ filter: `brightness(${side.shade})` }"
            stroke="#18211c"
        />
        <polygon
            :points="side.detail"
            fill="#212829"
            :stroke="side.name === 'back' ? groupColor : '#151a18'"
            stroke-width="1"
        />
      </g>
      <polygon :points="body.top" :fill="groupColor" stroke="#18211c" stroke-width="1.5" />
      <polygon :points="body.arrow" fill="#f3e7ca" stroke="#263029" stroke-width="0.6" />
      <g
          :transform="`translate(0 ${-body.height * 0.55}) scale(${unit.type.radius / 10})`"
          stroke="#191d19"
          stroke-linejoin="round"
      >
        <g v-if="unit.type.appearance === 'villager'">
          <path d="M 10,10 L 17,-11" stroke="#3a271b" stroke-width="2.5" />
          <path d="M 13,-10 L 19,-14 L 23,-12 L 20,-7 Z" fill="#c6a37b" />
          <path d="M -10,-3 L -16,-5 L -20,4 L -15,8 L -10,4 Z" :fill="body.roof" />
          <path d="M -17,-2 L -12,2" stroke="#534128" />
        </g>
        <g v-else-if="unit.type.appearance === 'militia'">
          <path d="M 13,7 L 21,-17 L 25,-21 L 25,-14 L 16,8 Z" fill="#d2d7d9" />
          <path d="M 12,1 L 20,4" stroke="#c99750" stroke-width="2" />
          <path d="M -20,-11 L -9,-8 L -9,3 L -16,11 L -23,3 L -23,-8 Z" fill="#89949b" />
          <path d="M -20,-7 L -12,-6 L -12,2 L -16,6 L -20,2 Z" :fill="groupColor" />
        </g>
        <g v-else-if="unit.type.appearance === 'archer'">
          <path d="M 12,-15 L 23,-3 L 12,10" fill="none" stroke="#dfcf9e" stroke-width="1" />
          <path d="M 12,-15 Q 30,-9 24,0 Q 22,6 12,10" fill="none" stroke="#2b2118" stroke-width="4" />
          <path d="M 12,-15 Q 30,-9 24,0 Q 22,6 12,10" fill="none" stroke="#bc804a" stroke-width="2" />
          <path d="M -16,-9 L -11,-7 L -12,9 L -17,7 Z" fill="#765238" />
          <path d="M -15,-8 L -17,-15 M -12,-7 L -12,-14" stroke="#e1cf9d" stroke-width="1.5" />
        </g>
        <g v-else-if="unit.type.appearance === 'scout'">
          <path d="M -15,6 L -15,-20" stroke="#272b2c" stroke-width="2.5" />
          <path d="M -15,-20 L -28,-16 L -24,-13 L -28,-9 L -15,-12 Z" :fill="groupColor" />
          <path d="M 7,1 L 15,-6 L 24,-3 L 23,3 L 12,6 Z" :fill="body.roof" />
          <path d="M 14,-2 L 20,-1" stroke="#c8e3e7" stroke-width="1.4" />
        </g>
      </g>
      <HealthBar :health="unit.health" :max-health="unit.type.maxHealth" :y="-body.height - unit.type.radius * 1.8" :width="24" />
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { worldToScreen } from '@/game/map.js'
import { getGroupColor } from '@/game/objects.js'
import { getUnitView, UNIT_DIRECTIONS } from '@/game/unitView.js'
import HealthBar from '@/components/game/HealthBar.vue'

const props = defineProps({
  unit: { type: Object, required: true },
  gridSize: { type: Number, required: true },
  selected: { type: Boolean, default: false },
  waypoints: { type: Array, default: () => [] },
})
const emit = defineEmits(['select'])

const position = computed(() => worldToScreen(props.unit.x, props.unit.y, props.gridSize))
const facing = computed(() => props.unit.facing ?? 1)
const body = computed(() => getUnitView(facing.value, props.unit.type, props.gridSize))
const groupColor = computed(() => getGroupColor(props.unit.group))
// Линия к цели атаки красная, линия движения — жёлтая
const ATTACK_COLOR = '#ff6b5a'
const routeColor = computed(() => props.waypoints[0]?.attack ? ATTACK_COLOR : '#ffe08a')
const marks = computed(() => props.waypoints.map(point => ({
  id: point.id,
  attack: point.attack,
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
