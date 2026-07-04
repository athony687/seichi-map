import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// LINE IAB（アプリ内ブラウザ）の初回ロード白画面を回避
// LINE IАBはスクリプトキャッシュなしの初回だけ失敗するため1回だけ自動リロード
;(function lineIabReload() {
  if (!/Line\//i.test(navigator.userAgent)) return
  try {
    if (sessionStorage.getItem('_lreload')) return
    sessionStorage.setItem('_lreload', '1')
  } catch { return }
  window.location.reload()
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
