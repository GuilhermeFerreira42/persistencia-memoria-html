
export function configureTextarea(textarea) {
    if (!textarea) return;

    // Configurar altura inicial
    textarea.style.height = 'auto';
    
    // Evento de input para ajustar altura automaticamente
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        const newHeight = Math.min(this.scrollHeight, 120); // Limitar altura máxima
        this.style.height = newHeight + 'px';
    });

    // Atalho de teclado para enviar com Enter
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = this.closest('form');
            if (form) {
                const event = new Event('submit', {
                    'bubbles': true,
                    'cancelable': true
                });
                form.dispatchEvent(event);
            }
        }
    });
    
    // Foco automático
    textarea.focus();
}
