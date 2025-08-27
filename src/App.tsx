import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LobbyPage from "./pages/LobbyPage";
import MatchPage from "./pages/MatchPage";
import JoinMatchPage from "./pages/JoinMatchPage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { account } = useAuth();
  return account ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPageWrapper />} />
      <Route path="/" element={<ProtectedRoute><ErrorBoundary><LobbyPage /></ErrorBoundary></ProtectedRoute>} />
      <Route path="/match/:id" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginPageWrapper() {
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleLogin(account: string) {
    login(account);         // set auth state
    navigate("/");          // redirect to LobbyPage
  }

  return <LoginPage onLogin={handleLogin} />;
}
