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
        this.messages = new Map();
        this.debug = false; // Configurar como true para habilitar logs adicionais
        
        // Criar global para garantir acesso em todos os módulos
        if (!window.messageRegistry) {
            window.messageRegistry = this.messages;
            logger.info('Inicializando messageRegistry global');
        } else {
            this.messages = window.messageRegistry;
            logger.debug('Usando messageRegistry global existente');
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
                logger.debug('Estado atual do messageRegistry', {
                    totalEntries: this.messages.size,
                    entries: Array.from(this.messages.keys())
                });
            }
            
            // Limpar containers órfãos
            this.cleanOrphanContainers();
        }, 5000);
    }
    
    /**
     * Registra uma nova mensagem
     * @param {string} messageId - ID único da mensagem
     * @param {Object} data - Dados da mensagem
     * @returns {Object} Entrada criada no registry
     */
    registerMessage(messageId, data = {}) {
        if (!messageId) {
            logger.error('Tentativa de registrar mensagem sem ID');
            return null;
        }
        
        if (this.messages.has(messageId)) {
            logger.debug(`Mensagem ${messageId} já registrada, atualizando`);
            const entry = this.messages.get(messageId);
            
            // Atualizar dados existentes
            Object.assign(entry, data);
            return entry;
        }
        
        // Criar nova entrada
        const entry = {
            id: messageId,
            content: data.content || '',
            container: data.container || null,
            timestamp: Date.now(),
            conversationId: data.conversationId || null,
            complete: false,
            ...data
        };
        
        this.messages.set(messageId, entry);
        logger.info(`Mensagem registrada: ${messageId}`, { 
            conversationId: entry.conversationId 
        });
        
        return entry;
    }
    
    /**
     * Obtém uma mensagem do registro
     * @param {string} messageId - ID da mensagem
     * @returns {Object|null} Dados da mensagem ou null se não existir
     */
    getMessage(messageId) {
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
        
        logger.debug(`Mensagem ${messageId} atualizada`, {
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
        if (!messageId) return false;
        
        let entry = this.getMessage(messageId);
        if (!entry) {
            entry = this.registerMessage(messageId, { content: '' });
        }
        
        entry.content += chunk;
        entry.lastUpdated = Date.now();
        
        logger.debug(`Chunk adicionado à mensagem ${messageId}`, {
            chunkSize: chunk.length,
            totalSize: entry.content.length
        });
        
        return true;
    }
    
    /**
     * Marca uma mensagem como completa
     * @param {string} messageId - ID da mensagem
     * @param {string} conversationId - ID da conversa
     * @returns {boolean} Sucesso da operação
     */
    completeMessage(messageId, conversationId) {
        const entry = this.messages.get(messageId);
        if (!entry) {
            logger.warn(`Tentativa de completar mensagem inexistente: ${messageId}`);
            return false;
        }
        
        logger.info(`Marcando mensagem como completa: ${messageId}`);
        entry.complete = true;
        entry.conversationId = conversationId || entry.conversationId;
        
        // Emitir evento de mensagem completa
        document.dispatchEvent(new CustomEvent('message:complete', {
            detail: { messageId, conversationId: entry.conversationId }
        }));
        
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
            logger.debug(`Mensagem removida: ${messageId}`);
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
                logger.debug('Removendo container órfão ou vazio', {
                    id: container.id,
                    messageId: container.dataset.messageId
                });
                container.remove();
            }
        });
    }
}

// Exportar uma instância única do messageRegistry
export const messageRegistry = new MessageRegistry();

// Também exportar uma referência à instância global para conveniência
export const registry = messageRegistry;

// Para retrocompatibilidade
export default messageRegistry; 