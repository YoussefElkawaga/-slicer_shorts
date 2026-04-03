"""FastAPI应用入口点"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

# 导入配置管理
from .core.config import settings, get_logging_config, get_api_key

import sys
import io

# Force UTF-8 for stdout/stderr to handle Chinese log messages on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configure logging with UTF-8 handlers
logging_config = get_logging_config()
log_level = getattr(logging, logging_config["level"])

# Create handlers with explicit UTF-8 encoding
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(log_level)

file_handler = logging.FileHandler(logging_config["file"], encoding='utf-8')
file_handler.setLevel(log_level)

log_formatter = logging.Formatter(logging_config["format"])
console_handler.setFormatter(log_formatter)
file_handler.setFormatter(log_formatter)

logging.basicConfig(
    level=log_level,
    format=logging_config["format"],
    handlers=[console_handler, file_handler]
)

logger = logging.getLogger(__name__)

# 使用统一的API路由注册
from fastapi import Depends
from .api.v1 import api_router
from .api.v1.auth import router as auth_router, verify_token
from .core.database import engine
from .models.base import Base

# Create FastAPI app
app = FastAPI(
    title="AutoClip API",
    description="AI视频切片处理API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Create database tables
@app.on_event("startup")
async def startup_event():
    logger.info("启动AutoClip API服务...")
    # 导入所有模型以确保表被创建
    from .models.bilibili import BilibiliAccount, UploadRecord
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表创建完成")
    
    # 加载API密钥到环境变量
    api_key = get_api_key()
    if api_key:
        import os
        os.environ["DASHSCOPE_API_KEY"] = api_key
        logger.info("API密钥已加载到环境变量")
    else:
        logger.warning("未找到API密钥配置")
    
    # 启动WebSocket网关服务 - 已禁用，使用新的简化进度系统
    # from .services.websocket_gateway_service import websocket_gateway_service
    # await websocket_gateway_service.start()
    # logger.info("WebSocket网关服务已启动")
    logger.info("WebSocket网关服务已禁用，使用新的简化进度系统")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    logger.info("正在关闭AutoClip API服务...")
    # WebSocket网关服务已禁用
    # from .services.websocket_gateway_service import websocket_gateway_service
    # await websocket_gateway_service.stop()
    # logger.info("WebSocket网关服务已停止")
    logger.info("WebSocket网关服务已禁用")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth and health routers before unified api routes so they are public
from backend.api.v1.health import router as health_router
app.include_router(health_router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

# Include unified API routes (Fully Protected by Team JWT)
app.include_router(api_router, prefix="/api/v1", dependencies=[Depends(verify_token)])

# 添加独立的video-categories端点
@app.get("/api/v1/video-categories")
async def get_video_categories():
    """获取视频分类配置."""
    return {
        "categories": [
            {
                "value": "default",
                "name": "默认",
                "description": "通用视频内容处理",
                "icon": "🎬",
                "color": "#4facfe"
            },
            {
                "value": "knowledge",
                "name": "知识科普",
                "description": "科学、技术、历史、文化等知识类内容",
                "icon": "📚",
                "color": "#52c41a"
            },
            {
                "value": "entertainment",
                "name": "娱乐",
                "description": "游戏、音乐、电影等娱乐内容",
                "icon": "🎮",
                "color": "#722ed1"
            },
            {
                "value": "business",
                "name": "商业",
                "description": "商业、创业、投资等商业内容",
                "icon": "💼",
                "color": "#fa8c16"
            },
            {
                "value": "experience",
                "name": "经验分享",
                "description": "个人经历、生活感悟等经验内容",
                "icon": "🌟",
                "color": "#eb2f96"
            },
            {
                "value": "opinion",
                "name": "观点评论",
                "description": "时事评论、观点分析等评论内容",
                "icon": "💭",
                "color": "#13c2c2"
            },
            {
                "value": "speech",
                "name": "演讲",
                "description": "公开演讲、讲座等演讲内容",
                "icon": "🎤",
                "color": "#f5222d"
            }
        ]
    }

# 导入统一错误处理中间件
from .core.error_middleware import global_exception_handler

# 注册全局异常处理器
app.add_exception_handler(Exception, global_exception_handler)

# 挂载前端静态文件 (Production Mode SPA Support)
# We handle this at the very end so it acts as a catch-all after API routes
import os
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
# Inside docker the path is /app/frontend/dist. If running locally it's ../frontend/dist
if not os.path.exists(frontend_dist) and os.path.exists("/app/frontend/dist"):
    frontend_dist = "/app/frontend/dist"

if os.path.exists(frontend_dist):
    logger.info(f"开启前端静态文件服务: {frontend_dist}")
    
    # Mount assets directory directly
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        if catchall.startswith("api/"):
            # Avoid catching API 404s
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(frontend_dist, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
            
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Frontend not built")
else:
    logger.warning(f"前端静态文件目录不存在: {frontend_dist}，SPA支持已禁用")

if __name__ == "__main__":
    import uvicorn
    import sys
    
    # 默认端口
    port = 8000
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                try:
                    port = int(sys.argv[i + 1])
                except ValueError:
                    logger.error(f"无效的端口号: {sys.argv[i + 1]}")
                    port = 8000
    
    logger.info(f"启动服务器，端口: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)