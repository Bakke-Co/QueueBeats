import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppWrapper } from './AppWrapper'
import './index.css'
import { ensureDatabaseHealth } from './utils/databaseHealth'

// Run database health check on startup
ensureDatabaseHealth()
  .then(isHealthy => {
    if (isHealthy) {
      console.log('✅ Database health check passed, starting application');
    } else {
      console.warn('⚠️ Database health check failed, application may not function correctly');
    }
  })
  .catch(error => {
    console.error('❌ Error during database health check:', error);
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWrapper />
  </StrictMode>,
)
