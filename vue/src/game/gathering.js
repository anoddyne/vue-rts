import { getContact, isResource, MOVE_RESULT, stepToward } from './objects.js'
import { findPath, isPathClear } from './pathfinding.js'

const WORK_RANGE = 12
const GATHER_INTERVAL = 1

const findRoute = (unit, target, buildings, map) => {
  const offset = (target.type.size ?? 0) / 2 + unit.type.radius + WORK_RANGE / 2
  const points = isResource(target) ? [target] : [
    { x: target.x - offset, y: target.y },
    { x: target.x + offset, y: target.y },
    { x: target.x, y: target.y - offset },
    { x: target.x, y: target.y + offset },
  ]
  const distance = point => Math.hypot(point.x - unit.x, point.y - unit.y)
  for (const point of points.sort((a, b) => distance(a) - distance(b))) {
    if (Math.abs(point.x) > map.width / 2 || Math.abs(point.y) > map.height / 2) continue
    const path = [...findPath(unit, point, buildings, map), { x: point.x, y: point.y }]
    if (path.every((waypoint, index) => isPathClear(path[index - 1] ?? unit, waypoint, unit, buildings))) return path
  }
  return null
}

const approach = (unit, target, event, time, buildings, map) => {
  if (getContact(unit, target).gap <= WORK_RANGE) {
    event.path = null
    return time
  }

  if (event.destinationId !== target.id || !event.path?.length) {
    event.destinationId = target.id
    event.path = findRoute(unit, target, buildings, map)
  }
  if (!event.path) return null

  while (event.path.length && time > 0) {
    const result = stepToward(unit, event.path[0], time, buildings)
    if (result.status === MOVE_RESULT.BLOCKED) return null
    if (result.status === MOVE_RESULT.MOVING) return 0
    event.path.shift()
    time = result.remaining
  }
  return time
}

// null завершает приказ, число — остаток времени после завершения или 0 до следующего кадра.
export const gatherFrame = (unit, source, event, time, buildings, map) => {
  const capacity = unit.type.carryCapacity
  if (!capacity) return null

  while (time > 0) {
    const cargoTypeChanged = unit.cargo > 0 && unit.cargoType !== source?.resourceType
    if (unit.cargo >= capacity || !source?.stock || event.warehouseId || cargoTypeChanged) {
      if (!unit.cargo) return time
      const warehouses = buildings.filter(building =>
        building.type.storesResources && building.group === unit.group && building.health > 0)
      const warehouse = warehouses.find(building => building.id === event.warehouseId)
        ?? warehouses.sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y)
          - Math.hypot(b.x - unit.x, b.y - unit.y))[0]
      if (!warehouse) return 0
      event.warehouseId = warehouse.id

      time = approach(unit, warehouse, event, time, buildings, map)
      if (time === null || time === 0) return time
      warehouse.storedResources[unit.cargoType] += unit.cargo
      unit.cargo = 0
      unit.cargoType = null
      event.warehouseId = null
      event.gatherTime = 0
      continue
    }

    time = approach(unit, source, event, time, buildings, map)
    if (time === null || time === 0) return time
    const spent = Math.min(time, GATHER_INTERVAL - event.gatherTime)
    time -= spent
    event.gatherTime += spent
    if (event.gatherTime >= GATHER_INTERVAL - 1e-9) {
      source.stock--
      unit.cargoType = source.resourceType
      unit.cargo++
      event.gatherTime = 0
    }
  }
  return 0
}
