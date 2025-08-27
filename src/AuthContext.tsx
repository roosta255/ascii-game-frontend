// AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext<{ account: string | null, login: (a: string) => void }>({
  account: null,
  login: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("currentAccount");
    if (saved) setAccount(saved);
  }, []);

  function login(account: string) {
    setAccount(account);
    localStorage.setItem("currentAccount", account);
  }

  return (
    <AuthContext.Provider value={{ account, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
