
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Configurar marked.js com opções personalizadas
    marked.setOptions({
        gfm: true,               // Suporte a GitHub Flavored Markdown (tabelas)
        breaks: false,           // Não converter \n em <br>
        pedantic: false,         // Não ser extremamente rígido
        sanitize: false,         // Não sanitizar (confiamos no backend)
        smartLists: true,        // Listas inteligentes
        smartypants: false,      // Não usar tipografia avançada
        xhtml: false,            // Não usar tags XHTML auto-fechadas
        renderer: new marked.Renderer(),
        highlight: function(code, lang) {
            // Definir linguagem padrão se não for especificada
            const language = lang || 'plaintext';
            
            // Aplicar destaque de sintaxe ao código
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False',
                'elif', 'and', 'or', 'not', 'in', 'is', 'lambda', 'pass', 'raise', 'with'
            ];
            
            let highlightedCode = code;
            
            // Aplicar destaque às palavras-chave com cuidado para não modificar strings/comentários
            keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                highlightedCode = highlightedCode.replace(regex, `<span class="keyword">${keyword}</span>`);
            });
            
            // Destacar strings (incluindo aspas simples e duplas)
            highlightedCode = highlightedCode.replace(/(".*?"|'.*?')/g, '<span class="string">$&</span>');
            
            // Destacar números
            highlightedCode = highlightedCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
            
            // Destacar comentários
            highlightedCode = highlightedCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
            
            // Retornar o HTML com o container personalizado
            return `<div class="code-container">
                <div class="code-header">
                    <span class="language-label">${language}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${language}"><code>${highlightedCode}</code></pre>
            </div>`;
        }
    });
    
    // Modificar o renderer para personalizar como as listas são renderizadas
    const renderer = new marked.Renderer();
    
    // Usar o marked para converter o Markdown em HTML
    return marked.parse(text);
}
