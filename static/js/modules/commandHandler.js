(function() { // IIFE para isolamento de escopo
    const COMMAND_PREFIX = '/';
    const COMMANDS = ['/youtube', '/google', '/help', '/settings'];
    
    class CommandMenu {
        constructor() {
            this.input = document.getElementById('chat-input');
            if (!this.input) {
                console.error('[Erro] Elemento #chat-input não encontrado');
                return;
            }
            
            this.initMenu();
            this.setupListeners();
        }

        initMenu() {
            this.menu = document.createElement('div');
            this.menu.className = 'cmd-menu';
            document.body.appendChild(this.menu);
        }

        setupListeners() {
            this.input.addEventListener('input', () => this.handleInput());
            document.addEventListener('click', (e) => this.handleOutsideClick(e));
            this.menu.addEventListener('click', (e) => this.handleMenuClick(e));
        }

        handleInput() {
            const text = this.input.value.trim();
            
            if (text.startsWith(COMMAND_PREFIX)) {
                this.positionMenu();
                this.filterCommands(text);
            } else {
                this.hideMenu();
            }
        }

        positionMenu() {
            const rect = this.input.getBoundingClientRect();
            this.menu.style.top = `${rect.bottom + window.scrollY}px`;
            this.menu.style.left = `${rect.left}px`;
            this.menu.classList.add('visible');
        }

        filterCommands(text) {
            this.menu.innerHTML = COMMANDS
                .filter(cmd => cmd.toLowerCase().startsWith(text.toLowerCase()))
                .map(cmd => `<div class="cmd-item" data-cmd="${cmd}">${cmd}</div>`)
                .join('');
        }

        handleMenuClick(e) {
            const item = e.target.closest('.cmd-item');
            if (item) {
                this.input.value = `${item.dataset.cmd} `;
                this.hideMenu();
                this.input.focus();
            }
        }

        handleOutsideClick(e) {
            if (!this.input.contains(e.target) && !this.menu.contains(e.target)) {
                this.hideMenu();
            }
        }

        hideMenu() {
            this.menu.classList.remove('visible');
        }
    }

    // Inicialização segura após DOM carregado
    document.addEventListener('DOMContentLoaded', () => {
        new CommandMenu();
    });
})();
