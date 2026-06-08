import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { ErpAuthProvider } from './context/AuthContext';
import { useErpAuth } from './store/authStore';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';

function AdminRoute() {
  const { erpToken } = useErpAuth();
  if (!erpToken) return <Navigate to="/" replace />;
  return <AdminPage />;
}

export default function App() {
  return (
    <ErpAuthProvider>
      <Router>
        <Routes>
          <Route path="/"       element={<LoginPage />} />
          <Route path="/admin"  element={<AdminRoute />} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErpAuthProvider>
  );
}
