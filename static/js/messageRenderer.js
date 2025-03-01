
/**
 * Renderiza uma mensagem formatada com Markdown
 * @param {string} text - Texto em formato Markdown
 * @returns {string} HTML formatado
 */
export function renderMessage(text) {
    // Função para escapar HTML corretamente
    function escapeHTML(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Formatação de cabeçalhos
    let formattedText = text
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Formatação de estilos de texto
    formattedText = formattedText
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Formatação de links
    formattedText = formattedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Formatação de tabelas - regex melhorada para capturar tabelas corretamente
    formattedText = formattedText.replace(/(\|.*\|\r?\n)(\|[-|: ]+\|\r?\n)((?:\|.*\|\r?\n)*)/g, function (match, header, separator, rows) {
        const headerCells = header.split('|').slice(1, -1).map(cell => cell.trim());
        const rowsArray = rows.trim().split('\n').filter(row => row.trim() !== '');
        
        let tableHTML = '<table>';
        tableHTML += '<thead><tr>';
        headerCells.forEach(cell => {
            tableHTML += `<th>${cell}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        rowsArray.forEach(row => {
            if (row.match(/\|.*\|/)) { // Verifica se é uma linha válida
                const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
                tableHTML += '<tr>';
                cells.forEach(cell => {
                    tableHTML += `<td>${cell}</td>`;
                });
                tableHTML += '</tr>';
            }
        });
        
        tableHTML += '</tbody></table>';
        return tableHTML;
    });

    // Formatação de listas
    formattedText = formattedText.replace(/^\s*[\-\*] (.*$)/gm, '<li>$1</li>');
    formattedText = formattedText.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    formattedText = formattedText.replace(/^\s*(\d+)\. (.*$)/gm, '<li>$2</li>');
    formattedText = formattedText.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

    // Formatação de blocos de código (estilo terminal com barra de título)
    formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
        const language = lang || 'plaintext';
        const escapedCode = escapeHTML(code.trim());
        
        // Aplicando realce de sintaxe básico
        let highlightedCode = escapedCode;
        
        // Palavras-chave comuns em várias linguagens
        const keywords = [
            'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
            'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
            'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
            'public', 'private', 'protected', 'static', 'new', 'this', 'super',
            'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False'
        ];
        
        // Estilizar palavras-chave
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            highlightedCode = highlightedCode.replace(regex, `<span class="keyword">${keyword}</span>`);
        });
        
        // Estilizar strings
        highlightedCode = highlightedCode.replace(/(["'])(.*?)\1/g, '<span class="string">$&</span>');
        
        // Estilizar números
        highlightedCode = highlightedCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
        
        // Estilizar comentários (simplificado)
        highlightedCode = highlightedCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
        
        // Comentários multilinhas (para C, Java, etc)
        highlightedCode = highlightedCode.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>');
        
        return `<div class="code-container">
            <div class="code-header">
                <span class="language-label">${language}</span>
                <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
            </div>
            <pre class="code-block" data-language="${language}"><code>${highlightedCode}</code></pre>
        </div>`;
    });

    // Formatação de citações
    formattedText = formattedText.replace(/^\> (.*$)/gm, '<blockquote>$1</blockquote>');

    // Adicionando quebras de linha
    formattedText = formattedText.replace(/\n/g, '<br>');

    // Corrigindo problemas com quebras de linha em tags HTML
    formattedText = formattedText
        .replace(/<\/h1><br>/g, '</h1>')
        .replace(/<\/h2><br>/g, '</h2>')
        .replace(/<\/h3><br>/g, '</h3>')
        .replace(/<\/li><br>/g, '</li>')
        .replace(/<\/blockquote><br>/g, '</blockquote>')
        .replace(/<\/pre><br>/g, '</pre>');
        
    // Remove quebras de linha excessivas antes das tabelas
    formattedText = formattedText.replace(/<br>\s*(<table>)/g, '$1');
    
    // Remove quebras de linha entre tabela e conteúdo seguinte
    formattedText = formattedText.replace(/(<\/table>)<br>/g, '$1');

    return formattedText;
}
