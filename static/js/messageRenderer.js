/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    if (!text) {
        console.warn('[DEBUG] Texto vazio recebido para renderização');
        return '';
    }

    console.log('[DEBUG] Iniciando renderização de mensagem:', {
        tamanho: text.length,
        preview: text.substring(0, 50) + '...'
    });

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

        console.log('[DEBUG] Renderizando markdown com marked.js');
        const htmlContent = marked.parse(text);
        console.log('[DEBUG] HTML gerado:', {
            tamanho: htmlContent.length,
            preview: htmlContent.substring(0, 50) + '...'
        });

        console.log('[DEBUG] Sanitizando HTML com DOMPurify');
        const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: [
                'pre', 'code', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'del', 'br',
                'table', 'thead', 'tbody', 'tr', 'th', 'td'
            ],
            ALLOWED_ATTR: ['class', 'href', 'target', 'data-language']
        });

        console.log('[DEBUG] HTML sanitizado:', {
            tamanho: sanitizedHtml.length,
            preview: sanitizedHtml.substring(0, 50) + '...'
        });

        return sanitizedHtml;
    } catch (error) {
        console.error('[ERRO] Falha ao renderizar mensagem:', error);
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}

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
    
    console.log('[DEBUG] Acumulando chunk:', {
        conversationId,
        chunkSize: chunk.length,
        chunkPreview: chunk.substring(0, 50) + '...'
    });
    
    let accumulated = accumulatedResponses.get(conversationId) || '';
    
    // Verificar se o chunk é válido e pode ser concatenado
    if (typeof chunk !== 'string') {
        console.warn('[DEBUG] Chunk inválido recebido:', chunk);
        return;
    }
    
    accumulated += chunk;
    accumulatedResponses.set(conversationId, accumulated);
    
    console.log('[DEBUG] Estado atual da acumulação:', {
        conversationId,
        totalSize: accumulated.length,
        preview: accumulated.substring(accumulated.length - Math.min(50, accumulated.length))
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

    console.log('[DEBUG] Iniciando renderização completa para conversa:', conversationId);

    const completeResponse = accumulatedResponses.get(conversationId);
    if (!completeResponse) {
        console.warn('[DEBUG] Nenhuma resposta acumulada encontrada para:', conversationId);
        return '';
    }

    console.log('[DEBUG] Resposta completa encontrada:', {
        conversationId,
        tamanho: completeResponse.length,
        preview: completeResponse.substring(0, 50) + '...'
    });

    try {
        // Renderizar com todas as otimizações
        const renderedContent = renderMessage(completeResponse);
        
        // Limpar a resposta acumulada após renderização bem-sucedida
        accumulatedResponses.delete(conversationId);
        console.log('[DEBUG] Resposta acumulada limpa após renderização:', conversationId);
        
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
        // Não limpar a resposta acumulada em caso de erro
        return '';
    }
}

/**
 * Limpa a resposta acumulada de uma conversa
 * @param {string} conversationId - ID da conversa
 */
export function clearAccumulatedResponse(conversationId) {
    if (conversationId) {
        console.log('[DEBUG] Limpando resposta acumulada para:', conversationId);
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
        console.log(`[DEBUG] ${message}`, data);
        // Tentar enviar log para o backend, mas não quebrar se falhar
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
            // console.error('[ERRO] Falha ao salvar log:', err);
        });
    },
    error: (message, error = null) => {
        console.error(`[ERRO] ${message}`, error);
        // Tentar enviar log para o backend, mas não quebrar se falhar
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
            // console.error('[ERRO] Falha ao salvar log:', err);
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
