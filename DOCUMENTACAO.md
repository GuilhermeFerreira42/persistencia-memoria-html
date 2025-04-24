# Documentação do Sistema de Chat

## 1. Estrutura de Arquivos
```
/
├── static/
│   ├── js/
│   │   ├── modules/
│   │   │   └── streamingManager.js
│   │   ├── chat/
│   │   │   ├── chatActions.js
│   │   │   ├── chatUI.js
│   │   │   └── chatStorage.js
│   │   ├── utils/
│   │   │   └── logger.js
│   │   ├── messageRenderer.js
│   │   ├── main.js
│   │   └── init.js
│   └── css/
│       └── streaming.css
├── templates/
│   └── index.html
├── logs/
│   └── app_YYYYMMDD.log
└── app.py
```

## 2. Melhorias Implementadas

### 2.1. Gerenciamento de Streaming
- Implementação do sistema de `messageRegistry` para controlar o fluxo de mensagens
- Sistema de cache para manter o estado das mensagens em streaming
- Gerenciamento de containers únicos por mensagem usando `messageId`
- Detecção e prevenção de duplicação de mensagens
- Suporte a transições suaves entre conversas

### 2.2. Interface do Usuário
- Correção dos IDs dos elementos HTML:
  - `send-btn` para o botão de envio
  - `chat-input` para o campo de entrada
- Implementação de verificações de existência de elementos antes de adicionar listeners
- Suporte a envio de mensagens por Enter (exceto com Shift)
- Scroll automático para a última mensagem

### 2.3. Segurança e Validação
- Sanitização de mensagens usando `DOMPurify`
- Tratamento de erros em todas as operações assíncronas
- Validação de mensagens vazias antes do envio
- Verificação de existência de elementos DOM antes de manipulação

### 2.4. Funcionalidades Principais
- Envio e recebimento de mensagens em tempo real
- Suporte a múltiplas conversas
- Carregamento de histórico de conversas
- Formatação de mensagens com suporte a Markdown
- Indicadores visuais de carregamento e erro
- Sistema centralizado de logs para depuração

## 3. Componentes Principais

### 3.1. messageRegistry 
O `messageRegistry` é um componente crítico para gerenciar mensagens em streaming:

```javascript
// Definição global para garantir acesso em múltiplos módulos
window.messageRegistry = new Map();
```

**Propósito**:
- Rastrear todas as mensagens em streaming ativas
- Gerenciar os containers DOM de cada mensagem
- Prevenir a duplicação de mensagens
- Permitir a limpeza adequada de containers após conclusão do streaming

**Estrutura**:
```javascript
// Para cada mensagem no Map
messageRegistry.set(messageId, {
  content: '',        // Conteúdo acumulado da mensagem
  rendered: false,    // Se já foi renderizada ao menos uma vez
  container: element, // Referência ao elemento DOM
  timer: timeoutId    // Timer para limpeza de containers órfãos
});
```

**Interação com outros componentes**:
- Utilizado por `chatActions.js` para gerenciar o ciclo de vida das mensagens
- Consultado durante carregamento de conversas para evitar duplicação
- Limpo automaticamente quando mensagens são finalizadas

### 3.2. Sistema de Streaming
Gerencia a recepção e renderização de mensagens em tempo real:

Principais funções:
- `handleStreamChunk`: Processa e acumula chunks recebidos via Socket.IO
- `renderStreamingContent`: Renderiza conteúdo acumulado no container apropriado
- `finalizeMessage`: Conclui o streaming, removendo elementos temporários
- `cleanupOrphan`: Remove containers órfãos para prevenir vazamentos de memória

## 4. Fluxo de Mensagens e Prevenção de Duplicação

### 4.1. Problema Identificado
O sistema pode enfrentar duplicação de mensagens quando:
1. IDs de mensagem inconsistentes são usados entre streaming e armazenamento
2. Durante o carregamento do histórico, mensagens podem ser renderizadas múltiplas vezes

**Sintoma**: Mensagens duplicadas aparecem no DOM com IDs diferentes:
- UUID (ex: `2ca03c22-be96-49c2-8f5a-17f2d4dc2287`) para mensagens em streaming
- Timestamp (ex: `2025-04-24T17:06:24.506222`) para mensagens do histórico

### 4.2. Solução Implementada

1. **Centralização do messageRegistry**:
   - Definição global via `window.messageRegistry` para garantir acesso consistente
   - Referência local em cada módulo para facilitar o uso

2. **Detecção de Duplicação por Conteúdo**:
   - Verificação de conteúdo similar entre mensagens
   - Alertas de log quando múltiplos containers são detectados para conteúdo similar

3. **Prevenção Durante Carregamento**:
   - Verificação de mensagens existentes no DOM antes de renderizar novas
   - Atualização do messageRegistry ao carregar histórico

4. **Ciclo de Vida da Mensagem**:
   - Streaming: ID temporário durante recepção de chunks
   - Finalização: Atualização para ID permanente após conclusão
   - Histórico: Verificação de duplicação antes de renderizar

### 4.3. Fluxo Completo

1. **Envio de mensagem do usuário**:
   - Captura de input do usuário
   - Validação e envio para o backend
   - Exibição imediata no chat

2. **Streaming da resposta**:
   - Backend envia chunks via Socket.IO
   - `messageRegistry` rastreia cada mensagem com ID único
   - `handleStreamChunk` acumula conteúdo e atualiza o DOM
   - Detecção contínua de containers duplicados

3. **Finalização da resposta**:
   - Backend envia evento `response_complete`
   - `finalizeMessage` limpa elementos temporários
   - Mensagem é adicionada ao histórico com ID permanente

4. **Carregamento de histórico**:
   - Ao mudar de conversa, histórico é carregado
   - Verificação de mensagens já renderizadas
   - Prevenção de duplicação por conteúdo similar

## 5. Sistema de Logs

O sistema possui um mecanismo avançado de logging para ajudar na depuração e entendimento do fluxo de dados.

### 5.1. Frontend Logging

O sistema de logs do frontend está centralizado no arquivo `static/js/utils/logger.js`:

- Níveis de log: DEBUG, INFO, WARN, ERROR
- Formatação consistente com timestamp
- Envio de logs para o backend através do endpoint `/log-frontend`
- Captura automática de erros não tratados e rejeições de promessas

Exemplo de uso:
```javascript
import { logger } from './utils/logger.js';

// Logs específicos para messageRegistry
logger.debug('Inicializando messageRegistry para messageId', { messageId });
logger.warn('Múltiplos contêineres detectados', { messageId, count: containers.length });
```

### 5.2. Backend Logging

O backend utiliza o módulo `logging` do Python:

- Logs armazenados em arquivos diários (`logs/app_YYYYMMDD.log`)
- Captura de exceções com traceback completo
- Registro de eventos do Socket.IO
- Processamento de logs do frontend para análise unificada

### 5.3. Depuração de Duplicação

Para diagnosticar problemas de duplicação:

1. **Logs de alto nível**:
   - `[INFO] Inicializando messageRegistry global`
   - `[INFO] Inicializando entrada no messageRegistry { messageId: '...' }`
   - `[INFO] Mensagem finalizada com sucesso { messageId: '...', contentSize: ... }`

2. **Logs de alerta**:
   - `[WARN] Múltiplos contêineres detectados { messageId: '...', count: 2 }`
   - `[WARN] Tentativa de finalizar mensagem não registrada { messageId: '...' }`

3. **Monitoramento periódico**:
   - `[DEBUG] Monitoramento de streams concluído { activeStreams: ..., registrySize: ... }`

## 6. Troubleshooting

### 6.1. Problemas Comuns

1. **Mensagens duplicadas**:
   - **Sintoma**: Mesma mensagem aparece duas vezes no chat
   - **Verificação**: Inspecionar o DOM para identificar IDs diferentes
   - **Solução**: Verificar a inicialização do `messageRegistry` e o carregamento de histórico

2. **Mensagens ausentes**:
   - **Sintoma**: Chunks recebidos mas não renderizados
   - **Verificação**: Consultar logs para eventos `message_chunk` e `response_complete`
   - **Solução**: Verificar se o `messageRegistry` está acumulando corretamente

3. **Erros de referência**:
   - **Sintoma**: Erro `messageRegistry is not defined` no console
   - **Verificação**: Confirmar que a definição global do `messageRegistry` está carregada
   - **Solução**: Garantir importação correta em todos os módulos que utilizam

### 6.2. Manutenção e Evolução

Para futuras melhorias no sistema:

1. **Padronização de IDs**:
   - Usar o mesmo formato de ID (preferencialmente UUID) em todo o ciclo de vida
   - Coordenar IDs entre frontend e backend

2. **Melhorias no messageRegistry**:
   - Adicionar expiração automática de entradas antigas
   - Implementar persistência para recuperação após recarregamento da página

3. **Otimização de renderização**:
   - Implementar renderização virtual para grandes históricos
   - Melhorar detecção de duplicação baseada em conteúdo

## 7. Histórico de Alterações

### Versão 1.3.0
- Implementação do messageRegistry global
- Solução para duplicação de mensagens
- Sistema avançado de logging para depuração
- Detecção de múltiplos containers

### Versão 1.2.0
- Sistema de cache para streaming
- Suporte a múltiplas conversas
- Melhorias na formatação de mensagens
- Tratamento de erros aprimorado

### Versão 1.1.0
- Adição do StreamingManager
- Melhorias na interface do usuário
- Correção de IDs dos elementos HTML
- Implementação de verificações de segurança

### Versão 1.0.0
- Implementação inicial do sistema de chat
- Gerenciamento básico de mensagens
- Interface simples e funcional

## 8. Dependências

- Socket.IO para comunicação em tempo real
- Marked.js para renderização de Markdown
- DOMPurify para sanitização de HTML
- CSS moderno para estilização

## 9. Configuração

Para configurar o ambiente:

1. Instalar dependências:
```bash
npm install socket.io marked dompurify
```

2. Configurar o servidor:
```python
# app.py
from flask import Flask, render_template
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app)
```

3. Inicializar o cliente:
```javascript
// main.js
import { chatUI } from './chatUI.js';
import { streamingManager } from './modules/streamingManager.js';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    chatUI.initialize();
    streamingManager.initialize();
});
```

## 10. Troubleshooting

### Problemas Comuns

1. **Mensagens não aparecem**
   - Verificar conexão com o servidor
   - Confirmar se os elementos DOM existem
   - Verificar logs do console

2. **Streaming interrompido**
   - Verificar estado do cache
   - Confirmar conexão WebSocket
   - Verificar logs de erro

3. **Interface não responde**
   - Verificar inicialização dos componentes
   - Confirmar existência de elementos
   - Verificar erros no console

### Soluções

1. **Reinicialização**
   - Recarregar a página
   - Verificar conexão
   - Limpar cache do navegador

2. **Debug**
   - Usar console.log para rastreamento
   - Verificar estado dos componentes
   - Monitorar eventos do Socket.IO

3. **Manutenção**
   - Limpar cache periodicamente
   - Verificar atualizações
   - Monitorar performance 

## Sistema de Logs

O sistema possui um mecanismo avançado de logging para ajudar na depuração e entendimento do fluxo de dados. O sistema de logs foi implementado tanto no frontend quanto no backend.

### Frontend Logging

O sistema de logs do frontend está centralizado no arquivo `static/js/utils/logger.js`, que oferece as seguintes funcionalidades:

- Diferentes níveis de log: DEBUG, INFO, WARN, ERROR
- Formatação consistente com timestamp
- Envio de logs para o backend através de um endpoint dedicado
- Captura automática de erros não tratados e rejeições de promessas

Exemplo de uso:
```javascript
import { logger } from './utils/logger.js';

// Diferentes níveis de log
logger.debug('Mensagem de depuração', { dados: 'adicionais' });
logger.info('Informação importante');
logger.warn('Aviso sobre potencial problema', { motivo: 'validação falhou' });
logger.error('Erro crítico', { erro: error.message, stack: error.stack });
```

### Backend Logging

O backend utiliza o módulo `logging` do Python para criar logs estruturados:

- Logs enviados tanto para o console quanto para arquivos
- Arquivos de log separados por data (`app_YYYYMMDD.log`)
- Captura de exceções com rastreamento completo (traceback)
- Endpoint dedicado para receber e registrar logs do frontend

### Pontos de Log Principais

Os logs foram estrategicamente adicionados em pontos críticos do sistema:

1. **Inicialização**
   - Carregamento de dependências
   - Verificação de elementos críticos
   - Inicialização do Socket.IO

2. **Fluxo de Mensagens**
   - Envio de mensagens do usuário
   - Recebimento de chunks do backend
   - Renderização de respostas
   - Conclusão de streaming

3. **Manipulação de Erros**
   - Falhas de rede
   - Erros de processamento
   - Problemas de renderização

4. **Conexões Socket.IO**
   - Eventos de conexão/desconexão
   - Entrada/saída de salas
   - Emissão de eventos

### Monitoramento

Para visualizar os logs:

1. **Logs do Frontend**: Console do navegador
2. **Logs do Backend**: 
   - Console do servidor
   - Arquivos na pasta `logs/app_YYYYMMDD.log`
   - Logs unificados (frontend + backend) nos arquivos de log

### Configuração do Nível de Log

Para ajustar a verbosidade dos logs:

- **Frontend**: Modificar `currentLogLevel` em `static/js/utils/logger.js`
- **Backend**: Ajustar os níveis dos handlers em `setup_logger()` em `app.py` 