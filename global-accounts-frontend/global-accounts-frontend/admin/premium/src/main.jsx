import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../shared/icons.js';
import '../../../shared/data.js';
import '../../../shared/api.js';
import '../../../shared/charts.js';
import '../../../shared/demo-panel.css';
import '../../../shared/demo-panel.js';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
