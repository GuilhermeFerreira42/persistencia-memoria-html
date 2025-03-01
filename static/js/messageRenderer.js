
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
        
        // Formatação de tabelas - melhorada para capturar tabelas completas
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
        
        // Formatação de blocos de código - ajustada para realce de sintaxe mais robusto
        code(code, language) {
            const lang = language || 'plaintext';
            const escapedCode = escapeHTML(code.trim());
            
            // Aplicando realce de sintaxe básico
            let highlightedCode = escapedCode;
            
            // Palavras-chave comuns em várias linguagens
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False',
                'elif', 'except', 'raise', 'pass', 'lambda', 'with', 'as', 'and', 'or', 'not', 'in', 'is'
            ];
            
            // Estilizar palavras-chave - usando delimitadores de palavras para evitar matches parciais
            keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                highlightedCode = highlightedCode.replace(regex, `<span class="keyword">${keyword}</span>`);
            });
            
            // Estilizar strings - melhorado para capturar strings multilinha
            highlightedCode = highlightedCode.replace(/(["'])((?:\\.|[^\\])*?)\1/g, '<span class="string">$&</span>');
            
            // Estilizar strings de tripla aspas (Python)
            highlightedCode = highlightedCode.replace(/("""|''')((?:\\.|[^\\])*?)\1/g, '<span class="string">$&</span>');
            
            // Estilizar números
            highlightedCode = highlightedCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
            
            // Estilizar comentários (simplificado)
            highlightedCode = highlightedCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
            
            // Comentários multilinhas (para C, Java, etc)
            highlightedCode = highlightedCode.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>');
            
            return `<div class="code-container">
                <div class="code-header">
                    <span class="language-label">${lang}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${lang}"><code>${highlightedCode}</code></pre>
            </div>`;
        }
    };

    // Implementação simples de marked sem a biblioteca
    function parseMarkdown(md) {
        let html = md;
        
        // Formatação de cabeçalhos
        html = html
            .replace(/^### (.*$)/gm, (_, text) => renderer.heading(text, 3))
            .replace(/^## (.*$)/gm, (_, text) => renderer.heading(text, 2))
            .replace(/^# (.*$)/gm, (_, text) => renderer.heading(text, 1));

        // Formatação de código - melhorada para capturar blocos multilinha corretamente
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

        // Formatação de tabelas - regex melhorada para capturar tabelas corretamente
        html = html.replace(/^\|(.*\|)+\r?\n\|([\-\|\: ]*\|)+\r?\n((\|.*\|+\r?\n)+)/gm, function(match) {
            const rows = match.trim().split('\n');
            const headerRow = rows[0];
            const bodyRows = rows.slice(2);
            
            // Processar cabeçalho
            const headerCells = headerRow.split('|').filter(cell => cell.trim()).map(cell => cell.trim());
            let header = '<tr>';
            headerCells.forEach(cell => {
                header += renderer.tablecell(cell, { header: true });
            });
            header += '</tr>';
            
            // Processar corpo
            let body = '';
            bodyRows.forEach(row => {
                if (row.match(/\|.*\|/)) {
                    const cells = row.split('|').filter(cell => cell.trim()).map(cell => cell.trim());
                    let rowHtml = '<tr>';
                    cells.forEach(cell => {
                        rowHtml += renderer.tablecell(cell, { header: false });
                    });
                    rowHtml += '</tr>';
                    body += rowHtml;
                }
            });
            
            return renderer.table(header, body);
        });

        // Processamento de listas - código reescrito para evitar placeholders
        // Listas não ordenadas
        const ulPattern = /^\s*[\-\*] (.*$)/gm;
        let match;
        let lastIndex = 0;
        let result = '';
        let listItems = [];
        let inList = false;
        
        while ((match = ulPattern.exec(html)) !== null) {
            if (!inList) {
                result += html.substring(lastIndex, match.index);
                inList = true;
                listItems = [];
            }
            
            listItems.push(renderer.listitem(match[1]));
            lastIndex = match.index + match[0].length;
            
            // Verifica se o próximo item não é uma lista
            const nextLineStart = html.indexOf('\n', lastIndex) + 1;
            const nextLine = html.substring(nextLineStart, html.indexOf('\n', nextLineStart) > -1 ? html.indexOf('\n', nextLineStart) : html.length);
            
            if (!nextLine.match(/^\s*[\-\*] /)) {
                result += renderer.list(listItems.join(''), false);
                inList = false;
            }
        }
        
        // Adicionar o restante do texto
        if (lastIndex < html.length) {
            result += html.substring(lastIndex);
        } else if (inList) {
            result += renderer.list(listItems.join(''), false);
        }
        
        if (result) {
            html = result;
        }
        
        // Tratamento similar para listas ordenadas
        const olPattern = /^\s*(\d+)\. (.*)$/gm;
        lastIndex = 0;
        result = '';
        listItems = [];
        inList = false;
        
        while ((match = olPattern.exec(html)) !== null) {
            if (!inList) {
                result += html.substring(lastIndex, match.index);
                inList = true;
                listItems = [];
            }
            
            listItems.push(renderer.listitem(match[2]));
            lastIndex = match.index + match[0].length;
            
            // Verifica se o próximo item não é uma lista
            const nextLineStart = html.indexOf('\n', lastIndex) + 1;
            const nextLine = html.substring(nextLineStart, html.indexOf('\n', nextLineStart) > -1 ? html.indexOf('\n', nextLineStart) : html.length);
            
            if (!nextLine.match(/^\s*\d+\. /)) {
                result += renderer.list(listItems.join(''), true);
                inList = false;
            }
        }
        
        // Adicionar o restante do texto
        if (lastIndex < html.length) {
            result += html.substring(lastIndex);
        } else if (inList) {
            result += renderer.list(listItems.join(''), true);
        }
        
        if (result) {
            html = result;
        }

        // Formatação de citações
        html = html.replace(/^\> (.*$)/gm, (_, text) => renderer.blockquote(text));

        // Adicionando quebras de linha para parágrafos
        const paragraphs = html.split('\n\n');
        html = paragraphs.map(p => {
            if (!p.trim() || 
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
