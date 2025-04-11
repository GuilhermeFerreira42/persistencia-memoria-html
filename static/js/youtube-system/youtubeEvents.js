// youtubeEvents.js
// Este arquivo lidará com os eventos Socket.IO relacionados ao YouTube.

let isProcessingYoutube = false;

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
        const loadingDivs = chatContainer.querySelectorAll('.loading');
        loadingDivs.forEach(div => div.remove());

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

        if (!chatContainer || !conversationId || data.conversation_id !== conversationId) {
            console.log("[DEBUG] Ignorando resposta: container não encontrado ou conversa diferente");
            return;
        }

        // Remove todos os indicadores de carregamento existentes
        const loadingDivs = chatContainer.querySelectorAll('.loading');
        loadingDivs.forEach(div => {
            console.log("[DEBUG] Removendo indicador de carregamento");
            div.remove();
        });

        // Reseta o estado de processamento
        isProcessingYoutube = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = false;

        // Verifica se já existe uma resposta com o mesmo message_id
        if (data.message_id) {
            const existingMessage = chatContainer.querySelector(`.message[data-message-id="${data.message_id}"]`);
            if (existingMessage) {
                console.log("[DEBUG] Resposta já existe, ignorando duplicata");
                return;
            }
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
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });

            // Notifica que uma nova mensagem foi adicionada
            const event = new CustomEvent('messageAdded', {
                detail: {
                    type: 'youtube',
                    messageId: messageDiv.dataset.messageId,
                    conversationId: data.conversation_id
                }
            });
            chatContainer.dispatchEvent(event);
            
            console.log("[DEBUG] Resposta do YouTube renderizada com sucesso");
        }
    });
}

export function handleYoutubeCommand(command, socket) {
    if (isProcessingYoutube) {
        console.log('[DEBUG] Já existe um processamento de YouTube em andamento');
        return;
    }

    console.log('[DEBUG] Processando comando do YouTube:', command);
    
    // Verificar se a mensagem já existe
    const existingMessage = document.querySelector(`.message[data-message-id="${command.message_id}"]`);
    if (existingMessage) {
        console.log('[DEBUG] Mensagem já existe, ignorando');
        return;
    }
    
    // Ativar estado de processamento
    isProcessingYoutube = true;
    const sendBtn = document.querySelector('#send-btn');
    if (sendBtn) sendBtn.disabled = true;
    
    // Adicionar animação de carregamento
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message loading';
        loadingDiv.innerHTML = `
            <div class="message-content">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Processando vídeo do YouTube...</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(loadingDiv);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    }
    
    // Enviar comando para o servidor
    socket.emit('youtube_command', command);
} 