import { Route, Routes } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './components/Home.jsx'
import Receiver from './components/Receiver.jsx'
import TransferHistory from './components/TransferHistory.jsx'
import NotFound from './components/NotFound.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-neutral-950 selection:bg-neutral-950 selection:text-[#fbfaf7]">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:id" element={<Receiver />} />
          <Route path="/transfers" element={<TransferHistory />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
