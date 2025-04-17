/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMarkdown(text) {
    if (!text) {
        console.warn('[DEBUG] Texto vazio recebido para renderização');
        return '';
    }

    // Se o texto for um elemento DOM com data-no-markdown, retorna o HTML bruto
    if (typeof text === 'string' && text.includes('data-no-markdown')) {
        return text;
    }

    // Verificar dependências e logar se não estiverem disponíveis
    if (typeof marked === 'undefined' || typeof hljs === 'undefined') {
        console.warn('[DEBUG] Dependências não encontradas:', {
            marked: typeof marked,
            hljs: typeof hljs
        });
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }

    try {
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
                        console.warn('[DEBUG] Erro ao destacar código:', e);
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

        return sanitizedHtml;
    } catch (error) {
        console.error('[ERRO] Falha ao renderizar mensagem:', error);
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
        console.warn('[DEBUG] Chunk ou conversationId inválido:', { chunk, conversationId });
        return;
    }
    
    let accumulated = accumulatedResponses.get(conversationId) || '';
    
    // Verificar se o chunk é válido e pode ser concatenado
    if (typeof chunk !== 'string') {
        console.warn('[DEBUG] Chunk inválido recebido:', chunk);
        return;
    }
    
    accumulated += chunk;
    accumulatedResponses.set(conversationId, accumulated);

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
    // Verificar se a conversa corresponde à conversa ativa
    if (conversationId !== currentConversationId && conversationId !== window.conversaAtual?.id) {
        return null;
    }

    // Identificar o container de chat
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        console.error('[ERRO] Container de chat não encontrado');
        return null;
    }

    // Verificar se já existe um container para esta mensagem
    let messageDiv = document.getElementById(`message-${messageId}`);
    
    // Criar container se não existir
    if (!messageDiv) {
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
    }

    // Localizar o container de conteúdo
    const contentContainer = messageDiv.querySelector('.message-content');
    if (!contentContainer) {
        console.error('[ERRO] Container de conteúdo não encontrado na mensagem');
        return messageDiv;
    }

    // Converter markdown e sanitizar o conteúdo
    const sanitizedHTML = renderMarkdown(content);

    // Atualizar o conteúdo
    if (isStreaming) {
        // No modo streaming, adicionamos incrementalmente
        contentContainer.innerHTML = sanitizedHTML;
    } else {
        // Em modo normal, substituímos o conteúdo
        contentContainer.innerHTML = sanitizedHTML;
    }

    // Melhorar blocos de código se for mensagem do assistente
    if (role === 'assistant' && typeof window.melhorarBlocosCodigo === 'function') {
        setTimeout(() => {
            window.melhorarBlocosCodigo();
        }, 0);
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

// Sistema de logging
const logger = {
    debug: (message, data = {}) => {
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'debug',
                message,
                data,
                timestamp: new Date().toISOString()
            })
        }).catch(() => {
            // Silenciosamente ignora erros de logging
        });
    },
    error: (message, error = null) => {
        console.error(`[ERRO] ${message}`, error);
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'error',
                message,
                error: error ? error.toString() : null,
                timestamp: new Date().toISOString()
            })
        }).catch(() => {
            // Silenciosamente ignora erros de logging
        });
    }
};

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
 * Renderiza um chunk de mensagem em streaming
 * @param {string} chunk - Chunk de texto para renderizar
 * @returns {string} HTML formatado
 */
export function renderStreamingMessage(chunk) {
    if (!chunk) {
        logger.debug('Chunk vazio recebido para renderização');
        return '';
    }

    logger.debug('Renderizando chunk de streaming', {
        tamanho: chunk.length,
        preview: chunk.substring(0, 50) + '...'
    });

    try {
        // Configurar marked para streaming
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
                        logger.debug('Erro ao destacar código:', e);
                    }
                }
                return code;
            }
        });

        // Renderizar o chunk com marked
        const htmlContent = marked.parse(chunk);

        // Sanitizar o HTML mantendo apenas tags necessárias
        const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: [
                'pre', 'code', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'del', 'br',
                'table', 'thead', 'tbody', 'tr', 'th', 'td'
            ],
            ALLOWED_ATTR: ['class', 'href', 'target', 'data-language']
        });

        // Adicionar classes para animação
        return `<div class="streaming-content">${sanitizedHtml}</div>`;
    } catch (error) {
        logger.error('Erro ao renderizar chunk:', error);
        return `<p>${escapeHTML(chunk)}</p>`;
    }
}
