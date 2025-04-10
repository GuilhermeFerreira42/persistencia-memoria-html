import os
import json
import yt_dlp
import re
from typing import Optional, Dict, Any, Tuple

class YoutubeHandler:
    def __init__(self, download_path: str = "./temp"):
        self.download_path = download_path
        if not os.path.exists(download_path):
            os.makedirs(download_path)

    def download_subtitles(self, video_url: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Baixa legendas do vídeo em PT-BR, PT ou EN, com fallback para legendas automáticas.
        Retorna uma tupla (caminho_do_arquivo, título_do_vídeo).
        """
        print(f"[INFO] Tentando baixar legendas para: {video_url}")
        
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
                print("[INFO] Iniciando extração de informações do vídeo...")
                info = ydl.extract_info(video_url, download=True)
                
                if not info:
                    print("[ERRO] Não foi possível extrair informações do vídeo")
                    return None, None
                
                video_id = info.get('id')
                video_title = info.get('title', 'Sem título')
                print(f"[INFO] ID do vídeo: {video_id}, Título: {video_title}")

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
                            print(f"[INFO] Legenda encontrada: {subtitle_file}")
                            return subtitle_file, video_title

                print(f"[ERRO] Nenhuma legenda encontrada para {video_id} em PT-BR, PT ou EN")
                return None, video_title

        except yt_dlp.utils.DownloadError as e:
            if '429' in str(e):
                print("[ERRO] Limite de requisições excedido (429). Tente novamente mais tarde.")
            else:
                print(f"[ERRO] Erro no download: {str(e)}")
            return None, None
        except Exception as e:
            print(f"[ERRO] Falha ao baixar legendas: {str(e)}")
            import traceback
            print(f"[DEBUG] Traceback completo: {traceback.format_exc()}")
            return None, None

    def clean_subtitles(self, subtitle_file: str) -> Optional[str]:
        """
        Limpa as legendas removendo timestamps, formatação e repetições
        Retorna o texto limpo
        """
        print(f"[DEBUG] clean_subtitles recebeu: {subtitle_file} (tipo: {type(subtitle_file)})")
        
        if not isinstance(subtitle_file, str):
            print(f"[ERRO] subtitle_file não é uma string, é {type(subtitle_file)}")
            return None
            
        if not os.path.exists(subtitle_file):
            print(f"[ERRO] Arquivo não existe: {subtitle_file}")
            return None

        try:
            # Tenta diferentes codificações
            content = None
            for encoding in ['utf-8', 'latin1', 'cp1252']:
                try:
                    with open(subtitle_file, 'r', encoding=encoding) as f:
                        content = f.read()
                        print(f"[DEBUG] Arquivo lido com sucesso usando encoding: {encoding}")
                        break
                except UnicodeDecodeError:
                    print(f"[DEBUG] Falha ao ler com encoding: {encoding}")
                    continue
            
            if content is None:
                raise Exception("Não foi possível ler o arquivo com nenhuma codificação suportada")

            print("[DEBUG] Iniciando limpeza das legendas...")
            
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
                print(f"[DEBUG] Arquivo temporário removido: {subtitle_file}")
            except Exception as e:
                print(f"[AVISO] Não foi possível remover o arquivo temporário: {str(e)}")
            
            # Junta as linhas com espaço e remove espaços extras
            result = ' '.join(cleaned_lines).strip()
            print(f"[DEBUG] Texto limpo gerado com sucesso, tamanho: {len(result)} caracteres")
            print(f"[DEBUG] Primeiros 100 caracteres: {result[:100]}...")
            return result
            
        except Exception as e:
            print(f"[ERRO] Erro ao limpar legendas: {str(e)}")
            import traceback
            print(f"[DEBUG] Traceback completo: {traceback.format_exc()}")
            return None
