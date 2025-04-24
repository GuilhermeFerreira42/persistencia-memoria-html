import { chatUI } from './chatUI.js';
import { streamingManager } from './modules/streamingManager.js';
import { logger } from './utils/logger.js';

logger.info('Iniciando sistema de chat', { timestamp: new Date().toISOString() });

// Garantir que o DOMPurify está disponível globalmente
if (typeof DOMPurify === 'undefined') {
    logger.error('DOMPurify não está carregado', { 
        error: 'Dependência crítica não disponível',
        details: 'Verifique se o script está incluído corretamente no HTML'
    });
}

// Garantir que o marked está disponível globalmente
if (typeof marked === 'undefined') {
    logger.error('Marked não está carregado', { 
        error: 'Dependência crítica não disponível',
        details: 'Verifique se o script está incluído corretamente no HTML'
    });
}

// Garantir que o Socket.IO está disponível globalmente
if (typeof io === 'undefined') {
    logger.error('Socket.IO não está carregado', { 
        error: 'Dependência crítica não disponível',
        details: 'Verifique se o script está incluído corretamente no HTML'
    });
}

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    logger.info('DOM carregado, iniciando inicialização do sistema');
    
    // Verificar se todos os elementos necessários estão presentes
    const requiredElements = [
        'chat-container',
        'message-input',
        'send-button'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        logger.error('Elementos necessários não encontrados', { 
            missingElements,
            criticalError: true
        });
        return;
    }

    // Inicializar o sistema de chat
    try {
        // O chatUI e streamingManager já são inicializados automaticamente
        // quando importados, então não precisamos fazer nada aqui
        logger.info('Sistema de chat inicializado com sucesso', {
            initialState: {
                conversationId: window.conversaAtual?.id || 'nova conversa',
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight
            }
        });
    } catch (error) {
        logger.error('Erro ao inicializar o sistema de chat', { 
            error: error.message,
            stack: error.stack 
        });
    }
});

// Configurar socket global com instrumentação de logs
const socket = io();

// Monitorar eventos Socket.IO
const originalEmit = socket.emit;
socket.emit = function (event, ...args) {
    logger.debug('Socket emitindo evento', { event, args });
    return originalEmit.apply(this, [event, ...args]);
};

socket.onAny((event, ...args) => {
    logger.debug('Socket recebendo evento', { 
        event, 
        args: event === 'message_chunk' ? 
            { chunk_size: args[0]?.content?.length || 0, conversation_id: args[0]?.conversation_id } : 
            args 
    });
});

socket.on('connect', () => logger.info('Socket conectado ao servidor'));
socket.on('disconnect', () => logger.warn('Socket desconectado do servidor'));
socket.on('connect_error', (error) => logger.error('Erro de conexão do Socket', { error }));

export default socket;