graph TD
    %% Nível 0: Visão Geral
    subgraph Sistema_de_Chat_com_IA
        A[Usuário] -->|Mensagem ou Comando| B[Interface do Chat Frontend]
        B -->|Input| C[Processamento no Frontend]
        C -->|Requisição com conversation_id| D[Backend do Sistema]
        D -->|Resposta com conversation_id| C
        C -->|Exibição| B
        D -->|Armazenamento| E[Armazenamento JSON ou Banco]
        D -->|Chamada API| F[API Externa como YouTube]
        F -->|Dados| D
    end

    %% Nível 1: Frontend - Foco no Indicador de Carregamento
    subgraph Processamento_no_Frontend
        C --> C1[enviarMensagem]
        C1 --> C2{mensagem vazia?}
        C2 -->|Sim| C3[Retorna sem ação]
        C2 -->|Não| C4{mensagem é /youtube ou /youtube_resumo?}

        %% Fluxo Comando /youtube ou /youtube_resumo
        C4 -->|Sim| C5[Extrair videoUrl]
        C5 --> C6{videoUrl válido?}
        C6 -->|Não| C7[Erro: URL inválida]
        C6 -->|Sim| C8{Conversa existe?}
        C8 -->|Não| C9[criarNovaConversa]
        C8 -->|Sim| C10[Adicionar mensagem com conversation_id]
        C9 --> C10
        C10 --> C11[Atualizar histórico]
        C11 --> C12[Mostrar carregamento]
        C12 --> C13[Requisição /process_youtube ou /process_youtube_resumo com conversation_id]
        C13 --> D1[Backend: Processar YouTube]
        D1 -->|Resposta ou Erro com conversation_id| C14[Remover carregamento]
        C14 --> C15[Exibir resposta ou erro]
        C15 --> C16[Atualizar histórico]

        %% Fluxo Mensagem Normal
        C4 -->|Não| C17{Conversa existe?}
        C17 -->|Não| C18[criarNovaConversa]
        C17 -->|Sim| C19[Adicionar mensagem com conversation_id]
        C18 --> C19
        C19 --> C20[Atualizar histórico]
        C20 --> C21[Mostrar animação de carregamento]
        C21 --> C22[Requisição /send_message com conversation_id]
        C22 --> D2[Backend: Processar Mensagem]
        D2 -->|Chunks com conversation_id| C23[Criar responseDiv]
        C23 --> C24[Atualizar em tempo real]
        C24 -->|Fim streaming| C25[Remover animação]
        C25 --> C26[Exibir resposta final]
        C26 --> C27[Atualizar histórico]
    end

    %% Nível 1: Backend
    subgraph Backend_do_Sistema
        D1 --> D3[Receber video_url e conversation_id]
        D3 -->|Chamada API| F1[API YouTube]
        F1 -->|Dados| D3
        D3 --> D4{Processamento OK?}
        D4 -->|Sim| D5[Retornar texto processado com conversation_id]
        D4 -->|Não| D6[Retornar erro com conversation_id]
        D5 -->|Armazenar| E1[JSON ou Banco]
        D6 -->|Armazenar| E1

        D2 --> D7[Receber message e conversation_id]
        D7 --> D8[Chamada ao modelo de IA]
        D8 -->|Streaming| D9[Processar chunks]
        D9 -->|Chunks com conversation_id| D10[Enviar ao frontend via Socket.IO]
        D10 -->|Resposta completa| D11[Retornar ao frontend]
        D11 -->|Armazenar| E1
    end

    %% Eventos
    E1 -->|Histórico atualizado| C28[Evento: historicoAtualizado]