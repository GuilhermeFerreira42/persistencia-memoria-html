// Estado do tema
let currentTheme = 'light';

// Função para alternar o tema
export function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = currentTheme === 'light' 
            ? '<i class="fas fa-moon"></i>' 
            : '<i class="fas fa-sun"></i>';
    }
}

// Função para inicializar o tema
export function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        toggleTheme();
    }
}