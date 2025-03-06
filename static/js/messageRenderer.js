
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js e highlight.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Passo 1: Verificar se hljs está disponível globalmente
    if (typeof hljs === 'undefined') {
        console.error('[ERRO] highlight.js não está definido. Verifique se o script foi carregado corretamente.');
        return `<pre>${text}</pre>`;
    }

    // Passo 2: Configurar highlight.js
    hljs.configure({
        cssSelector: 'pre code',
        ignoreUnescapedHTML: true
    });

    // Passo 3: Configurar marked
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
                        <span class="language-label">${language.toUpperCase()}</span>
                        <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                    </div>
                    <pre class="code-block"><code class="hljs language-${language}">${highlightedCode}</code></pre>
                </div>`;
            } catch (error) {
                console.error(`Erro ao destacar código: ${error.message}`);
                // Fallback seguro em caso de erro
                return `<div class="code-container">
                    <div class="code-header">
                        <span class="language-label">TEXTO</span>
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
            console.error('[ERRO] DOMPurify não está definido');
            return marked.parse(text);
        }
        
        const allowedTags = ['pre', 'code', 'span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                            'ul', 'ol', 'li', 'blockquote', 'a', 'strong', 'em', 'del', 'table', 
                            'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br', 'img', 'button', 'i'];
        
        const allowedAttributes = {
            'code': ['class'],
            'span': ['class'],
            'div': ['class'],
            'button': ['class', 'onclick', 'title'],
            'a': ['href', 'target', 'rel'],
            'img': ['src', 'alt'],
            'i': ['class']
        };
        
        // Usar o marked para converter o Markdown em HTML
        const htmlContent = marked.parse(text);
        
        // Sanitizar o HTML final preservando classes e botão de copiar
        const finalHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: allowedTags,
            ALLOWED_ATTR: allowedAttributes,
            ADD_ATTR: ['target', 'onclick'],
            FORBID_TAGS: ['style', 'script'],
            FORBID_ATTR: ['style', 'onerror']
        });
        
        return finalHtml;
    } catch (error) {
        console.error(`Erro ao renderizar markdown: ${error.message}`);
        return `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
    }
}
