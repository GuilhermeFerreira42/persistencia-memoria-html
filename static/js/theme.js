
// Estado do tema
let currentTheme = 'light';

// Função para alternar o tema
export function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
}

// Função para aplicar o tema
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = theme === 'light' 
            ? '<i class="fas fa-moon"></i>' 
            : '<i class="fas fa-sun"></i>';
    }
    
    // Atualizar meta tag para tema do navegador em dispositivos móveis
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', 
            theme === 'light' ? '#f9f9fb' : '#1e1e20');
    }
}

// Função para inicializar o tema
export function initializeTheme() {
    // Verificar preferência do sistema
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Verificar tema salvo ou usar preferência do sistema
    const savedTheme = localStorage.getItem('theme');
    currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    // Aplicar tema
    applyTheme(currentTheme);
    
    // Ouvir mudanças na preferência do sistema
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
        if (!localStorage.getItem('theme')) {
            currentTheme = event.matches ? 'dark' : 'light';
            applyTheme(currentTheme);
        }
    });
}
