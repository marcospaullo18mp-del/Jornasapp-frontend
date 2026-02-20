import React from 'react'
import { createRoot } from 'react-dom/client'
import JornalismoApp from './JornalismoApp'
import { WorkerApiExamples } from './examples/WorkerApiExamples'
import './index.css'

function Main() {
  const showWorkerExamples = import.meta.env.DEV && import.meta.env.VITE_SHOW_WORKER_EXAMPLES === '1'
  return (
    <>
      <JornalismoApp />
      {showWorkerExamples ? <WorkerApiExamples /> : null}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
)
