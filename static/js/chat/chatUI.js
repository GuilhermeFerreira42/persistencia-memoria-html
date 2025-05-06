import { escapeHTML } from './chatUtils.js';
import { renderMessage, renderMessageChunk, messageRegistry } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';
import { logger } from '../utils/logger.js';

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
    
    // Verificar novamente se o chatContainer existe antes de adicionar a mensagem
    if (!chatContainer) {
        console.error('[ERRO] Container de chat se tornou null durante o processamento da mensagem');
        return messageId;
    }
    
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
    loadingDiv.setAttribute('data-no-markdown', 'true');
    if (conversationId) {
        loadingDiv.dataset.conversationId = conversationId;
    }
    loadingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;

    // Adicionar com animação
    loadingDiv.style.opacity = '0';
    
    // Verificar novamente se o chatContainer existe antes de adicionar o carregamento
    if (!chatContainer) {
        console.error('[ERRO] Container de chat se tornou null durante a criação do carregamento');
        return null;
    }
    
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
    logger.debug('Iniciando mensagem de streaming', { messageId, conversationId });

    if (!chatContainer) {
        logger.error('Container de chat não encontrado');
        return null;
    }
    
    // Verificar se já existe um container com este ID
    let existingContainer = document.querySelector(`[data-message-id="${messageId}"]`);
    if (existingContainer) {
        logger.debug('Container com mesmo ID já existe, reutilizando', { messageId });
        return existingContainer;
    }

    // Verificar se já existe uma mensagem completa recente desta conversa
    const existingCompleteMessages = document.querySelectorAll(`.message.assistant.complete[data-conversation-id="${conversationId}"], .message.assistant:not(.streaming)[data-conversation-id="${conversationId}"]`);
    if (existingCompleteMessages.length > 0) {
        const lastMessage = existingCompleteMessages[existingCompleteMessages.length - 1];
        const lastCompletedAt = parseInt(lastMessage.dataset.completedAt || '0', 10);
        const now = Date.now();
        
        // Se a mensagem foi completada nos últimos 2 segundos
        if (now - lastCompletedAt < 2000) {
            logger.warn('Mensagem completa recente detectada, evitando criar nova mensagem de streaming', {
                messageId,
                existingId: lastMessage.dataset.messageId,
                age: now - lastCompletedAt + 'ms'
            });
            return lastMessage;
        }
    }

    // Verificar se já existe uma mensagem com este ID no registry
    const entry = messageRegistry.messages.get(messageId);
    if (entry && document.body.contains(entry.container)) {
        logger.debug('Mensagem já existe no registry, reutilizando container', { messageId });
        return entry.container;
    }

    // Criar novo container de mensagem
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = 'message assistant streaming fade-in';
    mensagemDiv.dataset.messageId = messageId;
    mensagemDiv.dataset.conversationId = conversationId;
    mensagemDiv.dataset.createdAt = Date.now().toString();
    
    // Estrutura interna da mensagem
    mensagemDiv.innerHTML = `
        <div class="message-content"></div>
        <div class="message-actions">
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                <i class="fas fa-redo"></i>
            </button>
        </div>
    `;

    chatContainer.appendChild(mensagemDiv);
    
    // Registrar no messageRegistry
    messageRegistry.registerMessage(messageId, {
        conversationId,
        content: '',
        container: mensagemDiv,
        created: Date.now()
    });
    
    // Forçar reflow e aplicar transição
    void mensagemDiv.offsetHeight;
    mensagemDiv.classList.add('visible');

    logger.debug('Mensagem de streaming criada com sucesso', {
        messageId,
        conversationId,
        timestamp: Date.now()
    });

    return mensagemDiv;
}

export function atualizarMensagemStreaming(messageId, chunk, renderMarkdown = true) {
    console.log('[DEBUG] Atualizando mensagem em streaming:', {
        messageId,
        chunkSize: chunk?.length,
        useMarkdown: renderMarkdown
    });
    
    if (!messageId || !chunk) {
        console.error('[ERRO] ID de mensagem ou chunk inválido');
        return false;
    }
    
    // Obter conversa atual
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        console.warn('[AVISO] Tentando atualizar streaming sem conversa ativa');
        return false;
    }
    
    // Verificar se a mensagem existe
    const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (!messageDiv) {
        console.error('[ERRO] Mensagem não encontrada para atualização:', messageId);
        return false;
    }
    
    // Verificar se pertence à conversa atual
    const messageConversationId = messageDiv.dataset.conversationId;
    if (messageConversationId && messageConversationId !== conversationId) {
        console.warn('[AVISO] Tentativa de atualizar mensagem de outra conversa', {
            messageConversationId,
            currentConversationId: conversationId
        });
        return false;
    }
    
    try {
        // Obter container de conteúdo
        const messageContent = messageDiv.querySelector('.message-content');
        if (!messageContent) {
            console.error('[ERRO] Container de conteúdo não encontrado');
            return false;
        }
        
        // Acumular conteúdo no registro
        const entry = messageRegistry.messages.get(messageId);
        if (!entry) {
            // Registrar no messageRegistry se ainda não estiver lá
            messageRegistry.registerMessage(messageId, {
                conversationId,
                content: chunk,
                container: messageDiv
            });
        } else {
            // Adicionar o novo chunk
            messageRegistry.addChunk(messageId, chunk);
        }
        
        // Obter conteúdo acumulado
        const newContent = messageRegistry.messages.get(messageId)?.content || '';
        
        // Renderizar com Markdown se necessário
        if (renderMarkdown) {
            // Usar diretamente renderMessageChunk para atualizar o conteúdo
            renderMessageChunk(messageId, chunk, conversationId);
        } else {
            // Atualização simples sem Markdown
            messageContent.textContent += chunk;
        }
        
        // Verificar scroll
        updateStreamingScroll(messageDiv);
        
        return true;
    } catch (error) {
        console.error('[ERRO] Falha ao atualizar mensagem streaming:', error);
        return false;
    }
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

function scrollToBottom() {
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) {
        scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

function updateStreamingMessage(messageId, content) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) {
        console.error(`Elemento de mensagem não encontrado para ID: ${messageId}`);
        return;
    }

    const contentElement = messageElement.querySelector('.message-content');
    if (contentElement) {
        contentElement.innerHTML = content;
        scrollToBottom();
    }
}

// Função para gerenciar o scroll durante o streaming
export function updateStreamingScroll(messageElement) {
    if (!messageElement) return;
    
    // Verificar se o container de chat existe
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;
    
    // Calcular se o usuário está próximo do final
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    
    // Se estiver próximo do final (200px), scroll automático
    if (distanceToBottom < 200) {
        // Usar scrollIntoView para scroll suave
        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'end'
        });
        
        // Log para debug
        logger.debug('Rolagem automática aplicada', {
            messageId: messageElement.dataset?.messageId,
            distanceToBottom
        });
    } else {
        // Se o usuário está longe do final, podemos mostrar um indicador
        // de novas mensagens que o usuário pode clicar para rolar
        logger.debug('Usuário está longe do final, não rolando automaticamente', {
            distanceToBottom
        });
    }
}
