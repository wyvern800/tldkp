#!/usr/bin/env bash
set -e

apt-get update && apt-get install -y unixodbc-dev
npm install
npm run build
