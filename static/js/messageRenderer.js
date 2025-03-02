
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Função para escapar HTML corretamente (usada apenas quando necessário)
    function escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Parser de Markdown personalizado
    function parseMarkdown(md) {
        let html = md;
        
        // Processamento de blocos de código com melhorias para evitar escape incorreto
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            const language = lang || 'plaintext';
            let codeToHighlight = code.trim();
            
            // Aplicar destaque de sintaxe ao código original (não escapado)
            let highlightedCode = codeToHighlight;
            
            // Palavras-chave em várias linguagens
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False',
                'elif', 'and', 'or', 'not', 'in', 'is', 'lambda', 'pass', 'raise', 'with'
            ];
            
            // Primeiro, escapar o HTML para evitar injeção
            let finalCode = escapeHTML(highlightedCode);
            
            // Aplicar destaque às palavras-chave com RegExp cuidadosa
            keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                finalCode = finalCode.replace(regex, `<span class="keyword">${keyword}</span>`);
            });
            
            // Destacar strings - tanto com aspas simples quanto duplas
            finalCode = finalCode.replace(/(&quot;|&#039;)(.*?)(\1)/g, '<span class="string">$&</span>');
            
            // Destacar números
            finalCode = finalCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
            
            // Destacar comentários de linha única
            finalCode = finalCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
            
            return `<div class="code-container">
                <div class="code-header">
                    <span class="language-label">${language}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${language}"><code>${finalCode}</code></pre>
            </div>`;
        });
        
        // Processamento de blocos inline code
        html = html.replace(/`([^`]+)`/g, function(_, code) {
            return `<code>${escapeHTML(code)}</code>`;
        });
        
        // Formatação de cabeçalhos
        html = html
            .replace(/^### (.*$)/gm, function(_, text) {
                return `<h3>${text}</h3>`;
            })
            .replace(/^## (.*$)/gm, function(_, text) {
                return `<h2>${text}</h2>`;
            })
            .replace(/^# (.*$)/gm, function(_, text) {
                return `<h1>${text}</h1>`;
            });
            
        // Formatação de estilos de texto
        html = html
            .replace(/\*\*(.*?)\*\*/g, function(_, text) {
                return `<strong>${text}</strong>`;
            })
            .replace(/\*(.*?)\*/g, function(_, text) {
                return `<em>${text}</em>`;
            })
            .replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Formatação de links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, function(_, text, href) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        // Processamento melhorado de listas
        function processLists(text) {
            // Listas não ordenadas
            text = text.replace(/^[\-\*]\s+(.*?)$/gm, '<li>$1</li>');
            text = text.replace(/(<li>.*?<\/li>\n)+/g, function(match) {
                return `<ul>${match}</ul>`;
            });
            
            // Listas ordenadas
            text = text.replace(/^\d+\.\s+(.*?)$/gm, '<li>$1</li>');
            text = text.replace(/(<li>.*?<\/li>\n)+/g, function(match) {
                if (match.startsWith('<li>')) {
                    return `<ol>${match}</ol>`;
                }
                return match;
            });
            
            return text;
        }
        
        html = processLists(html);

        // Formatação de tabelas (preservar processamento existente que funciona)
        html = html.replace(/^\|(.*\|)+\r?\n\|([\-\|: ]+\|\r?\n)((?:\|.*\|\r?\n)*)/gm, function(match) {
            const rows = match.trim().split('\n');
            const headerRow = rows[0];
            const bodyRows = rows.slice(2);
            
            // Processar cabeçalho
            const headerCells = headerRow.split('|').slice(1, -1).map(cell => cell.trim());
            let header = '<tr>';
            headerCells.forEach(cell => {
                header += `<th>${cell}</th>`;
            });
            header += '</tr>';
            
            // Processar corpo
            let body = '';
            bodyRows.forEach(row => {
                if (row.match(/\|.*\|/)) { // Verifica se é uma linha válida
                    const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
                    let rowHtml = '<tr>';
                    cells.forEach(cell => {
                        rowHtml += `<td>${cell}</td>`;
                    });
                    rowHtml += '</tr>';
                    body += rowHtml;
                }
            });
            
            return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
        });

        // Formatação de citações
        html = html.replace(/^> (.*$)/gm, function(_, text) {
            return `<blockquote>${text}</blockquote>`;
        });

        // Formatação de parágrafos
        // Dividir por linhas em branco e processar parágrafos
        const paragraphs = html.trim().split(/\n{2,}/);
        html = paragraphs.map(p => {
            p = p.trim();
            // Não envolve em <p> conteúdo que já está em tags HTML
            if (!p || 
                p.startsWith('<h') || 
                p.startsWith('<ul') || 
                p.startsWith('<ol') || 
                p.startsWith('<blockquote') || 
                p.startsWith('<div class="code-container"') ||
                p.startsWith('<table') ||
                p.startsWith('<li')) {
                return p;
            }
            // Substitui quebras de linha simples por <br>
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('\n\n');

        return html;
    }

    // Renderizar o markdown
    return parseMarkdown(text);
}
