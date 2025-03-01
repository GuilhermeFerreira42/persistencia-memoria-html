
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

    // Criando um parser Markdown personalizado
    const renderer = {
        // Formatação de cabeçalhos
        heading(text, level) {
            return `<h${level}>${text}</h${level}>`;
        },
        
        // Formatação de parágrafos
        paragraph(text) {
            return `${text}<br>`;
        },
        
        // Formatação de estilos de texto
        strong(text) {
            return `<strong>${text}</strong>`;
        },
        
        em(text) {
            return `<em>${text}</em>`;
        },
        
        // Formatação de links
        link(href, title, text) {
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        },
        
        // Formatação de listas
        list(body, ordered) {
            const type = ordered ? 'ol' : 'ul';
            return `<${type}>${body}</${type}>`;
        },
        
        listitem(text) {
            return `<li>${text}</li>`;
        },
        
        // Formatação de citações
        blockquote(text) {
            return `<blockquote>${text}</blockquote>`;
        },
        
        // Formatação de tabelas
        table(header, body) {
            return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
        },
        
        tablerow(content) {
            return `<tr>${content}</tr>`;
        },
        
        tablecell(content, { header }) {
            const tag = header ? 'th' : 'td';
            return `<${tag}>${content}</${tag}>`;
        },
        
        // Formatação de blocos de código com solução melhorada para evitar caracteres indesejados
        code(code, language) {
            const lang = language || 'plaintext';
            // Aqui usamos escapeHTML para garantir que o código seja exibido como texto, não HTML
            // mas vamos tratar o destaque de sintaxe de forma especial
            const escapedCode = escapeHTML(code.trim());
            
            // Aplicando realce de sintaxe - agora com uma abordagem mais robusta
            let highlightedCode = escapedCode;
            
            // Palavras-chave comuns em várias linguagens
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False'
            ];
            
            // Estilizar palavras-chave de forma segura, evitando quebrar tags HTML já escapadas
            keywords.forEach(keyword => {
                // Usar uma expressão regular que só pega palavras completas rodeadas por não-palavra ou início/fim de linha
                const regex = new RegExp(`(^|[^a-zA-Z0-9_])${keyword}([^a-zA-Z0-9_]|$)`, 'g');
                highlightedCode = highlightedCode.replace(regex, (match, prefix, suffix) => {
                    return `${prefix}<span class="keyword">${keyword}</span>${suffix}`;
                });
            });
            
            // Estilizar strings de forma segura
            highlightedCode = highlightedCode.replace(/(&quot;|&#039;)(.*?)(\1)/g, '<span class="string">$&</span>');
            
            // Estilizar números
            highlightedCode = highlightedCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
            
            // Estilizar comentários (simplificado)
            highlightedCode = highlightedCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
            
            // Comentários multilinhas (para C, Java, etc)
            highlightedCode = highlightedCode.replace(/(&lt;\!--[\s\S]*?--&gt;|\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>');
            
            return `<div class="code-container">
                <div class="code-header">
                    <span class="language-label">${lang}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${lang}"><code>${highlightedCode}</code></pre>
            </div>`;
        }
    };

    // Implementação melhorada do parseMarkdown
    function parseMarkdown(md) {
        let html = md;
        
        // Formatação de cabeçalhos
        html = html
            .replace(/^### (.*$)/gm, (_, text) => renderer.heading(text, 3))
            .replace(/^## (.*$)/gm, (_, text) => renderer.heading(text, 2))
            .replace(/^# (.*$)/gm, (_, text) => renderer.heading(text, 1));

        // Formatação de código - ajustada para capturar corretamente
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            return renderer.code(code, lang);
        });

        // Formatação de código inline
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Formatação de estilos de texto
        html = html
            .replace(/\*\*(.*?)\*\*/g, (_, text) => renderer.strong(text))
            .replace(/\*(.*?)\*/g, (_, text) => renderer.em(text))
            .replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Formatação de links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, (_, text, href) => renderer.link(href, null, text));

        // Melhorando a formatação de tabelas para uma captura mais precisa
        html = html.replace(/^\|(.*\|)+\r?\n\|([\-\|: ]+\|\r?\n)((?:\|.*\|\r?\n)*)/gm, function(match) {
            const rows = match.trim().split('\n');
            const headerRow = rows[0];
            const bodyRows = rows.slice(2);
            
            // Processar cabeçalho
            const headerCells = headerRow.split('|').slice(1, -1).map(cell => cell.trim());
            let header = '<tr>';
            headerCells.forEach(cell => {
                header += renderer.tablecell(cell, { header: true });
            });
            header += '</tr>';
            
            // Processar corpo
            let body = '';
            bodyRows.forEach(row => {
                if (row.match(/\|.*\|/)) { // Verifica se é uma linha válida
                    const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
                    let rowHtml = '';
                    cells.forEach(cell => {
                        rowHtml += renderer.tablecell(cell, { header: false });
                    });
                    body += renderer.tablerow(rowHtml);
                }
            });
            
            return renderer.table(header, body);
        });

        // Formatação melhorada de listas não ordenadas
        // Refatorado para processar listas aninhadas corretamente
        const processLists = (text, isOrdered = false) => {
            // Regex para capturar listas ordenadas ou não ordenadas baseado em isOrdered
            const listItemRegex = isOrdered ? /^(\s*)(\d+)\.\s+(.*$)/gm : /^(\s*)[\-\*]\s+(.*$)/gm;
            
            // Armazenar informações da lista
            const listInfo = {
                inProgress: false,
                items: [],
                indent: [],
                lastIndentLevel: -1
            };
            
            // Primeira passagem: capturar todos os itens de lista
            let match;
            const matches = [];
            const textCopy = text + '\n\n'; // Garantir que a última lista seja processada
            
            while ((match = listItemRegex.exec(textCopy)) !== null) {
                const indentation = isOrdered ? match[1].length : match[1].length;
                const content = isOrdered ? match[3] : match[2];
                matches.push({ indentation, content, original: match[0] });
            }
            
            // Se não houver itens de lista, retornar o texto original
            if (matches.length === 0) return text;
            
            // Construir a estrutura HTML da lista
            let result = text;
            
            // Processar cada item encontrado
            let currentListStart = null;
            let currentListItems = [];
            let currentIndent = -1;
            
            for (let i = 0; i < matches.length; i++) {
                const item = matches[i];
                
                // Se é o primeiro item ou começou um novo nível de indentação
                if (currentListStart === null) {
                    currentListStart = item.original;
                    currentListItems = [renderer.listitem(item.content)];
                    currentIndent = item.indentation;
                    continue;
                }
                
                // Se é o mesmo nível de indentação, adicionar ao mesmo nível
                if (item.indentation === currentIndent) {
                    currentListItems.push(renderer.listitem(item.content));
                } 
                // Se é um nível diferente, ou último item, finalizar a lista atual
                else if (item.indentation !== currentIndent || i === matches.length - 1) {
                    const listContent = currentListItems.join('');
                    const listHtml = renderer.list(listContent, isOrdered);
                    
                    // Substituir a lista completa no texto
                    const escapedStart = currentListStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const listRegex = new RegExp(escapedStart + '[\\s\\S]*?(?=\\n\\s*\\n|$)', 'g');
                    result = result.replace(listRegex, listHtml);
                    
                    // Resetar para começar uma nova lista
                    currentListStart = item.original;
                    currentListItems = [renderer.listitem(item.content)];
                    currentIndent = item.indentation;
                }
            }
            
            // Lidar com o último conjunto de itens se ainda não processado
            if (currentListItems.length > 0 && currentListStart !== null) {
                const listContent = currentListItems.join('');
                const listHtml = renderer.list(listContent, isOrdered);
                
                const escapedStart = currentListStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const listRegex = new RegExp(escapedStart + '[\\s\\S]*?(?=\\n\\s*\\n|$)', 'g');
                result = result.replace(listRegex, listHtml);
            }
            
            return result;
        };
        
        // Processar listas não ordenadas
        html = processLists(html, false);
        
        // Processar listas ordenadas
        html = processLists(html, true);

        // Formatação de citações
        html = html.replace(/^> (.*$)/gm, (_, text) => renderer.blockquote(text));

        // Adicionando quebras de linha para parágrafos, evitando quebrar elementos HTML
        const paragraphs = html.split('\n\n');
        html = paragraphs.map(p => {
            p = p.trim();
            if (!p || 
                p.startsWith('<h') || 
                p.startsWith('<ul') || 
                p.startsWith('<ol') || 
                p.startsWith('<blockquote') || 
                p.startsWith('<div class="code-container"') ||
                p.startsWith('<table')) {
                return p;
            }
            return renderer.paragraph(p);
        }).join('\n\n');

        // Corrigindo problemas com quebras de linha em tags HTML
        html = html
            .replace(/<\/h1><br>/g, '</h1>')
            .replace(/<\/h2><br>/g, '</h2>')
            .replace(/<\/h3><br>/g, '</h3>')
            .replace(/<\/li><br>/g, '</li>')
            .replace(/<\/blockquote><br>/g, '</blockquote>')
            .replace(/<\/pre><br>/g, '</pre>')
            .replace(/<br>\s*(<table>)/g, '$1')
            .replace(/(<\/table>)<br>/g, '$1');

        return html;
    }

    // Renderizar o markdown
    return parseMarkdown(text);
}
