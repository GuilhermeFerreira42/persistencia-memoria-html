// Importações necessárias
import { toggleTheme } from './theme.js';
import { toggleSidebar } from './sidebar.js';
import { configureTextarea } from './textarea.js';
import { enviarMensagem } from './chat/chatActions.js'; // Importando a função enviarMensagem

export function configureEventListeners() {
    const themeToggle = document.querySelector('.theme-toggle');
    const modelSelect = document.querySelector('.model-select');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const headerSidebarToggle = document.querySelector('.header-sidebar-toggle');
    const chatInput = document.querySelector('#chat-input'); // Campo de entrada de chat
    const sendButton = document.querySelector('#send-button'); // Botão de envio

    // Event Listeners
    themeToggle?.addEventListener('click', toggleTheme);
    sidebarToggle?.addEventListener('click', toggleSidebar);
    headerSidebarToggle?.addEventListener('click', toggleSidebar);

    modelSelect?.addEventListener('change', (e) => {
        window.currentModel = e.target.value;
    });

    // Configurar textareas
    configureTextarea(chatInput);
    configureTextarea(document.querySelector('#welcome-input'));

    // Adicionando evento de envio de mensagem
    sendButton?.addEventListener('click', () => {
        const mensagem = chatInput.value;
        enviarMensagem(mensagem, chatInput, document.querySelector('.chat-container'), sendButton, document.querySelector('#stop-button'));
    });

    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const mensagem = chatInput.value;
            enviarMensagem(mensagem, chatInput, document.querySelector('.chat-container'), sendButton, document.querySelector('#stop-button'));
            e.preventDefault(); // Evita a quebra de linha
        }
    });
}
