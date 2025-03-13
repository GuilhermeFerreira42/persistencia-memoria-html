import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';
import { renderMessage, renderStreamingMessage } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';

let abortControllers = {};

function inicializarConversa(conversationId) {
    if (!window.conversations[conversationId]) {
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
}

// Função para verificar se o usuário está no final do chat
function isUserAtBottom(container) {
    const threshold = 50; // pixels de tolerância
    return container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
}

// Função para rolar suavemente para o final
function scrollToBottom(container) {
    container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
    });
}

// Função para gerenciar scroll durante streaming
function handleStreamingScroll(container, content) {
    let userScrolledUp = false;
    let scrollTimeout = null;
    
    const scrollListener = () => {
        userScrolledUp = !isUserAtBottom(container);
        
        // Limpar timeout anterior
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Se o usuário rolar para baixo até o final, resetar o estado
        if (userScrolledUp && isUserAtBottom(container)) {
            userScrolledUp = false;
        }
    };
    
    // Adicionar listener de scroll
    container.addEventListener('scroll', scrollListener);
    
    // Retornar função para limpar o listener
    return () => {
        container.removeEventListener('scroll', scrollListener);
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
    };
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
        criarNovaConversa();
    }

    const conversationId = window.conversaAtual.id;
    const conversation = inicializarConversa(conversationId);
    const timestamp = Date.now();
    
    adicionarMensagem(chatContainer, mensagem, 'user');
    adicionarMensagemAoHistorico(mensagem, 'user', conversationId);
    atualizarListaConversas();

    input.value = '';
    input.style.height = 'auto';
    
    // Cria UMA mensagem para o assistente com estrutura simples
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant streaming-message';
    const safeTimestamp = `${timestamp}_response`; 
    messageDiv.dataset.messageId = safeTimestamp;
    messageDiv.innerHTML = `
        <div class="message-content"></div>
        <div class="message-actions">
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                <i class="fas fa-redo"></i>
            </button>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    
    // Verificar se o usuário está no final do chat para scroll automático
    const isAtBottom = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 30;
    
    if (isAtBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Marcar conversa como streaming e atualizar botões
    conversation.streaming = true;
    atualizarBotoes(sendBtn, stopBtn);
    
    conversation.abortController = new AbortController();
    abortControllers[conversationId] = conversation.abortController;

    conversation.currentResponse = '';
    const contentDiv = messageDiv.querySelector('.message-content');
    contentDiv.innerHTML = '<span class="typing-animation">...</span>'; // Animação inicial
    
    // Configurar gerenciamento de scroll
    const cleanupScroll = handleStreamingScroll(chatContainer);
    let userScrolledUp = false;

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

        // Configurar gerenciamento de scroll
        const cleanupScroll = handleStreamingScroll(chatContainer);
        let userScrolledUp = false;

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        let isFirstChunk = true;
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const jsonData = JSON.parse(line.slice(6));
                        if (jsonData.content) {
                            const newChunk = jsonData.content;
                            conversation.currentResponse += newChunk;
                            
                            if (isFirstChunk) {
                                contentDiv.innerHTML = '';
                                isFirstChunk = false;
                            }
                            
                            requestAnimationFrame(() => {
                                const renderedChunk = renderStreamingMessage(newChunk);
                                contentDiv.insertAdjacentHTML('beforeend', renderedChunk);
                                
                                setTimeout(() => {
                                    melhorarBlocosCodigo();
                                }, 0);
                                
                                // Scroll inteligente
                                if (!userScrolledUp) {
                                    scrollToBottom(chatContainer);
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Erro ao processar chunk:', e);
                    }
                }
            }
        }

        // Limpar gerenciamento de scroll
        cleanupScroll();
        
        // Finaliza a mensagem - renderização final completa
        messageDiv.classList.remove('streaming-message');
        
        // Renderiza o conteúdo final completo
        contentDiv.innerHTML = renderMessage(conversation.currentResponse);
        
        // Aplicar melhorias finais aos blocos de código
        melhorarBlocosCodigo();
        
        // Salvar a mensagem no histórico local
        adicionarMensagemAoHistorico(conversation.currentResponse, 'assistant', conversationId);
        atualizarListaConversas();
        
    } catch (erro) {
        // Limpar gerenciamento de scroll em caso de erro
        cleanupScroll();
        
        if (erro.name === 'AbortError') {
            console.log('Geração de resposta interrompida pelo usuário');
            contentDiv.innerHTML = '<p><em>Resposta interrompida pelo usuário</em></p>';
        } else {
            console.error('Erro:', erro);
            contentDiv.innerHTML = '<p><em>Erro ao conectar com o servidor. Por favor, tente novamente.</em></p>';
            adicionarMensagemAoHistorico('Erro ao conectar com o servidor. Por favor, tente novamente.', 'assistant', conversationId);
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
