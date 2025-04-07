import os
import json
import yt_dlp
import re
from typing import Optional, Dict, Any, Tuple

class YoutubeHandler:
    def __init__(self, download_path: str = "./temp", lang_preferido: str = "pt"):
        self.download_path = download_path
        self.lang_preferido = lang_preferido
        if not os.path.exists(download_path):
            os.makedirs(download_path)

    def download_subtitles(self, video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Baixa as legendas de um vídeo do YouTube no idioma especificado
        Retorna uma tupla (caminho_do_arquivo, título_do_vídeo)
        """
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,  # Aceita legendas automáticas como fallback
            'subtitleslangs': [self.lang_preferido],  # Apenas o idioma preferido
            'skip_download': True,
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                video_title = info.get('title', 'Vídeo sem título')
                
                # Procura pelo arquivo de legenda no idioma preferido
                subtitle_file = os.path.join(self.download_path, f"{video_id}.{self.lang_preferido}.vtt")
                if os.path.exists(subtitle_file):
                    print(f"Encontradas legendas em {self.lang_preferido}: {subtitle_file}")
                    return subtitle_file, video_title
                
                # Se não encontrar, tenta com variações do idioma
                lang_variations = {
                    'pt': ['.pt-BR.vtt', '.pt_BR.vtt', '.pt-br.vtt', '.pt-PT.vtt'],
                    'en': ['.en-US.vtt', '.en_US.vtt', '.en-GB.vtt', '.en_GB.vtt']
                }
                
                if self.lang_preferido in lang_variations:
                    for suffix in lang_variations[self.lang_preferido]:
                        file = os.path.join(self.download_path, f"{video_id}{suffix}")
                        if os.path.exists(file):
                            print(f"Encontradas legendas em variação de {self.lang_preferido}: {file}")
                            return file, video_title
                
                print(f"[ERRO] Legendas em {self.lang_preferido} não disponíveis para este vídeo")
                return None, None
                
        except Exception as e:
            print(f"Erro ao baixar legendas: {str(e)}")
            return None, None

    def clean_subtitles(self, subtitle_file: str) -> Optional[str]:
        """
        Limpa as legendas removendo timestamps, formatação e repetições
        Retorna o texto limpo
        """
        if not os.path.exists(subtitle_file):
            return None

        try:
            # Tenta diferentes codificações
            content = None
            for encoding in ['utf-8', 'latin1', 'cp1252']:
                try:
                    with open(subtitle_file, 'r', encoding=encoding) as f:
                        content = f.read()
                        break
                except UnicodeDecodeError:
                    continue
            
            if content is None:
                raise Exception("Não foi possível ler o arquivo com nenhuma codificação suportada")

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
            os.remove(subtitle_file)
            
            # Junta as linhas com espaço e remove espaços extras
            return ' '.join(cleaned_lines).strip()
            
        except Exception as e:
            print(f"Erro ao limpar legendas: {str(e)}")
            return None
