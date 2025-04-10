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
    
    socket.on('youtube_response', function(data) {
        console.log('[DEBUG] Recebido youtube_response:', data);
        
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) {
            console.error('[ERRO] Container de chat não encontrado');
            return;
        }

        // Remove o indicador de carregamento
        const loadingDiv = chatContainer.querySelector('.loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }

        if (data.status === 'error') {
            console.error('[ERRO] Erro no processamento:', data.error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${data.error}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        } else if (data.status === 'success') {
            console.log('[DEBUG] Processamento concluído com sucesso');
            // A resposta será renderizada pelo youtubeEvents.js
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