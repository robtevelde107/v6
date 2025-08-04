from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import httpx

# Database setup
DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    balance = Column(Float, default=0.0)

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    exchange = Column(String)
    symbol = Column(String)
    side = Column(String)
    amount = Column(Float)
    price = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Log(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class UserCreate(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class DepositRequest(BaseModel):
    username: str
    amount: float

class TradeRequest(BaseModel):
    username: str
    exchange: str
    symbol: str
    side: str  # "buy" or "sell"
    amount: float

# Helper functions
async def fetch_binance_price(symbol: str) -> float:
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        return float(data.get("price", 0.0))

# Exchanges and symbols
EXCHANGES = {
    "binance": ["BTCUSDT", "ETHUSDT"],
    "coinbase": ["BTCUSDT", "ETHUSDT"],  # using same symbols but from binance for demo
}

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    new_user = User(username=user.username, password=user.password, balance=0.0)
    db.add(new_user)
    db.add(Log(message=f"User {user.username} registered"))
    db.commit()
    return {"message": "Registration successful"}

@app.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or user.password != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    db.add(Log(message=f"User {request.username} logged in"))
    db.commit()
    return {"message": "Login successful"}

@app.post("/deposit")
def deposit(dep: DepositRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == dep.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.balance += dep.amount
    db.add(Log(message=f"{dep.username} deposited {dep.amount}"))
    db.commit()
    return {"balance": user.balance}

@app.get("/exchanges")
def list_exchanges():
    return {"exchanges": list(EXCHANGES.keys())}

@app.get("/exchanges/{exchange}/symbols")
def list_symbols(exchange: str):
    if exchange not in EXCHANGES:
        raise HTTPException(status_code=404, detail="Exchange not supported")
    return {"symbols": EXCHANGES[exchange]}

@app.get("/price/{exchange}/{symbol}")
async def get_price(exchange: str, symbol: str):
    if exchange == "binance":
        price = await fetch_binance_price(symbol)
    elif exchange == "coinbase":
        # For demo, use binance price for coinbase as well
        price = await fetch_binance_price(symbol)
    else:
        raise HTTPException(status_code=404, detail="Exchange not supported")
    return {"price": price}

@app.post("/trade")
async def trade(order: TradeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == order.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # fetch price
    price = (await get_price(order.exchange, order.symbol))["price"]
    total = price * order.amount
    if order.side == "buy":
        if user.balance < total:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        user.balance -= total
    elif order.side == "sell":
        user.balance += total
    else:
        raise HTTPException(status_code=400, detail="Invalid side")
    trade_record = Trade(user_id=user.id, exchange=order.exchange, symbol=order.symbol,
                         side=order.side, amount=order.amount, price=price)
    db.add(trade_record)
    db.add(Log(message=f"{order.username} executed {order.side} of {order.amount} {order.symbol} on {order.exchange} at {price}"))
    db.commit()
    return {"balance": user.balance, "price": price}

@app.get("/logs")
def get_logs(db: Session = Depends(get_db)):
    logs = db.query(Log).order_by(Log.id.desc()).limit(50).all()
    return {"logs": [f"{log.timestamp}: {log.message}" for log in logs]}
