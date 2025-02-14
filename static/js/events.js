
import { toggleTheme } from './theme.js';
import { toggleSidebar } from './sidebar.js';
import { configureTextarea } from './textarea.js';
import { initCommandMenu } from './modules/commandMenu.js';

const COMMANDS = [
    '/youtube',
    '/google',
    '/help',
    '/settings'
];

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

    // Configurar textareas e menus de comando
    const welcomeInput = document.querySelector('#welcome-input');
    const chatInput = document.querySelector('#chat-input');
    const welcomeCommandMenu = document.querySelector('#command-menu');
    const chatCommandMenu = document.querySelector('#chat-command-menu');

    if (welcomeInput && welcomeCommandMenu) {
        configureTextarea(welcomeInput);
        initCommandMenu(welcomeInput, welcomeCommandMenu, COMMANDS);
    }

    if (chatInput && chatCommandMenu) {
        configureTextarea(chatInput);
        initCommandMenu(chatInput, chatCommandMenu, COMMANDS);
    }
}
