# Sistema de Chat com Streaming - Linha de Raciocínio

## Visão Geral
Este documento descreve o estado atual do sistema de chat com streaming de respostas em tempo real, apresentando o que foi implementado e os próximos passos do desenvolvimento.

## Status Atual (Abril 2025)
O sistema implementa um chat interativo com:
- Streaming de respostas em tempo real via Socket.IO
- Persistência de conversas 
- Integração com processamento de vídeos do YouTube
- Renderização de markdown nas mensagens

## Últimas Implementações (27/04/2025)
1. **Correções no sistema de Socket.IO**
   - Implementado fluxo que entra na nova sala imediatamente
   - Saída da sala anterior adiada até receber o evento `response_complete`
   - Adicionadas variáveis globais para rastreamento de mensagens ativas

2. **Aprimoramento do messageRegistry**
   - Adicionadas flags `isCursor`, `isComplete` e `isStreaming`
   - Lógica refinada para preservar apenas mensagens relevantes
   - Sistema de limpeza automatizada que preserva mensagens completas

## Próximos Passos Prioritários
1. **Sistema de IDs Unificado**
   - Implementar geração consistente de IDs entre backend e frontend
   - Garantir que não ocorram duplicações ou conflitos

2. **Integração com YouTube**
   - Finalizar integração do sistema de streaming com processamento de YouTube
   - Testar casos específicos de resumo e transcrição

3. **Feedback Visual Durante Carregamento**
   - Investigar abordagens alternativas para feedback durante carregamento
   - Substituir implementação atual que apresenta problemas

4. **Testes de Integração**
   - Testar troca de conversas durante streaming ativo
   - Verificar comportamento com mensagens longas e formatação complexa
   - Validar interação entre YouTube e streaming

## Arquivos Principais
- `static/js/chat/chatActions.js` - Gerenciamento da comunicação via Socket.IO
- `static/js/modules/streamingManager.js` - Controle do ciclo de vida das mensagens
- `static/css/streaming.css` - Animações e estilos para feedback visual
- `app.py` - Backend Flask com handlers de Socket.IO

## Referências de Implementação

### Socket.IO e Troca de Salas
```javascript
// Entrar na nova sala imediatamente e sair da anterior apenas após response_complete
export function entrarNaSala(conversationId) {
    const previousConversationId = currentConversationId;
    currentConversationId = conversationId;
    
    // Entrar na nova sala imediatamente
    socket.emit('join_conversation', { conversation_id: conversationId });
    
    if (previousConversationId && currentStreamingMessageId) {
        // Esperar o evento response_complete para sair da sala anterior
        socket.once('response_complete', (data) => {
            // Sair apenas quando a resposta estiver completa
        });
    }
}
```

### Gerenciamento de Mensagens
```javascript
// Limpeza inteligente de containers órfãos
cleanupOrphan() {
    messageRegistry.forEach((entry, messageId) => {
        if (entry.isCursor && !entry.isStreaming) {
            // Remover cursores sem streaming ativo
        } else if (!entry.isStreaming && !entry.isComplete) {
            // Remover mensagens incompletas sem streaming
        }
        // Preservar sempre mensagens completas (isComplete === true)
    });
}
```

---

**Nota:** Este documento substitui versões anteriores da linha de raciocínio e serve como referência atual para o desenvolvimento do projeto. 