import { initializeTheme } from './theme.js';
import { configureEventListeners } from './events.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    configureEventListeners();
});