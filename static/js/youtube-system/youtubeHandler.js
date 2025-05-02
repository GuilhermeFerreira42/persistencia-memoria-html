// youtubeHandler.js
import { logger } from '../utils/logger.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@5.1.1/lib/marked.esm.js';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.js';

let isProcessingYoutube = false;

export async function handleYoutubeCommand(command, conversationId) {
    logger.info('Iniciando processamento de comando YouTube', {
        conversationId,
        isProcessing: isProcessingYoutube
    });

    if (isProcessingYoutube) {
        logger.warn('Processamento de YouTube já em andamento, ignorando comando');
        return;
    }

    // Extrair a URL do vídeo do comando
    const videoUrl = command.split(' ')[1];
    if (!videoUrl) {
        logger.error('URL do vídeo não fornecida no comando');
        throw new Error('URL do vídeo não fornecida');
    }

    // Validar se a URL é do YouTube
    if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
        logger.error('URL inválida fornecida', { url: videoUrl });
        throw new Error('URL inválida. Use um link do YouTube válido.');
    }

    logger.debug('Iniciando processamento de vídeo', {
        url: videoUrl,
        conversationId
    });
    
    try {
        isProcessingYoutube = true;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            logger.debug('Botão de envio desabilitado');
        }

        // Exibir animação de carregamento centralizada
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'block';
            logger.debug('Animação de carregamento exibida');
        }

        logger.info('Enviando requisição para processar vídeo', {
            url: videoUrl,
            conversationId
        });

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
            logger.error('Falha na resposta do servidor', {
                status: response.status,
                error: errorData.error
            });
            throw new Error(errorData.error || 'Erro ao processar vídeo');
        }

        const data = await response.json();
        logger.info('Processamento do vídeo iniciado pelo backend', {
            status: data.status,
            conversationId
        });
        
        // Entrar na sala da conversa para receber eventos
        if (window.socket) {
            window.socket.emit('join_conversation', { conversation_id: conversationId });
            logger.debug('Entrou na sala da conversa para eventos', { conversationId });
        } else {
            logger.error('Socket não inicializado');
        }
        
        return data;
    } catch (error) {
        logger.error('Erro no processamento do vídeo', {
            error: error.message,
            stack: error.stack,
            conversationId
        });
        
        // Esconder animação em caso de erro
        const loadingAnimation = document.getElementById('loading-animation');
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada após erro');
        }
        
        throw error;
    } finally {
        setTimeout(() => {
            isProcessingYoutube = false;
            const sendBtn = document.querySelector('#send-btn');
            if (sendBtn) {
                sendBtn.disabled = false;
                logger.debug('Botão de envio reabilitado');
            }
        }, 2000);
    }
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeSocketListeners(socket) {
    logger.info('Configurando listeners do YouTube');
    
    socket.on('youtube_response', (response) => {
        logger.debug('Resposta do YouTube recebida', {
            status: response.status,
            conversationId: response.conversation_id,
            messageId: response.message_id
        });

        const chatContainer = document.querySelector('.chat-container');
        const loadingAnimation = document.getElementById('loading-animation');

        if (response.status === 'processing') {
            // Manter animação visível
            if (loadingAnimation) {
                loadingAnimation.style.display = 'block';
                logger.debug('Mantendo animação de carregamento');
            }
            return;
        }

        // Esconder animação ao receber resposta final ou erro
        if (loadingAnimation) {
            loadingAnimation.style.display = 'none';
            logger.debug('Animação de carregamento ocultada');
        }

        // Verificar se a mensagem já existe no DOM
        if (response.message_id) {
            const existingMessage = document.querySelector(`.message[data-message-id="${response.message_id}"]`);
            if (existingMessage) {
                logger.warn('Detectada tentativa de mensagem duplicada', {
                    messageId: response.message_id,
                    status: response.status
                });
                return;
            }
        }

        if (response.status === 'success' && response.content) {
            logger.info('Renderizando resposta do YouTube', {
                messageId: response.message_id,
                conversationId: response.conversation_id,
                contentLength: response.content.length
            });

            // Criar a nova mensagem
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant youtube';
            messageDiv.setAttribute('data-message-id', response.message_id);
            messageDiv.setAttribute('data-conversation-id', response.conversation_id);
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${DOMPurify.sanitize(marked.parse(response.content))}
                </div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
            chatContainer.appendChild(messageDiv);
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            logger.debug('Resposta do YouTube renderizada com sucesso');
        } else if (response.status === 'error') {
            logger.error('Erro na resposta do YouTube', {
                error: response.error,
                messageId: response.message_id,
                conversationId: response.conversation_id
            });

            // Criar mensagem de erro
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.setAttribute('data-message-id', response.message_id);
            errorDiv.setAttribute('data-conversation-id', response.conversation_id);
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>${DOMPurify.sanitize(response.error)}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
            logger.debug('Mensagem de erro do YouTube renderizada');
        }
    });
    
    socket.on('youtube_error', (error) => {
        logger.error('Erro no processamento do YouTube', {
            error: error.message,
            stack: error.stack
        });
        
        // Remover todas as animações de carregamento
        const loadingDivs = document.querySelectorAll('.message.loading');
        loadingDivs.forEach(div => {
            logger.debug('Removendo div de carregamento', {
                messageId: div.dataset.messageId,
                conversationId: div.dataset.conversationId
            });
            div.remove();
        });
        
        // Exibir mensagem de erro
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message error';
            errorDiv.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Erro ao processar vídeo do YouTube: ${DOMPurify.sanitize(error.message)}</span>
                </div>
            `;
            chatContainer.appendChild(errorDiv);
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
            logger.debug('Mensagem de erro renderizada no chat');
        }
        
        // Resetar estado
        isProcessingYoutube = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
            logger.debug('Botão de envio reabilitado após erro');
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