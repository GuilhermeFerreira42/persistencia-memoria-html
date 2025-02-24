
import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa } from './chatStorage.js';

let abortController = null;
let isProcessing = false; // Flag para prevenir envios duplicados

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim() || isProcessing) return;
    
    isProcessing = true;
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';

    try {
        // Verificar se é comando do YouTube
        if (mensagem.startsWith('/youtube ')) {
            const videoUrl = mensagem.split(' ')[1];
            if (!videoUrl) {
                adicionarMensagem(chatContainer, "Por favor, forneça uma URL do YouTube válida", 'assistant');
                return;
            }

            // Adicionar mensagem do usuário ao histórico
            adicionarMensagem(chatContainer, mensagem, 'user');
            adicionarMensagemAoHistorico(mensagem, 'user');

            const loadingDiv = mostrarCarregamento(chatContainer);
            try {
                const response = await fetch('/process_youtube', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ video_url: videoUrl })
                });

                const data = await response.json();
                loadingDiv.remove();

                if (data.error) {
                    adicionarMensagem(chatContainer, `Erro: ${data.error}`, 'assistant');
                    adicionarMensagemAoHistorico(`Erro: ${data.error}`, 'assistant');
                } else {
                    // Garantir que a resposta seja salva no histórico
                    adicionarMensagem(chatContainer, data.text, 'assistant');
                    adicionarMensagemAoHistorico(data.text, 'assistant');
                    
                    // Atualizar ID da conversa se fornecido
                    if (data.conversation_id) {
                        window.conversaAtual = { 
                            id: data.conversation_id,
                            messages: []
                        };
                    }
                }
            } catch (error) {
                loadingDiv.remove();
                const errorMsg = "Erro ao processar o vídeo";
                adicionarMensagem(chatContainer, errorMsg, 'assistant');
                adicionarMensagemAoHistorico(errorMsg, 'assistant');
            }
            return;
        }

        // Processar mensagem normal
        if (!window.conversaAtual) {
            console.warn("Nenhuma conversa ativa. Criando uma nova.");
            criarNovaConversa();
        }

        // Adicionar mensagem do usuário
        adicionarMensagem(chatContainer, mensagem, 'user');
        adicionarMensagemAoHistorico(mensagem, 'user');

        input.value = '';
        input.style.height = 'auto';
        
        const loadingDiv = mostrarCarregamento(chatContainer);
        let accumulatedMessage = '';

        abortController = new AbortController();

        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: mensagem,
                conversation_id: window.conversaAtual?.id
            }),
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error('Erro na resposta do servidor');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = JSON.parse(line.slice(6));
                        if (jsonData.content) {
                            accumulatedMessage += jsonData.content;
                            loadingDiv.innerHTML = `<p>${accumulatedMessage.replace(/\n/g, '<br>')}</p>`;
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    } catch (e) {
                        console.error('Erro ao processar chunk:', e);
                    }
                }
            }
        }

        loadingDiv.remove();
        adicionarMensagem(chatContainer, accumulatedMessage, 'assistant');
        adicionarMensagemAoHistorico(accumulatedMessage, 'assistant');
        
    } catch (erro) {
        if (erro.name === 'AbortError') {
            console.log('Geração de resposta interrompida pelo usuário');
            if (loadingDiv) loadingDiv.remove();
            if (accumulatedMessage) {
                adicionarMensagem(chatContainer, accumulatedMessage, 'assistant');
                adicionarMensagemAoHistorico(accumulatedMessage, 'assistant');
            }
        } else {
            console.error('Erro:', erro);
            if (loadingDiv) loadingDiv.remove();
            const mensagemErro = 'Erro ao conectar com o servidor. Por favor, tente novamente.';
            adicionarMensagem(chatContainer, mensagemErro, 'assistant');
            adicionarMensagemAoHistorico(mensagemErro, 'assistant');
        }
    } finally {
        isProcessing = false;
        sendBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        abortController = null;
    }
}

export function interromperResposta() {
    if (abortController) {
        abortController.abort();
    }
}
