import { adicionarMensagem } from './chatUI.js';
import { atualizarBotoes } from './chatActions.js';
import { entrarNaSalaDeConversa } from './chatSync.js';
import { melhorarBlocosCodigo, escapeHTML } from './chatUtils.js';
import { renderMessage } from '../messageRenderer.js';

// Cache para conversas já carregadas
const conversationCache = {};

// Controle de carregamento de conversas
const loadingConversations = new Set();

export function carregarConversa(id) {
    // Evita carregar a mesma conversa múltiplas vezes
    if (loadingConversations.has(id)) {
        console.log(`[INFO] Conversa ${id} já está sendo carregada`);
        return;
    }
    
    loadingConversations.add(id);
    
    // Reset the current view
    const chatContainer = document.querySelector('.chat-container');
    const welcomeScreen = document.querySelector('.welcome-screen');
    const inputContainer = document.querySelector('.input-container');
    
    if (!chatContainer) {
        console.error('[ERRO] Chat container não encontrado');
        loadingConversations.delete(id);
        return;
    }
    
    // Show loading indicator
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '<div class="loading-indicator">Carregando conversa...</div>';
    
    // Primeiro, carregamos apenas os metadados da conversa
    fetch(`/get_conversation/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('HTTP error: ' + response.status);
            return response.json();
        })
        .then(conversa => {
            if (conversa.error) {
                console.error('Erro ao carregar conversa:', conversa.error);
                chatContainer.innerHTML = '<div class="error-message">Erro ao carregar conversa</div>';
                return;
            }
            
            // Normalizar estrutura da conversa
            if (!conversa.messages) {
                conversa.messages = conversa.mensagens || [];
                delete conversa.mensagens;
            }
            
            if (!Array.isArray(conversa.messages)) {
                console.error('[ERRO] Messages não é um array, corrigindo...');
                conversa.messages = [];
            }
            
            if (conversa.titulo) {
                conversa.title = conversa.titulo;
                delete conversa.titulo;
            }
            
            // Armazenar conversa atual e atualizar cache de conversas
            window.conversaAtual = {
                ...conversa,
                messages: [] // Inicialmente vazio, será carregado por lotes
            };
            
            if (!window.conversas) window.conversas = [];
            window.conversas = window.conversas.map(c => 
                c.id === conversa.id ? conversa : c
            );

            // Adicionar à estrutura de conversas global por ID
            if (!window.conversations) window.conversations = {};
            
            // Preservar o estado de streaming se já existir
            const existingConversation = window.conversations[id];
            window.conversations[id] = {
                data: conversa,
                streaming: existingConversation ? existingConversation.streaming : false,
                currentResponse: existingConversation ? existingConversation.currentResponse : '',
                eventSource: existingConversation ? existingConversation.eventSource : null,
                abortController: existingConversation ? existingConversation.abortController : null,
                pendingUpdates: false,
                totalMessages: conversa.messages.length,
                loadedMessages: new Set(), // Limpar o conjunto de mensagens carregadas
                isLoading: false // Controle de estado de carregamento
            };
            
            // Limpar o container e preparar para lazy loading
            chatContainer.innerHTML = '';
            
            console.log(`[DEBUG] Iniciando carregamento da conversa ${id}`);
            
            // Iniciar o carregamento assíncrono das mensagens em lotes
            carregarMensagensEmLotes(id, 0, 20);  // Carrega as primeiras 20 mensagens

            // Entrar na sala de WebSocket para esta conversa
            entrarNaSalaDeConversa(id);
            
            // Atualizar lista de conversas para refletir o chat ativo
            atualizarListaConversas();
            
            window.dispatchEvent(new CustomEvent('conversaCarregada'));
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        })
        .catch(error => {
            console.error('Erro ao carregar conversa:', error);
            chatContainer.innerHTML = '<div class="error-message">Erro ao carregar conversa</div>';
        })
        .finally(() => {
            loadingConversations.delete(id);
        });
}

// Nova função para carregar mensagens em lotes
function carregarMensagensEmLotes(conversationId, offset, limit) {
    const chatContainer = document.querySelector('.chat-container');
    
    if (!chatContainer) {
        console.error('[ERRO] Chat container não encontrado');
        return;
    }
    
    if (!window.conversations || !window.conversations[conversationId]) {
        console.error('[ERRO] Conversa não encontrada na estrutura global');
        return;
    }
    
    const conversation = window.conversations[conversationId];
    if (conversation.isLoading) {
        console.log('[INFO] Carregamento já em andamento, ignorando');
        return;
    }
    
    conversation.isLoading = true;
    
    // Mostrar indicador apenas no primeiro lote
    if (offset === 0) {
        chatContainer.innerHTML = ''; // Limpa o container ao iniciar novo carregamento
        if (!chatContainer.querySelector('.loading-indicator')) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = 'Carregando mensagens...';
            loadingIndicator.id = 'loading-indicator';
            chatContainer.appendChild(loadingIndicator);
        }
    }
    
    console.log(`[DEBUG] Carregando lote: offset=${offset}, limit=${limit}`);
    
    fetch(`/get_conversation/${conversationId}/${offset}/${limit}`)
        .then(response => response.json())
        .then(data => {
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                chatContainer.removeChild(loadingIndicator);
            }
            
            if (data.error) {
                console.error('Erro ao carregar mensagens:', data.error);
                conversation.isLoading = false;
                return;
            }
            
            const messages = data.messages || [];
            const hasMore = data.hasMore || false;
            const total = data.total || 0;
            
            if (offset === 0 && messages.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-message';
                emptyMessage.textContent = 'Nenhuma mensagem nesta conversa.';
                chatContainer.appendChild(emptyMessage);
                conversation.isLoading = false;
                return;
            }
            
            const fragment = document.createDocumentFragment();
            const loadedMessages = conversation.loadedMessages || new Set();
            
            messages.forEach((msg) => {
                const messageId = msg.timestamp || `${conversationId}_${Date.now()}_${msg.content.slice(0, 20)}`;
                
                // Verifica se a mensagem já foi carregada
                if (!loadedMessages.has(messageId) && 
                    !document.querySelector(`.message[data-message-id="${messageId}"]`)) {
                    loadedMessages.add(messageId);
                    
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message ${msg.role}`;
                    messageDiv.dataset.messageId = messageId;
                    messageDiv.dataset.conversationId = conversationId;
                    
                    const messageContent = document.createElement('div');
                    messageContent.className = 'message-content';
                    messageContent.innerHTML = msg.role === 'assistant' ? 
                        renderMessage(msg.content) : 
                        `<p>${escapeHTML(msg.content).replace(/\n/g, '<br>')}</p>`;
                    
                    const messageActions = document.createElement('div');
                    messageActions.className = 'message-actions';
                    messageActions.innerHTML = `
                        <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                            <i class="fas fa-copy"></i>
                        </button>
                        ${msg.role === 'assistant' ? `
                            <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                                <i class="fas fa-redo"></i>
                            </button>
                        ` : ''}
                    `;
                    
                    messageDiv.appendChild(messageContent);
                    messageDiv.appendChild(messageActions);
                    
                    if (offset === 0) {
                        fragment.appendChild(messageDiv);
                    } else {
                        fragment.insertBefore(messageDiv, fragment.firstChild);
                    }
                }
            });
            
            if (fragment.children.length > 0) {
                if (offset === 0) {
                    chatContainer.appendChild(fragment);
                } else {
                    chatContainer.insertBefore(fragment, chatContainer.firstChild);
                }
                
                setTimeout(() => melhorarBlocosCodigo(), 100);
            }
            
            conversation.isLoading = false;
            
            if (hasMore && loadedMessages.size < total) {
                configureScrollListener(conversationId, offset + limit, limit);
            } else if (chatContainer._scrollListener) {
                chatContainer.removeEventListener('scroll', chatContainer._scrollListener);
                chatContainer._scrollListener = null;
            }
        })
        .catch(error => {
            console.error('Erro ao carregar mensagens:', error);
            conversation.isLoading = false;
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        });
}

// Configurar detector de scroll para lazy loading
function configureScrollListener(conversationId, nextOffset, limit) {
    const chatContainer = document.querySelector('.chat-container');
    
    if (!chatContainer) {
        console.error('[ERRO] Chat container não encontrado');
        return;
    }
    
    // Remover listener anterior se existir
    if (chatContainer._scrollListener) {
        chatContainer.removeEventListener('scroll', chatContainer._scrollListener);
        chatContainer._scrollListener = null;
    }
    
    const scrollListener = function() {
        const conversation = window.conversations[conversationId];
        if (!conversation) {
            console.error('[ERRO] Conversa não encontrada na estrutura global');
            return;
        }
        
        if (conversation.isLoading) {
            console.log('[DEBUG] Carregamento em andamento, ignorando scroll');
            return;
        }
        
        // Verificar se estamos próximos do topo e não estamos carregando
        if (chatContainer.scrollTop < 100) {
            console.log(`[DEBUG] Scroll no topo, carregando mais mensagens de offset ${nextOffset}`);
            
            // Remover listener antes de carregar para evitar chamadas múltiplas
            chatContainer.removeEventListener('scroll', scrollListener);
            chatContainer._scrollListener = null;
            
            // Carregar próximo lote
            carregarMensagensEmLotes(conversationId, nextOffset, limit);
        }
    };
    
    // Adicionar novo listener
    chatContainer.addEventListener('scroll', scrollListener);
    chatContainer._scrollListener = scrollListener;
    
    console.log(`[DEBUG] Scroll listener configurado para offset ${nextOffset}`);
}

export function atualizarListaConversas() {
    // console.log('[DEBUG] Atualizando lista de conversas');
    
    const chatList = document.querySelector('.chat-list');
    if (!chatList) {
        console.error('[ERRO] Chat list não encontrada');
        return;
    }

    // Limpar qualquer listener existente para evitar duplicação
    if (chatList._clickListener) {
        chatList.removeEventListener('click', chatList._clickListener);
    }

    fetch('/get_conversation_history')
        .then(response => response.json())
        .then(conversas => {
            chatList.innerHTML = '';
            conversas.forEach(conversa => {
                const conversaElement = document.createElement('div');
                conversaElement.className = 'chat-item';
                if (window.conversaAtual && window.conversaAtual.id === conversa.id) {
                    conversaElement.classList.add('active');
                }
                
                conversaElement.dataset.id = conversa.id;
                
                const titulo = conversa.title || conversa.titulo || 'Nova conversa';
                
                const spanTitulo = document.createElement('span');
                spanTitulo.className = 'chat-title';
                spanTitulo.textContent = titulo;
                conversaElement.appendChild(spanTitulo);
                
                const actionButtons = document.createElement('div');
                actionButtons.className = 'action-buttons';
                actionButtons.style.position = 'relative';
                actionButtons.style.zIndex = '100';
                
                // Botão Renomear com ícone
                const renameBtn = document.createElement('button');
                renameBtn.className = 'action-btn rename-btn';
                renameBtn.dataset.id = conversa.id;
                renameBtn.title = 'Renomear conversa';
                renameBtn.innerHTML = '<i class="fas fa-edit"></i>'; // Ícone de lápis para editar
                renameBtn.style.pointerEvents = 'auto';
                
                // Adicionar listener direto ao botão
                renameBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // console.log('[DEBUG] Rename clicked diretamente para ID:', conversa.id);
                    renomearConversa(conversa.id);
                });
                
                // Botão Excluir com ícone
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn delete-btn';
                deleteBtn.dataset.id = conversa.id;
                deleteBtn.title = 'Excluir conversa';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>'; // Ícone de lixeira para excluir
                deleteBtn.style.pointerEvents = 'auto';
                
                // Adicionar listener direto ao botão
                deleteBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // console.log('[DEBUG] Delete clicked diretamente para ID:', conversa.id);
                    excluirConversa(conversa.id);
                });
                
                actionButtons.appendChild(renameBtn);
                actionButtons.appendChild(deleteBtn);
                conversaElement.appendChild(actionButtons);
                
                // Evitar que cliques nos botões disparem o carregamento da conversa
                actionButtons.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // console.log('[DEBUG] Clique capturado em action-buttons');
                });
                
                chatList.appendChild(conversaElement);
            });
            
            // Adicionar listener de delegação também como fallback
            const clickListener = function(e) {
                // console.log('[DEBUG] Clique detectado em:', e.target);
                
                // Se clicar nos botões, não carrega a conversa
                if (e.target.closest('.action-buttons')) {
                    // console.log('[DEBUG] Clique em botões, interrompendo propagação');
                    e.stopPropagation();
                    return;
                }
                
                // Verificar se clicou em um botão de renomear
                const renameBtn = e.target.closest('.rename-btn');
                if (renameBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = renameBtn.dataset.id;
                    // console.log('[DEBUG] Botão renomear clicado para ID:', id);
                    renomearConversa(id);
                    return;
                }
                
                // Verificar se clicou em um botão de excluir
                const deleteBtn = e.target.closest('.delete-btn');
                if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = deleteBtn.dataset.id;
                    // console.log('[DEBUG] Botão excluir clicado para ID:', id);
                    excluirConversa(id);
                    return;
                }
                
                // Se não clicou em nenhum botão, carrega a conversa
                const chatItem = e.target.closest('.chat-item');
                if (chatItem) {
                    const id = chatItem.dataset.id;
                    // console.log('[DEBUG] Carregando conversa pelo clique:', id);
                    carregarConversa(id);
                }
            };
            
            chatList.addEventListener('click', clickListener);
            chatList._clickListener = clickListener; // Salva a referência para poder remover depois
            
            window.dispatchEvent(new CustomEvent('listaAtualizada'));
        })
        .catch(error => console.error('Erro ao atualizar lista de conversas:', error));
}

export function criarNovaConversa() {
    const novaConversa = {
        id: Date.now().toString(),
        title: "Nova Conversa",
        messages: []
    };
    
    window.conversas = window.conversas || [];
    window.conversas.unshift(novaConversa);
    window.conversaAtual = novaConversa;
    
    // Adicionar à estrutura de conversas global
    if (!window.conversations) window.conversations = {};
    window.conversations[novaConversa.id] = {
        data: novaConversa,
        streaming: false,
        currentResponse: ''
    };
    
    // Atualizar lista de conversas instantaneamente ao criar nova conversa
    atualizarListaConversas();
    window.dispatchEvent(new CustomEvent('historicoAtualizado'));
    
    return novaConversa;
}

export function adicionarMensagemAoHistorico(mensagem, tipo, conversationId = null) {
    // Se não especificado, usa a conversa atual
    conversationId = conversationId || (window.conversaAtual ? window.conversaAtual.id : null);
    
    // console.log(`[DEBUG] Adicionando mensagem à conversa ${conversationId}, tipo: ${tipo}`);
    
    if (!conversationId) {
        // console.log('[CORREÇÃO] Não há conversa atual, criando uma nova');
        const novaConversa = criarNovaConversa();
        conversationId = novaConversa.id;
    }
    
    // Referência à conversa na estrutura global de conversas
    let conversation = window.conversations[conversationId];
    
    if (!conversation) {
        console.log(`[ERRO] Conversa ${conversationId} não encontrada na estrutura global`);
        return;
    }
    
    // Verificar se a estrutura da conversa no estado global está correta
    if (!window.conversaAtual || !Array.isArray(window.conversaAtual.messages)) {
        // console.log('[CORREÇÃO] Estado da conversa atual inválido, corrigindo');
        window.conversaAtual = {
            id: conversationId,
            title: window.conversations[conversationId].data.title || "Nova conversa",
            messages: []
        };
        
        // Atualizar na estrutura global
        window.conversations[conversationId].data = window.conversaAtual;
    }
    
    try {
        const message = {
            content: mensagem,
            role: tipo,
            timestamp: new Date().toISOString()
        };
        
        // Adicionar mensagem ao histórico da conversa atual
        if (window.conversaAtual && window.conversaAtual.id === conversationId) {
            window.conversaAtual.messages.push(message);
        }
        
        // Adicionar também à estrutura de dados de conversas global
        if (!Array.isArray(window.conversations[conversationId].data.messages)) {
            window.conversations[conversationId].data.messages = [];
        }
        
        window.conversations[conversationId].data.messages.push(message);
        
        // console.log(`[DEBUG] Mensagem adicionada com sucesso à conversa ${conversationId}`);
        
        window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        window.dispatchEvent(new CustomEvent('mensagemAdicionada'));
        
    } catch (err) {
        console.error(`[ERRO CRÍTICO] Falha ao adicionar mensagem à conversa ${conversationId}:`, err);
    }
    
    // IMPORTANTE: Removido a chamada fetch para /save_message aqui para evitar duplicação
    // O backend já salva a mensagem ao final do streaming
}

export function renomearConversa(id) {
    // console.log('[DEBUG] Tentando renomear conversa:', id);
    
    const novoTitulo = prompt('Digite o novo título da conversa:');
    if (!novoTitulo || !novoTitulo.trim()) {
        // console.log('[DEBUG] Operação cancelada pelo usuário');
        return;
    }

    fetch(`/rename_conversation/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: novoTitulo.trim() })
    })
    .then(response => {
        // console.log('[DEBUG] Status da resposta:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // console.log('[DEBUG] Resposta do servidor:', data);
        
        if (data.success) {
            // console.log('[DEBUG] Conversa renomeada com sucesso');
            
            // Atualizar na conversa atual se for a mesma
            if (window.conversaAtual && window.conversaAtual.id === id) {
                window.conversaAtual.title = novoTitulo.trim();
            }
            
            // Atualizar na estrutura global de conversas
            if (window.conversations && window.conversations[id]) {
                window.conversations[id].data.title = novoTitulo.trim();
            }
            
            // Atualizar na lista de conversas em memória
            if (window.conversas) {
                window.conversas = window.conversas.map(c => 
                    c.id === id ? {...c, title: novoTitulo.trim()} : c
                );
            }
            
            // Atualizar a lista de conversas na UI
            atualizarListaConversas();
            
            // Notificar sistema sobre alteração
            window.dispatchEvent(new CustomEvent('conversaAtualizada', { 
                detail: { id, newTitle: novoTitulo.trim() } 
            }));
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    })
    .catch(error => {
        console.error('[ERRO] Falha ao renomear:', error);
        alert('Erro ao renomear conversa: ' + error.message);
    });
}

export function excluirConversa(id) {
    // console.log('[DEBUG] Tentando excluir conversa:', id);
    
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) {
        // console.log('[DEBUG] Operação cancelada pelo usuário');
        return;
    }

    fetch(`/delete_conversation/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        // console.log('[DEBUG] Status da resposta:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // console.log('[DEBUG] Resposta do servidor:', data);
        
        if (data.success) {
            // console.log('[DEBUG] Conversa excluída com sucesso');
            
            // Remover da memória
            if (window.conversas) {
                window.conversas = window.conversas.filter(c => c.id !== id);
            }
            
            // Remover da estrutura global de conversas e finalizar qualquer streaming em andamento
            if (window.conversations && window.conversations[id]) {
                // Interromper streaming se existir
                if (window.conversations[id].abortController) {
                    window.conversations[id].abortController.abort();
                }
                if (window.conversations[id].eventSource) {
                    window.conversations[id].eventSource.close();
                }
                delete window.conversations[id];
            }
            
            // Se a conversa atual foi excluída, voltar para a tela inicial
            if (window.conversaAtual && window.conversaAtual.id === id) {
                window.conversaAtual = null;
                const welcomeScreen = document.querySelector('.welcome-screen');
                const chatContainer = document.querySelector('.chat-container');
                const inputContainer = document.querySelector('.input-container');
                
                welcomeScreen.style.display = 'flex';
                chatContainer.style.display = 'none';
                inputContainer.style.display = 'none';
                
                // Atualizar botões para estado inicial
                const sendBtn = document.getElementById('send-btn');
                const stopBtn = document.getElementById('stop-btn');
                if (sendBtn && stopBtn) {
                    sendBtn.style.display = 'flex';
                    stopBtn.style.display = 'none';
                }
            }
            
            // Atualizar a lista de conversas
            atualizarListaConversas();
            
            // Notificar sistema sobre exclusão
            window.dispatchEvent(new CustomEvent('conversaExcluida', { 
                detail: { id } 
            }));
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    })
    .catch(error => {
        console.error('[ERRO] Falha na requisição:', error);
        alert('Erro ao excluir conversa: ' + error.message);
    });
}
