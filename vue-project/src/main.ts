import { createApp } from 'vue'
import App from './App.vue'
import router from '@/router'
import store from '@/store'

// Создаём приложение и подключаем роутер (страницы) и Vuex (общее состояние)
const app = createApp(App)

app.use(router)
app.use(store)

app.mount('#app')
