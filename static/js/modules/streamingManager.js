import { socket } from '../main.js';
import { messageRegistry } from './messageRegistry.js';
import { renderMarkdown } from '../messageRenderer.js';
import { logger } from '../utils/logger.js';
/**
 * Importação do módulo marked via CDN
 * Esta importação corrige o erro: "Failed to resolve module specifier 'marked'"
 * Usa a mesma fonte CDN que já é utilizada em outros arquivos do projeto
 */
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';

/**
 * Gerenciador de streaming e cache para mensagens da IA
 */
class StreamingManager {
    constructor() {
        this.streamingCache = {};
        this.activeContainers = new Map();
        this.initializeSocketListeners();
        
        // Configurar o cleanupOrphan para executar periodicamente (a cada 5 segundos)
        // Isto evita acúmulo de containers vazios ou órfãos na interface
        setInterval(() => this.cleanupOrphan(), 5000);
        
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
        
        // Ocultar a animação de carregamento ao receber o primeiro chunk
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation && loadingAnimation.style.display === 'block') {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após receber chunk');
        }
        
        // Criar ou obter o container da mensagem
        let container;
        let entry = messageRegistry.messages.get(message_id);
        
        logger.debug('Processando chunk', {
            messageId: message_id,
            conversationId: conversation_id,
            chunkNumber: chunk_number,
            contentSize: content?.length,
            processedChunks: messageRegistry.messages.get(message_id)?.processedChunks || [],
            timestamp: Date.now()
        });

        if (!entry) {
            // Criar novo container e registrar a mensagem
            container = this.createMessageContainer(message_id, conversation_id);
            entry = this.registerMessage(message_id, container, false);
            entry.isStreaming = true;
            entry.content = content;
            
            // Renderizar o conteúdo inicial imediatamente
            const contentDiv = container.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = marked.parse(content);
                this.manageScroll(container);
            }
        } else {
            container = entry.container;
            if (!container || !container.isConnected) {
                container = this.createMessageContainer(message_id, conversation_id);
                entry.container = container;
            }
            
            // Verificar se este chunk já foi processado
            if (!entry.processedChunks) {
                entry.processedChunks = [];
            }
            
            if (entry.processedChunks.includes(chunk_number)) {
                logger.warn('Chunk duplicado detectado e ignorado', {
                    messageId: message_id,
                    chunkNumber: chunk_number,
                    processedChunks: entry.processedChunks
                });
                return;
            }

            // Verificar ordem dos chunks
            if (entry.processedChunks.length > 0) {
                const lastChunk = Math.max(...entry.processedChunks);
                if (chunk_number < lastChunk) {
                    logger.warn('Chunk fora de ordem detectado', {
                        messageId: message_id,
                        chunkNumber: chunk_number,
                        lastProcessedChunk: lastChunk,
                        processedChunks: entry.processedChunks
                    });
                }
            }

            // Registrar o chunk como processado
            entry.processedChunks.push(chunk_number);
            entry.lastChunkTime = Date.now();

            // Adicionar o chunk ao conteúdo existente
            entry.content += content;
            entry.isStreaming = true;
            
            // Remover qualquer loading-dots remanescente
            const contentDiv = container.querySelector('.message-content');
            const loadingDots = contentDiv.querySelector('.loading-dots');
            if (loadingDots) loadingDots.remove();
            
            // Renderizar o conteúdo atualizado
            contentDiv.innerHTML = marked.parse(entry.content);
            this.manageScroll(container);
        }

        // Registrar timestamp do último chunk
        if (entry) {
            entry.lastChunkTime = Date.now();
            logger.debug('Estado após processamento do chunk', {
                messageId: message_id,
                processedChunks: entry.processedChunks,
                contentLength: entry.content?.length,
                timeSinceLastChunk: entry.lastChunkTime - (entry.firstChunkTime || entry.lastChunkTime)
            });
        }
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
        
        // Ocultar a animação de carregamento ao completar a resposta
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation && loadingAnimation.style.display === 'block') {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após completar resposta');
        }
        
        // Verificar se a mensagem existe no registry
        if (!messageRegistry.messages.has(message_id)) {
            logger.warn(`Mensagem não encontrada no registry: ${message_id}`);
            
            // Se temos o complete_response, podemos criar agora
            if (complete_response) {
                const container = this.createMessageContainer(message_id, conversation_id);
                const entry = this.registerMessage(message_id, container, false);
                entry.content = complete_response;
                entry.isComplete = true;
                entry.isStreaming = false;
                
                this.renderCompleteMessage(message_id, conversation_id);
            } else {
                return;
            }
        } else {
            // Marcar como completa
            const entry = messageRegistry.messages.get(message_id);
            if (entry) {
                if (complete_response && complete_response !== entry.content) {
                    entry.content = complete_response;
                }
                
                // Atualizar flags para indicar que a mensagem está completa e o streaming terminou
                // Isto é essencial para evitar que o cleanupOrphan remova esta mensagem
                entry.isComplete = true;
                entry.isStreaming = false;
                
                // Atualizar a interface
                this.renderCompleteMessage(message_id, conversation_id);
                
                // Remover loading dots se existirem
                const contentDiv = entry.container.querySelector('.message-content');
                const loadingDots = contentDiv.querySelector('.loading-dots');
                if (loadingDots) loadingDots.remove();
            }
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

        logger.info('Finalizando processamento de mensagem', {
            messageId: message_id,
            conversationId: conversation_id,
            totalChunksProcessed: messageRegistry.messages.get(message_id)?.processedChunks?.length || 0,
            expectedTotalChunks: total_chunks,
            timingInfo: this.getMessageTimingInfo(message_id),
            contentMatch: this.validateContentMatch(message_id, complete_response)
        });

        const entry = messageRegistry.messages.get(message_id);
        if (entry) {
            // Verificar se todos os chunks foram recebidos
            const processedCount = entry.processedChunks?.length || 0;
            if (processedCount !== total_chunks) {
                logger.warn('Discrepância no número de chunks', {
                    messageId: message_id,
                    processedChunks: processedCount,
                    expectedChunks: total_chunks,
                    missingChunks: this.findMissingChunks(entry.processedChunks, total_chunks)
                });
            }

            // Verificar por possíveis duplicações
            const duplicateCheck = this.checkForDuplicates(conversation_id, complete_response);
            if (duplicateCheck.hasDuplicates) {
                logger.warn('Possível duplicação de conteúdo detectada', {
                    messageId: message_id,
                    similarMessageIds: duplicateCheck.similarMessageIds,
                    similarityScore: duplicateCheck.similarityScore
                });
            }
        }
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
        
        // Ocultar a animação de carregamento em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation && loadingAnimation.style.display === 'block') {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após erro no streaming');
        }
        
        const entry = messageRegistry.messages.get(message_id);
        if (entry && entry.container) {
            entry.container.innerHTML = `<div class="error-message">Erro: ${error}</div>`;
            entry.container.classList.add('error');
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
        const entry = messageRegistry.messages.get(messageId);
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
        
        // Criar e adicionar ao DOM
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.dataset.messageId = messageId;
        messageDiv.dataset.conversationId = conversationId;
        
        // Criar container de conteúdo vazio que será preenchido com o conteúdo real
        // Não usamos mais os "três pontinhos" ou qualquer placeholder
        messageDiv.innerHTML = `<div class="message-content"></div>`;
        
        // Adicionar antes do final do chat
        chatContainer.appendChild(messageDiv);
        
        // Verificar se a animação centralizada está visível
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation && loadingAnimation.style.display !== 'block') {
            // Se não estiver visível e estamos criando uma mensagem, mostrar
            loadingAnimation.style.display = 'block';
            logger.debug('Animação de carregamento exibida ao criar container de mensagem');
        }
        
        // Registrar no messageRegistry como uma mensagem real (não cursor)
        this.registerMessage(messageId, messageDiv, false);
        
        return messageDiv;
    }

    /**
     * Renderiza o conteúdo de streaming
     */
    renderStreamingContent(messageId, conversationId) {
        const entry = messageRegistry.messages.get(messageId);
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
        const entry = messageRegistry.messages.get(messageId);
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
        // Verificar se já existem botões
        if (container.querySelector('.message-actions')) {
            return;
        }
        
        // Adicionar botões
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
     * Registra uma nova mensagem no messageRegistry com flags adicionais
     * As flags isCursor e isComplete são essenciais para o gerenciamento do ciclo de vida das mensagens
     * 
     * @param {string} messageId - ID da mensagem
     * @param {HTMLElement} container - Elemento DOM do container da mensagem
     * @param {boolean} isCursor - Se é apenas um cursor de digitação
     * @returns {Object} Entrada criada no registry
     */
    registerMessage(messageId, container, isCursor = false) {
        if (!messageRegistry) {
            logger.error('MessageRegistry não está disponível');
            return null;
        }
        
        // Criar objeto com as flags necessárias para controle dos containers
        const entry = {
            content: '',
            rendered: false,
            container: container,
            timer: null,
            isCursor: isCursor,        // true se for apenas um cursor de digitação
            isComplete: false,         // true após response_complete (mensagem finalizada)
            isStreaming: !isCursor     // false se for apenas cursor, true se estiver recebendo chunks
        };
        
        messageRegistry.messages.set(messageId, entry);
        logger.info(`Registrada entrada para messageId: ${messageId}, isCursor: ${isCursor}`);
        
        return entry;
    }
    
    /**
     * Limpa containers órfãos ou incompletos
     * Esta função é crítica para evitar containers vazios ou desnecessários na interface
     * A lógica implementada garante que:
     * 1. Containers com isCursor=true e isStreaming=false sejam removidos
     * 2. Containers com isStreaming=false e isComplete=false sejam removidos
     * 3. Containers com isComplete=true sejam SEMPRE preservados
     */
    cleanupOrphan() {
        if (!messageRegistry) {
            logger.warn('MessageRegistry não disponível para limpeza');
            return;
        }
        
        // Usar .messages.entries() para iterar sobre o Map em vez de .entries()
        for (const [messageId, entry] of messageRegistry.messages.entries()) {
            if (entry.isCursor && !entry.isStreaming) {
                // Remover containers de cursor sem streaming ativo
                // Isto evita cursores "fantasmas" que não estão mais em uso
                if (entry.container && entry.container.isConnected) {
                    entry.container.remove();
                }
                messageRegistry.messages.delete(messageId);
                logger.debug(`Removido container de cursor órfão: ${messageId}`);
            } else if (!entry.isStreaming && !entry.isComplete) {
                // Remover mensagens incompletas sem streaming
                // Isto evita mensagens "abandonadas" que nunca foram finalizadas
                if (entry.container && entry.container.isConnected) {
                    entry.container.remove();
                }
                messageRegistry.messages.delete(messageId);
                logger.debug(`Removido container de mensagem incompleta: ${messageId}`);
            }
            // Não remover NUNCA containers com isComplete=true
            // Isto garante que mensagens finalizadas permaneçam visíveis
        }
    }

    /**
     * Encontra chunks faltantes na sequência
     * @private
     */
    findMissingChunks(processedChunks = [], totalExpected) {
        const missing = [];
        if (!processedChunks.length) return Array.from({length: totalExpected}, (_, i) => i);
        
        for (let i = 0; i < totalExpected; i++) {
            if (!processedChunks.includes(i)) {
                missing.push(i);
            }
        }
        return missing;
    }

    /**
     * Obtém informações de timing da mensagem
     * @private
     */
    getMessageTimingInfo(messageId) {
        const entry = messageRegistry.messages.get(messageId);
        if (!entry) return null;

        return {
            firstChunkTime: entry.firstChunkTime,
            lastChunkTime: entry.lastChunkTime,
            totalProcessingTime: entry.lastChunkTime - entry.firstChunkTime,
            averageTimeBetweenChunks: this.calculateAverageChunkTiming(entry)
        };
    }

    /**
     * Calcula tempo médio entre chunks
     * @private
     */
    calculateAverageChunkTiming(entry) {
        if (!entry.chunkTimings || entry.chunkTimings.length < 2) return null;
        
        let totalDiff = 0;
        for (let i = 1; i < entry.chunkTimings.length; i++) {
            totalDiff += entry.chunkTimings[i] - entry.chunkTimings[i-1];
        }
        return totalDiff / (entry.chunkTimings.length - 1);
    }

    /**
     * Verifica correspondência entre conteúdo acumulado e resposta completa
     * @private
     */
    validateContentMatch(messageId, completeResponse) {
        const entry = messageRegistry.messages.get(messageId);
        if (!entry || !completeResponse) return { matches: true };  // assume match if can't verify

        const accumulated = entry.content || '';
        if (accumulated === completeResponse) return { matches: true };

        // Se não corresponder exatamente, calcular diferença
        return {
            matches: false,
            accumulatedLength: accumulated.length,
            completeLength: completeResponse.length,
            firstDifferenceAt: this.findFirstDifference(accumulated, completeResponse)
        };
    }

    /**
     * Encontra a primeira diferença entre duas strings
     * @private
     */
    findFirstDifference(str1, str2) {
        const minLength = Math.min(str1.length, str2.length);
        for (let i = 0; i < minLength; i++) {
            if (str1[i] !== str2[i]) return i;
        }
        return str1.length === str2.length ? -1 : minLength;
    }

    /**
     * Verifica duplicações de conteúdo
     * @private
     */
    checkForDuplicates(conversationId, content) {
        const messages = Array.from(messageRegistry.messages.values())
            .filter(m => m.conversationId === conversationId && m.isComplete);
        
        const duplicates = {
            hasDuplicates: false,
            similarMessageIds: [],
            similarityScore: 0
        };

        for (const message of messages) {
            if (!message.content || message.content === content) continue;
            
            const similarity = this.calculateSimilarity(content, message.content);
            if (similarity > 0.9) {  // 90% similar
                duplicates.hasDuplicates = true;
                duplicates.similarMessageIds.push(message.id);
                duplicates.similarityScore = Math.max(duplicates.similarityScore, similarity);
            }
        }

        return duplicates;
    }

    /**
     * Calcula similaridade entre duas strings (0-1)
     * @private
     */
    calculateSimilarity(str1, str2) {
        // Simplificação para comparação rápida
        const sample1 = str1.substring(0, 100).toLowerCase();
        const sample2 = str2.substring(0, 100).toLowerCase();
        
        let matches = 0;
        const minLength = Math.min(sample1.length, sample2.length);
        
        for (let i = 0; i < minLength; i++) {
            if (sample1[i] === sample2[i]) matches++;
        }
        
        return matches / minLength;
    }
}

// Exportar instância única
export const streamingManager = new StreamingManager();