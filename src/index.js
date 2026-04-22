import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));


// Global error handler to catch any uncaught errors
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    // Show error on screen for debugging
    const rootDiv = document.getElementById('root');
    if (rootDiv && rootDiv.innerHTML === '') {
        rootDiv.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                <h2>⚠️ Application Error</h2>
                <p>Failed to start application. Please check console for details.</p>
                <button onclick="localStorage.clear(); window.location.reload();">
                    Clear Cache & Reload
                </button>
            </div>
        `;
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
});

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();