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

        console.log("[DEBUG] Adicionando mensagem do usuário ao chat");
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="message-content">
                <span>${data.content}</span>
            </div>
        `;
        
        // Adiciona a mensagem com animação
        messageDiv.style.opacity = '0';
        chatContainer.appendChild(messageDiv);
        
        // Força o reflow para a animação funcionar
        messageDiv.offsetHeight;
        
        // Inicia a animação
        messageDiv.style.transition = 'opacity 0.3s ease-in-out';
        messageDiv.style.opacity = '1';
        
        // Rola para a nova mensagem
        requestAnimationFrame(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
        
        console.log("[DEBUG] Mensagem do usuário adicionada com sucesso");
    });

    // Evento para resposta do processamento do YouTube
    socket.on('youtube_response', (data) => {
        console.log("[DEBUG] Recebido youtube_response:", data);
        const chatContainer = document.querySelector('.chat-container');
        const conversationId = window.conversaAtual?.id;

        if (!chatContainer || !conversationId || data.conversation_id !== conversationId) {
            console.log("[DEBUG] Ignorando evento: chat container não encontrado ou conversa diferente");
            return;
        }

        if (data.status === 'error') {
            console.log("[DEBUG] Exibindo mensagem de erro");
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message error';
            errorMessage.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data.error}</span>
                </div>
            `;
            
            // Adiciona a mensagem de erro com animação
            errorMessage.style.opacity = '0';
            chatContainer.appendChild(errorMessage);
            errorMessage.offsetHeight;
            errorMessage.style.transition = 'opacity 0.3s ease-in-out';
            errorMessage.style.opacity = '1';
            
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
            
            console.log("[DEBUG] Mensagem de erro exibida");
            return;
        }

        if (data.status === 'success' && data.content) {
            console.log("[DEBUG] Exibindo resposta do YouTube");
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant youtube';
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${marked.parse(data.content)}
                </div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            `;
            
            // Adiciona a mensagem com animação
            messageDiv.style.opacity = '0';
            chatContainer.appendChild(messageDiv);
            
            // Força o reflow e inicia a animação
            messageDiv.offsetHeight;
            messageDiv.style.transition = 'all 0.3s ease-in-out';
            messageDiv.style.opacity = '1';
            
            // Força a atualização do DOM e rola para a nova mensagem
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // Destaca a nova mensagem brevemente
                messageDiv.style.animation = 'highlightMessage 1s ease-in-out';
                setTimeout(() => {
                    messageDiv.style.animation = '';
                }, 1000);
            });

            // Notifica que uma nova mensagem foi adicionada
            chatContainer.dispatchEvent(new Event('messageAdded'));
            
            console.log("[DEBUG] Resposta do YouTube renderizada com sucesso");
        } else {
            console.log("[DEBUG] Evento inválido ou sem conteúdo");
        }
    });

    // Listener para atualizar a barra lateral quando uma mensagem é adicionada
    document.addEventListener('messageAdded', () => {
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
    });
} 