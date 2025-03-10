
import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';

let abortControllers = {};

function inicializarConversa(conversationId) {
    if (!window.conversations[conversationId]) {
        // console.log(`[DEBUG] Inicializando estrutura para conversa ${conversationId}`);
        window.conversations[conversationId] = {
            data: { 
                id: conversationId,
                title: "Nova Conversa",
                messages: []
            },
            streaming: false,
            currentResponse: '',
            eventSource: null,
            abortController: null
        };
    }
    return window.conversations[conversationId];
}

// Função para atualizar os botões com base na conversa atual
export function atualizarBotoes(sendBtn, stopBtn) {
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        // Se não houver conversa ativa, mostrar apenas o botão de enviar
        sendBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
        return;
    }
    
    const conversation = window.conversations[conversationId];
    if (conversation && conversation.streaming) {
        sendBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
    } else {
        sendBtn.style.display = 'flex';
        stopBtn.style.display = 'none';
    }
    
    // console.log(`[DEBUG] Botões atualizados para conversa ${conversationId}: streaming=${conversation?.streaming}`);
}

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim()) return;

    if (mensagem.startsWith('/youtube ')) {
        const videoUrl = mensagem.split(' ')[1];
        if (!videoUrl) {
            adicionarMensagem(chatContainer, "Por favor, forneça uma URL do YouTube válida", 'assistant');
            return;
        }

        if (!window.conversaAtual) {
            criarNovaConversa();
        }

        adicionarMensagem(chatContainer, mensagem, 'user');
        adicionarMensagemAoHistorico(mensagem, 'user');
        // Atualiza lista de conversas após enviar mensagem
        atualizarListaConversas();

        const loadingDiv = mostrarCarregamento(chatContainer);
        try {
            const response = await fetch('/process_youtube', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    video_url: videoUrl,
                    conversation_id: window.conversaAtual.id,
                    comando: mensagem
                })
            });

            const data = await response.json();
            loadingDiv.remove();

            if (data.error) {
                adicionarMensagem(chatContainer, `Erro: ${data.error}`, 'assistant');
                adicionarMensagemAoHistorico(`Erro: ${data.error}`, 'assistant');
            } else {
                adicionarMensagem(chatContainer, data.text, 'assistant');
                adicionarMensagemAoHistorico(data.text, 'assistant');
            }
            
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
            // Atualiza lista de conversas após receber resposta
            atualizarListaConversas();
        } catch (error) {
            loadingDiv.remove();
            const errorMsg = "Erro ao processar o vídeo";
            adicionarMensagem(chatContainer, errorMsg, 'assistant');
            adicionarMensagemAoHistorico(errorMsg, 'assistant');
        }
        return;
    }

    if (!window.conversaAtual) {
        // console.log("[DEBUG] Criando nova conversa...");
        criarNovaConversa();
    }

    const conversationId = window.conversaAtual.id;
    // console.log(`[DEBUG] Enviando mensagem para conversa: ${conversationId}`);

    const conversation = inicializarConversa(conversationId);
    
    adicionarMensagem(chatContainer, mensagem, 'user');
    adicionarMensagemAoHistorico(mensagem, 'user', conversationId);
    // Atualiza lista de conversas após enviar mensagem do usuário
    atualizarListaConversas();

    input.value = '';
    input.style.height = 'auto';
    
    const loadingDiv = mostrarCarregamento(chatContainer);

    // Marcar conversa como streaming e atualizar botões
    conversation.streaming = true;
    atualizarBotoes(sendBtn, stopBtn);
    
    conversation.abortController = new AbortController();
    abortControllers[conversationId] = conversation.abortController;

    conversation.currentResponse = '';

    try {
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: mensagem,
                conversation_id: conversationId
            }),
            signal: conversation.abortController.signal
        });

        if (!response.ok) {
            throw new Error('Erro na resposta do servidor');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let streamingDiv = null;

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
                            conversation.currentResponse += jsonData.content;
                            
                            if (window.conversaAtual && window.conversaAtual.id === conversationId) {
                                if (!streamingDiv) {
                                    loadingDiv.remove();
                                    streamingDiv = document.createElement('div');
                                    streamingDiv.className = 'message assistant streaming-message';
                                    chatContainer.appendChild(streamingDiv);
                                }
                                
                                streamingDiv.innerHTML = `<div class="message-content"><p>${conversation.currentResponse.replace(/\n/g, '<br>')}</p></div>`;
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            }
                        }
                    } catch (e) {
                        console.error('Erro ao processar chunk:', e);
                    }
                }
            }
        }

        if (streamingDiv) {
            streamingDiv.remove();
        } else if (window.conversaAtual && window.conversaAtual.id === conversationId) {
            loadingDiv.remove();
        }
        
        if (window.conversaAtual && window.conversaAtual.id === conversationId) {
            adicionarMensagem(chatContainer, conversation.currentResponse, 'assistant');
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
            window.dispatchEvent(new CustomEvent('mensagemEnviada'));
        } else {
            // console.log(`[DEBUG] Conversa mudou durante streaming. Não atualizando UI.`);
        }
        
        // Sempre salvar a mensagem no histórico local, independentemente da conversa ativa
        adicionarMensagemAoHistorico(conversation.currentResponse, 'assistant', conversationId);
        // Atualiza lista de conversas após receber resposta
        atualizarListaConversas();
        
    } catch (erro) {
        if (erro.name === 'AbortError') {
            // console.log('Geração de resposta interrompida pelo usuário');
            if (window.conversaAtual && window.conversaAtual.id === conversationId) {
                loadingDiv.remove();
            }
        } else {
            console.error('Erro:', erro);
            if (window.conversaAtual && window.conversaAtual.id === conversationId) {
                loadingDiv.remove();
            }
            const errorMsg = 'Erro ao conectar com o servidor. Por favor, tente novamente.';
            
            if (window.conversaAtual && window.conversaAtual.id === conversationId) {
                adicionarMensagem(chatContainer, errorMsg, 'assistant');
            }
            
            adicionarMensagemAoHistorico(errorMsg, 'assistant', conversationId);
        }
    } finally {
        if (conversation) {
            conversation.streaming = false;
            conversation.abortController = null;
        }
        delete abortControllers[conversationId];
        
        // Atualizar os botões apenas se estamos na mesma conversa
        if (window.conversaAtual && window.conversaAtual.id === conversationId) {
            atualizarBotoes(sendBtn, stopBtn);
        }
    }
}

export function interromperResposta() {
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) return;
    
    // console.log(`[DEBUG] Interrompendo resposta para conversa: ${conversationId}`);
    
    if (abortControllers[conversationId]) {
        abortControllers[conversationId].abort();
    }
    
    const conversation = window.conversations[conversationId];
    if (conversation) {
        if (conversation.eventSource) {
            conversation.eventSource.close();
            conversation.eventSource = null;
        }
        conversation.streaming = false;
        
        // Atualizar botões após interromper
        const sendBtn = document.getElementById('send-btn');
        const stopBtn = document.getElementById('stop-btn');
        if (sendBtn && stopBtn) {
            atualizarBotoes(sendBtn, stopBtn);
        }
    }
}
