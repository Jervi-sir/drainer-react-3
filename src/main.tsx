import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import WalletProviderComponent from './WalletProvider'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProviderComponent>
      <App />
    </WalletProviderComponent>
  </StrictMode>,
)
