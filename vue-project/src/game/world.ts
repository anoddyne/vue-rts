// =====================================================================
// Логика игрового мира. Здесь нет ничего от Vue — только данные и функции,
// которые эти данные меняют. Vue-компоненты лишь вызывают их и рисуют результат.
//
// Система координат мира:
//   - ось X направлена вправо, ось Y — вниз (как в SVG и на экране);
//   - точка (0, 0) — центр карты;
//   - единицы мира не равны пикселям: при масштабе 1 одна единица = один пиксель,
//     при масштабе 2 — два пикселя и т.д. (см. камеру в GamePage.vue).
// =====================================================================

// Счётчик для уникальных id объектов. Каждый новый объект получает следующий номер.
let nextId = 1

// Общая «фабрика» любого объекта мира: юнита или здания.
// Все объекты имеют одинаковый набор полей — так их проще хранить в одном списке
// и рисовать одним компонентом. Ненужные поля просто равны 0
// (у здания нет скорости, у юнита нет ширины и высоты).
// Новые характеристики (здоровье, атака, броня) добавляются сюда же.
const createObject = (data: any) => {
  return {
    id: nextId++,
    kind: data.kind, // 'unit' — юнит, 'building' — здание
    name: data.name, // название для панели внизу экрана
    label: data.label, // короткая подпись на самом объекте
    owner: data.owner, // 'player' — наш, 'enemy' — противник
    x: data.x, // позиция центра объекта в мировых координатах
    y: data.y,
    speed: data.speed || 0, // скорость в единицах мира за секунду
    radius: data.radius || 0, // юнит рисуется кругом такого радиуса
    width: data.width || 0, // здание рисуется прямоугольником
    height: data.height || 0,
    moving: false, // идёт ли юнит сейчас к цели
    targetX: 0, // точка, куда юнит идёт
    targetY: 0,
  }
}

// Короткие функции для создания юнитов и зданий, чтобы стартовый мир читался проще
const unit = (name: string, label: string, speed: number, x: number, y: number, owner: string) => {
  return createObject({ kind: 'unit', name, label, owner, x, y, speed, radius: 16 })
}

const building = (name: string, label: string, width: number, height: number, x: number, y: number, owner: string) => {
  return createObject({ kind: 'building', name, label, owner, x, y, width, height })
}

// Создаёт стартовое состояние мира.
// outline — граница карты: многоугольник из точек, соединённых по порядку.
// Форма и размер карты зависят только от этих точек, никаких ограничений
// на размер экрана нет: можно задать хоть квадрат, хоть остров на 10 000 единиц.
export const createWorld = () => {
  return {
    outline: [
      { x: -1100, y: -250 },
      { x: -700, y: -620 },
      { x: -100, y: -520 },
      { x: 450, y: -700 },
      { x: 1100, y: -280 },
      { x: 1250, y: 200 },
      { x: 700, y: 620 },
      { x: 50, y: 480 },
      { x: -550, y: 640 },
      { x: -1150, y: 220 },
    ],
    // Все объекты мира в одном списке. Скорости разные, как в Age of Empires 2:
    // крестьянин медленный, ополченец быстрее, разведчик (всадник) — самый быстрый.
    objects: [
      building('Городской центр', 'ГЦ', 140, 140, -160, -40, 'player'),
      building('Дом', 'Д', 70, 70, -300, -150, 'player'),
      building('Казармы', 'Кз', 100, 100, -320, 90, 'player'),
      unit('Крестьянин', 'К', 70, -40, 50, 'player'),
      unit('Крестьянин', 'К', 70, 10, 50, 'player'),
      unit('Крестьянин', 'К', 70, 60, 50, 'player'),
      unit('Ополченец', 'О', 95, -40, 120, 'player'),
      unit('Ополченец', 'О', 95, 20, 120, 'player'),
      unit('Разведчик', 'Р', 160, 110, 20, 'player'),

      building('Городской центр', 'ГЦ', 140, 140, 780, -60, 'enemy'),
      unit('Ополченец', 'О', 95, 700, 50, 'enemy'),
      unit('Ополченец', 'О', 95, 760, 50, 'enemy'),
    ],
  }
}

// Находит прямоугольник, в который помещается вся карта (крайние точки по X и Y).
// Нужен, чтобы нарисовать сетку и не дать камере уехать далеко за карту.
export const boundsOf = (points: any[]) => {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  points.forEach((p) => {
    if (p.x < bounds.minX) bounds.minX = p.x
    if (p.y < bounds.minY) bounds.minY = p.y
    if (p.x > bounds.maxX) bounds.maxX = p.x
    if (p.y > bounds.maxY) bounds.maxY = p.y
  })
  return bounds
}

// Проверяет, лежит ли точка (x, y) внутри многоугольника любой формы.
// Идея: мысленно пускаем луч из точки вправо и считаем, сколько сторон многоугольника
// он пересечёт. Нечётное число пересечений — точка внутри, чётное — снаружи.
export const pointInPolygon = (x: number, y: number, polygon: any[]) => {
  let inside = false
  // i — текущая вершина, j — предыдущая; пара (a, b) — одна сторона многоугольника
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    // Сторона пересекает горизонталь точки, и точка пересечения правее нашей точки
    const crosses = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

// Попадает ли точка (x, y) в объект: в круг юнита или в прямоугольник здания
export const hits = (obj: any, x: number, y: number) => {
  if (obj.kind === 'unit') {
    return Math.hypot(obj.x - x, obj.y - y) <= obj.radius
  }
  return (
    x >= obj.x - obj.width / 2 &&
    x <= obj.x + obj.width / 2 &&
    y >= obj.y - obj.height / 2 &&
    y <= obj.y + obj.height / 2
  )
}

// Порядок отрисовки: сначала все здания, потом юниты сверху вниз по экрану.
// В SVG то, что нарисовано позже, оказывается поверх, поэтому юнит, стоящий
// ниже на экране, перекрывает того, кто стоит выше, — получается эффект глубины.
export const sortForDraw = (objects: any[]) => {
  return [...objects].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'building' ? -1 : 1
    return a.y - b.y
  })
}

// Ищет объект под точкой клика. Перебираем в обратном порядке отрисовки,
// чтобы выбрать тот объект, который виден сверху (юнит важнее здания под ним).
export const objectAt = (objects: any[], x: number, y: number) => {
  const list = sortForDraw(objects)
  for (let i = list.length - 1; i >= 0; i--) {
    const obj = list[i]
    if (obj && hits(obj, x, y)) return obj
  }
  return null
}

// Пересечётся ли круг юнита с каким-нибудь зданием, если поставить юнита в (x, y).
// Для каждого здания находим ближайшую к юниту точку прямоугольника
// и проверяем, что она дальше радиуса юнита.
const overlapsBuilding = (world: any, obj: any, x: number, y: number) => {
  return world.objects.some((other: any) => {
    if (other.kind !== 'building') return false
    const nearestX = Math.max(other.x - other.width / 2, Math.min(x, other.x + other.width / 2))
    const nearestY = Math.max(other.y - other.height / 2, Math.min(y, other.y + other.height / 2))
    return Math.hypot(x - nearestX, y - nearestY) < obj.radius
  })
}

// Может ли юнит стоять в точке (x, y): точка на карте и не внутри здания
const canStand = (world: any, obj: any, x: number, y: number) => {
  return pointInPolygon(x, y, world.outline) && !overlapsBuilding(world, obj, x, y)
}

// Один шаг жизни мира. Вызывается по таймеру примерно каждые 30 мс.
// dt — сколько секунд прошло с прошлого шага. Юнит за шаг проходит speed * dt,
// поэтому скорость движения не зависит от того, как часто вызывается функция.
export const updateWorld = (world: any, dt: number) => {
  world.objects.forEach((obj: any) => {
    // Здания и стоящие юниты пропускаем
    if (obj.kind !== 'unit' || !obj.moving) return

    // Вектор от юнита до цели и расстояние до неё
    const dx = obj.targetX - obj.x
    const dy = obj.targetY - obj.y
    const dist = Math.hypot(dx, dy)
    const step = obj.speed * dt

    // Цель ближе, чем шаг: ставим юнита прямо в цель (если там можно стоять) и останавливаем
    if (dist <= step) {
      if (canStand(world, obj, obj.targetX, obj.targetY)) {
        obj.x = obj.targetX
        obj.y = obj.targetY
      }
      obj.moving = false
      return
    }

    // dx / dist и dy / dist — направление длиной 1; умножаем на шаг и получаем смещение
    const nextX = obj.x + (dx / dist) * step
    const nextY = obj.y + (dy / dist) * step

    // Упёрлись в здание или край карты — останавливаемся.
    // Обход препятствий (поиск пути) — задача следующих частей прототипа.
    if (canStand(world, obj, nextX, nextY)) {
      obj.x = nextX
      obj.y = nextY
    } else {
      obj.moving = false
    }
  })
}

// Переводит точку на экране (пиксели внутри игрового окна) в координаты мира.
// Центр окна показывает точку мира (camera.x, camera.y); смещение от центра окна
// делим на масштаб, потому что при zoom = 2 один пиксель равен половине единицы мира.
export const screenToWorld = (camera: any, viewW: number, viewH: number, sx: number, sy: number) => {
  return {
    x: camera.x + (sx - viewW / 2) / camera.zoom,
    y: camera.y + (sy - viewH / 2) / camera.zoom,
  }
}

// Не даёт центру камеры выйти за прямоугольник карты,
// чтобы игрок не «потерял» карту, уехав в пустоту
export const clampCamera = (camera: any, bounds: any) => {
  camera.x = Math.min(bounds.maxX, Math.max(bounds.minX, camera.x))
  camera.y = Math.min(bounds.maxY, Math.max(bounds.minY, camera.y))
}
