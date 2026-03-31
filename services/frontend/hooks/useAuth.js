import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  const { token, login, logout, isAuthenticated } = ctx;
  return { token, login, logout, isAuthenticated };
}
