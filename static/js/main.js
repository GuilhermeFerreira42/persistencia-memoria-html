
import './init.js';
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
} from './chat.js';
import { enviarMensagem, interromperResposta } from './chat/chatActions.js';
import { 
    carregarConversa,
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
} from './chat/chatStorage.js';
import { initializeInputBar, destroyInputBar } from './modules/inputBar.js';

// Estado global inicializado
window.currentModel = 'gemma2:2b';
window.conversas = window.conversas || [];
window.conversaAtual = window.conversaAtual || null;

let welcomeBar = null;
let chatBar = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM loaded, initializing...');
    
    // Prevenir submit padrão em TODOS os formulários
    document.querySelectorAll('form').forEach(form => {
        console.log('[DEBUG] Preventing default submit on form:', form.id);
        form.addEventListener('submit', (e) => e.preventDefault());
    });

    const welcomeForm = document.getElementById('welcome-form');
    const chatForm = document.getElementById('chat-form');
    const chatContainer = document.querySelector('.chat-container');
    const welcomeInput = document.getElementById('welcome-input');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');

    const welcomeCommandMenu = document.getElementById('command-menu');
    const chatCommandMenu = document.getElementById('chat-command-menu');

    const COMMANDS = [
        { command: '/youtube', description: 'Processar vídeo do YouTube' },
        { command: '/salvar', description: 'Salvar conversa atual' },
        { command: '/historico', description: 'Ver histórico completo' },
        { command: '/config', description: 'Abrir configurações' }
    ];

    // Inicializar barra de entrada da tela inicial
    if (welcomeInput && welcomeCommandMenu) {
        welcomeBar = initializeInputBar(
            welcomeInput, 
            welcomeCommandMenu, 
            COMMANDS.map(c => c.command)
        );

        welcomeForm?.addEventListener('customSubmit', async (e) => {
            console.log('[DEBUG] Welcome form custom submit triggered');
            const message = e.detail.message;
            if (!message) return;
            
            if (!window.conversaAtual) {
                criarNovaConversa();
            }

            welcomeBar?.destroy();

            iniciarChat(
                document.querySelector('.welcome-screen'),
                chatContainer,
                document.querySelector('.input-container')
            );
            
            await enviarMensagem(message, welcomeInput, chatContainer, sendBtn, stopBtn);
            atualizarListaConversas();
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        });
    }

    // Inicializar barra de entrada do chat
    if (chatInput && chatCommandMenu) {
        chatBar = initializeInputBar(
            chatInput, 
            chatCommandMenu, 
            COMMANDS.map(c => c.command)
        );

        chatForm?.addEventListener('customSubmit', async (e) => {
            console.log('[DEBUG] Chat form custom submit triggered');
            const message = e.detail.message;
            if (!message) return;
            
            chatBar.clear();
            await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
            atualizarListaConversas();
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        });
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
        console.log('[DEBUG] New chat button clicked');
        if (window.conversaAtual) {
            atualizarListaConversas();
        }
        
        chatBar?.destroy();
        
        window.conversaAtual = null;
        mostrarTelaInicial(
            document.querySelector('.welcome-screen'),
            chatContainer,
            document.querySelector('.input-container'),
            welcomeInput,
            chatInput
        );

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
        console.log('[DEBUG] Stop button clicked');
        interromperResposta();
    });

    // Inicializar lista de conversas
    atualizarListaConversas();

    // Eventos globais para sincronização
    window.addEventListener('historicoAtualizado', () => {
        console.log('[DEBUG] História atualizado event received');
        atualizarListaConversas();
    });

    window.addEventListener('mensagemEnviada', () => {
        console.log('[DEBUG] Mensagem enviada event received');
        atualizarListaConversas();
    });
});

// Expor funções globalmente
window.carregarConversa = carregarConversa;
window.criarNovaConversa = criarNovaConversa;
window.adicionarMensagemAoHistorico = adicionarMensagemAoHistorico;
window.interromperResposta = interromperResposta;
window.renomearConversa = renomearConversa;
window.excluirConversa = excluirConversa;
