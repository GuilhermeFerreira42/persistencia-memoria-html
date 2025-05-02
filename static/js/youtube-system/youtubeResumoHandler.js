// youtubeResumoHandler.js
import { logger } from '../utils/logger.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.js';

let isProcessingYoutubeResumo = false;

export async function handleYoutubeResumoCommand(command, conversationId) {
    logger.info('Iniciando processamento de comando YouTube Resumo', {
        conversationId,
        isProcessing: isProcessingYoutubeResumo
    });

    if (isProcessingYoutubeResumo) {
        logger.warn('Processamento de resumo já em andamento, ignorando comando', {
            conversationId
        });
        return;
    }

    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        logger.error('URL do vídeo não fornecida no comando de resumo');
        throw new Error('URL do vídeo não fornecida');
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        logger.error('URL inválida fornecida para resumo', { url: videoUrl });
        throw new Error('URL inválida. Use um link do YouTube válido.');
    }

    logger.debug('Iniciando processamento de resumo', {
        url: videoUrl,
        conversationId,
        timestamp: new Date().toISOString()
    });
    
    try {
        isProcessingYoutubeResumo = true;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            logger.debug('Botão de envio desabilitado para resumo');
        }

        // Exibir animação de carregamento centralizada
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'block';
            logger.debug('Animação de carregamento exibida para resumo');
        }

        logger.info('Enviando requisição para processar resumo', {
            url: videoUrl,
            conversationId,
            endpoint: '/process_youtube_resumo'
        });

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
            logger.error('Falha na resposta do servidor para resumo', {
                status: response.status,
                error: errorData.error
            });
            throw new Error(errorData.error || 'Erro ao processar resumo do vídeo');
        }

        const data = await response.json();
        logger.info('Processamento de resumo iniciado pelo backend', {
            status: data.status,
            conversationId,
            timestamp: new Date().toISOString()
        });
        
        // Entrar na sala da conversa para receber eventos
        if (window.socket) {
            window.socket.emit('join_conversation', { conversation_id: conversationId });
            logger.debug('Entrou na sala da conversa para eventos de resumo', {
                conversationId
            });
        } else {
            logger.error('Socket não inicializado para resumo');
        }
        
        return data;
    } catch (error) {
        logger.error('Erro no processamento do resumo', {
            error: error.message,
            stack: error.stack,
            conversationId,
            url: videoUrl
        });
        
        // Esconder animação em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após erro no resumo');
        }
        
        throw error;
    } finally {
        setTimeout(() => {
            isProcessingYoutubeResumo = false;
            const sendBtn = document.querySelector('#send-btn');
            if (sendBtn) {
                sendBtn.disabled = false;
                logger.debug('Botão de envio reabilitado após resumo');
            }
        }, 2000);
    }
}

// O YouTube Resumo usa os eventos padrão message_chunk e response_complete
// Aqui adicionamos logs para diagnóstico de streaming
logger.info('Sistema de streaming padrão configurado para YouTube Resumo', {
    events: ['message_chunk', 'response_complete'],
    handledBy: 'streamingManager'
});