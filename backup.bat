@echo off
echo A iniciar backup de seguranca para o GitHub...
echo.
git add .
git commit -m "Backup automatico - %date% %time%"
git pull origin main --rebase
git push origin main
echo.
echo Backup concluido com sucesso! Podes fechar esta janela.
pause