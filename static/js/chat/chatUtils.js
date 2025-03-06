
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
    
    // Extrair texto usando innerText para preservar formatação, mas sem tags HTML
    const codeBlock = codeContainer.querySelector('.code-block code');
    if (!codeBlock) {
        console.error('[ERRO] Bloco de código não encontrado');
        return;
    }
    
    // Pegar apenas o texto limpo sem formatação HTML
    const cleanText = codeBlock.textContent.trim();
    
    navigator.clipboard.writeText(cleanText)
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

// Expor função globalmente para o onclick
window.copiarCodigo = copiarCodigo;
