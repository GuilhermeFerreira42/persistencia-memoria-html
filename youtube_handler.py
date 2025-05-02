"""
Manipulador de Vídeos do YouTube

Este módulo fornece funcionalidades para trabalhar com vídeos do YouTube,
especialmente para baixar e processar legendas/transcrições.

A classe YoutubeHandler oferece métodos para:
- Baixar legendas de vídeos do YouTube (PT-BR, PT e EN)
- Limpar e formatar o texto das legendas
- Dividir transcrições em blocos para processamento
"""

import os
import json
import yt_dlp
import re
import logging
import traceback
from typing import Optional, Dict, Any, Tuple

# Configuração do logger
logger = logging.getLogger('youtube_handler')

class YoutubeHandler:
    """
    Classe para manipular vídeos do YouTube, com foco em download e processamento de legendas.
    Oferece suporte para baixar legendas em português e inglês, limpá-las e dividi-las em blocos.
    """
    
    def __init__(self, download_path: str = "./temp"):
        """
        Inicializa o manipulador de vídeos do YouTube.
        
        Args:
            download_path (str): Caminho para salvar arquivos temporários
        """
        logger.info("Iniciando YoutubeHandler")
        self.download_path = download_path
        if not os.path.exists(download_path):
            os.makedirs(download_path)
            logger.debug(f"Diretório criado: {download_path}")

    def download_subtitles(self, video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Baixa legendas do vídeo em PT-BR, PT ou EN, com fallback para legendas automáticas.
        
        Args:
            video_url (str): URL do vídeo do YouTube
            
        Returns:
            Tuple[Optional[str], Optional[str]]: (caminho_do_arquivo, título_do_vídeo)
                Se não for possível baixar, o primeiro elemento será None
        """
        logger.info(f"Iniciando download de legendas para: {video_url}")
        
        # Configuração para baixar legendas apenas em PT-BR, PT e EN
        ydl_opts = {
            'writesubtitles': True,          # Baixa legendas manuais
            'writeautomaticsub': True,       # Baixa legendas automáticas como fallback
            'subtitleslangs': ['pt-BR', 'pt', 'en'],  # Limita a PT-BR, PT e EN
            'skip_download': True,           # Não baixa o vídeo
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': False,                  # Logs detalhados para diagnóstico
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.debug("Extraindo informações do vídeo...")
                info = ydl.extract_info(video_url, download=True)
                
                if not info:
                    logger.error("Não foi possível extrair informações do vídeo")
                    return None, None
                
                video_id = info.get('id')
                video_title = info.get('title', 'Sem título')
                logger.info(f"Vídeo encontrado - ID: {video_id}, Título: {video_title}")

                # Lista de sufixos para legendas manuais e automáticas, na ordem de prioridade
                lang_options = [
                    # PT-BR (manuais e automáticas)
                    [f"{video_id}.pt-BR.vtt", f"{video_id}.pt_BR.vtt", f"{video_id}.pt-br.vtt",
                     f"{video_id}.pt-BR.auto.vtt", f"{video_id}.pt_BR.auto.vtt"],
                    # PT (manuais e automáticas)
                    [f"{video_id}.pt.vtt", f"{video_id}.pt-PT.vtt", f"{video_id}.pt.auto.vtt"],
                    # EN (manuais e automáticas)
                    [f"{video_id}.en.vtt", f"{video_id}.en.auto.vtt"]
                ]

                # Busca por legendas na ordem de prioridade
                for lang_group in lang_options:
                    for file_name in lang_group:
                        subtitle_file = os.path.join(self.download_path, file_name)
                        if os.path.exists(subtitle_file):
                            logger.info(f"Legenda encontrada: {file_name}")
                            return subtitle_file, video_title

                logger.warning(f"Nenhuma legenda encontrada para {video_id} em PT-BR, PT ou EN")
                return None, video_title

        except yt_dlp.utils.DownloadError as e:
            if '429' in str(e):
                logger.error("Limite de requisições excedido (429). Tente novamente mais tarde.")
            else:
                logger.error(f"Erro no download: {str(e)}")
            return None, None
        except Exception as e:
            logger.error(f"Falha ao baixar legendas: {str(e)}")
            logger.error(traceback.format_exc())
            return None, None

    def clean_subtitles(self, subtitle_file: str) -> Optional[str]:
        """
        Limpa as legendas removendo timestamps, formatação e repetições.
        
        Args:
            subtitle_file (str): Caminho do arquivo de legendas
            
        Returns:
            Optional[str]: Texto limpo das legendas ou None se ocorrer erro
        """
        logger.debug(f"Iniciando limpeza de legendas: {subtitle_file}")
        
        if not isinstance(subtitle_file, str):
            logger.error(f"subtitle_file não é uma string, é {type(subtitle_file)}")
            return None
            
        if not os.path.exists(subtitle_file):
            logger.error(f"Arquivo não existe: {subtitle_file}")
            return None

        try:
            # Tenta diferentes codificações
            content = None
            for encoding in ['utf-8', 'latin1', 'cp1252']:
                try:
                    with open(subtitle_file, 'r', encoding=encoding) as f:
                        content = f.read()
                        logger.debug(f"Arquivo lido com sucesso usando encoding: {encoding}")
                        break
                except UnicodeDecodeError:
                    logger.debug(f"Falha ao ler com encoding: {encoding}")
                    continue
            
            if content is None:
                raise Exception("Não foi possível ler o arquivo com nenhuma codificação suportada")

            logger.debug("Iniciando processo de limpeza do texto...")
            
            # Remove cabeçalho WEBVTT e metadados
            content = re.sub(r'WEBVTT.*\n', '', content)
            content = re.sub(r'Kind:.*\n', '', content)
            content = re.sub(r'Language:.*\n', '', content)
            
            # Remove timestamps e números de sequência
            content = re.sub(r'\d{2}:\d{2}:\d{2}[\.,]\d{3} --> .*\n', '', content)
            content = re.sub(r'^\d+$', '', content, flags=re.MULTILINE)
            
            # Remove tags HTML e formatação
            content = re.sub(r'<[^>]+>', '', content)
            content = re.sub(r'{\\an\d}', '', content)
            content = re.sub(r'\[.*?\]', '', content)
            
            # Processa linha por linha removendo duplicatas
            seen_lines = set()
            cleaned_lines = []
            
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith(('<', '{', '[')) and line not in seen_lines:
                    cleaned_lines.append(line)
                    seen_lines.add(line)

            # Remove arquivo temporário
            try:
                os.remove(subtitle_file)
                logger.debug(f"Arquivo temporário removido: {subtitle_file}")
            except Exception as e:
                logger.warning(f"Não foi possível remover o arquivo temporário: {str(e)}")
            
            # Junta as linhas com espaço e remove espaços extras
            result = ' '.join(cleaned_lines).strip()
            logger.info(f"Texto limpo gerado com sucesso: {len(result)} caracteres")
            logger.debug(f"Amostra do texto limpo: {result[:100]}...")
            return result
            
        except Exception as e:
            logger.error(f"Erro ao limpar legendas: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    def download_and_clean_transcript(self, video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Combinação das funções download_subtitles e clean_subtitles em um único método.
        
        Args:
            video_url (str): URL do vídeo do YouTube
            
        Returns:
            Tuple[Optional[str], Optional[str]]: (transcrição_limpa, título_do_vídeo)
        """
        logger.info(f"Iniciando download e limpeza de transcrição para: {video_url}")
        
        subtitle_file, video_title = self.download_subtitles(video_url)
        if subtitle_file:
            logger.debug(f"Legendas baixadas com sucesso, iniciando limpeza: {video_title}")
            cleaned_transcript = self.clean_subtitles(subtitle_file)
            if cleaned_transcript:
                logger.info(f"Transcrição processada com sucesso para: {video_title}")
                return cleaned_transcript, video_title
            else:
                logger.error(f"Falha ao limpar legendas para: {video_title}")
        else:
            logger.error(f"Falha ao baixar legendas para: {video_url}")
        
        return None, video_title
        
    def split_transcript_into_chunks(self, transcript: str, words_per_chunk: int = 300) -> list[str]:
        """
        Divide a transcrição em blocos de aproximadamente N palavras.
        
        Args:
            transcript (str): Texto da transcrição limpa
            words_per_chunk (int): Número aproximado de palavras por bloco
            
        Returns:
            list[str]: Lista de blocos de texto
        """
        if not transcript:
            logger.error("Transcrição vazia, não é possível dividir em blocos")
            return []
            
        try:
            # Divide o texto em palavras
            words = transcript.split()
            total_words = len(words)
            logger.debug(f"Total de palavras na transcrição: {total_words}")
            
            # Calcula quantos blocos serão necessários
            num_chunks = max(1, (total_words + words_per_chunk - 1) // words_per_chunk)
            logger.debug(f"Dividindo em aproximadamente {num_chunks} blocos")
            
            chunks = []
            for i in range(0, total_words, words_per_chunk):
                chunk = ' '.join(words[i:i + words_per_chunk])
                chunks.append(chunk)
                
            logger.info(f"Transcrição dividida em {len(chunks)} blocos de aproximadamente {words_per_chunk} palavras")
            return chunks
            
        except Exception as e:
            logger.error(f"Erro ao dividir transcrição em blocos: {str(e)}")
            logger.error(traceback.format_exc())
            return []
