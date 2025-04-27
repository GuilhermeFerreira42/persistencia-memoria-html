**Documentação do Projeto - Sistema de Chat com Streaming**  
**Última Atualização:** 25/04/2024  
**Status Atual:** Resolução de duplicação de mensagens pós-reinicialização  

---

### **Contexto do Problema**  
**Problema:** Duplicação de containers de mensagem após reiniciar servidor/página, com dois sistemas concorrentes:  
1. Streaming em tempo real (`message_chunk`)  
2. Renderização pós-completo (`response_complete`)  

**Evidência no HTML:**  
```html
<!-- Container de streaming (vazio) -->
<div id="message-bc061d98-..." class="message assistant">
    <div class="message-content"></div> 
</div>

<!-- Mensagem final duplicada -->
<div class="message assistant">
    <div class="message-content">...</div> 
</div>
```

---

### **Solução Implementada**  
#### Passo 1: Unificação de Containers  
**Arquivo:** `static/js/messageRenderer.js`  
```javascript
// Controle de estado global
let activeStreams = new Map();

export const renderMessageChunk = (messageId, chunk) => {
    if (!activeStreams.has(messageId)) {
        const container = document.createElement('div');
        container.className = 'message assistant streaming';
        container.dataset.messageId = messageId;
        document.querySelector('.chat-container').appendChild(container);
        activeStreams.set(messageId, {
            container,
            content: ''
        });
    }
    
    const stream = activeStreams.get(messageId);
    stream.content += chunk;
    stream.container.innerHTML = DOMPurify.sanitize(marked.parse(stream.content + '<span class="cursor">█</span>'));
};
```

#### Passo 2: Desativação da Renderização Final  
**Arquivo:** `static/js/chat/chatActions.js`  
```javascript
// Comentar/remover esta seção:
// socket.on('response_complete', ({ messageId }) => {
//     // Código que causa duplicação
// });
```

---

### **Checklist de Verificação**  
1. [ ] Backend está usando **mesmo messageId** para chunks e conclusão  
2. [ ] Evento `response_complete` está **comentado/removido**  
3. [ ] Sistema de cache (`activeStreams`) está sendo **limpo após erro/reinício**  
4. [ ] Containers vazios são **removidos automaticamente** (código abaixo)  

---

### **Código de Limpeza Automática**  
**Adicionar em `messageRenderer.js`:**  
```javascript
// Limpeza de containers órfãos a cada 5s
setInterval(() => {
    document.querySelectorAll('.message.assistant').forEach(container => {
        if (!container.querySelector('.message-content').innerHTML.trim()) {
            container.remove();
        }
    });
}, 5000);
```

---

### **Próximos Passos**  
1. **Teste de Reinicialização Forçada**  
   ```bash
   while true; do curl http://localhost:5000/restart-server; sleep 5; done
   ```
2. **Monitoramento de Estado**  
   ```javascript
   // Debug no console
   setInterval(() => {
       console.log('Active Streams:', Array.from(activeStreams.keys()));
   }, 3000);
   ```

---

### **Notas Técnicas**  
- **Critical Path:** Garantir que o `messageId` seja **imutável** durante todo o ciclo da mensagem  
- **Armadilha Comum:** Containers fantasmas de sessões anteriores não limpos  
- **Solução Alternativa:** Usar `sessionStorage` para persistir estado entre recarregamentos  

[Relatar problema ou continuar diagnóstico ▶](https://github.com/seu-usuario/chat-system/issues)


-------------

Vou documentar o que foi feito até agora em português:

1. **Análise Inicial do Problema**:
   - Identificamos um problema de duplicação de mensagens no sistema de chat
   - O problema ocorre mesmo após reiniciar o servidor e a página
   - Há containers vazios e duplicados no HTML

2. **Implementações Realizadas**:

   a) **Em `messageRenderer.js`**:
   - Adicionamos um sistema de cache para chunks de mensagem
   - Implementamos limpeza de containers vazios
   - Adicionamos um sistema de backup para limpeza periódica
   - Melhoramos o scroll automático
   - Adicionamos estilos para o cursor piscante

   b) **Em `chatActions.js`**:
   - Adicionamos monitoramento de streams ativos
   - Removemos a duplicação no evento `response_complete`
   - Implementamos um log periódico para debug

3. **Estrutura Atual do Sistema**:

   ```javascript
   // messageRenderer.js
   const messageCache = new Map();
   let activeStreams = new Set();

   export const renderMessageChunk = (messageId, chunk, isComplete = false) => {
       // Lógica de renderização de chunks
   };

   export const completeMessage = (messageId) => {
       // Lógica de conclusão de mensagem
   };

   // Sistema de backup para limpeza
   const backupContainerCheck = setInterval(() => {
       // Limpeza de containers vazios
   }, 5000);
   ```

   ```javascript
   // chatActions.js
   const streamingMessages = new Set();
   let activeStreams = new Set();

   export const handleSocketMessages = (socket) => {
       socket.on('message_chunk', ({ messageId, content }) => {
           // Lógica de streaming
       });

       socket.on('response_complete', ({ messageId }) => {
           // Lógica de conclusão
       });

       socket.on('stream_error', ({ messageId }) => {
           // Tratamento de erros
       });
   };
   ```

4. **Problemas Identificados**:
   - Possível conflito entre eventos de streaming e renderização final
   - Inconsistência nos `messageId`s
   - Containers vazios não sendo limpos adequadamente
   - Possível vazamento de memória com referências a elementos DOM

5. **Próximos Passos Sugeridos**:
   - Verificar e desativar o evento `response_complete`
   - Garantir consistência nos `messageId`s
   - Refinar a lógica de limpeza
   - Implementar verificações periódicas
   - Testar com diferentes cenários

6. **Melhorias Implementadas**:
   - Unificação do sistema de renderização
   - Melhor gerenciamento de estado
   - Limpeza automática de recursos
   - Tratamento de erros mais robusto

7. **Pontos de Atenção**:
   - Necessidade de sincronização entre frontend e backend
   - Importância da consistência dos IDs de mensagem
   - Gerenciamento adequado do ciclo de vida dos containers
   - Monitoramento e limpeza de recursos

Você gostaria que eu detalhasse algum aspecto específico ou que prosseguíssemos com alguma das melhorias sugeridas?

