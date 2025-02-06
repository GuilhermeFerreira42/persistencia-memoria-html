import { adicionarMensagem } from './chatUI.js';

const STORAGE_KEY = 'chat_state';

function salvarEstadoLocal() {
    const estado = {
        conversaAtual: window.conversaAtual?.id,
        conversas: window.conversas
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    console.log("Estado salvo localmente:", estado);
}

function recuperarEstadoLocal() {
    const estadoSalvo = localStorage.getItem(STORAGE_KEY);
    if (estadoSalvo) {
        try {
            const estado = JSON.parse(estadoSalvo);
            window.conversas = estado.conversas || [];
            if (estado.conversaAtual) {
                window.conversaAtual = window.conversas.find(c => c.id === estado.conversaAtual) || null;
            }
            console.log("Estado recuperado do localStorage:", estado);
            return true;
        } catch (e) {
            console.error("Erro ao recuperar estado:", e);
            return false;
        }
    }
    return false;
}

export function carregarConversa(id) {
    console.log("Carregando conversa:", id);
    const conversa = window.conversas.find(c => c.id === id);
    if (!conversa) {
        console.error(`Conversa com ID ${id} não encontrada.`);
        return;
    }

    window.conversaAtual = conversa;
    const chatContainer = document.querySelector('.chat-container');
    const welcomeScreen = document.querySelector('.welcome-screen');
    const inputContainer = document.querySelector('.input-container');
    
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
    
    console.log("Carregando mensagens da conversa:", conversa.mensagens);
    conversa.mensagens.forEach(msg => {
        adicionarMensagem(chatContainer, msg.content, msg.role);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
    salvarEstadoLocal();
}

export function atualizarListaConversas() {
    const chatList = document.querySelector('.chat-list');
    if (!chatList) {
        console.error("Elemento .chat-list não encontrado.");
        return;
    }

    chatList.innerHTML = '';
    
    if (!Array.isArray(window.conversas)) {
        console.error("window.conversas não é um array");
        window.conversas = [];
    }

    window.conversas.forEach(conversa => {
        const conversaElement = document.createElement('div');
        conversaElement.className = 'chat-item';
        if (window.conversaAtual && window.conversaAtual.id === conversa.id) {
            conversaElement.classList.add('active');
        }
        
        conversaElement.onclick = () => carregarConversa(conversa.id);
        
        const primeiraMsg = conversa.mensagens.find(m => m.role === 'user')?.content || 'Nova conversa';
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
    
    salvarEstadoLocal();
}

export function adicionarMensagemAoHistorico(mensagem, tipo) {
    if (!window.conversaAtual) {
        const novaConversa = {
            id: Date.now().toString(),
            titulo: 'Nova Conversa',
            mensagens: []
        };
        window.conversas.unshift(novaConversa);
        window.conversaAtual = novaConversa;
    }
    
    window.conversaAtual.mensagens.push({
        role: tipo,
        content: mensagem,
        timestamp: new Date().toISOString()
    });
    
    atualizarListaConversas();
    salvarEstadoLocal();
}

export { recuperarEstadoLocal };