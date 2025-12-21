from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# 1. Enable CORS (Allows your site to talk to the backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. The API Route (Your "Wishlist" Database)
@app.get("/api/models")
async def get_models():
    # In a real app, this would come from a database. 
    # For now, we list the files manually or scan the folder.
    base_url = "/static/models"
    return [
        {
            "id": 1, 
            "name": "Velvet Chair", 
            "path": f"{base_url}/gaming_chair.glb", 
            "scale": 0.5, # Adjust this if model is too big/small
            "icon": "🪑"
        },
        {
            "id": 2, 
            "name": "Coffee Table", 
            "path": f"{base_url}/study_table.glb", 
            "scale": 0.01, # Some models use Millimeters (0.01) vs Meters (1.0)
            "icon": "🛋️"
        }
    ]

# 3. Mount the Static Folder (Serves css, js, models)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 4. The Homepage Route
@app.get("/")
async def read_root():
    return FileResponse('static/index.html')