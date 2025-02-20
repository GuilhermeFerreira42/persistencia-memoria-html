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

// Estado global
window.currentModel = 'gemma2:2b';
window.conversas = [];
window.conversaAtual = null;

let welcomeBar = null;
let chatBar = null;

document.addEventListener('DOMContentLoaded', () => {
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

    // Inicializar barra de entrada da tela inicial
    if (welcomeInput && welcomeCommandMenu) {
        welcomeBar = initializeInputBar(
            welcomeInput, 
            welcomeCommandMenu, 
            COMMANDS.map(c => c.command)
        );

        welcomeForm?.addEventListener('customSubmit', async (e) => {
            const message = e.detail.message;
            
            // Criar nova conversa se não existir
            if (!window.conversaAtual) {
                const novaConversa = {
                    id: Date.now().toString(),
                    titulo: 'Nova conversa',
                    mensagens: []
                };
                window.conversas.unshift(novaConversa);
                window.conversaAtual = novaConversa;
                atualizarListaConversas();
            }

            // Limpar barra de boas-vindas antes de trocar de tela
            welcomeBar?.destroy();

            iniciarChat(
                document.querySelector('.welcome-screen'),
                chatContainer,
                document.querySelector('.input-container')
            );

            adicionarMensagem(chatContainer, message, 'user');
            adicionarMensagemAoHistorico(message, 'user');
            
            await enviarMensagem(message, welcomeInput, chatContainer, sendBtn, stopBtn);
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
            const message = e.detail.message;
            
            // Verificar se é comando do YouTube
            if (message.startsWith('/youtube ')) {
                const url = message.split(' ')[1];
                if (url) {
                    await handleYoutubeCommand(url, chatContainer);
                } else {
                    adicionarMensagem(chatContainer, "Por favor, forneça uma URL do YouTube válida", 'assistant');
                }
                chatBar?.clear();
                return;
            }
            
            adicionarMensagem(chatContainer, message, 'user');
            adicionarMensagemAoHistorico(message, 'user');
            chatBar.clear();
            
            await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
        });
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
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
});

// Expor funções globalmente
window.carregarConversa = carregarConversa;
window.criarNovaConversa = criarNovaConversa;
window.adicionarMensagemAoHistorico = adicionarMensagemAoHistorico;
window.interromperResposta = interromperResposta;
window.renomearConversa = renomearConversa;
window.excluirConversa = excluirConversa;
