import React from 'react'
import { createRoot } from 'react-dom/client'
import JornalismoApp from './JornalismoApp'
import { WorkerApiExamples } from './examples/WorkerApiExamples'
import './index.css'

function Main() {
  return (
    <>
      <JornalismoApp />
      {import.meta.env.DEV ? <WorkerApiExamples /> : null}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
)
