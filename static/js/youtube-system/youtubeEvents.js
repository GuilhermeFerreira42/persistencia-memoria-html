// youtubeEvents.js
// Este arquivo lidará com os eventos Socket.IO relacionados ao YouTube.

export function setupYoutubeEvents(socket) {
    socket.on('youtube_response', (data) => {
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;

        if (data.error) {
            // Adicionar mensagem de erro ao chat
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message error';
            errorMessage.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data.error}</span>
                </div>
            `;
            chatContainer.appendChild(errorMessage);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return;
        }

        if (data.content) {
            // Adicionar mensagem com o conteúdo processado ao chat
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${data.content}
                </div>
            `;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            // Melhorar a formatação do código, se houver
            const codeBlocks = messageDiv.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                hljs.highlightElement(block);
            });

            // Salvar a mensagem no backend
            if (window.conversaAtual && window.conversaAtual.id) {
                console.log(`[DEBUG] Salvando mensagem do YouTube para a conversa ${window.conversaAtual.id}`);
                fetch('/save_youtube_message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        conversation_id: window.conversaAtual.id,
                        content: data.content,
                    }),
                })
                .then(response => response.json())
                .then(result => {
                    if (result.error) {
                        console.error('Erro ao salvar mensagem:', result.error);
                    } else {
                        console.log('Mensagem salva com sucesso:', result);
                    }
                })
                .catch(error => console.error('Erro ao salvar mensagem:', error));
            } else {
                console.error('[ERRO] ID da conversa atual não disponível para salvar mensagem do YouTube');
            }
        }
    });
} 