# Projeto Guilherme – Clone de IA Conversacional

## Introdução
O Projeto Guilherme é um sistema de inteligência artificial conversacional inspirado no OpenWebUI. O objetivo principal é criar uma interface de chat interativa e persistente, semelhante ao ChatGPT. O projeto foi desenvolvido com foco na simplicidade e eficiência, eliminando a necessidade de um banco de dados tradicional para armazenamento de histórico.

## Objetivo do Projeto
O objetivo é oferecer uma IA conversacional independente, capaz de interagir com os usuários de forma natural. O histórico das conversas será armazenado em arquivos JSON individuais, garantindo a persistência dos dados entre recarregamentos da página.

## Tecnologias Utilizadas
- **Flask (Python)** → Backend leve e eficiente para gerenciar as requisições e a lógica do chat.
- **JavaScript, HTML5, CSS** → Construção da interface de usuário responsiva e dinâmica.
- **Armazenamento em JSON** → Cada conversa será salva em um arquivo separado dentro do diretório `data/`.

## Estrutura do Projeto
```
Projeto Guilherme/
├── app.py                     # Aplicação principal
├── static/
│   ├── css/                   # Estilos
│   ├── js/                    # Lógica frontend
├── templates/
│   ├── index.html             # Interface principal
├── utils/
│   ├── chat_storage.py        # Gerenciamento de histórico em arquivos JSON
│   ├── text_processor.py      # Utilitários para processamento de texto
├── data/                      # Diretório para armazenar os arquivos JSON das conversas
└── requirements.txt           # Lista de dependências do projeto
```

## Como Executar o Projeto
### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/chat-ai.git
cd chat-ai
```
### 2. Configurar o Ambiente Virtual
```bash
python -m venv venv
source venv/bin/activate  # Linux/MacOS
venv\Scripts\activate     # Windows
```
### 3. Instalar Dependências
```bash
pip install -r requirements.txt
```
### 4. Executar o Servidor
```bash
python app.py
```
O servidor será iniciado localmente e estará disponível em `http://127.0.0.1:5000/`.

## Funcionalidades
✅ Interface de chat interativa
✅ Histórico de conversa salvo em arquivos JSON
✅ Persistência do histórico entre recarregamentos da página
✅ Processamento de mensagens e resposta dinâmica

## Status Atual
🚀 O projeto está em fase de desenvolvimento, com funcionalidades básicas implementadas e melhorias em andamento.

## Contribuição
Se desejar contribuir, sinta-se à vontade para abrir issues e pull requests no repositório!

## Licença
Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

