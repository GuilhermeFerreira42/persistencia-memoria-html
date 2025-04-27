# ✅ Fase 1: Núcleo do Sistema (Concluída)

- Implementar streaming contínuo de mensagens usando Socket.IO.
- Gerenciar mensagens por `conversation_id`, garantindo isolamento de salas.
- Criar containers de mensagens únicos por `messageId`, sem duplicações.
- Resolver problemas de limpeza de containers órfãos no `cleanupOrphan`.
- Garantir que a troca de chat não interrompa o streaming em andamento.
- Implementar controle de eventos `join_conversation`, `leave_conversation_safe`.
- Eliminar lógica antiga de cursor que criava containers vazios.
- Introduzir uma animação de carregamento separada (fora do `chat-container`).

**Status:** Concluído.

---

# 🔥 Fase 2: Implementação dos Comandos YouTube

- Reaproveitar o fluxo de streaming já criado para receber respostas de `/youtube` e `/youtube_resumo`.
- Garantir que o sistema trate o processamento de vídeos como uma "resposta em streaming" normal, sem alterar a base de mensagens.
- Isolar também o YouTube por `conversation_id` e `messageId`, exatamente como no chat IA.
- Adaptar a animação de carregamento para funcionar também durante o processamento de vídeos.
- Ajustar a finalização do processo de vídeo para emitir `response_complete` ao final da resposta.
- Garantir que a transição entre vídeos e chats não cause erros ou perda de dados.

**Status:** A iniciar agora.

---

# ✨ Fase 3: Refinamento da Experiência de Usuário (UX)

- Ajustar a animação de carregamento para que ela apareça dentro do fluxo de mensagens (embaixo da mensagem do usuário), de forma integrada.
- Criar novo efeito visual para o início do streaming: "IA está digitando..." (de maneira fluida).
- Melhorar o comportamento do botão "Stop" com `AbortController`, interrompendo o streaming sem travar o sistema.
- Tornar a troca de chats ainda mais fluida, carregando mensagens de forma assíncrona e sem travamentos.
- Corrigir detalhes de scroll automático suave para seguir a resposta da IA.
- Melhorar transições visuais: fade-in nas novas mensagens, animações leves.

**Status:** Planejado para depois da fase 2.

---

# 🛠️ Fase 4: Modularização do Frontend

- Dividir grandes arquivos JavaScript (`chatUI.js`, `streamingManager.js`, `chatActions.js`) em módulos pequenos e coesos.
- Criar diretórios organizados (`/services`, `/components`, `/handlers`, `/utils`).
- Eliminar duplicação de funções.
- Comentar o código explicando função por função (nome, parâmetros, retorno, fluxo).
- Atualizar as importações/exportações entre arquivos.
- Deixar o frontend preparado para possível migração para frameworks modernos no futuro (React, Vue, etc.).

**Status:** Planejado.

---

# 📄 Fase 5: Documentação Completa

- Criar documentação geral do sistema (`README.md` ou um arquivo separado mais completo).
- Explicar a arquitetura de comunicação backend/frontend.
- Explicar o fluxo de mensagens (`message_chunk`, `response_complete`, `leave_conversation_safe`).
- Documentar cada comando disponível: IA padrão, YouTube, Resumo de YouTube.
- Incluir instruções de instalação, execução local, e futuras extensões.
- Anexar prints de fluxo real (opcional) para ilustrar o sistema funcionando.

**Status:** Planejado.

---

# 📌 Resumo Geral de Status Atual

| Fase | Status |
|:---|:---|
| Fase 1: Núcleo do Sistema | ✅ Concluído |
| Fase 2: Comandos YouTube | 🚀 Começando agora |
| Fase 3: UX Refinado | 🔜 Próximo |
| Fase 4: Modularização | 🛠️ Aguardando UX |
| Fase 5: Documentação Final | 📄 Aguardando Modularização |