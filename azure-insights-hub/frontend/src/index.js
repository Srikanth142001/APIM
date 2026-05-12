import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import './config/axiosSetup'; // JWT interceptors — must be first
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
