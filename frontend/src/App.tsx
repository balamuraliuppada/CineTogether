import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RoomProvider } from './context/RoomContext';
import HomePage from './pages/HomePage';
import WatchRoomPage from './pages/WatchRoomPage';

export default function App() {
  return (
    <BrowserRouter>
      <RoomProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomCode" element={<WatchRoomPage />} />
        </Routes>
      </RoomProvider>
    </BrowserRouter>
  );
}
