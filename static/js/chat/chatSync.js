/**
 * chatSync.js
 * Responsável pela sincronização entre sessões do chat via WebSockets
 */

let socket = null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 segundos

/**
 * Inicializa a conexão com WebSocket e configura os listeners
 */
export function inicializarSync() {
    // Tentar obter uma sessionId do localStorage ou criar uma nova
    const sessionId = localStorage.getItem('sessionId') || gerarSessionId();
    localStorage.setItem('sessionId', sessionId);
    
    // Inicializar socket.io
    try {
        // URL atual do documento no navegador para evitar problemas de CORS
        const url = window.location.origin;
        socket = io(url);
        
        // Configurar listeners de conexão
        setupConnectionListeners(sessionId);
        
        // Configurar listeners de eventos
        setupEventListeners();
        
        return true;
    } catch (error) {
        console.error("Erro ao inicializar WebSocket:", error);
        return false;
    }
}

/**
 * Configura os listeners para eventos de conexão
 */
function setupConnectionListeners(sessionId) {
    if (!socket) return;
    
    socket.on('connect', () => {
        isConnected = true;
        reconnectAttempts = 0;
        // Registrar sessão do usuário para notificações
        socket.emit('register_session', { session_id: sessionId });
        
        // Registrar conversa atual (se existir)
        if (window.conversaAtual && window.conversaAtual.id) {
            entrarNaSalaDeConversa(window.conversaAtual.id);
        }
    });
    
    socket.on('disconnect', () => {
        isConnected = false;
    });
    
    socket.on('connect_error', (error) => {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            setTimeout(() => {
                socket.connect();
            }, RECONNECT_DELAY);
        }
    });
}

/**
 * Configura os listeners para eventos específicos do chat
 */
function setupEventListeners() {
    if (!socket) return;
    
    // Receber fragmento de mensagem em tempo real
    socket.on('message_chunk', (data) => {
        if (!window.conversaAtual || window.conversaAtual.id !== data.conversation_id) {
            // Se não for a conversa atual, apenas atualizar o buffer da conversa
            atualizarBufferDaConversa(data.conversation_id, data.content);
            return;
        }
        
        // Se for a conversa atual e estiver visível, atualizar o buffer
        if (document.visibilityState === 'visible') {
            const conversation = window.conversations[data.conversation_id];
            if (!conversation) return;
            
            if (!conversation.currentResponse) conversation.currentResponse = '';
            conversation.currentResponse += data.content;
            
            // Não precisa mais criar o placeholder, usar a animação centralizada
            const loadingAnimation = document.getElementById('loading-animation');
            
            // Se este é o primeiro chunk, esconder a animação
            if (loadingAnimation && loadingAnimation.style.display === 'block') {
                loadingAnimation.style.display = 'none';
                console.log('[DEBUG] Animação de carregamento ocultada após receber chunk');
            }
            
            // Rolar para o final se o usuário estiver próximo
            const chatContainer = document.querySelector('.chat-container');
            if (!chatContainer) return;
            
            const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 100;
            if (isNearBottom) {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }
    });
    
    // Receber notificação de que uma conversa foi atualizada
    socket.on('conversation_updated', (data) => {
        console.log('[DEBUG] Evento conversation_updated recebido:', data);
        console.log('[DEBUG] Chat ativo:', window.conversaAtual?.id);
        
        // Atualizar lista de conversas
        atualizarListaConversas();
        
        // Se for a conversa atual, atualizar a UI
        if (window.conversaAtual && window.conversaAtual.id === data.conversation_id) {
            console.log('[DEBUG] Atualizando DOM para conversa atual');
            // Se a aba estiver inativa, recarregar a conversa quando se tornar ativa
            if (document.visibilityState !== 'visible') {
                console.log('[DEBUG] Aba inativa, marcando para recarregar');
                marcarParaRecarregar(data.conversation_id);
            }
        }
    });
    
    // Receber notificação de que uma conversa foi renomeada
    socket.on('conversation_renamed', (data) => {
        // Atualizar no estado local
        if (window.conversas) {
            window.conversas = window.conversas.map(c => 
                c.id === data.conversation_id ? {...c, title: data.new_title} : c
            );
        }
        
        if (window.conversations && window.conversations[data.conversation_id]) {
            window.conversations[data.conversation_id].data.title = data.new_title;
        }
        
        // Atualizar lista de conversas
        atualizarListaConversas();
    });
    
    // Receber notificação de que uma conversa foi excluída
    socket.on('conversation_deleted', (data) => {
        // Remover do estado local
        if (window.conversas) {
            window.conversas = window.conversas.filter(c => c.id !== data.conversation_id);
        }
        
        if (window.conversations && window.conversations[data.conversation_id]) {
            delete window.conversations[data.conversation_id];
        }
        
        // Se for a conversa atual, voltar para a tela inicial
        if (window.conversaAtual && window.conversaAtual.id === data.conversation_id) {
            window.conversaAtual = null;
            mostrarTelaInicial();
        }
        
        // Atualizar lista de conversas
        atualizarListaConversas();
    });

    // Listener para evento de teste
    socket.on('test_event', (data) => {
        console.log('[DEBUG] Evento de teste recebido:', data);
        console.log('[DEBUG] Chat ativo:', window.conversaAtual?.id);
        console.log('[DEBUG] Sala atual:', window.salaAtual);
    });
}

/**
 * Entra na sala de uma conversa específica para receber atualizações
 */
export function entrarNaSalaDeConversa(conversationId) {
    if (!socket || !isConnected) {
        console.log('[DEBUG] Socket não disponível ou não conectado');
        return;
    }
    
    console.log(`[DEBUG] Entrando na sala da conversa: ${conversationId}`);
    
    // Sair de todas as salas anteriores primeiro
    if (window.salaAtual) {
        console.log(`[DEBUG] Saindo da sala anterior: ${window.salaAtual}`);
        socket.emit('leave_conversation', { conversation_id: window.salaAtual });
    }
    
    // Entrar na nova sala
    socket.emit('join_conversation', { conversation_id: conversationId });
    window.salaAtual = conversationId;
    console.log(`[DEBUG] Entrou na sala: ${conversationId}`);
}

/**
 * Atualiza o buffer de uma conversa com um novo fragmento de mensagem
 */
function atualizarBufferDaConversa(conversationId, fragmento) {
    if (!window.conversations) window.conversations = {};
    if (!window.conversations[conversationId]) {
        window.conversations[conversationId] = {
            data: { 
                id: conversationId,
                title: "Nova Conversa",
                messages: []
            },
            streaming: true,
            currentResponse: fragmento,
            pendingUpdates: true
        };
    } else {
        window.conversations[conversationId].streaming = true;
        window.conversations[conversationId].currentResponse += fragmento;
        window.conversations[conversationId].pendingUpdates = true;
    }
}

/**
 * Marcar uma conversa para ser recarregada quando a aba ficar visível
 */
function marcarParaRecarregar(conversationId) {
    localStorage.setItem('conversaParaRecarregar', conversationId);
}

/**
 * Verificar se há conversas para recarregar quando a aba ficar visível
 */
function verificarRecarregamento() {
    const conversaParaRecarregar = localStorage.getItem('conversaParaRecarregar');
    if (conversaParaRecarregar) {
        localStorage.removeItem('conversaParaRecarregar');
        if (window.conversaAtual && window.conversaAtual.id === conversaParaRecarregar) {
            carregarConversa(conversaParaRecarregar);
        }
    }
}

/**
 * Gera um ID de sessão único
 */
function gerarSessionId() {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
}

// Configurar o listener de visibilidade para sincronização
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        verificarRecarregamento();
        
        // Recarregar lista de conversas
        atualizarListaConversas();
        
        // Se houver uma conversa aberta com atualizações pendentes, recarregá-la
        if (window.conversaAtual && window.conversations && 
            window.conversations[window.conversaAtual.id] && 
            window.conversations[window.conversaAtual.id].pendingUpdates) {
            
            carregarConversa(window.conversaAtual.id);
            window.conversations[window.conversaAtual.id].pendingUpdates = false;
        }
    }
});

// Funções importadas de outros módulos que serão definidas no escopo global
const melhorarBlocosCodigo = window.melhorarBlocosCodigo || function() {};
const carregarConversa = window.carregarConversa || function() {};
const atualizarListaConversas = window.atualizarListaConversas || function() {};
const mostrarTelaInicial = window.mostrarTelaInicial || function() {};

/**
 * Testa a conectividade do Socket.IO
 */
export async function testSocketConnection() {
    if (!window.conversaAtual?.id) {
        console.log('[DEBUG] Nenhuma conversa ativa para testar');
        return;
    }
    
    try {
        console.log('[DEBUG] Testando conectividade do Socket.IO');
        const response = await fetch('/test_socket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: window.conversaAtual.id })
        });
        
        const data = await response.json();
        console.log('[DEBUG] Resposta do teste:', data);
    } catch (error) {
        console.error('[ERRO] Falha ao testar conectividade:', error);
    }
}
