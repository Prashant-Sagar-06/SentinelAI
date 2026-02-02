/**
 * SentinelAI Dashboard - Navbar Component
 * ========================================
 * 
 * Main navigation component for the dashboard.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

/**
 * Navigation bar component.
 */
export const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">🛡️</span>
        <span className="navbar-title">SentinelAI</span>
      </div>
      
      <ul className="navbar-links">
        <li>
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/anomalies" 
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Anomalies
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/root-causes" 
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Root Causes
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
