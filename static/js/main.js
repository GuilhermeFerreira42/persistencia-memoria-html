
import './init.js';
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    enviarMensagem,
    interromperResposta,
    carregarConversa,
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
} from './chat.js';
import { initCommandMenu } from './modules/commandMenu.js';
import { COMMANDS } from './modules/commands.js';

// Estado global
window.currentModel = 'gemma2:2b';
window.conversas = [];
window.conversaAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    const welcomeForm = document.getElementById('welcome-form');
    const chatForm = document.getElementById('chat-form');
    const chatContainer = document.querySelector('.chat-container');
    const welcomeInput = document.getElementById('welcome-input');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');

    // Configurar menus de comando usando o módulo criado
    const welcomeCommandMenu = document.getElementById('command-menu');
    const chatCommandMenu = document.getElementById('chat-command-menu');

    if (welcomeInput && welcomeCommandMenu) {
        initCommandMenu(welcomeInput, welcomeCommandMenu, COMMANDS.map(c => c.command));
    }
    if (chatInput && chatCommandMenu) {
        initCommandMenu(chatInput, chatCommandMenu, COMMANDS.map(c => c.command));
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
        window.conversaAtual = null;
        mostrarTelaInicial(
            document.querySelector('.welcome-screen'),
            chatContainer,
            document.querySelector('.input-container'),
            welcomeInput,
            chatInput
        );
    });

    welcomeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = welcomeInput.value.trim();
        if (!message) return;

        // Se o texto começar com '/' e não for um comando completo
        if (message.startsWith('/') && !message.includes(' ')) {
            // Não enviar, apenas mostrar menu
            return;
        }

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

        iniciarChat(
            document.querySelector('.welcome-screen'),
            chatContainer,
            document.querySelector('.input-container')
        );

        adicionarMensagem(chatContainer, message, 'user');
        adicionarMensagemAoHistorico(message, 'user');
        
        await enviarMensagem(message, welcomeInput, chatContainer, sendBtn, stopBtn);
    });

    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        adicionarMensagem(chatContainer, message, 'user');
        adicionarMensagemAoHistorico(message, 'user');
        
        await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
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
