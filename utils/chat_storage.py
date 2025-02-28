import json
import os
from datetime import datetime

DATA_DIR = "data"
CONVERSATIONS_DIR = os.path.join(DATA_DIR, "conversations")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")

def ensure_directories():
    """Garante que os diretórios necessários existam"""
    os.makedirs(CONVERSATIONS_DIR, exist_ok=True)

def create_new_conversation():
    """Cria uma nova conversa e retorna seu ID"""
    ensure_directories()
    
    conversation_id = str(int(datetime.now().timestamp() * 1000))
    conversation = {
        "id": conversation_id,
        "title": "Nova conversa",
        "timestamp": datetime.now().isoformat(),
        "messages": []
    }
    
    # Salva a conversa
    save_conversation(conversation)
    
    # Atualiza o índice
    update_index(conversation)
    
    return conversation_id

def save_conversation(conversation):
    """Salva uma conversa em seu arquivo JSON"""
    filename = f"conversation_{conversation['id']}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(conversation, f, ensure_ascii=False, indent=2)

def update_index(conversation):
    """Atualiza o arquivo de índice com os metadados da conversa"""
    ensure_directories()
    
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        index = []
    
    # Atualiza ou adiciona a entrada no índice
    entry = {
        "id": conversation["id"],
        "title": conversation.get("title", "Nova conversa"),
        "timestamp": conversation["timestamp"],
        "filename": f"conversation_{conversation['id']}.json"
    }
    
    # Remove entrada antiga se existir
    index = [item for item in index if item["id"] != conversation["id"]]
    # Adiciona nova entrada
    index.append(entry)
    # Ordena por timestamp decrescente
    index.sort(key=lambda x: x["timestamp"], reverse=True)
    
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

def get_conversation_by_id(conversation_id):
    """Recupera uma conversa específica pelo ID"""
    filename = f"conversation_{conversation_id}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None

def get_conversation_history():
    """Recupera o histórico de todas as conversas"""
    ensure_directories()
    
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def add_message_to_conversation(conversation_id, content, role):
    """Adiciona uma mensagem a uma conversa existente"""
    conversation = get_conversation_by_id(conversation_id)
    
    if not conversation:
        conversation = {
            "id": conversation_id,
            "title": "Nova conversa",
            "timestamp": datetime.now().isoformat(),
            "messages": []
        }
    
    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    }
    
    conversation["messages"].append(message)
    conversation["timestamp"] = datetime.now().isoformat()
    
    # Atualiza o título se for a primeira mensagem do usuário
    if role == "user" and len([m for m in conversation["messages"] if m["role"] == "user"]) == 1:
        conversation["title"] = content[:30] + "..." if len(content) > 30 else content
    
    save_conversation(conversation)
    update_index(conversation)