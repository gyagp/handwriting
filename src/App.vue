<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <keep-alive include="Home,Library,Gallery">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <van-tabbar v-model="active" route>
      <van-tabbar-item replace to="/" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/library" icon="font-o">字库</van-tabbar-item>
      <van-tabbar-item replace to="/capture" icon="photograph">采集</van-tabbar-item>
      <van-tabbar-item replace to="/gallery" icon="photo-o">作品</van-tabbar-item>
      <van-tabbar-item replace to="/settings" icon="setting-o">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const active = ref(0)
</script>

<style scoped>
#app {
  min-height: 100vh;
  padding-bottom: 50px;
  background-color: var(--bg-color);
}
</style>
