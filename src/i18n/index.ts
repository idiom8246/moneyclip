import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhTW from './zh-TW'
import en from './en'

void i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': zhTW,
    en,
  },
  lng: 'zh-TW',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
