import { socket } from '../main.js';
import { messageRegistry } from './messageRegistry.js';
import { renderMarkdown } from '../messageRenderer.js';
import { logger } from '../utils/logger.js';

/**
 * Gerenciador de streaming e cache para mensagens da IA
 */
class StreamingManager {
    constructor() {
        this.streamingCache = {};
        this.activeContainers = new Map();
        this.initializeSocketListeners();
        
        // Log de inicialização
        logger.info('StreamingManager inicializado');
    }

    /**
     * Inicializa os listeners do Socket.IO
     */
    initializeSocketListeners() {
        if (!socket) {
            logger.error('Socket.IO não está disponível para o StreamingManager');
            return;
        }

        // Remover listeners anteriores para evitar duplicação
        socket.off('message_chunk');
        socket.off('response_complete');
        socket.off('stream_error');

        // Adicionar novos listeners
        socket.on('message_chunk', this.handleMessageChunk.bind(this));
        socket.on('response_complete', this.handleResponseComplete.bind(this));
        socket.on('stream_error', this.handleStreamError.bind(this));
        
        logger.debug('Listeners de Socket.IO inicializados no StreamingManager');
    }

    /**
     * Manipula chunks de mensagem recebidos
     */
    handleMessageChunk({ content, conversation_id, message_id, chunk_number }) {
        if (!content || !conversation_id || !message_id) {
            logger.warn('Chunk recebido com dados incompletos', {
                hasContent: !!content,
                hasConversationId: !!conversation_id,
                hasMessageId: !!message_id
            });
            return;
        }
        
        logger.debug('Chunk recebido', {
            messageId: message_id,
            conversationId: conversation_id,
            chunkNumber: chunk_number,
            contentSize: content.length
        });
        
        // Verificar se a conversa atual corresponde
        if (window.conversaAtual?.id !== conversation_id) {
            logger.debug('Ignorando chunk de outra conversa', {
                atual: window.conversaAtual?.id,
                recebido: conversation_id
            });
            return;
        }
        
        // Verificar se a mensagem já existe no registry
        if (!messageRegistry.hasMessage(message_id)) {
            logger.debug(`Registrando nova mensagem: ${message_id}`);
            messageRegistry.registerMessage(message_id, {
                conversationId: conversation_id,
                content: '',
                chunkCount: 0
            });
        }
        
        // Adicionar o chunk ao conteúdo da mensagem
        messageRegistry.addChunk(message_id, content);
        
        // Incrementar contador de chunks
        const entry = messageRegistry.getMessage(message_id);
        if (entry) {
            entry.chunkCount = (entry.chunkCount || 0) + 1;
        }
        
        // Atualizar a interface
        this.updateMessageUI(message_id, conversation_id);
    }

    /**
     * Manipula a conclusão da resposta
     */
    handleResponseComplete({ conversation_id, message_id, complete_response, total_chunks }) {
        if (!message_id || !conversation_id) {
            logger.warn('Resposta completa com dados incompletos', {
                hasMessageId: !!message_id,
                hasConversationId: !!conversation_id
            });
            return;
        }
        
        logger.info('Resposta completa recebida', {
            messageId: message_id,
            conversationId: conversation_id,
            totalChunks: total_chunks
        });
        
        // Verificar se a conversa atual corresponde
        if (window.conversaAtual?.id !== conversation_id) {
            logger.debug('Ignorando resposta completa de outra conversa', {
                atual: window.conversaAtual?.id,
                recebido: conversation_id
            });
            return;
        }
        
        // Verificar se a mensagem existe no registry
        if (!messageRegistry.hasMessage(message_id)) {
            logger.warn(`Mensagem não encontrada no registry: ${message_id}`);
            
            // Se temos o complete_response, podemos criar agora
            if (complete_response) {
                messageRegistry.registerMessage(message_id, {
                    conversationId: conversation_id,
                    content: complete_response,
                    complete: true
                });
            } else {
                return;
            }
        }
        
        // Marcar como completa (e usar complete_response se disponível)
        const entry = messageRegistry.getMessage(message_id);
        if (entry) {
            if (complete_response && complete_response !== entry.content) {
                entry.content = complete_response;
            }
            
            // Finalizar a mensagem
            messageRegistry.completeMessage(message_id);
            
            // Atualizar a interface
            this.renderCompleteMessage(message_id, conversation_id);
        }
        
        // Limpar do streamingCache
        if (this.streamingCache[conversation_id]) {
            delete this.streamingCache[conversation_id][message_id];
            if (Object.keys(this.streamingCache[conversation_id]).length === 0) {
                delete this.streamingCache[conversation_id];
            }
        }
        
        // Remover do activeContainers
        this.activeContainers.delete(message_id);
    }

    /**
     * Manipula erros de streaming
     */
    handleStreamError({ conversation_id, message_id, error }) {
        logger.error('Erro no streaming', {
            messageId: message_id,
            conversationId: conversation_id,
            error
        });
        
        const entry = messageRegistry.getMessage(message_id);
        if (entry && entry.container) {
            entry.container.innerHTML = `<div class="error-message">Erro: ${error}</div>`;
            entry.container.classList.add('error');
            messageRegistry.updateMessage(message_id, { error: true, errorMessage: error });
        }
        
        // Limpar do streamingCache
        if (this.streamingCache[conversation_id]) {
            delete this.streamingCache[conversation_id][message_id];
            if (Object.keys(this.streamingCache[conversation_id]).length === 0) {
                delete this.streamingCache[conversation_id];
            }
        }
        
        // Remover do activeContainers
        this.activeContainers.delete(message_id);
    }

    /**
     * Atualiza a UI para uma mensagem
     */
    updateMessageUI(messageId, conversationId) {
        const entry = messageRegistry.getMessage(messageId);
        if (!entry) return;
        
        // Verificar se há um container válido
        let container = entry.container;
        
        if (!container || !container.isConnected) {
            container = this.createMessageContainer(messageId, conversationId);
            messageRegistry.updateMessage(messageId, { container });
        }
        
        // Renderizar conteúdo
        this.renderStreamingContent(messageId, conversationId);
    }

    /**
     * Cria um container para a mensagem
     */
    createMessageContainer(messageId, conversationId) {
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) {
            logger.error('Container de chat não encontrado');
            return null;
        }
        
        // Verificar se já existe um container para essa mensagem
        let container = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (container) {
            logger.debug(`Container existente encontrado para mensagem ${messageId}`);
            return container;
        }
        
        // Verificar também se já existe uma mensagem completa recente para esta conversa
        // para evitar duplicações visuais
        const existingMessages = document.querySelectorAll(`.message.assistant[data-conversation-id="${conversationId}"]`);
        
        if (existingMessages.length > 0) {
            const lastMessage = existingMessages[existingMessages.length - 1];
            const lastMessageId = lastMessage.dataset.messageId;
            
            // Se a última mensagem é recente (criada há menos de 2 segundos), pode ser uma duplicação
            const lastCreationTime = parseInt(lastMessageId.split('_').pop(), 10) || 0;
            const now = Date.now();
            
            if (now - lastCreationTime < 2000) {
                logger.warn('Possível duplicação de container detectada', {
                    messageId,
                    existingId: lastMessageId,
                    timeDiff: now - lastCreationTime
                });
                
                // Não impedimos a criação, apenas logamos para diagnóstico
            }
        }
        
        // Criar novo container
        container = document.createElement('div');
        container.className = 'message assistant streaming';
        container.dataset.messageId = messageId;
        container.dataset.conversationId = conversationId;
        container.dataset.createdAt = Date.now().toString();
        
        // Criar estrutura interna padrão
        container.innerHTML = `
            <div class="message-content"></div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `;
        
        chatContainer.appendChild(container);
        
        // Registrar no activeContainers
        this.activeContainers.set(messageId, container);
        
        logger.debug(`Novo container criado para mensagem ${messageId}`);
        
        return container;
    }

    /**
     * Renderiza o conteúdo de streaming
     */
    renderStreamingContent(messageId, conversationId) {
        const entry = messageRegistry.getMessage(messageId);
        if (!entry || !entry.container) return;
        
        const content = entry.content;
        const container = entry.container;
        
        try {
            // Renderizar Markdown e sanitizar
            const renderedContent = renderMarkdown(content + '<span class="streaming-cursor">█</span>');
            container.innerHTML = renderedContent;
            
            // Manter scroll na última posição visível
            this.manageScroll(container);
        } catch (error) {
            logger.error('Erro ao renderizar conteúdo de streaming', {
                messageId,
                error: error.message
            });
        }
    }

    /**
     * Renderiza uma mensagem completa
     */
    renderCompleteMessage(messageId, conversationId) {
        const entry = messageRegistry.getMessage(messageId);
        if (!entry || !entry.container) {
            logger.error('Container não encontrado para renderização completa', { 
                messageId, 
                conversationId,
                hasEntry: !!entry
            });
            return;
        }
        
        // Verificar se já existe uma mensagem completa para esta conversa
        const existingCompleteMessages = document.querySelectorAll(`.message.assistant.complete[data-conversation-id="${conversationId}"]`);
        const lastCompleteMessage = existingCompleteMessages.length > 0 ? 
            existingCompleteMessages[existingCompleteMessages.length - 1] : null;
        
        // Se existir uma mensagem completa recente e o conteúdo for muito similar, podemos estar duplicando
        if (lastCompleteMessage && lastCompleteMessage !== entry.container) {
            const lastContent = lastCompleteMessage.querySelector('.message-content')?.textContent || '';
            const currentContent = entry.content || '';
            
            // Comparar os primeiros 50 caracteres para determinar similaridade
            const isSimilar = lastContent.substring(0, 50).trim() === currentContent.substring(0, 50).trim();
            
            if (isSimilar) {
                logger.warn('Possível duplicação de mensagem detectada', {
                    messageId,
                    existingId: lastCompleteMessage.dataset.messageId,
                    similarity: 'primeiros 50 caracteres iguais'
                });
                
                // Apenas logamos e continuamos, porque pode ser uma resposta legitimamente similar
            }
        }
        
        const content = entry.content;
        const container = entry.container;
        
        logger.debug('Renderizando mensagem completa', {
            messageId,
            conversationId,
            containerClass: container.className,
            contentLength: content?.length
        });
        
        try {
            // Remover classes de streaming
            container.classList.remove('streaming');
            container.classList.add('complete');
            
            // Preservar os botões de ação
            const actionsElement = container.querySelector('.message-actions');
            
            // Obter o elemento de conteúdo
            const contentElement = container.querySelector('.message-content');
            
            // Renderizar Markdown e sanitizar
            const renderedContent = renderMarkdown(content);
            
            if (contentElement) {
                // Atualizar apenas o conteúdo sem substituir a estrutura
                contentElement.innerHTML = renderedContent;
                logger.debug('Conteúdo atualizado mantendo estrutura existente', { messageId });
            } else {
                // Se não existir, criar a estrutura completa
                logger.warn('Elemento message-content não encontrado ao completar mensagem', { messageId });
                
                // Preservar a estrutura original com o conteúdo atualizado
                container.innerHTML = `<div class="message-content">${renderedContent}</div>`;
                
                // Re-adicionar os botões de ação se já existiam
                if (actionsElement) {
                    container.appendChild(actionsElement);
                    logger.debug('Botões de ação readicionados', { messageId });
                } else {
                    // Adicionar botões de ação se necessário
                    this.addActionButtons(container, messageId);
                    logger.debug('Novos botões de ação adicionados', { messageId });
                }
            }
            
            logger.info(`Mensagem ${messageId} renderizada como completa`);
        } catch (error) {
            logger.error('Erro ao renderizar conteúdo completo', {
                messageId,
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * Adiciona botões de ação à mensagem
     */
    addActionButtons(container, messageId) {
        // Verificar se já tem botões
        if (container.querySelector('.message-actions')) return;
        
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
        `;
        
        container.appendChild(actions);
    }

    /**
     * Gerencia o scroll durante o streaming
     */
    manageScroll(container) {
        // Calcular se o usuário está próximo do final
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;
        
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        
        // Se estiver próximo do final, scroll automático
        if (distanceToBottom < 200) {
            container.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    /**
     * Restaura o estado do streaming ao mudar de chat
     */
    restoreStreamingState(conversationId) {
        if (!conversationId) return;
        
        logger.debug(`Restaurando estado de streaming para conversa ${conversationId}`);
        
        // Encontrar mensagens desta conversa no registry
        const messages = messageRegistry.getMessagesByConversation(conversationId);
        
        messages.forEach(entry => {
            if (!entry.complete && entry.content) {
                // Recriar container se necessário
                if (!entry.container || !entry.container.isConnected) {
                    entry.container = this.createMessageContainer(entry.id, conversationId);
                }
                
                // Renderizar conteúdo
                this.renderStreamingContent(entry.id, conversationId);
            }
        });
    }
}

// Exportar instância única
export const streamingManager = new StreamingManager(); 