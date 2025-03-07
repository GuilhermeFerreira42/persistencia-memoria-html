
export function escapeHTML(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

export function copiarMensagem(button) {
    console.log('[DEBUG] Copiando mensagem...');
    const mensagem = button.closest('.message').querySelector('.message-content').innerText; // Usando innerText para preservar formatação
    navigator.clipboard.writeText(mensagem)
        .then(() => {
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
                button.classList.remove('copied');
            }, 2000);
        })
        .catch(err => {
            console.error('[ERRO] Falha ao copiar mensagem:', err);
            alert('Não foi possível copiar a mensagem. Por favor, tente novamente.');
        });
}

export function regenerarResposta(button) {
    console.log('[DEBUG] Regenerando resposta...');
    const mensagemOriginal = button.closest('.message').previousElementSibling;
    if (!mensagemOriginal) {
        console.error('Mensagem original não encontrada');
        return;
    }

    const texto = mensagemOriginal.querySelector('.message-content').textContent;
    const chatInput = document.getElementById('chat-input');
    const chatForm = document.getElementById('chat-form');

    if (chatInput && chatForm) {
        chatInput.value = texto;
        chatForm.dispatchEvent(new Event('submit'));
    } else {
        console.error('Elementos do formulário não encontrados');
    }
}

export function copiarCodigo(button) {
    console.log('[DEBUG] Copiando código...');
    const codeContainer = button.closest('.code-container');
    if (!codeContainer) {
        console.error('[ERRO] Container de código não encontrado');
        return;
    }
    
    const codeBlock = codeContainer.querySelector('.code-block code');
    if (!codeBlock) {
        console.error('[ERRO] Bloco de código não encontrado');
        return;
    }
    
    const code = codeBlock.innerText
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    
    navigator.clipboard.writeText(code)
        .then(() => {
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
                button.classList.remove('copied');
            }, 2000);
        })
        .catch(err => {
            console.error('[ERRO] Falha ao copiar código:', err);
            alert('Não foi possível copiar o código. Por favor, tente novamente.');
        });
}

/**
 * Adiciona barras de títulos e botões de copiar aos blocos de código
 */
export function melhorarBlocosCodigo() {
    console.log('[DEBUG] Melhorando blocos de código...');
    const temaAtual = document.documentElement.getAttribute('data-theme');
    console.log('[DEBUG] Tema atual:', temaAtual);
    
    document.querySelectorAll('pre code').forEach((block) => {
        // Evitar duplicação se já tiver sido processado
        if (block.parentElement.parentElement.classList.contains('code-container')) {
            return;
        }

        // Extrair a linguagem da classe com case-insensitive
        console.log('[DEBUG] Classes do bloco:', block.className);
        const langMatch = block.className.match(/language-(\w+)/i);
        let language = langMatch ? langMatch[1] : 'código';
        
        // Capitalizar apenas a primeira letra para exibição mais elegante
        language = language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
        console.log('[DEBUG] Linguagem detectada:', language);

        // Criar container principal
        const container = document.createElement('div');
        container.className = 'code-container';

        // Criar barra de título com botão de copiar
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `
            <span class="language-label">${language}</span>
            <button class="code-copy-btn" title="Copiar código">
                <i class="fas fa-copy"></i>
            </button>
        `;

        // Adicionar manipulador de eventos para o botão de copiar
        const copyBtn = header.querySelector('.code-copy-btn');
        copyBtn.addEventListener('click', function() {
            copiarCodigo(this);
        });

        // Reorganizar a estrutura do DOM
        const pre = block.parentElement;
        pre.classList.add('code-block');
        
        // Inserir elementos na DOM
        const parent = pre.parentElement;
        parent.insertBefore(container, pre);
        container.appendChild(header);
        container.appendChild(pre);
        
        // Reaplicar o highlight para garantir que o destaque de sintaxe seja mantido
        hljs.highlightElement(block);
    });
}

// Expor função globalmente para o onclick
window.copiarCodigo = copiarCodigo;
window.melhorarBlocosCodigo = melhorarBlocosCodigo;
