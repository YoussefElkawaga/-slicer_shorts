"""
多模型提供商统一接口
支持OpenAI、Gemini、硅基流动、阿里DashScope等
"""
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union
from enum import Enum
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

class ProviderType(Enum):
    """模型提供商类型"""
    DASHSCOPE = "dashscope"  # 阿里通义千问
    OPENAI = "openai"        # OpenAI
    GEMINI = "gemini"        # Google Gemini
    SILICONFLOW = "siliconflow"  # 硅基流动
    GROQ = "groq"            # Groq (fast inference)
    BLAZEAI = "blazeai"      # BlazeAI (Claude proxy)
    OPENROUTER = "openrouter"  # OpenRouter (multi-model)

@dataclass
class ModelInfo:
    """模型信息"""
    name: str
    display_name: str
    provider: ProviderType
    max_tokens: int
    cost_per_token: Optional[float] = None
    description: Optional[str] = None

@dataclass
class LLMResponse:
    """LLM响应"""
    content: str
    usage: Optional[Dict[str, Any]] = None
    model: Optional[str] = None
    finish_reason: Optional[str] = None

class LLMProvider(ABC):
    """LLM提供商抽象基类"""
    
    def __init__(self, api_key: str, model_name: str, **kwargs):
        self.api_key = api_key
        self.model_name = model_name
        self.kwargs = kwargs
    
    @abstractmethod
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """
        调用模型API
        
        Args:
            prompt: 提示词
            input_data: 输入数据
            **kwargs: 其他参数
            
        Returns:
            LLMResponse: 模型响应
        """
        pass
    
    @abstractmethod
    def test_connection(self) -> bool:
        """
        测试API连接
        
        Returns:
            bool: 连接是否成功
        """
        pass
    
    @abstractmethod
    def get_available_models(self) -> List[ModelInfo]:
        """
        获取可用模型列表
        
        Returns:
            List[ModelInfo]: 可用模型列表
        """
        pass
    
    def _build_full_input(self, prompt: str, input_data: Any = None) -> str:
        """构建完整的输入"""
        if input_data:
            if isinstance(input_data, dict):
                return f"{prompt}\n\n输入内容：\n{json.dumps(input_data, ensure_ascii=False, indent=2)}"
            else:
                return f"{prompt}\n\n输入内容：\n{input_data}"
        return prompt

class DashScopeProvider(LLMProvider):
    """阿里DashScope提供商"""
    
    def __init__(self, api_key: str, model_name: str = "qwen-plus", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        try:
            from dashscope import Generation
            self.generation = Generation
        except ImportError:
            raise ImportError("请安装dashscope: pip install dashscope")
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """调用DashScope API"""
        try:
            full_input = self._build_full_input(prompt, input_data)
            
            response_or_gen = self.generation.call(
                model=self.model_name,
                prompt=full_input,
                api_key=self.api_key,
                stream=False,
                **kwargs
            )
            
            # 处理响应
            # DashScope的GenerationResponse虽然有__iter__方法，但不是真正的迭代器
            # 直接使用响应对象本身
            response = response_or_gen
            
            if response and response.status_code == 200:
                if response.output and response.output.text is not None:
                    return LLMResponse(
                        content=response.output.text,
                        model=self.model_name,
                        finish_reason=getattr(response.output, 'finish_reason', None)
                    )
                else:
                    finish_reason = getattr(response.output, 'finish_reason', 'unknown') if response.output else 'unknown'
                    logger.warning(f"API请求成功，但输出为空。结束原因: {finish_reason}")
                    return LLMResponse(content="")
            else:
                code = getattr(response, 'code', 'N/A')
                message = getattr(response, 'message', '未知API错误')
                raise Exception(f"API调用失败 - Status: {response.status_code}, Code: {code}, Message: {message}")
                
        except Exception as e:
            logger.error(f"DashScope调用失败: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """测试DashScope连接"""
        try:
            response = self.call("请回复'测试成功'")
            return "测试成功" in response.content or "success" in response.content.lower()
        except Exception as e:
            logger.error(f"DashScope连接测试失败: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """获取DashScope可用模型"""
        return [
            ModelInfo(
                name="qwen-plus",
                display_name="通义千问Plus",
                provider=ProviderType.DASHSCOPE,
                max_tokens=8192,
                description="阿里云通义千问Plus模型"
            ),
            ModelInfo(
                name="qwen-max",
                display_name="通义千问Max",
                provider=ProviderType.DASHSCOPE,
                max_tokens=8192,
                description="阿里云通义千问Max模型"
            ),
            ModelInfo(
                name="qwen-turbo",
                display_name="通义千问Turbo",
                provider=ProviderType.DASHSCOPE,
                max_tokens=8192,
                description="阿里云通义千问Turbo模型"
            )
        ]

class OpenAIProvider(LLMProvider):
    """OpenAI提供商"""
    
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        try:
            import openai
            self.client = openai.OpenAI(api_key=api_key)
        except ImportError:
            raise ImportError("请安装openai: pip install openai")
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """调用OpenAI API"""
        try:
            full_input = self._build_full_input(prompt, input_data)
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": full_input}],
                **kwargs
            )
            
            content = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            } if response.usage else None
            
            return LLMResponse(
                content=content,
                usage=usage,
                model=self.model_name,
                finish_reason=response.choices[0].finish_reason
            )
            
        except Exception as e:
            logger.error(f"OpenAI调用失败: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """测试OpenAI连接"""
        try:
            response = self.call("请回复'测试成功'")
            return "测试成功" in response.content or "success" in response.content.lower()
        except Exception as e:
            logger.error(f"OpenAI连接测试失败: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """获取OpenAI可用模型"""
        return [
            ModelInfo(
                name="gpt-3.5-turbo",
                display_name="GPT-3.5 Turbo",
                provider=ProviderType.OPENAI,
                max_tokens=4096,
                description="OpenAI GPT-3.5 Turbo模型"
            ),
            ModelInfo(
                name="gpt-4",
                display_name="GPT-4",
                provider=ProviderType.OPENAI,
                max_tokens=8192,
                description="OpenAI GPT-4模型"
            ),
            ModelInfo(
                name="gpt-4-turbo",
                display_name="GPT-4 Turbo",
                provider=ProviderType.OPENAI,
                max_tokens=128000,
                description="OpenAI GPT-4 Turbo模型"
            )
        ]

class GeminiProvider(LLMProvider):
    """Google Gemini提供商"""
    
    def __init__(self, api_key: str, model_name: str = "gemini-2.5-flash", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(model_name)
        except ImportError:
            raise ImportError("请安装google-generativeai: pip install google-generativeai")
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """调用Gemini API"""
        try:
            full_input = self._build_full_input(prompt, input_data)
            
            response = self.model.generate_content(full_input, **kwargs)
            
            return LLMResponse(
                content=response.text,
                model=self.model_name,
                finish_reason=getattr(response, 'finish_reason', None)
            )
            
        except Exception as e:
            logger.error(f"Gemini调用失败: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """测试Gemini连接"""
        try:
            response = self.call("请回复'测试成功'")
            return "测试成功" in response.content or "success" in response.content.lower()
        except Exception as e:
            logger.error(f"Gemini连接测试失败: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """获取Gemini可用模型"""
        return [
            ModelInfo(
                name="gemini-2.5-flash",
                display_name="Gemini 2.5 Flash",
                provider=ProviderType.GEMINI,
                max_tokens=1000000,
                description="Google Gemini 2.5 Flash模型"
            ),
            ModelInfo(
                name="gemini-1.5-pro",
                display_name="Gemini 1.5 Pro",
                provider=ProviderType.GEMINI,
                max_tokens=2000000,
                description="Google Gemini 1.5 Pro模型"
            ),
            ModelInfo(
                name="gemini-1.5-flash",
                display_name="Gemini 1.5 Flash",
                provider=ProviderType.GEMINI,
                max_tokens=1000000,
                description="Google Gemini 1.5 Flash模型"
            )
        ]

class SiliconFlowProvider(LLMProvider):
    """硅基流动提供商"""
    
    def __init__(self, api_key: str, model_name: str = "Qwen/Qwen2.5-7B-Instruct", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        self.base_url = "https://api.siliconflow.cn/v1"
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """调用硅基流动API"""
        try:
            import requests
            
            full_input = self._build_full_input(prompt, input_data)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": full_input}],
                "stream": False,
                **kwargs
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage")
            
            return LLMResponse(
                content=content,
                usage=usage,
                model=self.model_name,
                finish_reason=result["choices"][0].get("finish_reason")
            )
            
        except Exception as e:
            logger.error(f"硅基流动调用失败: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """测试硅基流动连接"""
        try:
            response = self.call("请回复'测试成功'")
            return "测试成功" in response.content or "success" in response.content.lower()
        except Exception as e:
            logger.error(f"硅基流动连接测试失败: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """获取硅基流动可用模型"""
        return [
            ModelInfo(
                name="Qwen/Qwen2.5-7B-Instruct",
                display_name="Qwen2.5-7B",
                provider=ProviderType.SILICONFLOW,
                max_tokens=32768,
                description="硅基流动Qwen2.5-7B模型"
            ),
            ModelInfo(
                name="Qwen/Qwen2.5-14B-Instruct",
                display_name="Qwen2.5-14B",
                provider=ProviderType.SILICONFLOW,
                max_tokens=32768,
                description="硅基流动Qwen2.5-14B模型"
            ),
            ModelInfo(
                name="Qwen/Qwen2.5-32B-Instruct",
                display_name="Qwen2.5-32B",
                provider=ProviderType.SILICONFLOW,
                max_tokens=32768,
                description="硅基流动Qwen2.5-32B模型"
            ),
            ModelInfo(
                name="deepseek-ai/DeepSeek-V2.5",
                display_name="DeepSeek-V2.5",
                provider=ProviderType.SILICONFLOW,
                max_tokens=65536,
                description="硅基流动DeepSeek-V2.5模型"
            )
        ]

class GroqLLMProvider(LLMProvider):
    """Groq LLM Provider — uses OpenAI-compatible chat completions API"""
    
    def __init__(self, api_key: str, model_name: str = "llama-3.3-70b-versatile", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        self.base_url = "https://api.groq.com/openai/v1"
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """Call Groq chat completions API"""
        try:
            import requests
            
            # Groq free tier has strict payload limits — truncate oversized inputs
            MAX_INPUT_CHARS = 12000  # ~3000 tokens, safe for Groq free tier
            
            if input_data:
                # Truncate the text field in input_data if too large
                if isinstance(input_data, dict) and 'text' in input_data:
                    text = input_data['text']
                    if len(text) > MAX_INPUT_CHARS:
                        logger.warning(
                            f"Input text too large ({len(text)} chars), truncating to {MAX_INPUT_CHARS} chars"
                        )
                        input_data = input_data.copy()
                        input_data['text'] = text[:MAX_INPUT_CHARS] + "\n\n[... content truncated for API limits ...]"
                elif isinstance(input_data, str) and len(input_data) > MAX_INPUT_CHARS:
                    input_data = input_data[:MAX_INPUT_CHARS] + "\n\n[... content truncated ...]"
            
            full_input = self._build_full_input(prompt, input_data)
            
            # Also cap total input size (prompt + data combined)
            MAX_TOTAL_CHARS = 18000
            if len(full_input) > MAX_TOTAL_CHARS:
                full_input = full_input[:MAX_TOTAL_CHARS] + "\n\n[... truncated ...]"
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": full_input}],
                "temperature": 0.3,
                "max_tokens": 4096,
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=120
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage")
            
            return LLMResponse(
                content=content,
                usage=usage,
                model=self.model_name,
                finish_reason=result["choices"][0].get("finish_reason")
            )
            
        except Exception as e:
            logger.error(f"Groq LLM call failed: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """Test Groq connection"""
        try:
            response = self.call("Reply with exactly: test success")
            return len(response.content) > 0
        except Exception as e:
            logger.error(f"Groq connection test failed: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """Get available Groq models"""
        return [
            ModelInfo(
                name="llama-3.3-70b-versatile",
                display_name="Llama 3.3 70B",
                provider=ProviderType.GROQ,
                max_tokens=32768,
                description="Meta Llama 3.3 70B on Groq (fast, free)"
            ),
            ModelInfo(
                name="llama-3.1-8b-instant",
                display_name="Llama 3.1 8B",
                provider=ProviderType.GROQ,
                max_tokens=8192,
                description="Meta Llama 3.1 8B on Groq (fastest)"
            ),
            ModelInfo(
                name="gemma2-9b-it",
                display_name="Gemma 2 9B",
                provider=ProviderType.GROQ,
                max_tokens=8192,
                description="Google Gemma 2 9B on Groq"
            ),
        ]

class BlazeAIProvider(LLMProvider):
    """BlazeAI Provider — Claude proxy with OpenAI-compatible API"""
    
    def __init__(self, api_key: str, model_name: str = "openai/gpt-5.1", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        self.base_url = os.getenv("BLAZEAI_BASE_URL", "https://blazeai.boxu.dev/api/")
        # Ensure base_url ends without trailing slash for proper path joining
        self.base_url = self.base_url.rstrip('/')
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """Call BlazeAI (Claude) API"""
        try:
            import requests
            
            full_input = self._build_full_input(prompt, input_data)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": full_input}],
                "temperature": 0.3,
                "max_tokens": 8192,
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=180  # Claude can take longer for complex analysis
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage")
            
            return LLMResponse(
                content=content,
                usage=usage,
                model=self.model_name,
                finish_reason=result["choices"][0].get("finish_reason")
            )
            
        except Exception as e:
            logger.error(f"BlazeAI call failed: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """Test BlazeAI connection"""
        try:
            response = self.call("Reply with exactly: test success")
            return len(response.content) > 0
        except Exception as e:
            logger.error(f"BlazeAI connection test failed: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """Get available BlazeAI models"""
        return [
            ModelInfo(
                name="openai/gpt-5.1",
                display_name="GPT-5.1 (BlazeAI)",
                provider=ProviderType.BLAZEAI,
                max_tokens=128000,
                description="OpenAI GPT-5.1 via BlazeAI"
            ),
            ModelInfo(
                name="grok/grok-4.1-mini",
                display_name="Grok 4.1 Mini (BlazeAI)",
                provider=ProviderType.BLAZEAI,
                max_tokens=131072,
                description="xAI Grok 4.1 Mini via BlazeAI"
            ),
            ModelInfo(
                name="anthropic/claude-sonnet-4-6",
                display_name="Claude Sonnet 4 (BlazeAI)",
                provider=ProviderType.BLAZEAI,
                max_tokens=200000,
                description="Anthropic Claude Sonnet 4 via BlazeAI"
            ),
        ]


class OpenRouterProvider(LLMProvider):
    """OpenRouter Provider — multi-model API with free options"""
    
    def __init__(self, api_key: str, model_name: str = "qwen/qwen3.6-plus:free", **kwargs):
        super().__init__(api_key, model_name, **kwargs)
        self.base_url = "https://openrouter.ai/api/v1"
    
    def call(self, prompt: str, input_data: Any = None, **kwargs) -> LLMResponse:
        """Call OpenRouter API"""
        try:
            import requests
            
            full_input = self._build_full_input(prompt, input_data)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AutoClip"
            }
            
            data = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": full_input}],
                "temperature": 0.3,
                "max_tokens": 8192,
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=180
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage")
            
            return LLMResponse(
                content=content,
                usage=usage,
                model=self.model_name,
                finish_reason=result["choices"][0].get("finish_reason")
            )
            
        except Exception as e:
            logger.error(f"OpenRouter call failed: {str(e)}")
            raise
    
    def test_connection(self) -> bool:
        """Test OpenRouter connection"""
        try:
            response = self.call("Reply with exactly: test success")
            return len(response.content) > 0
        except Exception as e:
            logger.error(f"OpenRouter connection test failed: {e}")
            return False
    
    def get_available_models(self) -> List[ModelInfo]:
        """Get available OpenRouter models"""
        return [
            ModelInfo(
                name="qwen/qwen3.6-plus:free",
                display_name="Qwen 3.6 Plus (free)",
                provider=ProviderType.OPENROUTER,
                max_tokens=1000000,
                description="Qwen 3.6 Plus via OpenRouter (free, 1M context)"
            ),
            ModelInfo(
                name="stepfun/step-3.5-flash:free",
                display_name="Step 3.5 Flash (free)",
                provider=ProviderType.OPENROUTER,
                max_tokens=256000,
                description="StepFun Step 3.5 Flash via OpenRouter (free)"
            ),
            ModelInfo(
                name="meta-llama/llama-3.3-70b-instruct:free",
                display_name="Llama 3.3 70B (free)",
                provider=ProviderType.OPENROUTER,
                max_tokens=131072,
                description="Meta Llama 3.3 70B via OpenRouter (free)"
            ),
        ]


class LLMProviderFactory:
    """LLM提供商工厂"""
    
    _providers = {
        ProviderType.DASHSCOPE: DashScopeProvider,
        ProviderType.OPENAI: OpenAIProvider,
        ProviderType.GEMINI: GeminiProvider,
        ProviderType.SILICONFLOW: SiliconFlowProvider,
        ProviderType.GROQ: GroqLLMProvider,
        ProviderType.BLAZEAI: BlazeAIProvider,
        ProviderType.OPENROUTER: OpenRouterProvider,
    }
    
    @classmethod
    def create_provider(cls, provider_type: ProviderType, api_key: str, model_name: str, **kwargs) -> LLMProvider:
        """创建提供商实例"""
        if provider_type not in cls._providers:
            raise ValueError(f"不支持的提供商类型: {provider_type}")
        
        provider_class = cls._providers[provider_type]
        return provider_class(api_key, model_name, **kwargs)
    
    @classmethod
    def get_all_available_models(cls) -> Dict[ProviderType, List[ModelInfo]]:
        """获取所有提供商的可用模型"""
        models = {}
        for provider_type, provider_class in cls._providers.items():
            try:
                # 创建临时实例来获取模型列表
                temp_provider = provider_class("dummy_key", "dummy_model")
                models[provider_type] = temp_provider.get_available_models()
            except Exception as e:
                logger.warning(f"无法获取{provider_type.value}的模型列表: {e}")
                models[provider_type] = []
        return models
