import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Widget from './components/Widget';

// A wrapper component to protect the inbox route
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicWebsite() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-800">Welcome to Our Product</h1>
      <p className="mt-4 text-gray-600">This is our public landing page. Look at the bottom right!</p>
      <Widget />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicWebsite />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/inbox" 
          element={
            <ProtectedRoute>
              <Inbox />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;