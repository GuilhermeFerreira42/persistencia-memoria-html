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

        // Exibir animação de carregamento centralizada
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'block';
            console.log('[DEBUG] Animação de carregamento exibida para YouTube Resumo');
        }

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
        
        // Esconder animação em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            console.log('[DEBUG] Animação de carregamento escondida após erro');
        }
        
        throw error;
    } finally {
        setTimeout(() => {
            isProcessingYoutubeResumo = false;
            const sendBtn = document.querySelector('#send-btn');
            if (sendBtn) sendBtn.disabled = false;
        }, 2000); // Um pequeno atraso para garantir que o streaming comece
    }
}

// O YouTube Resumo agora usa os eventos padrão message_chunk e response_complete
// Não é mais necessário configurar listeners específicos
console.log('[DEBUG] O YouTube Resumo usa o sistema de streaming padrão de message_chunk e response_complete'); 