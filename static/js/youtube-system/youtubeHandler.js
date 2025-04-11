// youtubeHandler.js
// Este arquivo lidará com o envio do comando /youtube ao backend.

let isProcessingYoutube = false;

export async function handleYoutubeCommand(command, conversationId) {
    if (isProcessingYoutube) {
        console.log('[DEBUG] Já existe um processamento de YouTube em andamento');
        return;
    }

    console.log('[DEBUG] Iniciando processamento do comando do YouTube');
    
    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        throw new Error('URL do vídeo não fornecida');
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        throw new Error('URL inválida. Use um link do YouTube válido.');
    }

    console.log(`[DEBUG] Enviando requisição para processar vídeo: ${videoUrl}`);
    
    try {
        isProcessingYoutube = true;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = true;

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
    } finally {
        isProcessingYoutube = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeSocketListeners(socket) {
    console.log('[DEBUG] Configurando listeners do YouTube');
    
    socket.on('youtube_response', (response) => {
        console.log('[DEBUG] Recebida resposta do YouTube:', response);
        
        // Remover todas as animações de carregamento
        const loadingDivs = document.querySelectorAll('.message.loading');
        loadingDivs.forEach(div => div.remove());
        
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
            messageDiv.className = 'message assistant youtube';
            messageDiv.setAttribute('data-message-id', response.message_id);
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${marked.parse(response.content)}
                </div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
            chatContainer.appendChild(messageDiv);
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });
    
    socket.on('youtube_error', (error) => {
        console.error('[DEBUG] Erro no processamento do YouTube:', error);
        
        // Remover todas as animações de carregamento
        const loadingDivs = document.querySelectorAll('.message.loading');
        loadingDivs.forEach(div => div.remove());
        
        // Exibir mensagem de erro
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Erro ao processar vídeo do YouTube: ${error.message}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
        
        // Resetar estado
        isProcessingYoutube = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = false;
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