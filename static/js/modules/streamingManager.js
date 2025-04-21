import { socket } from '../main.js';

/**
 * Gerenciador de streaming e cache para mensagens da IA
 */
class StreamingManager {
    constructor() {
        this.streamingCache = {};
        this.activeContainers = new Map();
        this.initializeSocketListeners();
    }

    /**
     * Inicializa os listeners do Socket.IO
     */
    initializeSocketListeners() {
        if (!socket) {
            console.error('Socket.IO não está disponível');
            return;
        }

        socket.on('message_chunk', this.handleMessageChunk.bind(this));
        socket.on('response_complete', this.handleResponseComplete.bind(this));
        socket.on('stream_error', this.handleStreamError.bind(this));
    }

    /**
     * Cria ou retorna um container para uma mensagem
     */
    getMessageContainer(messageId, conversationId) {
        let container = document.getElementById(`message-${messageId}`);
        
        if (!container) {
            container = document.createElement('div');
            container.id = `message-${messageId}`;
            container.className = 'message assistant';
            container.innerHTML = '<span class="placeholder">...</span><span class="cursor"></span>';
            
            // Adicionar ao DOM
            const chatContainer = document.getElementById('chat-container');
            chatContainer.appendChild(container);
            
            // Registrar no cache
            this.activeContainers.set(messageId, container);
            
            // Inicializar cache para esta mensagem
            if (!this.streamingCache[conversationId]) {
                this.streamingCache[conversationId] = {};
            }
            this.streamingCache[conversationId][messageId] = '';
        }
        
        return container;
    }

    /**
     * Manipula chunks de mensagem recebidos
     */
    handleMessageChunk({ content, conversation_id, message_id }) {
        // Atualizar cache
        if (!this.streamingCache[conversation_id]) {
            this.streamingCache[conversation_id] = {};
        }
        this.streamingCache[conversation_id][message_id] = 
            (this.streamingCache[conversation_id][message_id] || '') + content;

        // Atualizar UI
        const container = this.getMessageContainer(message_id, conversation_id);
        const placeholder = container.querySelector('.placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        const cursor = container.querySelector('.cursor');
        if (cursor) {
            cursor.insertAdjacentText('beforebegin', content);
        }
    }

    /**
     * Manipula a conclusão da resposta
     */
    handleResponseComplete({ conversation_id, message_id, complete_response }) {
        const container = this.activeContainers.get(message_id);
        if (!container) return;

        // Remover cursor e formatar resposta
        container.querySelector('.cursor')?.remove();
        container.innerHTML = marked.parse(complete_response);
        container.innerHTML = DOMPurify.sanitize(container.innerHTML);

        // Limpar cache
        if (this.streamingCache[conversation_id]) {
            delete this.streamingCache[conversation_id][message_id];
            if (Object.keys(this.streamingCache[conversation_id]).length === 0) {
                delete this.streamingCache[conversation_id];
            }
        }

        this.activeContainers.delete(message_id);
    }

    /**
     * Manipula erros de streaming
     */
    handleStreamError({ conversation_id, message_id, error }) {
        const container = this.activeContainers.get(message_id);
        if (container) {
            container.innerHTML = `<div class="error-message">Erro: ${error}</div>`;
            this.activeContainers.delete(message_id);
        }

        // Limpar cache
        if (this.streamingCache[conversation_id]?.[message_id]) {
            delete this.streamingCache[conversation_id][message_id];
            if (Object.keys(this.streamingCache[conversation_id]).length === 0) {
                delete this.streamingCache[conversation_id];
            }
        }

        console.error(`Erro no streaming para mensagem ${message_id}:`, error);
    }

    /**
     * Restaura o estado do streaming ao mudar de chat
     */
    restoreStreamingState(conversationId) {
        const messages = this.streamingCache[conversationId] || {};
        for (const [messageId, text] of Object.entries(messages)) {
            const container = this.getMessageContainer(messageId, conversationId);
            container.innerHTML = marked.parse(text) + '<span class="cursor"></span>';
            container.innerHTML = DOMPurify.sanitize(container.innerHTML);
        }
    }
}

// Exportar instância única
export const streamingManager = new StreamingManager(); 