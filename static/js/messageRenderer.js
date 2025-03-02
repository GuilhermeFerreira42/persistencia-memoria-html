
/**
 * Renderiza uma mensagem formatada com Markdown usando marked.js
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

    // Configuração do renderer personalizado para marked.js
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
            
            // Aqui NÃO escapamos o código antes de aplicar o destaque
            const codeToHighlight = code.trim();
            
            // Aplicamos destaque de sintaxe manualmente
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
            
            // Primeiro, escapamos o HTML para evitar injeção
            let finalCode = escapeHTML(highlightedCode);
            
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

    // Parser de Markdown melhorado usando um sistema mais robusto
    function parseMarkdown(md) {
        let html = md;
        
        // Processamento de blocos de código
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_, lang, code) {
            return renderer.code(code, lang);
        });
        
        // Processamento de blocos inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Formatação de cabeçalhos
        html = html
            .replace(/^### (.*$)/gm, (_, text) => renderer.heading(text, 3))
            .replace(/^## (.*$)/gm, (_, text) => renderer.heading(text, 2))
            .replace(/^# (.*$)/gm, (_, text) => renderer.heading(text, 1));
            
        // Formatação de estilos de texto
        html = html
            .replace(/\*\*(.*?)\*\*/g, (_, text) => renderer.strong(text))
            .replace(/\*(.*?)\*/g, (_, text) => renderer.em(text))
            .replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Formatação de links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, (_, text, href) => renderer.link(href, null, text));

        // Processamento melhorado de listas
        function processLists(text, isOrdered = false) {
            const listPattern = isOrdered ? /^(\d+)\.\s+(.*$)/gm : /^[\-\*]\s+(.*$)/gm;
            let result = text;
            let listMatches = [];
            let match;
            
            // Coletar todas as correspondências de lista
            while (match = listPattern.exec(text)) {
                listMatches.push({
                    fullMatch: match[0],
                    content: isOrdered ? match[2] : match[1],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
            
            // Se não encontrou nenhuma lista, retornar o texto original
            if (listMatches.length === 0) {
                return text;
            }
            
            // Agrupar itens adjacentes em listas
            let lists = [];
            let currentList = [listMatches[0]];
            
            for (let i = 1; i < listMatches.length; i++) {
                const current = listMatches[i];
                const previous = listMatches[i - 1];
                
                // Verificar se os itens são adjacentes (apenas com espaços em branco entre eles)
                const textBetween = text.substring(previous.end, current.start);
                if (textBetween.trim() === '') {
                    currentList.push(current);
                } else {
                    lists.push(currentList);
                    currentList = [current];
                }
            }
            
            // Adicionar a última lista
            lists.push(currentList);
            
            // Substituir cada lista no texto
            let offset = 0;
            
            lists.forEach(list => {
                const listItems = list.map(item => renderer.listitem(item.content)).join('');
                const htmlList = renderer.list(listItems, isOrdered);
                
                // Calcular novos índices com o deslocamento
                const startIndex = list[0].start + offset;
                const endIndex = list[list.length - 1].end + offset;
                
                // Substituir a lista por HTML
                const before = result.substring(0, startIndex);
                const after = result.substring(endIndex);
                result = before + htmlList + after;
                
                // Ajustar o deslocamento para as próximas substituições
                offset += htmlList.length - (endIndex - startIndex);
            });
            
            return result;
        }
        
        // Processar listas não ordenadas e ordenadas
        html = processLists(html, false); // Não ordenadas
        html = processLists(html, true);  // Ordenadas

        // Formatação de tabelas (manter o processamento existente)
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

        // Formatação de citações
        html = html.replace(/^> (.*$)/gm, (_, text) => renderer.blockquote(text));

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
                p.startsWith('<li') ||
                p.startsWith('</')) {
                return p;
            }
            // Substitui quebras de linha simples por <br>
            return renderer.paragraph(p.replace(/\n/g, '<br>'));
        }).join('\n\n');

        return html;
    }

    // Renderizar o markdown
    return parseMarkdown(text);
}
