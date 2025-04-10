// youtubeHandler.js
// Este arquivo lidará com o envio do comando /youtube ao backend.

export async function handleYoutubeCommand(command, conversationId) {
    console.log('[DEBUG] Iniciando processamento do comando do YouTube');
    
    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        throw new Error('URL do vídeo não fornecida');
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com')) {
        throw new Error('URL inválida. Use um link do YouTube válido.');
    }

    console.log(`[DEBUG] Enviando requisição para processar vídeo: ${videoUrl}`);
    
    try {
        // Enviar requisição para processar o vídeo
        const response = await fetch('/process_youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                video_url: videoUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao processar vídeo');
        }

        const data = await response.json();
        console.log('[DEBUG] Processamento iniciado:', data.status);
        
        // Entrar na sala da conversa para receber eventos
        if (window.socket) {
            window.socket.emit('join_conversation', { conversation_id: conversationId });
            console.log(`[DEBUG] Entrou na sala da conversa: ${conversationId}`);
        } else {
            console.error('[ERRO] Socket não inicializado');
        }
        
        return data;
    } catch (error) {
        console.error('[ERRO] Falha ao processar vídeo:', error);
        throw error;
    }
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeSocketListeners(socket) {
    console.log('[DEBUG] Configurando listeners do YouTube');
    
    socket.on('youtube_response', (response) => {
        console.log('[DEBUG] Recebida resposta do YouTube:', response);
        
        // Remover animação de carregamento
        const loadingDiv = document.querySelector('.message.loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
        
        // Verificar se a mensagem já existe
        const existingMessage = document.querySelector(`.message[data-message-id="${response.message_id}"]`);
        if (existingMessage) {
            console.log('[DEBUG] Mensagem já existe, ignorando');
            return;
        }
        
        // Adicionar nova mensagem
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.setAttribute('data-message-id', response.message_id);
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>${response.content}</p>
                </div>
            `;
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
    });
    
    socket.on('youtube_error', (error) => {
        console.error('[DEBUG] Erro no processamento do YouTube:', error);
        
        // Remover animação de carregamento
        const loadingDiv = document.querySelector('.message.loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
        
        // Exibir mensagem de erro
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <p>Erro ao processar vídeo do YouTube: ${error.message}</p>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
    });
}

function processSubtitles(subtitles) {
    // Aqui você pode adicionar lógica adicional para processar as legendas
    // Por exemplo, formatar o texto, adicionar timestamps, etc.
    const formattedSubtitles = formatSubtitles(subtitles);
    displaySubtitles(formattedSubtitles);
}

function formatSubtitles(subtitles) {
    // Formatar as legendas para exibição
    return subtitles.split('\n').map(line => {
        // Adicionar formatação específica se necessário
        return line.trim();
    }).join('\n');
}

function displaySubtitles(formattedSubtitles) {
    const subtitlesContainer = document.getElementById('subtitles-container');
    subtitlesContainer.innerHTML = formattedSubtitles;
    subtitlesContainer.style.display = 'block';
} 