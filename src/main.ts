import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import './styles/layout.css'
import './styles/prose.css'

createApp(App).use(createPinia()).mount('#app')
