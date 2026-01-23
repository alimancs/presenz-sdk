import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { PresenzButton } from 'presenz-sdk'
import './App.css'

function App() {
  const config = {
    publicKey: "pz-tYUuGV5576f4RE879JKBMvedsbh",
    email: "example@gmail.com",
  }
  const callBacks = {
    onSuccess: (result: { verified: boolean; sessionId: string; score: number }) => {console.log(result)},
    onError: (error: { message: string; code?: string }) => {console.error(error.message);console.log(error.code)},
    onClose: () => { alert("Verification closed")},
    onProgress: (progress: { percent: number; message?: string }) => {console.log(progress)}
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + presenz</h1>
      <div className="card">
        <PresenzButton 
        config={config} 
        callbacks={callBacks}
        >
          Presenz Verify Button
        </PresenzButton>
        <p>
          Edit <code>src/App.tsx</code>
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
