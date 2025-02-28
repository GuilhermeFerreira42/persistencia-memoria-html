
import { adicionarMensagem } from './chatUI.js';

export function carregarConversa(id) {
    console.log('[DEBUG] Carregando conversa:', id);
    
    fetch(`/get_conversation/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('HTTP error: ' + response.status);
            return response.json();
        })
        .then(conversa => {
            if (conversa.error) {
                console.error('Erro ao carregar conversa:', conversa.error);
                return;
            }
            
            console.log('[DEBUG] Conversa carregada:', conversa);
            
            if (!conversa.messages) {
                console.log('[CONVERSÃO] Convertendo mensagens antigas para novo formato');
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
            
            window.conversaAtual = conversa;
            if (!window.conversas) window.conversas = [];
            window.conversas = window.conversas.map(c => 
                c.id === conversa.id ? conversa : c
            );

            const chatContainer = document.querySelector('.chat-container');
            const welcomeScreen = document.querySelector('.welcome-screen');
            const inputContainer = document.querySelector('.input-container');
            
            if (!chatContainer) {
                console.error('[ERRO] Chat container não encontrado');
                return;
            }
            
            welcomeScreen.style.display = 'none';
            chatContainer.style.display = 'block';
            inputContainer.style.display = 'block';
            chatContainer.innerHTML = '';
            
            conversa.messages.forEach(msg => {
                adicionarMensagem(chatContainer, msg.content, msg.role === 'assistant' ? 'assistant' : 'user');
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            window.dispatchEvent(new CustomEvent('conversaCarregada'));
            window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        })
        .catch(error => {
            console.error('Erro ao carregar conversa:', error);
            alert('Erro ao carregar conversa');
        });
}

export function atualizarListaConversas() {
    console.log('[DEBUG] Atualizando lista de conversas');
    
    const chatList = document.querySelector('.chat-list');
    if (!chatList) {
        console.error('[ERRO] Chat list não encontrada');
        return;
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
                
                // Abordagem modificada: criar elementos DOM em vez de usar innerHTML
                const spanTitulo = document.createElement('span');
                spanTitulo.className = 'chat-title';
                spanTitulo.textContent = titulo;
                conversaElement.appendChild(spanTitulo);
                
                const actionButtons = document.createElement('div');
                actionButtons.className = 'action-buttons';
                
                // Botão Renomear
                const renameBtn = document.createElement('button');
                renameBtn.className = 'action-btn rename-btn';
                renameBtn.dataset.id = conversa.id;
                renameBtn.title = 'Renomear conversa';
                renameBtn.innerHTML = '<i class="fas fa-edit"></i>';
                renameBtn.onclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('[DEBUG] Botão renomear clicado para ID:', conversa.id);
                    renomearConversa(conversa.id);
                };
                
                // Botão Excluir
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'action-btn delete-btn';
                deleteBtn.dataset.id = conversa.id;
                deleteBtn.title = 'Excluir conversa';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.onclick = function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('[DEBUG] Botão excluir clicado para ID:', conversa.id);
                    excluirConversa(conversa.id);
                };
                
                actionButtons.appendChild(renameBtn);
                actionButtons.appendChild(deleteBtn);
                conversaElement.appendChild(actionButtons);
                
                // Adicionar event listener para carregamento de conversa ao clicar no elemento
                conversaElement.addEventListener('click', function(e) {
                    // Não carregamos a conversa se clicamos em um botão
                    if (e.target.closest('.action-btn')) {
                        console.log('[DEBUG] Clique em botão detectado, ignorando carregamento');
                        return;
                    }
                    
                    const id = this.dataset.id;
                    console.log('[DEBUG] Carregando conversa pelo clique:', id);
                    carregarConversa(id);
                });
                
                chatList.appendChild(conversaElement);
            });
            
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
    
    window.dispatchEvent(new CustomEvent('historicoAtualizado'));
    
    return novaConversa.id;
}

export function adicionarMensagemAoHistorico(mensagem, tipo) {
    console.log('[DEBUG] Estado da conversaAtual:', window.conversaAtual);
    
    if (!window.conversaAtual || !Array.isArray(window.conversaAtual.messages)) {
        console.log('[CORREÇÃO] Criando nova conversa devido a estado inválido');
        window.conversaAtual = {
            id: Date.now().toString(),
            title: "Nova conversa",
            messages: []
        };
    }
    
    try {
        window.conversaAtual.messages.push({
            content: mensagem,
            role: tipo,
            timestamp: new Date().toISOString()
        });
        console.log("[DEBUG] Mensagem adicionada com sucesso");
        
        window.dispatchEvent(new CustomEvent('historicoAtualizado'));
        window.dispatchEvent(new CustomEvent('mensagemAdicionada'));
        
    } catch (err) {
        console.error("[ERRO CRÍTICO] Falha ao adicionar mensagem:", err);
    }
}

export function renomearConversa(id) {
    console.log('[DEBUG] Tentando renomear conversa:', id);
    
    const novoTitulo = prompt('Digite o novo título da conversa:');
    if (!novoTitulo || !novoTitulo.trim()) {
        console.log('[DEBUG] Operação cancelada pelo usuário');
        return;
    }

    fetch(`/rename_conversation/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: novoTitulo.trim() })
    })
    .then(response => {
        console.log('[DEBUG] Status da resposta:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('[DEBUG] Resposta do servidor:', data);
        
        if (data.success) {
            console.log('[DEBUG] Conversa renomeada com sucesso');
            
            // Atualizar o título na memória
            if (window.conversaAtual && window.conversaAtual.id === id) {
                window.conversaAtual.title = novoTitulo.trim();
            }
            
            if (window.conversas) {
                window.conversas = window.conversas.map(c => 
                    c.id === id ? {...c, title: novoTitulo.trim()} : c
                );
            }
            
            // Atualizar a lista de conversas
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
    console.log('[DEBUG] Tentando excluir conversa:', id);
    
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) {
        console.log('[DEBUG] Operação cancelada pelo usuário');
        return;
    }

    fetch(`/delete_conversation/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
        console.log('[DEBUG] Status da resposta:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('[DEBUG] Resposta do servidor:', data);
        
        if (data.success) {
            console.log('[DEBUG] Conversa excluída com sucesso');
            
            // Remover da memória
            if (window.conversas) {
                window.conversas = window.conversas.filter(c => c.id !== id);
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
