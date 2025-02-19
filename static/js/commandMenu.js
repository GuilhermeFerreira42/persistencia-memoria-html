export function initCommandMenu(inputElement, menuElement, commands = ['/youtube', '/google', '/help', '/settings']) {
    let selectedIndex = -1;
    const items = [];

    if (!inputElement || !menuElement) {
        console.error('Elementos de input ou menu não foram fornecidos.');
        return;
    }

    // Garantir que o menu seja filho do container do input para posicionamento relativo
    const inputContainer = inputElement.parentElement;
    if (inputContainer && menuElement.parentNode !== inputContainer) {
        if (menuElement.parentNode) {
            menuElement.parentNode.removeChild(menuElement);
        }
        inputContainer.appendChild(menuElement);
    }

    // Resetar estilos iniciais
    menuElement.style.display = 'none';
    menuElement.classList.remove('visible');
    menuElement.style.position = 'absolute';
    menuElement.style.width = '100%';
    menuElement.style.left = '0';

    // Quando o usuário digitar, verifica se o texto começa com '/'
    inputElement.addEventListener('input', function() {
        const text = this.value;
        
        if (text.startsWith('/')) {
            const filtered = commands.filter(cmd => 
                cmd.toLowerCase().startsWith(text.toLowerCase())
            );

            if (filtered.length > 0) {
                menuElement.innerHTML = filtered.map(cmd => `
                    <div class="command-item" role="option" data-command="${cmd}">
                        <div class="command-text">${cmd}</div>
                        <div class="command-description">Descrição para ${cmd}</div>
                    </div>
                `).join('');

                menuElement.querySelectorAll('.command-item').forEach(item => {
                    item.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const command = this.dataset.command;
                        inputElement.value = command + ' ';
                        menuElement.classList.remove('visible');
                        menuElement.style.display = 'none';
                        inputElement.focus();
                        inputElement.selectionStart = inputElement.selectionEnd = inputElement.value.length;
                    });
                });

                menuElement.style.display = 'block';
                menuElement.classList.add('visible');
            } else {
                menuElement.classList.remove('visible');
                menuElement.style.display = 'none';
            }
        } else {
            menuElement.classList.remove('visible');
            menuElement.style.display = 'none';
        }
    });

    function updateSelectedItem() {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
            item.setAttribute('aria-selected', index === selectedIndex);
        });
        
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({
                block: 'nearest',
                behavior: 'auto'
            });
        }
    }

    inputElement.addEventListener('keydown', function(e) {
        if (!menuElement.classList.contains('visible')) return;

        switch(e.key) {
            case 'Escape':
                e.preventDefault();
                menuElement.classList.remove('visible');
                menuElement.style.display = 'none';
                selectedIndex = -1;
                updateSelectedItem();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (selectedIndex > -1 && items[selectedIndex]) {
                    items[selectedIndex].click();
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                if (selectedIndex === -1 && items.length > 0) selectedIndex = 0;
                updateSelectedItem();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelectedItem();
                break;
        }
    });

    // Observer para atualizar itens quando o conteúdo do menu mudar
    const observer = new MutationObserver(() => {
        items.length = 0;
        menuElement.querySelectorAll('.command-item').forEach(item => items.push(item));
        selectedIndex = -1;
        updateSelectedItem();
    });

    observer.observe(menuElement, { childList: true, subtree: true });

    // Clicar fora fecha o menu
    document.addEventListener('click', (e) => {
        if (!menuElement.contains(e.target) && e.target !== inputElement) {
            menuElement.classList.remove('visible');
            menuElement.style.display = 'none';
        }
    });
}
