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
        isProcessingYoutubeResumo = false;
        const sendBtn = document.querySelector('#send-btn');
        if (sendBtn) sendBtn.disabled = false;
    }
}

// Função para configurar os listeners de eventos do Socket.IO
export function setupYoutubeResumoSocketListeners(socket) {
    console.log('[DEBUG] Configurando listeners do YouTube Resumo');
    
    socket.on('youtube_resumo_response', (response) => {
        console.log('[DEBUG] Recebida resposta do YouTube Resumo:', response);
        
        // Remover todas as animações de carregamento
        const loadingDivs = document.querySelectorAll('.message.loading');
        loadingDivs.forEach(div => div.remove());
        
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;
        
        // Se o status for "processing", atualizar a mensagem existente
        if (response.status === 'processing' && response.message_id) {
            const existingMessage = document.querySelector(`.message[data-message-id="${response.message_id}"]`);
            
            if (existingMessage) {
                // Atualizar o conteúdo
                const contentDiv = existingMessage.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.innerHTML = marked.parse(response.content);
                    
                    // Adicionar barra de progresso se houver informações de blocos
                    if (response.current_chunk && response.total_chunks) {
                        let progressDiv = existingMessage.querySelector('.progress-container');
                        if (!progressDiv) {
                            progressDiv = document.createElement('div');
                            progressDiv.className = 'progress-container mt-3';
                            progressDiv.innerHTML = `
                                <div class="progress">
                                    <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                                </div>
                                <div class="progress-text">Processando blocos: 
                                    <span class="current-block">0</span>/<span class="total-blocks">0</span>
                                </div>
                            `;
                            contentDiv.appendChild(progressDiv);
                        }
                        
                        // Atualizar barra de progresso
                        const progressBar = progressDiv.querySelector('.progress-bar');
                        const currentBlock = progressDiv.querySelector('.current-block');
                        const totalBlocks = progressDiv.querySelector('.total-blocks');
                        
                        const percentage = (response.current_chunk / response.total_chunks) * 100;
                        progressBar.style.width = `${percentage}%`;
                        progressBar.setAttribute('aria-valuenow', percentage);
                        currentBlock.textContent = response.current_chunk;
                        totalBlocks.textContent = response.total_chunks;
                    }
                }
                
                // Rolar para a mensagem
                existingMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
                return;
            }
        }
        
        // Se não existir mensagem ou não for uma atualização, criar nova mensagem
        if (!document.querySelector(`.message[data-message-id="${response.message_id}"]`)) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant youtube-resumo';
            messageDiv.setAttribute('data-message-id', response.message_id);
            
            let messageContent = `
                <div class="message-content">
                    ${marked.parse(response.content)}
            `;
            
            // Adicionar barra de progresso se for uma mensagem de "processing"
            if (response.status === 'processing' && response.total_chunks) {
                messageContent += `
                    <div class="progress-container mt-3">
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" style="width: 0%" 
                                aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <div class="progress-text">Processando blocos: 
                            <span class="current-block">0</span>/<span class="total-blocks">${response.total_chunks}</span>
                        </div>
                    </div>
                `;
            }
            
            messageContent += `
                </div>
                <div class="message-actions">
                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            `;
            
            messageDiv.innerHTML = messageContent;
            chatContainer.appendChild(messageDiv);
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });
    
    socket.on('youtube_resumo_error', (error) => {
        console.error('[DEBUG] Erro no processamento do resumo do YouTube:', error);
        
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