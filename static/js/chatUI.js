import { escapeHTML } from './chat/chatUtils.js';
import { renderMarkdown, renderMessageContainer, setCurrentConversation } from './messageRenderer.js';
import { melhorarBlocosCodigo } from './chat/chatUtils.js';
import { streamingManager } from './modules/streamingManager.js';

export function iniciarChat(welcomeScreen, chatContainer, inputContainer) {
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
    
    // Verificar se há uma conversa carregada na estrutura global
    const conversationId = window.conversaAtual?.id;
    if (conversationId && window.conversations && window.conversations[conversationId]) {
        // Definir a conversa atual no renderizador de mensagens
        setCurrentConversation(conversationId);
    } else {
        // Limpar a referência da conversa atual
        setCurrentConversation(null);
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
    setCurrentConversation(null);
    
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
    
    // Usar a nova função de renderização com containers individuais
    renderMessageContainer({
        content: texto,
        conversationId,
        role: tipo,
        messageId,
        isStreaming: false
    });
}

// Adicionando uma nova função para lidar com chunks de streaming
export function atualizarMensagemStreaming(messageId, chunk, conversationId) {
    // Verificar se há uma conversa ativa
    if (!conversationId) {
        console.warn('[AVISO] Tentando atualizar mensagem sem conversa ativa');
        return;
    }
    
    // Obter a mensagem existente do DOM
    const messageDiv = document.getElementById(`message-${messageId}`);
    
    // Se a mensagem não existir, criar uma nova
    if (!messageDiv) {
        return renderMessageContainer({
            content: chunk,
            conversationId,
            role: 'assistant',
            messageId,
            isStreaming: true
        });
    }
    
    // Se a mensagem existir, atualizar seu conteúdo
    const contentDiv = messageDiv.querySelector('.message-content');
    if (contentDiv) {
        const renderedChunk = renderMarkdown(chunk);
        contentDiv.innerHTML = renderedChunk;
    }
}

export function mostrarCarregamento(chatContainer) {
    // Verificar se o contêiner de chat existe
    if (!chatContainer) {
        console.error('[ERRO] Contêiner de chat não encontrado ao mostrar carregamento');
        return document.createElement('div'); // Retorna um div vazio como fallback
    }
    
    const loadingId = `loading_${Date.now()}`;
    
    // Associar ID da conversa para garantir isolamento
    const conversationId = window.conversaAtual?.id;
    
    // Criar o indicador de carregamento como uma mensagem com ID único
    return renderMessageContainer({
        content: `<div class="loading-indicator"><span></span><span></span><span></span></div>`,
        conversationId,
        role: 'assistant',
        messageId: loadingId,
        isStreaming: false
    });
}

// Handler para processar chunks de mensagem recebidos via Socket.IO
export function handleMessageChunk(data) {
    const { content, conversation_id: conversationId, message_id: messageId, role } = data;
    
    // Verificar se esta mensagem corresponde à conversa ativa
    if (conversationId !== window.conversaAtual?.id) {
        return;
    }
    
    // ID da mensagem (usar o fornecido ou gerar um novo)
    const uniqueMessageId = messageId || `msg_${Date.now()}`;
    
    // Renderizar ou atualizar o container da mensagem
    renderMessageContainer({
        content,
        conversationId,
        role: role || 'assistant',
        messageId: uniqueMessageId,
        isStreaming: true
    });
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

.fade-in {
    animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
`;
document.head.appendChild(style);

class ChatUI {
    constructor() {
        this.currentConversationId = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Verificar se os elementos existem antes de adicionar listeners
        const sendButton = document.getElementById('send-btn');
        const messageInput = document.getElementById('chat-input');
        
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Listener para mudança de conversa
        document.addEventListener('conversation-selected', (e) => {
            this.handleConversationChange(e.detail.conversationId);
        });
    }

    async sendMessage() {
        const messageInput = document.getElementById('chat-input');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        // Limpar input
        messageInput.value = '';
        
        try {
            // Adicionar mensagem do usuário ao chat
            this.appendUserMessage(message);
            
            // Enviar mensagem para o backend
            const response = await fetch('/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    conversation_id: this.currentConversationId
                })
            });
            
            if (!response.ok) {
                throw new Error('Falha ao enviar mensagem');
            }
            
            // O streaming será gerenciado pelo StreamingManager
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            this.showError('Erro ao enviar mensagem. Por favor, tente novamente.');
        }
    }

    appendUserMessage(message) {
        const chatContainer = document.getElementById('chat-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `<p>${this.escapeHtml(message)}</p>`;
        chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    handleConversationChange(conversationId) {
        this.currentConversationId = conversationId;
        
        // Limpar chat atual
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '';
        
        if (conversationId) {
            // Carregar histórico da conversa
            this.loadConversationHistory(conversationId);
            // Restaurar estado do streaming, se houver
            streamingManager.restoreStreamingState(conversationId);
        }
    }

    async loadConversationHistory(conversationId) {
        try {
            const response = await fetch(`/get_conversation/${conversationId}`);
            if (!response.ok) {
                throw new Error('Falha ao carregar histórico');
            }
            
            const conversation = await response.json();
            this.displayConversationHistory(conversation.messages);
            
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            this.showError('Erro ao carregar histórico da conversa.');
        }
    }

    displayConversationHistory(messages) {
        const chatContainer = document.getElementById('chat-container');
        
        messages.forEach(message => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;
            
            if (message.role === 'assistant') {
                messageDiv.innerHTML = marked.parse(message.content);
                messageDiv.innerHTML = DOMPurify.sanitize(messageDiv.innerHTML);
            } else {
                messageDiv.innerHTML = `<p>${this.escapeHtml(message.content)}</p>`;
            }
            
            chatContainer.appendChild(messageDiv);
        });
        
        this.scrollToBottom();
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.getElementById('chat-container').appendChild(errorDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Exportar instância única
export const chatUI = new ChatUI();
