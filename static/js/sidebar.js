export function toggleSidebar() {
    console.log('[DEBUG] Função toggleSidebar chamada');
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
}
