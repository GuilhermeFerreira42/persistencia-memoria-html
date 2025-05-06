import { mostrarCarregamento, adicionarMensagemStreaming, atualizarMensagemStreaming } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';
import { renderMessage, renderMessageChunk, completeMessage } from '../messageRenderer.js';
import { messageRegistry } from '../modules/messageRegistry.js';
import { melhorarBlocosCodigo } from './chatUtils.js';
import { handleYoutubeCommand } from '../youtube-system/youtubeHandler.js';
import { handleYoutubeResumoCommand } from '../youtube-system/youtubeResumoHandler.js';
import { logger } from '../utils/logger.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.js';

// Verificar se o messageRegistry global está disponível
if (!window.messageRegistry) {
    logger.info('Definindo messageRegistry global a partir do módulo importado');
    window.messageRegistry = messageRegistry.messages || new Map();
} else {
    logger.debug('messageRegistry global já estava disponível');
}

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

/**
 * Variáveis globais para controle do fluxo de troca de conversas
 * Estas variáveis garantem que não percamos chunks durante a transição entre conversas
 */
// Armazena o ID da conversa atual para controle de fluxo
let currentConversationId = null;
// Armazena o ID da mensagem em streaming para controle de saída da sala
let currentStreamingMessageId = null;

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
            messageId: message_id,
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

        // Ocultar a animação de carregamento ao receber o primeiro chunk
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation && loadingAnimation.style.display === 'block') {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após receber o primeiro chunk');
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

        // Usar o sistema unificado de renderização com messageRegistry
        renderMessageChunk(messageId, content, conversation_id);
    });

    // Listener para resposta completa
    socket.on('response_complete', (data) => {
        logger.debug('Evento response_complete recebido', {
            messageId: data.message_id,
            conversaAtual: window.conversaAtual?.id,
            conversationId: data.conversation_id,
            finalMessageId: streamingMessageIds.get(data.conversation_id) 
        });

        const { conversation_id, total_chunks, message_id, complete_response } = data;
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
            return;
        }

        // ID da mensagem de streaming que foi gerado no enviarMensagem
        const streamingId = streamingMessageIds.get(conversation_id);
        
        // ID da mensagem recebido do servidor
        const serverId = message_id;
        
        // Usar o ID consistente durante todo o ciclo
        const finalMessageId = streamingId || serverId;
        
        logger.info('IDs de mensagem envolvidos na conclusão:', {
            streamingId: streamingId,
            serverId: serverId,
            finalMessageId: finalMessageId
        });
        
        // Verificar se existem elementos com esses IDs
        const streamingElement = document.querySelector(`[data-message-id="${streamingId}"]`);
        const serverElement = document.querySelector(`[data-message-id="${serverId}"]`);
        
        logger.debug('Elementos existentes:', {
            streamingElement: streamingElement ? true : false,
            serverElement: serverElement ? true : false
        });

        // Remove estado de streaming
        const wasStreaming = streamingStates.delete(conversation_id);
        streamingMessageIds.delete(conversation_id);
        processedChunks.delete(conversation_id);
        lastReceivedChunks.delete(conversation_id);
        
        logger.debug('Estado de streaming removido', {
            conversationId: conversation_id,
            messageId: finalMessageId,
            wasStreaming: wasStreaming
        });
        
        // Verificar se já existe uma mensagem completa para evitar duplicação
        const existingCompleteMessage = document.querySelector(`.message.assistant:not(.streaming)[data-conversation-id="${conversation_id}"]:last-child`);
        
        if (existingCompleteMessage && existingCompleteMessage.dataset.messageId !== finalMessageId) {
            logger.warn('Mensagem completa já existe, evitando duplicação', {
                existingId: existingCompleteMessage.dataset.messageId,
                finalMessageId: finalMessageId
            });
            
            // Se temos um elemento de streaming, vamos removê-lo para evitar duplicação
            if (streamingElement) {
                logger.info('Removendo elemento de streaming redundante', {
                    streamingId: streamingId
                });
                streamingElement.remove();
            }
            
            return;
        }
        
        // Finalizar a mensagem usando o messageRegistry
        if (finalMessageId) {
            // Obter o conteúdo completo acumulado para esta conversa
            const completeContent = complete_response || streamingChunks.get(conversation_id) || '';
            
            logger.debug('Completando mensagem com conteúdo final', {
                messageId: finalMessageId,
                contentLength: completeContent.length,
                hasCompleteResponse: !!complete_response
            });
            
            // Finalizar a mensagem transformando o container de streaming em um container completo
            try {
                // Finalizar a mensagem passando os parâmetros corretos
                completeMessage(finalMessageId, conversation_id, completeContent);
                
                // Limpar o conteúdo acumulado
                streamingChunks.delete(conversation_id);
            } catch (error) {
                logger.error('Erro ao completar mensagem', {
                    error: error.message,
                    stack: error.stack,
                    messageId: finalMessageId
                });
            }
        }
    });
} else {
    socket = window.socket;
}

/**
 * Entra na sala de uma conversa específica
 * Esta função implementa um comportamento crucial:
 * 1. Entra imediatamente na nova sala
 * 2. Só sai da sala anterior APÓS o evento response_complete, se houver streaming ativo
 * 3. Sai imediatamente da sala anterior se não houver streaming
 * 
 * Este comportamento impede a perda de chunks durante a troca de conversas
 * 
 * @param {string} conversationId - ID da conversa
 * @return {Promise} Promessa resolvida após entrar na sala
 */
export function entrarNaSala(conversationId) {
    // Armazenar conversa anterior para controle de fluxo
    const previousConversationId = currentConversationId;
    currentConversationId = conversationId;
    
    return new Promise((resolve, reject) => {
        if (!socket) {
            logger.error('Socket não disponível para entrar na sala');
            reject(new Error('Socket não disponível'));
            return;
        }

        // PASSO 1: Entrar na nova sala imediatamente
        socket.emit('join_conversation', { conversation_id: conversationId });
        logger.info(`Entrou na sala da nova conversa: ${conversationId}`);
        
        // PASSO 2: Processar saída da sala anterior dependendo se há streaming
        if (previousConversationId && currentStreamingMessageId) {
            // Se há streaming ativo, adiar a saída até resposta estar completa
            socket.once('response_complete', (data) => {
                if (data.conversation_id === previousConversationId && 
                    data.message_id === currentStreamingMessageId) {
                    socket.emit('leave_conversation', { conversation_id: previousConversationId });
                    logger.info(`Saiu da sala anterior: ${previousConversationId} após response_complete`);
                    currentStreamingMessageId = null; // Resetar o ID da mensagem
                }
            });
        } else if (previousConversationId) {
            // Se não houver mensagem em andamento, sair imediatamente
            socket.emit('leave_conversation', { conversation_id: previousConversationId });
            logger.info(`Saiu da sala anterior: ${previousConversationId} imediatamente`);
        }
        
        resolve();
    });
}

/**
 * Sai da sala de uma conversa específica
 * Implementa comportamento complementar à função entrarNaSala:
 * - Se houver streaming ativo, adia a saída para evitar perda de dados
 * - Se não houver streaming, sai imediatamente
 * 
 * @param {string} conversationId - ID da conversa
 * @return {Promise} Promessa resolvida após sair da sala
 */
export function sairDaSala(conversationId) {
    // Se for a conversa atual com streaming, não sair ainda
    if (conversationId === currentConversationId && currentStreamingMessageId) {
        logger.info(`Adiando saída da sala: ${conversationId} devido a streaming ativo`);
        return Promise.resolve(); // Não sai agora, será tratado no response_complete
    }

    return new Promise((resolve, reject) => {
        if (!socket) {
            logger.error('Socket não disponível para sair da sala');
            reject(new Error('Socket não disponível'));
            return;
        }

        socket.emit('leave_conversation', { conversation_id: conversationId });
        logger.info(`Saiu da sala: ${conversationId}`);
        
        // Limpar currentConversationId se estiver saindo da conversa atual
        if (conversationId === currentConversationId) {
            currentConversationId = null;
        }
        
        resolve();
    });
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
    logger.info('Iniciando envio de mensagem', { 
        mensagemTamanho: mensagem?.length || 0,
        conversaAtual: window.conversaAtual?.id
    });
    
    if (!mensagem || !chatContainer) {
        logger.warn('Parâmetros inválidos para envio de mensagem', { 
            mensagemValida: !!mensagem, 
            chatContainerValido: !!chatContainer 
        });
        return;
    }

    if (!window.conversaAtual) {
        logger.info('Nenhuma conversa ativa, criando nova');
        criarNovaConversa();
    }

    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        logger.error('ID da conversa não definido após tentativa de criação');
        return;
    }

    // Gerar um messageId único
    // Usando função local para evitar dependência direta do messageRegistry
    const messageId = gerarMessageId();
    
    logger.trackMessage('enviando', messageId, conversationId, {
        mensagemTamanho: mensagem?.length || 0,
        timestamp: new Date().toISOString()
    });

    // Verificar se é um comando para resumir YouTube
    if (mensagem.toLowerCase().startsWith('/youtube_resumo')) {
        logger.trackMessage('comando_youtube_resumo', messageId, conversationId, { mensagem });
        try {
            await handleYoutubeResumoCommand(mensagem, conversationId, chatContainer);
            logger.trackMessage('comando_youtube_resumo_success', messageId, conversationId);
        } catch (error) {
            logger.trackMessage('comando_youtube_resumo_error', messageId, conversationId, { 
                error: error.message,
                stack: error.stack
            });
        }
        return;
    }
    
    // Verificar se é um comando de YouTube
    if (mensagem.toLowerCase().startsWith('/youtube')) {
        logger.trackMessage('comando_youtube', messageId, conversationId, { mensagem });
        try {
            await handleYoutubeCommand(mensagem, conversationId, chatContainer);
            logger.trackMessage('comando_youtube_success', messageId, conversationId);
        } catch (error) {
            logger.trackMessage('comando_youtube_error', messageId, conversationId, { 
                error: error.message,
                stack: error.stack
            });
        }
        return;
    }

    // Verificar duplicação de mensagem
    if (isDuplicateMessage(conversationId, mensagem)) {
        logger.trackMessage('duplicada', messageId, conversationId, {
            mensagemPreview: mensagem.substring(0, 30)
        });
        return;
    }

    try {
        logger.debug('Desabilitando interface durante envio', {
            sendBtnState: sendBtn ? 'disabled' : 'not-found',
            stopBtnState: stopBtn ? 'visible' : 'not-found'
        });
        
        // Desabilitar a interface durante o envio
        if (sendBtn) sendBtn.disabled = true;
        if (stopBtn) stopBtn.style.display = 'flex';

        // Limpar o input
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }

        // Adicionar mensagem do usuário ao chat
        const userTimestamp = new Date().toISOString();
        const userMessageId = `user_${conversationId}_${Date.now()}`;
        logger.debug('Adicionando mensagem do usuário ao DOM', { userMessageId });
        
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
        chatContainer.appendChild(userMessageDiv);
        
        // Mostrar animação de carregamento centralizada
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'block';
            logger.debug('Animação de carregamento exibida');
        }
        
        // Remover placeholders existentes para evitar duplicação
        logger.debug('Removendo placeholders de mensagens existentes');
        const existingPlaceholders = chatContainer.querySelectorAll('.message.assistant:not([data-message-id])');
        existingPlaceholders.forEach(placeholder => placeholder.remove());
        
        // Gerar ID único para a mensagem e registrar como mensagem em streaming atual
        // Isso permite que o sistema saiba qual mensagem está sendo processada
        const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        currentStreamingMessageId = messageId;
        
        // Verificar se já existe alguma mensagem com este ID
        const existingElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (existingElement) {
            logger.warn('Detectado elemento existente com mesmo ID (improvável)', {
                messageId,
                element: existingElement.outerHTML.substring(0, 100)
            });
        }
        
        // Adicionar mensagem de loading para o assistente
        adicionarMensagemStreaming(chatContainer, messageId, conversationId);
        
        // Ativar estado de streaming para esta conversa
        streamingStates.set(conversationId, true);
        
        // Entrar na sala Socket.IO para esta conversa
        entrarNaSala(conversationId);
        
        // Rolar para o final
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
        
        // Salvar a mensagem do usuário no histórico local
        adicionarMensagemAoHistorico(mensagem, 'user', conversationId);
        
        // Marcar mensagem como enviada para evitar duplicação
        sentMessages.set(`${conversationId}-${mensagem}`, Date.now());
        
        logger.info('Enviando mensagem para o backend', { 
            conversationId,
            endpoint: '/send_message'
        });
        
        // Enviar a mensagem para o servidor
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
        
        logger.info('Mensagem enviada com sucesso, aguardando resposta streaming', { conversationId });
        
        // Indicar que este stream está ativo
        activeStreams.add(conversationId);
        
        // A resposta é processada assincronamente pelos listeners de Socket.IO
        
    } catch (error) {
        logger.error('Falha ao enviar mensagem', { 
            error: error.message,
            stack: error.stack,
            conversationId
        });
        
        // Ocultar a animação de carregamento em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após erro');
        }
        
        // Remover estado de streaming em caso de erro
        streamingStates.delete(conversationId);
        
        // Mostrar mensagem de erro no chat
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error';
        errorDiv.innerHTML = '<div class="message-content">Erro ao processar a mensagem. Por favor, tente novamente.</div>';
        chatContainer.appendChild(errorDiv);
        
    } finally {
        logger.debug('Restaurando estado da interface após envio');
        // Restaurar a interface após o envio (bem-sucedido ou não)
        if (sendBtn) sendBtn.disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

// Função local para gerar messageId
function gerarMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
                            // Ao receber uma nova mensagem do assistente, esconder a animação centralizada
                            const loadingAnimation = document.getElementById('loading-animation');
                            if (loadingAnimation && loadingAnimation.style.display === 'block') {
                                loadingAnimation.style.display = 'none';
                                logger.debug('Animação de carregamento ocultada após receber nova mensagem');
                            }
                            
                            // Remover estado de streaming
                            streamingStates.delete(conversation_id);
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
                    const remainingPlaceholders = chatContainer.querySelectorAll('.message.assistant:not([data-message-id])');
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
                    
                    // Esconder animação centralizada se a conversa não estiver mais em streaming
                    if (!streamingStates.has(conversation_id)) {
                        const loadingAnimation = document.getElementById('loading-animation');
                        if (loadingAnimation && loadingAnimation.style.display === 'block') {
                            loadingAnimation.style.display = 'none';
                            logger.debug('Animação de carregamento ocultada após atualização da conversa');
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
    logger.info('Iniciando interrupção de resposta');
    const conversationId = window.conversaAtual?.id;
    
    if (!conversationId) {
        logger.warn('Tentativa de interromper resposta sem conversa ativa');
        return;
    }
    
    if (!streamingStates.has(conversationId)) {
        logger.warn('Nenhum streaming ativo para interromper', { conversationId });
        return;
    }
    
    // Ocultar a animação de carregamento
    const loadingAnimation = document.getElementById('loading-animation');
    if (loadingAnimation) {
        loadingAnimation.style.display = 'none';
        logger.debug('Animação de carregamento ocultada após interrupção');
    }
    
    logger.debug('Removendo estado de streaming', { conversationId });
    streamingStates.delete(conversationId);
    
    // Limpar estado acumulado
    clearAccumulatedResponse(conversationId);
    
    // Remover da lista de streams ativos
    activeStreams.delete(conversationId);
    
    logger.debug('Removendo mensagens de streaming do DOM');
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // Remover apenas mensagens de loading antigas (se houver)
        chatContainer.querySelectorAll('.message.assistant.loading')
            .forEach(msg => {
                logger.debug('Removendo mensagem loading', { 
                    id: msg.dataset.messageId, 
                    conversationId: msg.dataset.conversationId 
                });
                msg.remove();
            });
    }
    
    logger.info('Resposta interrompida com sucesso', { conversationId });
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
                // Mostrar a animação de carregamento centralizada em vez do placeholder antigo
                const loadingAnimation = document.getElementById('loading-animation');
                if (loadingAnimation) {
                    loadingAnimation.style.display = 'block';
                    logger.debug('Animação de carregamento exibida ao carregar conversa em streaming');
                }
                
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

    info(eventType, data) {
        this.log(`INFO:${eventType}`, data);
        console.info(`[ChatDebug-INFO] ${eventType}:`, data);
    }
    
    debug(eventType, data) {
        this.log(`DEBUG:${eventType}`, data);
        console.debug(`[ChatDebug-DEBUG] ${eventType}:`, data);
    }
    
    warn(eventType, data) {
        this.log(`WARN:${eventType}`, data);
        console.warn(`[ChatDebug-WARN] ${eventType}:`, data);
    }
    
    error(eventType, data) {
        this.log(`ERROR:${eventType}`, data);
        console.error(`[ChatDebug-ERROR] ${eventType}:`, data);
    }

    exportLogs() {
        const data = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        return URL.createObjectURL(blob);
    }
}

const chatDebugger = new ChatDebugger();

/**
 * Processa um chunk de mensagem recebido via streaming
 * @param {Object} data - Dados recebidos do servidor
 */
export const handleStreamChunk = (data) => {
    try {
        if (!data || !data.chunk || !data.message_id || !data.conversation_id) {
            chatDebugger.warn('Chunk inválido recebido', { data });
            return;
        }

        const { message_id, chunk, conversation_id } = data;

        // Verificar se este é um chunk duplicado
        if (processedChunks.has(`${message_id}-${chunk}`)) {
            chatDebugger.warn('Chunk duplicado detectado e ignorado', { 
                message_id, 
                chunk_length: chunk.length 
            });
            return;
        }

        // Registrar este chunk como processado
        processedChunks.add(`${message_id}-${chunk}`);
        
        // Verificar se a mensagem já está em streaming (já está sendo renderizada)
        const isStreaming = streamingMessageIds.has(message_id);
        
        // Se não estiver em streaming, iniciar a renderização desta mensagem
        if (!isStreaming) {
            streamingMessageIds.add(message_id);
            chatDebugger.info('Iniciando streaming de nova mensagem', { message_id, conversation_id });
            
            // Limpar containers órfãos existentes com o mesmo ID
            const existingContainers = document.querySelectorAll(`[data-message-id="${message_id}"]`);
            if (existingContainers.length > 0) {
                chatDebugger.warn('Containers existentes detectados para novo stream', { 
                    message_id, 
                    count: existingContainers.length 
                });
                
                // Remover containers antigos
                existingContainers.forEach(container => container.remove());
                
                // Limpar qualquer entrada existente no registry
                if (messageRegistry.has(message_id)) {
                    messageRegistry.delete(message_id);
                }
            }
        }

        // Acumular o conteúdo em memória
        accumulateChunk(chunk, conversation_id);
        
        // Renderizar o chunk
        renderMessageChunk(message_id, chunk, conversation_id);
        
        chatDebugger.debug('Chunk processado com sucesso', { 
            message_id,
            chunk_length: chunk.length, 
            streaming_count: streamingMessageIds.size 
        });
        
    } catch (error) {
        chatDebugger.error('Erro ao processar chunk de mensagem', { 
            error: error.message, 
            stack: error.stack 
        });
    }
};

// Processar evento de mensagem completa
socket.on('response_complete', (data) => {
    try {
        const { message_id, conversation_id } = data;
        
        chatDebugger.info('Resposta completa recebida', { message_id, conversation_id });
        
        // Finalizar a mensagem no renderer
        completeMessage(message_id);
        
        // Remover da lista de mensagens em streaming
        streamingMessageIds.delete(message_id);
        
        // Processar resposta completa para o estado da conversa
        renderCompleteResponse(conversation_id);
        
        // Limpar chunks processados para esta mensagem 
        // (otimização de memória para conversas longas)
        for (const key of processedChunks.keys()) {
            if (key.startsWith(`${message_id}-`)) {
                processedChunks.delete(key);
            }
        }
        
        chatDebugger.debug('Processamento de resposta completa finalizado', { 
            message_id, 
            streaming_count: streamingMessageIds.size 
        });
        
    } catch (error) {
        chatDebugger.error('Erro ao processar resposta completa', { 
            error: error.message, 
            stack: error.stack 
        });
    }
});

// Monitoramento periódico de streams ativos
setInterval(() => {
    try {
        chatDebugger.log('active_streams', {
            streamingMessages: Array.from(streamingMessages),
            messageRegistry: Array.from(messageRegistry.messages.keys())
        });
        
        // Verificar mensagens órfãs
        document.querySelectorAll('.message-content:empty').forEach(container => {
            const messageElement = container.closest('.message');
            if (messageElement) {
                const messageId = messageElement.dataset.messageId;
                if (messageId) {
                    cleanupOrphan(messageId);
                }
            }
        });
        
        chatDebugger.debug('Monitoramento de streams concluído', {
            activeStreams: streamingMessages.size,
            registrySize: messageRegistry.messages.size
        });
    } catch (error) {
        chatDebugger.error('Erro no monitoramento de streams', { 
            error: error.message,
            stack: error.stack
        });
    }
}, 10000);
