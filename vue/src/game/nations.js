// Нации — участники игры. По умолчанию каждая нация враждебна всем остальным;
// отношения между парами могут переопределяться политикой (следующая задача).
import { getGroupColor } from './objects.js'

export const DEFAULT_RELATION = 'enemy'

// Ключ пары наций: порядок аргументов не важен
export const relationKey = (a, b) => [a, b].sort((x, y) => x - y).join(':')

// Нация: идентификатор совпадает с полем group у юнитов и зданий
export const createNation = (id, name) => ({ id, name, color: getGroupColor(id) })

// Отношения по умолчанию: каждая пара — «враги» (храним явно, чтобы политику можно
// было менять точечно, не трогая остальное состояние)
export const createRelations = (nationIds) => {
  const relations = {}
  for (let i = 0; i < nationIds.length; i++) {
    for (let j = i + 1; j < nationIds.length; j++) {
      relations[relationKey(nationIds[i], nationIds[j])] = DEFAULT_RELATION
    }
  }
  return relations
}
