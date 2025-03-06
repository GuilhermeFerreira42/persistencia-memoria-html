
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Passo 1: Verificar se hljs está disponível globalmente
    if (typeof hljs === 'undefined') {
        console.error('[ERRO] highlight.js não está definido. Verifique se o script foi carregado corretamente.');
        // Fallback simples se hljs não estiver disponível
        return `<pre>${text}</pre>`;
    }

    // Passo 1: Configurar highlight.js
    hljs.configure({
        cssSelector: 'pre code',
        ignoreUnescapedHTML: true
    });

    // Passo 2: Configurar marked
    marked.setOptions({
        gfm: true,               // Suporte a GitHub Flavored Markdown
        breaks: false,           // Não converter \n em <br>
        pedantic: false,         // Não ser extremamente rígido
        sanitize: false,         // Não sanitizar (usaremos DOMPurify)
        smartLists: true,        // Listas inteligentes
        smartypants: false,      // Não usar tipografia avançada
        highlight: function(code, lang) {
            try {
                // Usar linguagem específica ou detectar automaticamente
                const language = lang || 'plaintext';
                const highlightedCode = hljs.highlight(code, { language }).value;
                
                // Retornar o HTML com o container personalizado
                return `<div class="code-container">
                    <div class="code-header">
                        <span class="language-label">${language}</span>
                        <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                    </div>
                    <pre class="code-block"><code class="hljs language-${language}">${highlightedCode}</code></pre>
                </div>`;
            } catch (error) {
                console.error(`Erro ao destacar código: ${error.message}`);
                // Fallback seguro em caso de erro
                return `<div class="code-container">
                    <div class="code-header">
                        <span class="language-label">texto</span>
                        <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                    </div>
                    <pre class="code-block"><code>${code}</code></pre>
                </div>`;
            }
        }
    });
    
    try {
        // Primeiro, verificar se DOMPurify está disponível
        if (typeof DOMPurify === 'undefined') {
            console.error('[ERRO] DOMPurify não está definido. Verifique se o script foi carregado corretamente.');
            return marked.parse(text); // Fallback sem sanitização (não recomendado em produção)
        }
        
        // Sanitização inteligente para preservar classes de highlight.js
        const allowedTags = ['pre', 'code', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                            'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'del', 'table', 
                            'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'img'];
        
        const allowedAttributes = {
            'code': ['class'],
            'span': ['class'],
            'div': ['class'],
            'a': ['href', 'target', 'rel'],
            'img': ['src', 'alt']
        };
        
        // Primeiro sanitizar o texto cru
        const sanitizedText = DOMPurify.sanitize(text, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });
        
        // Usar o marked para converter o Markdown em HTML
        const htmlContent = marked.parse(sanitizedText);
        
        // Sanitizar o HTML final preservando formatação necessária
        const finalHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: allowedTags,
            ALLOWED_ATTR: allowedAttributes,
            ADD_ATTR: ['target'],
            FORBID_TAGS: ['style', 'script'],
            FORBID_ATTR: ['style', 'onerror', 'onclick'],
        });
        
        // Ativar highlight.js após inserção no DOM
        setTimeout(() => {
            if (typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        }, 50);
        
        return finalHtml;
    } catch (error) {
        console.error(`Erro ao renderizar markdown: ${error.message}`);
        // Fallback seguro em caso de erro
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}
