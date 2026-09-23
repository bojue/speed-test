import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import ArcoVueIcon from '@arco-design/web-vue/es/icon';
import enUS from '@arco-design/web-vue/es/locale/lang/en-us';
import '@arco-design/web-vue/dist/arco.css';
import './index.css';
import App from './App.vue';
import { initRum } from './utils/rum';

const app = createApp(App);
app.use(ArcoVue, { locale: enUS });
app.use(ArcoVueIcon);
app.mount('#root');

// Collect this page's real-user navigation + resource waterfall into the RUM beacon store.
initRum();
