export function escapeHTML(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

export function copiarMensagem(button) {
    const mensagem = button.closest('.message').querySelector('p').textContent;
    navigator.clipboard.writeText(mensagem);
}

export function regenerarResposta(button) {
    const mensagem = button.closest('.message').previousElementSibling.querySelector('p').textContent;
    const chatContainer = button.closest('.chat-container');
    const chatInput = document.querySelector('#chat-input');
    const sendBtn = document.querySelector('#send-btn');
    const stopBtn = document.querySelector('#stop-btn');
    
    if (chatInput && sendBtn && stopBtn) {
        chatInput.value = mensagem;
        const form = chatInput.closest('form');
        if (form) {
            form.dispatchEvent(new Event('submit'));
        }
    }
}