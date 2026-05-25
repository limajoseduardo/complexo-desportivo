#!/bin/bash
# Fix directory permissions on Proxmox VM
# This script is designed to run with sudo

sudo chmod -R 755 /opt/complexo-desportivo
sudo chmod -R 755 /opt/complexo-desportivo/{backend,frontend,nginx,config,scripts,data}
sudo chmod -R 755 /opt/complexo-desportivo/data/{postgres,redis,elasticsearch}

echo "✓ Permissions fixed for /opt/complexo-desportivo"
ls -la /opt/complexo-desportivo | head -20
