from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import jwt
from datetime import datetime, timedelta

router = APIRouter()
security = HTTPBearer()

# Use a secure secret key for JWT decoding/encoding
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_fallback_key")
ALGORITHM = "HS256"
# In a real app this should default to None, but we provide a fallback for testing
TEAM_PASSWORD = os.getenv("TEAM_PASSWORD", "adminvideoslice2026")

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) 

class LoginRequest(BaseModel):
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    if request.password != TEAM_PASSWORD:
        raise HTTPException(
            status_code=401,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create an access token valid for 30 days
    access_token_expires = timedelta(days=30)
    access_token = create_access_token(
        data={"sub": "autoclip_team"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
