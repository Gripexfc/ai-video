<template>
  <div class="app">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
</script>

<style>
* {
  box-sizing: border-box;
}
/* Page transition — duplicates removed (already in theme.css) */
</style>
