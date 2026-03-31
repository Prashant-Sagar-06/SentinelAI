import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from '../context/AuthContext';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#111827',
            color: '#E5E7EB',
            border: '1px solid #1F2937',
          },
        }}
      />
    </AuthProvider>
  );
}
