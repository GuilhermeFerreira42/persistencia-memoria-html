import { mostrarCarregamento } from './chatUI.js';
import { adicionarMensagem } from './chatUI.js';
import { adicionarMensagemAoHistorico, criarNovaConversa, atualizarListaConversas } from './chatStorage.js';
import { renderMessage, accumulateChunk, renderCompleteResponse, clearAccumulatedResponse } from '../messageRenderer.js';
import { melhorarBlocosCodigo } from './chatUtils.js';

// Mapa para controlar o estado de streaming por conversa
const streamingStates = new Map();

// Inicializa o socket
const socket = io();

// Adicionar log de conexão
socket.on('connect', () => {
    console.log('[DEBUG] WebSocket conectado com sucesso');
});

socket.on('connect_error', (error) => {
    console.error('[ERRO] Falha na conexão WebSocket:', error);
});

// Listener para chunks da mensagem
socket.on('message_chunk', (data) => {
    console.log('[DEBUG] Recebido chunk:', { data });
    const { content, conversation_id } = data;
    if (!content || !conversation_id) {
        console.warn('[DEBUG] Chunk inválido recebido:', data);
        return;
    }
    
    // Verificar se é a conversa atual
    if (window.conversaAtual?.id !== conversation_id) {
        console.log('[DEBUG] Ignorando chunk de outra conversa');
        return;
    }
    
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    // Verifica se já existe um placeholder de streaming
    let streamingMessage = chatContainer.querySelector('.message.assistant.streaming-message');
    if (!streamingMessage) {
        streamingMessage = document.createElement('div');
        streamingMessage.className = 'message assistant streaming-message';
        streamingMessage.innerHTML = '<div class="message-content">Gerando resposta...</div>';
        chatContainer.appendChild(streamingMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    console.log('[DEBUG] Processando chunk para conversa:', conversation_id);
    // Marca conversa como em streaming
    streamingStates.set(conversation_id, true);
    
    // Apenas acumula o chunk, sem renderizar
    accumulateChunk(content, conversation_id);
    console.log('[DEBUG] Chunk acumulado com sucesso');
});

// Listener para resposta completa
socket.on('response_complete', (data) => {
    console.log('[DEBUG] Resposta completa recebida:', data);
    const { conversation_id } = data;
    if (!conversation_id) {
        console.warn('[DEBUG] ID da conversa não fornecido na resposta completa');
        return;
    }

    // Verifica se é a conversa atual
    if (window.conversaAtual?.id !== conversation_id) {
        console.log('[DEBUG] Ignorando resposta de outra conversa:', {
            atual: window.conversaAtual?.id,
            recebido: conversation_id
        });
        clearAccumulatedResponse(conversation_id);
        streamingStates.delete(conversation_id);
        return;
    }

    // Remove estado de streaming
    streamingStates.delete(conversation_id);

    // Encontra o container do chat
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    // Remove qualquer placeholder de streaming ou carregamento
    const loadingMessage = chatContainer.querySelector('.message.assistant.loading');
    const streamingMessage = chatContainer.querySelector('.message.assistant.streaming-message');
    if (loadingMessage) loadingMessage.remove();
    if (streamingMessage) streamingMessage.remove();

    try {
        // Renderiza resposta completa
        const renderedHtml = renderCompleteResponse(conversation_id);
        if (!renderedHtml) {
            throw new Error('Resposta vazia ou inválida');
        }

        // Cria elemento da mensagem
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.dataset.messageId = `${Date.now()}_assistant`;
        messageDiv.dataset.conversationId = conversation_id;
        messageDiv.innerHTML = `
            <div class="message-content">${renderedHtml}</div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `;

        // Adiciona ao chat e rola para baixo
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Melhora blocos de código
        setTimeout(() => {
            melhorarBlocosCodigo(messageDiv);
        }, 0);

        // Salva no histórico
        const completeResponse = messageDiv.querySelector('.message-content').textContent;
        adicionarMensagemAoHistorico(completeResponse, 'assistant', conversation_id);
        atualizarListaConversas();
    } catch (error) {
        console.error('[ERRO] Falha ao processar resposta:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error';
        errorDiv.innerHTML = '<div class="message-content">Erro ao processar a resposta</div>';
        chatContainer.appendChild(errorDiv);
    }
});

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

// Função auxiliar para forçar renderização
function forcarRenderizacao(elemento) {
    // Forçar reflow
    void elemento.offsetHeight;
    
    // Usar requestAnimationFrame para garantir a renderização
    requestAnimationFrame(() => {
        elemento.style.opacity = '1';
        elemento.style.transform = 'translateY(0)';
        
        // Segundo frame para garantir que a transição seja aplicada
        requestAnimationFrame(() => {
            if (elemento.parentElement) {
                elemento.parentElement.scrollTop = elemento.parentElement.scrollHeight;
            }
        });
    });
}

export async function enviarMensagem(mensagem, input, chatContainer, sendBtn, stopBtn) {
    if (!mensagem.trim()) {
        console.warn('[DEBUG] Tentativa de enviar mensagem vazia');
        return;
    }

    if (!window.conversaAtual) {
        console.log('[DEBUG] Criando nova conversa');
        criarNovaConversa();
    }

    const conversationId = window.conversaAtual?.id;
    const userTimestamp = new Date().toISOString();
    const userMessageId = userTimestamp;
    console.log('[DEBUG] Enviando mensagem:', { mensagem, conversationId, timestamp: userTimestamp });

    try {
        if (sendBtn) {
            console.log('[DEBUG] Desabilitando botão de envio');
            sendBtn.disabled = true;
            sendBtn.style.display = 'none';
        }
        if (stopBtn) {
            console.log('[DEBUG] Mostrando botão de parar');
            stopBtn.style.display = 'flex';
        }

        input.value = '';
        input.style.height = 'auto';

        // Adicionar mensagem do usuário ao DOM
        console.log('[DEBUG] Adicionando mensagem do usuário ao DOM');
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user';
        userMessageDiv.dataset.messageId = userMessageId;
        userMessageDiv.dataset.conversationId = conversationId;
        userMessageDiv.innerHTML = `
            <div class="message-content">${renderMessage(mensagem)}</div>
            <div class="message-actions">
                <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;
        userMessageDiv.style.opacity = '0';
        chatContainer.appendChild(userMessageDiv);
        forcarRenderizacao(userMessageDiv);

        adicionarMensagemAoHistorico(mensagem, 'user', conversationId);

        // Enviar mensagem com timestamp para o backend
        console.log('[DEBUG] Iniciando requisição para o backend');
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: mensagem,
                conversation_id: conversationId,
                timestamp: userTimestamp
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.status}`);
        }

        console.log('[DEBUG] Mensagem enviada com sucesso para o backend');
    } catch (error) {
        console.error('[ERRO] Falha ao enviar mensagem:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error';
        errorDiv.innerHTML = '<div class="message-content">Erro ao processar a mensagem. Por favor, tente novamente.</div>';
        errorDiv.style.opacity = '0';
        chatContainer.appendChild(errorDiv);
        forcarRenderizacao(errorDiv);
    } finally {
        console.log('[DEBUG] Finalizando processo de envio');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.display = 'flex';
        }
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
    }
}

// Adicionar MutationObserver para garantir renderização
const chatContainer = document.querySelector('.chat-container');
if (chatContainer) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            }
        });
    });

    observer.observe(chatContainer, { 
        childList: true, 
        subtree: true 
    });
}

// Adicionar listener para atualização de conversa
socket.on('conversation_updated', (data) => {
    console.log('[DEBUG] Evento conversation_updated recebido:', data);
    const { conversation_id } = data;

    if (window.conversaAtual?.id === conversation_id) {
        console.log('[DEBUG] Atualizando conversa atual:', conversation_id);
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) {
            console.warn('[DEBUG] Container do chat não encontrado');
            return;
        }

        const loadingMsg = chatContainer.querySelector('.message.assistant.loading');
        if (loadingMsg) {
            loadingMsg.remove();
        }

        const existingMessages = new Map(
            Array.from(chatContainer.querySelectorAll('.message')).map(msg => [
                msg.dataset.messageId,
                msg
            ])
        );

        fetch(`/get_conversation/${conversation_id}/0/20`)
            .then(response => response.json())
            .then(data => {
                if (data.messages) {
                    data.messages.forEach(msg => {
                        const messageId = msg.timestamp;
                        let existingMsg = existingMessages.get(messageId);

                        if (!existingMsg) {
                            // Procurar por uma mensagem com conteúdo idêntico (caso o timestamp tenha mudado)
                            for (const [id, elem] of existingMessages) {
                                const content = elem.querySelector('.message-content').innerHTML;
                                if (content === renderMessage(msg.content) && elem.classList.contains(msg.role)) {
                                    existingMsg = elem;
                                    console.log('[DEBUG] Encontrada mensagem correspondente por conteúdo, atualizando ID:', { 
                                        oldId: id, 
                                        newId: messageId,
                                        role: msg.role,
                                        content: content
                                    });
                                    elem.dataset.messageId = messageId; // Atualizar o ID
                                    existingMessages.delete(id); // Remover o ID antigo
                                    existingMessages.set(messageId, elem); // Adicionar com o novo ID
                                    break;
                                }
                            }
                        }

                        if (existingMsg) {
                            console.log('[DEBUG] Mensagem já existe, verificando atualização:', {
                                messageId,
                                role: msg.role,
                                contentPreview: msg.content.substring(0, 50)
                            });
                            const currentContent = existingMsg.querySelector('.message-content').innerHTML;
                            const newContent = renderMessage(msg.content);
                            if (currentContent !== newContent) {
                                existingMsg.querySelector('.message-content').innerHTML = newContent;
                            }
                        } else {
                            console.log('[DEBUG] Adicionando nova mensagem:', {
                                messageId,
                                role: msg.role,
                                contentPreview: msg.content.substring(0, 50)
                            });
                            const messageDiv = document.createElement('div');
                            messageDiv.className = `message ${msg.role}`;
                            messageDiv.dataset.messageId = messageId;
                            messageDiv.dataset.conversationId = conversation_id;
                            messageDiv.innerHTML = `
                                <div class="message-content">${renderMessage(msg.content)}</div>
                                <div class="message-actions">
                                    <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                    ${msg.role === 'assistant' ? `
                                        <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                                            <i class="fas fa-redo"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                            chatContainer.appendChild(messageDiv);
                            forcarRenderizacao(messageDiv);
                        }
                        existingMessages.delete(messageId);
                    });
                }

                requestAnimationFrame(() => {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
            })
            .catch(error => console.error('[ERRO] Falha ao atualizar conversa:', error));
    }
});

export function interromperResposta() {
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) return;
    
    if (streamingStates.has(conversationId)) {
        streamingStates.delete(conversationId);
        clearAccumulatedResponse(conversationId);
    }
    
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        const streamingMessage = chatContainer.querySelector('.message.assistant.streaming-message');
        const loadingMessage = chatContainer.querySelector('.message.assistant.loading');
        if (streamingMessage) streamingMessage.remove();
        if (loadingMessage) loadingMessage.remove();
    }
    
    // Atualizar botões após interromper
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (sendBtn && stopBtn) {
        atualizarBotoes(sendBtn, stopBtn);
    }
}
