export function initCommandMenu(inputElement, menuElement, commands = ['/youtube', '/google', '/help', '/settings']) {
    let selectedIndex = -1;
    const items = [];

    // Garantir que o menu esteja no body para evitar problemas de posicionamento
    if (menuElement.parentNode !== document.body) {
        menuElement.parentNode.removeChild(menuElement);
        document.body.appendChild(menuElement);
    }

    // Resetar estilos inline que podem estar causando problemas
    menuElement.style.display = 'none';
    menuElement.style.visibility = 'hidden';
    menuElement.style.position = 'fixed';
    menuElement.classList.remove('visible');

    if (!inputElement || !menuElement) {
        console.error('Elementos de input ou menu não foram fornecidos.');
        return;
    }

    function updateMenuPosition() {
        requestAnimationFrame(() => {
            const rect = inputElement.getBoundingClientRect();
            const menuHeight = menuElement.offsetHeight || 200;
            const spaceBelow = window.innerHeight - rect.bottom;
            
            // Sempre posicionar acima do input
            const topPosition = rect.top - menuHeight - 5; // 5px de margem
            
            menuElement.style.top = `${topPosition + window.scrollY}px`;
            menuElement.style.left = `${rect.left + window.scrollX}px`;
            menuElement.style.width = `${rect.width}px`;
            menuElement.style.visibility = 'visible';
        });
    }

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
                        inputElement.value = command + ' ';
                        menuElement.classList.remove('visible');
                        menuElement.style.display = 'none';
                        inputElement.focus();
                        inputElement.selectionStart = inputElement.selectionEnd = inputElement.value.length;
                    });
                });

                menuElement.style.display = 'block';
                menuElement.classList.add('visible');
                updateMenuPosition();
            } else {
                menuElement.classList.remove('visible');
                menuElement.style.display = 'none';
            }
        } else {
            menuElement.classList.remove('visible');
            menuElement.style.display = 'none';
        }
    });

    // Atualizar posição do menu ao rolar a página
    window.addEventListener('scroll', () => {
        if (menuElement.classList.contains('visible')) {
            updateMenuPosition();
        }
    });

    // Atualizar posição do menu ao redimensionar a janela
    window.addEventListener('resize', () => {
        if (menuElement.classList.contains('visible')) {
            updateMenuPosition();
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
