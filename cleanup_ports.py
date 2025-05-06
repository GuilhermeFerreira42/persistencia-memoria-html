"""
Script utilitário para verificar e limpar portas em uso.
Especialmente útil quando a aplicação principal encontra erros de porta já em uso.
"""

import os
import sys
import subprocess
import time

# Portas usadas pela aplicação
PORTS_TO_CHECK = [5000, 5001, 5002]

def check_port(port):
    """Verifica se uma porta está em uso e retorna o PID do processo que a utiliza"""
    try:
        # Windows netstat para encontrar processos usando a porta
        cmd = f"netstat -ano | findstr :{port}"
        result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
        
        if result.returncode == 0 and result.stdout.strip():
            for line in result.stdout.split('\n'):
                if f":{port}" in line and "LISTENING" in line:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        # O último campo deve ser o PID
                        pid = parts[-1]
                        return int(pid)
        
        return None
    except Exception as e:
        print(f"Erro ao verificar porta {port}: {str(e)}")
        return None

def kill_process(pid):
    """Tenta encerrar um processo pelo PID"""
    try:
        print(f"Tentando encerrar processo {pid}...")
        subprocess.run(f"taskkill /F /PID {pid}", shell=True, check=True)
        print(f"Processo {pid} encerrado com sucesso.")
        return True
    except subprocess.CalledProcessError:
        print(f"Não foi possível encerrar o processo {pid}. Talvez seja necessário privilégios de administrador.")
        return False
    except Exception as e:
        print(f"Erro ao encerrar processo {pid}: {str(e)}")
        return False

def main():
    print("Verificando portas em uso pela aplicação...")
    
    pids_found = False
    for port in PORTS_TO_CHECK:
        pid = check_port(port)
        if pid:
            pids_found = True
            print(f"Porta {port} em uso pelo processo PID {pid}")
            
            response = input(f"Deseja encerrar o processo {pid} para liberar a porta {port}? (s/n): ")
            if response.lower() == 's':
                if kill_process(pid):
                    print(f"Porta {port} liberada.")
                    time.sleep(1)  # Dar tempo para o sistema liberar a porta
                else:
                    print(f"Não foi possível liberar a porta {port}.")
        else:
            print(f"Porta {port} está livre.")
    
    if not pids_found:
        print("Todas as portas estão livres. Você pode iniciar a aplicação normalmente.")
        
    print("\nDica: Se continuar tendo problemas, tente iniciar a aplicação em uma porta específica:")
    print("python app.py --port 5005")

if __name__ == "__main__":
    main() 