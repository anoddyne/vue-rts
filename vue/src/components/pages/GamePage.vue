<template>
  <div class="game-page">
    <GameMap
        @tick="delta => store.dispatch('game/tick', delta)"
        @background-click="clearSelection"
        @cancel="clearSelection"
        @select-area="area => store.dispatch('game/selectArea', area)"
        @command="point => store.dispatch('game/moveSelected', point)"
    >
      <template v-for="object in objects" :key="object.id">
        <GameBuilding
            v-if="isBuilding(object)"
            :building="object"
            :grid-size="map.gridSize"
            :selected="isSelected(object.id)"
            @select="event => select(object.id, event)"
        />
        <GameUnit
            v-else
            :unit="object"
            :grid-size="map.gridSize"
            :selected="isSelected(object.id)"
            @select="event => select(object.id, event)"
        />
      </template>
    </GameMap>
    <SelectionPanel :objects="selected" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
import GameMap from '@/components/game/GameMap.vue'
import GameUnit from '@/components/game/GameUnit.vue'
import GameBuilding from '@/components/game/GameBuilding.vue'
import SelectionPanel from '@/components/game/SelectionPanel.vue'
import { isBuilding } from '@/game/objects.js'

const store = useStore()
const map = computed(() => store.getters['game/getMap'])
const objects = computed(() => store.getters['game/getDrawOrder'])
const selected = computed(() => store.getters['game/getSelected'])
const isSelected = (id) => store.getters['game/isSelected'](id)

// Shift+клик — добавить/убрать объект из выбора; Shift+клик по фону выбор не сбрасывает
const select = (id, event) => store.dispatch('game/select', { id, additive: Boolean(event?.shiftKey) })
const clearSelection = (event) => {
  if (event?.shiftKey) return
  store.dispatch('game/clearSelection')
}
</script>

<style scoped lang="scss">
.game-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
}
</style>
