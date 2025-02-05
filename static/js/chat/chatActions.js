import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico } from './chatStorage.js';

let abortController = null;

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim()) return;

    input.value = '';
    input.style.height = 'auto';
    
    const loadingDiv = mostrarCarregamento(chatContainer);
    let accumulatedMessage = '';

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
            loadingDiv.remove();
            if (accumulatedMessage) {
                adicionarMensagem(chatContainer, accumulatedMessage, 'assistant');
                adicionarMensagemAoHistorico(accumulatedMessage, 'assistant');
            }
        } else {
            console.error('Erro:', erro);
            loadingDiv.remove();
            const mensagemErro = 'Erro ao conectar com o servidor. Por favor, tente novamente.';
            adicionarMensagem(chatContainer, mensagemErro, 'assistant');
            adicionarMensagemAoHistorico(mensagemErro, 'assistant');
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