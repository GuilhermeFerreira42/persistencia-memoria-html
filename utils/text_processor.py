def split_text(text, words_per_chunk=300):
    """
    Divide um texto em chunks menores baseado no número de palavras.
    """
    words = text.split()
    chunks = []
    
    for i in range(0, len(words), words_per_chunk):
        chunk = ' '.join(words[i:i + words_per_chunk])
        chunks.append(chunk)
    
    return chunks