import presenzLogo from './assets/presenz.png'
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
    onClose: () => { alert("Verification cancelled")},
    onProgress: (progress: { percent: number; message?: string }) => {console.log(progress)}
  }

  return (
    <>
      <div>
        <a href="https://presenz.netlify.com/doc" target="_blank">
          <img src={presenzLogo} className="logo" alt="Vite logo" />
        </a>
      </div>
      <h1>Presenz SDK Demo</h1>
      <div className="card">
        <PresenzButton 
        config={config} 
        callbacks={callBacks} 
        />
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
