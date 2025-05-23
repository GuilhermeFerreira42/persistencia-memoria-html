/**
 * messageRegistry.js
 * 
 * Sistema centralizado para gerenciamento de mensagens em streaming.
 * Este módulo exporta uma instância única do messageRegistry que
 * deve ser usada por toda a aplicação para evitar duplicação de mensagens.
 */

import { logger } from '../utils/logger.js';

/**
 * Classe para gerenciar o registro de mensagens
 */
class MessageRegistry {
    constructor() {
        logger.info('Inicializando MessageRegistry', { source: 'messageRegistry.js' });
        this.messages = new Map();
        this.debug = false; // Configurar como true para habilitar logs adicionais
        
        // Criar global para garantir acesso em todos os módulos
        if (!window.messageRegistry) {
            window.messageRegistry = this.messages;
            logger.info('Inicializando messageRegistry global', { source: 'messageRegistry.js' });
        } else {
            this.messages = window.messageRegistry;
            logger.debug('Usando messageRegistry global existente', { source: 'messageRegistry.js' });
        }
        
        // Monitoramento periódico para limpeza e depuração
        this.setupPeriodicCheck();
    }
    
    /**
     * Configura verificação periódica para limpeza e logs
     */
    setupPeriodicCheck() {
        setInterval(() => {
            if (this.debug) {
                this._log('debug', 'Estado atual do messageRegistry', {
                    totalEntries: this.messages.size,
                    entries: Array.from(this.messages.keys())
                });
            }
            
            // Limpar containers órfãos
            this.cleanOrphanContainers();
        }, 5000);
    }

    /**
     * Registra logs do sistema
     * @private
     */
    _log(level, message, data = {}) {
        logger[level](message, { ...data, source: 'messageRegistry.js' });
    }

    /**
     * Registra uma nova mensagem
     * @param {string} messageId - ID único da mensagem
     * @param {Object} data - Dados da mensagem
     * @returns {Object} Entrada criada no registry
     */
    registerMessage(messageId, data = {}) {
        this._log('debug', `Adicionando mensagem ${messageId}`);
        
        if (!messageId) {
            this._log('error', 'Tentativa de registrar mensagem sem ID');
            return null;
        }
        
        if (this.messages.has(messageId)) {
            this._log('warn', `Mensagem ${messageId} já existe no registro`);
            return this.messages.get(messageId);
        }
        
        // Criar nova entrada com flags padrão
        const entry = {
            ...data,
            created: Date.now(),
            isComplete: false,
            isStreaming: true
        };
        
        this.messages.set(messageId, entry);
        this._log('debug', `Mensagem ${messageId} registrada com sucesso`);
        
        return entry;
    }
    
    /**
     * Obtém uma mensagem do registro
     * @param {string} messageId - ID da mensagem
     * @returns {Object|null} Dados da mensagem ou null se não existir
     */
    getMessage(messageId) {
        this._log('debug', `Buscando mensagem ${messageId}`);
        if (!messageId) return null;
        return this.messages.get(messageId) || null;
    }
    
    /**
     * Atualiza dados de uma mensagem existente
     * @param {string} messageId - ID da mensagem
     * @param {Object} data - Novos dados a serem mesclados
     * @returns {boolean} Sucesso da operação
     */
    updateMessage(messageId, data) {
        if (!messageId || !this.messages.has(messageId)) {
            return false;
        }
        
        const entry = this.messages.get(messageId);
        Object.assign(entry, data);
        
        this._log('debug', `Mensagem ${messageId} atualizada`, {
            contentLength: entry.content?.length
        });
        
        return true;
    }
    
    /**
     * Adiciona conteúdo a uma mensagem existente
     * @param {string} messageId - ID da mensagem
     * @param {string} chunk - Chunk de conteúdo a ser adicionado
     * @returns {boolean} Sucesso da operação
     */
    addChunk(messageId, chunk) {
        const entry = this.messages.get(messageId);
        if (!entry) {
            this._log('error', `Tentativa de adicionar chunk a mensagem inexistente: ${messageId}`);
            return false;
        }

        entry.content = (entry.content || '') + chunk;
        this._log('debug', `Chunk adicionado à mensagem ${messageId}`);
        return true;
    }
    
    /**
     * Marca uma mensagem como completa
     * @param {string} messageId - ID da mensagem
     * @returns {boolean} Sucesso da operação
     */
    completeMessage(messageId) {
        const entry = this.messages.get(messageId);
        if (!entry) {
            this._log('error', `Tentativa de completar mensagem inexistente: ${messageId}`);
            return false;
        }

        entry.isComplete = true;
        entry.isStreaming = false;
        entry.completedAt = Date.now();
        
        this._log('info', `Mensagem ${messageId} marcada como completa`);
        return true;
    }
    
    /**
     * Remove uma mensagem do registro
     * @param {string} messageId - ID da mensagem
     * @returns {boolean} Sucesso da operação
     */
    removeMessage(messageId) {
        if (!messageId || !this.messages.has(messageId)) {
            return false;
        }
        
        const result = this.messages.delete(messageId);
        
        if (result) {
            this._log('debug', `Mensagem removida: ${messageId}`);
        }
        
        return result;
    }
    
    /**
     * Verifica se uma mensagem existe no registro
     * @param {string} messageId - ID da mensagem
     * @returns {boolean} Se a mensagem existe
     */
    hasMessage(messageId) {
        return this.messages.has(messageId);
    }
    
    /**
     * Obtém todas as mensagens de uma conversa
     * @param {string} conversationId - ID da conversa
     * @returns {Array} Lista de mensagens
     */
    getMessagesByConversation(conversationId) {
        if (!conversationId) return [];
        
        return Array.from(this.messages.values())
            .filter(entry => entry.conversationId === conversationId);
    }
    
    /**
     * Limpa containers que estão vazios ou abandonados
     */
    cleanOrphanContainers() {
        document.querySelectorAll('.message.assistant').forEach(container => {
            // Verificar se o container está vazio ou não tem messageId
            if (!container.dataset.messageId || !container.innerHTML.trim()) {
                this._log('debug', 'Removendo container órfão ou vazio', {
                    id: container.id,
                    messageId: container.dataset.messageId
                });
                container.remove();
            }
        });
    }
    
    /**
     * Verifica se existem múltiplas mensagens com conteúdo similar
     * Útil para detectar duplicações
     * @param {string} content - Conteúdo a verificar
     * @returns {Array} Lista de IDs de mensagens similares
     */
    findSimilarMessages(content) {
        if (!content || content.length < 10) return [];
        
        // Simplificar conteúdo para comparação
        const simplifiedContent = content
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .substring(0, 100);  // Comparar apenas o início
            
        const similarMessages = [];
        
        this.messages.forEach((entry, id) => {
            if (!entry.content) return;
            
            const entryContent = entry.content
                .trim()
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .substring(0, 100);
                
            if (entryContent === simplifiedContent) {
                similarMessages.push(id);
            }
        });
        
        if (similarMessages.length > 1) {
            this._log('warn', 'Múltiplas mensagens com conteúdo similar detectadas', {
                count: similarMessages.length,
                ids: similarMessages
            });
        }
        
        return similarMessages;
    }
}

// Exportar uma instância única do messageRegistry
export const messageRegistry = new MessageRegistry();

// Também exportar uma referência à instância global para conveniência
export const registry = messageRegistry;

// Para retrocompatibilidade
export default messageRegistry;