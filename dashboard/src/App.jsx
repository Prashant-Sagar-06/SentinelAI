/**
 * SentinelAI Dashboard - Main Application Component
 * ==================================================
 * 
 * Root component that sets up routing and layout for the dashboard.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnomaliesPage from './pages/AnomaliesPage';
import RootCausesPage from './pages/RootCausesPage';
import './App.css';

/**
 * Main App component.
 * Sets up routing and global layout.
 */
function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/anomalies" element={<AnomaliesPage />} />
            <Route path="/root-causes" element={<RootCausesPage />} />
            {/* Redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
