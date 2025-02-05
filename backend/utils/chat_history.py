from datetime import datetime
from backend.database.database import get_db
from backend.models.conversations import Conversation
from backend.models.messages import Message
import logging
import json

logger = logging.getLogger(__name__)

def save_conversation(message, response, conversation_id=None):
    """
    Salva ou atualiza uma conversa no banco de dados.
    """
    try:
        logger.debug(f"Iniciando salvamento de conversa. ID: {conversation_id}")
        logger.debug(f"Mensagem: {message}")
        logger.debug(f"Resposta: {response}")

        with get_db() as db:
            if not conversation_id:
                logger.debug("Criando nova conversa...")
                conversation = Conversation(title="Nova Conversa")
                db.add(conversation)
                db.commit()
                conversation_id = conversation.id
                logger.debug(f"Nova conversa criada com ID: {conversation_id}")
            else:
                logger.debug(f"Buscando conversa existente com ID: {conversation_id}")
                conversation = db.query(Conversation).filter_by(id=conversation_id).first()
                if not conversation:
                    logger.warning(f"Conversa {conversation_id} não encontrada, criando nova")
                    conversation = Conversation(title="Nova Conversa")
                    db.add(conversation)
                    db.commit()
                    conversation_id = conversation.id

            # Salva a mensagem do usuário
            user_message = Message(
                conversation_id=conversation_id,
                role='user',
                content=message
            )
            db.add(user_message)
            logger.debug(f"Mensagem do usuário salva para conversa {conversation_id}")
            
            # Salva a resposta do assistente
            assistant_message = Message(
                conversation_id=conversation_id,
                role='assistant',
                content=response
            )
            db.add(assistant_message)
            logger.debug(f"Resposta do assistente salva para conversa {conversation_id}")
            
            db.commit()
            logger.debug(f"Todas as mensagens salvas com sucesso para conversa {conversation_id}")
            
            return conversation_id
            
    except Exception as e:
        logger.error(f"Erro ao salvar conversa: {str(e)}", exc_info=True)
        raise

def get_conversation_history():
    """Retorna o histórico completo de conversas com suas mensagens"""
    try:
        logger.debug("Iniciando carregamento do histórico de conversas")
        with get_db() as db:
            conversations = db.query(Conversation).order_by(Conversation.timestamp.desc()).all()
            history = []
            
            for conv in conversations:
                logger.debug(f"Carregando mensagens para conversa {conv.id}")
                messages = db.query(Message).filter_by(conversation_id=conv.id).order_by(Message.timestamp).all()
                
                conversation_data = {
                    'id': conv.id,
                    'title': conv.title,
                    'timestamp': conv.timestamp.isoformat(),
                    'messages': [{
                        'role': msg.role,
                        'content': msg.content,
                        'timestamp': msg.timestamp.isoformat()
                    } for msg in messages]
                }
                history.append(conversation_data)
                logger.debug(f"Conversa {conv.id} carregada com {len(messages)} mensagens")
            
            logger.debug(f"Total de {len(history)} conversas carregadas")
            logger.debug(f"Dados completos do histórico: {json.dumps(history, indent=2)}")
            return history
            
    except Exception as e:
        logger.error(f"Erro ao carregar histórico: {str(e)}", exc_info=True)
        return []