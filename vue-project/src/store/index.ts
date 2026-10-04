import { createStore } from 'vuex'

// Во Vuex храним то, что может понадобиться разным частям интерфейса.
// Сейчас это только id выбранного объекта (юнита или здания).
// Позиции объектов здесь не храним: они меняются каждые 30 мс и живут в самом мире игры.
export default createStore({
  state: {
    selectedId: null,
  },
  getters: {
    getSelectedId: (state: any) => state.selectedId,
  },
  mutations: {
    // id = null означает «ничего не выбрано»
    select(state: any, id: any) {
      state.selectedId = id
    },
  },
})
