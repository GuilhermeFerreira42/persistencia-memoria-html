
import { initCommandMenu } from '../commandMenu.js';
import { configureTextarea } from '../textarea.js';

const activeListeners = new WeakMap();

function handleSubmit(e, inputElement) {
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
        e.target.dispatchEvent(submitEvent);
    }
}

export function initializeInputBar(inputElement, menuElement, commands) {
    if (!inputElement || !menuElement) {
        console.error('Elementos necessários não fornecidos para initializeInputBar');
        return;
    }

    // Limpar listeners antigos se existirem
    destroyInputBar(inputElement);

    // Configurar textarea (autoajuste de altura e eventos)
    configureTextarea(inputElement);

    // Configurar menu de comandos
    initCommandMenu(inputElement, menuElement, commands);

    // Adicionar evento de submit unificado
    const form = inputElement.closest('form');
    if (form) {
        const boundSubmitHandler = (e) => handleSubmit(e, inputElement);
        form.addEventListener('submit', boundSubmitHandler);
        
        // Armazenar referência ao listener para limpeza posterior
        activeListeners.set(form, boundSubmitHandler);
    }

    // Adicionar atributos de acessibilidade
    inputElement.setAttribute('aria-label', 'Campo de mensagem');
    inputElement.setAttribute('aria-describedby', 'message-instructions');

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
        },
        destroy: () => destroyInputBar(inputElement)
    };
}

export function destroyInputBar(inputElement) {
    const form = inputElement.closest('form');
    if (form) {
        // Remover listener específico se existir
        const listener = activeListeners.get(form);
        if (listener) {
            form.removeEventListener('submit', listener);
            activeListeners.delete(form);
        }
    }
}
