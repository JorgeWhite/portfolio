from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

@app.get("/hello")
def hello():
    return {"hello": "Hello from FastAPI, Deployment test succesful"}

