<template>
  <!-- Корневой компонент: просто место, куда роутер выводит текущую страницу -->
  <RouterView />
</template>

<script setup lang="ts">
</script>

<style>
/* Убираем стандартные отступы браузера, чтобы игра занимала всё окно */
body {
  margin: 0;
}
</style>
