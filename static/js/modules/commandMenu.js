
/**
 * Inicializa o menu de comandos para um elemento de input
 * @param {HTMLElement} inputElement - Elemento de input que ativará o menu
 * @param {HTMLElement} menuElement - Elemento do menu de comandos
 * @param {string[]} commands - Lista de comandos disponíveis
 */
export function initCommandMenu(inputElement, menuElement, commands = []) {
    console.log('Inicializando menu de comandos');
    let selectedIndex = -1;
    const items = [];

    // Remover o menu do contêiner atual e adicioná-lo ao body para evitar clipping
    if (menuElement.parentNode !== document.body) {
        document.body.appendChild(menuElement);
    }

    function positionMenu() {
        const rect = inputElement.getBoundingClientRect();
        const menuHeight = menuElement.offsetHeight;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        // Decidir se abre para cima ou para baixo
        if (spaceBelow < menuHeight && rect.top > menuHeight) {
            // Abrir para cima
            menuElement.style.top = `${rect.top - menuHeight}px`;
        } else {
            // Abrir para baixo
            menuElement.style.top = `${rect.bottom}px`;
        }
        menuElement.style.left = `${rect.left}px`;
        menuElement.style.width = `${rect.width}px`;
    }

    inputElement.addEventListener('input', function() {
        const text = this.value;
        if (text.startsWith('/')) {
            const filtered = commands.filter(cmd => 
                cmd.toLowerCase().startsWith(text.toLowerCase())
            );
            
            menuElement.innerHTML = filtered.map(cmd => `
                <div class="command-item" data-command="${cmd}">
                    <div class="command-text">${cmd}</div>
                    <div class="command-description">Descrição para ${cmd}</div>
                </div>
            `).join('');

            menuElement.style.display = 'block';
            positionMenu();
            selectedIndex = -1;
            updateSelectedItem();
        } else {
            menuElement.style.display = 'none';
        }
    });

    function updateSelectedItem() {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }

    inputElement.addEventListener('keydown', function(e) {
        if (menuElement.style.display === 'block') {
            switch(e.key) {
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
                    
                case 'Enter':
                    if (selectedIndex >= 0 && items[selectedIndex]) {
                        e.preventDefault();
                        const command = items[selectedIndex].dataset.command;
                        this.value = command + ' ';
                        menuElement.style.display = 'none';
                    }
                    break;
                    
                case 'Escape':
                    menuElement.style.display = 'none';
                    break;
            }
        }
    });

    // Atualizar posição ao rolar/redimensionar
    window.addEventListener('scroll', positionMenu);
    window.addEventListener('resize', positionMenu);

    // Fechar menu ao clicar fora
    document.addEventListener('click', function(e) {
        if (!inputElement.contains(e.target) && !menuElement.contains(e.target)) {
            menuElement.style.display = 'none';
        }
    });
}
