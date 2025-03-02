
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

    // Função recursiva para processar listas (ordenadas e não ordenadas)
    function processLists(lines, isOrdered = false, startIndex = 0, indent = 0) {
        const listType = isOrdered ? 'ol' : 'ul';
        let html = `<${listType}>`;
        let i = startIndex;
        
        while (i < lines.length) {
            const line = lines[i];
            
            // Padrão para identificar itens de lista com indentação
            const listPattern = isOrdered 
                ? new RegExp(`^(\\s{${indent}})\\d+\\.\\s+(.+)$`) 
                : new RegExp(`^(\\s{${indent}})[-*]\\s+(.+)$`);
            
            // Padrão para lista mais indentada (sublista)
            const sublistPattern = isOrdered 
                ? new RegExp(`^(\\s{${indent + 2,4}})\\d+\\.\\s+(.+)$`) 
                : new RegExp(`^(\\s{${indent + 2,4}})[-*]\\s+(.+)$`);
            
            const match = line.match(listPattern);
            
            if (match) {
                // É um item desta lista
                const content = match[2];
                
                // Verificar se o próximo item é uma sublista
                if (i + 1 < lines.length && lines[i + 1].match(sublistPattern)) {
                    // Começar uma sublista
                    html += `<li>${content}`;
                    
                    // Processar sublista recursivamente
                    const [sublistHtml, nextIndex] = processLists(
                        lines, 
                        lines[i + 1].trim().match(/^\d+\./) !== null, // Se começa com número, é ordenada
                        i + 1,
                        indent + 2
                    );
                    
                    html += sublistHtml + '</li>';
                    i = nextIndex; // Pular para depois da sublista
                } else {
                    // Item normal
                    html += `<li>${content}</li>`;
                    i++;
                }
            } else if (line.trim() === '') {
                // Linha em branco, ignorar
                i++;
            } else {
                // Não é parte desta lista, terminar
                break;
            }
        }
        
        html += `</${listType}>`;
        return [html, i];
    }

    // Criando um parser Markdown personalizado
    const renderer = {
        // Formatação de cabeçalhos
        heading(text, level) {
            return `<h${level}>${text}</h${level}>`;
        },
        
        // Formatação de parágrafos
        paragraph(text) {
            return `<p>${text}</p>`;
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
        
        // Formatação de listas já tratada separadamente
        
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
        
        // Formatação de blocos de código com destaque de sintaxe melhorado
        code(code, language) {
            const lang = language || 'plaintext';
            
            // Realçar a sintaxe manualmente
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False',
                'elif', 'and', 'or', 'not', 'in', 'is', 'lambda', 'pass', 'raise', 'with'
            ];
            
            // Escapar o código primeiro para evitar tags indesejadas
            let escapedCode = escapeHTML(code.trim());
            
            // Aplicar destaque depois do escape
            keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'g');
                escapedCode = escapedCode.replace(regex, `<span class="keyword">${keyword}</span>`);
            });
            
            // Destacar strings - tanto com aspas simples quanto duplas
            escapedCode = escapedCode.replace(/(&quot;|&#039;)(.*?)(\1)/g, '<span class="string">$&</span>');
            
            // Destacar números
            escapedCode = escapedCode.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="number">$&</span>');
            
            // Destacar comentários de linha única
            escapedCode = escapedCode.replace(/(\/\/.*|#.*)/g, '<span class="comment">$&</span>');
            
            return `<div class="code-container">
                <div class="code-header">
                    <span class="language-label">${lang}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${lang}"><code>${escapedCode}</code></pre>
            </div>`;
        }
    };
    
    // Parser Markdown personalizado
    function parseMarkdown(md) {
        let html = md;
        
        // Formatação de cabeçalhos
        html = html
            .replace(/^### (.*$)/gm, (_, text) => renderer.heading(text, 3))
            .replace(/^## (.*$)/gm, (_, text) => renderer.heading(text, 2))
            .replace(/^# (.*$)/gm, (_, text) => renderer.heading(text, 1));

        // Formatação de código - blocos multilinha
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

        // Processamento de tabelas
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

        // Processar listas - dividindo o texto em linhas
        const lines = html.split('\n');
        let processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Verificar se é um item de lista não ordenada
            if (line.match(/^\s*[-*]\s+/)) {
                const [listHtml, nextIndex] = processLists(lines, false, i, 0);
                processedLines.push(listHtml);
                i = nextIndex - 1; // -1 porque o loop incrementa i
            }
            // Verificar se é um item de lista ordenada
            else if (line.match(/^\s*\d+\.\s+/)) {
                const [listHtml, nextIndex] = processLists(lines, true, i, 0);
                processedLines.push(listHtml);
                i = nextIndex - 1; // -1 porque o loop incrementa i
            }
            // Linha normal
            else {
                processedLines.push(line);
            }
        }
        
        html = processedLines.join('\n');

        // Formatação de citações
        html = html.replace(/^> (.*$)/gm, (_, text) => renderer.blockquote(text));

        // Formatação de parágrafos (linhas de texto simples)
        const paragraphs = html.split('\n\n');
        html = paragraphs.map(p => {
            p = p.trim();
            if (!p || 
                p.startsWith('<h') || 
                p.startsWith('<ul') || 
                p.startsWith('<ol') || 
                p.startsWith('<blockquote') || 
                p.startsWith('<div class="code-container"') ||
                p.startsWith('<table') ||
                p.startsWith('<li') ||
                p.startsWith('</')) {
                return p;
            }
            return renderer.paragraph(p);
        }).join('\n\n');

        return html;
    }

    // Renderizar o markdown
    return parseMarkdown(text);
}
