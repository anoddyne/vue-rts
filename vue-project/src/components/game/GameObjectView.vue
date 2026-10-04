<!--
  Рисует один объект мира внутри SVG. Координаты берутся прямо из объекта (мировые),
  а переводом мира в экран занимается viewBox в GamePage.vue — поэтому здесь
  ни о камере, ни о масштабе думать не нужно.
-->
<template>
  <!-- Юнит: круг цвета владельца и буква-подпись в центре -->
  <g v-if="obj.kind === 'unit'" class="obj">
    <circle
      :cx="obj.x"
      :cy="obj.y"
      :r="obj.radius"
      :fill="color"
      :stroke="selected ? '#fff' : '#222'"
      :stroke-width="selected ? 3 : 1"
    />
    <text :x="obj.x" :y="obj.y" dy="0.35em" class="obj__label">{{ obj.label }}</text>
  </g>

  <!-- Здание: прямоугольник; x, y объекта — это центр, поэтому левый верхний угол = центр − половина размера -->
  <g v-else class="obj">
    <rect
      :x="obj.x - obj.width / 2"
      :y="obj.y - obj.height / 2"
      :width="obj.width"
      :height="obj.height"
      fill="#a8865a"
      :stroke="selected ? '#fff' : color"
      :stroke-width="selected ? 4 : 3"
    />
    <text :x="obj.x" :y="obj.y" dy="0.35em" class="obj__label obj__label--building">{{ obj.label }}</text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  // Объект мира из world.objects (юнит или здание)
  obj: {
    type: Object,
    required: true,
  },
  // Выбран ли объект — тогда рисуем белую обводку
  selected: {
    type: Boolean,
    default: false,
  },
})

// Цвет зависит от владельца: синий — игрок, красный — противник
const color = computed(() => {
  if (props.obj.owner === 'enemy') return '#d23b3b'
  return '#2f6fe0'
})
</script>

<style scoped lang="scss">
.obj {
  // Клики обрабатывает GamePage сам (по координатам), поэтому SVG-фигуры их не перехватывают
  pointer-events: none;

  &__label {
    fill: #fff;
    font-size: 14px;
    font-weight: bold;
    text-anchor: middle;

    &--building {
      font-size: 22px;
    }
  }
}
</style>
