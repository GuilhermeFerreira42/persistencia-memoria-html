"""
Módulo de Gerenciamento de Conversas

Este módulo fornece funções para gerenciar o armazenamento persistente de conversas
em formato JSON. Permite criar, ler, atualizar e excluir conversas e mensagens.

Principais funcionalidades:
- Criar novas conversas
- Adicionar mensagens a conversas existentes
- Recuperar histórico de conversas
- Atualizar metadados de conversas
- Excluir conversas
"""

import json
import os
import uuid
from datetime import datetime

# Definição de constantes para armazenamento de dados
DATA_DIR = "data"
CONVERSATIONS_DIR = os.path.join(DATA_DIR, "conversations")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")

def ensure_directories():
    """
    Garante que os diretórios necessários para armazenamento existam.
    Cria os diretórios data/ e data/conversations/ caso não existam.
    """
    # print("[DEBUG-PYTHON] ensure_directories em utils/chat_storage.py chamada")
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

def create_new_conversation():
    """
    Cria uma nova conversa com ID baseado no timestamp atual.
    
    Returns:
        str: ID único da conversa recém-criada
    """
    # print("[DEBUG-PYTHON] create_new_conversation em utils/chat_storage.py chamada")
    ensure_directories()
    
    conversation_id = str(int(datetime.now().timestamp() * 1000))
    conversation = {
        "id": conversation_id,
        "title": "Nova conversa",
        "timestamp": datetime.now().isoformat(),
        "messages": []
    }
    
    save_conversation(conversation)
    update_index(conversation)
    
    # print(f"[DEBUG-PYTHON] Nova conversa criada com ID: {conversation_id}")
    return conversation_id

def save_conversation(conversation):
    """
    Salva uma conversa em seu arquivo JSON correspondente.
    
    Args:
        conversation (dict): Objeto de conversa com campos id, title, timestamp e messages
        
    Returns:
        bool: True se a operação foi bem-sucedida, False caso contrário
    """
    # print(f"[DEBUG-PYTHON] save_conversation em utils/chat_storage.py chamada para conversa ID: {conversation['id']}")
    filename = f"conversation_{conversation['id']}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        # print(f"[DEBUG-PYTHON] Conversa {conversation['id']} salva com sucesso")
        return True
    except Exception as e:
        print(f"[ERRO-PYTHON] Falha ao salvar conversa: {str(e)}")
        return False

def update_index(conversation):
    """
    Atualiza o arquivo de índice com os metadados da conversa.
    O índice contém informações resumidas de todas as conversas para
    carregar rapidamente a lista de conversas sem precisar abrir cada arquivo.
    
    Args:
        conversation (dict): Objeto de conversa a ser indexado
        
    Returns:
        bool: True se a operação foi bem-sucedida, False caso contrário
    """
    # print(f"[DEBUG-PYTHON] update_index em utils/chat_storage.py chamada para conversa ID: {conversation['id']}")
    ensure_directories()
    
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # print("[DEBUG-PYTHON] Arquivo de índice não encontrado ou inválido, criando novo")
        index = []
    
    entry = {
        "id": conversation["id"],
        "title": conversation.get("title", "Nova conversa"),
        "timestamp": conversation["timestamp"],
        "filename": f"conversation_{conversation['id']}.json"
    }
    
    # Remover entrada antiga se existir
    index = [item for item in index if item["id"] != conversation["id"]]
    index.append(entry)
    index.sort(key=lambda x: x["timestamp"], reverse=True)
    
    try:
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        # print(f"[DEBUG-PYTHON] Índice atualizado com sucesso para conversa {conversation['id']}")
        return True
    except Exception as e:
        print(f"[ERRO-PYTHON] Falha ao atualizar índice: {str(e)}")
        return False

def get_conversation_by_id(conversation_id):
    """
    Recupera uma conversa específica pelo ID.
    
    Args:
        conversation_id (str): ID da conversa a ser recuperada
        
    Returns:
        dict: Objeto de conversa completo ou None se não encontrada
    """
    # print(f"[DEBUG-PYTHON] get_conversation_by_id em utils/chat_storage.py chamada para ID: {conversation_id}")
    filename = f"conversation_{conversation_id}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            conversa = json.load(f)
            # print(f"[DEBUG-PYTHON] Conversa {conversation_id} carregada com sucesso")
            return conversa
    except FileNotFoundError:
        # print(f"[DEBUG-PYTHON] Conversa {conversation_id} não encontrada")
        return None
    except json.JSONDecodeError:
        print(f"[ERRO-PYTHON] Arquivo de conversa corrompido: {conversation_id}")
        return None
    except Exception as e:
        print(f"[ERRO-PYTHON] Erro ao carregar conversa: {str(e)}")
        return None

def get_conversation_history():
    """
    Recupera o histórico de todas as conversas a partir do arquivo de índice.
    Verifica se os arquivos correspondentes ainda existem.
    
    Returns:
        list: Lista de metadados de todas as conversas válidas
    """
    # print("[DEBUG-PYTHON] get_conversation_history em utils/chat_storage.py chamada")
    ensure_directories()
    
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            index = json.load(f)
            
        # Verificar se todos os arquivos ainda existem
        valid_entries = []
        for entry in index:
            filepath = os.path.join(CONVERSATIONS_DIR, entry.get("filename", ""))
            if os.path.exists(filepath):
                valid_entries.append(entry)
            else:
                # print(f"[DEBUG-PYTHON] Arquivo não encontrado para conversa {entry.get('id')}: {filepath}")
                pass
        
        # print(f"[DEBUG-PYTHON] Histórico de conversas carregado: {len(valid_entries)} conversas válidas")
        return valid_entries
    except (FileNotFoundError, json.JSONDecodeError):
        # print("[DEBUG-PYTHON] Arquivo de índice não encontrado ou inválido")
        return []
    except Exception as e:
        print(f"[ERRO-PYTHON] Erro ao carregar histórico: {str(e)}")
        return []

def add_message_to_conversation(conversation_id, content, role, message_id=None):
    """
    Adiciona uma mensagem a uma conversa existente.
    Se a conversa não existir, cria uma nova.
    
    Args:
        conversation_id (str): ID da conversa
        content (str): Conteúdo da mensagem
        role (str): Papel do autor da mensagem ('user' ou 'assistant')
        message_id (str, optional): ID único da mensagem. Se não fornecido, gera um novo.
        
    Returns:
        str: ID único da mensagem adicionada
    """
    # print(f"[DEBUG-PYTHON] add_message_to_conversation em utils/chat_storage.py chamada para conversa {conversation_id}, role: {role}")
    
    conversation = get_conversation_by_id(conversation_id)
    
    if not conversation:
        # print(f"[DEBUG-PYTHON] Criando nova conversa para ID: {conversation_id}")
        conversation = {
            "id": conversation_id,
            "title": "Nova conversa",
            "timestamp": datetime.now().isoformat(),
            "messages": []
        }
    
    # Usar o message_id fornecido ou gerar um novo
    if message_id is None:
        message_id = str(uuid.uuid4())  # Gera um ID único no formato de string
    
    message = {
        "message_id": message_id,
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    
    conversation["messages"].append(message)
    conversation["timestamp"] = datetime.now().isoformat()
    
    # Definir título automaticamente com base na primeira mensagem do usuário
    if role == "user" and len([m for m in conversation["messages"] if m["role"] == "user"]) == 1:
        conversation["title"] = content[:30] + "..." if len(content) > 30 else content
        # print(f"[DEBUG-PYTHON] Título da conversa atualizado para: {conversation['title']}")
    
    save_conversation(conversation)
    update_index(conversation)
    # print(f"[DEBUG-PYTHON] Mensagem {message_id} adicionada com sucesso à conversa {conversation_id}")
    
    return message_id  # Retorna o ID da mensagem para uso posterior

def update_message_in_conversation(conversation_id, message_id, new_content):
    """
    Atualiza o conteúdo de uma mensagem existente em uma conversa.
    
    Args:
        conversation_id (str): ID da conversa
        message_id (str): ID da mensagem a ser atualizada
        new_content (str): Novo conteúdo da mensagem
        
    Returns:
        bool: True se a mensagem foi atualizada com sucesso, False caso contrário
    """
    # print(f"[DEBUG-PYTHON] update_message_in_conversation chamada para mensagem {message_id} na conversa {conversation_id}")
    
    conversation = get_conversation_by_id(conversation_id)
    
    if not conversation:
        print(f"[ERRO-PYTHON] Conversa não encontrada: {conversation_id}")
        return False
    
    # Procura a mensagem pelo ID
    for message in conversation["messages"]:
        if message.get("message_id") == message_id:
            # Atualiza o conteúdo da mensagem
            message["content"] = new_content
            message["updated_at"] = datetime.now().isoformat()
            
            # Salva a conversa atualizada
            save_conversation(conversation)
            # print(f"[DEBUG-PYTHON] Mensagem {message_id} atualizada com sucesso")
            return True
    
    print(f"[ERRO-PYTHON] Mensagem {message_id} não encontrada na conversa {conversation_id}")
    return False

def delete_conversation(conversation_id):
    """
    Exclui uma conversa e sua entrada no índice.
    
    Args:
        conversation_id (str): ID da conversa a ser excluída
        
    Returns:
        bool: True se a conversa foi excluída com sucesso, False caso contrário
    """
    filename = f"conversation_{conversation_id}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    try:
        # Remove o arquivo da conversa se existir
        if os.path.exists(filepath):
            os.remove(filepath)
            
        # Remove a entrada do índice
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                index = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            index = []
            
        # Filtra a conversa do índice
        index = [item for item in index if item["id"] != conversation_id]
        
        # Salva o índice atualizado
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao excluir conversa: {str(e)}")
        return False

def rename_conversation(conversation_id, new_title):
    """
    Renomeia uma conversa existente.
    
    Args:
        conversation_id (str): ID da conversa a ser renomeada
        new_title (str): Novo título para a conversa
        
    Returns:
        bool: True se a conversa foi renomeada com sucesso, False caso contrário
    """
    conversation = get_conversation_by_id(conversation_id)
    if not conversation:
        print(f"[ERRO] Conversa {conversation_id} não existe")
        return False
        
    try:
        # Atualiza o título com validação
        new_title = new_title.strip()
        if not new_title or len(new_title) > 100:
            print("[ERRO] Título inválido ou muito longo")
            return False
            
        conversation["title"] = new_title
        conversation["timestamp"] = datetime.now().isoformat() # Atualiza timestamp
        
        # Salva as alterações
        save_success = save_conversation(conversation)
        if not save_success:
            print("[ERRO] Falha ao salvar conversa")
            return False
            
        index_success = update_index(conversation)
        if not index_success:
            print("[ERRO] Falha ao atualizar índice")
            return False
        
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao renomear conversa: {str(e)}")
        return False
