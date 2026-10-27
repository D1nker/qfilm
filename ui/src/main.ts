import { createApp } from "vue";
import "@fontsource-variable/inter";
import "@/styles/tokens.css";
import "@/styles/base.css";
import App from "@/app/App.vue";
import { i18n } from "@/shared/i18n";

createApp(App).use(i18n).mount("#app");
