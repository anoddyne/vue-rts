// События отдельно от элементов карты. Кадр — это применение текущих событий к элементам.
// Цепочка одного юнита делит linkId: событие с меньшим order выполняется первым,
// после его завершения в том же кадре начинается следующее.
import { isBuilding, isUnit, MOVE_RESULT, stepToward } from './objects.js'
import { findPath } from './pathfinding.js'

export const EVENT_TYPES = {
  MOVE: 'move',
}

let nextEventId = 1
let nextLinkId = 1

// path — точки обходного маршрута вокруг зданий; вычисляется при первом кадре события
// (от реальной позиции юнита) и живёт внутри этого же события. Пустой массив — путь по прямой.
export const createMoveEvent = (elementId, linkId, order, x, y) => ({
  id: nextEventId++,
  type: EVENT_TYPES.MOVE,
  elementId,
  linkId,
  order,
  x,
  y,
  path: null,
})

const chainOf = (events, elementId) => events
  .filter(event => event.elementId === elementId)
  .sort((a, b) => a.order - b.order)

// queue: дописать точку в текущую цепочку. Иначе прежние события этих юнитов заменяются.
export const issueMoveOrders = (events, orders, queue) => {
  const elementIds = new Set(orders.map(order => order.elementId))
  const next = queue ? events.slice() : events.filter(event => !elementIds.has(event.elementId))

  orders.forEach(order => {
    const chain = chainOf(next, order.elementId)
    const linkId = chain.length ? chain[0].linkId : nextLinkId++
    const orderIndex = chain.reduce((max, event) => Math.max(max, event.order), -1) + 1
    next.push(createMoveEvent(order.elementId, linkId, orderIndex, order.x, order.y))
  })

  return next
}

// Следующий кадр. Координаты элементов обновляются на месте.
// Законченное событие снимается с очереди, остаток времени кадра уходит следующему в той же связи.
// Юнит идёт по точкам обходного маршрута события; если шаг всё же упирается в здание,
// снимается вся оставшаяся цепочка этого юнита.
export const nextFrame = (elements, events, delta, map) => {
  if (!events.length || delta <= 0) return events

  const buildings = elements.filter(isBuilding)
  const byId = new Map(elements.map(element => [element.id, element]))
  const removeIds = new Set()

  const elementIds = new Set(events.map(event => event.elementId))
  elementIds.forEach(elementId => {
    const element = byId.get(elementId)
    const chain = chainOf(events, elementId)
    if (!element || !isUnit(element)) {
      chain.forEach(event => removeIds.add(event.id))
      return
    }

    let time = delta
    for (let index = 0; index < chain.length && time > 0; index++) {
      const event = chain[index]
      if (!event.path) event.path = findPath(element, event, buildings, map) ?? []

      // Точки маршрута внутри одного события: дойдя до очередной, сразу идём к следующей
      for (;;) {
        const waypoint = event.path.length ? event.path[0] : event
        const result = stepToward(element, waypoint, time, buildings)
        if (result.status === MOVE_RESULT.MOVING) return

        if (result.status === MOVE_RESULT.BLOCKED) {
          chain.slice(index).forEach(item => removeIds.add(item.id))
          return
        }

        time = result.remaining
        if (event.path.length) {
          event.path.shift()
          continue
        }
        removeIds.add(event.id)
        break
      }
    }
  })

  if (!removeIds.size) return events
  return events.filter(event => !removeIds.has(event.id))
}
