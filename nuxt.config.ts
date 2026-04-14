// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  ssr: true,

  modules: ['@nuxtjs/tailwindcss'],

  css: [
    '@fontsource/outfit/400.css',
    '@fontsource/outfit/500.css',
    '@fontsource/outfit/600.css',
    '@fontsource/outfit/700.css',
    '@fontsource/dm-sans/400.css',
    '@fontsource/dm-sans/500.css',
    '@fontsource/dm-sans/600.css',
    '@fontsource/dm-sans/700.css',
    '~/assets/css/main.css',
  ],

  app: {
    head: {
      title: 'Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#111116' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  runtimeConfig: {
    mockMode: '',
    mongoUri: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: '',
    sessionSecret: '',
    public: {
      appName: 'Dashboard',
      mockMode: '',
    },
  },

  nitro: {
    // For Amplify Hosting SSR: Nitro's `aws-amplify` preset.
    // For local dev, the default `node-server` is used.
    preset: process.env.NITRO_PRESET || undefined,
  },

  devServer: {
    port: 4001,
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
