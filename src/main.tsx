import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/fonts'
import './i18n'
import App from './App.tsx'
import { redirectRecoveryLink } from './lib/recoveryLink'

// Ссылка восстановления пароля, попавшая на приложение вместо отдельной
// страницы, уводится ДО рендера — иначе hash-роутер не найдёт маршрута и
// покажет белый экран (так и случилось при проверке на устройстве).
if (!redirectRecoveryLink()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
