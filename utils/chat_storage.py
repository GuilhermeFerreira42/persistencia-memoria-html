
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
    
    save_conversation(conversation)
    update_index(conversation)
    
    return conversation_id

def save_conversation(conversation):
    """Salva uma conversa em seu arquivo JSON"""
    filename = f"conversation_{conversation['id']}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    print(f"[DEBUG] Salvando conversa em: {filepath}")
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(conversation, f, ensure_ascii=False, indent=2)
        print("[DEBUG] Conversa salva com sucesso")
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao salvar conversa: {str(e)}")
        return False

def update_index(conversation):
    """Atualiza o arquivo de índice com os metadados da conversa"""
    ensure_directories()
    
    print(f"[DEBUG] Atualizando índice para conversa: {conversation['id']}")
    
    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("[DEBUG] Arquivo de índice não encontrado ou inválido, criando novo")
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
        print("[DEBUG] Índice atualizado com sucesso")
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao atualizar índice: {str(e)}")
        return False

def get_conversation_by_id(conversation_id):
    """Recupera uma conversa específica pelo ID"""
    filename = f"conversation_{conversation_id}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    print(f"[DEBUG] Buscando conversa: {conversation_id}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[DEBUG] Conversa não encontrada: {conversation_id}")
        return None
    except json.JSONDecodeError:
        print(f"[ERRO] Arquivo de conversa corrompido: {conversation_id}")
        return None
    except Exception as e:
        print(f"[ERRO] Erro ao carregar conversa: {str(e)}")
        return None

def get_conversation_history():
    """Recupera o histórico de todas as conversas"""
    ensure_directories()
    
    print("[DEBUG] Carregando histórico de conversas")
    
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
                print(f"[DEBUG] Arquivo não encontrado para conversa {entry.get('id')}: {filepath}")
                
        return valid_entries
    except (FileNotFoundError, json.JSONDecodeError):
        print("[DEBUG] Arquivo de índice não encontrado ou inválido")
        return []
    except Exception as e:
        print(f"[ERRO] Erro ao carregar histórico: {str(e)}")
        return []

def add_message_to_conversation(conversation_id, content, role):
    """Adiciona uma mensagem a uma conversa existente"""
    conversation = get_conversation_by_id(conversation_id)
    
    if not conversation:
        print(f"[DEBUG] Criando nova conversa para ID: {conversation_id}")
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
    
    if role == "user" and len([m for m in conversation["messages"] if m["role"] == "user"]) == 1:
        conversation["title"] = content[:30] + "..." if len(content) > 30 else content
    
    save_conversation(conversation)
    update_index(conversation)

def delete_conversation(conversation_id):
    """Exclui uma conversa e sua entrada no índice"""
    filename = f"conversation_{conversation_id}.json"
    filepath = os.path.join(CONVERSATIONS_DIR, filename)
    
    print(f"[DEBUG] Tentando excluir conversa: {conversation_id}")
    
    try:
        # Remove o arquivo da conversa se existir
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"[DEBUG] Arquivo da conversa removido: {filepath}")
        else:
            print(f"[DEBUG] Arquivo não encontrado: {filepath}")
            
        # Remove a entrada do índice
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                index = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            print("[DEBUG] Arquivo de índice não encontrado ou inválido")
            index = []
            
        # Filtra a conversa do índice
        index = [item for item in index if item["id"] != conversation_id]
        
        # Salva o índice atualizado
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
        
        print("[DEBUG] Conversa excluída com sucesso")
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao excluir conversa: {str(e)}")
        return False

def rename_conversation(conversation_id, new_title):
    """Renomeia uma conversa existente"""
    print(f"[DEBUG] Tentando renomear conversa {conversation_id} para: {new_title}")
    
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
        
        print(f"[DEBUG] Novo título salvo: {conversation['title']}")
        
        # Salva as alterações
        save_success = save_conversation(conversation)
        if not save_success:
            print("[ERRO] Falha ao salvar conversa")
            return False
            
        index_success = update_index(conversation)
        if not index_success:
            print("[ERRO] Falha ao atualizar índice")
            return False
        
        print("[DEBUG] Conversa renomeada com sucesso")
        return True
    except Exception as e:
        print(f"[ERRO] Falha ao renomear conversa: {str(e)}")
        return False
