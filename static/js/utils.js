export function escapeHTML(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

export function mostrarCarregamento(chatContainer) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading message assistant';
    loadingDiv.setAttribute('data-no-markdown', 'true');
    loadingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}