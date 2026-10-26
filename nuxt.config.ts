export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  devServer: {
    port: 3100,
  },
  runtimeConfig: {
    supabaseUrl: '',
    supabaseServiceKey: '',
    public: {
      supabaseUrl: '',
    },
  },
})
