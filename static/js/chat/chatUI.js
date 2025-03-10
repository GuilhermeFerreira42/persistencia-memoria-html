
import { escapeHTML } from './chatUtils.js';
import { renderMessage, renderStreamingMessage } from '../messageRenderer.js';
import { melhorarBlocosCodigo, configurarDeteccaoRolagem, conversasCache } from './chatUtils.js';

// Variável para armazenar a mensagem atual sendo recebida via streaming
let mensagemStreamingAtual = null;
let textoAcumulado = '';

export function iniciarChat(welcomeScreen, chatContainer, inputContainer) {
    welcomeScreen.style.display = 'none';
    chatContainer.style.display = 'block';
    inputContainer.style.display = 'block';
    chatContainer.innerHTML = '';
    
    // Verificar se há uma conversa carregada na estrutura global
    const conversationId = window.conversaAtual?.id;
    if (conversationId && window.conversations && window.conversations[conversationId]) {
        console.log(`[DEBUG] Iniciando chat para conversa: ${conversationId}`);
        
        // Configurar detecção de rolagem para lazy loading
        configurarDeteccaoRolagem(
            chatContainer,
            () => carregarMensagensAnteriores(conversationId, chatContainer),
            null
        );
        
        // Iniciar com um lote de mensagens para evitar tela em branco
        carregarMensagensIniciais(conversationId, chatContainer);
    } else {
        console.log('[DEBUG] Iniciando chat sem conversa ativa');
    }
}

// Função para carregar o lote inicial de mensagens (mais recentes)
async function carregarMensagensIniciais(conversationId, chatContainer) {
    // Verifica se já temos no cache
    if (conversasCache[conversationId]) {
        console.log(`[DEBUG] Usando cache para conversa: ${conversationId}`);
        renderizarMensagensDoCache(conversationId, chatContainer);
        return;
    }
    
    try {
        console.log(`[DEBUG] Carregando mensagens iniciais para conversa: ${conversationId}`);
        const response = await fetch(`/get_conversation/${conversationId}`);
        
        if (response.ok) {
            const data = await response.json();
            
            // Armazenar no cache
            conversasCache[conversationId] = data;
            
            // Mostrar as últimas X mensagens (ajuste conforme necessário)
            const mensagens = data.messages || [];
            const ultimasMensagens = mensagens.slice(-20); // Últimas 20 mensagens
            
            chatContainer.innerHTML = ''; // Limpar o container
            
            // Adicionar cada mensagem ao chat
            ultimasMensagens.forEach(msg => {
                adicionarMensagem(chatContainer, msg.content, msg.role);
            });
            
            // Rolar para o final automaticamente
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            console.error(`[ERRO] Falha ao carregar conversa: ${conversationId}`);
        }
    } catch (error) {
        console.error('[ERRO] Erro ao carregar mensagens iniciais:', error);
    }
}

// Função para carregar mensagens anteriores (quando o usuário rola para cima)
async function carregarMensagensAnteriores(conversationId, chatContainer) {
    // Implementar aqui o carregamento de mensagens anteriores
    // Esta função seria chamada quando o usuário rola para o topo do chat
    console.log('[DEBUG] Carregando mensagens anteriores...');
    
    // Exemplo simples - na implementação real você usaria offset e limit
    // e manteria controle de quais mensagens já foram carregadas
}

// Renderiza mensagens do cache
function renderizarMensagensDoCache(conversationId, chatContainer) {
    const data = conversasCache[conversationId];
    if (!data || !data.messages) return;
    
    const mensagens = data.messages;
    const ultimasMensagens = mensagens.slice(-20); // Últimas 20 mensagens
    
    chatContainer.innerHTML = ''; // Limpar o container
    
    // Adicionar cada mensagem ao chat
    ultimasMensagens.forEach(msg => {
        adicionarMensagem(chatContainer, msg.content, msg.role);
    });
    
    // Rolar para o final automaticamente
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function mostrarTelaInicial(welcomeScreen, chatContainer, inputContainer, welcomeInput, chatInput) {
    welcomeScreen.style.display = 'flex';
    chatContainer.style.display = 'none';
    inputContainer.style.display = 'none';
    welcomeInput.value = '';
    if (chatInput) chatInput.value = '';
    
    // Limpar referência da conversa atual para evitar mistura de contextos
    window.conversaAtual = null;
    console.log('[DEBUG] Retornando para tela inicial, conversa atual limpa');
}

export function adicionarMensagem(chatContainer, texto, tipo) {
    // Verificar se o contêiner de chat existe
    if (!chatContainer) {
        console.error('[ERRO] Contêiner de chat não encontrado ao adicionar mensagem');
        return;
    }
    
    // Verificar se há uma conversa ativa
    const conversationId = window.conversaAtual?.id;
    if (!conversationId) {
        console.warn('[AVISO] Tentando adicionar mensagem sem conversa ativa');
    } else {
        console.log(`[DEBUG] Adicionando mensagem à conversa ${conversationId}, tipo: ${tipo}`);
    }
    
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = `message ${tipo}`;
    
    // Associar ID da conversa para garantir isolamento
    if (conversationId) {
        mensagemDiv.dataset.conversationId = conversationId;
    }
    
    // Processamento de Markdown para mensagens do assistente
    let conteudoHtml;
    if (tipo === 'assistant') {
        // Aplicar formatação Markdown apenas nas mensagens do assistente
        conteudoHtml = renderMessage(texto);
        console.log('[DEBUG] HTML renderizado (primeiros 150 caracteres):', conteudoHtml.substring(0, 150) + '...');
    } else {
        // Para mensagens do usuário, apenas escape HTML e quebras de linha
        conteudoHtml = `<p>${escapeHTML(texto).replace(/\n/g, '<br>')}</p>`;
    }
    
    const conteudo = `
        <div class="message-content">${conteudoHtml}</div>
        <div class="message-actions">
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            ${tipo === 'assistant' ? `
                <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                    <i class="fas fa-redo"></i>
                </button>
            ` : ''}
        </div>
    `;
    
    mensagemDiv.innerHTML = conteudo;
    chatContainer.appendChild(mensagemDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Melhorar os blocos de código imediatamente após adicionar a mensagem
    if (tipo === 'assistant') {
        setTimeout(() => {
            console.log('[DEBUG] Aplicando melhorias aos blocos de código...');
            melhorarBlocosCodigo();
        }, 0);
    }
    
    return mensagemDiv;
}

// Nova função para iniciar streaming de mensagem
export function iniciarStreamingMensagem(chatContainer) {
    // Limpar streaming anterior, se houver
    if (mensagemStreamingAtual) {
        console.log('[DEBUG] Finalizando streaming anterior');
        finalizarStreamingMensagem();
    }
    
    textoAcumulado = '';
    
    const mensagemDiv = document.createElement('div');
    mensagemDiv.className = 'message assistant streaming';
    
    // Associar ID da conversa para garantir isolamento
    const conversationId = window.conversaAtual?.id;
    if (conversationId) {
        mensagemDiv.dataset.conversationId = conversationId;
    }
    
    mensagemDiv.innerHTML = `
        <div class="message-content"></div>
        <div class="message-actions" style="display: none;">
            <button class="action-btn copy-btn" onclick="window.copiarMensagem(this)" title="Copiar mensagem">
                <i class="fas fa-copy"></i>
            </button>
            <button class="action-btn regenerate-btn" onclick="window.regenerarResposta(this)" title="Regenerar resposta">
                <i class="fas fa-redo"></i>
            </button>
        </div>
    `;
    
    chatContainer.appendChild(mensagemDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    mensagemStreamingAtual = {
        element: mensagemDiv,
        content: mensagemDiv.querySelector('.message-content'),
        actions: mensagemDiv.querySelector('.message-actions')
    };
    
    return mensagemStreamingAtual;
}

// Atualiza a mensagem de streaming com novo conteúdo
export function atualizarStreamingMensagem(chunk) {
    if (!mensagemStreamingAtual) return;
    
    // Acumular o texto para formatação posterior
    textoAcumulado += chunk;
    
    // Renderizar com formatação parcial
    mensagemStreamingAtual.content.innerHTML = renderStreamingMessage(textoAcumulado);
    
    // Rolar para o final automaticamente
    const chatContainer = mensagemStreamingAtual.element.parentElement;
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Finaliza o streaming de mensagem
export function finalizarStreamingMensagem() {
    if (!mensagemStreamingAtual) return;
    
    // Aplicar formatação Markdown completa
    mensagemStreamingAtual.content.innerHTML = renderMessage(textoAcumulado);
    
    // Mostrar botões de ação
    mensagemStreamingAtual.actions.style.display = '';
    
    // Remover classe de streaming
    mensagemStreamingAtual.element.classList.remove('streaming');
    
    // Melhorar blocos de código
    setTimeout(() => {
        melhorarBlocosCodigo();
    }, 0);
    
    // Limpar referência
    mensagemStreamingAtual = null;
    textoAcumulado = '';
}

export function mostrarCarregamento(chatContainer) {
    // Verificar se o contêiner de chat existe
    if (!chatContainer) {
        console.error('[ERRO] Contêiner de chat não encontrado ao mostrar carregamento');
        return document.createElement('div'); // Retorna um div vazio como fallback
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading message assistant';
    
    // Associar ID da conversa para garantir isolamento
    const conversationId = window.conversaAtual?.id;
    if (conversationId) {
        loadingDiv.dataset.conversationId = conversationId;
        console.log(`[DEBUG] Mostrando carregamento para conversa: ${conversationId}`);
    } else {
        console.warn('[AVISO] Mostrando carregamento sem conversa ativa');
    }
    
    loadingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
}
