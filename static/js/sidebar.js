
export function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent) {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // Salvar o estado da barra lateral no localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
}

export function initSidebar() {
    // Verificar o estado salvo da barra lateral
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (sidebar && mainContent && sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
    }
    
    // Ajustar para dispositivos móveis
    if (window.innerWidth <= 768) {
        sidebar?.classList.add('collapsed');
        mainContent?.classList.add('expanded');
    }
    
    // Detectar redimensionamento da janela
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            sidebar?.classList.add('collapsed');
            mainContent?.classList.add('expanded');
        }
    });
    
    // Configurar menu de contexto para os itens da barra lateral
    document.querySelectorAll('.chat-item').forEach(item => {
        const moreBtn = item.querySelector('.more-btn');
        const optionsMenu = item.querySelector('.chat-options-menu');
        
        if (moreBtn && optionsMenu) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsMenu.classList.toggle('visible');
                
                // Fechar outros menus abertos
                document.querySelectorAll('.chat-options-menu.visible').forEach(menu => {
                    if (menu !== optionsMenu) {
                        menu.classList.remove('visible');
                    }
                });
            });
        }
    });
    
    // Ocultar menus ao clicar em qualquer lugar fora deles
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-btn')) {
            document.querySelectorAll('.chat-options-menu.visible').forEach(menu => {
                menu.classList.remove('visible');
            });
        }
    });
}
