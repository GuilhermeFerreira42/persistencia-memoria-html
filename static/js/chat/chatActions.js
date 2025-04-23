import { mostrarCarregamento, adicionarMensagemStreaming, atualizarMensagemStreaming } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';
import { renderMessage, accumulateChunk, renderCompleteResponse, clearAccumulatedResponse, renderMessageChunk, completeMessage } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';
import { handleYoutubeCommand } from '../youtube-system/youtubeHandler.js';
import { handleYoutubeResumoCommand } from '../youtube-system/youtubeResumoHandler.js';

// Sistema de logging
const logger = {
    debug: (message, data = {}) => {
        console.log(`[DEBUG] ${message}`, data);
    },
    error: (message, error = null) => {
        console.error(`[ERRO] ${message}`, error);
    }
};

// Mapa para controlar o estado de streaming por conversa
const streamingStates = new Map();

// Mapa para rastrear messageIds de streaming
const streamingMessageIds = new Map();

// Mapa para acumular chunks por conversa
const streamingChunks = new Map();

// Mapa para rastrear chunks já processados
const processedChunks = new Map();

// Mapa para rastrear o último chunk recebido por conversa
const lastReceivedChunks = new Map();

// Mapa para rastrear mensagens já enviadas
const sentMessages = new Map();

// Gerenciar estado de streaming
const streamingMessages = new Set();

// Monitoramento de streams ativos
let activeStreams = new Set();

// Inicializa o socket apenas uma vez
let socket;
if (!window.socket) {
    window.socket = io();
    socket = window.socket;
    
    // Adicionar log de conexão
    socket.on('connect', () => {
        logger.debug('WebSocket conectado com sucesso');
    });

    socket.on('connect_error', (error) => {
        logger.error('Falha na conexão WebSocket', error);
    });

    // Remove listeners existentes para evitar duplicação
    socket.off('message_chunk');
    socket.off('response_complete');
    socket.off('conversation_updated');

    // Listener para chunks da mensagem
    socket.on('message_chunk', (data) => {
        const { content, conversation_id, chunk_number, message_id } = data;
        
        // Verificar duplicação de mensagem
        if (isDuplicateMessage(conversation_id, content)) {
            logger.debug('Chunk ignorado por ser duplicado', {
                conversationId: conversation_id,
                chunkNumber: chunk_number
            });
            return;
        }
        
        logger.debug('Recebido chunk', { 
            conversationId: conversation_id,
            chunkNumber: chunk_number,
            chunkSize: content?.length,
            timestamp: Date.now()
        });

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

        // Verificar duplicação de chunks
        const lastChunk = lastReceivedChunks.get(conversation_id);
        if (lastChunk === content) {
            logger.debug('Chunk duplicado ignorado', {
                conversationId: conversation_id,
                chunkNumber: chunk_number,
                content: content.substring(0, 20) + '...'
            });
            return;
        }
        lastReceivedChunks.set(conversation_id, content);
        
        // Verificar se o chunk já foi processado
        if (!processedChunks.has(conversation_id)) {
            processedChunks.set(conversation_id, new Set());
        }
        
        if (processedChunks.get(conversation_id).has(chunk_number)) {
            logger.debug('Chunk já processado, ignorando', {
                conversationId: conversation_id,
                chunkNumber: chunk_number
            });
            return;
        }
        
        // Marcar chunk como processado
        processedChunks.get(conversation_id).add(chunk_number);
        
        // Marca conversa como em streaming
        streamingStates.set(conversation_id, true);
        
        // Acumular chunk apenas para renderização final
        if (!streamingChunks.has(conversation_id)) {
            streamingChunks.set(conversation_id, '');
        }
        streamingChunks.set(conversation_id, streamingChunks.get(conversation_id) + content);
        
        // Verificar se há um ID de mensagem
        const messageId = message_id || streamingMessageIds.get(conversation_id) || `streaming_${conversation_id}_${Date.now()}`;
        
        // Atualizar o ID da mensagem em streaming para esta conversa
        streamingMessageIds.set(conversation_id, messageId);

        // Usar o novo sistema de renderização com containers individuais
        import('../messageRenderer.js').then(({ renderMessageContainer, accumulateChunk }) => {
            // Renderizar ou atualizar o container da mensagem
            renderMessageContainer({
                content: streamingChunks.get(conversation_id),
                conversationId: conversation_id,
                role: 'assistant',
                messageId: messageId,
                isStreaming: true
            });
            
            // Também acumular o chunk para referência
            accumulateChunk(content, conversation_id);
        }).catch(error => {
            logger.error('Erro ao importar módulo de renderização', error);
        });
    });

    // Listener para resposta completa
    socket.on('response_complete', (data) => {
        logger.debug('Evento response_complete recebido', {
            data,
            conversaAtual: window.conversaAtual?.id,
            streamingStates: Array.from(streamingStates.entries())
        });

        const { conversation_id, total_chunks, message_id } = data;
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
            import('../messageRenderer.js').then(({ clearAccumulatedResponse }) => {
                clearAccumulatedResponse(conversation_id);
            }).catch(error => {
                logger.error('Erro ao importar módulo de renderização', error);
            });
            
            streamingStates.delete(conversation_id);
            streamingChunks.delete(conversation_id);
            streamingMessageIds.delete(conversation_id);
            processedChunks.delete(conversation_id);
            lastReceivedChunks.delete(conversation_id);
            return;
        }

        // Remove estado de streaming
        const wasStreaming = streamingStates.delete(conversation_id);
        const finalMessageId = message_id || streamingMessageIds.get(conversation_id) || `complete_${conversation_id}_${Date.now()}`;
        streamingMessageIds.delete(conversation_id);
        processedChunks.delete(conversation_id);
        lastReceivedChunks.delete(conversation_id);
        
        logger.debug('Estado de streaming removido', {
            conversationId: conversation_id,
            wasStreaming,
            totalChunks: total_chunks,
            processedChunks: processedChunks.get(conversation_id)?.size || 0
        });

        import('../messageRenderer.js').then(({ renderMessageContainer, clearAccumulatedResponse }) => {
            // Usar o conteúdo acumulado como o conteúdo final
            const finalContent = streamingChunks.get(conversation_id) || '';
            
            // Renderizar a mensagem final usando o mesmo ID para garantir continuidade
            renderMessageContainer({
                content: finalContent,
                conversationId: conversation_id,
                role: 'assistant',
                messageId: finalMessageId,
                isStreaming: false
            });

            // Limpar a resposta acumulada
            clearAccumulatedResponse(conversation_id);
            streamingChunks.delete(conversation_id);
            
            // Rolar para o final da conversa se estiver próximo do fundo
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
            }
        }).catch(error => {
            logger.error('Erro ao importar módulo de renderização', error);
        });
    });
} else {
    socket = window.socket;
}

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
    requestAnimationFrame(() => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
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

// Função para verificar se uma mensagem é duplicada
function isDuplicateMessage(conversationId, content) {
    const key = `${conversationId}:${content}`;
    const lastSentTime = sentMessages.get(key);
    const now = Date.now();
    
    // Se a mensagem foi enviada nos últimos 2 segundos, é considerada duplicata
    if (lastSentTime && (now - lastSentTime) < 2000) {
        logger.debug('Mensagem duplicada detectada', {
            conversationId,
            content: content.substring(0, 20) + '...',
            timeDiff: now - lastSentTime
        });
        return true;
    }
    
    sentMessages.set(key, now);
    return false;
}

// Função para enviar mensagem
export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    console.log('[DEBUG-JS] enviarMensagem em chatActions.js chamada');
    
    if (!mensagem || mensagem.trim() === '') {
        return;
    }
    
    // Log para a conversa atual
    console.log(`[DEBUG-JS] Enviando mensagem para conversa: ${window.conversaAtual?.id || 'nova conversa'}`);
    
    // O código original continua aqui
    logger.debug('Iniciando envio de mensagem', { mensagem });

    if (!mensagem.trim()) {
        logger.debug('Mensagem vazia, ignorando');
        return;
    }

    // Verifica se é um comando do YouTube
    if (mensagem.startsWith('/youtube ')) {
        logger.debug('Comando do YouTube detectado');
        
        // Cria nova conversa se necessário
        if (!window.conversaAtual) {
            logger.debug('Criando nova conversa para comando do YouTube');
            criarNovaConversa();
        }
        
        // Verificar se a mensagem já existe
        const existingMessage = document.querySelector(`.message[data-content="${mensagem}"]`);
        if (existingMessage) {
            logger.debug('Mensagem já existe, ignorando');
            return;
        }
        
        // Adiciona mensagem do usuário
        adicionarMensagem(chatContainer, mensagem, 'user');
        adicionarMensagemAoHistorico(mensagem, 'user');
        
        // Adiciona indicador de carregamento
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message loading';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Processando vídeo do YouTube...</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        
        // Processa o comando do YouTube
        try {
            await handleYoutubeCommand(mensagem, window.conversaAtual.id);
            logger.debug('Comando do YouTube processado com sucesso');
            
            // Remover o indicador de carregamento
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
        } catch (error) {
            logger.error('Erro ao processar comando do YouTube', error);
            // Remove o indicador de carregamento em caso de erro
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
            // Adiciona mensagem de erro
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Erro ao processar vídeo do YouTube: ${error.message}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
        
        return;
    }

    // Processar comando do YouTube Resumo
    if (mensagem.startsWith('/youtube_resumo')) {
        console.log("[INFO] Processando comando do YouTube Resumo");
        
        // Criar um elemento visual para indicar o processamento
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message loading';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="loading-indicator">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Processando resumo do vídeo do YouTube...</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        
        // Processa o comando do YouTube Resumo
        try {
            await handleYoutubeResumoCommand(mensagem, window.conversaAtual.id);
            logger.debug('Comando do YouTube Resumo processado com sucesso');
            
            // Remover o indicador de carregamento
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
        } catch (error) {
            logger.error('Erro ao processar comando do YouTube Resumo', error);
            // Remove o indicador de carregamento em caso de erro
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
            // Adiciona mensagem de erro
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Erro ao processar resumo do vídeo: ${error.message}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
        
        return;
    }

    // Continua com o processamento normal de mensagens...
    if (!window.conversaAtual) {
        console.warn("Criando nova conversa...");
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

// Função para interromper resposta atual
export function interromperResposta() {
    console.log('[DEBUG-JS] interromperResposta em chatActions.js chamada');
    
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        console.log('[DEBUG-JS] Nenhuma conversa ativa para interromper');
        return;
    }
    
    console.log(`[DEBUG-JS] Interrompendo resposta para conversa: ${conversationId}`);
    
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

// Sistema de debug
class ChatDebugger {
    constructor() {
        this.logs = [];
        this.maxLogSize = 100;
    }

    log(eventType, data) {
        this.logs.push({ timestamp: Date.now(), eventType, data });
        if (this.logs.length > this.maxLogSize) this.logs.shift();
        console.debug(`[ChatDebug] ${eventType}:`, data);
    }

    exportLogs() {
        const data = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }
}

const chatDebugger = new ChatDebugger();

export const handleSocketMessages = (socket) => {
    socket.on('message_chunk', ({ messageId, content }) => {
        chatDebugger.log('message_chunk', { messageId, contentLength: content.length });
        
        if (!streamingMessages.has(messageId)) {
            streamingMessages.add(messageId);
        }
        renderMessageChunk(messageId, content);
    });

    socket.on('response_complete', ({ messageId }) => {
        chatDebugger.log('response_complete', { messageId });
        
        streamingMessages.delete(messageId);
        completeMessage(messageId);
    });

    socket.on('stream_error', ({ messageId }) => {
        chatDebugger.log('stream_error', { messageId });
        
        streamingMessages.delete(messageId);
        const entry = messageRegistry.get(messageId);
        if (entry) {
            entry.container.innerHTML += '<div class="error">Erro no streaming</div>';
            messageRegistry.delete(messageId);
        }
    });

    // Log de eventos do socket
    socket.onAny((event, data) => {
        chatDebugger.log(`socket_${event}`, data);
    });
};

// Monitoramento periódico de streams ativos
setInterval(() => {
    chatDebugger.log('active_streams', {
        streamingMessages: Array.from(streamingMessages),
        messageRegistry: Array.from(messageRegistry.keys())
    });
}, 10000);
