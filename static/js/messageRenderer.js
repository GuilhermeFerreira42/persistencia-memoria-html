import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.js';
import { logger } from './utils/logger.js';
import { messageRegistry } from './modules/messageRegistry.js';

// Exportar o messageRegistry para retrocompatibilidade
export { messageRegistry };

/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMarkdown(text) {
    if (!text) {
        logger.warn('Texto vazio recebido para renderização');
        return '';
    }

    // Se o texto for um elemento DOM com data-no-markdown, retorna o HTML bruto
    if (typeof text === 'string' && text.includes('data-no-markdown')) {
        logger.debug('Conteúdo HTML direto detectado (data-no-markdown)');
        return text;
    }

    // Verificar dependências e logar se não estiverem disponíveis
    if (typeof marked === 'undefined' || typeof hljs === 'undefined') {
        logger.error('Dependências de renderização não encontradas', {
            marked: typeof marked,
            hljs: typeof hljs
        });
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }

    try {
        logger.debug('Iniciando renderização de Markdown', {
            textSize: text.length
        });
        
        // Configurar marked para suportar tabelas e outros elementos
        marked.setOptions({
            breaks: true,
            gfm: true,
            tables: true,
            headerIds: false,
            mangle: false,
            sanitize: false,
            highlight: (code, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        logger.warn('Erro ao destacar código', { 
                            language: lang, 
                            error: e.message 
                        });
                    }
                }
                return code;
            }
        });

        const htmlContent = marked.parse(text);

        const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel']
        });

        logger.debug('Markdown renderizado com sucesso', {
            inputSize: text.length,
            outputSize: sanitizedHtml.length
        });
        
        return sanitizedHtml;
    } catch (error) {
        logger.error('Falha ao renderizar mensagem', {
            error: error.message,
            stack: error.stack
        });
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}

// Função renomeada para evitar conflito com a nova implementação
export const renderMessage = renderMarkdown;

// Mapa para armazenar as respostas acumuladas por conversa
const accumulatedResponses = new Map();

/**
 * Acumula chunks de mensagem por conversa
 * @param {string} chunk - Chunk de texto recebido
 * @param {string} conversationId - ID da conversa
 */
export function accumulateChunk(chunk, conversationId) {
    if (!conversationId || !chunk) {
        logger.warn('Chunk ou conversationId inválido para acumulação', { 
            chunkValid: !!chunk, 
            conversationIdValid: !!conversationId 
        });
        return;
    }
    
    let accumulated = accumulatedResponses.get(conversationId) || '';
    
    // Verificar se o chunk é válido e pode ser concatenado
    if (typeof chunk !== 'string') {
        logger.warn('Tipo de chunk inválido recebido', { 
            tipo: typeof chunk,
            chunk: JSON.stringify(chunk).substring(0, 100)
        });
        return;
    }
    
    accumulated += chunk;
    accumulatedResponses.set(conversationId, accumulated);
    
    logger.debug('Chunk acumulado', { 
        conversationId,
        chunkSize: chunk.length,
        totalAccumulatedSize: accumulated.length
    });

    // Emitir evento de atualização
    const event = new CustomEvent('chunk_accumulated', {
        detail: {
            conversationId,
            accumulated,
            chunk
        }
    });
    window.dispatchEvent(event);
}

// Variável para armazenar a referência ao ID da conversa atual
let currentConversationId = null;

/**
 * Define qual é a conversa ativa atual
 * @param {string} conversationId - ID da conversa ativa
 */
export function setCurrentConversation(conversationId) {
    logger.debug('Conversa atual definida', { 
        previousId: currentConversationId, 
        newId: conversationId 
    });
    currentConversationId = conversationId;
}

/**
 * Renderiza ou atualiza uma mensagem em um container individual
 * @param {Object} params - Parâmetros da mensagem
 * @param {string} params.content - Conteúdo do texto/chunk
 * @param {string} params.conversationId - ID da conversa
 * @param {string} params.role - Papel ("user" ou "assistant")
 * @param {string} params.messageId - ID único da mensagem
 * @param {boolean} params.isStreaming - Indica se é streaming
 * @returns {HTMLElement} O elemento da mensagem
 */
export function renderMessageContainer({ content, conversationId, role = 'assistant', messageId, isStreaming = false }) {
    logger.debug('Renderizando container de mensagem', { 
        messageId, 
        conversationId,
        role,
        contentSize: content?.length || 0,
        isStreaming
    });
    
    // Verificar se a conversa corresponde à conversa ativa
    if (conversationId !== currentConversationId && conversationId !== window.conversaAtual?.id) {
        logger.warn('Tentativa de renderizar mensagem para conversa não ativa', {
            renderingFor: conversationId,
            currentActive: currentConversationId || window.conversaAtual?.id
        });
        return null;
    }

    // Identificar o container de chat
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        logger.error('Container de chat não encontrado para renderização', {
            messageId, 
            conversationId
        });
        return null;
    }

    // Verificar se já existe um container para esta mensagem
    let messageDiv = document.getElementById(`message-${messageId}`);
    
    // Criar container se não existir
    if (!messageDiv) {
        logger.debug('Criando novo container para mensagem', { 
            messageId,
            conversationId, 
            role 
        });
        
        messageDiv = document.createElement("div");
        messageDiv.id = `message-${messageId}`;
        messageDiv.className = `message ${role} fade-in`; 
        messageDiv.dataset.messageId = messageId;
        messageDiv.dataset.conversationId = conversationId;
        
        // Estrutura interna da mensagem
        messageDiv.innerHTML = `
            <div class="message-content"></div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
                ${role === 'assistant' ? `
                    <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                        <i class="fas fa-redo"></i>
                    </button>
                ` : ''}
            </div>
        `;
        
        chatContainer.appendChild(messageDiv);
        
        // Rolar para o final se estiver próximo do fundo
        scrollToBottomIfNear(chatContainer);
    } else {
        logger.debug('Atualizando container de mensagem existente', { 
            messageId,
            previousContentSize: messageDiv.querySelector('.message-content')?.innerHTML?.length || 0
        });
    }

    // Localizar o container de conteúdo
    const contentContainer = messageDiv.querySelector('.message-content');
    if (!contentContainer) {
        logger.error('Container de conteúdo não encontrado na mensagem', { 
            messageId, 
            messageHtml: messageDiv.outerHTML.substring(0, 100) 
        });
        return messageDiv;
    }

    // Converter markdown e sanitizar o conteúdo
    const sanitizedHTML = renderMarkdown(content);

    // Atualizar o conteúdo
    if (isStreaming) {
        // No modo streaming, adicionamos incrementalmente
        contentContainer.innerHTML = sanitizedHTML;
        logger.debug('Conteúdo de streaming atualizado', { 
            messageId, 
            contentSize: sanitizedHTML.length 
        });
    } else {
        // Em modo normal, substituímos o conteúdo
        contentContainer.innerHTML = sanitizedHTML;
        logger.debug('Conteúdo normal atualizado', { 
            messageId, 
            contentSize: sanitizedHTML.length 
        });
    }

    return messageDiv;
}

/**
 * Função auxiliar para rolar para o final se estiver próximo
 * @param {HTMLElement} chatContainer - Container de chat
 */
function scrollToBottomIfNear(chatContainer) {
    if (chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 100) {
        requestAnimationFrame(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    }
}

/**
 * Renderiza a resposta completa acumulada
 * @param {string} conversationId - ID da conversa
 * @returns {string} HTML formatado da resposta completa
 */
export function renderCompleteResponse(conversationId) {
    if (!conversationId) {
        console.warn('[DEBUG] conversationId não fornecido para renderização completa');
        return '';
    }

    const completeResponse = accumulatedResponses.get(conversationId);
    if (!completeResponse) {
        console.warn('[DEBUG] Nenhuma resposta acumulada encontrada para:', conversationId);
        return '';
    }

    try {
        // Renderizar com todas as otimizações
        const renderedContent = renderMarkdown(completeResponse);
        
        // Limpar a resposta acumulada após renderização bem-sucedida
        accumulatedResponses.delete(conversationId);
        
        // Emitir evento de renderização completa
        const event = new CustomEvent('response_rendered', {
            detail: {
                conversationId,
                content: renderedContent
            }
        });
        window.dispatchEvent(event);
        
        return renderedContent;
    } catch (error) {
        console.error('[ERRO] Falha ao renderizar resposta completa:', error);
        return '';
    }
}

/**
 * Limpa a resposta acumulada de uma conversa
 * @param {string} conversationId - ID da conversa
 */
export function clearAccumulatedResponse(conversationId) {
    if (conversationId) {
        const hadResponse = accumulatedResponses.has(conversationId);
        accumulatedResponses.delete(conversationId);
        
        if (hadResponse) {
            // Emitir evento de limpeza
            const event = new CustomEvent('response_cleared', {
                detail: { conversationId }
            });
            window.dispatchEvent(event);
        }
    } else {
        console.warn('[DEBUG] Tentativa de limpar resposta sem conversationId');
    }
}

// Adicionar função para verificar estado da acumulação
export function getAccumulatedState(conversationId) {
    if (!conversationId) {
        console.warn('[DEBUG] Tentativa de verificar estado sem conversationId');
        return null;
    }
    
    const accumulated = accumulatedResponses.get(conversationId);
    return {
        hasAccumulated: !!accumulated,
        size: accumulated ? accumulated.length : 0
    };
}

// Cache para chunks de código
const codeChunkCache = new Map();

/**
 * Processa um chunk de código e retorna o HTML formatado
 * @param {string} chunk - Chunk de texto que pode conter código
 * @returns {string} HTML formatado
 */
function processCodeChunk(chunk) {
    if (!chunk) return '';
    
    // Verificar se o chunk contém código
    const codeMatch = chunk.match(/```(\w+)?\n([\s\S]*?)```/);
    if (!codeMatch) return chunk;
    
    const [, lang, code] = codeMatch;
    const cacheKey = `${lang || 'plaintext'}_${code}`;
    
    // Verificar cache
    if (codeChunkCache.has(cacheKey)) {
        return codeChunkCache.get(cacheKey);
    }
    
    try {
        let highlighted;
        if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(code, { language: lang }).value;
        } else {
            highlighted = hljs.highlight(code).value;
        }
        
        const html = `<pre><code class="language-${lang || 'plaintext'}">${highlighted}</code></pre>`;
        
        // Armazenar no cache
        codeChunkCache.set(cacheKey, html);
        
        return html;
    } catch (e) {
        logger.error('Erro ao processar chunk de código', e);
        return `<pre><code>${code}</code></pre>`;
    }
}

/**
 * Cria um novo container para mensagem
 * @param {string} messageId - ID da mensagem
 * @param {string} conversationId - ID da conversa
 * @returns {HTMLElement} Container criado
 */
const createContainer = (messageId, conversationId) => {
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
    
    // Criar novo container
    container = document.createElement('div');
    container.className = 'message assistant streaming';
    container.dataset.messageId = messageId;
    container.dataset.conversationId = conversationId;
    container.dataset.createdAt = Date.now().toString();
    
    // Adicionar estrutura interna completa
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
    
    logger.debug(`Novo container criado para mensagem ${messageId}`);
    
    return container;
};

/**
 * Renderiza um chunk de mensagem em streaming
 * @param {string} messageId - ID único da mensagem
 * @param {string} chunk - Chunk de texto a ser renderizado
 * @param {string} conversationId - ID da conversa
 */
export const renderMessageChunk = (messageId, chunk, conversationId) => {
    if (!messageId) {
        logger.error('Tentativa de renderizar chunk sem messageId');
        return;
    }
    
    logger.debug('Renderizando chunk', { 
        messageId, 
        conversationId,
        chunkSize: chunk?.length || 0
    });
    
    // Verificar se a conversa é a atual
    if (conversationId && conversationId !== window.conversaAtual?.id) {
        logger.debug('Ignorando chunk de outra conversa', {
            atual: window.conversaAtual?.id,
            recebido: conversationId
        });
        return;
    }
    
    // Verificar se já existe uma mensagem completa recente para evitar duplo rendering
    const existingCompleteMessages = document.querySelectorAll(`.message.assistant.complete[data-conversation-id="${conversationId}"], .message.assistant:not(.streaming)[data-conversation-id="${conversationId}"]`);
    if (existingCompleteMessages.length > 0) {
        const lastMessage = existingCompleteMessages[existingCompleteMessages.length - 1];
        const lastMessageTimestamp = lastMessage.dataset.createdAt || '0';
        const now = Date.now();
        const age = now - parseInt(lastMessageTimestamp, 10);
        
        // Se existe uma mensagem completa criada nos últimos 2 segundos
        if (age < 2000) {
            logger.warn('Ignorando chunk para evitar duplicação - mensagem completa recente detectada', { 
                messageId,
                completeMessageId: lastMessage.dataset.messageId,
                age: age + 'ms'
            });
            return;
        }
    }
    
    // Verificar se já existem múltiplos containers com o mesmo ID de mensagem
    const duplicateContainers = document.querySelectorAll(`[data-message-id="${messageId}"]`);
    if (duplicateContainers.length > 1) {
        logger.warn('Detectados múltiplos containers com mesmo messageId', {
            messageId,
            count: duplicateContainers.length
        });
        
        // Manter apenas o mais recente, remover os outros
        const containersArray = Array.from(duplicateContainers);
        containersArray.sort((a, b) => {
            const aTime = parseInt(a.dataset.createdAt || '0', 10);
            const bTime = parseInt(b.dataset.createdAt || '0', 10);
            return bTime - aTime; // Ordenar do mais recente para o mais antigo
        });
        
        // Manter o primeiro (mais recente) e remover os outros
        for (let i = 1; i < containersArray.length; i++) {
            logger.info('Removendo container duplicado', {
                messageId,
                index: i,
                createdAt: containersArray[i].dataset.createdAt
            });
            containersArray[i].remove();
        }
    }
    
    // Verificar e registrar a mensagem no messageRegistry
    let entry = messageRegistry.getMessage(messageId);
    
    if (!entry) {
        entry = messageRegistry.registerMessage(messageId, {
            conversationId,
            content: ''
        });
        logger.debug('Nova entrada criada no registro para mensagem', { messageId });
    }
    
    // Adicionar o chunk ao conteúdo acumulado
    messageRegistry.addChunk(messageId, chunk);
    
    // Obter o container da mensagem
    let container = entry.container;
    
    if (!container) {
        // Verificar se já existe um container para esta mensagem no DOM
        container = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (container) {
            logger.debug('Container existente encontrado no DOM', { messageId });
            entry.container = container;
        } else {
            // Criar novo container se não existir
            logger.debug('Criando novo container para mensagem', { messageId });
            container = createContainer(messageId, conversationId);
            entry.container = container;
        }
    } else if (!document.body.contains(container)) {
        // Se o container existe no registro mas não está no DOM
        logger.warn('Container existe no registro mas não no DOM, recriando', { messageId });
        container = createContainer(messageId, conversationId);
        entry.container = container;
    }
    
    // Renderizar o conteúdo acumulado
    renderContent(entry);
    
    // Configurar limpeza automática
    if (!entry.cleanupTimer) {
        entry.cleanupTimer = setTimeout(() => {
            cleanupOrphan(messageId);
        }, 10000);
    }
};

/**
 * Renderiza o conteúdo em um container
 * @param {Object} entry - Entrada do registro
 */
const renderContent = (entry) => {
    try {
        // Preparar o conteúdo com marcador de cursor para streaming
        const htmlContent = marked.parse(entry.content + '<span class="streaming-cursor">█</span>');
        const sanitizedHtml = DOMPurify.sanitize(htmlContent);
        
        // Obter o elemento de conteúdo
        const contentElement = entry.container.querySelector('.message-content');
        
        if (contentElement) {
            // Apenas atualizar o conteúdo, mantendo a estrutura
            contentElement.innerHTML = sanitizedHtml;
        } else {
            // Se não houver elemento de conteúdo, criar a estrutura completa
            logger.warn('Elemento message-content não encontrado, recriando estrutura', { 
                messageId: entry.id || entry.container.dataset.messageId 
            });
            
            entry.container.innerHTML = `
                <div class="message-content">${sanitizedHtml}</div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
        }
        
        // Rolagem suave para o novo conteúdo
        requestAnimationFrame(() => {
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer && chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 100) {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
        });
    } catch (error) {
        logger.error('Erro ao renderizar conteúdo', { 
            error: error.message,
            messageId: entry.container.dataset.messageId 
        });
    }
};

/**
 * Limpa containers órfãos
 * @param {string} messageId - ID da mensagem a ser limpa
 */
const cleanupOrphan = (messageId) => {
    logger.debug('Verificando container órfão', { messageId });
    const entry = messageRegistry.getMessage(messageId);
    
    if (entry && (!entry.container || !entry.container.textContent.trim() || !document.body.contains(entry.container))) {
        logger.info('Removendo container órfão', { messageId });
        if (entry.container && document.body.contains(entry.container)) {
            entry.container.remove();
        }
        messageRegistry.removeMessage(messageId);
    }
};

/**
 * Finaliza a mensagem após conclusão do streaming
 * @param {string} messageId - ID único da mensagem
 * @param {string} conversationId - ID da conversa
 * @param {string} content - Conteúdo final da mensagem
 */
export const completeMessage = (messageId, conversationId, content) => {
    try {
        logger.debug('Completando mensagem', { messageId, conversationId });
        
        // Verificar se já existe uma mensagem completa recente para evitar duplicação
        const existingCompleteMessages = document.querySelectorAll(`.message.assistant.complete[data-conversation-id="${conversationId}"], .message.assistant:not(.streaming)[data-conversation-id="${conversationId}"]`);
        if (existingCompleteMessages.length > 0) {
            const lastMessage = existingCompleteMessages[existingCompleteMessages.length - 1];
            
            // Não completar se o conteúdo for muito similar
            if (lastMessage.dataset.messageId !== messageId) {
                const lastContent = lastMessage.querySelector('.message-content')?.textContent || '';
                
                // Se o início do conteúdo é similar, pode ser duplicação
                if (content && lastContent && 
                    content.substring(0, 50).trim() === lastContent.substring(0, 50).trim()) {
                    
                    logger.warn('Evitando completar mensagem duplicada', {
                        messageId,
                        existingId: lastMessage.dataset.messageId,
                        similarity: 'primeiros 50 caracteres iguais'
                    });
                    
                    // Remover o container de streaming para não deixar duplicado
                    const streamingContainer = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (streamingContainer) {
                        logger.info('Removendo container de streaming redundante', { messageId });
                        streamingContainer.remove();
                    }
                    
                    return;
                }
            }
        }
        
        // Usar messageRegistry para obter a entrada da mensagem
        const entry = messageRegistry.getMessage(messageId);
        
        if (!entry || !entry.container) {
            logger.error('Container não encontrado para completar mensagem', { messageId, conversationId });
            return;
        }
        
        // Verificar duplicação com base no conteúdo
        const existingEntries = Array.from(messageRegistry.messages.values())
            .filter(msg => msg.id !== messageId && msg.complete && msg.conversationId === conversationId);
        
        for (const existingEntry of existingEntries) {
            // Comparar primeiros 50 caracteres
            if (existingEntry.content && content &&
                existingEntry.content.substring(0, 50).trim() === content.substring(0, 50).trim()) {
                
                logger.warn('Conteúdo similar detectado em mensagem existente', {
                    messageId,
                    existingId: existingEntry.id
                });
                
                // Apenas logamos, pois pode ser uma resposta legitimamente similar
                break;
            }
        }
        
        // Remover a classe de streaming
        entry.container.classList.remove('streaming');
        entry.container.classList.add('complete');
        entry.container.dataset.completedAt = Date.now().toString();
        
        // Preservar os botões de ação
        const actionsElement = entry.container.querySelector('.message-actions');
        
        // Atualizar o conteúdo da mensagem no registro
        entry.content = content;
        
        // Obter o elemento de conteúdo
        const contentElement = entry.container.querySelector('.message-content');
        
        if (contentElement) {
            // Atualizar apenas o conteúdo sem a cursor de streaming
            contentElement.innerHTML = DOMPurify.sanitize(marked.parse(content));
            logger.debug('Conteúdo atualizado mantendo estrutura', { messageId });
        } else {
            // Se não existir, criar a estrutura completa
            logger.warn('Elemento message-content não encontrado ao completar mensagem', { messageId });
            
            // Preservar a estrutura original com o conteúdo atualizado
            entry.container.innerHTML = `<div class="message-content">${DOMPurify.sanitize(marked.parse(content))}</div>`;
            
            // Re-adicionar os botões de ação se já existiam
            if (actionsElement) {
                entry.container.appendChild(actionsElement);
                logger.debug('Botões de ação readicionados', { messageId });
            } else {
                // Criar botões de ação padrão
                const newActions = document.createElement('div');
                newActions.className = 'message-actions';
                newActions.innerHTML = `
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                        <i class="fas fa-redo"></i>
                    </button>
                `;
                entry.container.appendChild(newActions);
                logger.debug('Novos botões de ação adicionados', { messageId });
            }
        }
        
        // Marcar como completa no messageRegistry
        messageRegistry.completeMessage(messageId);
        
        logger.info('Mensagem completada com sucesso', { messageId, conversationId });
    } catch (error) {
        logger.error('Erro ao completar mensagem', { 
            error: error.message, 
            stack: error.stack,
            messageId, 
            conversationId 
        });
    }
};

// Sistema de backup para limpeza de containers vazios
setInterval(() => {
    document.querySelectorAll('.message.streaming').forEach(container => {
        const messageId = container.dataset.messageId;
        if (messageId && (!container.textContent.trim() || container.querySelector('.message-content:empty'))) {
            logger.debug('Detectado container vazio', { messageId });
            cleanupOrphan(messageId);
        }
    });
}, 5000);

// Estilos para o cursor
const style = document.createElement('style');
style.textContent = `
.streaming-cursor {
    animation: blink 1s step-end infinite;
    font-weight: bold;
    margin-left: 2px;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}
`;
document.head.appendChild(style);
