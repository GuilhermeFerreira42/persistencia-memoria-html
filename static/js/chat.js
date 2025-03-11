
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    mostrarCarregamento
} from './chat/chatUI.js';

import {
    enviarMensagem,
    interromperResposta,
    atualizarBotoes
} from './chat/chatActions.js';

import {
    carregarConversa,
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
} from './chat/chatStorage.js';

import {
    copiarCodigo,
    copiarMensagem,
    melhorarBlocosCodigo
} from './chat/chatUtils.js';

import {
    inicializarSync,
    entrarNaSalaDeConversa
} from './chat/chatSync.js';

// Estado global das conversas
window.conversations = {};

// Função para inicializar uma conversa na estrutura global
window.inicializarConversa = function(conversationId) {
    if (!window.conversations[conversationId]) {
        // Inicializando estrutura para conversa
        window.conversations[conversationId] = {
            data: { 
                id: conversationId,
                title: "Nova Conversa",
                messages: []
            },
            streaming: false,
            currentResponse: '',
            eventSource: null,
            abortController: null,
            pendingUpdates: false
        };
    }
    return window.conversations[conversationId];
};

// Estas funções agora estão exportadas corretamente em chatUtils.js
// Removemos a duplicação aqui

// Função para regenerar resposta (útil para depuração)
window.regenerarResposta = function(button) {
    if (!window.conversaAtual) {
        console.error('[ERRO] Sem conversa ativa para regenerar resposta');
        return;
    }
    
    const messageDiv = button.closest('.message');
    const conversationId = window.conversaAtual.id;
    
    // Encontrar a última mensagem do usuário na conversa atual
    if (window.conversations[conversationId] && 
        window.conversations[conversationId].data && 
        window.conversations[conversationId].data.messages) {
        
        const messages = window.conversations[conversationId].data.messages;
        let lastUserMessage = null;
        
        // Percorrer mensagens de trás para frente para encontrar a última do usuário
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                lastUserMessage = messages[i].content;
                break;
            }
        }
        
        if (lastUserMessage) {
            // Remover a mensagem atual da IA
            messageDiv.remove();
            
            // Re-enviar a mensagem do usuário para gerar nova resposta
            const chatContainer = document.querySelector('.chat-container');
            const sendBtn = document.getElementById('send-btn');
            const stopBtn = document.getElementById('stop-btn');
            const dummyInput = { value: '' };
            
            enviarMensagem(lastUserMessage, dummyInput, chatContainer, sendBtn, stopBtn);
        } else {
            console.error('[ERRO] Não foi possível encontrar a última mensagem do usuário');
        }
    }
};

// Inicializar a sincronização via WebSockets quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar WebSocket para sincronização entre abas
    inicializarSync();
    
    // Configurar o listener de visibilidade para sincronização
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Atualizar a lista de conversas quando a aba ficar visível
            atualizarListaConversas();
        }
    });
});

export {
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
    excluirConversa,
    melhorarBlocosCodigo,
    atualizarBotoes,
    inicializarSync,
    entrarNaSalaDeConversa
};
