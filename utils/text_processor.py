
def split_text(text: str, words_per_chunk: int = 300) -> list[str]:
    """
    Divide um texto em chunks menores baseado no número de palavras.
    """
    words = text.split()
    chunks = []
    
    for i in range(0, len(words), words_per_chunk):
        chunk = ' '.join(words[i:i + words_per_chunk])
        chunks.append(chunk)
    
    return chunks

def clean_and_format_text(text: str) -> str:
    """
    Limpa e formata o texto removendo caracteres especiais e formatação desnecessária
    """
    import re
    
    # Remove múltiplos espaços
    text = re.sub(r'\s+', ' ', text)
    # Remove caracteres especiais mantendo pontuação básica
    text = re.sub(r'[^\w\s.,!?-]', '', text)
    # Remove espaços antes de pontuação
    text = re.sub(r'\s+([.,!?])', r'\1', text)
    
    return text.strip()

