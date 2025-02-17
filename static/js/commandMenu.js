
// static/js/commandMenu.js
export function initCommandMenu(inputElement, menuElement, commands = ['/youtube', '/google', '/help', '/settings']) {
    let selectedIndex = -1;
    const items = [];

    // Remover o menu do contêiner atual e adicioná-lo ao body para evitar clipping
    if (menuElement.parentNode !== document.body) {
        menuElement.parentNode.removeChild(menuElement);
        document.body.appendChild(menuElement);
    }

    if (!inputElement || !menuElement) {
        console.error('Elementos de input ou menu não foram fornecidos.');
        return;
    }

    // Quando o usuário digitar, verifica se o texto começa com '/'
    inputElement.addEventListener('input', function() {
        const text = this.value;
        
        // Mostrar menu apenas quando o '/' estiver no início
        if (text.startsWith('/')) {
            const filtered = commands.filter(cmd => cmd.toLowerCase().startsWith(text.toLowerCase()));
            menuElement.innerHTML = filtered.map(cmd => `
                <div class="command-item" data-command="${cmd}">
                    <div>
                        <div class="command-text">${cmd}</div>
                        <div class="command-description">Descrição para ${cmd}</div>
                    </div>
                </div>
            `).join('');

            menuElement.querySelectorAll('.command-item').forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const command = this.dataset.command;
                    inputElement.value = command + ' '; // Adiciona espaço após o comando
                    menuElement.classList.remove('visible');
                    inputElement.focus();
                    
                    // Move o cursor para o final
                    inputElement.selectionStart = inputElement.selectionEnd = command.length + 1;
                });
            });

            menuElement.style.visibility = 'hidden';
            menuElement.classList.add('visible');

            requestAnimationFrame(() => {
                const menuHeight = menuElement.offsetHeight;
                const rect = inputElement.getBoundingClientRect();
                menuElement.style.top = `${rect.top - menuHeight + window.scrollY}px`;
                menuElement.style.left = `${rect.left + window.scrollX}px`;
                menuElement.style.visibility = 'visible';
            });
        } else {
            menuElement.classList.remove('visible');
        }
    });

    function updateSelectedItem() {
        items.forEach((item, index) => 
            item.classList.toggle('selected', index === selectedIndex)
        );
        
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({
                block: 'nearest',
                behavior: 'auto'
            });
        }
    }

    function handleKeyDown(e) {
        if (!menuElement.classList.contains('visible')) return;

        switch(e.key) {
            case 'Escape':
                e.preventDefault();
                menuElement.classList.remove('visible');
                selectedIndex = -1;
                updateSelectedItem();
                break;
                
            case 'Enter':
                e.preventDefault(); // Impedir o envio do formulário
                if (selectedIndex > -1 && items[selectedIndex]) {
                    items[selectedIndex].click();
                    menuElement.classList.remove('visible');
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelectedItem();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelectedItem();
                break;
        }
    }

    inputElement.addEventListener('keydown', handleKeyDown);

    const observer = new MutationObserver(() => {
        items.length = 0;
        menuElement.querySelectorAll('.command-item').forEach(item => items.push(item));
        selectedIndex = -1;
        updateSelectedItem();
    });

    observer.observe(menuElement, { childList: true, subtree: true });
}
