
import { 
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    mostrarCarregamento
} from './chat/chatUI.js';

import {
    enviarMensagem,
    interromperResposta
} from './chat/chatActions.js';

import {
    carregarConversa,
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
} from './chat/chatStorage.js';

// Função para copiar código
window.copiarCodigo = function(button) {
    const codeContainer = button.closest('.code-container');
    const codeBlock = codeContainer.querySelector('.code-block code');
    const code = codeBlock.textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Retornar ao estado original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar código:', err);
        alert('Não foi possível copiar o código. Por favor, tente novamente.');
    });
};

// Função para copiar mensagem completa
window.copiarMensagem = function(button) {
    const messageDiv = button.closest('.message');
    const content = messageDiv.querySelector('.message-content').textContent;
    
    navigator.clipboard.writeText(content).then(() => {
        // Feedback visual
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.classList.add('copied');
        
        // Retornar ao estado original após 2 segundos
        setTimeout(() => {
            button.innerHTML = '<i class="fas fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar mensagem:', err);
        alert('Não foi possível copiar a mensagem. Por favor, tente novamente.');
    });
};

export {
    iniciarChat,
    mostrarTelaInicial,
    adicionarMensagem,
    enviarMensagem,
    interromperResposta,
    carregarConversa,
    atualizarListaConversas,
    criarNovaConversa,
    adicionarMensagemAoHistorico,
    renomearConversa,
    excluirConversa
};
