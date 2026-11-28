import { clampToMap, worldToScreen, screenToWorld } from '@/game/map.js'
import {
  UNIT_TYPES,
  BUILDING_TYPES,
  isUnit,
  isBuilding,
  getDepth,
  createUnit,
  createBuilding,
  findSpawnPoint,
  circleOverlapsBuilding,
} from '@/game/objects.js'
import { EVENT_TYPES, issueOrders, nextFrame } from '@/game/events.js'
import { createScenarioState, getScenario } from '@/game/scenarios.js'
import { isWater } from '@/game/terrain.js'
import { PLAYER_NATION_ID, relationKey, DEFAULT_RELATION } from '@/game/nations.js'

// Проверка, занята ли точка другим объектом (коллизия)
const isOccupied = (x, y, radius, elements, ignoreId = null) => {
  // Защита от ошибок: если elements не массив, ничего не проверяем
  if (!Array.isArray(elements)) return false

  return elements.some(el => {
    if (el.id === ignoreId) return false
    if (el.kind === 'building') {
      return circleOverlapsBuilding(x, y, radius, el)
    } else {
      const dist = Math.hypot(el.x - x, el.y - y)
      return dist < (el.type.radius + radius)
    }
  })
}

const MUTATIONS = {
  SET_SELECTED: 'SET_SELECTED',
  SET_EVENTS: 'SET_EVENTS',
  ADD_ELEMENT: 'ADD_ELEMENT',
  SET_PAUSED: 'SET_PAUSED',
  SET_GAME_OVER: 'SET_GAME_OVER',
  SET_RELATION: 'SET_RELATION',
  ADD_GOLD: 'ADD_GOLD',
  START: 'START',
  TICK: 'TICK',
}

const FORMATION_SPACING = 24

// Число юнитов нации
const nationUnitCount = (state, group) => state.elements
  .filter(element => element.kind === 'unit' && element.group === group).length

// Финал игры по режиму победы сценария (state.victory):
// - destruction (по умолчанию): осталась одна нация — все вражеские персонажи и здания уничтожены
// - extermination: у всех вражеских наций не осталось персонажей; поражение — у нации игрока
//   не осталось юнитов (побеждает враг с наибольшим отрядом)
// - economy: нация игрока накопила goal золота
const detectGameOver = (state) => {
  if (state.gameOver) return null
  const mode = state.victory?.mode ?? 'destruction'

  if (mode === 'economy') {
    return (state.gold[PLAYER_NATION_ID] ?? 0) >= (state.victory?.goal ?? Infinity)
      ? { winner: PLAYER_NATION_ID }
      : null
  }

  if (state.startedGroups < 2) return null

  const nationIds = state.nations.map(nation => nation.id)
  const hasUnits = (group) => nationUnitCount(state, group) > 0
  const hasAnything = (group) => state.elements.some(element => element.group === group)
  const alive = nationIds.filter(hasAnything)

  // Разрушение: осталась одна нация — она и победила
  if (mode === 'destruction') {
    if (alive.length <= 1) return { winner: alive[0] ?? null }
    return null
  }

  // Уничтожение: у всех вражеских наций не осталось персонажей
  const enemies = nationIds.filter(id => id !== PLAYER_NATION_ID
    && (state.relations[relationKey(PLAYER_NATION_ID, id)] ?? DEFAULT_RELATION) === 'enemy')
  if (enemies.length && enemies.every(id => !hasUnits(id))) return { winner: PLAYER_NATION_ID }

  // Поражение: у нации игрока не осталось юнитов — побеждает враг с наибольшим отрядом
  if (!hasUnits(PLAYER_NATION_ID)) {
    const survivors = enemies.filter(hasUnits)
    const strongest = survivors.sort((a, b) => nationUnitCount(state, b) - nationUnitCount(state, a))[0]
    return { winner: strongest ?? null }
  }
  return null
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
    // Порядок отрисовки для изометрии: дальние объекты раньше, ближние поверх
    getDrawOrder: (state) => [...state.elements].sort((a, b) => getDepth(a) - getDepth(b)),
    getSelected: (state) => state.elements.filter(element => state.selectedIds.includes(element.id)),
    isSelected: (state) => (id) => state.selectedIds.includes(id),
    // Точки цепочки юнита в порядке выполнения. Для атаки точка — текущая позиция цели,
    // path — обход зданий на подходе к цели, attack — признак атаки для отрисовки
    getWaypoints: (state) => (elementId) => state.events
      .filter(event => event.elementId === elementId)
      .sort((a, b) => a.order - b.order)
      .map(event => {
        if (event.type !== EVENT_TYPES.ATTACK) return event
        const target = state.elements.find(element => element.id === event.targetId)
        if (!target) return null
        return { id: event.id, x: target.x, y: target.y, path: event.path?.length ? [...event.path, target] : null, attack: true }
      })
      .filter(Boolean),
    isPaused: (state) => state.paused,
    // Нации сценария и отношения между ними (по умолчанию все пары — «враги»)
    getNations: (state) => state.nations,
    getNation: (state) => (id) => state.nations.find(nation => nation.id === id),
    getRelation: (state) => (a, b) => a === b
      ? 'ally'
      : (state.relations[relationKey(a, b)] ?? DEFAULT_RELATION),
    // Военная сила нации: сумма силы её юнитов
    getNationStrength: (state) => (group) => state.elements
      .filter(element => element.kind === 'unit' && element.group === group)
      .reduce((sum, unit) => sum + (unit.type.strength ?? 0), 0),
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
    [MUTATIONS.ADD_ELEMENT]: (state, element) => {
      state.elements.push(element)
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
    [MUTATIONS.SET_RELATION]: (state, { a, b, relation }) => {
      state.relations[relationKey(a, b)] = relation
    },
    [MUTATIONS.ADD_GOLD]: (state, { nationId, amount }) => {
      state.gold[nationId] = (state.gold[nationId] ?? 0) + amount
    },
    [MUTATIONS.TICK]: (state, delta) => {
      state.elements.forEach(element => {
        if (isUnit(element)) element.attackCooldown = Math.max(0, element.attackCooldown - delta)
      })
      state.events = nextFrame(state.elements, state.events, delta, state.map)
      // Объекты с нулевым здоровьем убираются с карты и из выбора
      if (state.elements.some(element => element.health <= 0)) {
        state.elements = state.elements.filter(element => element.health > 0)
        state.selectedIds = state.selectedIds.filter(id => state.elements.some(element => element.id === id))
      }
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
    build: (store, { buildingType, x, y }) => {
      if (store.state.gameOver) return
      const { map } = store.state

      const type = BUILDING_TYPES[buildingType]
      if (!type) return

      // Проверка на воду
      const halfSize = type.size / 2
      const corners = [
        { x: x - halfSize, y: y - halfSize },
        { x: x + halfSize, y: y - halfSize },
        { x: x - halfSize, y: y + halfSize },
        { x: x + halfSize, y: y + halfSize }
      ]

      // Если хотя бы один угол попадает в воду, отменяем стройку
      if (corners.some(corner => isWater(corner.x, corner.y))) {
        console.warn("Нельзя строить на воде (задевает край)!")
        return
      }

      // Проверка коллизий (чтобы здание не налезло на других)
      // Для здания радиус примерно равен половине его размера
      const radius = type.size / 2
      if (isOccupied(x, y, radius, store.state.elements, null)) {
        console.warn("Место занято!")
        return
      }

      const newBuilding = createBuilding(type, x, y, 1) // 1 - это группа игрока
      store.commit(MUTATIONS.ADD_ELEMENT, newBuilding)

    },

    // Приказ выбранным юнитам по ПКМ. queue — дописать в цепочку (Shift), иначе заменить текущие события.
    // targetId — ПКМ по объекту: юниты других групп атакуют его, юниты его группы идут в точку (x, y).
    commandSelected: (store, { x, y, queue = false, targetId = null }) => {
      if (store.state.gameOver) return
      const { map } = store.state
      const selected = store.getters.getSelected.filter(isUnit)
      if (!selected.length) return

      const target = targetId !== null && store.state.elements.find(element => element.id === targetId)
      // Атакуют только юниты, чья нация враждебна нации цели (по умолчанию враждебны все)
      const attackers = target
        ? selected.filter(unit => store.getters.getRelation(unit.group, target.group) === 'enemy')
        : []
      const units = selected.filter(unit => !attackers.includes(unit))
      const attackOrders = attackers.map(unit => ({ elementId: unit.id, targetId: target.id }))

      const destination = worldToScreen(x, y, map.gridSize)
      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)

      const orders = units.map((unit, index) => {
        const row = Math.floor(index / columns)
        const countInRow = Math.min(columns, units.length - row * columns)
        const column = index % columns
        const formationPoint = screenToWorld(
          destination.x + (column - (countInRow - 1) / 2) * FORMATION_SPACING,
          destination.y + (row - (rows - 1) / 2) * FORMATION_SPACING,
          map.gridSize,
        )
        const point = clampToMap(formationPoint, map)

        // 1. Проверка на воду
        const canSwim = unit.canSwim || false
        if (isWater(point.x, point.y) && !canSwim) {
          return null
        }

        // 2. Проверка на наложение: точка занята другим объектом — сдвигаем по диагонали,
        // пока не освободится (и не попадём в воду)
        let finalX = point.x
        let finalY = point.y
        let attempts = 0
        // Плавающий юнит может быть сдвинут в воду, сухопутному вода в натиске запрещена
        while ((isOccupied(finalX, finalY, unit.type.radius, store.state.elements, unit.id) || (!unit.canSwim && isWater(finalX, finalY))) && attempts < 10) {
          finalX += 20
          finalY += 20
          attempts++
        }

        // Натиск не нашёл свободного сухого места — приказ в воду сухопутному юниту отбрасывается
        if (!unit.canSwim && isWater(finalX, finalY)) return null

        return { elementId: unit.id, x: finalX, y: finalY }
      })

      // Убираем null из массива заказов
      const validOrders = orders.filter(order => order !== null)
      // И передаем именно validOrders
      store.commit(MUTATIONS.SET_EVENTS, issueOrders(store.state.events, [...attackOrders, ...validOrders], queue))
    },
    // Мгновенное создание юнита рядом со зданием. Юнит получает группу здания.
    // Тип юнита должен быть в списке spawns здания; если рядом нет свободного места, юнит не создаётся.
    // Политика: предложить союз нации. Сильная нация отказывает слабому просителю,
    // если у неё нет врага сильнее неё (тогда союз спасает положение) — тогда союз заключается.
    proposeAlliance: (store, nationId) => {
      if (nationId === PLAYER_NATION_ID || store.state.gameOver) return false
      const player = PLAYER_NATION_ID
      const strengthOf = (group) => store.getters.getNationStrength(group)
      if (strengthOf(nationId) > strengthOf(player)) {
        const threatened = store.state.nations.some(nation => nation.id !== nationId && nation.id !== player
          && store.getters.getRelation(nationId, nation.id) === 'enemy'
          && store.getters.getNationStrength(nation.id) > strengthOf(nationId))
        if (!threatened) return false
      }
      store.commit(MUTATIONS.SET_RELATION, { a: player, b: nationId, relation: 'ally' })
      return true
    },
    // Политика: объявить нацию врагом — без запроса, сразу
    declareEnemy: (store, nationId) => {
      if (nationId === PLAYER_NATION_ID || store.state.gameOver) return
      store.commit(MUTATIONS.SET_RELATION, { a: PLAYER_NATION_ID, b: nationId, relation: 'enemy' })
    },
    spawn: (store, { buildingId, unitType }) => {
      if (store.state.gameOver) return
      const building = store.state.elements.find(element => element.id === buildingId)
      if (!building || !isBuilding(building) || !building.type.spawns.includes(unitType)) return
      const type = UNIT_TYPES[unitType]
      const point = findSpawnPoint(building, type, store.state.elements, store.state.map)
      if (!point) return
      store.commit(MUTATIONS.ADD_ELEMENT, createUnit(type, point.x, point.y, building.group))
    },
    // Пауза и конец игры останавливают мир; камера при этом продолжает работать
    tick: (store, delta) => {
      if (store.state.paused || store.state.gameOver) return
      store.commit(MUTATIONS.TICK, delta)
    },
    // Экшен для самоуничтожения юнита.
    // Мы не удаляем объект из массива вручную, а просто обнуляем ему здоровье.
    // Игровой цикл (мутация TICK) сам увидит, что health <= 0, и безопасно удалит его.
    destroyObject: (store, id) => {
      if (store.state.paused || store.state.gameOver) return
      const element = store.state.elements.find(el => el.id === id && el.kind === 'unit')
      if (element) {
        element.health = 0
      }
    },
  },
}
