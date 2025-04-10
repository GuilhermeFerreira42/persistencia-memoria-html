// youtubeEvents.js
// Este arquivo lidará com os eventos Socket.IO relacionados ao YouTube.

export function setupYoutubeEvents(socket) {
    // Evento para quando a mensagem do usuário é salva
    socket.on('message_saved', (data) => {
        console.log("[DEBUG] Mensagem do usuário salva:", data);
        const conversationId = window.conversaAtual?.id;
        
        if (!data.conversation_id || data.conversation_id !== conversationId) {
            console.log("[DEBUG] Ignorando evento: conversa diferente");
            return;
        }
        
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) {
            console.log("[ERRO] Chat container não encontrado");
            return;
        }

        // Remove qualquer indicador de carregamento existente
        const loadingDiv = chatContainer.querySelector('.loading');
        if (loadingDiv) loadingDiv.remove();

        console.log("[DEBUG] Adicionando mensagem do usuário ao chat");
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-content">
                <span>${data.content}</span>
            </div>
        `;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        
        console.log("[DEBUG] Mensagem do usuário adicionada com sucesso");
    });

    // Evento para resposta do processamento do YouTube
    socket.on('youtube_response', (data) => {
        console.log("[DEBUG] Recebido youtube_response:", data);
        const chatContainer = document.querySelector('.chat-container');
        const conversationId = window.conversaAtual?.id;

        if (!chatContainer) {
            console.error("[ERRO] Chat container não encontrado");
            return;
        }

        if (!conversationId) {
            console.error("[ERRO] ID da conversa atual não encontrado");
            return;
        }

        if (data.conversation_id !== conversationId) {
            console.log("[DEBUG] Ignorando resposta de outra conversa", {
                atual: conversationId,
                recebido: data.conversation_id
            });
            return;
        }

        // Remove qualquer indicador de carregamento existente
        const loadingDiv = chatContainer.querySelector('.loading');
        if (loadingDiv) {
            console.log("[DEBUG] Removendo indicador de carregamento");
            loadingDiv.remove();
        }

        // Verifica se já existe uma resposta com o mesmo message_id
        if (data.message_id) {
            const existingMessage = chatContainer.querySelector(`.message[data-message-id="${data.message_id}"]`);
            if (existingMessage) {
                console.log("[DEBUG] Resposta já existe, ignorando duplicata");
                return;
            }
        }

        // Adiciona indicador de carregamento se estiver processando
        if (data.status === 'processing') {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message loading';
            loadingDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>${data.content}</span>
                </div>
            `;
            chatContainer.appendChild(loadingDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
            return;
        }

        if (data.status === 'error') {
            console.log("[DEBUG] Exibindo mensagem de erro");
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message error';
            errorMessage.dataset.messageId = data.message_id || `error_${Date.now()}`;
            errorMessage.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data.error}</span>
                </div>
            `;
            
            chatContainer.appendChild(errorMessage);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
            
            console.log("[DEBUG] Mensagem de erro exibida");
            return;
        }

        if (data.status === 'success' && data.content) {
            console.log("[DEBUG] Exibindo resposta do YouTube");
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant youtube';
            messageDiv.dataset.messageId = data.message_id || `youtube_${Date.now()}`;
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${marked.parse(data.content)}
                </div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
            
            chatContainer.appendChild(messageDiv);
            
            // Garante que a mensagem seja visível
            setTimeout(() => {
                messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 100);

            // Notifica que uma nova mensagem foi adicionada
            const event = new CustomEvent('messageAdded', {
                detail: {
                    type: 'youtube',
                    messageId: messageDiv.dataset.messageId,
                    conversationId: data.conversation_id
                }
            });
            chatContainer.dispatchEvent(event);
            
            // Atualiza o histórico imediatamente
            updateConversationHistory();
            
            console.log("[DEBUG] Resposta do YouTube renderizada com sucesso");
        } else {
            console.log("[AVISO] Evento inválido ou sem conteúdo", data);
        }
    });

    // Função para atualizar o histórico
    function updateConversationHistory() {
        console.log("[DEBUG] Atualizando histórico na barra lateral");
        fetch('/get_conversation_history')
            .then(response => response.json())
            .then(history => {
                if (window.atualizarHistoricoConversas) {
                    window.atualizarHistoricoConversas(history);
                    console.log("[DEBUG] Histórico atualizado com sucesso");
                } else {
                    console.log("[AVISO] Função atualizarHistoricoConversas não encontrada");
                }
            })
            .catch(error => {
                console.error("[ERRO] Falha ao atualizar histórico:", error);
            });
    }

    // Listener para atualizar a barra lateral quando uma mensagem é adicionada
    document.addEventListener('messageAdded', () => {
        updateConversationHistory();
    });
} 