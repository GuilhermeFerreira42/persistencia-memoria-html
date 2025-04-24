// Importações necessárias
import { toggleTheme } from './theme.js';
import { toggleSidebar, initSidebar } from './sidebar.js';
import { configureTextarea } from './textarea.js';

export function configureEventListeners() {
    console.log('[DEBUG] Configurando event listeners para botões de tema e sidebar');
    
    const themeToggle = document.querySelector('.theme-toggle');
    const modelSelect = document.querySelector('.model-select');
    const headerSidebarToggle = document.querySelector('.header-sidebar-toggle');

    // Verifica se os elementos foram encontrados
    console.log('[DEBUG] Elementos encontrados:', {
        themeToggle: !!themeToggle,
        modelSelect: !!modelSelect,
        headerSidebarToggle: !!headerSidebarToggle
    });

    // Event Listeners
    themeToggle?.addEventListener('click', toggleTheme);
    headerSidebarToggle?.addEventListener('click', toggleSidebar);

    modelSelect?.addEventListener('change', (e) => {
        window.currentModel = e.target.value;
    });

    // Configurar textareas
    configureTextarea(document.querySelector('#chat-input'));
    configureTextarea(document.querySelector('#welcome-input'));
    
    // Inicializar a barra lateral
    initSidebar();
    
    // Configurar menu de opções do chat (três pontinhos)
    document.addEventListener('click', function(event) {
        // Fechar todos os menus abertos quando clicar fora
        if (!event.target.closest('.more-btn') && !event.target.closest('.chat-options-menu')) {
            document.querySelectorAll('.chat-options-menu.visible').forEach(menu => {
                menu.classList.remove('visible');
            });
        }
        
        // Abrir menu ao clicar no botão de três pontinhos
        if (event.target.closest('.more-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const chatItem = event.target.closest('.chat-item');
            if (chatItem) {
                const chatId = chatItem.dataset.id;
                const menu = chatItem.querySelector('.chat-options-menu');
                
                // Fechar todos os outros menus abertos
                document.querySelectorAll('.chat-options-menu.visible').forEach(m => {
                    if (m !== menu) m.classList.remove('visible');
                });
                
                // Alternar visibilidade deste menu
                menu?.classList.toggle('visible');
            }
        }
        
        // Manipular cliques nos itens do menu
        if (event.target.closest('.chat-option-item')) {
            const option = event.target.closest('.chat-option-item');
            const chatItem = option.closest('.chat-item');
            
            if (chatItem && option.dataset.action === 'delete') {
                const chatId = chatItem.dataset.id;
                if (window.excluirConversa && chatId) {
                    window.excluirConversa(chatId);
                }
            } else if (chatItem && option.dataset.action === 'rename') {
                const chatId = chatItem.dataset.id;
                if (window.renomearConversa && chatId) {
                    const newName = prompt('Digite o novo nome para esta conversa:');
                    if (newName && newName.trim()) {
                        window.renomearConversa(chatId, newName.trim());
                    }
                }
            }
            
            // Fechar o menu após a ação
            option.closest('.chat-options-menu').classList.remove('visible');
        }
    });
}
