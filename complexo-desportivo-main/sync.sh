#!/bin/bash

# Pede a mensagem de commit
read -p "Mensagem do Commit (Enter para padrao): " msg

# Se a mensagem estiver vazia, usa a padrão
if [ -z "$msg" ]; then
    msg="sync: atualizacao automatica câmara"
fi

echo "[1/3] Adicionando ficheiros..."
git add .

echo "[2/3] Criando commit..."
git commit -m "$msg"

echo "[3/3] Enviando para o GitHub..."
git push origin main

echo "---------------------------------------"
echo "PROCESSO CONCLUIDO."
