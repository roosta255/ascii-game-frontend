// AuthContext.tsx
import { createContext, useContext, useState } from "react";

const AuthContext = createContext<{ account: string | null, login: (a: string) => void }>({
  account: null,
  login: () => {}
});

// The account saved by the last login, or null. Read before the first render,
// so a page loaded directly is not sent to /login while the account loads.
export function savedAccount(storage: Pick<Storage, "getItem">): string | null {
  return storage.getItem("currentAccount") || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(() => savedAccount(localStorage));

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
