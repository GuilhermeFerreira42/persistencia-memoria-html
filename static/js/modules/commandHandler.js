
import { processYoutubeVideo } from './youtube/api.js';
import { adicionarMensagem } from '../chat.js';

export async function handleYoutubeCommand(url, chatContainer) {
    try {
        // Mostrar mensagem de carregamento
        const loadingMessage = 'Processando vídeo do YouTube...';
        adicionarMensagem(chatContainer, loadingMessage, 'assistant');
        
        // Processar vídeo
        const result = await processYoutubeVideo(url);
        
        if (result.status === 'success') {
            // Remover mensagem de carregamento
            chatContainer.lastElementChild.remove();
            
            // Exibir chunks de texto
            result.chunks.forEach(chunk => {
                adicionarMensagem(chatContainer, chunk, 'assistant');
            });
        } else {
            throw new Error(result.error || 'Erro desconhecido');
        }
    } catch (error) {
        // Remover mensagem de carregamento se existir
        if (chatContainer.lastElementChild?.textContent === loadingMessage) {
            chatContainer.lastElementChild.remove();
        }
        
        // Mostrar mensagem de erro
        adicionarMensagem(chatContainer, `Erro: ${error.message}`, 'assistant');
    }
}
