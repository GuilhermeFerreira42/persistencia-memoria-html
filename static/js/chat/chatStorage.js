import { adicionarMensagem } from './chatUI.js';

export function carregarConversa(id) {
    fetch(`/get_conversation/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('Erro ao carregar conversa');
            return response.json();
        })
        .then(conversa => {
            if (conversa.error) {
                console.error('Erro ao carregar conversa:', conversa.error);
                return;
            }
            
            // Debug 4: Verificar dados recebidos
            console.log('[DEBUG] Conversa carregada:', conversa);
            
            // Validação crítica
            if (!conversa.messages || !Array.isArray(conversa.messages)) {
                console.error('[ERRO] Conversa inválida, recriando...');
                conversa.messages = [];
            }
            
            // Converter 'mensagens' se necessário
            if (conversa.mensagens && !conversa.messages.length) {
                conversa.messages = conversa.mensagens;
                delete conversa.mensagens;
            }
            
            console.log("Conversa após padronização:", conversa);
            
            window.conversaAtual = conversa;

            const chatContainer = document.querySelector('.chat-container');
            const welcomeScreen = document.querySelector('.welcome-screen');
            const inputContainer = document.querySelector('.input-container');
            
            welcomeScreen.style.display = 'none';
            chatContainer.style.display = 'block';
            inputContainer.style.display = 'block';
            chatContainer.innerHTML = '';
            
            conversa.messages.forEach(msg => {
                adicionarMensagem(chatContainer, msg.content, msg.role === 'assistant' ? 'assistant' : 'user');
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
        })
        .catch(error => console.error('Erro ao carregar conversa:', error));
}

export function atualizarListaConversas() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;

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
                
                conversaElement.onclick = () => carregarConversa(conversa.id);
                
                const titulo = conversa.title || 'Nova conversa';
                
                conversaElement.innerHTML = `
                    <span>${titulo}</span>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="event stopPropagation(); window.renomearConversa('${conversa.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" onclick="event.stopPropagation(); window.excluirConversa('${conversa.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                chatList.appendChild(conversaElement);
            });
        })
        .catch(error => console.error('Erro ao atualizar lista de conversas:', error));
}

export function criarNovaConversa() {
    const novaConversa = {
        id: Date.now().toString(),
        title: "Nova Conversa",
        messages: [] // Garantir que seja um array
    };
    console.log('Nova conversa criada:', novaConversa);

    if (!window.conversas) {
        window.conversas = [];
    }

    window.conversas.unshift(novaConversa);
    window.conversaAtual = novaConversa;
    return novaConversa.id;
}

export function adicionarMensagemAoHistorico(mensagem, tipo) {
    // Debug 1: Verificar estado da conversa
    console.log('[DEBUG] Estado da conversaAtual:', window.conversaAtual);
    
    // Verificação reforçada
    if (!window.conversaAtual || !window.conversaAtual.messages || !Array.isArray(window.conversaAtual.messages)) {
        console.error('[ERRO CRÍTICO] ConversaAtual inválida:', window.conversaAtual);
        window.conversaAtual = { 
            id: Date.now().toString(),
            title: "Nova conversa (emergência)",
            messages: [] 
        };
    }
    
    // Debug 2: Verificar mensagem sendo adicionada
    console.log('[DEBUG] Adicionando mensagem:', { tipo, mensagem });
    
    try {
        window.conversaAtual.messages.push({
            content: mensagem,
            role: tipo, // 'user' ou 'assistant'
            timestamp: new Date().toISOString()
        });
        console.log("Mensagem adicionada ao histórico:", mensagem);
    } catch (err) {
        console.error("Erro ao adicionar mensagem:", err);
    }
    atualizarListaConversas();
}

export function renomearConversa(id) {
    const conversa = window.conversas.find(c => c.id === id);
    if (!conversa) return;

    const novoTitulo = prompt('Digite o novo título da conversa:', conversa.title);
    if (novoTitulo && novoTitulo.trim()) {
        conversa.title = novoTitulo.trim();
        atualizarListaConversas();
    }
}

export function excluirConversa(id) {
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;
    
    window.conversas = window.conversas.filter(c => c.id !== id);
    
    if (window.conversaAtual && window.conversaAtual.id === id) {
        window.conversaAtual = null;
        const welcomeScreen = document.querySelector('.welcome-screen');
        const chatContainer = document.querySelector('.chat-container');
        const inputContainer = document.querySelector('.input-container');
        
        welcomeScreen.style.display = 'flex';
        chatContainer.style.display = 'none';
        inputContainer.style.display = 'none';
        
        document.querySelector('#welcome-input').value = '';
        document.querySelector('#chat-input').value = '';
    }
    
    atualizarListaConversas();
}
