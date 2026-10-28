// Подготовленные сценарии: расстановка зданий и юнитов по группам.
// Объект задается строкой [kind, TYPE_KEY, x, y, group]. Запуск сценария пересоздаёт состояние модуля game.
import { createMap, worldToScreen } from './map.js'
import { UNIT_TYPES, BUILDING_TYPES, createUnit, createBuilding } from './objects.js'

export const SCENARIOS = [
  {
    id: 'sandbox',
    name: 'Песочница',
    description: 'Одна группа, свободное перемещение по карте.',
    objects: [
      ['building', 'TOWN_CENTER', -200, -200, 1],
      ['building', 'HOUSE', -440, -120, 1],
      ['building', 'BARRACKS', -160, 120, 1],
      ['unit', 'VILLAGER', 40, -80, 1],
      ['unit', 'VILLAGER', 80, -40, 1],
      ['unit', 'VILLAGER', 120, 0, 1],
      ['unit', 'MILITIA', 80, 120, 1],
      ['unit', 'MILITIA', 120, 160, 1],
      ['unit', 'SCOUT', 240, -40, 1],
    ],
  },
  {
    id: 'duel',
    name: 'Дуэль',
    description: 'Две группы в противоположных углах карты.',
    objects: [
      // Группа 1 — верхний угол
      ['building', 'TOWN_CENTER', -1150, -950, 1],
      ['building', 'BARRACKS', -1350, -770, 1],
      ['building', 'HOUSE', -970, -1130, 1],
      ['unit', 'VILLAGER', -950, -850, 1],
      ['unit', 'MILITIA', -890, -810, 1],
      ['unit', 'MILITIA', -1000, -800, 1],
      ['unit', 'SCOUT', -830, -900, 1],
      // Группа 2 — нижний угол
      ['building', 'TOWN_CENTER', 1150, 950, 2],
      ['building', 'BARRACKS', 1350, 770, 2],
      ['building', 'HOUSE', 970, 1130, 2],
      ['unit', 'VILLAGER', 950, 850, 2],
      ['unit', 'MILITIA', 890, 810, 2],
      ['unit', 'MILITIA', 1000, 800, 2],
      ['unit', 'SCOUT', 830, 900, 2],
    ],
  },
  {
    id: 'threeway',
    name: 'Три группы',
    description: 'Три группы у трёх углов ромба карты.',
    objects: [
      // Группа 1 — верхний угол
      ['building', 'TOWN_CENTER', -1150, -950, 1],
      ['building', 'HOUSE', -1330, -790, 1],
      ['unit', 'VILLAGER', -900, -930, 1],
      ['unit', 'MILITIA', -960, -870, 1],
      ['unit', 'SCOUT', -840, -1010, 1],
      // Группа 2 — левый угол
      ['building', 'TOWN_CENTER', -1150, 950, 2],
      ['building', 'HOUSE', -1330, 790, 2],
      ['unit', 'VILLAGER', -900, 930, 2],
      ['unit', 'MILITIA', -960, 870, 2],
      ['unit', 'SCOUT', -840, 1010, 2],
      // Группа 3 — нижний угол
      ['building', 'TOWN_CENTER', 1150, 950, 3],
      ['building', 'HOUSE', 1330, 790, 3],
      ['unit', 'VILLAGER', 900, 930, 3],
      ['unit', 'MILITIA', 960, 870, 3],
      ['unit', 'SCOUT', 840, 1010, 3],
    ],
  },
]

export const getScenario = (id) => SCENARIOS.find(scenario => scenario.id === id)

// Начальное состояние модуля game для сценария
export const createScenarioState = (id) => {
  const scenario = getScenario(id) ?? SCENARIOS[0]
  const elements = scenario.objects.map(([kind, type, x, y, group]) => kind === 'unit'
    ? createUnit(UNIT_TYPES[type], x, y, group)
    : createBuilding(BUILDING_TYPES[type], x, y, group))
  const groups = new Set(elements.map(element => element.group))
  return {
    map: createMap(3200, 2400, 40),
    scenarioId: scenario.id,
    // Сколько групп было на карте при запуске; конец игры проверяется только если их было несколько
    startedGroups: groups.size,
    // Точка экрана, на которую камера встаёт при запуске сценария — центр базы группы 1
    homeView: createHomeView(elements, 40),
    elements,
    events: [],
    selectedIds: [],
    paused: false,
    gameOver: null,
  }
}

// Центр масс объектов группы 1 в экранных (изометрических) координатах
const createHomeView = (elements, gridSize) => {
  const home = elements.filter(element => element.group === 1)
  const source = home.length ? home : elements
  if (!source.length) return { x: 0, y: 0 }
  const x = source.reduce((sum, element) => sum + element.x, 0) / source.length
  const y = source.reduce((sum, element) => sum + element.y, 0) / source.length
  return worldToScreen(x, y, gridSize)
}
