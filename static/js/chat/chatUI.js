import { escapeHTML } from './chatUtils.js';
import { renderMessage, renderStreamingChunk } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';

// Sistema de logging
const logger = {
    debug: (message, data = {}) => {
        console.log(`[DEBUG] ${message}`, data);
        // Enviar log para o backend
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'debug',
                message,
                data,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('[ERRO] Falha ao salvar log:', err));
    },
    error: (message, error = null) => {
        console.error(`[ERRO] ${message}`, error);
        fetch('/log-frontend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'error',
                message,
                error: error ? error.toString() : null,
                timestamp: new Date().toISOString()
            })
        }).catch(err => console.error('[ERRO] Falha ao salvar log:', err));
    }
};

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
    console.log('[DEBUG] Iniciando adição de mensagem:', {
        tipo,
        tamanhoTexto: texto?.length,
        containerExiste: !!chatContainer
    });

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

    console.log('[DEBUG] Contexto da conversa:', {
        conversationId,
        conversaAtual: window.conversaAtual
    });

    // Gerar um ID único para a mensagem
    const messageId = `${Date.now()}_${tipo}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Verificar se a mensagem já existe
    const existingMessage = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (existingMessage) {
        console.warn('[DEBUG] Mensagem duplicada detectada:', messageId);
        return;
    }
    
    console.log('[DEBUG] Criando novo elemento de mensagem:', messageId);
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `message ${tipo}`;
    mensagemDiv.dataset.messageId = messageId;
    
    // Associar ID da conversa para garantir isolamento
    if (conversationId) {
        mensagemDiv.dataset.conversationId = conversationId;
    }
    
    console.log('[DEBUG] Processando conteúdo da mensagem');
    // Processamento de Markdown para mensagens do assistente
    let conteudoHtml;
    try {
        if (tipo === 'assistant') {
            console.log('[DEBUG] Renderizando markdown para mensagem do assistente');
            conteudoHtml = renderMessage(texto);
        } else {
            console.log('[DEBUG] Processando texto simples para mensagem do usuário');
            conteudoHtml = `<p>${escapeHTML(texto).replace(/\n/g, '<br>')}</p>`;
        }
        
        console.log('[DEBUG] Conteúdo HTML gerado:', {
            tamanho: conteudoHtml.length,
            preview: conteudoHtml.substring(0, 50) + '...'
        });
    } catch (error) {
        console.error('[ERRO] Falha ao processar conteúdo da mensagem:', error);
        conteudoHtml = `<p>Erro ao processar mensagem</p>`;
    }

    // Criar estrutura da mensagem
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = conteudoHtml;

    const messageActions = document.createElement('div');
    messageActions.className = 'message-actions';
    
    // Adicionar botões de ação
    if (tipo === 'assistant') {
        messageActions.innerHTML = `
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                <i class="fas fa-redo"></i>
            </button>
        `;
    } else {
        messageActions.innerHTML = `
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
        `;
    }

    // Montar a mensagem
    mensagemDiv.appendChild(messageContent);
    mensagemDiv.appendChild(messageActions);

    console.log('[DEBUG] Adicionando mensagem ao DOM');
    // Adicionar ao DOM com animação
    mensagemDiv.style.opacity = '0';
    mensagemDiv.style.transform = 'translateY(20px)';
    chatContainer.appendChild(mensagemDiv);

    // Forçar reflow e aplicar transição
    void mensagemDiv.offsetHeight;
    
    requestAnimationFrame(() => {
        console.log('[DEBUG] Aplicando animação de entrada');
        mensagemDiv.style.opacity = '1';
        mensagemDiv.style.transform = 'translateY(0)';
        
        // Garantir que a mensagem seja visível
        requestAnimationFrame(() => {
            console.log('[DEBUG] Atualizando scroll');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    });

    console.log('[DEBUG] Mensagem adicionada com sucesso:', messageId);
    return messageId;
}

export function mostrarCarregamento(chatContainer) {
    console.log('[DEBUG] Iniciando exibição de carregamento');
    
    if (!chatContainer) {
        console.error('[ERRO] Container não encontrado para mostrar carregamento');
        return null;
    }

    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        console.warn('[AVISO] Tentando mostrar carregamento sem conversa ativa');
    }

    const loadingId = `loading_${Date.now()}`;
    console.log('[DEBUG] Criando elemento de carregamento:', loadingId);

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant loading';
    loadingDiv.dataset.messageId = loadingId;
    if (conversationId) {
        loadingDiv.dataset.conversationId = conversationId;
    }
    loadingDiv.innerHTML = '<div class="message-content"><span class="typing-animation">...</span></div>';

    // Adicionar com animação
    loadingDiv.style.opacity = '0';
    chatContainer.appendChild(loadingDiv);

    // Forçar reflow e aplicar transição
    void loadingDiv.offsetHeight;
    
    requestAnimationFrame(() => {
        console.log('[DEBUG] Aplicando animação do carregamento');
        loadingDiv.style.opacity = '1';
        
        requestAnimationFrame(() => {
            console.log('[DEBUG] Atualizando scroll após carregamento');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    });

    console.log('[DEBUG] Carregamento exibido com sucesso');
    return loadingDiv;
}

export function adicionarMensagemStreaming(chatContainer, messageId, conversationId) {
    try {
        logger.debug('Adicionando mensagem de streaming', { messageId, conversationId });
        
        const streamingMessage = document.createElement('div');
        streamingMessage.className = 'message assistant streaming-message';
        streamingMessage.dataset.messageId = messageId;
        streamingMessage.dataset.conversationId = conversationId;
        streamingMessage.innerHTML = `
            <div class="message-content">
                <div class="streaming-content">Gerando resposta...</div>
            </div>
        `;
        
        chatContainer.appendChild(streamingMessage);
        
        // Forçar reflow para garantir que a animação funcione
        void streamingMessage.offsetHeight;
        
        // Adicionar animação suave
        requestAnimationFrame(() => {
            streamingMessage.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            streamingMessage.style.opacity = '1';
            streamingMessage.style.transform = 'translateY(0)';
        });
        
        return streamingMessage;
    } catch (error) {
        logger.error('Falha ao adicionar mensagem de streaming', error);
        return null;
    }
}

export function atualizarMensagemStreaming(messageId, chunk) {
    try {
        logger.debug('Atualizando mensagem de streaming', { messageId, chunkSize: chunk?.length });
        
        const mensagemDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (!mensagemDiv) {
            logger.error('Elemento de mensagem não encontrado', { messageId });
            return;
        }
        
        const contentDiv = mensagemDiv.querySelector('.message-content');
        if (!contentDiv) {
            logger.error('Div de conteúdo não encontrada', { messageId });
            return;
        }
        
        // Renderizar o chunk
        const renderedChunk = renderStreamingChunk(chunk);
        if (!renderedChunk) {
            logger.debug('Chunk vazio ou inválido', { messageId });
            return;
        }
        
        // Atualizar o conteúdo
        contentDiv.innerHTML = renderedChunk;
        
        // Forçar reflow para garantir que a animação funcione
        void contentDiv.offsetHeight;
        
        // Adicionar animação suave
        requestAnimationFrame(() => {
            contentDiv.style.transition = 'opacity 0.2s ease';
            contentDiv.style.opacity = '1';
        });
        
        // Rolar para o final se necessário
        const chatContainer = mensagemDiv.closest('.chat-container');
        if (chatContainer && isUserAtBottom(chatContainer)) {
            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
        
        // Melhorar blocos de código após a atualização
        setTimeout(() => {
            melhorarBlocosCodigo(mensagemDiv);
        }, 100);
        
    } catch (error) {
        logger.error('Falha ao atualizar mensagem de streaming', error);
    }
}

// Função para verificar se o usuário está no final do chat
function isUserAtBottom(container) {
    const threshold = 50; // pixels de tolerância
    return container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
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

/* Estilos para streaming e fade-in */
.streaming-message {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.streaming-message.visible {
    opacity: 1;
    transform: translateY(0);
}

.streaming-message .message-content {
    opacity: 0;
    transition: opacity 0.3s ease;
}

.streaming-message .message-content.visible {
    opacity: 1;
}

/* Animação de digitação */
.typing-animation {
    display: inline-block;
    animation: typing 1s infinite;
}

@keyframes typing {
    0% { opacity: 0.2; }
    20% { opacity: 1; }
    100% { opacity: 0.2; }
}

/* Indicador de streaming */
.streaming-message::after {
    content: '';
    display: inline-block;
    width: 4px;
    height: 1em;
    background-color: var(--text-secondary);
    margin-left: 4px;
    animation: blink 1s infinite;
}

@keyframes blink {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
}
`;
document.head.appendChild(style);
