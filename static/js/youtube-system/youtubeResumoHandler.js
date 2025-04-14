// youtubeResumoHandler.js
// Este arquivo lidará com o envio do comando /youtube_resumo ao backend
// e exibirá os resultados dos resumos por blocos.

let isProcessingYoutubeResumo = false;

export async function handleYoutubeResumoCommand(command, conversationId) {
    if (isProcessingYoutubeResumo) {
        console.log('[DEBUG] Já existe um processamento de resumo do YouTube em andamento');
        return;
    }

    console.log('[DEBUG] Iniciando processamento do comando de resumo do YouTube');
    
    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        throw new Error('URL do vídeo não fornecida');
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        throw new Error('URL inválida. Use um link do YouTube válido.');
    }

    console.log(`[DEBUG] Enviando requisição para processar resumo do vídeo: ${videoUrl}`);
    
    try {
        isProcessingYoutubeResumo = true;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = true;

        // Enviar requisição para processar o vídeo
        const response = await fetch('/process_youtube_resumo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                url: videoUrl
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao processar resumo do vídeo');
        }

        const data = await response.json();
        console.log('[DEBUG] Processamento de resumo iniciado:', data.status);
        
        // Entrar na sala da conversa para receber eventos
        if (window.socket) {
            window.socket.emit('join_conversation', { conversation_id: conversationId });
            console.log(`[DEBUG] Entrou na sala da conversa: ${conversationId}`);
        } else {
            console.error('[ERRO] Socket não inicializado');
        }
        
        return data;
    } catch (error) {
        console.error('[ERRO] Falha ao processar resumo do vídeo:', error);
        throw error;
    } finally {
        setTimeout(() => {
            isProcessingYoutubeResumo = false;
            const sendBtn = document.querySelector('#send-btn');
            if (sendBtn) sendBtn.disabled = false;
        }, 2000); // Um pequeno atraso para garantir que o streaming comece
    }
}

// Configuração dos listeners de socket.io já é feita pelo sistema principal
// Não precisamos mais configurar listeners específicos para o YouTube Resumo,
// pois usaremos os eventos padrão message_chunk e response_complete

export function setupYoutubeResumoSocketListeners(socket) {
    console.log('[DEBUG] O YouTube Resumo agora usa o sistema de streaming padrão');
    
    // Listener de erro ainda é útil para erros específicos do YouTube
    socket.on('youtube_resumo_error', (error) => {
        console.error('[ERRO] Erro no processamento do resumo do YouTube:', error);
        
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
                    <span>Erro ao processar resumo do vídeo: ${error.message || error.error}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
        
        // Resetar estado
        isProcessingYoutubeResumo = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = false;
    });
} 