import { mostrarCarregamento, adicionarMensagemStreaming, atualizarMensagemStreaming } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';
import { renderMessage, accumulateChunk, renderCompleteResponse, clearAccumulatedResponse } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';

// Sistema de logging
const logger = {
    debug: (message, data = {}) => {
        // console.log(`[DEBUG] ${message}`, data);
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'debug',
                message,
                data,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('[ERRO] Falha ao salvar log:', err));
    },
    error: (message, error = null) => {
        // console.error(`[ERRO] ${message}`, error);
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'error',
                message,
                error: error ? error.toString() : null,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('[ERRO] Falha ao salvar log:', err));
    }
};

// Mapa para controlar o estado de streaming por conversa
const streamingStates = new Map();

// Mapa para rastrear messageIds de streaming
const streamingMessageIds = new Map();

// Mapa para acumular chunks por conversa
const streamingChunks = new Map();

// Inicializa o socket
const socket = io();

// Adicionar log de conexão
socket.on('connect', () => {
    logger.debug('WebSocket conectado com sucesso');
});

socket.on('connect_error', (error) => {
    logger.error('Falha na conexão WebSocket', error);
});

// Função para entrar em uma sala de conversa
export function entrarNaSala(conversationId) {
    if (!conversationId) {
        logger.error('ID da conversa não fornecido para entrar na sala');
        return;
    }
    
    logger.debug('Entrando na sala da conversa', { conversationId });
    socket.emit('join_conversation', { conversation_id: conversationId });
}

// Função para sair de uma sala de conversa
export function sairDaSala(conversationId) {
    if (!conversationId) {
        logger.error('ID da conversa não fornecido para sair da sala');
        return;
    }
    
    logger.debug('Saindo da sala da conversa', { conversationId });
    socket.emit('leave_conversation', { conversation_id: conversationId });
}

// Listener para chunks da mensagem
socket.on('message_chunk', (data) => {
    logger.debug('Recebido chunk', { 
        conversationId: data.conversation_id,
        chunkSize: data.content?.length,
        timestamp: Date.now()
    });

    const { content, conversation_id } = data;
    if (!content || !conversation_id || content === '[DONE]') {
        logger.debug('Chunk vazio ou marcador de fim recebido', { content, conversation_id });
        return;
    }
    
    // Verificar se é a conversa atual
    if (window.conversaAtual?.id !== conversation_id) {
        logger.debug('Ignorando chunk de outra conversa', {
            atual: window.conversaAtual?.id,
            recebido: conversation_id
        });
        return;
    }
    
    // Marca conversa como em streaming e acumula o chunk
    streamingStates.set(conversation_id, true);
    
    // Acumular chunk
    if (!streamingChunks.has(conversation_id)) {
        streamingChunks.set(conversation_id, '');
    }
    streamingChunks.set(conversation_id, streamingChunks.get(conversation_id) + content);
    
    // Atualizar UI com o novo chunk
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        logger.error('Container de chat não encontrado');
        return;
    }

    // Buscar ou criar mensagem de streaming
    let messageId = streamingMessageIds.get(conversation_id);
    let streamingMessage = chatContainer.querySelector(`.message.streaming-message[data-message-id="${messageId}"]`);
    
    if (!streamingMessage) {
        messageId = `streaming_${conversation_id}`;
        streamingMessageIds.set(conversation_id, messageId);
        logger.debug('Criando nova mensagem de streaming', { messageId, conversation_id });
        streamingMessage = adicionarMensagemStreaming(chatContainer, messageId, conversation_id);
    }

    if (streamingMessage) {
        logger.debug('Atualizando mensagem de streaming', {
            messageId,
            chunkSize: content.length,
            totalSize: streamingChunks.get(conversation_id).length
        });
        atualizarMensagemStreaming(messageId, content);
        // Também acumular no messageRenderer para consistência
        accumulateChunk(content, conversation_id);
    } else {
        logger.error('Falha ao criar/atualizar mensagem de streaming', {
            conversationId,
            messageId
        });
    }
});

// Listener para resposta completa
socket.on('response_complete', (data) => {
    logger.debug('Evento response_complete recebido', {
        data,
        conversaAtual: window.conversaAtual?.id,
        streamingStates: Array.from(streamingStates.entries())
    });

    const { conversation_id } = data;
    if (!conversation_id) {
        logger.error('ID da conversa não fornecido na resposta completa');
        return;
    }

    // Verifica se é a conversa atual
    if (window.conversaAtual?.id !== conversation_id) {
        logger.debug('Ignorando resposta de outra conversa', {
            atual: window.conversaAtual?.id,
            recebido: conversation_id
        });
        clearAccumulatedResponse(conversation_id);
        streamingStates.delete(conversation_id);
        streamingChunks.delete(conversation_id);
        streamingMessageIds.delete(conversation_id);
        return;
    }

    // Remove estado de streaming
    const wasStreaming = streamingStates.delete(conversation_id);
    streamingMessageIds.delete(conversation_id); // Limpar o messageId
    logger.debug('Estado de streaming removido', {
        conversationId: conversation_id,
        wasStreaming,
        remainingStates: Array.from(streamingStates.entries())
    });

    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        logger.error('Container do chat não encontrado');
        return;
    }

    try {
        // Renderiza resposta completa
        const renderedHtml = renderCompleteResponse(conversation_id);
        if (!renderedHtml) {
            throw new Error('Resposta vazia ou inválida');
        }

        // Remover mensagem de streaming se existir
        const streamingMessage = chatContainer.querySelector(`.message.streaming-message[data-conversation-id="${conversation_id}"]`);
        if (streamingMessage) {
            logger.debug('Removendo mensagem de streaming', {
                messageId: streamingMessage.dataset.messageId,
                conversationId
            });
            streamingMessage.remove();
        }

        // Cria elemento da mensagem final com animação suave
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.dataset.messageId = `${Date.now()}_assistant`;
        messageDiv.dataset.conversationId = conversation_id;
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(10px)';
        messageDiv.innerHTML = `
            <div class="message-content">${renderedHtml}</div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `;

        // Adiciona ao chat e anima
        chatContainer.appendChild(messageDiv);
        logger.debug('Mensagem final adicionada ao chat', {
            id: messageDiv.dataset.messageId,
            conversationId: messageDiv.dataset.conversationId
        });

        requestAnimationFrame(() => {
            messageDiv.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        });

        // Rola para o final suavemente
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });

        // Melhora blocos de código após a animação terminar
        setTimeout(() => {
            melhorarBlocosCodigo(messageDiv);
        }, 300);

        // Salva no histórico
        adicionarMensagemAoHistorico(renderedHtml, 'assistant', conversation_id);
        atualizarListaConversas();

        // Limpa o buffer de chunks
        streamingChunks.delete(conversation_id);

    } catch (error) {
        logger.error('Falha ao processar resposta', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error';
        errorDiv.innerHTML = '<div class="message-content">Erro ao processar a resposta</div>';
        chatContainer.appendChild(errorDiv);
    }
});

function inicializarConversa(conversationId) {
    if (!window.conversations[conversationId]) {
        window.conversations[conversationId] = {
            data: { 
                id: conversationId,
                title: "Nova Conversa",
                messages: []
            },
            streaming: false,
            currentResponse: '',
            eventSource: null,
            abortController: null
        };
    }
    return window.conversations[conversationId];
}

// Função para atualizar os botões com base na conversa atual
export function atualizarBotoes(sendBtn, stopBtn) {
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        // Se não houver conversa ativa, mostrar apenas o botão de enviar
        sendBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        return;
    }
    
    const conversation = window.conversations[conversationId];
    if (conversation && conversation.streaming) {
        sendBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
    } else {
        sendBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
    }
}

// Função para verificar se o usuário está no final do chat
function isUserAtBottom(container) {
    const threshold = 50; // pixels de tolerância
    return container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
}

// Função para rolar suavemente para o final
function scrollToBottom(container) {
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
}

// Função para gerenciar scroll durante streaming
function handleStreamingScroll(container, content) {
    let userScrolledUp = false;
    let scrollTimeout = null;
    
    const scrollListener = () => {
        userScrolledUp = !isUserAtBottom(container);
        
        // Limpar timeout anterior
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Se o usuário rolar para baixo até o final, resetar o estado
        if (userScrolledUp && isUserAtBottom(container)) {
            userScrolledUp = false;
        }
    };
    
    // Adicionar listener de scroll
    container.addEventListener('scroll', scrollListener);
    
    // Retornar função para limpar o listener
    return () => {
        container.removeEventListener('scroll', scrollListener);
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
    };
}

// Função auxiliar para forçar renderização
function forcarRenderizacao(elemento) {
    // Forçar reflow
    void elemento.offsetHeight;
    
    // Usar requestAnimationFrame para garantir a renderização
    requestAnimationFrame(() => {
        elemento.style.opacity = '1';
        elemento.style.transform = 'translateY(0)';
        
        // Segundo frame para garantir que a transição seja aplicada
        requestAnimationFrame(() => {
            if (elemento.parentElement) {
                elemento.parentElement.scrollTop = elemento.parentElement.scrollHeight;
            }
        });
    });
}

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim()) {
        // console.warn('[DEBUG] Tentativa de enviar mensagem vazia');
        return;
    }

    if (!window.conversaAtual) {
        // console.log('[DEBUG] Criando nova conversa');
        criarNovaConversa();
    }

    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        // console.warn('[DEBUG] ID da conversa não definido ao enviar mensagem');
        return;
    }

    const userTimestamp = new Date().toISOString();
    const userMessageId = userTimestamp;
    // console.log('[DEBUG] Enviando mensagem:', { mensagem, conversationId, timestamp: userTimestamp });

    try {
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.display = 'none';
        }
        if (stopBtn) {
            stopBtn.style.display = 'flex';
        }

        input.value = '';
        input.style.height = 'auto';

        // Adicionar mensagem do usuário ao DOM
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user';
        userMessageDiv.dataset.messageId = userMessageId;
        userMessageDiv.dataset.conversationId = conversationId;
        userMessageDiv.innerHTML = `
            <div class="message-content">${renderMessage(mensagem)}</div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;
        userMessageDiv.style.opacity = '0';
        chatContainer.appendChild(userMessageDiv);
        forcarRenderizacao(userMessageDiv);

        // Remover qualquer placeholder existente antes de criar um novo
        // console.log('[DEBUG] Removendo placeholders existentes antes de criar novo');
        const existingPlaceholders = chatContainer.querySelectorAll('.message.assistant:not([data-message-id]), .message.assistant.streaming-message');
        existingPlaceholders.forEach(placeholder => {
            // console.log('[DEBUG] Removendo placeholder antigo:', {
            //     id: placeholder.dataset.conversationId,
            //     classes: placeholder.className
            // });
            placeholder.remove();
        });

        // Criar mensagem de streaming inicial
        const messageId = `streaming_${conversationId}`;
        streamingMessageIds.set(conversationId, messageId);
        const streamingMessage = adicionarMensagemStreaming(chatContainer, messageId, conversationId);
        // console.log('[DEBUG] Placeholder de streaming criado para conversa:', conversationId);

        streamingStates.set(conversationId, true);
        // console.log('[DEBUG] Estado de streaming definido:', {
        //     conversationId,
        //     isStreaming: streamingStates.has(conversationId)
        // });

        // Rolar para o final suavemente
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });

        adicionarMensagemAoHistorico(mensagem, 'user', conversationId);

        // Enviar mensagem para o backend
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: mensagem,
                conversation_id: conversationId,
                timestamp: userTimestamp
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.status}`);
        }

        // console.log('[DEBUG] Mensagem enviada com sucesso para o backend');
    } catch (error) {
        // console.error('[ERRO] Falha ao enviar mensagem:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error';
        errorDiv.innerHTML = '<div class="message-content">Erro ao processar a mensagem. Por favor, tente novamente.</div>';
        chatContainer.appendChild(errorDiv);
        forcarRenderizacao(errorDiv);

        // Remover o placeholder e estado de streaming em caso de erro
        const streamingMessage = chatContainer.querySelector(`.message.assistant.streaming-message[data-conversation-id="${conversationId}"]`);
        if (streamingMessage) {
            // console.log('[DEBUG] Removendo placeholder devido a erro');
            streamingMessage.remove();
        }
        streamingStates.delete(conversationId);
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.display = 'flex';
        }
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
    }
}

// Adicionar MutationObserver para garantir renderização
const chatContainer = document.querySelector('.chat-container');
if (chatContainer) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            }
        });
    });

    observer.observe(chatContainer, { 
        childList: true, 
        subtree: true 
    });
}

// Adicionar listener para atualização de conversa
socket.on('conversation_updated', (data) => {
    // console.log('[DEBUG] Evento conversation_updated recebido:', {
    //     data,
    //     conversaAtual: window.conversaAtual?.id,
    //     streamingStates: Array.from(streamingStates.entries())
    // });

    const { conversation_id } = data;
    if (window.conversaAtual?.id === conversation_id) {
        // console.log('[DEBUG] Atualizando conversa atual:', conversation_id);
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) {
            // console.warn('[DEBUG] Container do chat não encontrado');
            return;
        }

        // Remove mensagens de carregamento antigas
        const loadingMessages = chatContainer.querySelectorAll('.message.assistant.loading');
        loadingMessages.forEach(msg => {
            // console.log('[DEBUG] Removendo mensagem de carregamento antiga:', {
            //     id: msg.dataset.conversationId,
            //     classes: msg.className
            // });
            msg.remove();
        });

        // Mapeia mensagens existentes
        const existingMessages = new Map(
            Array.from(chatContainer.querySelectorAll('.message')).map(msg => [
                msg.dataset.messageId,
                msg
            ])
        );

        // console.log('[DEBUG] Mensagens existentes:', {
        //     total: existingMessages.size,
        //     ids: Array.from(existingMessages.keys())
        // });

        fetch(`/get_conversation/${conversation_id}/0/20`)
            .then(response => response.json())
            .then(data => {
                if (data.messages) {
                    data.messages.forEach(msg => {
                        const messageId = msg.timestamp;
                        let existingMsg = existingMessages.get(messageId);

                        // Se for uma nova mensagem do assistente, remover o placeholder de carregamento
                        if (msg.role === 'assistant' && !existingMsg) {
                            // console.log('[DEBUG] Nova mensagem do assistente detectada, removendo placeholder');
                            const streamingMessage = chatContainer.querySelector(`.message.assistant.streaming-message[data-conversation-id="${conversation_id}"]`);
                            if (streamingMessage) {
                                // console.log('[DEBUG] Removendo placeholder de carregamento para conversa:', conversation_id);
                                streamingMessage.remove();
                                // Remover estado de streaming
                                streamingStates.delete(conversation_id);
                            }
                        }

                        if (!existingMsg) {
                            // Procurar por uma mensagem com conteúdo idêntico
                            for (const [id, elem] of existingMessages) {
                                const content = elem.querySelector('.message-content').innerHTML;
                                if (content === renderMessage(msg.content) && elem.classList.contains(msg.role)) {
                                    existingMsg = elem;
                                    // console.log('[DEBUG] Encontrada mensagem correspondente por conteúdo:', {
                                    //     oldId: id,
                                    //     newId: messageId,
                                    //     role: msg.role
                                    // });
                                    elem.dataset.messageId = messageId;
                                    existingMessages.delete(id);
                                    existingMessages.set(messageId, elem);
                                    break;
                                }
                            }
                        }

                        if (existingMsg) {
                            // console.log('[DEBUG] Atualizando mensagem existente:', {
                            //     messageId,
                            //     role: msg.role
                            // });
                            const currentContent = existingMsg.querySelector('.message-content').innerHTML;
                            const newContent = renderMessage(msg.content);
                            if (currentContent !== newContent) {
                                existingMsg.querySelector('.message-content').innerHTML = newContent;
                            }
                        } else {
                            // console.log('[DEBUG] Adicionando nova mensagem:', {
                            //     messageId,
                            //     role: msg.role
                            // });
                            const messageDiv = document.createElement('div');
                            messageDiv.className = `message ${msg.role}`;
                            messageDiv.dataset.messageId = messageId;
                            messageDiv.dataset.conversationId = conversation_id;
                            messageDiv.innerHTML = `
                                <div class="message-content">${renderMessage(msg.content)}</div>
                                <div class="message-actions">
                                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    ${msg.role === 'assistant' ? `
                                        <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                                            <i class="fas fa-redo"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                            chatContainer.appendChild(messageDiv);
                            forcarRenderizacao(messageDiv);
                        }
                        existingMessages.delete(messageId);
                    });

                    // Verifica se ainda há placeholders após atualizar
                    const remainingPlaceholders = chatContainer.querySelectorAll('.message.assistant:not([data-message-id]), .message.assistant.streaming-message');
                    if (remainingPlaceholders.length > 0) {
                        // console.warn('[DEBUG] Placeholders encontrados após atualização:', {
                        //     quantidade: remainingPlaceholders.length,
                        //     elementos: Array.from(remainingPlaceholders).map(p => ({
                        //         id: p.dataset.conversationId,
                        //         classes: p.className,
                        //         content: p.textContent
                        //     }))
                        // });

                        // Remove placeholders se a conversa não estiver mais em streaming
                        if (!streamingStates.has(conversation_id)) {
                            // console.log('[DEBUG] Removendo placeholders pois conversa não está mais em streaming');
                            remainingPlaceholders.forEach(p => p.remove());
                        }
                    }
                }

                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            })
            .catch(error => console.error('[ERRO] Falha ao atualizar conversa:', error));
    }
});

export function interromperResposta() {
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) return;
    
    if (streamingStates.has(conversationId)) {
        streamingStates.delete(conversationId);
        clearAccumulatedResponse(conversationId);
    }
    
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        const streamingMessage = chatContainer.querySelector('.message.assistant.streaming-message');
        const loadingMessage = chatContainer.querySelector('.message.assistant.loading');
        if (streamingMessage) streamingMessage.remove();
        if (loadingMessage) loadingMessage.remove();
    }
    
    // Atualizar botões após interromper
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (sendBtn && stopBtn) {
        atualizarBotoes(sendBtn, stopBtn);
    }
}

export function carregarConversa(conversationId) {
    // console.log('[DEBUG] Carregando conversa:', conversationId);
    window.conversaAtual = { id: conversationId };
    
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        // console.warn('[DEBUG] Container do chat não encontrado ao carregar conversa');
        return;
    }

    // Limpa o container
    chatContainer.innerHTML = '';

    // Carrega mensagens existentes
    fetch(`/get_conversation/${conversationId}/0/20`)
        .then(response => response.json())
        .then(data => {
            if (data.messages) {
                data.messages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message ${msg.role}`;
                    messageDiv.dataset.messageId = msg.timestamp;
                    messageDiv.dataset.conversationId = conversationId;
                    messageDiv.innerHTML = `
                        <div class="message-content">${renderMessage(msg.content)}</div>
                        <div class="message-actions">
                            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                                <i class="fas fa-copy"></i>
                            </button>
                            ${msg.role === 'assistant' ? `
                                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                                    <i class="fas fa-redo"></i>
                                </button>
                            ` : ''}
                        </div>
                    `;
                    chatContainer.appendChild(messageDiv);
                });
            }

            // Verifica se a conversa está em streaming
            const isStreaming = streamingStates.has(conversationId);
            // console.log('[DEBUG] Verificando estado de streaming:', {
            //     conversationId,
            //     isStreaming,
            //     allStates: Array.from(streamingStates.entries())
            // });

            if (isStreaming) {
                // console.log('[DEBUG] Conversa em streaming detectada, recriando placeholder');
                const streamingMessage = document.createElement('div');
                streamingMessage.className = 'message assistant streaming-message';
                streamingMessage.dataset.conversationId = conversationId;
                streamingMessage.innerHTML = '<div class="message-content">Gerando resposta...</div>';
                chatContainer.appendChild(streamingMessage);
                
                // Rolar para o final suavemente
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
        })
        .catch(error => {
            console.error('[ERRO] Falha ao carregar conversa:', error);
            chatContainer.innerHTML = '<div class="error-message">Erro ao carregar a conversa. Por favor, tente novamente.</div>';
        });
}
