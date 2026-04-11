"""
LLM管理器 - 统一管理多个模型提供商
"""
import json
import logging
import os
from typing import Dict, Any, Optional, List
from pathlib import Path

from .llm_providers import (
    LLMProvider, LLMProviderFactory, ProviderType, 
    ModelInfo, LLMResponse
)

logger = logging.getLogger(__name__)

class LLMManager:
    """LLM管理器"""
    
    def __init__(self, settings_file: Optional[Path] = None):
        self.settings_file = settings_file or self._get_default_settings_file()
        self.current_provider: Optional[LLMProvider] = None
        self.settings = self._load_settings()
        self._initialize_provider()
    
    def _get_default_settings_file(self) -> Path:
        """获取默认设置文件路径"""
        current_file = Path(__file__)
        project_root = current_file.parent.parent.parent  # backend/core -> backend -> project_root
        return project_root / "data" / "settings.json"
    
    def _load_settings(self) -> Dict[str, Any]:
        """加载设置"""
        default_settings = {
            "llm_provider": "openrouter",
            "dashscope_api_key": "",
            "openai_api_key": "",
            "gemini_api_key": "",
            "siliconflow_api_key": "",
            "groq_api_key": "",
            "blazeai_api_key": "",
            "openrouter_api_key": "",
            "model_name": "qwen/qwen3.6-plus:free",
            "chunk_size": 5000,
            "min_score_threshold": 0.7,
            "max_clips_per_collection": 5
        }
        
        if self.settings_file.exists():
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    saved_settings = json.load(f)
                    default_settings.update(saved_settings)
            except Exception as e:
                logger.warning(f"加载设置文件失败: {e}")
        
        return default_settings
    
    def _save_settings(self):
        """保存设置"""
        self.settings_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存设置失败: {e}")
            raise
    
    def _initialize_provider(self):
        """初始化当前提供商"""
        try:
            provider_type = ProviderType(self.settings.get("llm_provider", "dashscope"))
            model_name = self.settings.get("model_name", "qwen-plus")
            
            # 获取对应提供商的API密钥
            api_key = self._get_api_key_for_provider(provider_type)
            
            if api_key:
                self.current_provider = LLMProviderFactory.create_provider(
                    provider_type, api_key, model_name
                )
                logger.info(f"已初始化{provider_type.value}提供商，模型: {model_name}")
            else:
                logger.warning(f"未找到{provider_type.value}的API密钥")
                
        except Exception as e:
            logger.error(f"初始化提供商失败: {e}")
            self.current_provider = None
    
    def _get_api_key_for_provider(self, provider_type: ProviderType) -> Optional[str]:
        """获取指定提供商的API密钥 — checks settings.json first, then environment variables"""
        key_mapping = {
            ProviderType.DASHSCOPE: "dashscope_api_key",
            ProviderType.OPENAI: "openai_api_key",
            ProviderType.GEMINI: "gemini_api_key",
            ProviderType.SILICONFLOW: "siliconflow_api_key",
            ProviderType.GROQ: "groq_api_key",
            ProviderType.BLAZEAI: "blazeai_api_key",
            ProviderType.OPENROUTER: "openrouter_api_key",
            ProviderType.COMPLETIONSME: "completionsme_api_key",
        }
        
        # Environment variable fallback mapping
        env_mapping = {
            ProviderType.DASHSCOPE: "API_DASHSCOPE_API_KEY",
            ProviderType.OPENAI: "OPENAI_API_KEY",
            ProviderType.GEMINI: "GEMINI_API_KEY",
            ProviderType.SILICONFLOW: "SILICONFLOW_API_KEY",
            ProviderType.GROQ: "GROQ_API_KEY",
            ProviderType.BLAZEAI: "BLAZEAI_API_KEY",
            ProviderType.OPENROUTER: "OPENROUTER_API_KEY",
            ProviderType.COMPLETIONSME: "COMPLETIONSME_API_KEY",
        }
        
        # 1. Try settings.json first
        key_name = key_mapping.get(provider_type)
        if key_name:
            api_key = self.settings.get(key_name, "")
            if api_key:
                return api_key
        
        # 2. Fallback to environment variable
        env_name = env_mapping.get(provider_type)
        if env_name:
            env_key = os.getenv(env_name, "")
            if env_key:
                logger.info(f"Using {provider_type.value} API key from environment variable {env_name}")
                return env_key
        
        return None
    
    def update_settings(self, new_settings: Dict[str, Any]):
        """更新设置"""
        self.settings.update(new_settings)
        self._save_settings()
        self._initialize_provider()
    
    def set_provider(self, provider_type: ProviderType, api_key: str, model_name: str):
        """设置提供商"""
        try:
            # 更新设置
            provider_settings = {
                "llm_provider": provider_type.value,
                "model_name": model_name
            }
            
            # 更新对应提供商的API密钥
            key_mapping = {
                ProviderType.DASHSCOPE: "dashscope_api_key",
                ProviderType.OPENAI: "openai_api_key",
                ProviderType.GEMINI: "gemini_api_key",
                ProviderType.SILICONFLOW: "siliconflow_api_key",
                ProviderType.GROQ: "groq_api_key",
                ProviderType.BLAZEAI: "blazeai_api_key",
                ProviderType.OPENROUTER: "openrouter_api_key",
                ProviderType.COMPLETIONSME: "completionsme_api_key",
            }
            
            key_name = key_mapping.get(provider_type)
            if key_name:
                provider_settings[key_name] = api_key
            
            self.update_settings(provider_settings)
            
            # 创建新的提供商实例
            self.current_provider = LLMProviderFactory.create_provider(
                provider_type, api_key, model_name
            )
            
            logger.info(f"已切换到{provider_type.value}提供商，模型: {model_name}")
            
        except Exception as e:
            logger.error(f"设置提供商失败: {e}")
            raise
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> str:
        """调用LLM"""
        if not self.current_provider:
            raise ValueError("未配置LLM提供商，请在设置页面配置API密钥")
        
        try:
            response = self.current_provider.call(prompt, input_data, **kwargs)
            return response.content
        except Exception as e:
            logger.error(f"LLM调用失败: {e}")
            raise
    
    def call_with_retry(self, prompt: str, input_data: Any = None, max_retries: int = 3, **kwargs) -> str:
        """
        BULLETPROOF LLM call — loops through ALL providers and models INFINITELY until success.
        
        Order:
        1. Primary configured provider (with retries + exponential backoff)
        2. BlazeAI fallback models
        3. Free OpenRouter models (auto-rotation)
        4. Completions.me models (17 premium models — ultimate fallback)
        5. If ALL fail → wait 30s → LOOP BACK to step 1 → repeat forever
        
        This method NEVER raises an exception. It will keep trying until it succeeds.
        """
        import time
        from .llm_providers import CompletionsMeProvider
        
        round_number = 0
        
        while True:  # Infinite outer loop — NEVER give up
            round_number += 1
            logger.info(f"=== LLM Call Round #{round_number} ===")
            
            # ---------------------------------------------------------------
            # STAGE 1: Try primary provider with retries
            # ---------------------------------------------------------------
            if self.current_provider:
                for attempt in range(max_retries):
                    try:
                        result = self.call(prompt, input_data, **kwargs)
                        if result and len(result.strip()) > 0:
                            return result
                        logger.warning(f"Primary provider returned empty response (attempt {attempt + 1})")
                    except ValueError:
                        # Config error (no API key etc) — skip to fallbacks immediately
                        logger.warning("Primary provider config error, skipping to fallbacks")
                        break
                    except Exception as e:
                        error_str = str(e)
                        is_rate_limit = '429' in error_str or 'Too Many Requests' in error_str or 'rate' in error_str.lower()
                        
                        if is_rate_limit:
                            delay = min(60, 15 * (attempt + 1))
                            logger.warning(f"Primary rate-limited (attempt {attempt + 1}/{max_retries}), waiting {delay}s...")
                        else:
                            delay = min(30, 2 ** attempt)
                            logger.warning(f"Primary failed (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                        
                        if attempt < max_retries - 1:
                            time.sleep(delay)
                
                logger.info("Primary provider exhausted, moving to fallbacks...")
            
            # ---------------------------------------------------------------
            # STAGE 2: BlazeAI fallback models
            # ---------------------------------------------------------------
            blazeai_api_key = self._get_api_key_for_provider(ProviderType.BLAZEAI)
            if blazeai_api_key:
                blazeai_models = ["openai/gpt-5.1", "grok/grok-4.1-mini", "anthropic/claude-sonnet-4-6"]
                for model_name in blazeai_models:
                    try:
                        logger.info(f"Trying BlazeAI fallback: {model_name}")
                        provider = LLMProviderFactory.create_provider(
                            ProviderType.BLAZEAI, blazeai_api_key, model_name
                        )
                        response = provider.call(prompt, input_data, **kwargs)
                        if response.content and len(response.content.strip()) > 0:
                            logger.info(f"✅ BlazeAI/{model_name} succeeded!")
                            return response.content
                    except Exception as e:
                        logger.warning(f"BlazeAI/{model_name} failed: {str(e)[:150]}")
                        time.sleep(2)
            
            # ---------------------------------------------------------------
            # STAGE 3: Free OpenRouter models (no API key needed for :free)
            # ---------------------------------------------------------------
            openrouter_key = self._get_api_key_for_provider(ProviderType.OPENROUTER) or ""
            free_openrouter_models = [
                "qwen/qwen3.6-plus:free",
                "google/gemma-4-31b-it:free",
                "meta-llama/llama-3.3-70b-instruct:free",
                "deepseek/deepseek-r1:free",
                "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
                "qwen/qwen-2.5-coder-32b-instruct:free",
                "stepfun/step-3.5-flash:free",
                "google/gemini-2.5-pro-exp-03-25:free",
            ]
            for model_name in free_openrouter_models:
                try:
                    logger.info(f"Trying OpenRouter fallback: {model_name}")
                    provider = LLMProviderFactory.create_provider(
                        ProviderType.OPENROUTER, openrouter_key, model_name
                    )
                    response = provider.call(prompt, input_data, **kwargs)
                    if response.content and len(response.content.strip()) > 0:
                        logger.info(f"✅ OpenRouter/{model_name} succeeded!")
                        return response.content
                except Exception as e:
                    logger.warning(f"OpenRouter/{model_name} failed: {str(e)[:150]}")
                    time.sleep(3)
            
            # ---------------------------------------------------------------
            # STAGE 4: Completions.me — 17 premium models (ultimate fallback)
            # ---------------------------------------------------------------
            for model_name in CompletionsMeProvider.ALL_MODELS:
                try:
                    logger.info(f"Trying completions.me fallback: {model_name}")
                    provider = CompletionsMeProvider(model_name=model_name)
                    response = provider.call(prompt, input_data, **kwargs)
                    if response.content and len(response.content.strip()) > 0:
                        logger.info(f"✅ completions.me/{model_name} succeeded!")
                        return response.content
                except Exception as e:
                    logger.warning(f"completions.me/{model_name} failed: {str(e)[:150]}")
                    time.sleep(2)
            
            # ---------------------------------------------------------------
            # ALL providers exhausted this round — wait and try again
            # ---------------------------------------------------------------
            wait_time = min(60, 30 * round_number)
            logger.warning(
                f"⚠️ All {len(free_openrouter_models) + len(CompletionsMeProvider.ALL_MODELS) + 3} models failed in round #{round_number}. "
                f"Waiting {wait_time}s before retrying ALL providers again..."
            )
            time.sleep(wait_time)
    
    def test_provider_connection(self, provider_type: ProviderType, api_key: str, model_name: str) -> bool:
        """测试提供商连接"""
        try:
            provider = LLMProviderFactory.create_provider(provider_type, api_key, model_name)
            return provider.test_connection()
        except Exception as e:
            logger.error(f"测试{provider_type.value}连接失败: {e}")
            return False
    
    def get_current_provider_info(self) -> Dict[str, Any]:
        """获取当前提供商信息"""
        if not self.current_provider:
            return {"provider": None, "model": None, "available": False}
        
        provider_type = ProviderType(self.settings.get("llm_provider", "dashscope"))
        model_name = self.settings.get("model_name", "qwen-plus")
        
        return {
            "provider": provider_type.value,
            "model": model_name,
            "available": True,
            "display_name": self._get_provider_display_name(provider_type)
        }
    
    def _get_provider_display_name(self, provider_type: ProviderType) -> str:
        """获取提供商显示名称"""
        display_names = {
            ProviderType.DASHSCOPE: "阿里通义千问",
            ProviderType.OPENAI: "OpenAI",
            ProviderType.GEMINI: "Google Gemini",
            ProviderType.SILICONFLOW: "硅基流动",
            ProviderType.GROQ: "Groq",
            ProviderType.BLAZEAI: "BlazeAI (Claude)",
            ProviderType.OPENROUTER: "OpenRouter",
            ProviderType.COMPLETIONSME: "Completions.me (Ultimate Fallback)"
        }
        return display_names.get(provider_type, provider_type.value)
    
    def get_all_available_models(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取所有可用模型"""
        all_models = LLMProviderFactory.get_all_available_models()
        result = {}
        
        for provider_type, models in all_models.items():
            provider_name = provider_type.value
            result[provider_name] = [
                {
                    "name": model.name,
                    "display_name": model.display_name,
                    "max_tokens": model.max_tokens,
                    "description": model.description
                }
                for model in models
            ]
        
        return result
    
    def parse_json_response(self, response: str) -> Any:
        """解析JSON响应（保持与原LLMClient的兼容性）"""
        if not self.current_provider:
            raise ValueError("未配置LLM提供商")
        
        # 这里可以复用原LLMClient的JSON解析逻辑
        # 为了保持兼容性，我们创建一个临时的LLMClient实例
        from ..utils.llm_client import LLMClient
        temp_client = LLMClient()
        return temp_client.parse_json_response(response)

# 全局LLM管理器实例
_llm_manager: Optional[LLMManager] = None

def get_llm_manager() -> LLMManager:
    """获取全局LLM管理器实例"""
    global _llm_manager
    if _llm_manager is None:
        _llm_manager = LLMManager()
    return _llm_manager

def initialize_llm_manager(settings_file: Optional[Path] = None) -> LLMManager:
    """初始化LLM管理器"""
    global _llm_manager
    _llm_manager = LLMManager(settings_file)
    return _llm_manager
