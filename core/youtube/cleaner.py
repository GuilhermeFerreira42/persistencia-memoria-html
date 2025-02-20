
import re
import chardet

class SubtitleCleaner:
    def __init__(self):
        self._timestamp_regex = re.compile(
            r'\d{2}:\d{2}:\d{2}[\.,]\d{3} --> \d{2}:\d{2}:\d{2}[\.,]\d{3}'
        )
        
    def sanitize(self, file_path: str) -> str:
        raw_data = self._read_file(file_path)
        return self._process_content(raw_data)

    def _read_file(self, path: str) -> str:
        with open(path, 'rb') as f:
            raw = f.read()
            encoding = chardet.detect(raw)['encoding'] or 'utf-8'
            return raw.decode(encoding, errors='replace')

    def _process_content(self, content: str) -> str:
        cleaned = self._timestamp_regex.sub('', content)
        cleaned = re.sub(r'<[^>]+>|{\\an\d+}', '', cleaned)
        return ' '.join(cleaned.split())
