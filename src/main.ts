import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { initSettings } from '@/services/db'

// Vant 样式
import 'vant/lib/index.css'
import './styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// 初始化数据库后再挂载应用，确保数据源为本地文件
initSettings().then(() => {
  app.mount('#app')
})
