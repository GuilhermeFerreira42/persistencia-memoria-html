
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
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(conversas => {
            console.log('[DEBUG] Conversas carregadas:', conversas);
            chatList.innerHTML = '';
            
            conversas.forEach(conversa => {
                const conversaElement = document.createElement('div');
                conversaElement.className = 'chat-item';
                conversaElement.dataset.id = conversa.id;
                
                if (window.conversaAtual && window.conversaAtual.id === conversa.id) {
                    conversaElement.classList.add('active');
                }
                
                const titulo = conversa.title || conversa.titulo || 'Nova conversa';
                
                conversaElement.innerHTML = `
                    <span class="chat-title">${titulo}</span>
                    <div class="action-buttons">
                        <button class="action-btn rename-btn" title="Renomear">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                chatList.appendChild(conversaElement);
            });
        })
        .catch(error => {
            console.error('[ERRO] Falha ao atualizar lista:', error);
        });
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log('[DEBUG] Resposta do servidor:', data);
        if (data.success) {
            console.log('[DEBUG] Conversa renomeada com sucesso');
            atualizarListaConversas();
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log('[DEBUG] Resposta do servidor:', data);
        if (data.success) {
            console.log('[DEBUG] Conversa excluída com sucesso');
            
            if (window.conversaAtual?.id === id) {
                window.conversaAtual = null;
                const welcomeScreen = document.querySelector('.welcome-screen');
                const chatContainer = document.querySelector('.chat-container');
                const inputContainer = document.querySelector('.input-container');
                
                welcomeScreen.style.display = 'flex';
                chatContainer.style.display = 'none';
                inputContainer.style.display = 'none';
            }
            
            atualizarListaConversas();
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    })
    .catch(error => {
        console.error('[ERRO] Falha ao excluir:', error);
        alert('Erro ao excluir conversa: ' + error.message);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;

    chatList.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;

        const id = chatItem.dataset.id;
        if (!id) {
            console.error('[ERRO] ID da conversa não encontrado');
            return;
        }

        if (e.target.closest('.rename-btn')) {
            e.preventDefault();
            renomearConversa(id);
        } else if (e.target.closest('.delete-btn')) {
            e.preventDefault();
            excluirConversa(id);
        } else {
            carregarConversa(id);
        }
    });
});
