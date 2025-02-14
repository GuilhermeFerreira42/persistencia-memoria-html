// Importações necessárias
import { toggleTheme } from './theme.js';
import { toggleSidebar } from './sidebar.js';
import { configureTextarea } from './textarea.js';

export function configureEventListeners() {
    const themeToggle = document.querySelector('.theme-toggle');
    const modelSelect = document.querySelector('.model-select');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const headerSidebarToggle = document.querySelector('.header-sidebar-toggle');

    // Event Listeners
    themeToggle?.addEventListener('click', toggleTheme);
    sidebarToggle?.addEventListener('click', toggleSidebar);
    headerSidebarToggle?.addEventListener('click', toggleSidebar);

    modelSelect?.addEventListener('change', (e) => {
        window.currentModel = e.target.value;
    });

    // Configurar textareas
    configureTextarea(document.querySelector('#chat-input'));
    configureTextarea(document.querySelector('#welcome-input'));
}