import { escapeHTML } from './chat/chatUtils.js';
import { renderMessage } from './messageRenderer.js';
import { melhorarBlocosCodigo } from './chat/chatUtils.js';

export function iniciarChat(welcomeScreen, chatContainer, inputContainer) {
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
    
    // Verificar se há uma conversa carregada na estrutura global
    const conversationId = window.conversaAtual?.id;
    if (conversationId && window.conversations && window.conversations[conversationId]) {
        // console.log(`[DEBUG] Iniciando chat para conversa: ${conversationId}`);
    } else {
        // console.log('[DEBUG] Iniciando chat sem conversa ativa');
    }
}

export function mostrarTelaInicial(welcomeScreen, chatContainer, inputContainer, welcomeInput, chatInput) {
    welcomeScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    inputContainer.style.display = 'none';
    welcomeInput.value = '';
    if (chatInput) chatInput.value = '';
    
    // Limpar referência da conversa atual para evitar mistura de contextos
    window.conversaAtual = null;
    // console.log('[DEBUG] Retornando para tela inicial, conversa atual limpa');
    
    // Remover qualquer listener de scroll
    if (chatContainer._scrollListener) {
        chatContainer.removeEventListener('scroll', chatContainer._scrollListener);
        chatContainer._scrollListener = null;
    }
}

export function adicionarMensagem(chatContainer, texto, tipo) {
    // Verificar se o contêiner de chat existe
    if (!chatContainer) {
        console.error('[ERRO] Contêiner de chat não encontrado ao adicionar mensagem');
        return;
    }
    
    // Verificar se há uma conversa ativa
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        console.warn('[AVISO] Tentando adicionar mensagem sem conversa ativa');
    }

    // Gerar um ID único para a mensagem - evitando caracteres especiais
    const messageId = `${Date.now()}_${tipo}`;
    
    // Verificar se a mensagem já existe
    if (document.querySelector(`.message[data-message-id="${messageId}"]`)) {
        console.log(`[DEBUG] Mensagem ${messageId} já existe, ignorando duplicata`);
        return;
    }
    
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `message ${tipo}`;
    mensagemDiv.dataset.messageId = messageId;
    
    // Associar ID da conversa para garantir isolamento
    if (conversationId) {
        mensagemDiv.dataset.conversationId = conversationId;
    }
    
    // Processamento de Markdown para mensagens do assistente
    let conteudoHtml;
    if (tipo === 'assistant') {
        conteudoHtml = renderMessage(texto);
    } else {
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
    
    // Melhorar os blocos de código imediatamente após adicionar a mensagem
    if (tipo === 'assistant') {
        setTimeout(() => {
            // console.log('[DEBUG] Aplicando melhorias aos blocos de código...');
            melhorarBlocosCodigo();
        }, 0);
    }
}

export function mostrarCarregamento(chatContainer) {
    // Verificar se o contêiner de chat existe
    if (!chatContainer) {
        console.error('[ERRO] Contêiner de chat não encontrado ao mostrar carregamento');
        return document.createElement('div'); // Retorna um div vazio como fallback
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading message assistant';
    
    // Associar ID da conversa para garantir isolamento
    const conversationId = window.conversaAtual?.id;
    if (conversationId) {
        loadingDiv.dataset.conversationId = conversationId;
        // console.log(`[DEBUG] Mostrando carregamento para conversa: ${conversationId}`);
    } else {
        console.warn('[AVISO] Mostrando carregamento sem conversa ativa');
    }
    
    loadingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}

// Adicionar CSS para os novos elementos
const style = document.createElement('style');
style.textContent = `
.loading-indicator {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
}

.error-message {
    padding: 1rem;
    text-align: center;
    color: var(--error);
    font-weight: bold;
}

.empty-message {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
}
`;
document.head.appendChild(style);
