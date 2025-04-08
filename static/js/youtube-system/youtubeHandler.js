// youtubeHandler.js
// Este arquivo lidará com o envio do comando /youtube ao backend.

export function handleYoutubeCommand(command, conversationId) {
    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        console.error('URL do vídeo não fornecida');
        return;
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com')) {
        console.error('URL inválida. Use um link do YouTube válido.');
        // Adicionar mensagem de erro ao chat
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'message error';
            errorMessage.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>URL inválida. Use um link do YouTube válido.</span>
                </div>
            `;
            chatContainer.appendChild(errorMessage);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        return;
    }

    console.log(`[DEBUG] Enviando requisição para processar vídeo: ${videoUrl}`);
    
    // Enviar requisição para processar o vídeo
    fetch('/process_youtube', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            conversation_id: conversationId,
            video_url: videoUrl
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Erro ao iniciar processamento:', data.error);
            return;
        }
        console.log('Processamento iniciado:', data.status);
    })
    .catch(error => {
        console.error('Erro ao enviar requisição:', error);
    });
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeSocketListeners(socket) {
    socket.on('youtube_response', function(data) {
        const loadingIndicator = document.getElementById('loading-indicator');
        const errorMessage = document.getElementById('error-message');
        const successMessage = document.getElementById('success-message');
        
        loadingIndicator.style.display = 'none';
        
        if (data.status === 'error') {
            errorMessage.textContent = data.message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        } else if (data.status === 'success') {
            errorMessage.style.display = 'none';
            successMessage.style.display = 'block';
            // Processar as legendas recebidas
            processSubtitles(data.subtitles);
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