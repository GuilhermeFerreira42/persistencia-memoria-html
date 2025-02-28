
import { escapeHTML } from './chatUtils.js';

export function iniciarChat(welcomeScreen, chatContainer, inputContainer) {
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
}

export function mostrarTelaInicial(welcomeScreen, chatContainer, inputContainer, welcomeInput, chatInput) {
    welcomeScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    inputContainer.style.display = 'none';
    welcomeInput.value = '';
    if (chatInput) chatInput.value = '';
}

export function adicionarMensagem(chatContainer, texto, tipo) {
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `message ${tipo}`;
    
    // Processamento de Markdown para mensagens do assistente
    let conteudoHtml;
    if (tipo === 'assistant') {
        // Aplicar formatação Markdown apenas nas mensagens do assistente
        conteudoHtml = formatarMensagemMarkdown(texto);
    } else {
        // Para mensagens do usuário, apenas escape HTML e quebras de linha
        conteudoHtml = `<p>${escapeHTML(texto).replace(/\n/g, '<br>')}</p>`;
    }
    
    const conteudo = `
        <div class="message-content">${conteudoHtml}</div>
        <div class="message-actions">
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            ${tipo === 'assistant' ? `
                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                    <i class="fas fa-redo"></i>
                </button>
            ` : ''}
        </div>
    `;
    
    mensagemDiv.innerHTML = conteudo;
    chatContainer.appendChild(mensagemDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Tratar elementos de código para realçar sintaxe
    if (tipo === 'assistant') {
        realcarSintaxeCodigo(mensagemDiv);
    }
}

function formatarMensagemMarkdown(texto) {
    // Aplicar formatação básica de Markdown manualmente
    let formattedText = escapeHTML(texto);
    
    // Headers
    formattedText = formattedText.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    formattedText = formattedText.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    formattedText = formattedText.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks with language specification
    formattedText = formattedText.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, function(match, language, code) {
        return `<pre class="code-block" data-language="${language}"><code>${code}</code></pre>`;
    });
    
    // Inline code
    formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Blockquotes
    formattedText = formattedText.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Lists
    formattedText = formattedText.replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>');
    formattedText = formattedText.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
    formattedText = formattedText.replace(/^(\d+)\. (.*$)/gm, '<ol><li>$2</li></ol>');
    
    // Fix nested lists creating multiple ul/ol tags
    formattedText = formattedText.replace(/<\/ul>\s*<ul>/g, '');
    formattedText = formattedText.replace(/<\/ol>\s*<ol>/g, '');
    
    // Links
    formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Line breaks
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

function realcarSintaxeCodigo(container) {
    // Função simples para adicionar classes aos elementos de código
    // Em uma implementação mais avançada, você poderia usar uma biblioteca como highlight.js
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const language = block.parentElement.dataset.language || '';
        block.classList.add(`language-${language}`);
        
        // Adicionar formatação básica de sintaxe (isso é muito simplificado)
        // Palavras-chave comuns
        const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 
                          'export', 'const', 'let', 'var', 'def', 'print', 'from', 'async', 'await'];
        
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            block.innerHTML = block.innerHTML.replace(
                regex, 
                `<span class="keyword">${keyword}</span>`
            );
        });
        
        // Strings
        block.innerHTML = block.innerHTML.replace(
            /(["'])(.*?)\1/g, 
            '<span class="string">$&</span>'
        );
        
        // Números
        block.innerHTML = block.innerHTML.replace(
            /\b(\d+)\b/g, 
            '<span class="number">$&</span>'
        );
        
        // Comentários (simplificado)
        block.innerHTML = block.innerHTML.replace(
            /(\/\/.*|#.*)/g, 
            '<span class="comment">$&</span>'
        );
    });
}

export function mostrarCarregamento(chatContainer) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading message assistant';
    loadingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}
