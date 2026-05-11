#!/bin/bash
if [ ! -d "supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase
fi
cd supabase/docker
cp .env.example .env
sed -i 's|API_EXTERNAL_URL=http://localhost:8000|API_EXTERNAL_URL=http://192.168.1.111:8000|g' .env
sed -i 's|SITE_URL=http://localhost:3000|SITE_URL=http://192.168.1.111:3100|g' .env
sudo docker compose pull
sudo docker compose up -d
