/**
 * Sistema centralizado de logs para aplicação de chat
 * Fornece funcionalidades para registrar eventos, erros e estado do sistema
 * com níveis de log e envio para o backend
 */

// Níveis de log disponíveis
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Configuração do nível de log atual (ajustável conforme necessidade)
const currentLogLevel = LOG_LEVELS.DEBUG; // Começando com DEBUG para capturar tudo

/**
 * Função principal de log que gerencia tanto logs locais (console) quanto remotos (backend)
 * @param {string} level - Nível do log (DEBUG, INFO, WARN, ERROR)
 * @param {string} message - Mensagem do log
 * @param {Object} data - Dados adicionais para contexto do log
 */
export function log(level, message, data = {}) {
  if (LOG_LEVELS[level] >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const context = 'frontend';
    
    // Log local no console com estilo
    const styles = {
      DEBUG: 'color: gray',
      INFO: 'color: blue',
      WARN: 'color: orange',
      ERROR: 'color: red; font-weight: bold'
    };
    
    console.log(`%c[${level}] ${timestamp} - ${message}`, styles[level], data);
    
    // Extrair messageId se estiver presente nos dados
    const messageId = data.messageId || data.message_id;
    const conversationId = data.conversationId || data.conversation_id || window.conversaAtual?.id;
    
    // Preparar payload JSON estruturado para o backend
    const logData = {
      level,
      message,
      data,
      timestamp,
      context,
      url: window.location.href,
      messageId,
      conversationId
    };
    
    // Enviar log para o backend (assíncrono)
    fetch('/log-frontend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch(err => console.error('[ERROR] Falha ao enviar log ao backend:', err));
  }
}

// Interface simplificada para diferentes níveis de log
export const logger = {
  debug: (message, data) => log('DEBUG', message, data),
  info: (message, data) => log('INFO', message, data),
  warn: (message, data) => log('WARN', message, data),
  error: (message, data) => log('ERROR', message, data),
  
  // Função específica para rastreamento de mensagens
  trackMessage: (action, messageId, conversationId, extra = {}) => {
    log('INFO', `Message ${action}`, {
      messageId,
      conversationId,
      action,
      ...extra
    });
  }
};

// Interceptar erros não capturados
window.addEventListener('error', (event) => {
  logger.error('Erro não capturado', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack || 'Sem stack disponível'
  });
});

// Interceptar rejeições de promises não tratadas
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Promise rejeitada não tratada', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack || 'Sem stack disponível'
  });
});

export default logger; 