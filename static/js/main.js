import './init.js';
import { handleYoutubeCommand, setupYoutubeSocketListeners } from './youtube-system/youtubeHandler.js';
import { handleYoutubeResumoCommand } from './youtube-system/youtubeResumoHandler.js';
import { setupYoutubeEvents } from './youtube-system/youtubeEvents.js';
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    melhorarBlocosCodigo,
    inicializarSync
} from './chat.js';
import { enviarMensagem, interromperResposta, entrarNaSala, sairDaSala, carregarConversa } from './chat/chatActions.js';
import { 
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
} from './chat/chatStorage.js';
import { initializeInputBar, destroyInputBar } from './modules/inputBar.js';
import { copiarMensagem, regenerarResposta } from './chat/chatUtils.js';
import { chatUI } from './chat/chatUI.js';
import { streamingManager } from './modules/streamingManager.js';
import { initializeTheme } from './theme.js';
import { initSidebar } from './sidebar.js';
import { initCommandMenu } from './commandMenu.js';
import { configureEventListeners } from './events.js';

// Estado global
window.currentModel = 'gemma2:2b';
window.conversas = [];
window.conversaAtual = null;
window.conversations = {}; // Nova estrutura global para mapear conversas por ID
window.copiarMensagem = copiarMensagem;
window.regenerarResposta = regenerarResposta;

let welcomeBar = null;
let chatBar = null;

// Configuração do Socket.IO
const socket = io();

// Exportar socket para uso em outros módulos
export { socket };

// Configuração do Marked
marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function(code, language) {
        const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
        return hljs.highlight(code, { language: validLanguage }).value;
    },
    pedantic: false,
    gfm: true,
    breaks: true,
    sanitize: false,
    smartypants: false,
    xhtml: false
});

// Inicialização do DOMPurify
DOMPurify.setConfig({
    ALLOWED_TAGS: [
        'a', 'b', 'blockquote', 'br', 'code', 'div', 'em',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'i', 'li', 'ol', 'p', 'pre', 'span',
        'strong', 'table', 'tbody', 'td', 'th',
        'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: ['href', 'class', 'style', 'target']
});

// Função principal de inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes
    initializeTheme();
    initSidebar();
    configureEventListeners();
    
    // Configurar Socket.IO
    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.IO');
    });

    socket.on('disconnect', () => {
        console.log('Desconectado do servidor Socket.IO');
    });

    // Entrar na sala da conversa atual quando mudar de chat
    document.addEventListener('conversation-selected', (e) => {
        const { conversationId } = e.detail;
        if (socket.currentRoom) {
            socket.emit('leave_conversation', { conversation_id: socket.currentRoom });
        }
        if (conversationId) {
            socket.emit('join_conversation', { conversation_id: conversationId });
            socket.currentRoom = conversationId;
        }
    });

    // Inicializar WebSocket para sincronização entre abas
    inicializarSync();
    
    // Configurar listeners do Socket.IO para o YouTube
    setupYoutubeSocketListeners(socket);
    setupYoutubeEvents(socket);
    
    const welcomeForm = document.getElementById('welcome-form');
    const chatForm = document.getElementById('chat-form');
    const chatContainer = document.querySelector('.chat-container');
    const welcomeInput = document.getElementById('welcome-input');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const testBtn = document.getElementById('test-btn');

    // Configurar menu de comando usando o módulo criado
    const welcomeCommandMenu = document.getElementById('command-menu');
    const chatCommandMenu = document.getElementById('chat-command-menu');

    const COMMANDS = [
        { command: '/youtube', description: 'Processar vídeo do YouTube' },
        { command: '/youtube_resumo', description: 'Resumo detalhado de vídeo do YouTube' },
        { command: '/salvar', description: 'Salvar conversa atual' },
        { command: '/historico', description: 'Ver histórico completo' },
        { command: '/config', description: 'Abrir configurações' }
    ];

    // Prevenir submit padrão dos formulários
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    });

    // Inicializar barra de entrada da tela inicial
    if (welcomeInput && welcomeCommandMenu) {
        welcomeBar = initializeInputBar(
            welcomeInput, 
            welcomeCommandMenu, 
            COMMANDS.map(c => c.command)
        );

        welcomeForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = welcomeInput.value.trim();
            if (!message) return;
            
            // Criar nova conversa se não existir
            if (!window.conversaAtual) {
                criarNovaConversa();
            }

            // Entrar na sala da conversa
            entrarNaSala(window.conversaAtual.id);

            // Limpar barra de boas-vindas antes de trocar de tela
            welcomeBar?.destroy();

            iniciarChat(
                document.querySelector('.welcome-screen'),
                chatContainer,
                document.querySelector('.input-container')
            );
            
            await enviarMensagem(message, welcomeInput, chatContainer, sendBtn, stopBtn);
            atualizarListaConversas(); // Atualizar histórico após enviar mensagem
            
            // Adicionar barras de título aos blocos de código
            setTimeout(() => {
                melhorarBlocosCodigo();
            }, 100);
        });
    }

    // Inicializar barra de entrada do chat
    if (chatInput && chatCommandMenu) {
        chatBar = initializeInputBar(
            chatInput, 
            chatCommandMenu, 
            COMMANDS.map(c => c.command)
        );

        chatForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Verificar se há uma conversa ativa
            if (!window.conversaAtual) {
                criarNovaConversa();
            }
            
            // Entrar na sala da conversa
            entrarNaSala(window.conversaAtual.id);
            
            // Armazenar o ID da conversa atual para garantir que estamos na mesma conversa após o streaming
            const currentConversationId = window.conversaAtual.id;
            
            chatBar.clear();
            await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
            
            // Verificar se ainda estamos na mesma conversa
            if (window.conversaAtual && window.conversaAtual.id === currentConversationId) {
                atualizarListaConversas(); // Atualizar histórico após enviar mensagem
                
                // Adicionar barras de título aos blocos de código
                setTimeout(() => {
                    melhorarBlocosCodigo();
                }, 100);
            }
        });
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
        if (window.conversaAtual) {
            // Sair da sala da conversa atual
            sairDaSala(window.conversaAtual.id);
            atualizarListaConversas(); // Atualizar histórico antes de criar nova conversa
        }
        
        // Limpar barra do chat antes de trocar de tela
        chatBar?.destroy();
        
        window.conversaAtual = null;
        mostrarTelaInicial(
            document.querySelector('.welcome-screen'),
            chatContainer,
            document.querySelector('.input-container'),
            welcomeInput,
            chatInput
        );

        // Reinicializar barra de boas-vindas
        if (welcomeInput && welcomeCommandMenu) {
            welcomeBar = initializeInputBar(
                welcomeInput, 
                welcomeCommandMenu, 
                COMMANDS.map(c => c.command)
            );
        }
    });

    // Configurar botão de parar resposta
    stopBtn?.addEventListener('click', () => {
        interromperResposta();
    });

    // Inicializar lista de conversas
    atualizarListaConversas();

    // Eventos para gerenciamento de estado isolado
    window.addEventListener('conversaCarregada', (e) => {
        if (e.detail && e.detail.id) {
            // Entrar na sala da conversa carregada
            entrarNaSala(e.detail.id);
        }
    });
    
    window.addEventListener('conversaAtualizada', (e) => {
        if (e.detail && e.detail.id) {
            // Entrar na sala da conversa atualizada
            entrarNaSala(e.detail.id);
        }
        atualizarListaConversas();
    });
    
    window.addEventListener('mensagemEnviada', (e) => {
        if (window.conversaAtual) {
            // Entrar na sala da conversa atual
            entrarNaSala(window.conversaAtual.id);
        }
    });
    
    // Processar blocos de código já existentes (ao carregar uma conversa)
    melhorarBlocosCodigo();
    
    // Observar mudanças no DOM para processar novos blocos de código
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                setTimeout(() => {
                    melhorarBlocosCodigo();
                }, 100);
            }
        });
    });
    
    observer.observe(chatContainer, { childList: true, subtree: true });
    
    // Configurar o listener de visibilidade para sincronização
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Atualizar o estado quando a aba ficar visível
            atualizarListaConversas();
            
            // Se houver uma conversa atual, verificar se há atualizações pendentes
            if (window.conversaAtual && window.conversations[window.conversaAtual.id]?.pendingUpdates) {
                carregarConversa(window.conversaAtual.id);
                window.conversations[window.conversaAtual.id].pendingUpdates = false;
            }
        }
    });

    // Adicionar evento de clique para o botão de teste
    if (testBtn) {
        testBtn.addEventListener('click', async () => {
            console.log('[DEBUG] Testando conectividade do Socket.IO');
            await testSocketConnection();
        });
    }
});

// Expor funções globalmente
window.carregarConversa = carregarConversa;
window.criarNovaConversa = criarNovaConversa;
window.adicionarMensagemAoHistorico = adicionarMensagemAoHistorico;
window.interromperResposta = interromperResposta;
window.renomearConversa = renomearConversa;
window.excluirConversa = excluirConversa;
window.melhorarBlocosCodigo = melhorarBlocosCodigo;

function showLoading() {
    document.getElementById('loading-indicator').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading-indicator').style.display = 'none';
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    hideLoading();
}

function showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    hideLoading();
}

