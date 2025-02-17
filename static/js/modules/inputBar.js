
import { initCommandMenu } from '../commandMenu.js';
import { configureTextarea } from '../textarea.js';

export function initializeInputBar(inputElement, menuElement, commands) {
    if (!inputElement || !menuElement) {
        console.error('Elementos necessários não fornecidos para initializeInputBar');
        return;
    }

    // Configurar textarea (autoajuste de altura e eventos)
    configureTextarea(inputElement);

    // Configurar menu de comandos
    initCommandMenu(inputElement, menuElement, commands);

    // Adicionar evento de submit unificado
    const form = inputElement.closest('form');
    if (form) {
        // Remover evento anterior se existir
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const message = inputElement.value.trim();
            
            // Não enviar se for comando incompleto
            if (message.startsWith('/') && !message.includes(' ')) {
                return;
            }

            if (message) {
                const submitEvent = new CustomEvent('customSubmit', { 
                    detail: { message },
                    bubbles: true 
                });
                form.dispatchEvent(submitEvent);
            }
        });
    }

    return {
        focus: () => inputElement.focus(),
        clear: () => {
            inputElement.value = '';
            inputElement.style.height = 'auto';
        },
        getValue: () => inputElement.value,
        setValue: (value) => {
            inputElement.value = value;
            inputElement.style.height = 'auto';
            inputElement.style.height = inputElement.scrollHeight + 'px';
        }
    };
}
