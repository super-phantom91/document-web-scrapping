import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      token: getToken(),
      loading,
      async login(username, password) {
        const data = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        setToken(data.token);
        setUser(data.user);
      },
      async register(username, password) {
        const data = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
        setToken(data.token);
        setUser(data.user);
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
