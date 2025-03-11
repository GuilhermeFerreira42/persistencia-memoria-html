export function escapeHTML(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

// Função para aplicar melhorias de estilo aos blocos de código
export function melhorarBlocosCodigo() {
    const codeBlocks = document.querySelectorAll('pre code');

    codeBlocks.forEach(codeBlock => {
        // Verificar se o bloco de código já foi processado
        if (codeBlock.parentNode.classList.contains('code-container')) {
            return; // Ignorar se já foi processado
        }

        const language = codeBlock.className.replace('language-', '').trim();
        const code = codeBlock.innerHTML;

        // Criar elementos do container
        const codeContainer = document.createElement('div');
        codeContainer.className = 'code-container';

        const codeHeader = document.createElement('div');
        codeHeader.className = 'code-header';

        const languageLabel = document.createElement('span');
        languageLabel.className = 'language-label';
        languageLabel.textContent = language.toUpperCase();

        const copyButton = document.createElement('button');
        copyButton.className = 'code-copy-btn';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.addEventListener('click', () => {
            copiarCodigo(copyButton);
        });

        codeHeader.appendChild(languageLabel);
        codeHeader.appendChild(copyButton);

        const codeBlockDiv = document.createElement('div');
        codeBlockDiv.className = 'code-block';
        codeBlockDiv.appendChild(codeBlock);

        codeContainer.appendChild(codeHeader);
        codeContainer.appendChild(codeBlockDiv);

        // Substituir o bloco de código original pelo container
        codeBlock.parentNode.insertBefore(codeContainer, codeBlock);
        codeBlock.parentNode.removeChild(codeBlock);
    });
}

// Função para copiar código - agora exportada corretamente
export function copiarCodigo(button) {
    const codeContainer = button.closest('.code-container');
    const codeBlock = codeContainer.querySelector('.code-block code');
    const code = codeBlock.innerText; // Usa innerText para preservar indentação
    
    navigator.clipboard.writeText(code).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Restaurar o ícone original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar código:', err);
        alert('Não foi possível copiar o código. Por favor, tente novamente.');
    });
}

// Função para copiar mensagem completa - agora exportada corretamente
export function copiarMensagem(button) {
    const messageDiv = button.closest('.message');
    const content = messageDiv.querySelector('.message-content').innerText; // Também usa innerText aqui
    
    navigator.clipboard.writeText(content).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Restaurar o ícone original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar mensagem:', err);
        alert('Não foi possível copiar a mensagem. Por favor, tente novamente.');
    });
}

// Função para regenerar resposta
export function regenerarResposta(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) {
        console.error('Mensagem não encontrada');
        return;
    }

    // Limpar a resposta atual
    const responseElement = messageElement.nextElementSibling;
    if (responseElement && responseElement.classList.contains('message')) {
        responseElement.remove();
    }

    // Reenviar a mensagem original
    const messageContent = messageElement.querySelector('.message-content').textContent;
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    const chatContainer = document.querySelector('.chat-container');

    if (chatInput && sendBtn && stopBtn && chatContainer) {
        chatInput.value = messageContent;
        const submitEvent = new Event('submit');
        document.getElementById('chat-form').dispatchEvent(submitEvent);
    }
}

// Manter as funções também como métodos de window para compatibilidade com o HTML existente
window.copiarCodigo = copiarCodigo;
window.copiarMensagem = copiarMensagem;
window.regenerarResposta = regenerarResposta;
