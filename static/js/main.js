
import './init.js';
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    melhorarBlocosCodigo
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
import { copiarMensagem, regenerarResposta } from './chat/chatUtils.js';

// Estado global
window.currentModel = 'gemma2:2b';
window.conversas = [];
window.conversaAtual = null;
window.copiarMensagem = copiarMensagem;
window.regenerarResposta = regenerarResposta;

let welcomeBar = null;
let chatBar = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] DOM Carregado, inicializando aplicação...');
    
    const welcomeForm = document.getElementById('welcome-form');
    const chatForm = document.getElementById('chat-form');
    const chatContainer = document.querySelector('.chat-container');
    const welcomeInput = document.getElementById('welcome-input');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');

    // Configurar menu de comando usando o módulo criado
    const welcomeCommandMenu = document.getElementById('command-menu');
    const chatCommandMenu = document.getElementById('chat-command-menu');

    const COMMANDS = [
        { command: '/youtube', description: 'Processar vídeo do YouTube' },
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
            
            chatBar.clear();
            await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
            atualizarListaConversas(); // Atualizar histórico após enviar mensagem
            
            // Adicionar barras de título aos blocos de código
            setTimeout(() => {
                melhorarBlocosCodigo();
            }, 100);
        });
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
        console.log('[DEBUG] Botão de nova conversa clicado');
        
        if (window.conversaAtual) {
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

    // Evento global para atualização do histórico
    window.addEventListener('conversaAtualizada', () => {
        console.log('[DEBUG] Evento conversaAtualizada detectado');
        atualizarListaConversas();
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
    
    // Log de inicialização concluída
    console.log('[DEBUG] Aplicação inicializada com sucesso');
});

// Expor funções globalmente
window.carregarConversa = carregarConversa;
window.criarNovaConversa = criarNovaConversa;
window.adicionarMensagemAoHistorico = adicionarMensagemAoHistorico;
window.interromperResposta = interromperResposta;
window.renomearConversa = renomearConversa;
window.excluirConversa = excluirConversa;
window.melhorarBlocosCodigo = melhorarBlocosCodigo;
