import { chatUI } from './chatUI.js';
import { streamingManager } from './modules/streamingManager.js';

// Garantir que o DOMPurify está disponível globalmente
if (typeof DOMPurify === 'undefined') {
    console.error('DOMPurify não está carregado. Verifique se o script está incluído corretamente.');
}

// Garantir que o marked está disponível globalmente
if (typeof marked === 'undefined') {
    console.error('Marked não está carregado. Verifique se o script está incluído corretamente.');
}

// Garantir que o Socket.IO está disponível globalmente
if (typeof io === 'undefined') {
    console.error('Socket.IO não está carregado. Verifique se o script está incluído corretamente.');
}

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se todos os elementos necessários estão presentes
    const requiredElements = [
        'chat-container',
        'message-input',
        'send-button'
    ];

    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error('Elementos necessários não encontrados:', missingElements);
        return;
    }

    // Inicializar o sistema de chat
    try {
        // O chatUI e streamingManager já são inicializados automaticamente
        // quando importados, então não precisamos fazer nada aqui
        console.log('Sistema de chat inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar o sistema de chat:', error);
    }
});