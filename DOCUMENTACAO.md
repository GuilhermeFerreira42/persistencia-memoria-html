
# Documentação do Projeto - Sistema de Chat com IA

## 1. Visão Geral do Projeto

### Descrição Geral
O projeto é um sistema de chat interativo que utiliza inteligência artificial para gerar respostas contextualizadas. É baseado em uma arquitetura cliente-servidor usando Flask como backend e uma interface web responsiva.

### Objetivo e Funcionalidades Principais
- Fornecer uma interface de chat intuitiva para interação com IA
- Gerenciar histórico de conversas
- Permitir criação de novas conversas
- Suportar temas claro/escuro
- Salvar conversas em arquivos JSON para persistência

### Tecnologias Utilizadas
- **Backend**: Python/Flask
- **Frontend**: HTML, CSS, JavaScript
- **Armazenamento**: Sistema de arquivos (JSON)
- **IA**: Integração com modelo de linguagem

## 2. Árvore de Diretórios

```
Projeto/
├── app.py                     # Aplicação principal Flask
├── static/
│   ├── css/                  # Estilos da aplicação
│   │   ├── styles.css       # Estilos principais
│   │   ├── base/           # Estilos base
│   │   ├── components/     # Estilos de componentes
│   │   ├── layout/        # Estilos de layout
│   │   └── themes/        # Temas claro/escuro
│   │
│   └── js/                   # Scripts JavaScript
│       ├── main.js          # Script principal
│       ├── chat.js         # Lógica do chat
│       ├── sidebar.js      # Controle da barra lateral
│       ├── theme.js        # Controle de tema
│       ├── events.js       # Gerenciamento de eventos
│       ├── init.js         # Inicialização
│       └── utils.js        # Funções utilitárias
│
├── templates/
│   └── index.html            # Template principal
│
├── utils/
│   ├── chat_storage.py      # Gerenciamento de armazenamento
│   ├── chat_history.py      # Manipulação do histórico
│   └── text_processor.py    # Processamento de texto
│
└── data/                     # Diretório de dados
    └── conversations/        # Armazenamento de conversas

```

## 3. Descrição Detalhada das Funções

### Backend (app.py)

#### Rotas Principais:
- `@app.route('/')`: Renderiza a página inicial
- `@app.route('/send_message')`: Processa mensagens e retorna respostas da IA
- `@app.route('/get_conversation_history')`: Retorna histórico de conversas
- `@app.route('/get_conversation/<conversation_id>')`: Obtém conversa específica

#### Funções de Processamento:
- `process_with_ai(text)`: Processa texto com IA
- `process_with_ai_stream(text)`: Versão streaming do processamento

### Utilitários (utils/)

#### chat_storage.py:
- `ensure_directories()`: Garante existência dos diretórios necessários
- `create_new_conversation()`: Cria nova conversa
- `save_conversation()`: Salva conversa em arquivo
- `get_conversation_by_id()`: Recupera conversa por ID

#### chat_history.py:
- `get_conversation_history()`: Obtém histórico completo
- `save_conversation()`: Salva conversa no histórico
- `get_conversation_by_id()`: Busca conversa específica

### Frontend (static/js/)

#### main.js:
- Inicialização da aplicação
- Gerenciamento de estado global
- Configuração de event listeners

#### chat.js:
- `iniciarChat()`: Inicia nova sessão de chat
- `enviarMensagem()`: Envia mensagem para o backend
- `adicionarMensagem()`: Adiciona mensagem na interface
- `carregarConversa()`: Carrega conversa existente

## 4. Fluxo de Execução

1. **Inicialização**:
   - Servidor Flask inicia (app.py)
   - Diretórios são verificados/criados
   - Interface web é carregada

2. **Interação do Usuário**:
   - Usuário inicia nova conversa ou carrega existente
   - Mensagens são enviadas via interface
   - Backend processa com IA
   - Respostas são exibidas em tempo real

3. **Armazenamento**:
   - Conversas são salvas automaticamente
   - Histórico é mantido em arquivos JSON
   - Dados persistem entre sessões

## 5. Estrutura do Código

O projeto segue uma arquitetura MVC simplificada:
- **Modelo**: Gerenciamento de dados em JSON
- **Visão**: Templates HTML e estilos CSS
- **Controlador**: Rotas Flask e lógica JavaScript

### Boas Práticas:
- Separação de responsabilidades
- Modularização do código
- Armazenamento persistente
- Tratamento de erros

## 6. Instruções de Instalação

1. **Preparação do Ambiente**:
```bash
# Criar ambiente virtual
python -m venv venv

# Ativar ambiente
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

2. **Configuração**:
- Garantir que Python 3.6+ está instalado
- Verificar permissões de escrita no diretório data/

3. **Execução**:
```bash
python app.py
```
- Acessar http://localhost:5000 no navegador

## 7. Considerações Finais

### Melhorias Sugeridas:
1. Implementar autenticação de usuários
2. Adicionar suporte a múltiplos modelos de IA
3. Melhorar sistema de backup de conversas
4. Implementar busca no histórico
5. Adicionar suporte a markdown nas mensagens

### Funcionalidades Futuras:
1. Exportação de conversas em diferentes formatos
2. Compartilhamento de conversas
3. Personalização avançada da interface
4. Integração com APIs externas
5. Sistema de tags para organização

