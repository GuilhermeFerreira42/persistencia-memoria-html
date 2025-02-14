
export function configureTextarea(textarea) {
    if (!textarea) return;

    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    textarea.addEventListener('keydown', function(e) {
        const nearestCommandMenu = document.querySelector('#command-menu, #chat-command-menu');
        const isMenuVisible = nearestCommandMenu && 
                            nearestCommandMenu.style.display === 'block';

        // Permitir nova linha com Shift+Enter
        if (e.key === 'Enter' && e.shiftKey) {
            return;
        }

        // Impedir submit se o menu estiver visível
        if (e.key === 'Enter' && isMenuVisible) {
            e.preventDefault();
            return;
        }

        // Submit normal se não houver menu visível e não for Shift+Enter
        if (e.key === 'Enter' && !e.shiftKey && !isMenuVisible) {
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
}
