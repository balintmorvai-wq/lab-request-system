#!/bin/bash
cd backend
exec gunicorn app:app --bind 0.0.0.0:$PORT --timeout 60 --workers 1
