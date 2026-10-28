// События отдельно от элементов карты. Кадр — это применение текущих событий к элементам.
// Цепочка одного юнита делит linkId: событие с меньшим order выполняется первым,
// после его завершения в том же кадре начинается следующее.
import { isBuilding, isUnit, MOVE_RESULT, stepToward } from './objects.js'

export const EVENT_TYPES = {
  MOVE: 'move',
}

let nextEventId = 1
let nextLinkId = 1

export const createMoveEvent = (elementId, linkId, order, x, y) => ({
  id: nextEventId++,
  type: EVENT_TYPES.MOVE,
  elementId,
  linkId,
  order,
  x,
  y,
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
// Если путь упирается в здание, снимается вся оставшаяся цепочка этого юнита.
export const nextFrame = (elements, events, delta) => {
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
      const result = stepToward(element, event, time, buildings)
      if (result.status === MOVE_RESULT.MOVING) return

      if (result.status === MOVE_RESULT.BLOCKED) {
        chain.slice(index).forEach(item => removeIds.add(item.id))
        return
      }

      removeIds.add(event.id)
      time = result.remaining
    }
  })

  if (!removeIds.size) return events
  return events.filter(event => !removeIds.has(event.id))
}
