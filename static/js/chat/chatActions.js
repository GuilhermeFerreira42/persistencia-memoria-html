
import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa } from './chatStorage.js';

let abortController = null;

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim()) return;

    // Verificar se é comando do YouTube
    if (mensagem.startsWith('/youtube ')) {
        const videoUrl = mensagem.split(' ')[1];
        if (!videoUrl) {
            adicionarMensagem(chatContainer, "Por favor, forneça uma URL do YouTube válida", 'assistant');
            return;
        }

        if (!window.conversaAtual) {
            criarNovaConversa();
        }

        const loadingDiv = mostrarCarregamento(chatContainer);
        try {
            const response = await fetch('/process_youtube', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    video_url: videoUrl,
                    conversation_id: window.conversaAtual.id
                })
            });

            const data = await response.json();
            loadingDiv.remove();

            if (data.error) {
                adicionarMensagem(chatContainer, `Erro: ${data.error}`, 'assistant');
            } else {
                adicionarMensagem(chatContainer, data.text, 'assistant');
            }
        } catch (error) {
            loadingDiv.remove();
            adicionarMensagem(chatContainer, "Erro ao processar o vídeo", 'assistant');
        }
        return;
    }

    // Para mensagens normais, deixar o backend adicionar a mensagem
    if (!window.conversaAtual) {
        console.warn("Criando nova conversa...");
        criarNovaConversa();
    }

    input.value = '';
    input.style.height = 'auto';
    
    const loadingDiv = mostrarCarregamento(chatContainer);

    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';

    abortController = new AbortController();

    try {
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
        let accumulatedMessage = '';

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
        
    } catch (erro) {
        if (erro.name === 'AbortError') {
            console.log('Geração de resposta interrompida pelo usuário');
            loadingDiv.remove();
        } else {
            console.error('Erro:', erro);
            loadingDiv.remove();
            adicionarMensagem(chatContainer, 'Erro ao conectar com o servidor. Por favor, tente novamente.', 'assistant');
        }
    } finally {
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
