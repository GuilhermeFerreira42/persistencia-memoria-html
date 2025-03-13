
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Verificar dependências
    if (typeof marked === 'undefined') {
        console.error('[ERRO] marked.js não está definido.');
        return `<p>${text}</p>`;
    }
    if (typeof hljs === 'undefined') {
        console.error('[ERRO] highlight.js não está definido.');
        return `<pre>${text}</pre>`;
    }

    // Capturar ID da conversa atual para contexto
    const conversationId = window.conversaAtual?.id;

    // Configurar highlight.js
    hljs.configure({
        cssSelector: 'pre code',
        ignoreUnescapedHTML: true
    });

    // Configurar marked.js com destaque simples
    marked.setOptions({
        gfm: true,               // Suporte a GitHub Flavored Markdown
        breaks: false,           // Não converter \n em <br>
        pedantic: false,         // Não ser extremamente rígido
        sanitize: false,         // Não sanitizar (usaremos DOMPurify)
        smartLists: true,        // Listas inteligentes
        smartypants: false,      // Não usar tipografia avançada
        highlight: function(code, lang) {
            try {
                // Identificar a linguagem correta ou usar plaintext como fallback
                const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
                
                // Aplicar highlight.js ao código
                const highlighted = hljs.highlight(code, { language }).value;
                
                // Retornar o código com a classe de linguagem para detecção posterior
                return `<code class="language-${language} hljs">${highlighted}</code>`;
            } catch (error) {
                return code;
            }
        }
    });

    try {
        // Verificar DOMPurify
        if (typeof DOMPurify === 'undefined') {
            return marked.parse(text);
        }

        // Configurar sanitização para preservar a estrutura do código
        const allowedTags = ['pre', 'code', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                            'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'del', 'table',
                            'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'img'];

        const allowedAttributes = {
            'code': ['class'],  // Permitir classes em <code> para detectar a linguagem
            'span': ['class'],
            'a': ['href', 'target', 'rel'],
            'img': ['src', 'alt'],
            // Adicionar data-* attributes para manter isolamento de contexto
            '*': ['data-conversation-id']
        };

        // Parsear o Markdown
        const htmlContent = marked.parse(text);

        // Sanitizar o HTML preservando a estrutura
        const finalHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: allowedTags,
            ALLOWED_ATTR: allowedAttributes,
            ADD_ATTR: ['target', 'data-conversation-id'],
        });
        
        return finalHtml;
    } catch (error) {
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}

/**
 * Renderiza incrementalmente mensagens durante o streaming
 * Melhorada para suportar formatação Markdown em tempo real
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderStreamingMessage(text) {
    try {
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
        }
        
        // Configuração simples para renderização rápida
        marked.setOptions({
            breaks: true,   // Converter \n em <br> para streaming
            highlight: function(code, lang) {
                try {
                    if (typeof hljs !== 'undefined') {
                        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
                        return hljs.highlight(code, { language }).value;
                    }
                    return code;
                } catch (error) {
                    return code;
                }
            }
        });
        
        // Parsear o Markdown
        const htmlContent = marked.parse(text);
        
        // Sanitizar o HTML (versão simplificada para streaming)
        const finalHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: ['p', 'strong', 'em', 'code', 'pre', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span'],
            ALLOWED_ATTR: ['class']
        });
        
        return finalHtml;
    } catch (error) {
        console.error('Erro no streaming:', error);
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}
