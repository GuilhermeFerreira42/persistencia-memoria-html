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
    chatInput.value = '';
}

export function adicionarMensagem(chatContainer, texto, tipo) {
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `message ${tipo}`;
    mensagemDiv.innerHTML = `
        <p>${escapeHTML(texto).replace(/\n/g, '<br>')}</p>
        <div class="message-actions">
            <button class="action-btn" onclick="copiarMensagem(this)">
                <i class="fas fa-copy"></i>
            </button>
            ${tipo === 'assistant' ? `
                <button class="action-btn" onclick="regenerarResposta(this)">
                    <i class="fas fa-redo"></i>
                </button>
            ` : ''}
        </div>
    `;
    chatContainer.appendChild(mensagemDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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