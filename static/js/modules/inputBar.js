
import { initCommandMenu } from '../commandMenu.js';
import { configureTextarea } from '../textarea.js';

const activeListeners = new WeakMap();

function handleSubmit(e, inputElement, form) {
    e.preventDefault();
    console.log('[DEBUG] Handle submit called');
    
    const message = inputElement.value.trim();
    if (!message) return;
    
    // Não enviar se for comando incompleto
    if (message.startsWith('/') && !message.includes(' ')) {
        return;
    }

    // Disparar evento customizado
    const submitEvent = new CustomEvent('submit', { 
        bubbles: true,
        cancelable: true
    });
    form.dispatchEvent(submitEvent);
}

export function initializeInputBar(inputElement, menuElement, commands) {
    if (!inputElement || !menuElement) {
        console.error('Elementos necessários não fornecidos para initializeInputBar');
        return;
    }

    console.log('[DEBUG] Initializing input bar');

    // Limpar listeners antigos
    destroyInputBar(inputElement);

    // Configurar textarea
    configureTextarea(inputElement);

    // Configurar menu de comandos
    initCommandMenu(inputElement, menuElement, commands);

    // Adicionar novo handler de submit
    const form = inputElement.closest('form');
    if (form) {
        const boundSubmitHandler = (e) => handleSubmit(e, inputElement, form);
        form.addEventListener('submit', boundSubmitHandler);
        activeListeners.set(form, boundSubmitHandler);
    }

    // Adicionar atributos de acessibilidade
    inputElement.setAttribute('aria-label', 'Campo de mensagem');
    inputElement.setAttribute('aria-describedby', 'message-instructions');

    // Handler específico para Enter
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('[DEBUG] Enter key pressed');
            const form = inputElement.closest('form');
            if (form) {
                handleSubmit(e, inputElement, form);
            }
        }
    });

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
    console.log('[DEBUG] Destroying input bar');
    
    const form = inputElement.closest('form');
    if (form) {
        // Remover listeners específicos
        const listener = activeListeners.get(form);
        if (listener) {
            form.removeEventListener('submit', listener);
            activeListeners.delete(form);
        }

        // Garantir limpeza completa de listeners
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
    }
}
