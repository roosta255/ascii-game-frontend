// LoginPage.tsx
import { useState } from "react";

export default function LoginPage({ onLogin }: { onLogin: (account: string) => void }) {
  const [account, setAccount] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (account.trim()) {
      onLogin(account.trim());
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Username:
        <input value={account} onChange={e => setAccount(e.target.value)} />
      </label>
      <button type="submit">Log In</button>
    </form>
  );
}
