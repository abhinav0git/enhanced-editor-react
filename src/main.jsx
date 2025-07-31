import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';
import { EditorProvider } from './context/EditorContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EditorProvider> {/* Wrap the App */}
      <App />
    </EditorProvider>
  </React.StrictMode>,
);