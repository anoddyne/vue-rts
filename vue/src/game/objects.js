// Объекты мира: юниты и здания. Характеристики объекта задаются его типом из UNIT_TYPES / BUILDING_TYPES.
export const OBJECT_KINDS = {
  UNIT: 'unit',
  BUILDING: 'building',
}

export const UNIT_TYPES = {
  VILLAGER: { name: 'Крестьянин', speed: 70, radius: 9, maxHealth: 25, color: '#ffd376' },
  MILITIA: { name: 'Ополченец', speed: 95, radius: 10, maxHealth: 40, color: '#e07b5a' },
  SCOUT: { name: 'Разведчик', speed: 160, radius: 12, maxHealth: 45, color: '#8ab4e8' },
}

// size — сторона квадратного основания в мировых единицах (на экране — ромб), height — высота стен в пикселях
export const BUILDING_TYPES = {
  TOWN_CENTER: { name: 'Городской центр', size: 160, height: 48, maxHealth: 2400, color: '#b08a5a' },
  HOUSE: { name: 'Дом', size: 80, height: 28, maxHealth: 550, color: '#c9a678' },
  BARRACKS: { name: 'Казармы', size: 120, height: 36, maxHealth: 1200, color: '#9c7b55' },
}

// Группы игроков. Цвет обводки выделяет группу на карте, имя показывается в панели выбора.
export const GROUP_COLORS = {
  1: { unit: '#493618', building: '#3b2a17' },
  2: { unit: '#8f2f21', building: '#6f2419' },
  3: { unit: '#4c3a86', building: '#3a2c68' },
}

export const getGroupStyle = (group) => GROUP_COLORS[group] ?? GROUP_COLORS[1]
export const getGroupName = (group) => `Группа ${group}`

let nextId = 1

export const createUnit = (type, x, y, group = 1) => ({
  id: nextId++,
  kind: OBJECT_KINDS.UNIT,
  type,
  x,
  y,
  group,
  health: type.maxHealth,
})

export const createBuilding = (type, x, y, group = 1) => ({
  id: nextId++,
  kind: OBJECT_KINDS.BUILDING,
  type,
  x,
  y,
  group,
  health: type.maxHealth,
})

export const isUnit = (object) => object.kind === OBJECT_KINDS.UNIT
export const isBuilding = (object) => object.kind === OBJECT_KINDS.BUILDING

// Задевает ли круг радиуса radius с центром (x, y) квадратное основание здания
export const circleOverlapsBuilding = (x, y, radius, building) => {
  const half = building.type.size / 2
  const nearestX = Math.max(building.x - half, Math.min(x, building.x + half))
  const nearestY = Math.max(building.y - half, Math.min(y, building.y + half))
  return Math.hypot(x - nearestX, y - nearestY) < radius
}

// Задевает ли круг юнита в точке (x, y) квадратное основание здания
const overlapsBuilding = (unit, x, y, building) => circleOverlapsBuilding(x, y, unit.type.radius, building)

export const MOVE_RESULT = {
  MOVING: 'moving',
  DONE: 'done',
  BLOCKED: 'blocked',
}

// Шаг юнита к точке на speed * delta мировых единиц.
// Координаты меняются на месте. Если шаг заходит в здание, юнит остаётся где был.
export const stepToward = (unit, target, delta, buildings) => {
  const dx = target.x - unit.x
  const dy = target.y - unit.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return { status: MOVE_RESULT.DONE, remaining: delta }

  const step = unit.type.speed * delta
  const reached = distance <= step
  const next = reached
    ? target
    : { x: unit.x + (dx / distance) * step, y: unit.y + (dy / distance) * step }

  if (buildings.some(building => overlapsBuilding(unit, next.x, next.y, building))) {
    return { status: MOVE_RESULT.BLOCKED, remaining: 0 }
  }

  unit.x = next.x
  unit.y = next.y
  if (!reached) return { status: MOVE_RESULT.MOVING, remaining: 0 }
  return { status: MOVE_RESULT.DONE, remaining: Math.max(0, delta - distance / unit.type.speed) }
}

// Глубина объекта для изометрии по его центру: чем больше x + y, тем ближе объект к зрителю
export const getDepth = (object) => object.x + object.y
