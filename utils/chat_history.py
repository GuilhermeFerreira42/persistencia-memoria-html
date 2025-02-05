import json
from datetime import datetime
import os

HISTORY_FILE = 'data/chat_history.json'

def ensure_data_directory():
    os.makedirs('data', exist_ok=True)

def get_conversation_history():
    ensure_data_directory()
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except json.JSONDecodeError as e:
        print(f"Erro ao carregar histórico: {str(e)}")
        return []  # Retorna uma lista vazia em caso de erro
    except Exception as e:
        print(f"Erro ao carregar histórico: {str(e)}")
        return []  # Retorna uma lista vazia em caso de erro

def get_conversation_by_id(conversation_id):
    """Busca uma conversa específica pelo ID"""
    conversations = get_conversation_history()
    for conversation in conversations:
        if conversation['id'] == conversation_id:
            return conversation
    return None
  
def save_conversation(message, response, conversation_id=None):
    """
    Salva ou atualiza uma conversa no histórico.
    Se conversation_id for fornecido, atualiza a conversa existente.
    Caso contrário, cria uma nova conversa.
    """
    ensure_data_directory()
    try:
        # Carrega o histórico atual
        conversations = get_conversation_history()
        
        if conversation_id:
            # Atualiza conversa existente
            updated = False
            for conversation in conversations:
                if conversation['id'] == conversation_id:
                    conversation['messages'].extend([
                        {'role': 'user', 'content': message},
                        {'role': 'assistant', 'content': response}
                    ])
                    conversation['timestamp'] = datetime.now().isoformat()
                    updated = True
                    break
            
            # Se não encontrou o ID, cria uma nova conversa (backup seguro)
            if not updated:
                conversation_id = str(len(conversations) + 1)
                new_conversation = {
                    'id': conversation_id,
                    'timestamp': datetime.now().isoformat(),
                    'messages': [
                        {'role': 'user', 'content': message},
                        {'role': 'assistant', 'content': response}
                    ]
                }
                conversations.append(new_conversation)
        else:
            # Cria nova conversa
            conversation_id = str(len(conversations) + 1)
            new_conversation = {
                'id': conversation_id,
                'timestamp': datetime.now().isoformat(),
                'messages': [
                    {'role': 'user', 'content': message},
                    {'role': 'assistant', 'content': response}
                ]
            }
            conversations.append(new_conversation)
        
        # Salva as conversas atualizadas
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(conversations, f, ensure_ascii=False, indent=2)
        
        return conversation_id
    except Exception as e:
        print(f"Erro ao salvar conversa: {str(e)}")
        return None
 