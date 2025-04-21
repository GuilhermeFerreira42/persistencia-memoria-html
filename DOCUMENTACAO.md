# Documentação do Sistema de Chat

## 1. Estrutura de Arquivos
```
/
├── static/
│   ├── js/
│   │   ├── modules/
│   │   │   └── streamingManager.js
│   │   ├── chatUI.js
│   │   ├── main.js
│   │   └── init.js
│   └── css/
│       └── streaming.css
├── templates/
│   └── index.html
└── app.py
```

## 2. Melhorias Implementadas

### 2.1. Gerenciamento de Streaming
- Implementação do `StreamingManager` para controlar o fluxo de mensagens
- Sistema de cache para manter o estado das mensagens em streaming
- Gerenciamento de containers únicos por mensagem usando `messageId`
- Suporte a transições suaves entre conversas

### 2.2. Interface do Usuário
- Correção dos IDs dos elementos HTML:
  - `send-btn` para o botão de envio
  - `chat-input` para o campo de entrada
- Implementação de verificações de existência de elementos antes de adicionar listeners
- Suporte a envio de mensagens por Enter (exceto com Shift)
- Scroll automático para a última mensagem

### 2.3. Segurança e Validação
- Sanitização de mensagens usando `escapeHtml`
- Tratamento de erros em todas as operações assíncronas
- Validação de mensagens vazias antes do envio
- Verificação de existência de elementos DOM antes de manipulação

### 2.4. Funcionalidades Principais
- Envio e recebimento de mensagens em tempo real
- Suporte a múltiplas conversas
- Carregamento de histórico de conversas
- Formatação de mensagens com suporte a Markdown
- Indicadores visuais de carregamento e erro

## 3. Classes e Componentes

### 3.1. ChatUI
```javascript
class ChatUI {
    constructor() {
        this.currentConversationId = null;
        this.initializeEventListeners();
    }
    // ... métodos implementados
}
```

Principais métodos:
- `initializeEventListeners()`: Configura listeners para interações do usuário
- `sendMessage()`: Envia mensagens para o backend
- `appendUserMessage()`: Adiciona mensagens do usuário ao chat
- `handleConversationChange()`: Gerencia mudanças de conversa
- `loadConversationHistory()`: Carrega histórico de conversas
- `displayConversationHistory()`: Exibe histórico no chat
- `showError()`: Exibe mensagens de erro
- `scrollToBottom()`: Mantém scroll na última mensagem
- `escapeHtml()`: Sanitiza conteúdo HTML

### 3.2. StreamingManager
- Gerenciamento de estado de streaming
- Cache de mensagens em andamento
- Restauração de estado entre conversas
- Controle de containers de mensagem

## 4. Fluxo de Funcionamento

1. **Inicialização**:
   - Carrega elementos DOM necessários
   - Configura listeners de eventos
   - Inicializa StreamingManager

2. **Envio de Mensagem**:
   - Usuário digita mensagem
   - Pressiona Enter ou clica em enviar
   - Sistema valida e envia para backend
   - Exibe mensagem do usuário imediatamente

3. **Recebimento de Resposta**:
   - StreamingManager gerencia o fluxo
   - Atualiza interface incrementalmente
   - Mantém estado durante transições
   - Formata mensagens recebidas

4. **Mudança de Conversa**:
   - Preserva estado de streaming
   - Carrega histórico da nova conversa
   - Mantém contexto correto

## 5. Considerações de Segurança

- Sanitização de entrada do usuário
- Validação de dados antes do envio
- Tratamento de erros em todas as operações
- Proteção contra XSS e injeção de código

## 6. Próximos Passos Recomendados

1. Implementar sistema de persistência de dados
2. Adicionar suporte a anexos e mídia
3. Melhorar sistema de notificações
4. Implementar sistema de busca em conversas
5. Adicionar suporte a temas e personalização

## 7. Histórico de Alterações

### Versão 1.0.0
- Implementação inicial do sistema de chat
- Gerenciamento básico de mensagens
- Interface simples e funcional

### Versão 1.1.0
- Adição do StreamingManager
- Melhorias na interface do usuário
- Correção de IDs dos elementos HTML
- Implementação de verificações de segurança

### Versão 1.2.0
- Sistema de cache para streaming
- Suporte a múltiplas conversas
- Melhorias na formatação de mensagens
- Tratamento de erros aprimorado

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