
/**
 * Inicializa o menu de comandos
 * @param {HTMLElement} inputElement - Campo de texto que ativará o menu
 * @param {HTMLElement} menuElement - Elemento do menu de comandos
 * @param {string[]} commands - Lista de comandos disponíveis
 */
export function initCommandMenu(inputElement, menuElement, commands = []) {
    let selectedIndex = -1;
    const items = [];

    // Remover o menu do contêiner atual e adicioná-lo ao body para evitar clipping
    if (menuElement.parentNode !== document.body) {
        menuElement.parentNode.removeChild(menuElement);
        document.body.appendChild(menuElement);
    }

    function repositionMenu() {
        if (!menuElement.classList.contains('visible')) return;

        const rect = inputElement.getBoundingClientRect();
        const menuHeight = menuElement.offsetHeight;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        // Decidir se abre para cima ou para baixo
        menuElement.style.visibility = 'hidden';
        menuElement.style.display = 'block';
        
        if (spaceBelow < menuHeight && rect.top > menuHeight) {
            // Abrir para cima
            menuElement.style.top = `${rect.top - menuHeight + window.scrollY}px`;
        } else {
            // Abrir para baixo
            menuElement.style.top = `${rect.bottom + window.scrollY}px`;
        }
        
        menuElement.style.left = `${rect.left + window.scrollX}px`;
        menuElement.style.width = `${rect.width}px`;
        menuElement.style.visibility = 'visible';
    }

    // Quando o usuário digitar, verifica se o texto começa com '/'
    inputElement.addEventListener('input', function() {
        const text = this.value;
        
        if (text.startsWith('/')) {
            const query = text.slice(1).toLowerCase();
            const filtered = commands.filter(cmd => 
                cmd.toLowerCase().startsWith(query)
            );
            
            menuElement.innerHTML = filtered.map(cmd => `
                <div class="command-item" data-command="${cmd}">
                    <div class="command-text">/${cmd}</div>
                    <div class="command-description">Descrição para ${cmd}</div>
                </div>
            `).join('');

            menuElement.classList.add('visible');
            repositionMenu();
            
            // Reset selection
            selectedIndex = -1;
            updateSelectedItem();
        } else {
            menuElement.classList.remove('visible');
        }
    });

    function updateSelectedItem() {
        const items = menuElement.querySelectorAll('.command-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }

    // Eventos de teclado para navegação
    inputElement.addEventListener('keydown', function(e) {
        if (!menuElement.classList.contains('visible')) return;

        const items = menuElement.querySelectorAll('.command-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelectedItem();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedItem();
                break;
                
            case 'Enter':
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    e.preventDefault();
                    const command = items[selectedIndex].dataset.command;
                    this.value = '/' + command + ' ';
                    menuElement.classList.remove('visible');
                }
                break;
                
            case 'Escape':
                menuElement.classList.remove('visible');
                break;
        }
    });

    // Fechar menu ao clicar fora
    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !menuElement.contains(e.target)) {
            menuElement.classList.remove('visible');
        }
    });

    // Atualizar posição ao rolar/redimensionar
    window.addEventListener('scroll', repositionMenu);
    window.addEventListener('resize', repositionMenu);
}
