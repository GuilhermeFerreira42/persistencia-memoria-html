
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
        
        // Formatação de blocos de código com destaque de sintaxe melhorado
        code(code, language) {
            const lang = language || 'plaintext';
            
            // Preparamos o código sem escapar o HTML aqui para poder aplicar o destaque de sintaxe
            const codeToHighlight = code.trim();
            
            // Aplicamos destaque de sintaxe manualmente
            let highlightedCode = codeToHighlight;
            
            // Escapamos o código *depois* de aplicar o destaque
            // Isso garante que o código apareça como texto simples sem marcações HTML indesejadas
            const escapedCode = escapeHTML(highlightedCode);
            
            // Aplicamos destaque de sintaxe manualmente após o escape
            // Isso significa que inserimos spans diretamente no HTML
            let finalCode = escapedCode;
            
            // Palavras-chave em várias linguagens
            const keywords = [
                'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await',
                'try', 'catch', 'finally', 'switch', 'case', 'break', 'continue',
                'public', 'private', 'protected', 'static', 'new', 'this', 'super',
                'int', 'float', 'double', 'bool', 'string', 'void', 'null', 'True', 'False',
                'elif', 'and', 'or', 'not', 'in', 'is', 'lambda', 'pass', 'raise', 'with'
            ];
            
            // Aplicar destaque às palavras-chave
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
                    <span class="language-label">${lang}</span>
                    <button class="code-copy-btn" onclick="window.copiarCodigo(this)" title="Copiar código"><i class="fas fa-copy"></i></button>
                </div>
                <pre class="code-block" data-language="${lang}"><code>${finalCode}</code></pre>
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

        // Formatação de código - capturando corretamente blocos multilinha
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

        // Formatação melhorada de tabelas
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

        // Função melhorada para processar listas
        function processLists(text, isOrdered = false) {
            const listPattern = isOrdered ? /^(\s*)(\d+)\.\s+(.*$)/gm : /^(\s*)[\-\*]\s+(.*$)/gm;
            let match;
            let lastIndent = -1;
            let listHtml = '';
            let inList = false;
            let listStack = [];
            
            // Dividir o texto em linhas para processamento
            const lines = text.split('\n');
            let result = [];
            let processingList = false;
            let currentListItems = [];
            let currentIndent = -1;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const listMatch = line.match(listPattern);
                
                if (listMatch) {
                    processingList = true;
                    const indent = isOrdered ? 
                        (listMatch[1] ? listMatch[1].length : 0) : 
                        (listMatch[1] ? listMatch[1].length : 0);
                    const content = isOrdered ? listMatch[3] : listMatch[2];
                    
                    // Novo nível de lista ou continuação do atual
                    if (indent > currentIndent) {
                        // Novo nível mais profundo
                        if (currentListItems.length > 0) {
                            // Fechamos o nível anterior e começamos um novo
                            const listType = isOrdered ? 'ol' : 'ul';
                            result.push(`<${listType}>`);
                            currentListItems.forEach(item => {
                                result.push(`<li>${item}</li>`);
                            });
                            listStack.push({ type: listType, indent: currentIndent });
                            currentListItems = [content];
                            currentIndent = indent;
                        } else {
                            // Primeira lista
                            currentListItems = [content];
                            currentIndent = indent;
                        }
                    } else if (indent === currentIndent) {
                        // Mesmo nível
                        currentListItems.push(content);
                    } else {
                        // Nível menos profundo, fechamos listas
                        const listType = isOrdered ? 'ol' : 'ul';
                        result.push(`<${listType}>`);
                        currentListItems.forEach(item => {
                            result.push(`<li>${item}</li>`);
                        });
                        result.push(`</${listType}>`);
                        
                        // Fechar listas aninhadas até o nível correto
                        while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
                            const list = listStack.pop();
                            result.push(`</${list.type}>`);
                        }
                        
                        // Iniciar nova lista no nível correto
                        currentListItems = [content];
                        currentIndent = indent;
                    }
                } else if (processingList && line.trim() === '') {
                    // Linha em branco após lista, fechamos todas as listas abertas
                    if (currentListItems.length > 0) {
                        const listType = isOrdered ? 'ol' : 'ul';
                        result.push(`<${listType}>`);
                        currentListItems.forEach(item => {
                            result.push(`<li>${item}</li>`);
                        });
                        result.push(`</${listType}>`);
                        currentListItems = [];
                    }
                    
                    // Fechar listas aninhadas
                    while (listStack.length > 0) {
                        const list = listStack.pop();
                        result.push(`</${list.type}>`);
                    }
                    
                    processingList = false;
                    currentIndent = -1;
                    result.push(line);
                } else {
                    // Não é item de lista, incluir linha normal
                    if (processingList) {
                        // Fechar listas abertas antes de continuar
                        if (currentListItems.length > 0) {
                            const listType = isOrdered ? 'ol' : 'ul';
                            result.push(`<${listType}>`);
                            currentListItems.forEach(item => {
                                result.push(`<li>${item}</li>`);
                            });
                            result.push(`</${listType}>`);
                            currentListItems = [];
                        }
                        
                        // Fechar listas aninhadas
                        while (listStack.length > 0) {
                            const list = listStack.pop();
                            result.push(`</${list.type}>`);
                        }
                        
                        processingList = false;
                        currentIndent = -1;
                    }
                    
                    result.push(line);
                }
            }
            
            // Fechar listas que ainda estão abertas no final do texto
            if (processingList) {
                if (currentListItems.length > 0) {
                    const listType = isOrdered ? 'ol' : 'ul';
                    result.push(`<${listType}>`);
                    currentListItems.forEach(item => {
                        result.push(`<li>${item}</li>`);
                    });
                    result.push(`</${listType}>`);
                }
                
                while (listStack.length > 0) {
                    const list = listStack.pop();
                    result.push(`</${list.type}>`);
                }
            }
            
            return result.join('\n');
        }
        
        // Processar listas não ordenadas e ordenadas
        html = processLists(html, false); // Não ordenadas
        html = processLists(html, true);  // Ordenadas

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
