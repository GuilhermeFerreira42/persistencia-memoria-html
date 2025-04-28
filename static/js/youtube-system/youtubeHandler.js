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

        // Exibir animação de carregamento centralizada
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'block';
            console.log('[DEBUG] Animação de carregamento exibida');
        }

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
        console.log('[DEBUG] Processamento do vídeo iniciado:', data.status);
        
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
        
        // Esconder animação em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            console.log('[DEBUG] Animação de carregamento escondida após erro');
        }
        
        throw error;
    } finally {
        setTimeout(() => {
            isProcessingYoutube = false;
            const sendBtn = document.querySelector('#send-btn');
            if (sendBtn) sendBtn.disabled = false;
        }, 2000); // Um pequeno atraso para garantir que o streaming comece
    }
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeSocketListeners(socket) {
    console.log('[DEBUG] Configurando listeners do YouTube');
    
    socket.on('youtube_response', (response) => {
        console.log('[DEBUG] Recebida resposta do YouTube:', response);
        const chatContainer = document.querySelector('.chat-container');
        const loadingAnimation = document.getElementById('loading-animation');

        if (response.status === 'processing') {
            // Manter animação visível
            if (loadingAnimation) {
                loadingAnimation.style.display = 'block';
            }
            return;
        }

        // Esconder animação ao receber resposta final ou erro
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            console.log('[DEBUG] Animação de carregamento escondida');
        }

        // Verificar se a mensagem já existe no DOM
        if (response.message_id) {
            const existingMessage = document.querySelector(`.message[data-message-id="${response.message_id}"]`);
            if (existingMessage) {
                console.log('[DEBUG] Mensagem já existe, ignorando duplicata');
                return;
            }
        }

        if (response.status === 'success' && response.content) {
            // Criar a nova mensagem
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant youtube';
            messageDiv.setAttribute('data-message-id', response.message_id);
            messageDiv.setAttribute('data-conversation-id', response.conversation_id);
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
            console.log('[DEBUG] Resposta do YouTube renderizada com sucesso');
        } else if (response.status === 'error') {
            // Criar mensagem de erro
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.setAttribute('data-message-id', response.message_id);
            errorDiv.setAttribute('data-conversation-id', response.conversation_id);
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${response.error}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            console.log('[DEBUG] Erro do YouTube renderizado');
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