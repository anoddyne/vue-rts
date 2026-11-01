<template>
  <div class="selection-panel">
    <div class="selection-panel__info">
      <template v-if="!objects.length">Ничего не выбрано</template>
      <template v-else-if="objects.length === 1">
        <b>{{ objects[0].type.name }}</b>
        <div>{{ getGroupName(objects[0].group) }}</div>
        <div>Здоровье: {{ objects[0].health }} / {{ objects[0].type.maxHealth }}</div>
        <div v-if="objects[0].type.speed">Скорость: {{ objects[0].type.speed }}</div>
        <div>Позиция: {{ Math.round(objects[0].x) }}, {{ Math.round(objects[0].y) }}</div>
        <div v-if="objects[0].type.spawns?.length" class="selection-panel__spawn">
          <button
              v-for="key in objects[0].type.spawns"
              :key="key"
              type="button"
              @mousedown.prevent
              @click="emit('spawn', { buildingId: objects[0].id, unitType: key })"
          >
            {{ UNIT_TYPES[key].name }}
          </button>
        </div>
      </template>
      <template v-else>
        <b>Выбрано: {{ objects.length }}</b>
        <div v-for="(count, name) in counts" :key="name">{{ name }} × {{ count }}</div>
      </template>
    </div>
    <div class="selection-panel__hint">
      ЛКМ — выбрать, Shift+ЛКМ — добавить/убрать из выбора<br>
      Рамка — выбрать группу, Shift+рамка — добавить группу к выбору<br>
      ПКМ — идти (всем выбранным), Shift+ПКМ — следующая точка, Esc — снять выбор<br>
      Пробел — пауза. Камера: WASD / стрелки / курсор у края / зажатое колесо, масштаб — колесо мыши<br>
      <RouterLink :to="{ name: $routes.INDEX }">В меню</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { UNIT_TYPES, getGroupName } from '@/game/objects.js'

const props = defineProps({
  objects: { type: Array, required: true },
})
const emit = defineEmits(['spawn'])

const counts = computed(() => props.objects.reduce((result, object) => {
  result[object.type.name] = (result[object.type.name] || 0) + 1
  return result
}, {}))
</script>

<style scoped lang="scss">
.selection-panel {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  min-height: 110px;
  padding: 8px 16px;
  border-top: 1px solid #66805b;
  background: #1b2719;
  color: #f0f4e7;

  &__spawn {
    display: flex;
    gap: 8px;
    margin-top: 6px;

    button {
      padding: 4px 12px;
      border: 1px solid #66805b;
      background: #243421;
      color: #f0f4e7;
      cursor: pointer;

      &:hover {
        background: #354c2e;
      }
    }
  }

  &__hint {
    color: #b9cba5;
    text-align: right;
  }
}
</style>
