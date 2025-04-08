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
        Baixa as legendas de um vídeo do YouTube, priorizando PT-BR
        Retorna uma tupla (caminho_do_arquivo, título_do_vídeo)
        """
        print(f"[DEBUG] download_subtitles iniciado para URL: {video_url}")
        ydl_opts = {
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['pt-BR'],  # Apenas PT-BR
            'skip_download': True,
            'outtmpl': os.path.join(self.download_path, '%(id)s.%(ext)s'),
            'quiet': True
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                print("[DEBUG] Extraindo informações do vídeo...")
                info = ydl.extract_info(video_url, download=True)
                video_id = info['id']
                video_title = info.get('title', 'Vídeo sem título')
                print(f"[DEBUG] Vídeo ID: {video_id}, Título: {video_title}")
                
                # Procura apenas por legendas em PT-BR
                pt_br_files = ['.pt-BR.vtt', '.pt_BR.vtt', '.pt-br.vtt']
                for suffix in pt_br_files:
                    file = os.path.join(self.download_path, f"{video_id}{suffix}")
                    if os.path.exists(file):
                        print(f"[DEBUG] Encontradas legendas em PT-BR: {file}")
                        print(f"[DEBUG] Retornando tupla: ({file}, {video_title})")
                        return file, video_title
                
                # Se não encontrou legendas em PT-BR, tenta legendas automáticas
                auto_pt_br_files = ['.pt-BR.auto.vtt', '.pt_BR.auto.vtt', '.pt-br.auto.vtt']
                for suffix in auto_pt_br_files:
                    file = os.path.join(self.download_path, f"{video_id}{suffix}")
                    if os.path.exists(file):
                        print(f"[DEBUG] Encontradas legendas automáticas em PT-BR: {file}")
                        print(f"[DEBUG] Retornando tupla: ({file}, {video_title})")
                        return file, video_title
                
                print("[DEBUG] Nenhuma legenda em PT-BR encontrada (manual ou automática)")
                return None, None
                
        except Exception as e:
            print(f"[ERRO] Erro ao baixar legendas: {str(e)}")
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
