
import { initCommandMenu } from '../commandMenu.js';
import { configureTextarea } from '../textarea.js';

const activeListeners = new WeakMap();

function handleSubmit(e, inputElement) {
    e.preventDefault();
    console.log('[DEBUG] Handle submit called');
    
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
        inputElement.closest('form').dispatchEvent(submitEvent);
    }
}

export function initializeInputBar(inputElement, menuElement, commands) {
    if (!inputElement || !menuElement) {
        console.error('Elementos necessários não fornecidos para initializeInputBar');
        return;
    }

    console.log('[DEBUG] Initializing input bar');

    // Limpar listeners antigos
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
        activeListeners.set(form, boundSubmitHandler);
    }

    // Adicionar atributos de acessibilidade
    inputElement.setAttribute('aria-label', 'Campo de mensagem');
    inputElement.setAttribute('aria-describedby', 'message-instructions');

    // Handler específico para Enter
    const keydownHandler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('[DEBUG] Enter key pressed');
            handleSubmit(e, inputElement);
        }
    };
    
    inputElement.addEventListener('keydown', keydownHandler);
    activeListeners.set(inputElement, keydownHandler);

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
    
    if (!inputElement) return;

    // Remover listener do input
    const keydownHandler = activeListeners.get(inputElement);
    if (keydownHandler) {
        inputElement.removeEventListener('keydown', keydownHandler);
        activeListeners.delete(inputElement);
    }

    // Remover listener do form
    const form = inputElement.closest('form');
    if (form) {
        const submitHandler = activeListeners.get(form);
        if (submitHandler) {
            form.removeEventListener('submit', submitHandler);
            activeListeners.delete(form);
        }
        
        // Garantir limpeza completa clonando o form
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
    }
}
