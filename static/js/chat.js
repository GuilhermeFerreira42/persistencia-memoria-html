
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    mostrarCarregamento,
    iniciarStreamingMensagem,
    atualizarStreamingMensagem,
    finalizarStreamingMensagem
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
    melhorarBlocosCodigo,
    conversasCache
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

// Função para copiar código - melhorada para preservar indentação
window.copiarCodigo = function(button) {
    const codeContainer = button.closest('.code-container');
    const codeBlock = codeContainer.querySelector('.code-block code');
    const code = codeBlock.innerText; // Usa innerText para preservar indentação
    
    navigator.clipboard.writeText(code).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Restaurar o ícone original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar código:', err);
        alert('Não foi possível copiar o código. Por favor, tente novamente.');
    });
};

// Função para copiar mensagem completa
window.copiarMensagem = function(button) {
    const messageDiv = button.closest('.message');
    const content = messageDiv.querySelector('.message-content').innerText; // Também usa innerText aqui
    
    navigator.clipboard.writeText(content).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Restaurar o ícone original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar mensagem:', err);
        alert('Não foi possível copiar a mensagem. Por favor, tente novamente.');
    });
};

// Função modificada para enviar mensagem com efeito de digitação
window.enviarMensagemComEfeitoDigitacao = async function(texto, chatContainer, conversationId) {
    // Verificar se já existe uma conversa ativa
    if (!conversationId && window.conversaAtual) {
        conversationId = window.conversaAtual.id;
    }
    
    if (!conversationId) {
        console.error('[ERRO] Sem ID de conversa para enviar mensagem');
        return;
    }
    
    // Adicionar mensagem do usuário
    adicionarMensagem(chatContainer, texto, 'user');
    
    // Salvar mensagem do usuário no backend
    try {
        await fetch('/save_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                content: texto,
                role: 'user'
            })
        });
    } catch (error) {
        console.error('[ERRO] Falha ao salvar mensagem do usuário:', error);
    }
    
    // Iniciar o streaming de resposta
    const streamingMsg = iniciarStreamingMensagem(chatContainer);
    
    // Iniciar EventSource para streaming
    const eventSource = new EventSource(`/stream?conversation_id=${conversationId}&message=${encodeURIComponent(texto)}`);
    let respostaCompleta = '';
    
    eventSource.onmessage = function(event) {
        const chunk = event.data;
        respostaCompleta += chunk;
        
        // Atualizar a mensagem em streaming
        atualizarStreamingMensagem(chunk);
    };
    
    eventSource.onerror = function(error) {
        console.error('[ERRO] Erro no streaming:', error);
        eventSource.close();
        
        // Finalizar mensagem em streaming
        finalizarStreamingMensagem();
        
        // Salvar resposta no histórico, se houver conteúdo
        if (respostaCompleta) {
            adicionarMensagemAoHistorico(conversationId, respostaCompleta, 'assistant');
        }
    };
    
    // Quando o streaming terminar
    eventSource.addEventListener('end', function() {
        eventSource.close();
        
        // Finalizar mensagem em streaming
        finalizarStreamingMensagem();
        
        // Salvar resposta no histórico
        adicionarMensagemAoHistorico(conversationId, respostaCompleta, 'assistant');
    });
    
    return streamingMsg;
};

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
            
            // Usar o novo método com efeito de digitação
            window.enviarMensagemComEfeitoDigitacao(lastUserMessage, chatContainer, conversationId);
        } else {
            console.error('[ERRO] Não foi possível encontrar a última mensagem do usuário');
        }
    }
};

// Limpar cache para uma conversa específica
window.limparCacheConversa = function(conversationId) {
    if (conversationId && conversasCache[conversationId]) {
        delete conversasCache[conversationId];
        console.log(`[DEBUG] Cache limpo para conversa: ${conversationId}`);
        return true;
    }
    return false;
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
    entrarNaSalaDeConversa,
    iniciarStreamingMensagem,
    atualizarStreamingMensagem,
    finalizarStreamingMensagem
};
