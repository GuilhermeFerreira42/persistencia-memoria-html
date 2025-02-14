
export function configureTextarea(textarea) {
    if (!textarea) return;

    // Ajusta altura automaticamente
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Gerencia eventos de teclado
    textarea.addEventListener('keydown', function(e) {
        const nearestCommandMenu = document.querySelector('.command-menu.visible');
        
        // Permitir nova linha com Shift+Enter
        if (e.key === 'Enter' && e.shiftKey) {
            return;
        }

        // Se o menu de comandos estiver visível
        if (e.key === 'Enter' && nearestCommandMenu) {
            e.preventDefault();
            const selectedCommand = nearestCommandMenu.querySelector('.command-item.selected');
            if (selectedCommand) {
                this.value = `/${selectedCommand.dataset.command} `;
                nearestCommandMenu.classList.remove('visible');
            }
            return;
        }

        // Submit do formulário quando pressionar Enter (sem Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const form = this.closest('form');
            if (form) {
                const submitEvent = new Event('submit', {
                    bubbles: true,
                    cancelable: true
                });
                form.dispatchEvent(submitEvent);
            }
        }
    });
}
