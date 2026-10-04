import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import GamePage from '../components/pages/GamePage.vue'

export const ROUTE_NAME = {
  GAME: 'GAME',
}

// Пока одна страница — сама игра. Сюда же потом добавятся меню, настройки и т.д.
export const routes: Readonly<RouteRecordRaw[]> = [
  {
    name: ROUTE_NAME.GAME,
    path: '/',
    component: GamePage,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
