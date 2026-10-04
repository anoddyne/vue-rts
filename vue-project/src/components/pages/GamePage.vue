<!--
  Страница игры. Отвечает за три вещи:
    1) рисует карту и объекты в SVG;
    2) управляет камерой (клавиши, край экрана, средняя кнопка мыши, колёсико);
    3) обрабатывает выбор объекта (ЛКМ) и приказ «идти» (ПКМ).
  Сама логика мира (движение, проверки столкновений) лежит в src/game/world.ts.
-->
<template>
  <div class="game">
    <!-- Игровое окно. Нажатия мыши ловим здесь, а движение и отпускание — на всём window,
         чтобы перетаскивание камеры не обрывалось, если мышь вышла за окно -->
    <div
      ref="viewRef"
      class="game__view"
      @mousedown="onMouseDown"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
    >
      <!-- viewBox — это и есть камера: он задаёт, какой кусок мира виден в окне -->
      <svg class="game__svg" :viewBox="viewBox">
        <defs>
          <!-- Узор сетки: одна клетка 64×64 единицы мира, повторяется по всей карте -->
          <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" class="game__grid" />
          </pattern>
          <!-- Маска по форме карты, чтобы сетка и оси не вылезали за её край -->
          <clipPath id="field">
            <polygon :points="outlinePoints" />
          </clipPath>
        </defs>

        <!-- Земля: многоугольник по точкам границы карты -->
        <polygon :points="outlinePoints" class="game__ground" />
        <g clip-path="url(#field)">
          <rect :x="bounds.minX" :y="bounds.minY" :width="fieldWidth" :height="fieldHeight" fill="url(#grid)" />
          <!-- Оси координат через центр карты (0, 0) -->
          <line :x1="bounds.minX" y1="0" :x2="bounds.maxX" y2="0" class="game__axis" />
          <line x1="0" :y1="bounds.minY" x2="0" :y2="bounds.maxY" class="game__axis" />
        </g>
        <circle cx="0" cy="0" r="5" class="game__origin" />

        <!-- Пунктир от выбранного юнита до точки, куда он идёт -->
        <line
          v-if="selected && selected.moving"
          :x1="selected.x"
          :y1="selected.y"
          :x2="selected.targetX"
          :y2="selected.targetY"
          class="game__path"
        />

        <!-- Все объекты мира в правильном порядке отрисовки -->
        <GameObjectView
          v-for="obj in drawList"
          :key="obj.id"
          :obj="obj"
          :selected="obj.id === selectedId"
        />
      </svg>

      <!-- Подсказка сверху: координаты курсора в мире и управление -->
      <div class="game__hud">
        <div>Курсор: {{ Math.round(cursor.x) }}, {{ Math.round(cursor.y) }} · центр карты (0, 0)</div>
        <div>
          ЛКМ — выбрать, ПКМ — идти, WASD или стрелки — камера, колёсико — масштаб, средняя кнопка — двигать камеру,
          Esc — снять выбор.
        </div>
      </div>
    </div>

    <!-- Нижняя панель с информацией о выбранном объекте, как в Age of Empires 2 -->
    <div class="game__panel">
      <div v-if="selected">
        <b>{{ selected.name }}</b>
        <span v-if="selected.owner === 'enemy'"> (противник)</span>
        <span v-else> (игрок)</span>
        <div v-if="selected.kind === 'unit'">
          Скорость: {{ selected.speed }} · {{ selected.moving ? 'идёт' : 'стоит' }}
        </div>
        <div v-else>Здание {{ selected.width }}×{{ selected.height }}, стоит на месте</div>
        <div>Позиция: {{ Math.round(selected.x) }}, {{ Math.round(selected.y) }}</div>
      </div>
      <div v-else>Ничего не выбрано. Кликните по юниту или зданию.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import GameObjectView from '@/components/game/GameObjectView.vue'
import { boundsOf, clampCamera, createWorld, objectAt, screenToWorld, sortForDraw, updateWorld } from '@/game/world'

// Скорость прокрутки камеры в пикселях экрана за секунду
const CAMERA_SPEED = 500
// Ширина полосы у края окна (в пикселях), при наведении на которую камера едет сама
const EDGE = 16

const store = useStore()

// Мир делаем реактивным: когда updateWorld меняет x и y юнитов,
// Vue сам перерисовывает только изменившиеся объекты
const world = reactive(createWorld())
// Прямоугольник карты считаем один раз: граница карты не меняется
const bounds = boundsOf(world.outline)

// Камера: точка мира в центре экрана и масштаб.
// Стартуем над нашим городским центром.
const camera = reactive({
  x: -160,
  y: -40,
  zoom: 1,
})

// Ссылка на div игрового окна и его размеры в пикселях
const viewRef = ref(null)
const viewW = ref(window.innerWidth)
const viewH = ref(window.innerHeight - 110)
// Координаты курсора в мире — только для подсказки сверху
const cursor = reactive({ x: 0, y: 0 })
// Курсор внутри игрового окна (нужно для прокрутки у края)
const mouseInside = ref(false)
// Какие клавиши сейчас зажаты. Храним набор, а не одно событие, чтобы камера
// ехала плавно, пока клавиша удерживается, и можно было жать две сразу (по диагонали)
const keys = new Set()

// Последняя точка при перетаскивании камеры средней кнопкой (null — не тащим)
let panLast: any = null
// Где нажали левую кнопку — чтобы отличить клик от случайного сдвига мыши
let clickStart: any = null
// Положение курсора в пикселях относительно игрового окна
let cursorScreenX = 0
let cursorScreenY = 0

// Выбранный объект: id берём из Vuex, а сам объект ищем в мире
const selectedId = computed(() => store.getters['getSelectedId'])
const selected = computed(() => world.objects.find((obj) => obj.id === selectedId.value))
const drawList = computed(() => sortForDraw(world.objects))
// SVG принимает точки многоугольника строкой вида "x1,y1 x2,y2 ..."
const outlinePoints = computed(() => world.outline.map((p) => p.x + ',' + p.y).join(' '))
const fieldWidth = computed(() => bounds.maxX - bounds.minX)
const fieldHeight = computed(() => bounds.maxY - bounds.minY)

// Камера через viewBox: показываем прямоугольник мира с центром в (camera.x, camera.y).
// Его размер = размер окна / масштаб: чем больше zoom, тем меньший кусок мира
// растягивается на то же окно, то есть всё выглядит крупнее.
const viewBox = computed(() => {
  const w = viewW.value / camera.zoom
  const h = viewH.value / camera.zoom
  return camera.x - w / 2 + ' ' + (camera.y - h / 2) + ' ' + w + ' ' + h
})

// Координаты мыши относительно левого верхнего угла игрового окна
const localPoint = (e: MouseEvent) => {
  const rect = (viewRef.value as any).getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const onMouseDown = (e: MouseEvent) => {
  const point = localPoint(e)
  if (e.button === 0) {
    // Левая кнопка: запоминаем точку, выбор сделаем при отпускании
    clickStart = point
  } else if (e.button === 1) {
    // Средняя кнопка: начинаем тащить камеру; preventDefault отключает автопрокрутку браузера
    panLast = point
    e.preventDefault()
  } else if (e.button === 2) {
    // Правая кнопка: приказ выбранному юниту идти в точку под курсором.
    // Командовать можно только своими юнитами; здания и чужие юниты не двигаются.
    const worldPoint = screenToWorld(camera, viewW.value, viewH.value, point.x, point.y)
    const obj = selected.value
    if (obj && obj.kind === 'unit' && obj.owner === 'player') {
      obj.moving = true
      obj.targetX = worldPoint.x
      obj.targetY = worldPoint.y
    }
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (!viewRef.value) return
  const rect = (viewRef.value as any).getBoundingClientRect()
  cursorScreenX = e.clientX - rect.left
  cursorScreenY = e.clientY - rect.top
  mouseInside.value = cursorScreenX >= 0 && cursorScreenY >= 0 && cursorScreenX <= rect.width && cursorScreenY <= rect.height

  const worldPoint = screenToWorld(camera, viewW.value, viewH.value, cursorScreenX, cursorScreenY)
  cursor.x = worldPoint.x
  cursor.y = worldPoint.y

  // Перетаскивание камеры: двигаем её в обратную сторону от движения мыши,
  // поэтому карта «едет» за курсором. Делим на zoom, чтобы перевести пиксели в единицы мира.
  if (panLast) {
    camera.x -= (cursorScreenX - panLast.x) / camera.zoom
    camera.y -= (cursorScreenY - panLast.y) / camera.zoom
    panLast = { x: cursorScreenX, y: cursorScreenY }
    clampCamera(camera, bounds)
  }
}

const onMouseUp = (e: MouseEvent) => {
  if (e.button === 0 && clickStart) {
    const point = localPoint(e)
    const moved = Math.hypot(point.x - clickStart.x, point.y - clickStart.y)
    // Считаем это кликом, только если мышь почти не сдвинулась
    if (moved < 5) {
      const worldPoint = screenToWorld(camera, viewW.value, viewH.value, clickStart.x, clickStart.y)
      const obj = objectAt(world.objects, worldPoint.x, worldPoint.y)
      // Клик по пустому месту снимает выбор
      store.commit('select', obj ? obj.id : null)
    }
    clickStart = null
  }
  if (e.button === 1) panLast = null
}

// Колёсико: вверх — приблизить, вниз — отдалить; масштаб ограничен разумными пределами
const onWheel = (e: WheelEvent) => {
  camera.zoom = e.deltaY < 0 ? camera.zoom * 1.1 : camera.zoom / 1.1
  if (camera.zoom < 0.4) camera.zoom = 0.4
  if (camera.zoom > 2.2) camera.zoom = 2.2
}

const onKeyDown = (e: KeyboardEvent) => {
  // Стрелки иначе прокручивали бы саму страницу браузера
  if (e.code.startsWith('Arrow') || e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    e.preventDefault()
  }
  keys.add(e.code)
  if (e.code === 'Escape') store.commit('select', null)
}

const onKeyUp = (e: KeyboardEvent) => {
  keys.delete(e.code)
}

// Если окно браузера потеряло фокус, keyup может не прийти — сбрасываем клавиши,
// иначе камера продолжит ехать сама
const onBlur = () => {
  keys.clear()
}

// Запоминаем текущий размер игрового окна (при старте и при изменении размера браузера)
const updateSize = () => {
  const el = viewRef.value as any
  if (!el) return
  viewW.value = el.clientWidth
  viewH.value = el.clientHeight
}

// Движение камеры за один шаг таймера
const moveCamera = (dt: number) => {
  // dx, dy — направление: -1, 0 или 1 по каждой оси
  let dx = 0
  let dy = 0
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1

  // Прокрутка у края экрана, как в AoE2: курсор у границы окна — камера едет в ту сторону
  if (mouseInside.value && !panLast) {
    if (cursorScreenX < EDGE) dx -= 1
    if (cursorScreenX > viewW.value - EDGE) dx += 1
    if (cursorScreenY < EDGE) dy -= 1
    if (cursorScreenY > viewH.value - EDGE) dy += 1
  }

  if (!dx && !dy) return
  // Делим на длину, чтобы по диагонали камера ехала не быстрее, чем по прямой.
  // Делим на zoom, чтобы на экране скорость прокрутки была одинаковой при любом масштабе.
  const len = Math.hypot(dx, dy)
  const step = (CAMERA_SPEED / camera.zoom) * dt
  camera.x += (dx / len) * step
  camera.y += (dy / len) * step
  clampCamera(camera, bounds)
}

// Игровой цикл на setInterval: примерно 33 шага в секунду
let timer: any = null
let lastTime = 0

const tick = () => {
  const now = Date.now()
  // Сколько секунд прошло с прошлого шага. Не больше 0.1 с: если вкладка была свёрнута,
  // юниты не должны «телепортироваться» на большое расстояние за один шаг.
  const dt = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  moveCamera(dt)
  updateWorld(world, dt)
}

onMounted(() => {
  updateSize()
  window.addEventListener('resize', updateSize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  lastTime = Date.now()
  timer = setInterval(tick, 30)
})

// При уходе со страницы останавливаем таймер и снимаем все обработчики,
// иначе они продолжат работать в фоне
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('resize', updateSize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  store.commit('select', null)
})
</script>

<style scoped lang="scss">
.game {
  // Игра занимает всё окно браузера: сверху поле, снизу панель
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0d1a26;
  user-select: none;
  color: #f1e3c2;
  font-family: Georgia, serif;

  &__view {
    position: relative;
    flex: 1;
    overflow: hidden;
    // Цвет «воды» вокруг карты
    background: #1b4f6e;
    cursor: default;
  }

  &__svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  &__ground {
    fill: #6b9442;
    // Толстая светлая обводка — песчаный берег
    stroke: #d8c58a;
    stroke-width: 28;
    stroke-linejoin: round;
  }

  &__grid {
    fill: none;
    stroke: rgba(0, 0, 0, 0.15);
    stroke-width: 1;
  }

  &__axis {
    stroke: rgba(255, 255, 255, 0.35);
    stroke-width: 2;
    stroke-dasharray: 8 8;
  }

  &__origin {
    fill: #fff;
  }

  &__path {
    stroke: #ffe36b;
    stroke-width: 2;
    stroke-dasharray: 6 6;
  }

  &__hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px 12px;
    background: rgba(20, 14, 6, 0.75);
    font-size: 14px;
    // Подсказка не мешает кликать по карте под ней
    pointer-events: none;
  }

  &__panel {
    height: 110px;
    box-sizing: border-box;
    padding: 16px 20px;
    background: #2c1d0e;
    border-top: 3px solid #8a6d3b;
    font-size: 16px;
    line-height: 1.5;
  }
}
</style>
