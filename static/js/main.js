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

// Estado global
window.currentModel = 'gemma2:2b';
window.conversas = [];
window.conversaAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("Página carregada, iniciando configuração...");
    
    if (!Array.isArray(window.conversas)) {
        console.error("Erro: window.conversas não é um array.");
        window.conversas = [];
    }
    
    const welcomeForm = document.getElementById('welcome-form');
    const chatForm = document.getElementById('chat-form');
    const chatContainer = document.querySelector('.chat-container');
    const welcomeInput = document.getElementById('welcome-input');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newChatBtn = document.querySelector('.new-chat-btn');

    // Se houver conversas, carrega a mais recente
    if (window.conversas && window.conversas.length > 0) {
        console.log("Carregando última conversa ativa...");
        carregarConversa(window.conversas[0].id);
    }

    // Configurar botão de nova conversa
    newChatBtn?.addEventListener('click', () => {
        console.log("Iniciando nova conversa...");
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

        console.log("Processando mensagem inicial:", message);

        if (!window.conversaAtual) {
            console.log("Criando nova conversa...");
            const novaConversa = {
                id: Date.now().toString(),
                titulo: 'Nova Conversa',
                mensagens: []
            };
            window.conversas.unshift(novaConversa);
            window.conversaAtual = novaConversa;
            console.log("Nova conversa criada:", novaConversa);
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

        console.log("Processando mensagem do chat:", message);

        adicionarMensagem(chatContainer, message, 'user');
        adicionarMensagemAoHistorico(message, 'user');
        
        await enviarMensagem(message, chatInput, chatContainer, sendBtn, stopBtn);
    });

    stopBtn?.addEventListener('click', () => {
        console.log("Interrompendo resposta...");
        interromperResposta();
    });

    // Inicializar lista de conversas
    console.log("Inicializando lista de conversas...");
    atualizarListaConversas();
});

// Expor funções globalmente
window.carregarConversa = carregarConversa;
window.criarNovaConversa = criarNovaConversa;
window.adicionarMensagemAoHistorico = adicionarMensagemAoHistorico;
window.interromperResposta = interromperResposta;
window.renomearConversa = renomearConversa;
window.excluirConversa = excluirConversa;