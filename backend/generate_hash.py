"""
Run this inside the backend Docker container to generate the bcrypt hash
for your admin password. Copy the output into your .env file.

Usage (from project root):
    docker compose -f docker-compose.dev.yml run --rm fastapi python generate_hash.py
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

password = input("Enter your admin password: ")
hashed = pwd_context.hash(password)
print(f"\nAdd this to your .env file:")
print(f"ADMIN_PASSWORD_HASH={hashed}")