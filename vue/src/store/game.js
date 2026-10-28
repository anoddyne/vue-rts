import { createMap, clampToMap, worldToScreen, screenToWorld } from '@/game/map.js'
import { UNIT_TYPES, BUILDING_TYPES, createUnit, createBuilding, isUnit, isBuilding, getDepth } from '@/game/objects.js'
import { issueMoveOrders, nextFrame } from '@/game/events.js'

const MUTATIONS = {
  SET_SELECTED: 'SET_SELECTED',
  SET_EVENTS: 'SET_EVENTS',
  TICK: 'TICK',
}

const FORMATION_SPACING = 24

export default {
  namespaced: true,
  state () {
    return {
      map: createMap(3200, 2400, 40),
      // Элементы карты — текущая действительность: позиции, типы, здоровье.
      elements: [
        createBuilding(BUILDING_TYPES.TOWN_CENTER, -200, -200),
        createBuilding(BUILDING_TYPES.HOUSE, -440, -120),
        createBuilding(BUILDING_TYPES.BARRACKS, -160, 120),
        createUnit(UNIT_TYPES.VILLAGER, 40, -80),
        createUnit(UNIT_TYPES.VILLAGER, 80, -40),
        createUnit(UNIT_TYPES.VILLAGER, 120, 0),
        createUnit(UNIT_TYPES.MILITIA, 80, 120),
        createUnit(UNIT_TYPES.MILITIA, 120, 160),
        createUnit(UNIT_TYPES.SCOUT, 240, -40),
      ],
      // Текущие события. Цепочка одного юнита связана общим linkId и идёт по order.
      events: [],
      selectedIds: [],
    }
  },
  getters: {
    getMap: (state) => state.map,
    getElements: (state) => state.elements,
    getEvents: (state) => state.events,
    getUnits: (state) => state.elements.filter(isUnit),
    getBuildings: (state) => state.elements.filter(isBuilding),
    // Порядок отрисовки для изометрии: дальние объекты раньше, ближние поверх
    getDrawOrder: (state) => [...state.elements].sort((a, b) => getDepth(a) - getDepth(b)),
    getSelected: (state) => state.elements.filter(element => state.selectedIds.includes(element.id)),
    isSelected: (state) => (id) => state.selectedIds.includes(id),
    // Точки цепочки юнита в порядке выполнения
    getWaypoints: (state) => (elementId) => state.events
      .filter(event => event.elementId === elementId)
      .sort((a, b) => a.order - b.order),
  },
  mutations: {
    [MUTATIONS.SET_SELECTED]: (state, ids) => {
      state.selectedIds = ids
    },
    [MUTATIONS.SET_EVENTS]: (state, events) => {
      state.events = events
    },
    [MUTATIONS.TICK]: (state, delta) => {
      state.events = nextFrame(state.elements, state.events, delta)
    },
  },
  actions: {
    // additive — Shift: клик по выбранному убирает его из выбора, по невыбранному — добавляет
    select: (store, { id, additive }) => {
      if (!additive) {
        store.commit(MUTATIONS.SET_SELECTED, [id])
        return
      }
      const selected = store.state.selectedIds
      store.commit(MUTATIONS.SET_SELECTED, selected.includes(id)
        ? selected.filter(selectedId => selectedId !== id)
        : [...selected, id])
    },
    clearSelection: (store) => {
      store.commit(MUTATIONS.SET_SELECTED, [])
    },
    // Рамка приходит в экранных (изометрических) координатах SVG, рамкой выбираются только юниты.
    // additive — Shift: рамка добавляет юнитов к уже выбранным
    selectArea: (store, { left, top, right, bottom, additive }) => {
      const { gridSize } = store.state.map
      const ids = store.getters.getUnits
        .filter(unit => {
          const point = worldToScreen(unit.x, unit.y, gridSize)
          return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
        })
        .map(unit => unit.id)
      store.commit(MUTATIONS.SET_SELECTED, additive
        ? [...new Set([...store.state.selectedIds, ...ids])]
        : ids)
    },
    // Приказ идти. queue — дописать точку в цепочку (Shift), иначе заменить текущие события.
    moveSelected: (store, { x, y, queue = false }) => {
      const { map } = store.state
      const units = store.getters.getSelected.filter(isUnit)
      if (!units.length) return

      const destination = worldToScreen(x, y, map.gridSize)
      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)

      const orders = units.map((unit, index) => {
        const row = Math.floor(index / columns)
        const countInRow = Math.min(columns, units.length - row * columns)
        const column = index % columns
        const target = screenToWorld(
          destination.x + (column - (countInRow - 1) / 2) * FORMATION_SPACING,
          destination.y + (row - (rows - 1) / 2) * FORMATION_SPACING,
          map.gridSize,
        )
        const point = clampToMap(target, map)
        return { elementId: unit.id, x: point.x, y: point.y }
      })

      store.commit(MUTATIONS.SET_EVENTS, issueMoveOrders(store.state.events, orders, queue))
    },
    tick: (store, delta) => {
      store.commit(MUTATIONS.TICK, delta)
    },
  },
}
