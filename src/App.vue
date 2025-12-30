<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <keep-alive include="Home,Gallery">
        <component :is="Component" />
      </keep-alive>
    </router-view>
    <van-tabbar v-model="active" route v-if="currentUser">
      <van-tabbar-item replace to="/" icon="apps-o">字集</van-tabbar-item>
      <van-tabbar-item replace to="/gallery" icon="photo-o">作品集</van-tabbar-item>
      <van-tabbar-item replace to="/capture" icon="photograph" v-if="currentUser?.role !== 'admin'">采集</van-tabbar-item>
      <van-tabbar-item replace to="/settings" icon="setting-o">设置</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { currentUser } from '@/services/db'

const active = ref(0)
</script>

<style scoped>
#app {
  min-height: 100vh;
  padding-bottom: 50px;
  background-color: var(--bg-color);
}
</style>
