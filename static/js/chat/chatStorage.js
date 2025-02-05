import { adicionarMensagem } from './chatUI.js';

export function carregarConversa(id) {
    const conversa = window.conversas.find(c => c.id === id);
    if (!conversa) return;

    window.conversaAtual = conversa;
    const chatContainer = document.querySelector('.chat-container');
    const welcomeScreen = document.querySelector('.welcome-screen');
    const inputContainer = document.querySelector('.input-container');
    
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
    
    conversa.mensagens.forEach(msg => {
        adicionarMensagem(chatContainer, msg.conteudo, msg.tipo);
    });
}

export function atualizarListaConversas() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) return;

    chatList.innerHTML = '';
    window.conversas.forEach(conversa => {
        const conversaElement = document.createElement('div');
        conversaElement.className = 'chat-item';
        if (window.conversaAtual && window.conversaAtual.id === conversa.id) {
            conversaElement.classList.add('active');
        }
        
        conversaElement.onclick = () => carregarConversa(conversa.id);
        
        const primeiraMsg = conversa.mensagens.find(m => m.tipo === 'user')?.conteudo || 'Nova conversa';
        const titulo = conversa.titulo || primeiraMsg.substring(0, 30) + (primeiraMsg.length > 30 ? '...' : '');
        
        conversaElement.innerHTML = `
            <span>${titulo}</span>
            <div class="action-buttons">
                <button class="action-btn" onclick="event.stopPropagation(); window.renomearConversa('${conversa.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" onclick="event.stopPropagation(); window.excluirConversa('${conversa.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        chatList.appendChild(conversaElement);
    });
}

export function criarNovaConversa() {
    const novaConversa = {
        id: Date.now().toString(),
        titulo: 'Nova conversa',
        mensagens: []
    };
    
    window.conversas.unshift(novaConversa);
    window.conversaAtual = null;
    atualizarListaConversas();
}

export function adicionarMensagemAoHistorico(mensagem, tipo) {
    if (!window.conversaAtual) {
        const novaConversa = {
            id: Date.now().toString(),
            titulo: 'Nova conversa',
            mensagens: []
        };
        window.conversas.unshift(novaConversa);
        window.conversaAtual = novaConversa;
    }
    
    window.conversaAtual.mensagens.push({
        tipo,
        conteudo: mensagem,
        timestamp: new Date().toISOString()
    });
    
    atualizarListaConversas();
}

export function renomearConversa(id) {
    const conversa = window.conversas.find(c => c.id === id);
    if (!conversa) return;

    const novoTitulo = prompt('Digite o novo título da conversa:', conversa.titulo);
    if (novoTitulo && novoTitulo.trim()) {
        conversa.titulo = novoTitulo.trim();
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