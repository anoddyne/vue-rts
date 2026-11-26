import { worldToScreen } from './map.js'

// Направления на экране в порядке поворота от положительной мировой оси X.
export const UNIT_DIRECTIONS = ['ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ', 'С', 'СВ', 'В']

const SIDES = [
  { name: 'front', shade: 1.08, mark: [[0.14, 0.78], [0.5, 0.64], [0.86, 0.78], [0.76, 0.47], [0.24, 0.47]] },
  { name: 'right', shade: 0.82, mark: [[0.33, 0.81], [0.55, 0.81], [0.7, 0.24], [0.48, 0.24]] },
  { name: 'back', shade: 0.65, mark: [[0.22, 0.67], [0.78, 0.67], [0.78, 0.23], [0.22, 0.23]] },
  { name: 'left', shade: 0.92, mark: [[0.45, 0.81], [0.67, 0.81], [0.52, 0.24], [0.3, 0.24]] },
]

// Размеры силуэта заданы относительно радиуса юнита и влияют только на отрисовку.
const PROFILES = {
  villager: { length: 0.76, width: 0.9, height: 1.75, material: '#8a623e', roof: '#b28a5d' },
  militia: { length: 1, width: 1.14, height: 2.2, material: '#59616b', roof: '#8e959b' },
  archer: { length: 0.76, width: 0.76, height: 2.24, material: '#465641', roof: '#647a52' },
  scout: { length: 1.15, width: 0.72, height: 1.38, material: '#495764', roof: '#71828d' },
}

const points = vertices => vertices.map(({ x, y }) => `${x},${y}`).join(' ')

export const getUnitView = (facing, type, gridSize) => {
  const { radius, appearance } = type
  const profile = PROFILES[appearance] ?? PROFILES.villager
  const angle = facing * Math.PI / 4
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const height = radius * profile.height
  const length = radius * profile.length
  const width = radius * profile.width
  const project = (x, y, z = 0) => {
    const point = worldToScreen(x * cos - y * sin, x * sin + y * cos, gridSize)
    return { x: point.x, y: point.y - z }
  }
  const base = [
    project(length, -width),
    project(length, width),
    project(-length, width),
    project(-length, -width),
  ]
  const top = base.map(({ x, y }) => ({ x, y: y - height }))

  const sides = SIDES.flatMap((side, index) => {
    const next = (index + 1) % base.length
    const a = base[index]
    const b = base[next]
    // У видимой грани ребро идёт справа налево при обходе основания.
    if (a.x - b.x < 1e-6) return []
    const at = (u, v) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - height * v })
    return [{
      ...side,
      outline: points([a, b, top[next], top[index]]),
      detail: points(side.mark.map(([u, v]) => at(u, v))),
    }]
  })

  return {
    height,
    material: profile.material,
    roof: profile.roof,
    sides,
    top: points(top),
    arrow: points([
      project(length * 0.84, 0, height),
      project(-length * 0.48, width * 0.67, height),
      project(-length * 0.19, 0, height),
      project(-length * 0.48, -width * 0.67, height),
    ]),
  }
}
