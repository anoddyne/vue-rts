import { clampToMap, worldToScreen, screenToWorld } from '@/game/map.js'
import { isUnit, isBuilding, getDepth } from '@/game/objects.js'
import { issueMoveOrders, nextFrame } from '@/game/events.js'
import { createScenarioState, getScenario } from '@/game/scenarios.js'

const MUTATIONS = {
  SET_SELECTED: 'SET_SELECTED',
  SET_EVENTS: 'SET_EVENTS',
  SET_PAUSED: 'SET_PAUSED',
  SET_GAME_OVER: 'SET_GAME_OVER',
  START: 'START',
  TICK: 'TICK',
}

const FORMATION_SPACING = 24

// Конец игры: у одной группы остались все объекты, а остальные группы исчезли.
// Проверяется после каждого кадра — сработает, как только в игре появятся смерти объектов.
const detectGameOver = (state) => {
  if (state.startedGroups < 2 || state.gameOver) return null
  const alive = new Set(state.elements.map(element => element.group))
  if (alive.size > 1) return null
  return { winner: alive.size ? [...alive][0] : null }
}

export default {
  namespaced: true,
  state () {
    return createScenarioState('sandbox')
  },
  getters: {
    getMap: (state) => state.map,
    getElements: (state) => state.elements,
    getEvents: (state) => state.events,
    getUnits: (state) => state.elements.filter(isUnit),
    getBuildings: (state) => state.elements.filter(isBuilding),
    getBuildings: (state) => state.elements.filter(isBuilding),
    // Порядок отрисовки для изометрии: дальние объекты раньше, ближние поверх
    getDrawOrder: (state) => [...state.elements].sort((a, b) => getDepth(a) - getDepth(b)),
    getSelected: (state) => state.elements.filter(element => state.selectedIds.includes(element.id)),
    isSelected: (state) => (id) => state.selectedIds.includes(id),
    // Точки цепочки юнита в порядке выполнения
    getWaypoints: (state) => (elementId) => state.events
      .filter(event => event.elementId === elementId)
      .sort((a, b) => a.order - b.order),
    isPaused: (state) => state.paused,
    getGameOver: (state) => state.gameOver,
    getScenarioId: (state) => state.scenarioId,
    // Куда встаёт камера при запуске сценария
    getHomeView: (state) => state.homeView,
  },
  mutations: {
    [MUTATIONS.SET_SELECTED]: (state, ids) => {
      state.selectedIds = ids
    },
    [MUTATIONS.SET_EVENTS]: (state, events) => {
      state.events = events
    },
    [MUTATIONS.SET_PAUSED]: (state, paused) => {
      state.paused = paused
    },
    [MUTATIONS.SET_GAME_OVER]: (state, gameOver) => {
      state.gameOver = gameOver
    },
    [MUTATIONS.START]: (state, fresh) => {
      Object.assign(state, fresh)
    },
    [MUTATIONS.TICK]: (state, delta) => {
      state.events = nextFrame(state.elements, state.events, delta, state.map)
      state.gameOver = detectGameOver(state) ?? state.gameOver
    },
  },
  actions: {
    // Запуск подготовленного сценария: мир пересоздаётся, пауза и конец игры сбрасываются
    start: (store, id) => {
      if (!getScenario(id)) return
      store.commit(MUTATIONS.START, createScenarioState(id))
    },
    togglePause: (store) => {
      store.commit(MUTATIONS.SET_PAUSED, !store.state.paused)
    },
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
      if (store.state.gameOver) return
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
    // Пауза и конец игры останавливают мир; камера при этом продолжает работать
    tick: (store, delta) => {
      if (store.state.paused || store.state.gameOver) return
      store.commit(MUTATIONS.TICK, delta)
    },
  },
}
